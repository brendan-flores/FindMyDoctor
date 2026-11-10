import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/services/doctor_service.dart';
import 'package:mobile/features/doctors/presentation/doctor_schedule_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

DateTime startOfWeek(DateTime date) =>
    date.subtract(Duration(days: date.weekday % 7));

void main() {
  group('DoctorSchedulePage', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpPage(
      WidgetTester tester, {
      required ApiService apiService,
      required String defaultDate,
      bool includeGcash = false,
    }) async {
      await apiService.init();
      final doctorService = DoctorService(apiService: apiService);
      await tester.pumpWidget(
        MaterialApp(
          home: DoctorSchedulePage(
            doctorId: 'doctor-1',
            doctorName: 'Maria Santos',
            specialty: 'General Medicine',
            clinic: 'Santos Clinic',
            consultationFee: '500',
            defaultDate: defaultDate,
            doctorService: doctorService,
            apiService: apiService,
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
    }

    MockClient buildClient({
      required String status,
      bool withGcashQr = false,
      bool joinWaitlist = false,
      void Function(String date)? onWaitlistJoin,
    }) {
      return MockClient((request) async {
        final path = request.url.path;
        if (request.method == 'GET' &&
            path.endsWith('/doctors/doctor-1/availability')) {
          final start =
              DateTime.parse(request.url.queryParameters['startDate']!);
          final end = DateTime.parse(request.url.queryParameters['endDate']!);
          final dates = <Map<String, dynamic>>[];
          for (var d = start; !d.isAfter(end); d = d.add(const Duration(days: 1))) {
            final key = DateFormat('yyyy-MM-dd').format(d);
            dates.add({
              'date': key,
              'status': status,
              'capacity': {
                'configured': 10,
                'booked': status == 'FULL' ? 10 : 2,
                'remaining': status == 'FULL' ? 0 : 8,
              },
            });
          }
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'dates': dates},
            }),
            200,
          );
        }
        if (request.method == 'GET' && path.endsWith('/payments/gcash-qr')) {
          if (withGcashQr) {
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
          return http.Response(
            jsonEncode({'success': true, 'data': null}),
            200,
          );
        }
        if (request.method == 'GET' && path.endsWith('/waitlists/check')) {
          return http.Response(
            jsonEncode({'success': true, 'data': null}),
            200,
          );
        }
        if (joinWaitlist &&
            request.method == 'POST' &&
            path.endsWith('/waitlists')) {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          onWaitlistJoin?.call(body['waitlistDate'] as String);
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'waitlistId': 'waitlist-1', 'position': 3},
            }),
            201,
          );
        }
        return http.Response('Not found', 404);
      });
    }

    testWidgets('FULL date shows waitlist flow and joins on confirmation', (
      tester,
    ) async {
      final today = DateTime.now();
      final weekStart = startOfWeek(today);
      final target = weekStart.add(const Duration(days: 2));
      final targetKey = DateFormat('yyyy-MM-dd').format(target);
      String? joinedDate;

      final client = buildClient(
        status: 'FULL',
        joinWaitlist: true,
        onWaitlistJoin: (date) => joinedDate = date,
      );

      await pumpPage(
        tester,
        apiService: ApiService.createWithClient(client),
        defaultDate: targetKey,
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Fully Booked'), findsWidgets);
      expect(
        find.text(
          'All slots are fully booked. Join the waitlist to be notified when a slot becomes available.',
        ),
        findsOneWidget,
      );
      expect(find.text('Join Waitlist'), findsOneWidget);

      await tester.tap(find.text('Join Waitlist'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.text('Join Waitlist'), findsWidgets);
      expect(find.textContaining('Join waitlist for'), findsOneWidget);

      await tester.tap(find.text('Join'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      expect(joinedDate, targetKey);
      expect(find.textContaining("You've joined the waitlist"), findsOneWidget);
    });

    testWidgets(
      'AVAILABLE date with GCash QR shows account details after selecting GCash',
      (tester) async {
        final originalOnError = FlutterError.onError;
        FlutterError.onError = (details) {
          final exception = details.exception;
          final isOverflow = exception is FlutterError &&
              exception.toString().contains('overflowed');
          if (!isOverflow) {
            originalOnError?.call(details);
          }
        };
        addTearDown(() => FlutterError.onError = originalOnError);

        tester.view.physicalSize = const Size(800, 1400);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
        });

        final today = DateTime.now();
        final weekStart = startOfWeek(today);
        final target = weekStart.add(const Duration(days: 2));
        final targetKey = DateFormat('yyyy-MM-dd').format(target);

        final client = buildClient(status: 'AVAILABLE', withGcashQr: true);

        await pumpPage(
          tester,
          apiService: ApiService.createWithClient(client),
          defaultDate: targetKey,
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Payment Method'), findsOneWidget);
        expect(find.text('GCash'), findsOneWidget);
        expect(find.text('Cash at Clinic'), findsOneWidget);

        await tester.ensureVisible(find.text('GCash'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('GCash'), warnIfMissed: false);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 200));

        await tester.ensureVisible(find.text('Maria Santos Clinic'));
        expect(find.text('Maria Santos Clinic'), findsOneWidget);
        expect(find.text('09171234567'), findsOneWidget);
        expect(find.text('Scan the QR code with GCash to pay'), findsOneWidget);
        expect(find.text('Continue Booking'), findsOneWidget);
      },
    );
  });
}
