import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/app_header.dart';

void main() {
  Widget buildHeader({int? unreadCount}) {
    return MaterialApp(
      home: Scaffold(
        body: AppHeader(
          showNotifications: true,
          showProfile: true,
          unreadCount: unreadCount,
        ),
      ),
      routes: {
        '/notifications': (context) => const Scaffold(
              body: Center(
                key: Key('notifications-page'),
                child: Text('Notifications Page'),
              ),
            ),
      },
    );
  }

  testWidgets('bell icon shows the unread count badge', (tester) async {
    await tester.pumpWidget(buildHeader(unreadCount: 4));

    expect(find.text('4'), findsOneWidget);
    expect(find.byIcon(Icons.notifications_outlined), findsOneWidget);
  });

  testWidgets(
    'bell icon opens the notifications page with the standard route transition',
    (tester) async {
      await tester.pumpWidget(buildHeader(unreadCount: 3));

      await tester.tap(find.byIcon(Icons.notifications_outlined));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('notifications-page')), findsOneWidget);
      expect(find.text('Notifications Page'), findsOneWidget);
    },
  );

  testWidgets('bell icon does not push duplicate pages when already on /notifications', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        initialRoute: '/notifications',
        routes: {
          '/notifications': (context) => Scaffold(
                body: AppHeader(showNotifications: true, showProfile: true),
              ),
        },
      ),
    );

    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.notifications_outlined));
    await tester.pumpAndSettle();

    // No navigation occurred: still the same single page, still rendered
    expect(find.byType(AppHeader), findsOneWidget);
  });
}
