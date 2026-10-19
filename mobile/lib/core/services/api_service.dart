import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../constants/api_constants.dart';

class ApiService {
  final String baseUrl = ApiConstants.baseUrl;
  String? _accessToken;
  http.Client? _httpClient;

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

  // Initialize and load token from storage
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('access_token');
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

  // Public method to save token (for use after OTP verification)
  Future<void> saveToken(String token) async {
    await _saveToken(token);
  }

  // Clear token from storage
  Future<void> _clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    _accessToken = null;
  }

  // Get headers with authorization
  Map<String, String> _getHeaders({bool requireAuth = true}) {
    final headers = <String, String>{'Content-Type': 'application/json'};

    if (requireAuth && _accessToken != null) {
      headers['Authorization'] = 'Bearer $_accessToken';
    }

    return headers;
  }

  // Generic GET request
  Future<Map<String, dynamic>> get(
    String endpoint, {
    bool requireAuth = true,
    Map<String, String>? queryParams,
  }) async {
    Uri uri = Uri.parse('$baseUrl$endpoint');
    if (queryParams != null) {
      uri = uri.replace(queryParameters: queryParams);
    }

    final client = _httpClient ?? http.Client();
    final response = await client.get(
      uri,
      headers: _getHeaders(requireAuth: requireAuth),
    );

    return _handleResponse(response);
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

    return _handleResponse(response);
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

    return _handleResponse(response);
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

    return _handleResponse(response);
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

    return _handleResponse(response);
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
    // no role selector, so the backend is asked to verify the account as a
    // patient first and then as a secretary. The User record's role field
    // remains the single source of truth; the backend still rejects any
    // account that does not match the attempted role.
    Map<String, dynamic>? lastFailure;

    for (final expectedRole in const ['PATIENT', 'SECRETARY']) {
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
      requireAuth: true,
    );
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
  }) async {
    return await post(
      ApiConstants.appointments,
      body: {
        'doctorId': doctorId,
        'appointmentDate': appointmentDate,
        if (reasonForVisit != null) 'reasonForVisit': reasonForVisit,
      },
      requireAuth: true,
    );
  }

  Future<Map<String, dynamic>> cancelAppointment(String id) async {
    return await patch(
      '${ApiConstants.appointments}/$id${ApiConstants.appointmentCancel}',
    );
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
    );
  }

  // ===========================
  // NOTIFICATIONS METHODS
  // ===========================

  Future<Map<String, dynamic>> getNotifications() async {
    return await get(ApiConstants.notifications);
  }

  Future<Map<String, dynamic>> markNotificationRead(String id) async {
    return await patch(
      '${ApiConstants.notifications}/$id${ApiConstants.notificationRead}',
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
