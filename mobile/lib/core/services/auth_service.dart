import 'api_service.dart';
import '../models/user.dart';

class AuthService {
  final ApiService _apiService = ApiService();

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _apiService.login(email, password);
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
      final response = await _apiService.register(
        email: email,
        password: password,
        role: role,
        firstName: firstName,
        lastName: lastName,
      );
      return response;
    } catch (e) {
      rethrow;
    }
  }

  Future<void> logout() async {
    await _apiService.logout();
  }

  Future<User?> getCurrentUser() async {
    try {
      final response = await _apiService.getCurrentUser();
      if (response['success'] == true) {
        return User.fromJson(response['data']);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> isAuthenticated() async {
    await _apiService.init();
    final user = await getCurrentUser();
    return user != null;
  }
}