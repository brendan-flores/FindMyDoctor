import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/appointments/presentation/appointments_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('AppointmentsPage Walk-in Appointment Visibility', () {
    late ApiService apiService;
    late SharedPreferences prefs;

    setUp(() async {
      // Initialize mock SharedPreferences
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
      prefs = await SharedPreferences.getInstance();
      
      // Create ApiService instance
      apiService = ApiService();
      await apiService.init();
    });

    tearDown(() async {
      // Clear SharedPreferences after each test
      await prefs.clear();
    });

    testWidgets(
      'AppointmentsPage displays walk-in appointment with correct details',
      (WidgetTester tester) async {
        // Arrange - Mock HTTP client to return a walk-in appointment
        // The backend returns this structure for patient appointments:
        // a.*, d.first_name as doctor_first_name, d.last_name as doctor_last_name,
        // d.specialty, d.practice_name, q.queue_number, q.status as queue_status
        final mockClient = MockClient((request) async {
          if (request.url.path.contains('/appointments')) {
            // Return a single appointment that could represent a walk-in
            // Note: The patient API doesn't expose registration_source, so from
            // the patient's perspective, a walk-in appointment looks like any other
            return http.Response(
              jsonEncode({
                'success': true,
                'data': [
                  {
                    'id': 'appointment-123',
                    'patient_id': 'patient-123',
                    'doctor_id': 'doctor-123',
                    'appointment_date': '2026-10-20T00:00:00.000Z',
                    'reason_for_visit': 'Walk-in consultation',
                    'status': 'SCHEDULED',
                    'created_at': '2026-10-17T10:00:00.000Z',
                    'updated_at': '2026-10-17T10:00:00.000Z',
                    'doctor_first_name': 'Juan',
                    'doctor_last_name': 'Dela Cruz',
                    'specialty': 'General Practitioner',
                    'practice_name': 'City Medical Clinic',
                    'practice_address': '123 Main St, Manila',
                    'queue_number': 5,
                    'queue_status': 'WAITING',
                  }
                ]
              }),
              200,
            );
          }
          return http.Response('Not found', 404);
        });

        // Act - Create ApiService with injected mock client
        final testApiService = ApiService.createWithClient(mockClient);
        await testApiService.init();

        // Pump the AppointmentsPage with the mocked API injected
        await tester.pumpWidget(
          MaterialApp(
            home: AppointmentsPage(apiService: testApiService),
          ),
        );

        // Wait for the async fetch to complete
        await tester.pumpAndSettle(const Duration(seconds: 2));

        // Assert - Verify the appointment is displayed with correct details
        // Doctor name
        expect(find.text('Dr. Juan Dela Cruz'), findsOneWidget);
        
        // Specialty
        expect(find.text('General Practitioner'), findsOneWidget);
        
        // Practice name
        expect(find.text('City Medical Clinic'), findsOneWidget);
        
        // Status badge with queue number
        expect(find.text('Confirmed • Queue #5'), findsOneWidget);
        
        // Verify it's in the "Upcoming" filter (SCHEDULED status)
        expect(find.text('Upcoming'), findsOneWidget);
        
        // Verify no error message
        expect(find.text('Failed to load appointments'), findsNothing);
        expect(find.text('No appointments yet'), findsNothing);
      },
    );

    testWidgets(
      'Loading and displaying appointment does not create another appointment',
      (WidgetTester tester) async {
        // Arrange - Track API calls
        int getAppointmentsCallCount = 0;
        
        final mockClient = MockClient((request) async {
          if (request.url.path.contains('/appointments') && request.method == 'GET') {
            getAppointmentsCallCount++;
            // Return a single appointment
            return http.Response(
              jsonEncode({
                'success': true,
                'data': [
                  {
                    'id': 'appointment-123',
                    'patient_id': 'patient-123',
                    'doctor_id': 'doctor-123',
                    'appointment_date': '2026-10-20T00:00:00.000Z',
                    'reason_for_visit': 'Walk-in consultation',
                    'status': 'SCHEDULED',
                    'created_at': '2026-10-17T10:00:00.000Z',
                    'updated_at': '2026-10-17T10:00:00.000Z',
                    'doctor_first_name': 'Juan',
                    'doctor_last_name': 'Dela Cruz',
                    'specialty': 'General Practitioner',
                    'practice_name': 'City Medical Clinic',
                    'practice_address': '123 Main St, Manila',
                    'queue_number': 5,
                    'queue_status': 'WAITING',
                  }
                ]
              }),
              200,
            );
          }
          // Any POST request would indicate appointment creation
          if (request.method == 'POST' && request.url.path.contains('/appointments')) {
            // This should never happen during page load
            return http.Response(
              jsonEncode({'success': false, 'error': {'message': 'Unexpected POST'}}),
              400,
            );
          }
          return http.Response('Not found', 404);
        });

        // Act - Create ApiService with injected mock client
        final testApiService = ApiService.createWithClient(mockClient);
        await testApiService.init();

        // Pump the AppointmentsPage with the mocked API injected
        await tester.pumpWidget(
          MaterialApp(
            home: AppointmentsPage(apiService: testApiService),
          ),
        );

        // Wait for the async fetch to complete
        await tester.pumpAndSettle(const Duration(seconds: 2));

        // Assert - Verify only GET appointments was called (no POST for creation)
        expect(getAppointmentsCallCount, equals(1));
        
        // Verify the appointment is displayed (not recreated)
        expect(find.text('Dr. Juan Dela Cruz'), findsOneWidget);
      },
    );

    testWidgets(
      'AppointmentsPage displays appointment date correctly',
      (WidgetTester tester) async {
        // Arrange - Mock HTTP client
        final mockClient = MockClient((request) async {
          if (request.url.path.contains('/appointments')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': [
                  {
                    'id': 'appointment-123',
                    'patient_id': 'patient-123',
                    'doctor_id': 'doctor-123',
                    'appointment_date': '2026-10-20T00:00:00.000Z',
                    'reason_for_visit': 'Regular checkup',
                    'status': 'SCHEDULED',
                    'created_at': '2026-10-17T10:00:00.000Z',
                    'updated_at': '2026-10-17T10:00:00.000Z',
                    'doctor_first_name': 'Maria',
                    'doctor_last_name': 'Santos',
                    'specialty': 'Cardiologist',
                    'practice_name': 'Heart Care Center',
                    'practice_address': '456 Health Ave, Quezon City',
                    'queue_number': 3,
                    'queue_status': 'WAITING',
                  }
                ]
              }),
              200,
            );
          }
          return http.Response('Not found', 404);
        });

        // Act
        final testApiService = ApiService.createWithClient(mockClient);
        await testApiService.init();

        await tester.pumpWidget(
          MaterialApp(
            home: AppointmentsPage(apiService: testApiService),
          ),
        );

        await tester.pumpAndSettle(const Duration(seconds: 2));

        // Assert - Verify doctor and practice details are displayed
        expect(find.text('Dr. Maria Santos'), findsOneWidget);
        expect(find.text('Cardiologist'), findsOneWidget);
        expect(find.text('Heart Care Center'), findsOneWidget);
        expect(find.text('Confirmed • Queue #3'), findsOneWidget);
      },
    );
  });
}
