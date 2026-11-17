import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('submitPatientDetails authentication', () {
    test('sends Authorization header after loading token from storage', () async {
      SharedPreferences.setMockInitialValues({'access_token': 'stored-test-token'});

      late http.Request capturedRequest;
      final client = MockClient((request) async {
        capturedRequest = request;
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {'patientId': 'test-patient'},
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final apiService = ApiService.createWithClient(client);
      await apiService.init();

      final response = await apiService.submitPatientDetails(
        doctorId: 'test-doctor-id',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        sex: 'FEMALE',
        phone: '09170000000',
        address: '123 Test Street',
      );

      expect(response['success'], true);
      expect(capturedRequest.method, 'POST');
      expect(
        capturedRequest.url.path,
        endsWith('/patients/submit-details'),
      );
      expect(
        capturedRequest.headers['Authorization'],
        'Bearer stored-test-token',
      );
    });
  });
}
