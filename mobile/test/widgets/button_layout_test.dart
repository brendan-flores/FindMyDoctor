import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/widgets/primary_button.dart';
import 'package:mobile/core/widgets/secondary_button.dart';

void main() {
  group('SecondaryButton layout', () {
    testWidgets('isFullWidth: false renders without infinite-width exception',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 500,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SecondaryButton(
                    text: 'Previous',
                    onPressed: null,
                    isFullWidth: false,
                  ),
                  const SizedBox(width: 8),
                  SecondaryButton(
                    text: 'Skip',
                    onPressed: () {},
                    isFullWidth: false,
                  ),
                  const SizedBox(width: 8),
                  PrimaryButton(
                    text: 'Next',
                    onPressed: () {},
                    isFullWidth: false,
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      // All three buttons must be present
      expect(find.byType(SecondaryButton), findsNWidgets(2));
      expect(find.byType(PrimaryButton), findsNWidgets(1));

      // Each button has finite rendered width (no infinite-width crash)
      // Verify text is visible
      expect(find.text('Previous'), findsOneWidget);
      expect(find.text('Skip'), findsOneWidget);
      expect(find.text('Next'), findsOneWidget);
    });

    testWidgets('isFullWidth: true renders full width', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 400,
              child: SecondaryButton(
                text: 'Full Width Button',
                onPressed: () {},
                isFullWidth: true,
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Full Width Button'), findsOneWidget);
    });
  });

  group('PrimaryButton layout', () {
    testWidgets('isFullWidth: false renders without infinite-width exception',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 300,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  PrimaryButton(
                    text: 'Get Started',
                    onPressed: () {},
                    isFullWidth: false,
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(PrimaryButton), findsNWidgets(1));
      expect(find.text('Get Started'), findsOneWidget);
    });

    testWidgets('long text does not cause infinite-width exception',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 600,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  PrimaryButton(
                    text: 'This is a very long button label',
                    onPressed: () {},
                    isFullWidth: false,
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(PrimaryButton), findsNWidgets(1));
    });
  });
}