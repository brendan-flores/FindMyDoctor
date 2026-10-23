import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/conversations/models/conversation.dart';
import 'package:mobile/features/home/presentation/home_page.dart';

/// Regression coverage for the blank Secretary Chat tab.
///
/// The tab previously rendered conversation lists through an inline
/// collection-if chain (`if loading … else if isEmpty … else cards`) with a
/// nested height guard inside the empty branch. Dart binds a trailing `else`
/// to the nearest unmatched `if`, so the card list only ran when the empty
/// branch's guard failed, and the tab rendered nothing at all whenever
/// conversations actually existed.
Conversation _conversation({int unreadCount = 0}) => Conversation(
  id: '3ce99205-dfa8-48fa-b19e-9b5f9a498a9c',
  patientId: '71e15741-ec72-4278-9593-b72afbdc895a',
  secretaryId: '70529ac7-65ac-4db0-ae61-85cbd4d59d9c',
  doctorId: '9e8fed40-b358-4f65-a93a-89e44c891f73',
  status: 'OPEN',
  createdAt: DateTime(2026, 10, 19, 15, 35),
  updatedAt: DateTime(2026, 10, 19, 17, 36),
  secretaryFirstName: 'Brendan Emmanuel',
  secretaryLastName: 'Flores',
  doctorFirstName: 'Brendan Emmanuel',
  doctorLastName: 'Flores',
  practiceName: null,
  unreadCount: unreadCount,
  lastMessagePreview: 'hello',
  lastMessageSentAt: DateTime(2026, 10, 19, 17, 36),
);

Widget _host({
  required bool isLoading,
  required List<Conversation> conversations,
}) {
  return MaterialApp(
    home: Scaffold(
      body: ChatTabContent(
        isLoading: isLoading,
        conversations: conversations,
        onRefresh: () {},
      ),
    ),
  );
}

void main() {
  testWidgets('renders conversation cards when the list is not empty', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(isLoading: false, conversations: [_conversation()]),
    );

    expect(find.text('Brendan Emmanuel Flores'), findsOneWidget);
    expect(find.text('hello'), findsOneWidget);
    expect(find.text('No conversations yet'), findsNothing);
  });

  testWidgets('renders the empty state when no conversations exist', (
    tester,
  ) async {
    await tester.pumpWidget(_host(isLoading: false, conversations: const []));

    expect(find.text('No conversations yet'), findsOneWidget);
    expect(
      find.text('Secretaries will start conversations with you'),
      findsOneWidget,
    );
  });

  testWidgets('renders a loading spinner while loading', (tester) async {
    await tester.pumpWidget(_host(isLoading: true, conversations: const []));

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('No conversations yet'), findsNothing);
  });

  testWidgets('shows the unread badge for unread conversations', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(isLoading: false, conversations: [_conversation(unreadCount: 2)]),
    );

    expect(find.text('2'), findsOneWidget);
  });
}
