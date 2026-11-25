import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/api_constants.dart';

class DownloadedPdf {
  final List<int> bytes;
  final String fileName;

  const DownloadedPdf({required this.bytes, required this.fileName});
}

/// Cached GET response with an absolute expiry time. Kept top-level because
/// Dart does not allow nested classes.
class _GetCacheEntry {
  final Map<String, dynamic> value;
  final DateTime expiry;
  _GetCacheEntry(this.value, this.expiry);
}

class ApiService {
  /// Same contract as the backend naming function and the web client:
  /// `SURNAME_Firstname_RX-YYYYMMDD-XXXXXXXX.pdf`, optional `_replaces-...`
  /// and `_SUPERSEDED` markers, or the name-free RX fallback.
  static final RegExp _prescriptionFileNamePattern = RegExp(
    r'^(?:[A-Z0-9-]+_[A-Za-z0-9][A-Za-z0-9-]*_RX-\d{8}-[A-Z0-9]+(?:_replaces-[A-Z0-9]+)?(?:_SUPERSEDED)?|RX-\d{8}-[A-Z0-9]+)\.pdf$',
  );

  final String baseUrl = ApiConstants.baseUrl;
  String? _accessToken;
  String? _refreshToken;
  http.Client? _httpClient;

  // GET cache: successful GET responses are held for a short TTL so repeat
  // screen loads (e.g. navigating back to a list) do not hit the network again.
  // The cache is cleared whenever the token changes or the user logs out, so
  // one user's authenticated data is never served to another user.
  static const Duration _getCacheTtl = Duration(seconds: 15);
  final Map<String, _GetCacheEntry> _getCache = {};

  // In-flight request dedup: concurrent identical GETs share a single network
  // request instead of each issuing one.
  final Map<String, Future<Map<String, dynamic>>> _inFlightGets = {};

  // Maximum retries for safe (GET) requests on transient failures.
  static const int _getMaxRetries = 3;

  // Refresh-token coordination: prevents multiple concurrent GETs that all
  // receive 401 from each independently issuing a refresh request. Only one
  // refresh is performed at a time; waiters reuse its result.
  bool _isRefreshing = false;
  bool _refreshSucceeded = false;

  // Singleton pattern
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal() : _httpClient = http.Client();

  // Test seam: create instance with custom HTTP client (for testing only)
  static ApiService createWithClient(http.Client client) {
    return ApiService._forTesting(client);
  }

  // Internal constructor for testing only
  ApiService._forTesting(this._httpClient);

  /// Builds a cache/dedup key from the full request URI including query params.
  String _getCacheKey(String endpoint, Map<String, String>? queryParams) {
    final uri = Uri.parse('$baseUrl$endpoint');
    final replaced = queryParams == null || queryParams.isEmpty
        ? uri
        : uri.replace(queryParameters: queryParams);
    return replaced.toString();
  }

  /// Returns a cached GET response if present and not yet expired.
  Map<String, dynamic>? _readGetCache(String key) {
    final entry = _getCache[key];
    if (entry == null) return null;
    if (DateTime.now().isAfter(entry.expiry)) {
      _getCache.remove(key);
      return null;
    }
    return Map<String, dynamic>.from(entry.value);
  }

  /// Clears the GET cache so data for one session is never reused by another.
  void _clearGetCache() {
    _getCache.clear();
  }

