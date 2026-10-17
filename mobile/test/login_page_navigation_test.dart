import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/models/user.dart';
import 'package:mobile/features/auth/presentation/login_page.dart';
import 'package:mobile/features/auth/presentation/change_password_page.dart';
import 'package:mobile/features/home/presentation/home_page.dart';
import 'package:mobile/core/widgets/custom_text_field.dart';
import 'package:mobile/core/widgets/primary_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Mock login service for testing
class MockLoginService implements LoginService {
  final bool mustChangePassword;
  final bool shouldSucceed;
  final String? errorMessage;

  MockLoginService({
    this.mustChangePassword = false,
    this.shouldSucceed = true,
    this.errorMessage,
  });

  @override
  Future<Map<String, dynamic>> login(String email, String password) async {
    await Future.delayed(
      const Duration(milliseconds: 100),
    ); // Simulate network delay

    if (!shouldSucceed) {
      return {
        'success': false,
        'error': {'message': errorMessage ?? 'Login failed'},
      };
    }

    return {
      'success': true,
      'data': {
        'accessToken': 'test-token-123',
        'user': {
          'id': 'user-123',
          'email': email,
          'role': 'PATIENT',
          'mustChangePassword': mustChangePassword,
        },
      },
    };
  }
}

void main() {
  group('User Model mustChangePassword Tests', () {
    test('User model correctly parses mustChangePassword field', () {
      // Arrange
      final jsonWithTrue = {
        'id': 'user-123',
        'email': 'test@example.com',
        'role': 'PATIENT',
        'mustChangePassword': true,
      };

      final jsonWithFalse = {
        'id': 'user-456',
        'email': 'test2@example.com',
        'role': 'PATIENT',
        'mustChangePassword': false,
      };

      // Act
      final userWithTrue = User.fromJson(jsonWithTrue);
      final userWithFalse = User.fromJson(jsonWithFalse);

      // Assert
      expect(userWithTrue.mustChangePassword, isTrue);
      expect(userWithFalse.mustChangePassword, isFalse);
    });

    test('User model defaults mustChangePassword to false when missing', () {
      // Arrange
      final jsonWithoutField = {
        'id': 'user-789',
        'email': 'test3@example.com',
        'role': 'PATIENT',
      };

      // Act
      final user = User.fromJson(jsonWithoutField);

      // Assert
      expect(user.mustChangePassword, isFalse);
    });
  });

  group('LoginPage Behavioral Widget Tests', () {
    setUp(() async {
      // Initialize SharedPreferences for each test
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets(
      'Login with mustChangePassword=true navigates to change-password page',
      (WidgetTester tester) async {
        // Arrange
        final mockService = MockLoginService(mustChangePassword: true);

        await tester.pumpWidget(
          MaterialApp(
            home: LoginPage(loginService: mockService),
            routes: {
              '/change-password': (context) => const ChangePasswordPage(),
              '/home': (context) => const HomePage(),
            },
          ),
        );

        // Find email and password fields
        final emailField = find.widgetWithText(
          CustomTextField,
          'Email or Username',
        );
        final passwordField = find.widgetWithText(CustomTextField, 'Password');
        final loginButton = find.widgetWithText(PrimaryButton, 'Log In');

        // Act - Enter credentials and submit
        await tester.enterText(emailField, 'test@example.com');
        await tester.enterText(passwordField, 'oldpassword123');
        await tester.tap(loginButton);
        await tester.pumpAndSettle(const Duration(seconds: 2));

        // Assert - Verify navigation to change-password page
        expect(find.byType(ChangePasswordPage), findsOneWidget);
        expect(find.byType(LoginPage), findsNothing);
      },
    );

    testWidgets('Login with mustChangePassword=false navigates to home page', (
      WidgetTester tester,
    ) async {
      // Arrange
      final mockService = MockLoginService(mustChangePassword: false);

      await tester.pumpWidget(
        MaterialApp(
          home: LoginPage(loginService: mockService),
          routes: {
            '/change-password': (context) => const ChangePasswordPage(),
            '/home': (context) => const HomePage(),
          },
        ),
      );

      // Find email and password fields
      final emailField = find.widgetWithText(
        CustomTextField,
        'Email or Username',
      );
      final passwordField = find.widgetWithText(CustomTextField, 'Password');
      final loginButton = find.widgetWithText(PrimaryButton, 'Log In');

      // Act - Enter credentials and submit
      await tester.enterText(emailField, 'test@example.com');
      await tester.enterText(passwordField, 'password123');
      await tester.tap(loginButton);
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Assert - Verify navigation to home page
      expect(find.byType(HomePage), findsOneWidget);
      expect(find.byType(LoginPage), findsNothing);
    });

    testWidgets('Login shows error message on failed login', (
      WidgetTester tester,
    ) async {
      // Arrange
      final mockService = MockLoginService(
        shouldSucceed: false,
        errorMessage: 'Invalid credentials',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: LoginPage(loginService: mockService),
          routes: {
            '/change-password': (context) => const ChangePasswordPage(),
            '/home': (context) => const HomePage(),
          },
        ),
      );

      // Find email and password fields
      final emailField = find.widgetWithText(
        CustomTextField,
        'Email or Username',
      );
      final passwordField = find.widgetWithText(CustomTextField, 'Password');
      final loginButton = find.widgetWithText(PrimaryButton, 'Log In');

      // Act - Enter invalid credentials and submit
      await tester.enterText(emailField, 'invalid@example.com');
      await tester.enterText(passwordField, 'wrongpassword');
      await tester.tap(loginButton);
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Assert - Verify error message is shown and user stays on login page
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.byType(LoginPage), findsOneWidget);
      expect(find.byType(HomePage), findsNothing);
      expect(find.byType(ChangePasswordPage), findsNothing);
    });

    testWidgets('Login validates required fields before submission', (
      WidgetTester tester,
    ) async {
      // Arrange
      final mockService = MockLoginService();

      await tester.pumpWidget(
        MaterialApp(
          home: LoginPage(loginService: mockService),
          routes: {
            '/change-password': (context) => const ChangePasswordPage(),
            '/home': (context) => const HomePage(),
          },
        ),
      );

      final loginButton = find.widgetWithText(PrimaryButton, 'Log In');

      // Act - Submit without entering credentials
      await tester.tap(loginButton);
      await tester.pump();

      // Assert - Verify validation errors are shown
      expect(find.text('Please enter your email or username'), findsOneWidget);
      expect(find.text('Please enter your password'), findsOneWidget);
      expect(find.byType(LoginPage), findsOneWidget);
    });
  });

  group('ChangePasswordPage Route Registration Test', () {
    testWidgets('/change-password route resolves to ChangePasswordPage', (
      WidgetTester tester,
    ) async {
      // Arrange
      await tester.pumpWidget(
        MaterialApp(
          initialRoute: '/change-password',
          routes: {
            '/change-password': (context) => const ChangePasswordPage(),
            '/home': (context) => const HomePage(),
          },
        ),
      );

      // Assert - Verify ChangePasswordPage is displayed
      expect(find.byType(ChangePasswordPage), findsOneWidget);
    });
  });
}
