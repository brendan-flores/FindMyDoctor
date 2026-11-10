import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/conversations/presentation/conversation_thread_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  group('ConversationThreadPage', () {
    setUp(() {
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
  });
}
