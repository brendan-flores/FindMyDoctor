import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/features/appointments/presentation/booking_confirmation_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() async {
    SharedPreferences.setMockInitialValues({'access_token': 'test-token'});
  });

  http.Client makeClient({
    Map<String, dynamic>? bookingResponse,
    Map<String, dynamic>? conversationResponse,
    int conversationStatus = 201,
  }) {
    return MockClient((request) async {
      final path = request.url.path;
      if (path.endsWith('/appointments')) {
        return http.Response(
          jsonEncode(bookingResponse ??
              {
                'success': true,
                'data': {
                  'queueNumber': 1,
                  'totalPatients': 1,
                  'appointmentId': 'appt-1',
                },
              }),
          200,
        );
      }
      if (path.endsWith('/conversations')) {
        return http.Response(
          jsonEncode(conversationResponse ??
              {
                'success': true,
                'data': {
                  'id': 'conv-123',
                  'secretary_first_name': 'Grace',
                  'secretary_last_name': 'Lim',
                },
              }),
          conversationStatus,
        );
      }
      return http.Response('not found', 404);
    });
  }

  Widget buildApp(Widget home) {
    return MaterialApp(
      home: home,
      onGenerateRoute: (settings) {
        if (settings.name == '/conversation-thread') {
          final args = settings.arguments as Map<String, dynamic>?;
          return MaterialPageRoute(
            builder: (_) => Scaffold(
              body: Text('THREAD:${args?['conversationId']}:${args?['counterpartName']}'),
            ),
          );
        }
        if (settings.name == '/home') {
          return MaterialPageRoute(builder: (_) => const Scaffold(body: Text('HOME')));
        }
        return null;
      },
    );
  }

  Future<void> pumpSuccess(WidgetTester tester, ApiService api) async {
    await tester.pumpWidget(buildApp(BookingConfirmationPage(
      doctorId: 'doc-1',
      doctorName: 'Dr. Test',
      selectedDate: DateTime(2026, 10, 20),
      apiService: api,
    )));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();
  }

  testWidgets('chat button opens conversation and navigates with correct args', (tester) async {
    final api = ApiService.createWithClient(makeClient());
    await pumpSuccess(tester, api);

    expect(find.text('Tap to chat with secretary desk'), findsOneWidget);

    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(find.text('THREAD:conv-123:Grace Lim'), findsOneWidget);
  });

  testWidgets('missing doctorId shows error and no navigation', (tester) async {
    final api = ApiService.createWithClient(makeClient());
    await tester.pumpWidget(buildApp(BookingConfirmationPage(
      doctorId: '',
      doctorName: 'Dr. Test',
      selectedDate: DateTime(2026, 10, 20),
      apiService: api,
    )));
    await tester.pump();
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.textContaining('missing doctor information'), findsOneWidget);
    expect(find.textContaining('THREAD:'), findsNothing);
  });

  testWidgets('403 shows authorization error snackbar', (tester) async {
    final api = ApiService.createWithClient(makeClient(
      conversationResponse: {'success': false, 'error': {'code': 'FORBIDDEN', 'message': 'no'}},
      conversationStatus: 403,
    ));
    await pumpSuccess(tester, api);

    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('You are not authorized to open this conversation.'), findsOneWidget);
    expect(find.textContaining('THREAD:'), findsNothing);
  });

  testWidgets('404 shows secretary unavailable snackbar', (tester) async {
    final api = ApiService.createWithClient(makeClient(
      conversationResponse: {'success': false, 'error': {'code': 'NOT_FOUND', 'message': 'no'}},
      conversationStatus: 404,
    ));
    await pumpSuccess(tester, api);

    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(find.text('No secretary is available for this doctor right now.'), findsOneWidget);
  });

  testWidgets('loading indicator appears while request pending', (tester) async {
    final api = ApiService.createWithClient(MockClient((request) async {
      if (request.url.path.endsWith('/conversations')) {
        await Future.delayed(const Duration(milliseconds: 200));
        return http.Response(
          jsonEncode({'success': true, 'data': {'id': 'conv-1', 'secretary_first_name': 'Grace', 'secretary_last_name': 'Lim'}}),
          201,
        );
      }
      return http.Response(
        jsonEncode({'success': true, 'data': {'queueNumber': 1, 'totalPatients': 1, 'appointmentId': 'a1'}}),
        200,
      );
    }));
    await pumpSuccess(tester, api);

    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsWidgets);

    await tester.pumpAndSettle();
  });

  testWidgets('loading state restored after success', (tester) async {
    final api = ApiService.createWithClient(makeClient());
    await pumpSuccess(tester, api);
    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();
    await tester.pumpAndSettle();
    // After returning from thread, loading indicator should not be stuck
    expect(find.byType(CircularProgressIndicator), findsNothing);
  });

  testWidgets('repeated taps while pending trigger only one request', (tester) async {
    int requestCount = 0;
    final api = ApiService.createWithClient(MockClient((request) async {
      if (request.url.path.endsWith('/conversations')) {
        requestCount++;
        await Future.delayed(const Duration(milliseconds: 300));
        return http.Response(
          jsonEncode({'success': true, 'data': {'id': 'conv-1', 'secretary_first_name': 'Grace', 'secretary_last_name': 'Lim'}}),
          201,
        );
      }
      return http.Response(
        jsonEncode({'success': true, 'data': {'queueNumber': 1, 'totalPatients': 1, 'appointmentId': 'a1'}}),
        200,
      );
    }));
    await pumpSuccess(tester, api);

    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();
    // second tap while pending should be ignored
    await tester.tap(find.text('Opening conversation...'), warnIfMissed: false);
    await tester.pump();

    await tester.pumpAndSettle();
    expect(requestCount, 1);
  });

  testWidgets('disposed page does not navigate or throw after request completes', (tester) async {
    final api = ApiService.createWithClient(MockClient((request) async {
      if (request.url.path.endsWith('/conversations')) {
        await Future.delayed(const Duration(milliseconds: 300));
        return http.Response(
          jsonEncode({'success': true, 'data': {'id': 'conv-9', 'secretary_first_name': 'Grace', 'secretary_last_name': 'Lim'}}),
          201,
        );
      }
      return http.Response(
        jsonEncode({'success': true, 'data': {'queueNumber': 1, 'totalPatients': 1, 'appointmentId': 'a1'}}),
        200,
      );
    }));
    await pumpSuccess(tester, api);

    await tester.ensureVisible(find.text('Tap to chat with secretary desk'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Tap to chat with secretary desk'));
    await tester.pump();

    // Dispose the page before the response completes
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    // No thread route should have been pushed
    expect(find.textContaining('THREAD:'), findsNothing);
  });
}
