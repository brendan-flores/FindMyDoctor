import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/appointments/presentation/appointments_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('AppointmentsPage status filter mapping', () {
    testWidgets('Upcoming includes SCHEDULED, CONFIRMED, IN_PROGRESS', (tester) async {
      SharedPreferences.setMockInitialValues({'access_token': 'test-token'});
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);
      final mockClient = MockClient((request) async {
        if (request.url.path.contains('/appointments')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                _apt('s1', 'SCHEDULED', 'StatusSched'),
                _apt('c1', 'CONFIRMED', 'StatusConf'),
                _apt('i1', 'IN_PROGRESS', 'StatusProg'),
                _apt('done', 'COMPLETED', 'StatusDone'),
                _apt('can', 'CANCELLED', 'StatusCanc'),
                _apt('ns', 'NO_SHOW', 'StatusNoShow'),
              ],
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      final testApi = ApiService.createWithClient(mockClient);
      await testApi.init();

      await tester.pumpWidget(MaterialApp(home: AppointmentsPage(apiService: testApi)));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Upcoming displayed appointments
      expect(find.textContaining('StatusSched'), findsOneWidget);
      expect(find.textContaining('StatusConf'), findsOneWidget);
      expect(find.textContaining('StatusProg'), findsOneWidget);
      expect(find.textContaining('StatusDone'), findsNothing);
      expect(find.textContaining('StatusCanc'), findsNothing);
      expect(find.textContaining('StatusNoShow'), findsNothing);
      expect(find.text('3'), findsOneWidget);

      // Completed tab
      await tester.tap(find.text('Completed'));
      await tester.pumpAndSettle();
      expect(find.textContaining('StatusDone'), findsOneWidget);
      expect(find.textContaining('StatusSched'), findsNothing);
      expect(find.textContaining('StatusConf'), findsNothing);
      expect(find.textContaining('StatusProg'), findsNothing);
      expect(find.textContaining('StatusCanc'), findsNothing);
      expect(find.textContaining('StatusNoShow'), findsNothing);
      expect(find.text('1'), findsOneWidget);

      // Cancelled tab
      await tester.tap(find.text('Cancelled'));
      await tester.pumpAndSettle();
      expect(find.textContaining('StatusCanc'), findsOneWidget);
      expect(find.textContaining('StatusNoShow'), findsOneWidget);
      expect(find.textContaining('StatusSched'), findsNothing);
      expect(find.textContaining('StatusConf'), findsNothing);
      expect(find.textContaining('StatusProg'), findsNothing);
      expect(find.textContaining('StatusDone'), findsNothing);
      expect(find.text('2'), findsOneWidget);
    });
  });
}

Map<String, dynamic> _apt(String id, String status, String doctorLast) {
  return {
    'id': id,
    'patient_id': 'p1',
    'doctor_id': 'd1',
    'appointment_date': '2026-10-20T00:00:00.000Z',
    'status': status,
    'doctor_first_name': 'Dr',
    'doctor_last_name': doctorLast,
    'specialty': 'General',
    'practice_name': 'Clinic',
    'consultation_fee': '500',
  };
}