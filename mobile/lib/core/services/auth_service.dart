import 'api_service.dart';
import '../models/user.dart';

class AuthService {
  final ApiService apiService = ApiService();
  
  String get baseUrl => apiService.baseUrl;

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await apiService.login(email, password);
      return response;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String role,
    String? firstName,
    String? lastName,
  }) async {
    try {
      print('🔵 AuthService.register called');
      final response = await apiService.register(
        email: email,
        password: password,
        role: role,
        firstName: firstName,
        lastName: lastName,
      );
      print('🟢 AuthService.register response: $response');
      return response;
    } catch (e) {
      print('🔴 AuthService.register error: $e');
      rethrow;
    }
  }

  Future<void> logout() async {
    await apiService.logout();
  }

  Future<User?> getCurrentUser() async {
    try {
      final response = await apiService.getCurrentUser();
      if (response['success'] == true) {
        return User.fromJson(response['data']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> isAuthenticated() async {
    await apiService.init();
    final user = await getCurrentUser();
    return user != null;
  }
}