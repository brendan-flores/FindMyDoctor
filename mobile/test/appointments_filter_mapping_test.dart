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

  group('AppointmentsPage date filtering', () {
  setUp(() {
    SharedPreferences.setMockInitialValues({'access_token': 'test-token'});
  });

  Future<void> pumpPage(WidgetTester tester, ApiService apiService) async {
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);
    await apiService.init();
    await tester.pumpWidget(MaterialApp(home: AppointmentsPage(apiService: apiService)));
    await tester.pumpAndSettle(const Duration(seconds: 2));
  }

  Future<void> selectDate(WidgetTester tester, int day) async {
    await tester.tap(find.text('Select date'));
    await tester.pumpAndSettle();

    const monthNames = <String, int>{
      'January': 1,
      'February': 2,
      'March': 3,
      'April': 4,
      'May': 5,
      'June': 6,
      'July': 7,
      'August': 8,
      'September': 9,
      'October': 10,
      'November': 11,
      'December': 12,
    };

    var reachedOctober2026 = false;
    for (var i = 0; i < 24; i++) {
      if (find.text('October 2026').evaluate().isNotEmpty) {
        reachedOctober2026 = true;
        break;
      }

      String? displayedMonth;
      for (final widget in tester.widgetList<Text>(find.byType(Text))) {
        final data = widget.data;
        if (data != null &&
            RegExp(r'^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$')
                .hasMatch(data)) {
          displayedMonth = data;
          break;
        }
      }

      if (displayedMonth == null) {
        throw TestFailure('Date picker month header was not found.');
      }

      final parts = displayedMonth.split(' ');
      final currentMonth = monthNames[parts[0]]!;
      final currentYear = int.parse(parts[1]);
      final shouldGoBackward = currentYear > 2026 || (currentYear == 2026 && currentMonth > 10);

      await tester.tap(
        find.byIcon(shouldGoBackward ? Icons.chevron_left : Icons.chevron_right),
      );
      await tester.pumpAndSettle();
    }

    if (!reachedOctober2026 || find.text('October 2026').evaluate().isEmpty) {
      throw TestFailure('Could not reach October 2026 in the date picker.');
    }

    await tester.tap(find.text('$day').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
  }

  testWidgets('date-only filtering excludes other dates', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'SCHEDULED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
              _apt('a2', 'COMPLETED', 'DoctorTwo', date: '2026-10-21T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();
    await selectDate(tester, 20);

    expect(find.textContaining('DoctorOne'), findsOneWidget);
    expect(find.textContaining('DoctorTwo'), findsNothing);
  });

  testWidgets('Upcoming and date combine', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'SCHEDULED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
              _apt('a2', 'SCHEDULED', 'DoctorTwo', date: '2026-10-21T00:00:00.000Z'),
              _apt('a3', 'COMPLETED', 'DoctorThree', date: '2026-10-20T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await selectDate(tester, 20);

    expect(find.textContaining('DoctorOne'), findsOneWidget);
    expect(find.textContaining('DoctorTwo'), findsNothing);
    expect(find.textContaining('DoctorThree'), findsNothing);
  });

  testWidgets('Completed and Cancelled combine with date', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'COMPLETED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
              _apt('a2', 'CANCELLED', 'DoctorTwo', date: '2026-10-20T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await tester.tap(find.text('Completed'));
    await tester.pumpAndSettle();
    await selectDate(tester, 20);
    expect(find.textContaining('DoctorOne'), findsOneWidget);
    expect(find.textContaining('DoctorTwo'), findsNothing);

    await tester.tap(find.text('Cancelled'));
    await tester.pumpAndSettle();
    expect(find.textContaining('DoctorTwo'), findsOneWidget);
    expect(find.textContaining('DoctorOne'), findsNothing);
  });

  testWidgets('clearing date preserves status', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'COMPLETED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
              _apt('a2', 'COMPLETED', 'DoctorTwo', date: '2026-10-21T00:00:00.000Z'),
              _apt('a3', 'SCHEDULED', 'DoctorThree', date: '2026-10-20T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await tester.tap(find.text('Completed'));
    await tester.pumpAndSettle();
    await selectDate(tester, 20);
    expect(find.textContaining('DoctorOne'), findsOneWidget);
    expect(find.textContaining('DoctorTwo'), findsNothing);
    expect(find.textContaining('DoctorThree'), findsNothing);

    await tester.tap(find.text('Clear date'));
    await tester.pumpAndSettle();

    expect(find.textContaining('DoctorOne'), findsOneWidget);
    expect(find.textContaining('DoctorTwo'), findsOneWidget);
    expect(find.textContaining('DoctorThree'), findsNothing);
  });

  testWidgets('All preserves selected date', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'SCHEDULED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
              _apt('a2', 'COMPLETED', 'DoctorTwo', date: '2026-10-20T00:00:00.000Z'),
              _apt('a3', 'SCHEDULED', 'DoctorThree', date: '2026-10-21T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await selectDate(tester, 20);
    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();

    expect(find.textContaining('DoctorOne'), findsOneWidget);
    expect(find.textContaining('DoctorTwo'), findsOneWidget);
    expect(find.textContaining('DoctorThree'), findsNothing);
  });

  testWidgets('Clear All resets both filters', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'COMPLETED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
              _apt('a2', 'SCHEDULED', 'DoctorTwo', date: '2026-10-20T00:00:00.000Z'),
              _apt('a3', 'SCHEDULED', 'DoctorThree', date: '2026-10-21T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await tester.tap(find.text('Completed'));
    await tester.pumpAndSettle();
    await selectDate(tester, 20);
    await tester.tap(find.text('Clear All'));
    await tester.pumpAndSettle();

    expect(find.textContaining('DoctorTwo'), findsOneWidget);
    expect(find.textContaining('DoctorThree'), findsOneWidget);
    expect(find.textContaining('DoctorOne'), findsNothing);
  });

  testWidgets('tab counts respect the selected date', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'SCHEDULED', 'CountSchedOne', date: '2026-10-20T00:00:00.000Z'),
              _apt('a2', 'SCHEDULED', 'CountSchedTwo', date: '2026-10-21T00:00:00.000Z'),
              _apt('a3', 'COMPLETED', 'CountDone', date: '2026-10-20T00:00:00.000Z'),
              _apt('a4', 'CANCELLED', 'CountCancelled', date: '2026-10-21T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));

    // Counts without a date: All 4, Upcoming 2, Completed 1, Cancelled 1.
    expect(find.text('4'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('1'), findsNWidgets(2));

    await selectDate(tester, 20);

    // Counts for 2026-10-20: All 2, Upcoming 1, Completed 1, Cancelled 0.
    expect(find.text('4'), findsNothing);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('1'), findsNWidgets(2));
    expect(find.text('0'), findsOneWidget);

    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();
    expect(find.textContaining('CountSchedOne'), findsOneWidget);
    expect(find.textContaining('CountDone'), findsOneWidget);
    expect(find.textContaining('CountSchedTwo'), findsNothing);
    expect(find.textContaining('CountCancelled'), findsNothing);
  });

  testWidgets('truly empty dataset shows the true-empty message', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({'success': true, 'data': <Map<String, dynamic>>[]}),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));

    expect(find.text('No appointments yet'), findsOneWidget);
    expect(find.text('No appointments match your filters.'), findsNothing);
  });

  testWidgets('nonempty dataset with no matching filters shows filtered-empty message', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'COMPLETED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await selectDate(tester, 21);

    expect(find.text('No appointments match your filters.'), findsOneWidget);
    expect(find.text('No appointments yet'), findsNothing);

    await tester.tap(find.text('All'));
    await tester.pumpAndSettle();

    expect(find.text('No appointments match your filters.'), findsOneWidget);
    expect(find.text('No appointments yet'), findsNothing);
    expect(find.text('No all appointments'), findsNothing);
  });

  testWidgets('empty date and status combination shows filtered-empty message', (tester) async {
    final mockClient = MockClient((request) async {
      if (request.url.path.contains('/appointments')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              _apt('a1', 'COMPLETED', 'DoctorOne', date: '2026-10-20T00:00:00.000Z'),
            ],
          }),
          200,
        );
      }
      return http.Response('Not found', 404);
    });

    await pumpPage(tester, ApiService.createWithClient(mockClient));
    await selectDate(tester, 21);

    expect(find.text('No appointments match your filters.'), findsOneWidget);
    expect(find.text('No appointments yet'), findsNothing);
  });
  });
}

Map<String, dynamic> _apt(String id, String status, String doctorLast, {String? date}) {
  return {
    'id': id,
    'patient_id': 'p1',
    'doctor_id': 'd1',
    'appointment_date': date ?? '2026-10-20T00:00:00.000Z',
    'status': status,
    'doctor_first_name': 'Dr',
    'doctor_last_name': doctorLast,
    'specialty': 'General',
    'practice_name': 'Clinic',
    'consultation_fee': '500',
  };
}