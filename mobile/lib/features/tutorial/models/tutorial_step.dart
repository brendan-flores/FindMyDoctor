/// Identifier for each tutorial target widget within HomePage.
enum TutorialTarget {
  homeTab,
  doctorsTab,
  appointmentsTab,
  chatTab,
  profileTab,
  notificationBell,
  mediGuideFab,
  tutorialButton,
}

/// A single tutorial step describing what to highlight and what to teach.
class TutorialStep {
  final TutorialTarget target;
  final String title;
  final String description;
  /// Optional HomePage tab index to switch to before showing this step.
  final int? tabIndex;

  const TutorialStep({
    required this.target,
    required this.title,
    required this.description,
    this.tabIndex,
  });
}

/// The complete, ordered tutorial sequence for newly registered patients.
///
/// Steps follow the main HomePage navigation left-to-right, then surface
/// the notification bell and MediGuide FAB. Each step targets an actual
/// widget in the application (no duplicate or fake UI).
List<TutorialStep> tutorialSteps = const [
  TutorialStep(
    target: TutorialTarget.homeTab,
    tabIndex: 0,
    title: 'Welcome to Your Home Dashboard!',
    description:
        'This is your Home screen. Here, you can see your upcoming '
        'appointments, access quick actions, and stay updated with important '
        'information from your clinic.',
  ),
  TutorialStep(
    target: TutorialTarget.doctorsTab,
    tabIndex: 1,
    title: 'Find the Right Doctor',
    description:
        'Looking for a doctor? Browse available doctors, explore medical '
        'specialties, search for clinics, and view doctor profiles to find '
        'the right healthcare professional.',
  ),
  TutorialStep(
    target: TutorialTarget.appointmentsTab,
    tabIndex: 2,
    title: 'Manage Your Appointments',
    description:
        'Keep track of your appointments here. You can check upcoming visits, '
        'review appointment statuses, and monitor your queue information when '
        'available.',
  ),
  TutorialStep(
    target: TutorialTarget.chatTab,
    tabIndex: 3,
    title: 'Stay Connected with Your Clinic',
    description:
        'Use the Chat section to communicate with your clinic or access the '
        'AI assistant for healthcare-related guidance.',
  ),
  TutorialStep(
    target: TutorialTarget.profileTab,
    tabIndex: 4,
    title: 'Manage Your Account',
    description:
        'Access your personal information, medical records, payments and '
        'invoices, notification preferences, and other account settings here.',
  ),
  TutorialStep(
    target: TutorialTarget.notificationBell,
    tabIndex: 0,
    title: 'Stay Updated!',
    description:
        'Check your notifications to stay informed about important updates, '
        'appointment reminders, and messages from your clinic.',
  ),
  TutorialStep(
    target: TutorialTarget.mediGuideFab,
    tabIndex: 0,
    title: 'Meet MediGuide!',
    description:
        'Need assistance? Use MediGuide to access the AI assistant and get '
        'help with your healthcare-related questions.',
  ),
];

/// The final completion step shown after all navigation targets.
class TutorialCompletionStep {
  static const String title = 'You\'re All Set!';
  static const String description =
      'You\'re ready to explore FindMyDoctor! Discover doctors, manage your '
      'appointments, stay connected with your clinic, and take control of '
      'your healthcare journey.';
  static const String buttonLabel = 'Get Started';
}
