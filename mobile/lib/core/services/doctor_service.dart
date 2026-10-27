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
      print('🔍 DoctorService: Fetching doctors with params: specialty=$specialty, clinicId=$clinicId, search=$search');
      final response = await _apiService.getDoctors(
        specialty: specialty,
        clinicId: clinicId,
        search: search,
      );

      print('🔍 DoctorService: API response success=${response['success']}');

      if (response['success'] == true) {
        final List<dynamic> data = response['data'];
        print('🔍 DoctorService: Parsed ${data.length} doctors from response');
        return data.map((json) => Doctor.fromJson(json)).toList();
      } else {
        print('🔴 DoctorService: API returned success=false. Error: ${response['error']}');
        return [];
      }
    } catch (e) {
      print('🔴 DoctorService: Exception thrown: $e');
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