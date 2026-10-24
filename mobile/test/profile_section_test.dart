import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/app/app.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/services/push_notification_service.dart';
import 'package:mobile/features/auth/presentation/change_password_page.dart';
import 'package:mobile/features/auth/presentation/login_page.dart';
import 'package:mobile/features/home/presentation/home_page.dart';
import 'package:mobile/features/patients/presentation/patient_profile_page.dart';
import 'package:mobile/features/settings/presentation/privacy_notice_page.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler_platform_interface/permission_handler_platform_interface.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Profiling section redesign coverage (Profile tab in [HomePage]).
///
/// The push switch must register and remove this device's token through the
/// existing register/remove endpoints, surface a hint when the OS
/// notification permission is denied, and the Profile row must open the
/// standalone patient profile screen. Unauthenticated users must never be
/// able to reach that screen.
///
/// Note: these tests avoid `pumpAndSettle` because [HomePage] builds every
/// tab inside an IndexedStack, and hidden tabs keep a
/// CircularProgressIndicator running forever in tests (network loads fail
/// there); `pumpAndSettle` would therefore never settle.
class FakeApiService implements ApiService {
  int registerCalls = 0;
  int removeCalls = 0;
  bool registerSucceeds = true;

  @override
  Future<Map<String, dynamic>> registerDeviceToken({
    required String token,
    String provider = 'FCM',
    String platform = 'ANDROID',
    String? deviceInfo,
  }) async {
    registerCalls++;
    if (!registerSucceeds) {
      return <String, dynamic>{'success': false};
    }
    return <String, dynamic>{
      'success': true,
      'data': <String, dynamic>{'id': 'device-token-1'},
    };
  }

  @override
  Future<Map<String, dynamic>> removeDeviceToken(String id) async {
    removeCalls++;
    return <String, dynamic>{'success': true};
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw StateError(
        'Unexpected ApiService call: ${invocation.memberName}',
      );
}

/// Replaces the permission_handler platform interface so tests do not need
/// real OS plumbing.
class FakePermissionHandler extends PermissionHandlerPlatform {
  FakePermissionHandler(this.status);

  final PermissionStatus status;

  @override
  Future<PermissionStatus> checkPermissionStatus(Permission permission) async {
    return status;
  }

  @override
  Future<Map<Permission, PermissionStatus>> requestPermissions(
    List<Permission> permissions,
  ) async {
    return {for (final permission in permissions) permission: status};
  }

  @override
  Future<bool> openAppSettings() async {
    return true;
  }
}

PushNotificationService _pushServiceFor(FakeApiService apiService) {
  return PushNotificationService.withApiService(apiService);
}

Future<void> _pumpProfileTab(
  WidgetTester tester, {
  Map<String, Object> prefs = const {
    'access_token': 'test-token',
  },
  FakeApiService? apiService,
}) async {
  SharedPreferences.setMockInitialValues(prefs);
  PackageInfo.setMockInitialValues(
    appName: 'FindMyDoctor',
    packageName: 'com.example.mobile',
    version: '9.9.9',
    buildNumber: '42',
    buildSignature: 'test-signature',
  );
  // Without a handler the push channel never resolves under the fake-async
  // test binding, which would hang registerForCurrentUser() and, for the real
  // MyApp, leave the startup splash on screen forever.
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
    PushNotificationService.channel,
    (call) async => null,
  );

