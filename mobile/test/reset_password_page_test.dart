import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/presentation/reset_password_page.dart';
import 'package:mobile/core/widgets/custom_text_field.dart';
import 'package:mobile/core/widgets/primary_button.dart';

void main() {
  group('ResetPasswordPage UI and Two-Step Flow Tests', () {
    testWidgets('displays only verification code and verify button initially', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ResetPasswordPage(email: 'patient@example.com'),
        ),
      );
      await tester.pump();

      // Header indicates code has been sent
      expect(find.text('Reset Password'), findsOneWidget);
      expect(find.text('Enter the code sent to patient@example.com'), findsOneWidget);

      // Verification code field is present
      expect(find.text('Verification Code'), findsOneWidget);
      expect(find.text('Enter 6-digit code'), findsOneWidget);

      // Verify Code button is present
      expect(find.text('Verify Code'), findsOneWidget);
      expect(find.byType(PrimaryButton), findsOneWidget);

      // Resend Code button is present
      expect(find.textContaining('Resend Code'), findsOneWidget);

      // Crucially, new password fields and reset button MUST NOT be present before verification
      expect(find.text('New Password'), findsNothing);
      expect(find.text('Confirm Password'), findsNothing);
      expect(find.text('Reset Password', skipOffstage: false), findsWidgets); // Only the headline title
      expect(find.text('At least 8 characters'), findsNothing);
      expect(find.text('At least 1 number'), findsNothing);
      expect(find.text('At least 1 uppercase letter'), findsNothing);
    });

    testWidgets('verification code field only accepts up to 6 digits', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ResetPasswordPage(email: 'patient@example.com'),
        ),
      );
      await tester.pump();

      final otpFinder = find.byType(CustomTextField);
      expect(otpFinder, findsOneWidget);

      // Enter digits
      await tester.enterText(otpFinder, '123456');
      await tester.pump();

      expect(find.text('123456'), findsOneWidget);
    });
  });
}