  // Initialize and load token from storage
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('access_token');
    await _readRefreshToken();
  }

  // Save token to storage
  Future<void> _saveToken(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', token);
      _accessToken = token;
    } catch (e) {
      rethrow;
    }
  }

  /// Save refresh token to storage for 401 refresh-and-retry on safe GETs.
  Future<void> _saveRefreshToken(String token) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('refresh_token', token);
      _refreshToken = token;
    } catch (e) {
      rethrow;
    }
  }

  /// Read the persisted refresh token, if any.
  Future<String?> _readRefreshToken() async {
    if (_refreshToken != null && _refreshToken!.isNotEmpty) {
      return _refreshToken;
    }
    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('refresh_token');
      if (token != null && token.isNotEmpty) {
        _refreshToken = token;
      }
      return token;
    } catch (_) {
      return null;
    }
  }

  // Public method to save token (for use after OTP verification)
  Future<void> saveToken(String token) async {
    await _saveToken(token);
  }

  // Clear token and refresh token from storage
  Future<void> _clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    _accessToken = null;
    _refreshToken = null;
    _clearGetCache();
  }

  // Get headers with authorization
  Map<String, String> _getHeaders({bool requireAuth = true}) {
    final headers = <String, String>{'Content-Type': 'application/json'};

    if (requireAuth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }

    return headers;
  }

  // Generic GET request with short-TTL caching, in-flight dedup, retry with
  // backoff on transient failures, and 401 refresh-and-retry. Only GET requests
  // are cached/retried because they are safe and idempotent; mutations are
  // never cached or retried (see _clearGetCache below).
  Future<Map<String, dynamic>> get(
    String endpoint, {
    bool requireAuth = true,
    Map<String, String>? queryParams,
  }) async {
    final key = _getCacheKey(endpoint, queryParams);

    // Serve from cache while fresh.
    final cached = _readGetCache(key);
    if (cached != null) {
      return cached;
    }

    // Coalesce concurrent identical GETs onto a single request.
    if (_inFlightGets.containsKey(key)) {
      return _inFlightGets[key]!;
    }

    final request = _getWithRetry(endpoint, requireAuth: requireAuth, queryParams: queryParams);
    _inFlightGets[key] = request;
    try {
      final response = await request;
      // Cache successful responses only. A failed request is intentionally not
      // cached so the next attempt can succeed once the backend recovers.
      _getCache[key] = _GetCacheEntry(response, DateTime.now().add(_getCacheTtl));
      return response;
    } finally {
      _inFlightGets.remove(key);
    }
  }

  // Executes a single GET attempt. Network failures are normalised to
  // ApiException so the retry logic can handle them uniformly.
  Future<Map<String, dynamic>> _getOnce(
    String endpoint, {
    bool requireAuth = true,
    Map<String, String>? queryParams,
  }) async {
    final uri = Uri.parse('$baseUrl$endpoint');
    final resolved =
        queryParams == null || queryParams.isEmpty ? uri : uri.replace(queryParameters: queryParams);
    final client = _httpClient ?? http.Client();
    http.Response response;
    try {
      response = await client.get(resolved, headers: _getHeaders(requireAuth: requireAuth));
    } on Object catch (e) {
      throw ApiException(
        message: 'Network error: $e',
        code: 'NETWORK_ERROR',
        statusCode: 0,
      );
    }
    return _handleResponse(response);
  }

  // Retries a safe GET on transient failures: network errors, 429 (rate limit),
  // and 5xx server errors. A 401 triggers a single token refresh and retry.
  Future<Map<String, dynamic>> _getWithRetry(
    String endpoint, {
    bool requireAuth = true,
    Map<String, String>? queryParams,
  }) async {
    Duration delay = const Duration(milliseconds: 500);
    ApiException? lastError;

    for (int attempt = 1; attempt <= _getMaxRetries; attempt++) {
      try {
        return await _getOnce(endpoint, requireAuth: requireAuth, queryParams: queryParams);
      } on ApiException catch (e) {
        lastError = e;

        // 401: attempt to refresh the access token once, then retry this GET.
        if (e.statusCode == 401 && requireAuth && attempt == 1) {
          final refreshed = await _refreshAccessTokenStored();
          if (refreshed) {
            continue;
          }
        }

        final bool isRetriable =
            e.statusCode == 0 || // network error
            e.statusCode == 429 ||
            e.statusCode >= 500;

        if (isRetriable && attempt < _getMaxRetries) {
          await Future.delayed(delay);
          delay = Duration(milliseconds: (delay.inMilliseconds * 2).round());
          continue;
        }

        rethrow;
      }
    }
    throw lastError ??
        ApiException(message: 'Request failed', code: 'UNKNOWN_ERROR', statusCode: 0);
  }

  // Refreshes the access token using the stored refresh token and updates
  // storage. Returns true when a fresh access token is available. If another
  // request is already refreshing, this call waits for its result and reuses
  // it, preventing duplicate refresh requests during concurrent 401s.
  Future<bool> _refreshAccessTokenStored() async {
    // If a refresh is already in progress, wait for its result and reuse it.
    if (_isRefreshing) {
      for (int i = 0; i < 100; i++) {
        if (!_isRefreshing) break;
        await Future.delayed(const Duration(milliseconds: 50));
      }
      return _refreshSucceeded && _accessToken != null;
    }

    _isRefreshing = true;
    _refreshSucceeded = false;

    try {
      final refreshToken = await _readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        return false;
      }

      final response = await post(
        ApiConstants.refresh,
        body: {'refreshToken': refreshToken},
        requireAuth: false,
      );
      if (response['success'] == true) {
        final data = response['data'];
        final newAccessToken = data is Map ? data['accessToken'] : null;
        final newRefreshToken = data is Map ? data['refreshToken'] : null;
        if (newAccessToken is String && newAccessToken.isNotEmpty) {
          await _saveToken(newAccessToken);
          if (newRefreshToken is String && newRefreshToken.isNotEmpty) {
            await _saveRefreshToken(newRefreshToken);
          }
          _refreshSucceeded = true;
          return true;
        }
      }
      return false;
    } catch (_) {
      return false;
    } finally {
      _isRefreshing = false;
    }
  }

  // Generic POST request
  Future<Map<String, dynamic>> post(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requireAuth = false,
  }) async {
    final url = '$baseUrl$endpoint';

    final client = _httpClient ?? http.Client();
    final response = await client.post(
      Uri.parse(url),
      headers: _getHeaders(requireAuth: requireAuth),
      body: body != null ? jsonEncode(body) : null,
    );

    final result = _handleResponse(response);
    // Mutations invalidate cached GETs so the caller never reads stale data.
    _clearGetCache();
    return result;
  }

  // Generic POST request with multipart file upload
  Future<Map<String, dynamic>> postMultipart(
    String endpoint, {
    required File file,
    String fileField = 'file',
    Map<String, String>? fields,
    bool requireAuth = true,
  }) async {
    final url = '$baseUrl$endpoint';

    final client = _httpClient ?? http.Client();

    final request = http.MultipartRequest('POST', Uri.parse(url));

    // Add authorization header if required
    if (requireAuth && _accessToken != null) {
      request.headers['Authorization'] = 'Bearer $_accessToken';
    }

    // Detect MIME type from file extension
    final fileName = file.path.split('/').last;
    final fileExtension = fileName.split('.').last.toLowerCase();
    String contentType = 'application/octet-stream';

    switch (fileExtension) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg';
        break;
      case 'png':
        contentType = 'image/png';
        break;
    }

    // Add file
    final fileStream = http.ByteStream(file.openRead());
    final fileLength = await file.length();
    final multipartFile = http.MultipartFile(
      fileField,
      fileStream,
      fileLength,
      filename: fileName,
      contentType: MediaType.parse(contentType),
    );
    request.files.add(multipartFile);

    // Add additional fields
    if (fields != null) {
      request.fields.addAll(fields);
    }

    final response = await client.send(request);
    final responseBody = await response.stream.bytesToString();

    try {
      final body = jsonDecode(responseBody);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        _clearGetCache();
        return body;
      } else {
        throw ApiException(
          message: body['error']?['message'] ?? 'An error occurred',
          code: body['error']?['code'] ?? 'UNKNOWN_ERROR',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      if (e is ApiException) {
        rethrow;
      }
      throw ApiException(
        message: 'Failed to parse server response',
        code: 'PARSE_ERROR',
        statusCode: response.statusCode,
      );
    }
  }

  // Generic PUT request
  Future<Map<String, dynamic>> put(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requireAuth = true,
  }) async {
    final client = _httpClient ?? http.Client();
    final response = await client.put(
      Uri.parse('$baseUrl$endpoint'),
      headers: _getHeaders(requireAuth: requireAuth),
      body: body != null ? jsonEncode(body) : null,
    );

    final result = _handleResponse(response);
    _clearGetCache();
    return result;
  }

  // Generic PATCH request
  Future<Map<String, dynamic>> patch(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requireAuth = true,
  }) async {
    final client = _httpClient ?? http.Client();
    final response = await client.patch(
      Uri.parse('$baseUrl$endpoint'),
      headers: _getHeaders(requireAuth: requireAuth),
      body: body != null ? jsonEncode(body) : null,
    );

    final result = _handleResponse(response);
    _clearGetCache();
    return result;
  }

  // Generic DELETE request
  Future<Map<String, dynamic>> delete(
    String endpoint, {
    bool requireAuth = true,
  }) async {
    final client = _httpClient ?? http.Client();
    final response = await client.delete(
      Uri.parse('$baseUrl$endpoint'),
      headers: _getHeaders(requireAuth: requireAuth),
    );

    final result = _handleResponse(response);
    _clearGetCache();
    return result;
  }

  // Handle API response
  Map<String, dynamic> _handleResponse(http.Response response) {
    try {
      final body = jsonDecode(response.body);

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return body;
      } else {
        throw ApiException(
          message: body['error']?['message'] ?? 'An error occurred',
          code: body['error']?['code'] ?? 'UNKNOWN_ERROR',
          statusCode: response.statusCode,
        );
      }
    } catch (e) {
      if (e is ApiException) {
        rethrow;
      }
      throw ApiException(
        message: 'Failed to parse server response',
        code: 'PARSE_ERROR',
        statusCode: response.statusCode,
      );
    }
  }

  // ===========================
  // AUTH METHODS
  // ===========================

  Future<Map<String, dynamic>> login(String email, String password) async {
    // The mobile application is shared by patients and secretaries. There is
    // no role selector, so the backend is asked to verify the account against
    // a role. The User record's role field remains the single source of truth;
    // the backend still rejects any account that does not match the attempted
    // role.
    //
    // Performance: returning users already have their role persisted after a
    // previous successful login. Trying that role first avoids a duplicate
    // backend login request (and a duplicate OTP send when OTP is required).
    // First-time users (no persisted role) keep the original patient-then-
    // secretary ordering, and a stored role that no longer matches falls back
    // to the other role, so existing authentication behaviour is preserved.
    final prefs = await SharedPreferences.getInstance();
    final storedRole = prefs.getString('user_role');
    final supportedRoles = const ['PATIENT', 'SECRETARY'];
    final expectedRoles = <String>[];
    if (storedRole != null &&
        storedRole.isNotEmpty &&
        supportedRoles.contains(storedRole)) {
      expectedRoles.add(storedRole);
    }
    for (final role in supportedRoles) {
      if (!expectedRoles.contains(role)) {
        expectedRoles.add(role);
      }
    }

    Map<String, dynamic>? lastFailure;

    for (final expectedRole in expectedRoles) {
      try {
        final response = await post(
          ApiConstants.login,
          body: {
            'email': email,
            'password': password,
            'expectedRole': expectedRole,
          },
          requireAuth: false,
        );

        if (response['success'] == true) {
          final data = response['data'];
          final accessToken = data is Map ? data['accessToken'] : null;
          if (accessToken is String && accessToken.isNotEmpty) {
            await _saveToken(accessToken);
          }
          final refreshToken = data is Map ? data['refreshToken'] : null;
          if (refreshToken is String && refreshToken.isNotEmpty) {
            await _saveRefreshToken(refreshToken);
          }
          // Persist the authenticated role so the next login can skip the
          // duplicate attempt. Mirrors the role persisted by the login page.
          final userData = data is Map ? data['user'] : null;
          final loggedInRole = userData is Map ? userData['role'] : null;
          if (loggedInRole is String && loggedInRole.isNotEmpty) {
            await prefs.setString('user_role', loggedInRole);
          }
          return response;
        }

        lastFailure = response;
      } on ApiException catch (e) {
        lastFailure = {
          'success': false,
          'error': {'message': e.message, 'code': e.code},
        };

        // Only an invalid role/credential response is worth retrying with the
        // other supported mobile role. Network and server errors surface
        // immediately.
        if (e.code != 'INVALID_CREDENTIALS') {
          rethrow;
        }
      }
    }

    return lastFailure ??
        {
          'success': false,
          'error': {'message': 'Login failed', 'code': 'UNKNOWN_ERROR'},
        };
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String role,
    String? firstName,
    String? lastName,
  }) async {
    final response = await post(
      ApiConstants.register,
      body: {
        'email': email,
        'password': password,
        'role': role,
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
      },
      requireAuth: false,
    );

    if (response['success'] == true) {
      final accessToken = response['data']['accessToken'];
      await _saveToken(accessToken);
    }

    return response;
  }

  Future<void> logout() async {
    try {
      // Remove the registered push device token before clearing the session so
      // the device stops receiving notifications for the prior user.
      final prefs = await SharedPreferences.getInstance();
      final deviceTokenId = prefs.getString('device_token_id');
      if (deviceTokenId != null && deviceTokenId.isNotEmpty) {
        try {
          await delete(
            '${ApiConstants.notificationsDeviceTokens}/$deviceTokenId',
            requireAuth: true,
          );
        } catch (_) {
          // Continue with logout even if token removal fails.
        }
      }

      // Call backend logout endpoint
      await post('/auth/logout', requireAuth: true);
    } catch (e) {
      // Backend logout failed, but continue with local logout
      print('Backend logout failed (continuing with local logout)');
    } finally {
      // Always clear local token, role, device token, and password-change flag
      await _clearToken();
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('must_change_password');
      await prefs.remove('user_role');
      await prefs.remove('device_token_id');
      await prefs.remove('device_token');
    }
  }

  // ===========================
  // PATIENT OTP METHODS
  // ===========================

  Future<Map<String, dynamic>> sendPatientOtp({
    required String email,
    required String firstName,
    String? middleName,
    required String lastName,
    required String dateOfBirth,
    required String sex,
    required String phone,
    required String address,
    required String username,
    required String password,
    required String confirmPassword,
  }) async {
    final body = <String, dynamic>{
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'dateOfBirth': dateOfBirth,
      'sex': sex,
      'phone': phone,
      'address': address,
      'username': username,
      'password': password,
      'confirmPassword': confirmPassword,
    };

    // Middle name is optional - omit when empty so the backend stores NULL
    final trimmedMiddleName = middleName?.trim();
    if (trimmedMiddleName != null && trimmedMiddleName.isNotEmpty) {
      body['middleName'] = trimmedMiddleName;
    }

    return await post(
      ApiConstants.patientOtpSend,
      body: body,
      requireAuth: false,
    );
  }

  Future<Map<String, dynamic>> verifyPatientOtp({
    required String email,
    required String otp,
  }) async {
    return await post(
      ApiConstants.patientOtpVerify,
      body: {'email': email, 'otp': otp},
      requireAuth: false,
    );
  }

  Future<Map<String, dynamic>> resendPatientOtp({required String email}) async {
    return await post(
      ApiConstants.patientOtpResend,
      body: {'email': email},
      requireAuth: false,
    );
  }

  Future<Map<String, dynamic>> changePassword(
    String? currentPassword,
    String newPassword,
  ) async {
    final body = <String, dynamic>{'newPassword': newPassword};
    // Only include currentPassword if it's provided (not null)
    if (currentPassword != null) {
      body['currentPassword'] = currentPassword;
    }

    final response = await post(
      ApiConstants.changePassword,
      body: body,
      requireAuth: true,
    );

    // If password change was successful, save the new access token
    if (response['success'] == true && response['data'] != null) {
      final newAccessToken = response['data']['accessToken'];
      if (newAccessToken != null) {
        await _saveToken(newAccessToken);
      }
    }

    return response;
  }

  Future<Map<String, dynamic>> requestPasswordReset(String email) async {
    return await post(
      ApiConstants.passwordResetRequest,
      body: {'email': email},
      requireAuth: false,
    );
  }

  Future<Map<String, dynamic>> verifyPasswordResetOtp({
    required String email,
    required String otp,
  }) async {
    return await post(
      ApiConstants.passwordResetVerify,
      body: {'email': email, 'otp': otp},
      requireAuth: false,
    );
  }

  Future<Map<String, dynamic>> resetPassword({
    required String email,
    required String resetToken,
    required String newPassword,
  }) async {
    return await post(
      ApiConstants.passwordResetReset,
      body: {
        'email': email,
        'resetToken': resetToken,
        'newPassword': newPassword,
      },
      requireAuth: false,
    );
  }

  // ===========================
  // USER METHODS
  // ===========================

  Future<Map<String, dynamic>> getCurrentUser() async {
    return await get(ApiConstants.usersMe);
  }

  // ===========================
  // PATIENT METHODS
  // ===========================

  // Get current patient's own profile
  Future<Map<String, dynamic>> getCurrentPatient() async {
    return await get('/patients/me');
  }

  // Check if authenticated patient has an existing record with a specific doctor
  Future<Map<String, dynamic>> checkPatientRecord({
    required String doctorId,
  }) async {
    return await get(
      '/patients/check-record',
      queryParams: {'doctorId': doctorId},
    );
  }

  // Submit patient details for a specific doctor (before first booking)
  Future<Map<String, dynamic>> submitPatientDetails({
    required String doctorId,
    required String firstName,
    String? middleName,
    required String lastName,
    required String dateOfBirth,
    required String sex,
    required String phone,
    required String address,
    String? emergencyContactName,
    String? emergencyContactPhone,
    String? medicalHistory,
    String? allergies,
    String? currentMedications,
  }) async {
    return await post(
      '/patients/submit-details',
      requireAuth: true,
      body: {
        'doctorId': doctorId,
        'firstName': firstName,
        if (middleName != null) 'middleName': middleName,
        'lastName': lastName,
        'dateOfBirth': dateOfBirth,
        'sex': sex,
        'phone': phone,
        'address': address,
        if (emergencyContactName != null)
          'emergencyContactName': emergencyContactName,
        if (emergencyContactPhone != null)
          'emergencyContactPhone': emergencyContactPhone,
        if (medicalHistory != null) 'medicalHistory': medicalHistory,
        if (allergies != null) 'allergies': allergies,
        if (currentMedications != null)
          'currentMedications': currentMedications,
      },
    );
  }

  // Get authenticated patient's visits
  Future<Map<String, dynamic>> getMyVisits() async {
    return await get('/visits/me', requireAuth: true);
  }

  // Get authenticated patient's prescriptions
  Future<Map<String, dynamic>> getMyPrescriptions() async {
    return await get('/prescriptions/me', requireAuth: true);
  }

  // Get prescription by ID
  Future<Map<String, dynamic>> getPrescription(String id) async {
    return await get('/prescriptions/$id', requireAuth: true);
  }

  // Get prescription PDF URL
  Future<Map<String, dynamic>> getPrescriptionPdfUrl(String id) async {
    return await get('/prescriptions/$id/pdf-url', requireAuth: true);
  }

  /// The backend generates the filename and returns it in
  /// `Content-Disposition`. The app saves that exact name; it never builds a
  /// prescription filename of its own.
  Future<DownloadedPdf> downloadPrescriptionPdf(String id) async {
    final client = _httpClient ?? http.Client();
    final uri = Uri.parse('$baseUrl/prescriptions/$id/download');
    final response = await client.get(
      uri,
      headers: _getHeaders(requireAuth: true),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final disposition = response.headers['content-disposition'] ?? '';
      final fileName = RegExp(
        r'filename="?([^";]+)"?',
        caseSensitive: false,
      ).firstMatch(disposition)?.group(1);
      if (fileName == null || fileName.isEmpty) {
        throw FormatException(
          'The server did not provide a prescription PDF filename',
        );
      }
      if (!_prescriptionFileNamePattern.hasMatch(fileName)) {
        throw FormatException(
          'The server provided an invalid prescription PDF filename',
        );
      }
      return DownloadedPdf(bytes: response.bodyBytes, fileName: fileName);
    }

    try {
      final body = jsonDecode(response.body);
      throw ApiException(
        message:
            body['error']?['message'] ?? 'Failed to download prescription PDF',
        code: body['error']?['code'] ?? 'DOWNLOAD_ERROR',
        statusCode: response.statusCode,
      );
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(
        message: 'Failed to download prescription PDF',
        code: 'DOWNLOAD_ERROR',
        statusCode: response.statusCode,
      );
    }
  }

  // ===========================
  // DOCTORS METHODS
  // ===========================

  Future<Map<String, dynamic>> getDoctors({
    String? specialty,
    String? clinicId,
    String? search,
  }) async {
    return await get(
      ApiConstants.doctors,
      queryParams: {
        if (specialty != null) 'specialty': specialty,
        if (clinicId != null) 'clinicId': clinicId,
        if (search != null) 'search': search,
      },
      requireAuth: false,
    );
  }

  Future<Map<String, dynamic>> getDoctor(String id) async {
    return await get('${ApiConstants.doctorDetails}/$id', requireAuth: false);
  }

  Future<Map<String, dynamic>> getDoctorAvailability({
    required String doctorId,
    String? date,
    String? startDate,
    String? endDate,
  }) async {
    return await get(
      '${ApiConstants.doctorDetails}/$doctorId/availability',
      queryParams: {
        if (date != null) 'date': date,
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      },
      requireAuth: true,
    );
  }

  /// Patient-only doctor profile used by the mobile "View Profile" screen.
  Future<Map<String, dynamic>> getPatientDoctorProfile(String doctorId) async {
    return await get(
      '${ApiConstants.patientDoctors}/$doctorId${ApiConstants.doctorProfile}',
      requireAuth: true,
    );
  }

  // ===========================
  // APPOINTMENTS METHODS
  // ===========================

  Future<Map<String, dynamic>> getAppointments({
    String? status,
    String? startDate,
    String? endDate,
  }) async {
    return await get(
      ApiConstants.appointments,
      queryParams: {
        if (status != null) 'status': status,
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      },
    );
  }

  Future<Map<String, dynamic>> getAppointmentById(String id) async {
    return await get('${ApiConstants.appointments}/$id');
  }

  Future<Map<String, dynamic>> bookAppointment({
    required String doctorId,
    required String appointmentDate,
    String? reasonForVisit,
    String? paymentMethod,
  }) async {
    return await post(
      ApiConstants.appointments,
      body: {
        'doctorId': doctorId,
        'appointmentDate': appointmentDate,
        if (reasonForVisit != null) 'reasonForVisit': reasonForVisit,
        if (paymentMethod != null) 'paymentMethod': paymentMethod,
      },
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> cancelAppointment(String id) async {
    return await patch(
      '${ApiConstants.appointments}/$id${ApiConstants.appointmentCancel}',
    );
  }

  Future<Map<String, dynamic>> rescheduleAppointment({
    required String id,
    required String newAppointmentDate,
  }) async {
    return await patch(
      '${ApiConstants.appointments}/$id${ApiConstants.appointmentReschedule}',
      body: {'newAppointmentDate': newAppointmentDate},
      requireAuth: true,
    );
  }

  /// Live queue for the authenticated patient on the clinic's current date.
  /// The backend resolves the patient from the token.
  Future<Map<String, dynamic>> getMyQueueToday() async {
    return await get(ApiConstants.queueTodayMe, requireAuth: true);
  }

  // ===========================
  // CONVERSATIONS METHODS
  // ===========================

  Future<Map<String, dynamic>> getConversations() async {
    return await get(ApiConstants.conversations, requireAuth: true);
  }

  Future<Map<String, dynamic>> getMessages(String conversationId) async {
    return await get(
      '${ApiConstants.conversations}/$conversationId${ApiConstants.conversationMessages}',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> sendMessage(
    String conversationId,
    String message,
  ) async {
    return await post(
      '${ApiConstants.conversations}/$conversationId${ApiConstants.conversationMessages}',
      body: {'message': message},
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> markAsRead(String conversationId) async {
    return await patch(
      '${ApiConstants.conversations}/$conversationId${ApiConstants.conversationRead}',
      requireAuth: true,
    );
  }

  // Create or retrieve the patient's conversation for a doctor.
  // The backend reuses an existing conversation for patient+doctor when present,
  // otherwise creates a new one. Returns the conversation payload (data.id).
  Future<Map<String, dynamic>> createConversation({
    required String doctorId,
    String? secretaryId,
  }) async {
    return await post(
      ApiConstants.conversations,
      body: {
        'doctorId': doctorId,
        if (secretaryId != null) 'secretaryId': secretaryId,
      },
      requireAuth: true,
    );
  }

  // Read-only appointment summary for the secretary patient-info sheet
  Future<Map<String, dynamic>> getAppointmentSummary(
    String conversationId,
  ) async {
    return await get(
      '${ApiConstants.conversations}/$conversationId${ApiConstants.conversationAppointmentSummary}',
      requireAuth: true,
    );
  }

  // ===========================
  // AI CHAT METHODS
  // ===========================

  Future<Map<String, dynamic>> sendAiMessage(
    String message, {
    String? conversationId,
  }) async {
    return await post(
      ApiConstants.aiChat,
      body: {
        'message': message,
        if (conversationId != null) 'conversationId': conversationId,
      },
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> getAiConversations() async {
    return await get(ApiConstants.aiConversations);
  }

  Future<Map<String, dynamic>> getAiConversation(String id) async {
    return await get('${ApiConstants.aiConversations}/$id');
  }

  Future<Map<String, dynamic>> getAiConversationMessages(String id) async {
    return await get(
      '${ApiConstants.aiConversations}/$id${ApiConstants.aiMessages}',
    );
  }

  Future<Map<String, dynamic>> deleteAiConversation(String id) async {
    return await delete(
      '${ApiConstants.aiConversations}/$id',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> renameAiConversation(
    String id,
    String title,
  ) async {
    return await patch(
      '${ApiConstants.aiConversations}/$id',
      body: {'title': title},
      requireAuth: true,
    );
  }

  // ===========================
  // NOTIFICATIONS METHODS
  // ===========================

  Future<Map<String, dynamic>> getNotifications() async {
    return await get(ApiConstants.notifications, requireAuth: true);
  }

  Future<Map<String, dynamic>> markNotificationAsRead(String id) async {
    return await patch(
      '${ApiConstants.notifications}/$id${ApiConstants.notificationRead}',
      requireAuth: true,
    );
  }

  // ===========================
  // PUSH DEVICE TOKEN METHODS
  // ===========================

  Future<Map<String, dynamic>> registerDeviceToken({
    required String token,
    String provider = 'FCM',
    String platform = 'ANDROID',
    String? deviceInfo,
  }) async {
    return await post(
      ApiConstants.notificationsDeviceTokens,
      body: {
        'token': token,
        'provider': provider,
        'platform': platform,
        if (deviceInfo != null) 'deviceInfo': deviceInfo,
      },
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> removeDeviceToken(String id) async {
    return await delete(
      '${ApiConstants.notificationsDeviceTokens}/$id',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> getUnreadNotificationCount() async {
    return await get(
      '${ApiConstants.notifications}/unread-count',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> markNotificationRead(
    String notificationId,
  ) async {
    return await patch(
      '${ApiConstants.notifications}/$notificationId${ApiConstants.notificationRead}',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> markAllNotificationsRead() async {
    return await patch(
      '${ApiConstants.notifications}/read-all',
      requireAuth: true,
    );
  }

  // ===========================
  // PAYMENTS METHODS
  // ===========================

  Future<Map<String, dynamic>> getPayment(String appointmentId) async {
    return await get(
      '${ApiConstants.payments}/$appointmentId',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> getPaymentById(String paymentId) async {
    return await get(
      '${ApiConstants.paymentsById}/$paymentId',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> uploadPaymentReceipt({
    required String appointmentId,
    required File receiptFile,
    double? patientDeclaredAmount,
  }) async {
    Map<String, String>? fields;
    if (patientDeclaredAmount != null) {
      fields = {'patient_declared_amount': patientDeclaredAmount.toString()};
    }
    return await postMultipart(
      '${ApiConstants.payments}/$appointmentId${ApiConstants.paymentReceipt}',
      file: receiptFile,
      fileField: 'receipt',
      fields: fields,
      requireAuth: true,
    );
  }

  /// Get a signed URL to view the patient's uploaded payment receipt.
  Future<Map<String, dynamic>> getMyReceiptUrl(String appointmentId) async {
    return await get(
      '${ApiConstants.payments}/my-receipt/$appointmentId',
      requireAuth: true,
    );
  }

  /// List the authenticated patient's own payment records (newest first).
  Future<Map<String, dynamic>> getMyPayments() async {
    return await get('${ApiConstants.payments}/me', requireAuth: true);
  }

  Future<Map<String, dynamic>> getGcashQr({required String doctorId}) async {
    return await get(
      '${ApiConstants.payments}/gcash-qr',
      queryParams: {'doctorId': doctorId},
      requireAuth: false,
    );
  }

  // ===========================
  // INVOICES METHODS
  // ===========================

  /// List the authenticated patient's own invoices (newest first).
  Future<Map<String, dynamic>> getMyInvoices() async {
    return await get('${ApiConstants.invoices}/me', requireAuth: true);
  }

  /// Get a short-lived signed download URL for an invoice.
  Future<Map<String, dynamic>> getInvoiceDownloadUrl(String invoiceId) async {
    return await get(
      '${ApiConstants.invoices}/$invoiceId/download-url',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> getInvoiceByPayment(String paymentId) async {
    return await get(
      '${ApiConstants.invoiceByPayment}/$paymentId',
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> getInvoiceById(String invoiceId) async {
    return await get('${ApiConstants.invoices}/$invoiceId', requireAuth: true);
  }

  Future<List<int>> downloadInvoicePdf(String invoiceId) async {
    final client = _httpClient ?? http.Client();
    final response = await client.get(
      Uri.parse(
        '$baseUrl${ApiConstants.invoices}/$invoiceId${ApiConstants.invoicePdf}',
      ),
      headers: _getHeaders(requireAuth: true),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    } else {
      try {
        final body = jsonDecode(response.body);
        throw ApiException(
          message: body['error']?['message'] ?? 'Failed to download invoice',
          code: body['error']?['code'] ?? 'DOWNLOAD_ERROR',
          statusCode: response.statusCode,
        );
      } catch (e) {
        if (e is ApiException) {
          rethrow;
        }
        throw ApiException(
          message: 'Failed to download invoice',
          code: 'DOWNLOAD_ERROR',
          statusCode: response.statusCode,
        );
      }
    }
  }

  /// Download PDF from a signed URL (used for invoice downloads with short-lived tokens)
  Future<List<int>> downloadPdfFromUrl(String signedUrl) async {
    final client = _httpClient ?? http.Client();
    final response = await client.get(Uri.parse(signedUrl));

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return response.bodyBytes;
    } else {
      try {
        final body = jsonDecode(response.body);
        throw ApiException(
          message: body['error']?['message'] ?? 'Failed to download PDF',
          code: body['error']?['code'] ?? 'DOWNLOAD_ERROR',
          statusCode: response.statusCode,
        );
      } catch (e) {
        if (e is ApiException) {
          rethrow;
        }
        throw ApiException(
          message: 'Failed to download PDF',
          code: 'DOWNLOAD_ERROR',
          statusCode: response.statusCode,
        );
      }
    }
  }

  // ===========================
  // WAITLIST METHODS
  // ===========================

  // Join a waitlist
  Future<Map<String, dynamic>> joinWaitlist({
    required String doctorId,
    required String waitlistDate,
  }) async {
    return await post(
      '/waitlists',
      body: {'doctorId': doctorId, 'waitlistDate': waitlistDate},
      requireAuth: true,
    );
  }

  // Get patient's waitlist entries
  Future<Map<String, dynamic>> getMyWaitlists() async {
    return await get('/waitlists/me', requireAuth: true);
  }

  // Get single waitlist entry
  Future<Map<String, dynamic>> getWaitlistEntry(String id) async {
    return await get('/waitlists/$id', requireAuth: true);
  }

  // Leave a waitlist
  Future<Map<String, dynamic>> leaveWaitlist(String id) async {
    return await delete('/waitlists/$id', requireAuth: true);
  }

  // Check waitlist status for specific doctor and date
  Future<Map<String, dynamic>> checkWaitlistStatus({
    required String doctorId,
    required String waitlistDate,
  }) async {
    return await get(
      '/waitlists/check?doctorId=$doctorId&waitlistDate=$waitlistDate',
      requireAuth: true,
    );
  }

  // Get waitlist count for authenticated patient
  Future<Map<String, dynamic>> getWaitlistCount() async {
    return await get('/waitlists/count', requireAuth: true);
  }
}

// Custom exception for API errors
class ApiException implements Exception {
  final String message;
  final String code;
  final int statusCode;

  ApiException({
    required this.message,
    required this.code,
    required this.statusCode,
  });

  @override
  String toString() =>
      'ApiException: $message (Code: $code, Status: $statusCode)';
}
