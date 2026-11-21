import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/conversations/presentation/conversation_thread_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

String? _sentMessageBody;

/// Fakes the conversation, message, and read-state endpoints while counting
/// requests so polling behavior can be asserted.
class _ThreadBackend {
  _ThreadBackend({List<Map<String, dynamic>>? messages})
    : messages = messages ?? <Map<String, dynamic>>[];

  final List<Map<String, dynamic>> messages;
  int conversationListRequests = 0;
  int messageRequests = 0;
  int readRequests = 0;
  int sendRequests = 0;

  MockClient get client => MockClient((request) async {
    final path = request.url.path;
    if (request.method == 'GET' && path.endsWith('/conversations')) {
      conversationListRequests += 1;
      return _json({
        'success': true,
        'data': [_conversationJson()],
      });
    }
    if (request.method == 'GET' && path.endsWith('/users/me')) {
      return _json({
        'success': true,
        'data': {'user_id': 'user-patient', 'id': 'user-patient'},
      });
    }
    if (request.method == 'GET' &&
        path.endsWith('/conversations/conv-1/messages')) {
      messageRequests += 1;
      return _json({'success': true, 'data': messages});
    }
    if (request.method == 'PATCH' &&
        path.endsWith('/conversations/conv-1/read')) {
      readRequests += 1;
      return _json({'success': true, 'data': null});
    }
    if (request.method == 'POST' &&
        path.endsWith('/conversations/conv-1/messages')) {
      sendRequests += 1;
      final decoded = jsonDecode(request.body) as Map<String, dynamic>;
      _sentMessageBody = decoded['message'] as String?;
      messages.add(
        _messageJson(
          'msg-sent-$sendRequests',
          _sentMessageBody ?? '',
          senderUserId: 'user-patient',
          sentAt: '2026-11-01T09:30:00.000Z',
        ),
      );
      return _json({'success': true, 'data': {'id': 'msg-sent-$sendRequests'}});
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

Map<String, dynamic> _conversationJson() {
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
    'unread_count': 0,
  };
}

Map<String, dynamic> _messageJson(
  String id,
  String message, {
  String senderUserId = 'user-secretary',
  String sentAt = '2026-11-01T09:00:00.000Z',
  String? readAt,
}) {
  return {
    'id': id,
    'conversation_id': 'conv-1',
    'sender_user_id': senderUserId,
    'message': message,
    'sent_at': sentAt,
    'read_at': readAt,
    'message_type': 'TEXT',
  };
}

/// Delivers a platform lifecycle event the same way the engine does.
Future<void> _sendLifecycleState(WidgetTester tester, String state) async {
  await tester.binding.defaultBinaryMessenger.handlePlatformMessage(
    SystemChannels.lifecycle.name,
    SystemChannels.lifecycle.codec.encodeMessage(state),
    (_) {},
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  group('ConversationThreadPage', () {
    setUp(() {
      _sentMessageBody = null;
      SharedPreferences.setMockInitialValues({
        'access_token': 'test-access-token-12345',
      });
    });

    Future<void> pumpLoaded(
      WidgetTester tester, {
      required MockClient mockClient,
      String? counterpartName,
    }) async {
      final apiService = ApiService.createWithClient(mockClient);
      await apiService.init();
      await tester.pumpWidget(
        MaterialApp(
          home: ConversationThreadPage(
            conversationId: 'conv-1',
            counterpartName: counterpartName,
            apiService: apiService,
          ),
        ),
      );
      // Allow initState futures to resolve without pumpAndSettle because the page
      // starts a 12-second polling Timer.periodic.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
    }

    Future<void> disposePage(WidgetTester tester) async {
      // Leave the app in the foreground so teardown never runs while frames are
      // disabled by a paused lifecycle state.
      await _sendLifecycleState(tester, 'AppLifecycleState.resumed');
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets('renders messages and an invoice bubble', (tester) async {
      final mockClient = MockClient((request) async {
        final path = request.url.path;
        if (request.method == 'GET' && path.endsWith('/conversations')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {
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
                  'unread_count': 0,
                },
              ],
            }),
            200,
          );
        }
        if (request.method == 'GET' && path.endsWith('/users/me')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'user_id': 'user-patient', 'id': 'user-patient'},
            }),
            200,
          );
        }
        if (request.method == 'GET' &&
            path.endsWith('/conversations/conv-1/messages')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': [
                {
                  'id': 'msg-1',
                  'conversation_id': 'conv-1',
                  'sender_user_id': 'user-secretary',
                  'message': 'Hello, how can I help?',
                  'sent_at': '2026-11-01T09:00:00.000Z',
                  'read_at': null,
                  'message_type': 'TEXT',
                },
                {
                  'id': 'msg-2',
                  'conversation_id': 'conv-1',
                  'sender_user_id': 'user-patient',
                  'message': 'I need my invoice',
                  'sent_at': '2026-11-01T09:05:00.000Z',
                  'read_at': '2026-11-01T09:06:00.000Z',
                  'message_type': 'TEXT',
                },
                {
                  'id': 'msg-3',
                  'conversation_id': 'conv-1',
                  'sender_user_id': 'user-secretary',
                  'message': 'Invoice sent',
                  'sent_at': '2026-11-01T09:10:00.000Z',
                  'read_at': null,
                  'message_type': 'INVOICE',
                  'invoice_id': 'invoice-1',
                  'invoice': {
                    'id': 'invoice-1',
                    'invoice_number': 'INV-0001',
                    'invoice_date': '2026-11-01',
                    'total_amount': 575.0,
                    'status': 'ACTIVE',
                  },
                },
              ],
            }),
            200,
          );
        }
        if (request.method == 'PATCH' &&
            path.endsWith('/conversations/conv-1/read')) {
          return http.Response(jsonEncode({'success': true, 'data': null}), 200);
        }
        return http.Response('Not found', 404);
      });

      await pumpLoaded(
        tester,
        mockClient: mockClient,
        counterpartName: 'Dr. Maria Santos',
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Dr. Maria Santos'), findsOneWidget);
      expect(find.text('Hello, how can I help?'), findsOneWidget);
      expect(find.text('I need my invoice'), findsOneWidget);
      expect(find.text('Invoice INV-0001'), findsOneWidget);
      expect(find.text('Nov 1, 2026'), findsOneWidget);
      expect(find.text('₱575.00'), findsOneWidget);
      expect(find.text('Paid'), findsOneWidget);
      expect(find.text('Type a message...'), findsOneWidget);

      await disposePage(tester);
    });

    testWidgets('sends a message and clears the input', (tester) async {
      String? sentBody;
      final mockClient = MockClient((request) async {
        final path = request.url.path;
        if (request.method == 'GET' && path.endsWith('/conversations')) {
          return http.Response(
            jsonEncode({'success': true, 'data': <dynamic>[]}),
            200,
          );
        }
        if (request.method == 'GET' && path.endsWith('/users/me')) {
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'user_id': 'user-patient', 'id': 'user-patient'},
            }),
            200,
          );
        }
        if (request.method == 'GET' &&
            path.endsWith('/conversations/conv-1/messages')) {
          final messages = sentBody == null
              ? <Map<String, dynamic>>[]
              : <Map<String, dynamic>>[
                  {
                    'id': 'msg-new',
                    'conversation_id': 'conv-1',
                    'sender_user_id': 'user-patient',
                    'message': 'Hello secretary',
                    'sent_at': '2026-11-01T09:20:00.000Z',
                    'read_at': null,
                    'message_type': 'TEXT',
                  },
                ];
          return http.Response(
            jsonEncode({'success': true, 'data': messages}),
            200,
          );
        }
        if (request.method == 'PATCH' &&
            path.endsWith('/conversations/conv-1/read')) {
          return http.Response(jsonEncode({'success': true, 'data': null}), 200);
        }
        if (request.method == 'POST' &&
            path.endsWith('/conversations/conv-1/messages')) {
          sentBody = (jsonDecode(request.body) as Map<String, dynamic>)['message']
              as String?;
          return http.Response(
            jsonEncode({'success': true, 'data': {'id': 'msg-new'}}),
            200,
          );
        }
        return http.Response('Not found', 404);
      });

      await pumpLoaded(tester, mockClient: mockClient);

      expect(find.text('No messages yet'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Hello secretary');
      await tester.tap(find.byIcon(Icons.send));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));

      expect(sentBody, 'Hello secretary');
      final textField = tester.widget<TextField>(find.byType(TextField));
      expect(textField.controller?.text, isEmpty);
      expect(find.text('Hello secretary'), findsOneWidget);

      await disposePage(tester);
    });

    testWidgets('does not poll messages while the app is not in the foreground', (
      tester,
    ) async {
      final backend = _ThreadBackend(
        messages: [_messageJson('msg-1', 'Hello')],
      );

      await pumpLoaded(tester, mockClient: backend.client);
      expect(backend.messageRequests, 1);
      expect(find.text('Hello'), findsOneWidget);

      await _sendLifecycleState(tester, 'AppLifecycleState.paused');
      await tester.pump(const Duration(seconds: 30));

      expect(
        backend.messageRequests,
        1,
        reason: 'no message request may be made while paused',
      );

      await disposePage(tester);
    });

    testWidgets('refreshes immediately when the app resumes', (tester) async {
      final backend = _ThreadBackend(
        messages: [_messageJson('msg-1', 'Hello')],
      );

      await pumpLoaded(tester, mockClient: backend.client);
      expect(backend.messageRequests, 1);

      await _sendLifecycleState(tester, 'AppLifecycleState.paused');
      await tester.pump(const Duration(seconds: 30));
      expect(backend.messageRequests, 1);

      // A message sent while the app was backgrounded.
      backend.messages.add(_messageJson('msg-2', 'Sent while away'));
      await _sendLifecycleState(tester, 'AppLifecycleState.resumed');
      await tester.pump(const Duration(milliseconds: 100));

      expect(
        backend.messageRequests,
        2,
        reason: 'resume must refresh without waiting for the next tick',
      );
      expect(find.text('Sent while away'), findsOneWidget);

      await disposePage(tester);
    });

    testWidgets('restarts polling without duplicating timers', (tester) async {
      final backend = _ThreadBackend(
        messages: [_messageJson('msg-1', 'Hello')],
      );

      await pumpLoaded(tester, mockClient: backend.client);
      expect(backend.messageRequests, 1);

      // Two background/foreground cycles: each resume refreshes once.
      await _sendLifecycleState(tester, 'AppLifecycleState.paused');
      await _sendLifecycleState(tester, 'AppLifecycleState.resumed');
      await tester.pump(const Duration(milliseconds: 100));
      expect(backend.messageRequests, 2);

      await _sendLifecycleState(tester, 'AppLifecycleState.paused');
      await _sendLifecycleState(tester, 'AppLifecycleState.resumed');
      await tester.pump(const Duration(milliseconds: 100));
      expect(backend.messageRequests, 3);

      // Exactly one periodic poll per interval after the restarts. A duplicated
      // timer would add a second request here.
      await tester.pump(const Duration(seconds: 12));
      await tester.pump(const Duration(milliseconds: 100));
      expect(backend.messageRequests, 4);

      await tester.pump(const Duration(seconds: 12));
      await tester.pump(const Duration(milliseconds: 100));
      expect(backend.messageRequests, 5);

      await disposePage(tester);
    });

    testWidgets('an unchanged poll does not rebuild the message list', (
      tester,
    ) async {
      final backend = _ThreadBackend(
        messages: [
          _messageJson('msg-1', 'Hello'),
          _messageJson(
            'msg-2',
            'Still here',
            sentAt: '2026-11-01T09:01:00.000Z',
          ),
        ],
      );

      await pumpLoaded(tester, mockClient: backend.client);
      expect(backend.messageRequests, 1);

      final before = tester.widget<ListView>(find.byType(ListView));

      await tester.pump(const Duration(seconds: 12));
      await tester.pump(const Duration(milliseconds: 100));

      expect(backend.messageRequests, 2);
      final unchanged = tester.widget<ListView>(find.byType(ListView));
      expect(
        identical(before, unchanged),
        isTrue,
        reason: 'identical messages must not trigger setState/build',
      );

      // A real change still rebuilds and renders the new message.
      backend.messages.add(
        _messageJson(
          'msg-3',
          'A new message',
          sentAt: '2026-11-01T09:02:00.000Z',
        ),
      );
      await tester.pump(const Duration(seconds: 12));
      await tester.pump(const Duration(milliseconds: 100));

      expect(backend.messageRequests, 3);
      expect(find.text('A new message'), findsOneWidget);
      expect(
        identical(
          tester.widget<ListView>(find.byType(ListView)),
          unchanged,
        ),
        isFalse,
      );

      await disposePage(tester);
    });

    testWidgets('an unchanged poll preserves the scroll position', (
      tester,
    ) async {
      final backend = _ThreadBackend(
        messages: List.generate(
          30,
          (index) => _messageJson(
            'msg-$index',
            'Message $index',
            sentAt: '2026-11-01T09:${index.toString().padLeft(2, '0')}:00.000Z',
          ),
        ),
      );

      await pumpLoaded(tester, mockClient: backend.client);
      // Finish the initial scroll-to-latest animation.
      await tester.pump(const Duration(milliseconds: 500));

      final listScrollable = find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      );
      final position = tester.state<ScrollableState>(listScrollable).position;
      final bottom = position.pixels;

      // Read an older message by scrolling up.
      await tester.drag(find.byType(ListView), const Offset(0, 400));
      await tester.pump(const Duration(seconds: 1));
      final beforePoll = position.pixels;
      expect(beforePoll, lessThan(bottom));

      await tester.pump(const Duration(seconds: 12));
      await tester.pump(const Duration(milliseconds: 100));

      expect(backend.messageRequests, 2);
      expect(position.pixels, closeTo(beforePoll, 0.5));

      await disposePage(tester);
    });
  });
}
