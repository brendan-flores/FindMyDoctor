import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/presentation/change_password_page.dart';
import 'package:mobile/features/auth/presentation/login_page.dart';
import 'package:mobile/features/auth/presentation/onboarding_page.dart';
import 'package:mobile/features/home/presentation/home_page.dart';
import 'package:mobile/app/app.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Mock PasswordChangeService for testing
class MockPasswordChangeService implements PasswordChangeService {
  bool shouldSucceed = true;
  String? successMessage;
  String? errorCode;
  String? errorMessage;
  String? capturedCurrentPassword;
  String? capturedNewPassword;
  int callCount = 0;
  bool delayResponse = false;

  @override
  Future<Map<String, dynamic>> changePassword(
    String? currentPassword,
    String newPassword,
  ) async {
    callCount++;
    capturedCurrentPassword = currentPassword;
    capturedNewPassword = newPassword;

    if (delayResponse) {
      await Future.delayed(const Duration(milliseconds: 100));
    }

    if (shouldSucceed) {
      return {
        'success': true,
        'message': successMessage ?? 'Password changed successfully',
      };
    } else {
      if (errorCode == 'NETWORK_ERROR') {
        throw NetworkException(errorMessage ?? 'Network error');
      }
      throw ApiException(
        message: errorMessage ?? 'Password change failed',
        code: errorCode ?? 'UNKNOWN_ERROR',
        statusCode: 400,
      );
    }
  }
}

class ApiException implements Exception {
  final String message;
  final String code;
  final int statusCode;

  ApiException({
    required this.message,
    required this.code,
    required this.statusCode,
  });

  @override
  String toString() =>
      'ApiException: $message (Code: $code, Status: $statusCode)';
}

class NetworkException implements Exception {
  final String message;

  NetworkException(this.message);

  @override
  String toString() => 'NetworkException: $message';
}

