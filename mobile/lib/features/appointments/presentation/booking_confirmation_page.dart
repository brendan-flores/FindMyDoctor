import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/primary_button.dart';

class BookingConfirmationPage extends StatelessWidget {
  const BookingConfirmationPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Padding(
                  padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: spacing.AppSpacing.gutterMd),
                      _buildHeader(context),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildSuccessMessage(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildQueueSlip(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildSecretaryChat(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildLocationCard(),
                      const SizedBox(height: spacing.AppSpacing.gutter3xl),
                    ],
                  ),
                ),
              ),
            ),
            _buildBottomButton(context),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back),
          constraints: const BoxConstraints(),
          padding: EdgeInsets.zero,
        ),
        const SizedBox(width: 40), // Spacer for balance
      ],
    );
  }

  Widget _buildSuccessMessage() {
    return Column(
      children: [
        Center(
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primaryFixed,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.slate800.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(
              Icons.check_circle,
              color: AppColors.primary,
              size: 36,
            ),
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        Text(
          'Appointment Confirmed!',
          style: AppTextStyles.headlineMd.copyWith(
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildQueueSlip() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top banner
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(spacing.AppSpacing.radiusLg),
                topRight: Radius.circular(spacing.AppSpacing.radiusLg),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLowest.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                      ),
                      child: Icon(
                        Icons.local_hospital,
                        color: AppColors.onPrimary,
                        size: spacing.AppSpacing.iconMd,
                      ),
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CareFlow Verified Slip',
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.primaryFixed.withValues(alpha: 0.9),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'CLINIC QUEUE PASS',
                          style: AppTextStyles.headlineSm.copyWith(
                            color: AppColors.onPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterSm,
                        vertical: spacing.AppSpacing.gutterXs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primaryFixed,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                      ),
                      child: Text(
                        'Oct 21, 2025',
                        style: AppTextStyles.labelSm.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      'Ref: FMD-SLB-8831',
                      style: AppTextStyles.labelSm.copyWith(
                        fontSize: 11,
                        color: AppColors.primaryFixed.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Doctor info
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
            ),
            child: Row(
              children: [
                Stack(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                      ),
                      child: Icon(
                        Icons.person,
                        color: AppColors.outline,
                        size: spacing.AppSpacing.iconLg,
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: AppColors.tertiaryContainer,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.check,
                          color: AppColors.onTertiaryContainer,
                          size: 9,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: spacing.AppSpacing.gutterMd),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dr. Maria Angela Santos',
                        style: AppTextStyles.bodyLgMedium,
                      ),
                      Text(
                        'Adult Cardiology & Heart Health',
                        style: AppTextStyles.bodyMd.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Text(
                        'Room 412, Medical Arts Bldg • St. Luke\'s BGC',
                        style: AppTextStyles.bodyMd.copyWith(
                          fontSize: 12,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Queue number
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            child: Column(
              children: [
                Text(
                  'Your Priority Order',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '#04',
                      style: AppTextStyles.queueNum.copyWith(
                        fontSize: 60,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterMd,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.secondaryFixed,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: spacing.AppSpacing.gutterXs),
                      Text(
                        'Serving #01 now • ~45 min estimated wait',
                        style: AppTextStyles.bodyMdMedium.copyWith(
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecretaryChat() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
      ),
      child: InkWell(
        onTap: () {
          // Launch SMS to secretary
          final Uri smsUri = Uri(
            scheme: 'sms',
            path: '09178823490',
            queryParameters: {'body': 'Hello Secretary Grace, this is Juan Michael Reyes regarding Queue #04'},
          );
          launchUrl(smsUri);
        },
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primaryFixed,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.chat,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconMd,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Clinic Secretary Grace Lim',
                        style: AppTextStyles.bodyMdMedium,
                      ),
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: AppColors.tertiaryContainer,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    'Tap to chat with secretary desk',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: AppColors.outline,
              size: spacing.AppSpacing.iconMd,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationCard() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              Icons.pin_drop,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'St. Luke\'s Medical Center - Global City',
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'Medical Arts Bldg, 4th Flr, Suite 412 • BGC, Taguig',
                  style: AppTextStyles.labelSm.copyWith(
                    fontSize: 12,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Container(
            height: 36,
            padding: EdgeInsets.symmetric(horizontal: spacing.AppSpacing.gutterSm),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.directions,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconSm,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Text(
                  'Map',
                  style: AppTextStyles.labelMd,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButton(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.95),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: PrimaryButton(
          text: 'View in Appointments',
          onPressed: () {
            Navigator.of(context).pushReplacementNamed('/home');
          },
          icon: const Icon(Icons.event_available, size: 20),
        ),
      ),
    );
  }
}
