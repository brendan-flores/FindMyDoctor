import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/widgets/skeleton.dart';
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

    expect(find.byType(NotificationTileSkeleton), findsWidgets);

    completer.complete(
      http.Response(jsonEncode({'success': true, 'data': []}), 200),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.byType(NotificationTileSkeleton), findsNothing);
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

  testWidgets('tapping each notification type opens its destination route', (
    tester,
  ) async {
    final pushedRoutes = <MapEntry<String, Object?>>[];

    Map<String, dynamic> notification(
      String id,
      String type,
      String title,
      String entityType,
      String entityId,
    ) => {
      'id': id,
      'type': type,
      'title': title,
      'message': 'Tap to view details',
      'is_read': false,
      'created_at': '2026-11-20T10:00:00.000Z',
      'related_entity_type': entityType,
      'related_entity_id': entityId,
    };

    final client = MockClient((request) async {
      final path = request.url.path;
      if (request.method == 'GET' && path.endsWith('/notifications')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              notification('n1', 'APPOINTMENT_CONFIRMED', 'Notif Confirmed',
                  'appointment', 'appt-1'),
              notification('n2', 'APPOINTMENT_CANCELLED', 'Notif Cancelled',
                  'appointment', 'appt-2'),
              notification('n3', 'PRESCRIPTION_AVAILABLE', 'Notif Rx Ready',
                  'prescription', 'rx-1'),
              notification('n4', 'PRESCRIPTION_UPDATED', 'Notif Rx Updated',
                  'prescription', 'rx-2'),
              notification('n5', 'NEW_SECRETARY_MESSAGE', 'Notif Sec Msg',
                  'conversation', 'conv-1'),
              notification('n6', 'NEW_PATIENT_MESSAGE', 'Notif Pat Msg',
                  'conversation', 'conv-2'),
              notification('n7', 'QUEUE_UPDATED', 'Notif Queue',
                  'queue', 'queue-1'),
            ],
          }),
          200,
        );
      }
      if (request.method == 'PATCH' &&
          path.contains('/notifications/') &&
          path.endsWith('/read')) {
        return http.Response(jsonEncode({'success': true}), 200);
      }
      return http.Response('not found', 404);
    });

    final apiService = ApiService.createWithClient(client);
    await apiService.init();

    await tester.pumpWidget(
      MaterialApp(
        onGenerateRoute: (settings) {
          pushedRoutes.add(
            MapEntry(settings.name ?? '', settings.arguments),
          );
          return MaterialPageRoute(
            builder: (_) => Scaffold(
              appBar: AppBar(),
              body: Text('dest:${settings.name}'),
            ),
          );
        },
        home: NotificationsPage(apiService: apiService),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 2));

    final expectations = <String, (String route, String argKey, String argVal)>{
      'Notif Confirmed': ('/appointment-detail', 'appointmentId', 'appt-1'),
      'Notif Cancelled': ('/appointment-detail', 'appointmentId', 'appt-2'),
      'Notif Rx Ready': ('/prescription-detail', 'prescriptionId', 'rx-1'),
      'Notif Rx Updated': ('/prescription-detail', 'prescriptionId', 'rx-2'),
      'Notif Sec Msg': ('/conversation-thread', 'conversationId', 'conv-1'),
      'Notif Pat Msg': ('/conversation-thread', 'conversationId', 'conv-2'),
      'Notif Queue': ('/home', '', ''),
    };

    for (final entry in expectations.entries) {
      pushedRoutes.clear();
      await tester.ensureVisible(find.text(entry.key));
      await tester.tap(find.text(entry.key));
      await tester.pumpAndSettle(const Duration(seconds: 2));

      expect(
        pushedRoutes,
        hasLength(1),
        reason: '"${entry.key}" should push exactly one route',
      );
      expect(
        pushedRoutes.single.key,
        entry.value.$1,
        reason: '"${entry.key}" should navigate to ${entry.value.$1}',
      );
      if (entry.value.$2.isNotEmpty) {
        final args = pushedRoutes.single.value as Map<String, dynamic>;
        expect(
          args[entry.value.$2],
          entry.value.$3,
          reason: '"${entry.key}" should pass ${entry.value.$2}',
        );
      }

      await tester.pageBack();
      await tester.pumpAndSettle(const Duration(seconds: 2));
    }
  });
}
