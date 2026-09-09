import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';

class ApiService {
  final String baseUrl = ApiConstants.baseUrl;
  String? _accessToken;

  // Singleton pattern
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

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
      print('🟢 Token saved successfully');
    } catch (e) {
      print('🔴 Error saving token: $e');
      rethrow;
    }
  }

  // Clear token from storage
  Future<void> _clearToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    _accessToken = null;
  }

  // Get headers with authorization
  Map<String, String> _getHeaders({bool requireAuth = true}) {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

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

    final response = await http.get(
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
    print('🟡 POST Request to: $url');
    print('🟡 Request body: ${body != null ? jsonEncode(body) : "null"}');
    
    final response = await http.post(
      Uri.parse(url),
      headers: _getHeaders(requireAuth: requireAuth),
      body: body != null ? jsonEncode(body) : null,
    );

    print('🟡 Response status: ${response.statusCode}');
    print('🟡 Response body: ${response.body}');
    
    return _handleResponse(response);
  }

  // Generic PUT request
  Future<Map<String, dynamic>> put(
    String endpoint, {
    Map<String, dynamic>? body,
    bool requireAuth = true,
  }) async {
    final response = await http.put(
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
    final response = await http.patch(
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
    final response = await http.delete(
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
    final response = await post(
      ApiConstants.login,
      body: {
        'email': email,
        'password': password,
      },
      requireAuth: false,
    );

    if (response['success'] == true) {
      final accessToken = response['data']['accessToken'];
      await _saveToken(accessToken);
    }

    return response;
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
    await _clearToken();
  }

  Future<Map<String, dynamic>> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    return await post(
      ApiConstants.changePassword,
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
      requireAuth: true,
    );
  }

  // ===========================
  // USER METHODS
  // ===========================

  Future<Map<String, dynamic>> getCurrentUser() async {
    return await get(ApiConstants.usersMe);
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
    );
  }

  Future<Map<String, dynamic>> cancelAppointment(String id) async {
    return await patch('${ApiConstants.appointments}/$id${ApiConstants.appointmentCancel}');
  }

  // ===========================
  // CONVERSATIONS METHODS
  // ===========================

  Future<Map<String, dynamic>> getConversations() async {
    return await get(ApiConstants.conversations);
  }

  Future<Map<String, dynamic>> getMessages(String conversationId) async {
    return await get('${ApiConstants.conversations}/$conversationId${ApiConstants.conversationMessages}');
  }

  Future<Map<String, dynamic>> sendMessage(String conversationId, String message) async {
    return await post('${ApiConstants.conversations}/$conversationId${ApiConstants.conversationMessages}', body: {
      'message': message,
    });
  }

  // ===========================
  // AI CHAT METHODS
  // ===========================

  Future<Map<String, dynamic>> sendAiMessage(String message, {String? conversationId}) async {
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
    return await patch('${ApiConstants.notifications}/$id${ApiConstants.notificationRead}');
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
  String toString() => 'ApiException: $message (Code: $code, Status: $statusCode)';
}