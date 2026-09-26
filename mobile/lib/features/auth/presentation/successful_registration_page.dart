import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import 'onboarding_page.dart';

class SuccessfulRegistrationPage extends StatelessWidget {
  const SuccessfulRegistrationPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.brandBgLight,
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(AppSpacing.screenPadding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const SizedBox(height: AppSpacing.gutter2xl),
              // Success Message Container
              _buildSuccessMessage(),
              const SizedBox(height: AppSpacing.gutter2xl),
              // Action Button Area
              _buildActionButton(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuccessMessage() {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // Concentric Circle Graphic with Checkmark
        _buildConcentricRingsBadge(),
        const SizedBox(height: AppSpacing.gutterLg),
        // Heading
        Text(
          'Registration\nSuccessful',
          style: AppTextStyles.headlineLg.copyWith(
            fontSize: 26,
            color: AppColors.brandNavy,
            height: 1.2,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.gutterMd),
        // Subtitle Description
        Text(
          'Your healthcare journey with FindMyDoctor starts here. We\'re excited to help you manage your health better.',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.slate500,
          ),
          textAlign: TextAlign.center,
          maxLines: 3,
        ),
      ],
    );
  }

  Widget _buildConcentricRingsBadge() {
    return SizedBox(
      width: 128,
      height: 128,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer Concentric Circle
          Container(
            width: 128,
            height: 128,
            decoration: BoxDecoration(
              color: AppColors.skyBlue.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
          ),
          // Middle Concentric Ring
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: AppColors.skyBlue.withValues(alpha: 0.3),
              shape: BoxShape.circle,
              border: Border.all(
                color: AppColors.skyBlue.withValues(alpha: 0.2),
                width: 4,
              ),
            ),
          ),
          // Inner Deep Blue Circle with White Checkmark
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.brandPrimary,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.brandPrimary.withValues(alpha: 0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.check,
              color: AppColors.onPrimary,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacing.gutterLg),
      child: SizedBox(
        width: 190,
        child: PrimaryButton(
          text: 'Continue',
          onPressed: () {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (context) => const OnboardingPage(forceShow: true),
              ),
            );
          },
          icon: const Icon(Icons.arrow_forward, size: 16),
          isFullWidth: true,
        ),
      ),
    );
  }
}