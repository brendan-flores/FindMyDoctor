import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/payments/presentation/payments_hub_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

Map<String, dynamic> buildPayment(Map<String, dynamic> extra) {
  return {
    'id': 'payment-1',
    'appointment_id': 'appointment-1',
    'doctor_id': 'doctor-1',
    'patient_id': 'patient-1',
    'doctor_first_name': 'Maria',
    'doctor_last_name': 'Santos',
    'appointment_date': '2026-11-20T00:00:00.000Z',
    'consultation_amount': '500.00',
    'total_additional_charges': '75.00',
    'total_amount': '575.00',
    'amount_paid': '0.00',
    'balance': '575.00',
    'payment_method': 'GCASH',
    'status': 'UNPAID',
    'has_receipt': false,
    ...extra,
  };
}

void main() {
  group('PaymentsHubPage', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpPage(WidgetTester tester, ApiService apiService) async {
      await apiService.init();
      await tester.pumpWidget(
        MaterialApp(home: PaymentsHubPage(apiService: apiService)),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets('lists payments, statuses, and invoice actions', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/payments/me')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                buildPayment({}),
                buildPayment({
                  'id': 'payment-2',
                  'appointment_id': 'appointment-2',
                  'status': 'PAID',
                  'amount_paid': '575.00',
                  'balance': '0.00',
                  'invoice_id': 'invoice-1',
                  'invoice_number': 'INV-0001',
                }),
              ],
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpPage(tester, ApiService.createWithClient(mockClient));

      expect(tester.takeException(), isNull);
      expect(find.text('Payments'), findsOneWidget);
      expect(find.text('Dr. Maria Santos'), findsNWidgets(2));
      expect(find.text('Unpaid'), findsWidgets);
      expect(find.text('Paid'), findsWidgets);
      expect(find.text('₱575.00'), findsWidgets);
      expect(find.text('View Invoice (INV-0001)'), findsOneWidget);
      expect(find.text('Pay with GCash'), findsOneWidget);
    });

    testWidgets(
      'filter chips narrow the list to matching statuses',
      (tester) async {
        final mockClient = MockClient((request) async {
          if (request.url.path.endsWith('/payments/me')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': [
                  buildPayment({}),
                  buildPayment({
                    'id': 'payment-2',
                    'status': 'PAID',
                    'amount_paid': '575.00',
                    'balance': '0.00',
                    'invoice_id': 'invoice-1',
                    'invoice_number': 'INV-0001',
                  }),
                ],
              }),
              200,
            );
          }
          return http.Response('Not found', 404);
        });

        await pumpPage(tester, ApiService.createWithClient(mockClient));

        // Status chip + filter chip both read "Paid".
        expect(find.text('Paid'), findsNWidgets(2));

        // Tap the filter chip (first occurrence, in the filter bar).
        await tester.tap(find.text('Unpaid').first);
        await tester.pumpAndSettle();

        expect(find.text('View Invoice (INV-0001)'), findsNothing);
        expect(find.text('Pay with GCash'), findsOneWidget);
      },
    );

    testWidgets(
      'shows the GCash account details configured in secretary settings',
      (tester) async {
        final mockClient = MockClient((request) async {
          if (request.url.path.endsWith('/payments/gcash-qr')) {
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
          if (request.url.path.endsWith('/payments/me')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': [buildPayment({})],
              }),
              200,
            );
          }
          return http.Response('Not found', 404);
        });

        await pumpPage(tester, ApiService.createWithClient(mockClient));

        expect(find.text('GCash QR & account details'), findsOneWidget);

        await tester.ensureVisible(find.text('GCash QR & account details'));
        await tester.tap(find.text('GCash QR & account details'));
        await tester.pumpAndSettle(const Duration(seconds: 2));

        expect(find.text('Maria Santos Clinic'), findsOneWidget);
        expect(find.text('09171234567'), findsOneWidget);
      },
    );

    testWidgets('shows a retryable error state', (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'code': 'SERVER_ERROR', 'message': 'Failed to load payments'},
          }),
          500,
        );
      });

      await pumpPage(tester, ApiService.createWithClient(mockClient));

      expect(find.text('Retry'), findsOneWidget);
      expect(find.textContaining('Failed to load payments'), findsOneWidget);
    });
  });
}
