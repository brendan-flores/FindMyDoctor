import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/payments/presentation/payment_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('PaymentScreen', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpPage(
      WidgetTester tester, {
      required ApiService apiService,
      String? doctorId = 'doctor-1',
    }) async {
      await apiService.init();
      await tester.pumpWidget(
        MaterialApp(
          home: PaymentScreen(
            appointmentId: 'appointment-1',
            doctorName: 'Dr. Maria Santos',
            consultationFee: '500.00',
            doctorId: doctorId,
            apiService: apiService,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets('shows UNPAID status with upload section and GCash details', (
      tester,
    ) async {
      final mockClient = MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path.endsWith('/payments/gcash-qr')) {
          expect(request.url.queryParameters['doctorId'], 'doctor-1');
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'qrUrl': 'https://example.com/qr.png',
                'accountName': 'Maria Santos Clinic',
                'accountNumber': '09171234567',
              },
            }),
            200,
          );
        }
        if (request.method == 'GET' &&
            request.url.path.endsWith('/payments/appointment-1')) {
          return http.Response(
            jsonEncode({
              'success': false,
              'error': {'code': 'NOT_FOUND', 'message': 'Payment not found'},
            }),
            404,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpPage(tester, apiService: ApiService.createWithClient(mockClient));

      expect(tester.takeException(), isNull);
      expect(find.text('Upload Receipt'), findsOneWidget);
      expect(find.text('Unpaid'), findsOneWidget);
      expect(find.text('Upload GCash Receipt'), findsOneWidget);
      expect(find.text('GCash Account Details'), findsOneWidget);
      expect(find.text('Maria Santos Clinic'), findsOneWidget);
      expect(find.text('09171234567'), findsOneWidget);
      expect(find.text('Select Receipt Image'), findsOneWidget);
    });

    testWidgets('shows PAID status without upload controls', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path.endsWith('/payments/gcash-qr')) {
          return http.Response(
            jsonEncode({'success': true, 'data': null}),
            200,
          );
        }
        if (request.method == 'GET' &&
            request.url.path.endsWith('/payments/appointment-1')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 'payment-1',
                'status': 'PAID',
                'payment_method': 'GCASH',
                'receipt_url': null,
              },
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpPage(tester, apiService: ApiService.createWithClient(mockClient));

      expect(find.text('Paid'), findsOneWidget);
      expect(find.text('Upload GCash Receipt'), findsNothing);
      expect(find.text('Select Receipt Image'), findsNothing);
    });

    testWidgets('shows a retryable error state and recovers on retry', (
      tester,
    ) async {
      var fail = true;
      final mockClient = MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path.endsWith('/payments/gcash-qr')) {
          return http.Response(
            jsonEncode({'success': true, 'data': null}),
            200,
          );
        }
        if (request.method == 'GET' &&
            request.url.path.endsWith('/payments/appointment-1')) {
          if (fail) {
            return http.Response(
              jsonEncode({
                'success': false,
                'error': {
                  'code': 'SERVER_ERROR',
                  'message': 'Failed to load payment details',
                },
              }),
              500,
            );
          }
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'id': 'payment-1', 'status': 'UNPAID'},
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpPage(tester, apiService: ApiService.createWithClient(mockClient));

      expect(find.text('Retry'), findsOneWidget);
      expect(find.textContaining('Failed to load payment details'), findsOneWidget);

      fail = false;
      await tester.tap(find.text('Retry'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.textContaining('Failed to load payment details'), findsNothing);
      expect(find.text('Unpaid'), findsOneWidget);
    });
  });
}