  await tester.pumpWidget(
    MaterialApp(
      home: HomePage(
        initialTab: 4,
        pushNotificationService:
            apiService == null ? null : _pushServiceFor(apiService),
      ),
      routes: {
        '/patient-profile': (context) => const PatientProfilePage(),
        '/privacy-notice': (context) => const PrivacyNoticePage(),
      },
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

/// Route builder stubs (stateless so the routes map can be const).
class PatientProfilePageRoute extends StatelessWidget {
  const PatientProfilePageRoute({super.key});

  @override
  Widget build(BuildContext context) => const PatientProfilePage();
}

class PrivacyNoticePageRoute extends StatelessWidget {
  const PrivacyNoticePageRoute({super.key});

  @override
  Widget build(BuildContext context) => const PrivacyNoticePage();
}

Future<void> _flushAfterToggle(WidgetTester tester) async {
  // The toggle completes quickly after two pumps, and a SnackBar is shown
  // for 4 seconds, its timer must be flushed before the test ends.
  await tester.pump(const Duration(seconds: 5));
  await tester.pump();
  await tester.pump(const Duration(seconds: 5));
  await tester.pump();
}

void main() {
  testWidgets(
    'push switch registers this device token when OS permission is granted',
    (tester) async {
      final apiService = FakeApiService();
      final originalPermissions = PermissionHandlerPlatform.instance;
      PermissionHandlerPlatform.instance =
          FakePermissionHandler(PermissionStatus.granted);
      addTearDown(() {
        PermissionHandlerPlatform.instance = originalPermissions;
      });

      await _pumpProfileTab(
        tester,
        prefs: const {
          'access_token': 'test-token',
          'push_notifications_enabled': false,
          'device_token': 'cached-fcm-token',
        },
        apiService: apiService,
      );

      // The stored preference is disabled, so the switch starts off.
      final switchFinder = find.byKey(const ValueKey('profile_push_switch'));
      expect(switchFinder, findsOneWidget);
      expect(tester.widget<Switch>(switchFinder).value, isFalse);

      await tester.tap(switchFinder);
      await _flushAfterToggle(tester);

      // The existing register endpoint was called with the (cached) token.
      expect(apiService.registerCalls, 1);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString(PushNotificationService.deviceTokenIdKey),
          'device-token-1');
      expect(prefs.getBool(PushNotificationService.pushEnabledKey), isTrue);
      expect(tester.widget<Switch>(switchFinder).value, isTrue);
    },
  );

  testWidgets(
    'push switch removes this device token when turned off',
    (tester) async {
      final apiService = FakeApiService();
      final originalPermissions = PermissionHandlerPlatform.instance;
      PermissionHandlerPlatform.instance =
          FakePermissionHandler(PermissionStatus.granted);
      addTearDown(() {
        PermissionHandlerPlatform.instance = originalPermissions;
      });

      await _pumpProfileTab(
        tester,
        // No stored registration: disable must succeed locally without
        // touching the network.
        apiService: apiService,
      );

      final switchFinder = find.byKey(const ValueKey('profile_push_switch'));
      expect(switchFinder, findsOneWidget);
      expect(tester.widget<Switch>(switchFinder).value, isTrue);

      await tester.tap(switchFinder);
      await _flushAfterToggle(tester);

      expect(apiService.registerCalls, 0);
      expect(tester.widget<Switch>(switchFinder).value, isFalse);
      final prefs = await SharedPreferences.getInstance();
      expect(
        prefs.getBool(PushNotificationService.pushEnabledKey),
        isFalse,
      );
      expect(
        prefs.getString(PushNotificationService.deviceTokenIdKey),
        isNull,
      );
    },
  );

  testWidgets(
    'permission-denied hint appears and registration is skipped',
    (tester) async {
      final apiService = FakeApiService();
      final originalPermissions = PermissionHandlerPlatform.instance;
      PermissionHandlerPlatform.instance =
          FakePermissionHandler(PermissionStatus.denied);
      addTearDown(() {
        PermissionHandlerPlatform.instance = originalPermissions;
      });

      await _pumpProfileTab(
        tester,
        prefs: const {
          'access_token': 'test-token',
          'push_notifications_enabled': false,
          'device_token': 'cached-fcm-token',
        },
        apiService: apiService,
      );

      final switchFinder = find.byKey(const ValueKey('profile_push_switch'));
      await tester.tap(switchFinder);
      await _flushAfterToggle(tester);

      // The OS dialog result is denied, so a hint with an "Open Settings"
      // action appears and no registration call happens.
      expect(find.text('Open Settings'), findsOneWidget);
      expect(apiService.registerCalls, 0);
      expect(tester.widget<Switch>(switchFinder).value, isFalse);
    },
  );

  testWidgets(
    'Profile row opens the standalone patient profile screen',
    (tester) async {
      await _pumpProfileTab(tester);

      await tester.tap(find.byKey(const ValueKey('profile_view_details')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(PatientProfilePage), findsOneWidget);
    },
  );

  testWidgets(
    'Privacy notice row opens the privacy notice screen',
    (tester) async {
      await _pumpProfileTab(tester);

      // The About section sits below the fold in the default test viewport.
      await tester.ensureVisible(
        find.byKey(const ValueKey('profile_privacy_notice')),
      );
      await tester.pump();
      await tester.tap(find.byKey(const ValueKey('profile_privacy_notice')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.byType(PrivacyNoticePage), findsOneWidget);
    },
  );

  testWidgets(
    'Change password row opens the change password screen',
    (tester) async {
      await _pumpProfileTab(tester);

      await tester.tap(find.byKey(const ValueKey('profile_change_password')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.byType(ChangePasswordPage), findsOneWidget);
    },
  );

  testWidgets(
    'About section shows the pubspec app version',
    (tester) async {
      await _pumpProfileTab(tester);

      expect(find.text('App version'), findsOneWidget);
      expect(find.text('9.9.9'), findsOneWidget);
    },
  );

  testWidgets(
    'unauthenticated user cannot reach /patient-profile',
    (tester) async {
      SharedPreferences.setMockInitialValues(const {});
      PackageInfo.setMockInitialValues(
        appName: 'FindMyDoctor',
        packageName: 'com.example.mobile',
        version: '9.9.9',
        buildNumber: '42',
        buildSignature: 'test-signature',
      );
      // Same fake-async channel caveat as in _pumpProfileTab: without the
      // mock handler MyApp never leaves the startup splash in tests.
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        PushNotificationService.channel,
        (call) async => null,
      );

      await tester.pumpWidget(const MyApp());
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // Guarded route: the unauthenticated request is bounced to login.
      final navigator = tester.state<NavigatorState>(
        find.byType(Navigator).first,
      );
      // Do NOT await: pushNamed only settles once the pushed route is popped.
      navigator.pushNamed('/patient-profile');
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(LoginPage), findsOneWidget);
      expect(find.byType(PatientProfilePage), findsNothing);
    },
  );
}
