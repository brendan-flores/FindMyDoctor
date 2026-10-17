import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/primary_button.dart';
import 'package:mobile/features/auth/presentation/otp_verification_page.dart';

void main() {
  Future<void> pumpOtp(
    WidgetTester tester, {
    Size size = const Size(390, 844),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(
        home: OTPVerificationPage(email: 'patient@example.com'),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));
  }

  // Let the 30s resend countdown finish so no timers remain pending.
  Future<void> drainCountdown(WidgetTester tester) async {
    await tester.pump(const Duration(seconds: 31));
  }

  group('OTPVerificationPage structure', () {
    testWidgets('renders brand, header, email, six boxes and actions', (
      tester,
    ) async {
      await pumpOtp(tester);

      expect(find.text('FindMyDoctor'), findsOneWidget);
      expect(find.text('PHILIPPINES'), findsOneWidget);
      expect(find.text('Verify Your Email'), findsOneWidget);
      expect(find.text('patient@example.com'), findsOneWidget);
      expect(find.byType(TextField), findsNWidgets(6));
      expect(
        find.widgetWithText(PrimaryButton, 'Verify Email'),
        findsOneWidget,
      );
      expect(find.textContaining('Resend Code in'), findsOneWidget);

      await drainCountdown(tester);
    });
  });

  group('OTPVerificationPage validation', () {
    testWidgets('shows an error when verifying with no code', (tester) async {
      await pumpOtp(tester);

      final verifyButton = find.widgetWithText(PrimaryButton, 'Verify Email');
      await tester.ensureVisible(verifyButton);
      await tester.pump();
      await tester.tap(verifyButton);
      await tester.pump();

      expect(
        find.text('Please enter a valid 6-digit OTP code'),
        findsOneWidget,
      );

      await drainCountdown(tester);
    });

    testWidgets('clears the error once the user types a digit', (tester) async {
      await pumpOtp(tester);

      final verifyButton = find.widgetWithText(PrimaryButton, 'Verify Email');
      await tester.ensureVisible(verifyButton);
      await tester.pump();
      await tester.tap(verifyButton);
      await tester.pump();
      expect(
        find.text('Please enter a valid 6-digit OTP code'),
        findsOneWidget,
      );

      await tester.enterText(find.byType(TextField).first, '7');
      await tester.pump();

      expect(find.text('Please enter a valid 6-digit OTP code'), findsNothing);

      await drainCountdown(tester);
    });
  });

  group('OTPVerificationPage resend', () {
    testWidgets('counts down then reveals the resend button', (tester) async {
      await pumpOtp(tester);

      expect(find.text('Resend Code in 30s'), findsOneWidget);

      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Resend Code in 29s'), findsOneWidget);

      // Finish the countdown; the resend action becomes available.
      await tester.pump(const Duration(seconds: 30));
      expect(find.text('Resend Code in 30s'), findsNothing);
      expect(find.text('Resend Code'), findsOneWidget);

      await drainCountdown(tester);
    });
  });

  group('OTPVerificationPage responsiveness', () {
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
        await pumpOtp(tester, size: size);

        expect(find.byType(OTPVerificationPage), findsOneWidget);
        expect(tester.takeException(), isNull);

        await drainCountdown(tester);
      });
    }
  });
}
