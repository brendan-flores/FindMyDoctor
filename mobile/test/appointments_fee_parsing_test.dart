import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/utils/json_parsers.dart';
import 'package:mobile/features/appointments/presentation/appointment_detail_page.dart';
import 'package:mobile/features/appointments/presentation/appointments_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Builds a patient appointment payload shaped like `GET /api/v1/appointments`.
///
/// [extra] is merged over the defaults so tests can vary individual fields
/// (including omitting them entirely).
Map<String, dynamic> buildAppointment(Map<String, dynamic> extra) {
  return {
    'id': 'appointment-123',
    'patient_id': 'patient-123',
    'doctor_id': 'doctor-123',
    'appointment_date': '2026-10-20T00:00:00.000Z',
    'reason_for_visit': 'Regular consultation',
    'status': 'SCHEDULED',
    'doctor_first_name': 'Juan',
    'doctor_last_name': 'Dela Cruz',
    'specialty': 'General Practitioner',
    'practice_name': 'City Medical Clinic',
    'practice_address': '123 Main St, Manila',
    'queue_number': 5,
    'queue_status': 'WAITING',
    ...extra,
  };
}

ApiService buildMockApiService(dynamic payload) {
  final mockClient = MockClient((request) async {
    if (request.url.path.contains('/appointments')) {
      return http.Response(
        jsonEncode({'success': true, 'data': payload}),
        200,
      );
    }
    return http.Response('Not found', 404);
  });
  return ApiService.createWithClient(mockClient);
}

void main() {
  group('JSON numeric parsing helpers', () {
    test('parseNum accepts numbers and numeric strings', () {
      expect(parseNum(500), 500);
      expect(parseNum(500.25), 500.25);
      expect(parseNum('500.00'), 500.0);
      expect(parseNum(' 750 '), 750);
    });

    test('parseNum returns null for null, empty and invalid values', () {
      expect(parseNum(null), isNull);
      expect(parseNum(''), isNull);
      expect(parseNum('   '), isNull);
      expect(parseNum('not-a-number'), isNull);
      expect(parseNum(true), isNull);
    });

    test('parseInt accepts numbers and numeric strings safely', () {
      expect(parseInt(5), 5);
      expect(parseInt('5'), 5);
      expect(parseInt(5.9), 5);
      expect(parseInt(null), isNull);
      expect(parseInt(''), isNull);
      expect(parseInt('abc'), isNull);
    });

    test('parseString accepts strings and returns null for empty values', () {
      expect(parseString('GCASH'), 'GCASH');
      expect(parseString('  GCASH  '), 'GCASH');
      expect(parseString(null), isNull);
      expect(parseString(''), isNull);
      expect(parseString('   '), isNull);
    });
  });

  group('AppointmentsPage consultation fee parsing', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpAppointmentsPage(
      WidgetTester tester,
      Map<String, dynamic> appointment,
    ) async {
      final apiService = buildMockApiService([appointment]);
      await apiService.init();

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentsPage(apiService: apiService),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'renders a string-formatted consultation fee (DECIMAL returned as JSON string)',
      (WidgetTester tester) async {
        await pumpAppointmentsPage(
          tester,
          buildAppointment({'consultation_fee': '500.00'}),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Dr. Juan Dela Cruz'), findsOneWidget);
        expect(find.text('₱500'), findsOneWidget);
      },
    );

    testWidgets(
      'renders a numeric consultation fee (backward compatible)',
      (WidgetTester tester) async {
        await pumpAppointmentsPage(
          tester,
          buildAppointment({'consultation_fee': 750}),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('₱750'), findsOneWidget);
      },
    );

    testWidgets(
      'renders a placeholder when the consultation fee is missing',
      (WidgetTester tester) async {
        await pumpAppointmentsPage(tester, buildAppointment({}));

        expect(tester.takeException(), isNull);
        expect(find.text('Dr. Juan Dela Cruz'), findsOneWidget);
        expect(find.text('₱---'), findsOneWidget);
      },
    );

    testWidgets(
      'renders a placeholder when the consultation fee is null',
      (WidgetTester tester) async {
        await pumpAppointmentsPage(
          tester,
          buildAppointment({'consultation_fee': null}),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('₱---'), findsOneWidget);
      },
    );

    testWidgets(
      'renders a placeholder when the consultation fee is an empty string',
      (WidgetTester tester) async {
        await pumpAppointmentsPage(
          tester,
          buildAppointment({'consultation_fee': ''}),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('₱---'), findsOneWidget);
      },
    );

    testWidgets(
      'renders a placeholder when the consultation fee is not a valid number',
      (WidgetTester tester) async {
        await pumpAppointmentsPage(
          tester,
          buildAppointment({'consultation_fee': 'not-a-number'}),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('₱---'), findsOneWidget);
      },
    );

    testWidgets(
      'still renders payment status and payment method',
      (WidgetTester tester) async {
        await pumpAppointmentsPage(
          tester,
          buildAppointment({
            'consultation_fee': '1000.00',
            'payment_status': 'PENDING_VERIFICATION',
            'payment_method': 'GCASH',
          }),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Pending'), findsOneWidget);
        expect(find.text('GCASH'), findsOneWidget);
        expect(find.text('₱1000'), findsOneWidget);
      },
    );
  });

  group('AppointmentDetailPage consultation fee parsing', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpDetailPage(
      WidgetTester tester,
      Map<String, dynamic> appointment,
    ) async {
      final apiService = buildMockApiService(appointment);
      await apiService.init();

      await tester.pumpWidget(
        MaterialApp(
          home: AppointmentDetailPage(
            appointmentId: 'appointment-123',
            apiService: apiService,
          ),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'renders a string-formatted consultation fee',
      (WidgetTester tester) async {
        await pumpDetailPage(
          tester,
          buildAppointment({
            'consultation_fee': '500.00',
            'payment_status': 'PAID',
            'payment_method': 'GCASH',
          }),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Payment Information'), findsOneWidget);
        expect(find.text('₱500.00'), findsOneWidget);
      },
    );

    testWidgets(
      'renders N/A when the consultation fee is missing',
      (WidgetTester tester) async {
        await pumpDetailPage(
          tester,
          buildAppointment({
            'payment_status': 'PAID',
            'payment_method': 'CASH',
          }),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Payment Information'), findsOneWidget);
        expect(find.text('N/A'), findsOneWidget);
      },
    );

    testWidgets(
      'keeps the GCash receipt upload flow available when payment is pending',
      (WidgetTester tester) async {
        await pumpDetailPage(
          tester,
          buildAppointment({
            'consultation_fee': '500.00',
            'payment_status': 'PENDING_VERIFICATION',
            'payment_method': 'GCASH',
          }),
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Pending Verification'), findsOneWidget);
        expect(find.text('Upload Receipt'), findsOneWidget);
        expect(find.text('Cancel Appointment'), findsOneWidget);
      },
    );
  });
}
