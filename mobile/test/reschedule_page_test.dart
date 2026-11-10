import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/appointments/presentation/reschedule_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

String dateKey(DateTime date) => DateFormat('yyyy-MM-dd').format(date);

DateTime startOfWeek(DateTime date) =>
    date.subtract(Duration(days: date.weekday % 7));

/// Converts a local calendar day into an ISO instant that round-trips back to
/// the same local day in any timezone.
String localDateToIso(DateTime date) {
  return DateTime(date.year, date.month, date.day, 12).toUtc().toIso8601String();
}

Map<String, dynamic> availabilityEntry(
  DateTime date, {
  String status = 'AVAILABLE',
  int remaining = 3,
}) {
  return {
    'date': dateKey(date),
    'status': status,
    'capacity': {'remaining': remaining, 'configured': 10},
  };
}

void main() {
  group('ReschedulePage', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpPage(
      WidgetTester tester, {
      required ApiService apiService,
      required String appointmentId,
    }) async {
      await apiService.init();

      final navigatorKey = GlobalKey<NavigatorState>();
      await tester.pumpWidget(
        MaterialApp(
          navigatorKey: navigatorKey,
          home: const Scaffold(body: Center(child: Text('Dummy Home'))),
        ),
      );
      navigatorKey.currentState!.push(
        MaterialPageRoute(
          builder: (_) => ReschedulePage(
            appointmentId: appointmentId,
            apiService: apiService,
          ),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets(
      'shows the current appointment and reschedules to an available date',
      (tester) async {
        final now = DateTime.now();
        final today = DateTime(now.year, now.month, now.day);
        final weekStart = startOfWeek(today);

        final availabilityDates = <Map<String, dynamic>>[
          for (var i = 0; i < 14; i++)
            availabilityEntry(
              weekStart.add(Duration(days: i)),
              status: i == 0 ? 'ALREADY_BOOKED' : 'AVAILABLE',
            ),
        ];

        String? postedDate;
        final mockClient = MockClient((request) async {
          if (request.method == 'GET' &&
              request.url.path.endsWith('/appointments/appointment-1')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'id': 'appointment-1',
                  'patient_id': 'patient-1',
                  'doctor_id': 'doctor-1',
                  'appointment_date': localDateToIso(weekStart.add(const Duration(days: 1))),
                  'status': 'SCHEDULED',
                  'queue_number': 4,
                  'doctor_first_name': 'Maria',
                  'doctor_last_name': 'Santos',
                },
              }),
              200,
            );
          }
          if (request.method == 'GET' &&
              request.url.path.endsWith('/doctors/doctor-1/availability')) {
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {'dates': availabilityDates},
              }),
              200,
            );
          }
          if (request.method == 'PATCH' &&
              request.url.path.endsWith('/appointments/appointment-1/reschedule')) {
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            postedDate = body['newAppointmentDate'] as String?;
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {'queueNumber': 7},
              }),
              200,
            );
          }
          return http.Response('Not found', 404);
        });

        await pumpPage(
          tester,
          apiService: ApiService.createWithClient(mockClient),
          appointmentId: 'appointment-1',
        );

        expect(tester.takeException(), isNull);
        expect(find.text('Reschedule Appointment'), findsOneWidget);
        expect(find.text('Dr. Maria Santos'), findsOneWidget);
        expect(find.text('#4'), findsOneWidget);

        // The newest date in the current week that is still in the future.
        var target = today.add(const Duration(days: 1));
        if (target.isAfter(weekStart.add(const Duration(days: 6)))) {
          // Today is the last displayed day: move to the next week.
          await tester.tap(find.byIcon(Icons.chevron_right));
          await tester.pumpAndSettle(const Duration(seconds: 2));
        }

        final targetLabel = DateFormat('d').format(target);
        await tester.tap(find.text(targetLabel));
        await tester.pumpAndSettle();

        expect(find.text('Slots available (3 slots left)'), findsOneWidget);

        await tester.tap(find.text('Confirm Reschedule'));
        await tester.pumpAndSettle();

        expect(find.text('Reschedule appointment?'), findsOneWidget);
        expect(
          find.textContaining('new one will be assigned for the new date'),
          findsOneWidget,
        );

        await tester.tap(find.text('Confirm'));
        await tester.pumpAndSettle(const Duration(seconds: 2));

        expect(postedDate, dateKey(target));
        expect(
          find.text('Appointment rescheduled. New queue number: #7'),
          findsOneWidget,
        );
        expect(find.text('Dummy Home'), findsOneWidget);
      },
    );

    testWidgets('fully booked dates offer joining the waitlist instead', (
      tester,
    ) async {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final weekStart = startOfWeek(today);
      final target = today.add(const Duration(days: 1));

      final availabilityDates = <Map<String, dynamic>>[
        for (var i = 0; i < 14; i++)
          availabilityEntry(
            weekStart.add(Duration(days: i)),
            status: dateKey(weekStart.add(Duration(days: i))) == dateKey(target)
                ? 'FULL'
                : 'UNAVAILABLE',
            remaining: 0,
          ),
      ];

      var joined = false;
      final mockClient = MockClient((request) async {
        if (request.method == 'GET' &&
            request.url.path.endsWith('/appointments/appointment-1')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'id': 'appointment-1',
                'doctor_id': 'doctor-1',
                'appointment_date': localDateToIso(today),
                'status': 'SCHEDULED',
                'doctor_first_name': 'Maria',
                'doctor_last_name': 'Santos',
              },
            }),
            200,
          );
        }
        if (request.method == 'GET' &&
            request.url.path.endsWith('/doctors/doctor-1/availability')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'dates': availabilityDates},
            }),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path.endsWith('/waitlists')) {
          joined = true;
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

      await pumpPage(
        tester,
        apiService: ApiService.createWithClient(mockClient),
        appointmentId: 'appointment-1',
      );

      if (target.isAfter(weekStart.add(const Duration(days: 6)))) {
        await tester.tap(find.byIcon(Icons.chevron_right));
        await tester.pumpAndSettle(const Duration(seconds: 2));
      }

      await tester.tap(find.text(DateFormat('d').format(target)));
      await tester.pumpAndSettle();

      expect(find.text('Fully booked'), findsOneWidget);
      expect(find.text('Confirm Reschedule'), findsNothing);
      expect(find.text('Join Waitlist'), findsOneWidget);

      await tester.tap(find.text('Join Waitlist'));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      expect(joined, isTrue);
      expect(
        find.text('Added to the waitlist. We will notify you if a slot opens up.'),
        findsOneWidget,
      );
    });

    testWidgets('shows a retryable error when the appointment cannot load', (
      tester,
    ) async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'code': 'NOT_FOUND', 'message': 'Appointment not found'},
          }),
          404,
        );
      });

      await pumpPage(
        tester,
        apiService: ApiService.createWithClient(mockClient),
        appointmentId: 'missing-appointment',
      );

      expect(find.text('Failed to load appointment'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });
  });
}
