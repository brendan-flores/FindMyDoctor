import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/tutorial/models/tutorial_step.dart';
import 'package:mobile/features/tutorial/presentation/tutorial_overlay.dart';

void main() {
  group('TutorialOverlay', () {
    TutorialOverlay buildOverlay({
      Map<TutorialTarget, BuildContext?>? targetContexts,
    }) {
      final step = tutorialSteps.first;
      return TutorialOverlay(
        key: const Key('tutorial-overlay'),
        step: step,
        targetContextFor: (t) => targetContexts?[t],
        onNext: () {},
        onPrevious: () {},
        onSkip: () {},
        onFinish: () {},
        onTabChanged: (index) {},
        reducedMotion: false,
      );
    }

    Widget wrapWithScreenSize(Widget child) {
      return SizedBox(
        width: 1000,
        height: 1200,
        child: MaterialApp(
          home: Scaffold(body: child),
        ),
      );
    }

    testWidgets('overlay is inserted and spotlight renders', (tester) async {
      await tester.pumpWidget(wrapWithScreenSize(buildOverlay(targetContexts: {})));

      await tester.pumpAndSettle();

      // The overlay Stack should be present
      expect(find.byKey(const Key('tutorial-overlay')), findsOneWidget);

      // CustomPaint (spotlight) should render (may find multiple due to
      // Material internals; verify at least one exists)
      expect(find.byType(CustomPaint), findsWidgets);
    });

    testWidgets('retry mechanism does not enter endless loop', (tester) async {
      await tester.pumpWidget(wrapWithScreenSize(buildOverlay(targetContexts: {})));

      await tester.pumpAndSettle();

      // Overlay should still be present after post-frame callbacks
      expect(find.byKey(const Key('tutorial-overlay')), findsOneWidget);

      // Additional pump frames should not cause issues
      for (var i = 0; i < 5; i++) {
        await tester.pump();
      }
      expect(find.byKey(const Key('tutorial-overlay')), findsOneWidget);
    });

    testWidgets('tooltip becomes visible after measurement fallback', (tester) async {
      await tester.pumpWidget(wrapWithScreenSize(buildOverlay(targetContexts: {})));

      // Allow post-frame callbacks including retry to complete
      await tester.pumpAndSettle();

      // After fallback, tooltip should be visible
      expect(find.text('Welcome to Your Home Dashboard!'), findsOneWidget);
      expect(find.text('Step 1 of 7'), findsOneWidget);
      expect(find.textContaining('This is your Home screen.'), findsOneWidget);
    });

    testWidgets('tooltip remains visible after rebuilds', (tester) async {
      await tester.pumpWidget(wrapWithScreenSize(buildOverlay(targetContexts: {})));

      await tester.pumpAndSettle();

      expect(find.text('Welcome to Your Home Dashboard!'), findsOneWidget);

      // Force additional rebuilds
      await tester.pump();
      await tester.pump();
      await tester.pump();

      expect(find.text('Welcome to Your Home Dashboard!'), findsOneWidget);
    });
  });
}
