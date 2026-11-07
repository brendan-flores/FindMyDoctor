import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/notifications/presentation/notifications_page.dart';

void main() {
  testWidgets(
    'tapping SCHEDULE_CHANGE_NOTICE opens the related appointment',
    (tester) async {
      final client = MockClient((request) async {
        final path = request.url.path;

        if (request.method == 'GET' && path.endsWith('/notifications')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {
                  'id': 'notif-1',
                  'user_id': 'patient-user-1',
                  'type': 'SCHEDULE_CHANGE_NOTICE',
                  'title': 'Schedule Change Notice',
                  'message':
                      "The clinic changed the doctor's schedule. They will contact you about your appointment.",
                  'is_read': false,
                  'related_entity_type': 'appointment',
                  'related_entity_id': 'appointment-123',
                  'created_at': '2026-11-07T09:00:22.909Z',
                },
              ],
              'message': 'Operation successful.',
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        if (request.method == 'PATCH' && path.endsWith('/notifications/notif-1/read')) {
          return http.Response(
            jsonEncode({'success': true, 'data': null}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }

        return http.Response('{"success":false}', 404);
      });

      final apiService = ApiService.createWithClient(client);

      await tester.pumpWidget(
        MaterialApp(
          home: NotificationsPage(apiService: apiService),
          routes: {
            '/appointment-detail': (context) =>
                const Scaffold(body: Center(child: Text('Appointment Detail Screen'))),
          },
        ),
      );

      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Schedule Change Notice'), findsOneWidget);
      expect(find.text('Tap to view appointment'), findsOneWidget);

      await tester.tap(find.text('Schedule Change Notice'));
      await tester.pump();
      await tester.pump();
      await tester.pumpAndSettle();

      expect(find.text('Appointment Detail Screen'), findsOneWidget);
    },
  );
}
