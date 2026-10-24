import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/widgets/app_header.dart';

void main() {
  testWidgets('header notification dropdown renders fetched notifications', (
    tester,
  ) async {
    final client = MockClient((request) async {
      if (request.url.path.endsWith('/notifications')) {
        return http.Response(
          jsonEncode({
            'success': true,
            'data': [
              {
                'id': '11111111-1111-1111-1111-111111111111',
                'user_id': '22222222-2222-2222-2222-222222222222',
                'type': 'PAYMENT_VERIFIED',
                'title': 'Payment Verified',
                'message': 'Your payment has been verified.',
                'is_read': false,
                'related_entity_type': 'PAYMENT',
                'related_entity_id': '33333333-3333-3333-3333-333333333333',
                'created_at': '2026-10-24T09:00:22.909Z',
              },
            ],
            'message': 'Operation successful.',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      }
      return http.Response('{"success":false}', 404);
    });

    final apiService = ApiService.createWithClient(client);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Column(
            children: [
              AppHeader(apiService: apiService),
              const Expanded(child: SizedBox()),
            ],
          ),
        ),
      ),
    );

    await tester.tap(find.byIcon(Icons.notifications_outlined));
    // One pump inserts the overlay, the next ones let the fetched data land.
    await tester.pump();
    await tester.pump();
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Payment Verified'), findsOneWidget);
    expect(find.text('Your payment has been verified.'), findsOneWidget);
  });
}
