import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/notifications/presentation/notifications_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({'access_token': 'test-token'});
  });

  testWidgets('successful empty response shows genuine empty state', (
    tester,
  ) async {
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/notifications')) {
        return http.Response(jsonEncode({'success': true, 'data': []}), 200);
      }
      return http.Response('not found', 404);
    });

    final apiService = ApiService.createWithClient(client);
    await apiService.init();

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(apiService: apiService)),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('No notifications'), findsOneWidget);
    expect(find.text('Retry'), findsNothing);
  });

  testWidgets('shows a loading indicator while the request is in flight', (
    tester,
  ) async {
    final completer = Completer<http.Response>();
    final client = MockClient((request) {
      if (request.url.path.endsWith('/notifications')) {
        return completer.future;
      }
      return Future.value(http.Response('not found', 404));
    });

    final apiService = ApiService.createWithClient(client);
    await apiService.init();

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(apiService: apiService)),
    );
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    completer.complete(
      http.Response(jsonEncode({'success': true, 'data': []}), 200),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('No notifications'), findsOneWidget);
  });

  testWidgets('HTTP 200 with success false shows the error state, not empty', (
    tester,
  ) async {
    int calls = 0;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/notifications')) {
        calls++;
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'message': 'Failed to load notifications'},
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    final apiService = ApiService.createWithClient(client);
    await apiService.init();

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(apiService: apiService)),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // A 200 response whose body reports success:false must be treated as an
    // error, never as a successful (empty) notification list.
    expect(find.text('No notifications'), findsNothing);
    expect(find.text("You're all caught up!"), findsNothing);
    expect(find.text('Failed to load notifications'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(calls, 2);
    expect(find.text('Failed to load notifications'), findsOneWidget);
  });

  testWidgets('mark-as-read failure keeps the notification visible', (
    tester,
  ) async {
    int patchCalls = 0;
    final client = MockClient((request) async {
      final path = request.url.path;
      if (request.method == 'GET' && path.endsWith('/notifications')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              {
                'id': 'n1',
                'title': 'Hello',
                'message': 'World',
                'is_read': false,
                'created_at': '2026-11-20T10:00:00.000Z',
              },
            ],
          }),
          200,
        );
      }
      if (request.method == 'PATCH' &&
          path.endsWith('/notifications/n1/read')) {
        patchCalls++;
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'message': 'Failed to mark notification as read'},
          }),
          500,
        );
      }
      return http.Response('not found', 404);
    });

    final apiService = ApiService.createWithClient(client);
    await apiService.init();

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(apiService: apiService)),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('Hello'), findsOneWidget);

    await tester.tap(find.text('Hello'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // The failed PATCH is swallowed and the screen keeps working.
    expect(patchCalls, 1);
    expect(find.text('Hello'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('failed request shows error and Retry', (tester) async {
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/notifications')) {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'message': 'Failed to load notifications'},
          }),
          500,
        );
      }
      return http.Response('not found', 404);
    });

    final apiService = ApiService.createWithClient(client);
    await apiService.init();

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(apiService: apiService)),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(
      find.text('Failed to load notifications. Check your connection.'),
      findsOneWidget,
    );
    expect(find.text('Retry'), findsOneWidget);
    expect(find.text('No notifications'), findsNothing);
  });

  testWidgets('retry makes another request and shows result', (tester) async {
    int calls = 0;
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/notifications')) {
        calls++;
        if (calls == 1) {
          return http.Response(
            jsonEncode({
              'success': false,
              'error': {'message': 'Failed to load notifications'},
            }),
            500,
          );
        }
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              {
                'id': 'n1',
                'title': 'Hello',
                'message': 'World',
                'is_read': false,
                'created_at': '2026-11-20T10:00:00.000Z',
              },
            ],
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });

    final apiService = ApiService.createWithClient(client);
    await apiService.init();

    await tester.pumpWidget(
      MaterialApp(home: NotificationsPage(apiService: apiService)),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('Retry'), findsOneWidget);
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.text('Hello'), findsOneWidget);
    expect(calls, 2);
  });
}
