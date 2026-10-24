import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_header.dart';

/// Simple static privacy notice for the patient Profile "About" section.
///
/// The copy mirrors what the platform actually does today: account data,
/// booking records, and payment receipts are stored by the clinic system;
/// push notifications only carry appointment and message alerts. There is no
/// third-party ad tracking in this app.
class PrivacyNoticePage extends StatelessWidget {
  const PrivacyNoticePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          AppHeader(
            title: 'Privacy Notice',
            showBackButton: true,
            onBackPressed: () => Navigator.of(context).pop(),
            showNotifications: false,
            showProfile: false,
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    Text(
                      'Your privacy',
                      style: AppTextStyles.headlineLg.copyWith(
                        color: AppColors.brandNavy,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    Text(
                      'Last updated: October 2026',
                      style: AppTextStyles.bodySm.copyWith(
                        color: AppColors.outline,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildParagraph(
                      'Sign-up and profile. FindMyDoctor stores the details '
                      'you provide — your name, email, mobile number, date of '
                      'birth, sex, address, and any medical information you '
                      'share with a clinic — so clinic staff can prepare for '
                      'your visits. Only your clinic and its authorized staff '
                      'can see your records.',
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    _buildParagraph(
                      'Bookings and payments. Your appointment history and '
                      'payment receipts are kept so the clinic can verify '
                      'payments and you can review past visits. You always '
                      'pay the clinic or its cashier directly; the app never '
                      'holds your money or your card details.',
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    _buildParagraph(
                      'Notifications. We use device push notifications only '
                      'for appointment updates and message alerts. You can '
                      'turn them off for this device at any time from the '
                      'Profile screen, and they are unlinked from your '
                      'account when you log out.',
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    _buildParagraph(
                      'AI assistant. Messages you send to the in-app assistant '
                      'are used to answer your questions and are not shared '
                      'with other users.',
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    _buildParagraph(
                      'Your choices. You can view your data on this profile '
                      'screen and correct it with your clinic\'s front desk. '
                      'Logging out only ends your session; your records stay '
                      'with your clinic. To request deletion of your account '
                      'or records, contact the clinic directly.',
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutter3xl),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildParagraph(String text) {
    return Text(
      text,
      style: AppTextStyles.bodyMd.copyWith(
        color: AppColors.onSurface,
        height: 1.5,
      ),
    );
  }
}
