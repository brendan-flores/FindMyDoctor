import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/waitlist/presentation/waitlist_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Builds a waitlist payload shaped like `GET /api/v1/waitlists/me`.
Map<String, dynamic> buildWaitlist(Map<String, dynamic> extra) {
  return {
    'id': 'waitlist-1',
    'doctor_id': 'doctor-1',
    'doctor_first_name': 'Maria',
    'doctor_last_name': 'Santos',
    'specialty': 'General Medicine',
    'practice_name': 'Santos Clinic',
    'waitlist_date': '2026-11-20',
    'status': 'WAITING',
    'position': 2,
    'offered_at': null,
    'expires_at': null,
    'created_at':
        DateTime.now().subtract(const Duration(hours: 3)).toIso8601String(),
    'updated_at':
        DateTime.now().subtract(const Duration(hours: 3)).toIso8601String(),
    ...extra,
  };
}

void main() {
  group('WaitlistPage', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpPage(WidgetTester tester, ApiService apiService) async {
      await apiService.init();
      await tester.pumpWidget(
        MaterialApp(home: WaitlistPage(apiService: apiService)),
      );
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }

    testWidgets('shows WAITING and OFFERED entries with their actions', (
      tester,
    ) async {
      final expiresAt = DateTime.now()
          .add(const Duration(hours: 20))
          .toIso8601String();
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/waitlists/me')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                buildWaitlist({'id': 'waitlist-waiting', 'status': 'WAITING'}),
                buildWaitlist({
                  'id': 'waitlist-offered',
                  'status': 'OFFERED',
                  'position': 1,
                  'offered_at': DateTime.now().toIso8601String(),
                  'expires_at': expiresAt,
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
      expect(find.text('My Waitlists'), findsOneWidget);
      expect(find.text('Waiting'), findsOneWidget);
      expect(find.text("You're Position #1!"), findsOneWidget);
      expect(find.text('Position #2'), findsOneWidget);
      expect(find.text('A slot is now available! Book within 24 hours to secure it.'),
          findsOneWidget);
      expect(find.text('Leave Waitlist'), findsOneWidget);
      expect(find.text('Book Now'), findsOneWidget);
    });

    testWidgets('leaving a waitlist confirms, calls the API, and refreshes', (
      tester,
    ) async {
      var left = false;
      final mockClient = MockClient((request) async {
        if (request.method == 'DELETE' &&
            request.url.path.endsWith('/waitlists/waitlist-1')) {
          left = true;
          return http.Response(
            jsonEncode({'success': true, 'data': null}),
            200,
          );
        }
        if (request.url.path.endsWith('/waitlists/me')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': left ? [] : [buildWaitlist({})],
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpPage(tester, ApiService.createWithClient(mockClient));

      await tester.tap(find.text('Leave Waitlist'));
      await tester.pumpAndSettle();

      expect(find.text('Leave Waitlist'), findsWidgets);
      expect(find.textContaining('Are you sure you want to leave'), findsOneWidget);

      await tester.tap(find.text('Leave'));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      expect(left, isTrue);
      expect(find.text('Successfully left waitlist'), findsOneWidget);
      expect(find.text('No waitlist entries'), findsOneWidget);
    });

    testWidgets('shows a retryable error state and recovers on retry', (
      tester,
    ) async {
      var fail = true;
      final mockClient = MockClient((request) async {
        if (request.url.path.endsWith('/waitlists/me')) {
          if (fail) {
            return http.Response(
              jsonEncode({
                'success': false,
                'error': {
                  'code': 'SERVER_ERROR',
                  'message': 'Failed to load waitlists',
                },
              }),
              500,
            );
          }
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [buildWaitlist({})],
            }),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpPage(tester, ApiService.createWithClient(mockClient));

      expect(find.text('Retry'), findsOneWidget);
      expect(find.textContaining('Failed to load waitlists'), findsOneWidget);

      fail = false;
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      expect(find.textContaining('Failed to load waitlists'), findsNothing);
      expect(find.text('Waiting'), findsOneWidget);
    });
  });
}
