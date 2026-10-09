import 'api_service.dart';
import '../models/doctor.dart';

class DoctorService {
  final ApiService _apiService = ApiService();

  Future<List<Doctor>> getDoctors({
    String? specialty,
    String? clinicId,
    String? search,
  }) async {
    try {
      final response = await _apiService.getDoctors(
        specialty: specialty,
        clinicId: clinicId,
        search: search,
      );
      
      if (response['success'] == true) {
        final List<dynamic> data = response['data'];
        return data.map((json) => Doctor.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      rethrow;
    }
  }

  Future<Doctor?> getDoctor(String id) async {
    try {
      final response = await _apiService.getDoctor(id);
      
      if (response['success'] == true) {
        return Doctor.fromJson(response['data']);
      }
      return null;
    } catch (e) {
      rethrow;
    }
  }

  Future<Map<String, dynamic>?> getDoctorAvailability({
    required String doctorId,
    String? date,
    String? startDate,
    String? endDate,
  }) async {
    try {
      final response = await _apiService.getDoctorAvailability(
        doctorId: doctorId,
        date: date,
        startDate: startDate,
        endDate: endDate,
      );
      
      if (response['success'] == true) {
        return response['data'];
      }
      return null;
    } catch (e) {
      rethrow;
    }
  }
}