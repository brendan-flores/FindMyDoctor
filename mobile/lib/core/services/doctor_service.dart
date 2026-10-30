import 'api_service.dart';
import '../models/doctor.dart';
import '../models/doctor_profile.dart';

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

  /// Load the patient-only public doctor profile. Returns null only when the
  /// backend reports that no active, approved doctor matches the id. Network,
  /// authentication, and server failures are rethrown so the screen can show a
  /// retryable error instead of a false "not found".
  Future<DoctorProfile?> getPatientDoctorProfile(String doctorId) async {
    try {
      final response = await _apiService.getPatientDoctorProfile(doctorId);

      if (response['success'] == true && response['data'] is Map) {
        return DoctorProfile.fromJson(
          Map<String, dynamic>.from(response['data'] as Map),
        );
      }
      return null;
    } on ApiException catch (e) {
      if (e.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }
}