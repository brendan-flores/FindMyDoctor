import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/home/presentation/home_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Fakes the endpoints [HomePage] reads on startup and counts conversation
/// list requests so the Chat-tab freshness behavior can be asserted.
class _ChatBackend {
  int conversationRequests = 0;
  bool failConversations = false;
  List<Map<String, dynamic>> conversations = [_conversationJson()];

  MockClient get client => MockClient((request) async {
    final path = request.url.path;

    if (request.method == 'GET' && path.endsWith('/conversations')) {
      conversationRequests += 1;
      if (failConversations) {
        return http.Response(
          jsonEncode({
            'success': false,
            'error': {'message': 'Service unavailable'},
          }),
          500,
        );
      }
      return _json({'success': true, 'data': conversations});
    }

    if (request.method == 'GET' && path.endsWith('/patients/me')) {
      return _json({
        'success': true,
        'data': {
          'first_name': 'Pat',
          'last_name': 'Ient',
          'email': 'patient@example.com',
        },
      });
    }

    if (request.method == 'GET' && path.contains('notifications')) {
      return _json({
        'success': true,
        'data': {'count': 0},
      });
    }

    if (request.method == 'GET' && path.contains('waitlists')) {
      return _json({
        'success': true,
        'data': {'count': 0},
      });
    }

    return http.Response('Not found', 404);
  });
}

http.Response _json(Object body) {
  return http.Response(
    jsonEncode(body),
    200,
    headers: {'content-type': 'application/json'},
  );
}

Map<String, dynamic> _conversationJson({int unreadCount = 0}) {
  return {
    'id': 'conv-1',
    'patient_id': 'patient-1',
    'secretary_id': 'secretary-1',
    'doctor_id': 'doctor-1',
    'status': 'OPEN',
    'created_at': '2026-11-01T08:00:00.000Z',
    'updated_at': '2026-11-01T08:00:00.000Z',
    'secretary_first_name': 'Ana',
    'secretary_last_name': 'Reyes',
    'doctor_first_name': 'Maria',
    'doctor_last_name': 'Santos',
    'practice_name': 'Santos Clinic',
    'unread_count': unreadCount,
    'last_message_preview': 'See you soon',
    'last_message_sent_at': '2026-11-01T09:00:00.000Z',
  };
}

void main() {
  group('HomePage Chat tab conversation loading', () {
    late _ChatBackend backend;
    late ApiService apiService;

    setUp(() async {
      SharedPreferences.setMockInitialValues({'access_token': 'test-token'});
      backend = _ChatBackend();
      apiService = ApiService.createWithClient(backend.client);
      await apiService.init();
    });

    Future<void> pumpHome(
      WidgetTester tester, {
      Duration? conversationFreshness,
    }) async {
      await tester.pumpWidget(
        MaterialApp(
          home: HomePage(
            apiService: apiService,
            conversationFreshness: conversationFreshness,
          ),
          routes: {
            '/conversation-thread': (context) => Scaffold(
              appBar: AppBar(title: const Text('Thread')),
              body: const Text('thread body'),
            ),
          },
        ),
      );
      // Resolve initState futures. Do not use pumpAndSettle: hidden tabs keep
      // spinners animating and use the real ApiService (HTTP 400 in tests).
      for (var i = 0; i < 4; i += 1) {
        await tester.pump(const Duration(milliseconds: 50));
      }
    }

    Future<void> openChatTab(WidgetTester tester) async {
      await tester.tap(find.text('Chat'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
    }

    Future<void> closePage(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 50));
    }

    testWidgets('loads conversations once on startup and renders them', (
      tester,
    ) async {
      await pumpHome(tester);

      expect(backend.conversationRequests, 1);

      await openChatTab(tester);

      expect(find.text('Secretary Chat'), findsOneWidget);
      expect(find.text('Ana Reyes'), findsOneWidget);
      expect(find.text('See you soon'), findsOneWidget);
      expect(backend.conversationRequests, 1);

      await closePage(tester);
    });

    testWidgets('reuses fresh data across repeated Chat tab selections', (
      tester,
    ) async {
      await pumpHome(tester);
      expect(backend.conversationRequests, 1);

      await openChatTab(tester);
      await tester.tap(find.text('Home'));
      await tester.pump();
      await openChatTab(tester);
      await tester.tap(find.text('Profile'));
      await tester.pump();
      await openChatTab(tester);

      expect(backend.conversationRequests, 1);

      await closePage(tester);
    });

    testWidgets('refreshes when the stored conversations are stale', (
      tester,
    ) async {
      await pumpHome(tester, conversationFreshness: Duration.zero);
      expect(backend.conversationRequests, 1);

      await openChatTab(tester);
      expect(backend.conversationRequests, 2);

      await tester.tap(find.text('Home'));
      await tester.pump();
      await openChatTab(tester);
      expect(backend.conversationRequests, 3);

      await closePage(tester);
    });

    testWidgets('widget rebuilds do not trigger conversation requests', (
      tester,
    ) async {
      await pumpHome(tester);
      expect(backend.conversationRequests, 1);

      // Force frames and a couple of setState rebuilds without opening Chat.
      await tester.pump(const Duration(milliseconds: 250));
      await tester.tap(find.text('Profile'));
      await tester.pump();
      await tester.tap(find.text('Home'));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(backend.conversationRequests, 1);

      await closePage(tester);
    });

    testWidgets('refreshes after returning from a conversation thread', (
      tester,
    ) async {
      await pumpHome(tester);
      expect(backend.conversationRequests, 1);

      await openChatTab(tester);
      await tester.tap(find.text('See you soon'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text('thread body'), findsOneWidget);

      await tester.pageBack();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(milliseconds: 50));

      expect(backend.conversationRequests, 2);

      await closePage(tester);
    });

    testWidgets('a failed load renders the empty state and retries on the next visit', (
      tester,
    ) async {
      backend.failConversations = true;

      await pumpHome(tester);
      expect(backend.conversationRequests, 1);

      await openChatTab(tester);
      expect(backend.conversationRequests, 2);
      expect(find.text('No conversations yet'), findsOneWidget);

      await closePage(tester);
    });
  });
}
