import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/services/api_service.dart';
import 'package:mobile/core/widgets/custom_text_field.dart';
import 'package:mobile/core/widgets/international_phone_input.dart';
import 'package:mobile/core/widgets/primary_button.dart';
import 'package:mobile/features/auth/presentation/otp_verification_page.dart';
import 'package:mobile/features/auth/presentation/signup_page.dart';

void main() {
  Future<void> pumpSignUp(
    WidgetTester tester, {
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(const MaterialApp(home: SignUpPage()));
    await tester.pumpAndSettle();
  }

  group('SignUpPage structure', () {
    testWidgets('renders separate first, middle, and last name fields', (
      tester,
    ) async {
      await pumpSignUp(tester);

      expect(
        find.widgetWithText(CustomTextField, 'First Name'),
        findsOneWidget,
      );
      expect(
        find.widgetWithText(CustomTextField, 'Middle Name (Optional)'),
        findsOneWidget,
      );
      expect(find.widgetWithText(CustomTextField, 'Last Name'), findsOneWidget);
      // The old single "Full Name" field must be gone.
      expect(find.text('Full Name'), findsNothing);
    });

    testWidgets('collects all required patient information fields', (
      tester,
    ) async {
      await pumpSignUp(tester);

      expect(
        find.widgetWithText(CustomTextField, 'Date of Birth'),
        findsOneWidget,
      );
      expect(find.text('Sex'), findsOneWidget);
      expect(find.byType(InternationalPhoneInput), findsOneWidget);
      expect(find.widgetWithText(CustomTextField, 'Address'), findsOneWidget);
    });

    testWidgets('excludes emergency and medical history fields', (
      tester,
    ) async {
      await pumpSignUp(tester);

      expect(find.textContaining('Emergency Contact'), findsNothing);
      expect(find.textContaining('Medical History'), findsNothing);
      expect(find.textContaining('Allergies'), findsNothing);
      expect(find.textContaining('Current Medications'), findsNothing);
    });

    testWidgets('retains authentication fields and the create button', (
      tester,
    ) async {
      await pumpSignUp(tester);

      expect(
        find.widgetWithText(CustomTextField, 'Email Address'),
        findsOneWidget,
      );
      expect(find.widgetWithText(CustomTextField, 'Username'), findsOneWidget);
      expect(find.widgetWithText(CustomTextField, 'Password'), findsOneWidget);
      expect(
        find.widgetWithText(CustomTextField, 'Confirm Password'),
        findsOneWidget,
      );
      expect(
        find.widgetWithText(PrimaryButton, 'Create Account'),
        findsOneWidget,
      );
    });
  });

  group('SignUpPage validation', () {
    testWidgets('shows field-specific errors when submitted empty', (
      tester,
    ) async {
      await pumpSignUp(tester);

      final createButton = find.widgetWithText(PrimaryButton, 'Create Account');
      await tester.ensureVisible(createButton);
      await tester.pumpAndSettle();
      await tester.tap(createButton);
      await tester.pumpAndSettle();

      expect(find.text('First name is required'), findsOneWidget);
      expect(find.text('Last name is required'), findsOneWidget);
      expect(find.text('Date of birth is required'), findsOneWidget);
      expect(find.text('Sex is required'), findsOneWidget);
      expect(find.text('Mobile number is required'), findsOneWidget);
      expect(find.text('Address is required'), findsOneWidget);
      expect(find.text('Please enter your email'), findsOneWidget);
      expect(find.text('Please enter a username'), findsOneWidget);
      expect(find.text('Please enter your password'), findsOneWidget);
      expect(find.text('Please confirm your password'), findsOneWidget);
      // Still on the sign-up page (no navigation attempted).
      expect(find.byType(SignUpPage), findsOneWidget);
    });

    testWidgets('rejects mismatched passwords', (tester) async {
      await pumpSignUp(tester);

      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Password'),
        'password123',
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Confirm Password'),
        'password999',
      );

      final createButton = find.widgetWithText(PrimaryButton, 'Create Account');
      await tester.ensureVisible(createButton);
      await tester.pumpAndSettle();
      await tester.tap(createButton);
      await tester.pumpAndSettle();

      expect(find.text('Passwords do not match'), findsOneWidget);
    });
  });

  group('SignUpPage sex dropdown', () {
    Finder menuOption(String label) =>
        find.descendant(of: find.byType(ListView), matching: find.text(label));

    testWidgets('opens with every option and applies the selection', (
      tester,
    ) async {
      await pumpSignUp(tester);

      // Placeholder before any selection.
      expect(find.text('Select sex'), findsOneWidget);

      final field = find.byType(DropdownButtonFormField<String>);
      await tester.ensureVisible(field);
      await tester.pumpAndSettle();
      await tester.tap(field);
      await tester.pumpAndSettle();

      // All backend values are offered with friendly labels.
      expect(menuOption('Male'), findsOneWidget);
      expect(menuOption('Female'), findsOneWidget);
      expect(menuOption('Other'), findsOneWidget);
      expect(menuOption('Prefer not to say'), findsOneWidget);

      // Nothing is selected yet, so the menu shows no check mark.
      expect(find.byIcon(Icons.check_rounded), findsNothing);

      // Select a value.
      await tester.tap(menuOption('Female'));
      await tester.pumpAndSettle();

      // The closed field reflects the selection.
      expect(find.text('Female'), findsWidgets);

      // Reopening marks the selected option with a check icon.
      await tester.ensureVisible(field);
      await tester.pumpAndSettle();
      await tester.tap(field);
      await tester.pumpAndSettle();
      expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    });
  });

  group('SignUpPage responsiveness', () {
    for (final size in const [
      Size(320, 568),
      Size(360, 640),
      Size(390, 844),
      Size(428, 926),
      Size(768, 1024),
    ]) {
      testWidgets('renders without overflow at ${size.width}x${size.height}', (
        tester,
      ) async {
        await pumpSignUp(tester, size: size);

        expect(find.byType(SignUpPage), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  });

  group('SignUpPage username availability', () {
    // Exactly the payloads the /send endpoint produces.
    const takenUsernameBody =
        '{"success":false,"error":{"code":"CONFLICT","message":"Username already taken"}}';
    const otpSentBody =
        '{"success":true,"data":null,"message":"OTP sent successfully"}';

    Future<void> pumpWithService(
      WidgetTester tester,
      ApiService apiService,
    ) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(home: SignUpPage(apiService: apiService)),
      );
      await tester.pumpAndSettle();
    }

    Future<void> fillValidForm(
      WidgetTester tester, {
      String phone = '09171234567',
    }) async {
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'First Name'),
        'Juan',
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Middle Name (Optional)'),
        'D',
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Last Name'),
        'Dela Cruz',
      );

      // Date of birth: accept the date picker's default (18 years ago).
      final dob = find.widgetWithText(CustomTextField, 'Date of Birth');
      await tester.ensureVisible(dob);
      await tester.pumpAndSettle();
      await tester.tap(dob);
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();

      // Sex dropdown.
      final sex = find.byType(DropdownButtonFormField<String>);
      await tester.ensureVisible(sex);
      await tester.pumpAndSettle();
      await tester.tap(sex);
      await tester.pumpAndSettle();
      await tester.tap(
        find.descendant(of: find.byType(ListView), matching: find.text('Male')),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.descendant(
          of: find.byType(InternationalPhoneInput),
          matching: find.byType(TextField),
        ),
        phone,
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Address'),
        'Manila',
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Email Address'),
        'patient@example.com',
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Username'),
        'juandc',
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Password'),
        'Password123',
      );
      await tester.enterText(
        find.widgetWithText(CustomTextField, 'Confirm Password'),
        'Password123',
      );

      final terms = find.byType(Checkbox);
      await tester.ensureVisible(terms);
      await tester.pumpAndSettle();
      await tester.tap(terms);
      await tester.pumpAndSettle();
    }

    Future<void> submit(WidgetTester tester) async {
      final createButton = find.widgetWithText(PrimaryButton, 'Create Account');
      await tester.ensureVisible(createButton);
      await tester.pumpAndSettle();
      await tester.tap(createButton);
      await tester.pumpAndSettle();
    }

    testWidgets('reports a taken username on the form without leaving it', (
      tester,
    ) async {
      var requestCount = 0;
      final client = MockClient((request) async {
        requestCount++;
        return http.Response(
          takenUsernameBody,
          409,
          headers: {'content-type': 'application/json'},
        );
      });

      await pumpWithService(tester, ApiService.createWithClient(client));
      await fillValidForm(tester);
      await submit(tester);

      // The backend message is surfaced verbatim (inline banner + snackbar) and
      // the user stays on the sign-up form to correct the username.
      expect(find.text('Username already taken'), findsWidgets);
      expect(find.byType(SignUpPage), findsOneWidget);
      expect(find.byType(OTPVerificationPage), findsNothing);
      expect(requestCount, 1);

      // Let the error snackbar timer finish.
      await tester.pump(const Duration(seconds: 6));
    });

    testWidgets('proceeds to OTP verification when the username is free', (
      tester,
    ) async {
      var requestCount = 0;
      final client = MockClient((request) async {
        requestCount++;
        return http.Response(
          otpSentBody,
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await pumpWithService(tester, ApiService.createWithClient(client));
      await fillValidForm(tester);
      await submit(tester);

      expect(find.byType(OTPVerificationPage), findsOneWidget);
      expect(requestCount, 1);

      // Let the OTP resend countdown finish so no timers remain pending.
      await tester.pump(const Duration(seconds: 31));
    });

    Future<(Map<String, dynamic>?, int)> captureOtpPayload(
      WidgetTester tester,
      String phone,
    ) async {
      var requests = 0;
      Map<String, dynamic>? payload;
      final client = MockClient((request) async {
        requests++;
        payload = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
          otpSentBody,
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await pumpWithService(tester, ApiService.createWithClient(client));
      await fillValidForm(tester, phone: phone);
      await submit(tester);
      return (payload, requests);
    }

    testWidgets('submits the canonical +63 number for a 09 mobile', (
      tester,
    ) async {
      final (payload, requests) = await captureOtpPayload(
        tester,
        '09171234567',
      );

      expect(requests, 1);
      expect(payload?['phone'], '+639171234567');
      expect(payload?['phone'], matches(RegExp(r'^\+63\d{10}$')));
      expect(find.byType(OTPVerificationPage), findsOneWidget);

      await tester.pump(const Duration(seconds: 31));
    });

    testWidgets('submits the canonical +63 number for an allocated 08 mobile', (
      tester,
    ) async {
      final (payload, requests) = await captureOtpPayload(
        tester,
        '08171234567',
      );

      expect(requests, 1);
      expect(payload?['phone'], '+638171234567');
      expect(payload?['phone'], matches(RegExp(r'^\+63\d{10}$')));
      expect(find.byType(OTPVerificationPage), findsOneWidget);

      await tester.pump(const Duration(seconds: 31));
    });

    testWidgets('submits the canonical +63 number for a +63 mobile', (
      tester,
    ) async {
      final (payload, requests) = await captureOtpPayload(
        tester,
        '+639171234567',
      );

      expect(requests, 1);
      expect(payload?['phone'], '+639171234567');
      expect(payload?['phone'], matches(RegExp(r'^\+63\d{10}$')));
      expect(find.byType(OTPVerificationPage), findsOneWidget);

      await tester.pump(const Duration(seconds: 31));
    });

    testWidgets('submits the canonical +63 number for a plus-less 08 mobile', (
      tester,
    ) async {
      final (payload, requests) = await captureOtpPayload(
        tester,
        '638171234567',
      );

      expect(requests, 1);
      expect(payload?['phone'], '+638171234567');
      expect(payload?['phone'], matches(RegExp(r'^\+63\d{10}$')));
      expect(find.byType(OTPVerificationPage), findsOneWidget);

      await tester.pump(const Duration(seconds: 31));
    });

    testWidgets('rejects an unallocated 08 prefix before calling the API', (
      tester,
    ) async {
      var requests = 0;
      final client = MockClient((request) async {
        requests++;
        return http.Response(
          otpSentBody,
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await pumpWithService(tester, ApiService.createWithClient(client));
      await fillValidForm(tester, phone: '08121234567');
      await submit(tester);

      expect(requests, 0);
      expect(
        find.text('Enter a valid Philippine mobile number.'),
        findsWidgets,
      );
      expect(find.byType(SignUpPage), findsOneWidget);
      expect(find.byType(OTPVerificationPage), findsNothing);
    });

    testWidgets('rejects a landline in the mobile number field', (
      tester,
    ) async {
      var requests = 0;
      final client = MockClient((request) async {
        requests++;
        return http.Response(
          otpSentBody,
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      await pumpWithService(tester, ApiService.createWithClient(client));
      await fillValidForm(tester, phone: '0281234567');
      await submit(tester);

      expect(requests, 0);
      expect(
        find.text('Enter a valid mobile number.'),
        findsWidgets,
      );
      expect(find.byType(SignUpPage), findsOneWidget);
    });

    testWidgets('surfaces malformed plus signs instead of ignoring them', (
      tester,
    ) async {
      await pumpSignUp(tester);

      await tester.enterText(
        find.descendant(
          of: find.byType(InternationalPhoneInput),
          matching: find.byType(TextField),
        ),
        '++639171234567',
      );
      await tester.pump();

      expect(
        find.text('Enter a valid mobile number.'),
        findsOneWidget,
      );

// controller retains input; validation error indicates invalidity
    });

    testWidgets('surfaces overlong input without truncating it', (
      tester,
    ) async {
      await pumpSignUp(tester);

      await tester.enterText(
        find.descendant(
          of: find.byType(InternationalPhoneInput),
          matching: find.byType(TextField),
        ),
        '091712345678',
      );
      await tester.pump();

      expect(find.text('This mobile number is too long.'), findsOneWidget);

// controller retains input; validation error indicates invalidity
    });
  });
}
