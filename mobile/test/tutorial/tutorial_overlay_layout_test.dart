import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/tutorial/models/tutorial_step.dart';
import 'package:mobile/features/tutorial/presentation/tutorial_overlay.dart';

void main() {
  const sizes = [Size(320, 568), Size(360, 640), Size(411, 891)];
  const insetTop = 24.0;
  const insetBottom = 24.0;
  const margin = 16.0;

  for (final size in sizes) {
    for (final step in tutorialSteps) {
      testWidgets(
          'card fits, clears target, buttons hittable: '
          '${size.width.toInt()}x${size.height.toInt()} ${step.target.name}',
          (tester) async {
        tester.view.devicePixelRatio = 1.0;
        tester.view.physicalSize = size;
        tester.view.padding =
            const FakeViewPadding(top: insetTop, bottom: insetBottom);
        tester.view.viewPadding =
            const FakeViewPadding(top: insetTop, bottom: insetBottom);
        addTearDown(tester.view.reset);

        final ctxs = <TutorialTarget, BuildContext?>{};
        Widget slot(TutorialTarget t) => Builder(builder: (c) {
              ctxs[t] = c;
              return const SizedBox(width: 56, height: 48);
            });

        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: Stack(children: [
              Positioned(
                  top: insetTop + 8,
                  right: 64,
                  child: slot(TutorialTarget.notificationBell)),
              Positioned(
                  top: insetTop + 8,
                  right: 8,
                  child: slot(TutorialTarget.notificationBell)),
              Positioned(
                  bottom: insetBottom + 72,
                  right: 16,
                  child: slot(TutorialTarget.mediGuideFab)),
              Positioned(
                left: 0,
                right: 0,
                bottom: insetBottom,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    slot(TutorialTarget.homeTab),
                    slot(TutorialTarget.doctorsTab),
                    slot(TutorialTarget.appointmentsTab),
                    slot(TutorialTarget.chatTab),
                    slot(TutorialTarget.profileTab),
                  ],
                ),
              ),
              Positioned.fill(
                child: TutorialOverlay(
                  step: step,
                  targetContextFor: (t) => ctxs[t],
                  onNext: () {},
                  onPrevious: () {},
                  onSkip: () {},
                  onFinish: () {},
                  onTabChanged: (_) {},
                ),
              ),
            ]),
          ),
        ));
        await tester.pumpAndSettle();

        final card =
            tester.getRect(find.byKey(const ValueKey('tutorial_tooltip_card')));
        expect(card.top, greaterThanOrEqualTo(insetTop + margin - 0.5));
        expect(card.bottom,
            lessThanOrEqualTo(size.height - insetBottom - margin + 0.5));
        expect(card.left, greaterThanOrEqualTo(margin - 0.5));
        expect(card.right, lessThanOrEqualTo(size.width - margin + 0.5));

        final box = ctxs[step.target]!.findRenderObject() as RenderBox;
        final targetRect = box.localToGlobal(Offset.zero) & box.size;
        expect(card.overlaps(targetRect), isFalse,
            reason: 'card must not cover the highlighted target');

        final last = step == tutorialSteps.last;
        for (final label in [
          'Previous',
          'Skip',
          last ? TutorialCompletionStep.buttonLabel : 'Next',
        ]) {
          expect(find.text(label).hitTestable(), findsOneWidget,
              reason: '$label must be visible and tappable');
        }
      });
    }
  }
}