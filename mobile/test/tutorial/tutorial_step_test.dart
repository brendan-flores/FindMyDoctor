import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/tutorial/models/tutorial_step.dart';

void main() {
  group('TutorialStep model', () {
    test('defines 7 ordered navigation steps for the patient tutorial', () {
      expect(tutorialSteps.length, 7);
    });

    test('steps follow the correct target order', () {
      expect(tutorialSteps[0].target, TutorialTarget.homeTab);
      expect(tutorialSteps[1].target, TutorialTarget.doctorsTab);
      expect(tutorialSteps[2].target, TutorialTarget.appointmentsTab);
      expect(tutorialSteps[3].target, TutorialTarget.chatTab);
      expect(tutorialSteps[4].target, TutorialTarget.profileTab);
      expect(tutorialSteps[5].target, TutorialTarget.notificationBell);
      expect(tutorialSteps[6].target, TutorialTarget.mediGuideFab);
    });
  });

  group('Tutorial step content', () {
    test('every step has a non-empty title and description', () {
      for (final step in tutorialSteps) {
        expect(step.title.isNotEmpty, isTrue, reason: 'Step ${step.target} title empty');
        expect(step.description.isNotEmpty, isTrue, reason: 'Step ${step.target} description empty');
      }
    });

    test('navigation steps switch to the correct HomePage tab', () {
      expect(tutorialSteps[0].tabIndex, 0); // Home
      expect(tutorialSteps[1].tabIndex, 1); // Doctors
      expect(tutorialSteps[2].tabIndex, 2); // Appointments
      expect(tutorialSteps[3].tabIndex, 3); // Chat
      expect(tutorialSteps[4].tabIndex, 4); // Profile
      // Notification bell and MediGuide remain on Home tab (0)
      expect(tutorialSteps[5].tabIndex, 0);
      expect(tutorialSteps[6].tabIndex, 0);
    });
  });

  group('TutorialCompletionStep', () {
    test('has completion title, description, and button label', () {
      expect(TutorialCompletionStep.title.isNotEmpty, isTrue);
      expect(TutorialCompletionStep.description.isNotEmpty, isTrue);
      expect(TutorialCompletionStep.buttonLabel, 'Get Started');
    });
  });
}
