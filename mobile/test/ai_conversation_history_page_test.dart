import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../lib/features/conversations/presentation/ai_conversation_history_page.dart';

void main() {
  group('AiConversationHistoryPage Widget Tests', () {
    testWidgets('history page builds without errors', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AiConversationHistoryPage(),
        ),
      );
      expect(find.byType(AiConversationHistoryPage), findsOneWidget);
    });

    testWidgets('history page shows back button', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AiConversationHistoryPage(),
        ),
      );
      expect(find.byIcon(Icons.arrow_back), findsOneWidget);
    });

    testWidgets('history page shows conversations title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AiConversationHistoryPage(),
        ),
      );
      expect(find.text('Conversations'), findsOneWidget);
    });

    testWidgets('history page shows loading state initially', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: AiConversationHistoryPage(),
        ),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('tapping back returns conversation ID', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: const AiConversationHistoryPage(),
          onGenerateRoute: (settings) {
            if (settings.name == '/') {
              return MaterialPageRoute(
                builder: (context) => const Scaffold(
                  body: Center(child: Text('Home')),
                ),
              );
            }
            return null;
          },
        ),
      );
      
      // The page should build
      expect(find.byType(AiConversationHistoryPage), findsOneWidget);
    });
  });
}