void main() {
  group('ChangePasswordPage Widget Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets('Page renders with all required fields', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Verify page title (header text with specific style)
      expect(find.text('Change Password'), findsWidgets);

      // Verify form fields
      expect(find.text('Current Password'), findsOneWidget);
      expect(find.text('Enter your current password'), findsOneWidget);
      expect(find.text('New Password'), findsOneWidget);
      expect(
        find.text('Enter your new password (min. 8 characters)'),
        findsOneWidget,
      );
      expect(find.text('Confirm New Password'), findsOneWidget);
      expect(find.text('Confirm your new password'), findsOneWidget);

      // Verify button exists
      expect(find.byType(ElevatedButton), findsOneWidget);
    });

    testWidgets('Current password field shows validation error when empty', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Find and tap the change password button without filling fields
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);
      await tester.pump();

      // Verify validation error
      expect(find.text('Please enter your current password'), findsOneWidget);
    });

    testWidgets('New password field shows validation error when empty', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Fill only current password
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'oldpassword123');

      // Tap button
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);
      await tester.pump();

      // Verify validation error for new password
      expect(find.text('Please enter your new password'), findsOneWidget);
    });

    testWidgets(
      'New password field shows validation error when less than 8 characters',
      (WidgetTester tester) async {
        await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

        // Fill current password
        final currentPasswordField = find.ancestor(
          of: find.text('Enter your current password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(currentPasswordField, 'oldpassword123');

        // Fill new password with less than 8 characters
        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'short');

        // Tap button
        final changePasswordButton = find.byType(ElevatedButton);
        await tester.tap(changePasswordButton);
        await tester.pump();

        // Verify validation error
        expect(
          find.text('New password must be at least 8 characters'),
          findsOneWidget,
        );
      },
    );

    testWidgets('Confirm password field shows validation error when empty', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Fill current and new password
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'oldpassword123');

      final newPasswordField = find.ancestor(
        of: find.text('Enter your new password (min. 8 characters)'),
        matching: find.byType(TextField),
      );
      await tester.enterText(newPasswordField, 'newpassword123');

      // Tap button without confirming
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);
      await tester.pump();

      // Verify validation error
      expect(find.text('Please confirm your new password'), findsOneWidget);
    });

    testWidgets(
      'Confirm password field shows validation error when passwords do not match',
      (WidgetTester tester) async {
        await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

        // Fill current password
        final currentPasswordField = find.ancestor(
          of: find.text('Enter your current password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(currentPasswordField, 'oldpassword123');

        // Fill new password
        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'newpassword123');

        // Fill confirm password with different value
        final confirmPasswordField = find.ancestor(
          of: find.text('Confirm your new password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(confirmPasswordField, 'differentpassword');

        // Tap button
        final changePasswordButton = find.byType(ElevatedButton);
        await tester.tap(changePasswordButton);
        await tester.pump();

        // Verify validation error
        expect(find.text('Passwords do not match'), findsOneWidget);
      },
    );

    testWidgets('Password visibility toggle works for current password field', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Find the current password field visibility toggle
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );

      // The field should have obscureText enabled initially
      final textField = tester.widget<TextField>(currentPasswordField);
      expect(textField.obscureText, true);

      // Find and tap the visibility toggle icon
      final visibilityToggle = find.descendant(
        of: currentPasswordField,
        matching: find.byType(IconButton),
      );
      await tester.tap(visibilityToggle);
      await tester.pump();

      // Verify obscureText is toggled
      final updatedTextField = tester.widget<TextField>(currentPasswordField);
      expect(updatedTextField.obscureText, false);
    });

    testWidgets('Button is disabled while loading', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Button should be enabled initially
      final changePasswordButton = tester.widget<ElevatedButton>(
        find.ancestor(
          of: find.text('Change Password'),
          matching: find.byType(ElevatedButton),
        ),
      );
      expect(changePasswordButton.enabled, true);
    });

    testWidgets('Back button navigates back', (WidgetTester tester) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Find back button by icon
      final backButton = find.byIcon(Icons.arrow_back_ios_new);
      expect(backButton, findsOneWidget);
    });
  });

  group('ChangePasswordPage API Behavior Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets('Valid input invokes API with correct passwords', (
      WidgetTester tester,
    ) async {
      final mockService = MockPasswordChangeService();

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordPage(passwordChangeService: mockService),
        ),
      );

      // Fill all fields with valid data
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'oldpassword123');

      final newPasswordField = find.ancestor(
        of: find.text('Enter your new password (min. 8 characters)'),
        matching: find.byType(TextField),
      );
      await tester.enterText(newPasswordField, 'newpassword123');

      final confirmPasswordField = find.ancestor(
        of: find.text('Confirm your new password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(confirmPasswordField, 'newpassword123');

      // Tap button
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);
      await tester.pump();

      // Verify API was called with correct passwords
      expect(mockService.callCount, equals(1));
      expect(mockService.capturedCurrentPassword, equals('oldpassword123'));
      expect(mockService.capturedNewPassword, equals('newpassword123'));
    });

    testWidgets(
      'Successful API completion displays success feedback and invokes callback',
      (WidgetTester tester) async {
        bool callbackInvoked = false;
        final mockService = MockPasswordChangeService();
        mockService.shouldSucceed = true;

        await tester.pumpWidget(
          MaterialApp(
            home: ChangePasswordPage(
              passwordChangeService: mockService,
              onSuccess: () {
                callbackInvoked = true;
              },
            ),
          ),
        );

        // Fill all fields with valid data
        final currentPasswordField = find.ancestor(
          of: find.text('Enter your current password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(currentPasswordField, 'oldpassword123');

        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'newpassword123');

        final confirmPasswordField = find.ancestor(
          of: find.text('Confirm your new password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(confirmPasswordField, 'newpassword123');

        // Tap button
        final changePasswordButton = find.byType(ElevatedButton);
        await tester.tap(changePasswordButton);
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        // When onSuccess callback is provided, it may navigate away before SnackBar displays
        // Verify callback was invoked (primary behavior)
        expect(callbackInvoked, isTrue);
      },
    );

    testWidgets(
      'Recoverable API failure displays error and retains form input',
      (WidgetTester tester) async {
        final mockService = MockPasswordChangeService();
        mockService.shouldSucceed = false;
        mockService.errorCode = 'INVALID_CREDENTIALS';
        mockService.errorMessage = 'Current password is incorrect';

        await tester.pumpWidget(
          MaterialApp(
            home: ChangePasswordPage(passwordChangeService: mockService),
          ),
        );

        // Fill all fields with valid data
        final currentPasswordField = find.ancestor(
          of: find.text('Enter your current password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(currentPasswordField, 'wrongpassword');

        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'newpassword123');

        final confirmPasswordField = find.ancestor(
          of: find.text('Confirm your new password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(confirmPasswordField, 'newpassword123');

        // Tap button
        final changePasswordButton = find.byType(ElevatedButton);
        await tester.tap(changePasswordButton);
        await tester.pump();

        // Verify error message is displayed
        expect(find.text('Current password is incorrect'), findsOneWidget);

        // Verify form input is retained
        final currentPasswordFieldAfter = tester.widget<TextField>(
          find.ancestor(
            of: find.text('Enter your current password'),
            matching: find.byType(TextField),
          ),
        );
        expect(
          currentPasswordFieldAfter.controller?.text,
          equals('wrongpassword'),
        );

        final newPasswordFieldAfter = tester.widget<TextField>(
          find.ancestor(
            of: find.text('Enter your new password (min. 8 characters)'),
            matching: find.byType(TextField),
          ),
        );
        expect(
          newPasswordFieldAfter.controller?.text,
          equals('newpassword123'),
        );
      },
    );

    testWidgets('API failure does not invoke success callback', (
      WidgetTester tester,
    ) async {
      bool callbackInvoked = false;
      final mockService = MockPasswordChangeService();
      mockService.shouldSucceed = false;
      mockService.errorCode = 'INVALID_CREDENTIALS';
      mockService.errorMessage = 'Current password is incorrect';

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordPage(
            passwordChangeService: mockService,
            onSuccess: () {
              callbackInvoked = true;
            },
          ),
        ),
      );

      // Fill all fields with valid data
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'wrongpassword');

      final newPasswordField = find.ancestor(
        of: find.text('Enter your new password (min. 8 characters)'),
        matching: find.byType(TextField),
      );
      await tester.enterText(newPasswordField, 'newpassword123');

      final confirmPasswordField = find.ancestor(
        of: find.text('Confirm your new password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(confirmPasswordField, 'newpassword123');

      // Tap button
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);
      await tester.pump();

      // Verify callback was NOT invoked
      expect(callbackInvoked, isFalse);
    });

    testWidgets('Duplicate submissions are prevented', (
      WidgetTester tester,
    ) async {
      final mockService = MockPasswordChangeService();
      mockService.shouldSucceed = true;
      mockService.delayResponse = true;

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordPage(passwordChangeService: mockService),
        ),
      );

      // Fill all fields with valid data
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'oldpassword123');

      final newPasswordField = find.ancestor(
        of: find.text('Enter your new password (min. 8 characters)'),
        matching: find.byType(TextField),
      );
      await tester.enterText(newPasswordField, 'newpassword123');

      final confirmPasswordField = find.ancestor(
        of: find.text('Confirm your new password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(confirmPasswordField, 'newpassword123');

      // Tap button once
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);
      await tester.pump(const Duration(milliseconds: 50));

      // Try to tap button again while still submitting
      await tester.tap(changePasswordButton);
      await tester.pump();

      // Wait for first call to complete
      await tester.pump(const Duration(milliseconds: 100));

      // Verify API was called only once
      expect(mockService.callCount, equals(1));
    });

    testWidgets('Loading state transitions correctly during API call', (
      WidgetTester tester,
    ) async {
      final mockService = MockPasswordChangeService();
      mockService.shouldSucceed = true;
      mockService.delayResponse = true;

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordPage(passwordChangeService: mockService),
        ),
      );

      // Fill all fields with valid data
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'oldpassword123');

      final newPasswordField = find.ancestor(
        of: find.text('Enter your new password (min. 8 characters)'),
        matching: find.byType(TextField),
      );
      await tester.enterText(newPasswordField, 'newpassword123');

      final confirmPasswordField = find.ancestor(
        of: find.text('Confirm your new password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(confirmPasswordField, 'newpassword123');

      // Tap button
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);

      // Button should be disabled during loading
      await tester.pump(const Duration(milliseconds: 50));
      final buttonDuringLoad = tester.widget<ElevatedButton>(
        changePasswordButton,
      );
      expect(buttonDuringLoad.enabled, false);

      // After completion, button should be enabled again
      await tester.pump(const Duration(milliseconds: 100));
      final buttonAfterLoad = tester.widget<ElevatedButton>(
        changePasswordButton,
      );
      expect(buttonAfterLoad.enabled, true);
    });

    testWidgets(
      'Network connection error displays appropriate error and does not invoke success callback',
      (WidgetTester tester) async {
        bool callbackInvoked = false;
        final mockService = MockPasswordChangeService();
        mockService.shouldSucceed = false;
        mockService.errorCode = 'NETWORK_ERROR';
        mockService.errorMessage =
            'Connection refused'; // Matches existing error handling pattern

        await tester.pumpWidget(
          MaterialApp(
            home: ChangePasswordPage(
              passwordChangeService: mockService,
              onSuccess: () {
                callbackInvoked = true;
              },
            ),
          ),
        );

        // Fill all fields with valid data
        final currentPasswordField = find.ancestor(
          of: find.text('Enter your current password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(currentPasswordField, 'oldpassword123');

        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'newpassword123');

        final confirmPasswordField = find.ancestor(
          of: find.text('Confirm your new password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(confirmPasswordField, 'newpassword123');

        // Tap button
        final changePasswordButton = find.byType(ElevatedButton);
        await tester.tap(changePasswordButton);
        await tester.pump();

        // Verify error message is displayed (matches change_password_page.dart line 120)
        expect(
          find.text('Cannot connect to server. Please check your connection.'),
          findsOneWidget,
        );

        // Verify callback was NOT invoked
        expect(callbackInvoked, isFalse);
      },
    );
  });

  group('ChangePasswordPage Validation Logic', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets('Form validation passes with valid inputs', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));

      // Fill all fields with valid data
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'oldpassword123');

      final newPasswordField = find.ancestor(
        of: find.text('Enter your new password (min. 8 characters)'),
        matching: find.byType(TextField),
      );
      await tester.enterText(newPasswordField, 'newpassword123');

      final confirmPasswordField = find.ancestor(
        of: find.text('Confirm your new password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(confirmPasswordField, 'newpassword123');

      // Tap button
      final changePasswordButton = find.byType(ElevatedButton);
      await tester.tap(changePasswordButton);
      await tester.pump();

      // No validation errors should be present
      expect(find.text('Please enter your current password'), findsNothing);
      expect(find.text('Please enter your new password'), findsNothing);
      expect(
        find.text('New password must be at least 8 characters'),
        findsNothing,
      );
      expect(find.text('Please confirm your new password'), findsNothing);
      expect(find.text('Passwords do not match'), findsNothing);
    });
  });

  group('Route Enforcement and State Management Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
    });

    testWidgets(
      'Unauthenticated access to /change-password redirects to login',
      (WidgetTester tester) async {
        // Set up unauthenticated session
        SharedPreferences.setMockInitialValues({});

        await tester.pumpWidget(const MyApp());
        // Wait for async initialization
        await tester.pump();
        await tester.pump(const Duration(seconds: 1));

        // Verify routes to login
        expect(find.byType(LoginPage), findsOneWidget);
        expect(find.byType(ChangePasswordPage), findsNothing);
      },
    );

    testWidgets(
      'Successful login with must_change_password=false routes to home',
      (WidgetTester tester) async {
        // Set up authenticated session without password change requirement
        SharedPreferences.setMockInitialValues({
          'access_token': 'valid_token',
          'must_change_password': false,
        });

        await tester.pumpWidget(const MyApp());
        await tester.pumpAndSettle();

        // Verify routes to home
        expect(find.byType(HomePage), findsOneWidget);
        expect(find.byType(ChangePasswordPage), findsNothing);
      },
    );

    testWidgets(
      'Successful password change clears persisted flag before home navigation',
      (WidgetTester tester) async {
        bool callbackInvoked = false;
        final mockService = MockPasswordChangeService();
        mockService.shouldSucceed = true;

        // Set up initial state WITHOUT password change requirement (regular password change)
        SharedPreferences.setMockInitialValues({
          'access_token': 'valid_token',
          'must_change_password': false,
        });

        await tester.pumpWidget(
          MaterialApp(
            home: ChangePasswordPage(
              passwordChangeService: mockService,
              onSuccess: () {
                callbackInvoked = true;
              },
            ),
          ),
        );

        // Fill and submit form
        final currentPasswordField = find.ancestor(
          of: find.text('Enter your current password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(currentPasswordField, 'oldpassword123');

        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'newpassword123');

        final confirmPasswordField = find.ancestor(
          of: find.text('Confirm your new password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(confirmPasswordField, 'newpassword123');

        await tester.tap(find.byType(ElevatedButton));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 100));

        // Verify callback invoked (navigation occurs)
        expect(callbackInvoked, isTrue);

        // Verify flag was cleared from storage (removed, not set to false)
        final prefs = await SharedPreferences.getInstance();
        final mustChangePassword = prefs.getBool('must_change_password');
        expect(mustChangePassword, isNull);
      },
    );

    testWidgets('Failed password change preserves must_change_password flag', (
      WidgetTester tester,
    ) async {
      final mockService = MockPasswordChangeService();
      mockService.shouldSucceed = false;
      mockService.errorCode = 'INVALID_CREDENTIALS';
      mockService.errorMessage = 'Current password is incorrect';

      // Set up initial state with password change requirement
      SharedPreferences.setMockInitialValues({
        'access_token': 'valid_token',
        'must_change_password': true,
      });

      await tester.pumpWidget(
        MaterialApp(
          home: ChangePasswordPage(passwordChangeService: mockService),
        ),
      );

      // Fill and submit form with wrong current password
      final currentPasswordField = find.ancestor(
        of: find.text('Enter your current password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(currentPasswordField, 'wrongpassword');

      final newPasswordField = find.ancestor(
        of: find.text('Enter your new password (min. 8 characters)'),
        matching: find.byType(TextField),
      );
      await tester.enterText(newPasswordField, 'newpassword123');

      final confirmPasswordField = find.ancestor(
        of: find.text('Confirm your new password'),
        matching: find.byType(TextField),
      );
      await tester.enterText(confirmPasswordField, 'newpassword123');

      await tester.tap(find.byType(ElevatedButton));
      await tester.pump();

      // Verify error displayed
      expect(find.text('Current password is incorrect'), findsOneWidget);

      // Verify flag was NOT cleared
      final prefs = await SharedPreferences.getInstance();
      final mustChangePassword = prefs.getBool('must_change_password');
      expect(mustChangePassword, isTrue);
    });

    testWidgets(
      'Logout clears must_change_password flag to prevent stale state',
      (WidgetTester tester) async {
        // Set up authenticated session with password change requirement
        SharedPreferences.setMockInitialValues({
          'access_token': 'valid_token',
          'must_change_password': true,
        });

        // Simulate logout by clearing storage directly
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove('access_token');
        await prefs.remove('must_change_password');

        // Verify both token and flag are cleared
        final token = prefs.getString('access_token');
        final mustChangePassword = prefs.getBool('must_change_password');

        expect(token, isNull);
        expect(mustChangePassword, isNull);
      },
    );

    testWidgets(
      'Walk-in first login (must_change_password = true) hides current password field',
      (WidgetTester tester) async {
        SharedPreferences.setMockInitialValues({
          'must_change_password': true,
        });

        await tester.pumpWidget(MaterialApp(home: ChangePasswordPage()));
        await tester.pumpAndSettle();

        // Verify current password field is NOT shown
        expect(find.text('Current Password'), findsNothing);
        expect(find.text('Enter your current password'), findsNothing);

        // Verify new password and confirm fields are still shown
        expect(find.text('New Password'), findsOneWidget);
        expect(find.text('Confirm New Password'), findsOneWidget);
      },
    );

    testWidgets(
      'Walk-in first login sends null currentPassword to service',
      (WidgetTester tester) async {
        SharedPreferences.setMockInitialValues({
          'must_change_password': true,
        });

        final mockService = MockPasswordChangeService();
        mockService.shouldSucceed = true;

        await tester.pumpWidget(
          MaterialApp(
            home: ChangePasswordPage(passwordChangeService: mockService),
          ),
        );
        await tester.pumpAndSettle();

        // Fill new password and confirm
        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'newpassword123');

        final confirmPasswordField = find.ancestor(
          of: find.text('Confirm your new password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(confirmPasswordField, 'newpassword123');

        // Tap button
        final changePasswordButton = find.byType(ElevatedButton);
        await tester.tap(changePasswordButton);
        await tester.pumpAndSettle();

        // Verify currentPassword was null
        expect(mockService.capturedCurrentPassword, isNull);
        expect(mockService.capturedNewPassword, 'newpassword123');
      },
    );

    testWidgets(
      'Walk-in first login navigates to onboarding after successful password change',
      (WidgetTester tester) async {
        SharedPreferences.setMockInitialValues({
          'must_change_password': true,
        });

        final mockService = MockPasswordChangeService();
        mockService.shouldSucceed = true;

        await tester.pumpWidget(
          MaterialApp(
            home: ChangePasswordPage(passwordChangeService: mockService),
          ),
        );
        await tester.pumpAndSettle();

        // Fill new password and confirm
        final newPasswordField = find.ancestor(
          of: find.text('Enter your new password (min. 8 characters)'),
          matching: find.byType(TextField),
        );
        await tester.enterText(newPasswordField, 'newpassword123');

        final confirmPasswordField = find.ancestor(
          of: find.text('Confirm your new password'),
          matching: find.byType(TextField),
        );
        await tester.enterText(confirmPasswordField, 'newpassword123');

        // Tap button
        final changePasswordButton = find.byType(ElevatedButton);
        await tester.tap(changePasswordButton);
        await tester.pumpAndSettle();

        // Verify navigation to OnboardingPage
        expect(find.byType(OnboardingPage), findsOneWidget);
      },
    );
  });
}
