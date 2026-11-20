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

    testWidgets('lists payments, statuses, and invoice actions', (
      tester,
    ) async {
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

    testWidgets('filter chips narrow the list to matching statuses', (
      tester,
    ) async {
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
    });

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

    testWidgets('maps PARTIAL to Unpaid and OVERPAID to Paid', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/payments/me')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                buildPayment({'id': 'p1', 'status': 'PARTIAL'}),
                buildPayment({
                  'id': 'p2',
                  'status': 'OVERPAID',
                  'amount_paid': '600.00',
                  'balance': '0.00',
                }),
              ],
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpPage(tester, ApiService.createWithClient(mockClient));

      // Unpaid filter shows PARTIAL
      await tester.tap(find.text('Unpaid').first);
      await tester.pumpAndSettle();
      expect(find.text('Partially Paid'), findsOneWidget);
      expect(find.text('Overpaid'), findsNothing);

      // Paid filter shows OVERPAID
      await tester.tap(find.text('Paid').first);
      await tester.pumpAndSettle();
      expect(find.text('Overpaid'), findsOneWidget);
      expect(find.text('Partially Paid'), findsNothing);
    });

    testWidgets(
      'maps FOR_REVIEW to Pending, CANCELLED and unknown to All only',
      (tester) async {
        final mockClient = MockClient((request) async {
          if (request.url.path.endsWith('/payments/me')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': [
                  buildPayment({'id': 'p1', 'status': 'FOR_REVIEW'}),
                  buildPayment({'id': 'p2', 'status': 'CANCELLED'}),
                  buildPayment({'id': 'p3', 'status': 'MYSTERY_STATUS'}),
                ],
              }),
              200,
            );
          }
          return http.Response('Not found', 404);
        });

        await pumpPage(tester, ApiService.createWithClient(mockClient));

        // Default All shows all payments, including Pending and Cancelled.
        expect(find.text('Dr. Maria Santos'), findsWidgets);
        expect(find.text('Pending Verification'), findsOneWidget);
        expect(find.text('Cancelled'), findsOneWidget);

        // Pending filter shows FOR_REVIEW
        await tester.tap(find.text('Pending').first);
        await tester.pumpAndSettle();
        expect(find.text('Pending Verification'), findsOneWidget);
        expect(find.text('Cancelled'), findsNothing);

        // Rejected filter shows none of these
        await tester.tap(find.text('Rejected').first);
        await tester.pumpAndSettle();
        expect(find.text('Pending Verification'), findsNothing);
        expect(find.text('Cancelled'), findsNothing);

        // All restores all three
        await tester.tap(find.text('All').first);
        await tester.pumpAndSettle();
        expect(find.text('Dr. Maria Santos'), findsWidgets);
        expect(find.text('Pending Verification'), findsOneWidget);
        expect(find.text('Cancelled'), findsOneWidget);
      },
    );

    testWidgets('filter chip counts and status categories', (tester) async {
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/payments/me')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                buildPayment({'id': 'p-unpaid', 'status': 'UNPAID', 'doctor_last_name': 'UnpaidOne'}),
                buildPayment({'id': 'p-partial', 'status': 'PARTIAL', 'doctor_last_name': 'PartialOne'}),
                buildPayment({'id': 'p-pending', 'status': 'PENDING_VERIFICATION', 'doctor_last_name': 'PendingOne'}),
                buildPayment({'id': 'p-for-review', 'status': 'FOR_REVIEW', 'doctor_last_name': 'ForReviewOne'}),
                buildPayment({'id': 'p-paid', 'status': 'PAID', 'doctor_last_name': 'PaidOne', 'amount_paid': '575.00', 'balance': '0.00'}),
                buildPayment({'id': 'p-overpaid', 'status': 'OVERPAID', 'doctor_last_name': 'OverpaidOne', 'amount_paid': '600.00', 'balance': '0.00'}),
                buildPayment({'id': 'p-rejected', 'status': 'REJECTED', 'doctor_last_name': 'RejectedOne'}),
                buildPayment({'id': 'p-cancelled', 'status': 'CANCELLED', 'doctor_last_name': 'CancelledOne'}),
                buildPayment({'id': 'p-unknown', 'status': 'MYSTERY_STATUS', 'doctor_last_name': 'UnknownOne'}),
              ],
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      tester.view.physicalSize = const Size(800, 4000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await pumpPage(tester, ApiService.createWithClient(mockClient));

      expect(find.text('9'), findsOneWidget);
      expect(find.text('Dr. Maria UnpaidOne'), findsOneWidget);
      expect(find.text('Dr. Maria CancelledOne'), findsOneWidget);
      expect(find.text('Dr. Maria UnknownOne'), findsOneWidget);

      await tester.tap(find.text('Unpaid').first);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.widgetWithText(InkWell, 'Unpaid'),
          matching: find.text('2'),
        ),
        findsOneWidget,
      );
      expect(find.text('Dr. Maria UnpaidOne'), findsOneWidget);
      expect(find.text('Dr. Maria PartialOne'), findsOneWidget);
      expect(find.text('Dr. Maria PendingOne'), findsNothing);
      expect(find.text('Dr. Maria CancelledOne'), findsNothing);
      expect(find.text('Dr. Maria UnknownOne'), findsNothing);

      await tester.tap(find.text('Pending').first);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.widgetWithText(InkWell, 'Pending'),
          matching: find.text('2'),
        ),
        findsOneWidget,
      );
      expect(find.text('Dr. Maria PendingOne'), findsOneWidget);
      expect(find.text('Dr. Maria ForReviewOne'), findsOneWidget);
      expect(find.text('Dr. Maria UnpaidOne'), findsNothing);
      expect(find.text('Dr. Maria CancelledOne'), findsNothing);

      await tester.tap(find.text('Paid').first);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.widgetWithText(InkWell, 'Paid'),
          matching: find.text('2'),
        ),
        findsOneWidget,
      );
      expect(find.text('Dr. Maria PaidOne'), findsOneWidget);
      expect(find.text('Dr. Maria OverpaidOne'), findsOneWidget);
      expect(find.text('Dr. Maria RejectedOne'), findsNothing);
      expect(find.text('Dr. Maria CancelledOne'), findsNothing);

      await tester.tap(find.text('Rejected').first);
      await tester.pumpAndSettle();
      expect(find.text('1'), findsOneWidget);
      expect(find.text('Dr. Maria RejectedOne'), findsOneWidget);
      expect(find.text('Dr. Maria CancelledOne'), findsNothing);
      expect(find.text('Dr. Maria UnknownOne'), findsNothing);

      await tester.tap(find.text('All').first);
      await tester.pumpAndSettle();
      expect(find.text('9'), findsOneWidget);
      expect(find.text('Dr. Maria CancelledOne'), findsOneWidget);
      expect(find.text('Dr. Maria UnknownOne'), findsOneWidget);
    });

    testWidgets('shows a retryable error state', (tester) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {
              'code': 'SERVER_ERROR',
              'message': 'Failed to load payments',
            },
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
