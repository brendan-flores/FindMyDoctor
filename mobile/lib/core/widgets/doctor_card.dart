import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';
import 'app_card.dart';
import 'doctor_profile_image.dart';
import '../models/doctor.dart';

String formatConsultationFee(Doctor doctor) {
  final amount = doctor.consultationFee > 0
      ? doctor.consultationFee.round()
      : 1000;
  final digits = amount.toString();
  final buffer = StringBuffer('₱');
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) {
      buffer.write(',');
    }
    buffer.write(digits[i]);
  }
  return buffer.toString();
}

class InfoTag extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String label;
  final String labelSuffix;
  final Color bgColor;

  const InfoTag({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.label,
    this.labelSuffix = '',
    required this.bgColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterSm,
        vertical: spacing.AppSpacing.gutterXs,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            icon,
            color: iconColor,
            size: 14,
            weight: 700,
          ),
          const SizedBox(width: 4),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: label,
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.onSurface,
                    fontSize: 10,
                  ),
                ),
                if (labelSuffix.isNotEmpty)
                  TextSpan(
                    text: labelSuffix,
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.onSurfaceVariant,
                      fontWeight: FontWeight.normal,
                      fontSize: 10,
                    ),
                  ),
              ],
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class DoctorCard extends StatelessWidget {
  final Doctor doctor;

  const DoctorCard({super.key, required this.doctor});

  @override
  Widget build(BuildContext context) {
    final location = doctor.clinicName;
    final displayName = doctor.middleName != null && doctor.middleName!.isNotEmpty
        ? 'Dr. ${doctor.firstName} ${doctor.middleName} ${doctor.lastName}'
        : 'Dr. ${doctor.firstName} ${doctor.lastName}';

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DoctorProfileImage(
                photoUrl: doctor.professionalPhotoUrl,
                size: 64,
                showVerifiedBadge: doctor.isApproved,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerLeft,
                            child: Text(
                              displayName,
                              style: AppTextStyles.headlineSm.copyWith(
                                color: AppColors.onSurface,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                                height: 1.2,
                              ),
                              maxLines: 1,
                              softWrap: false,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      doctor.specialty,
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        height: 1.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2.0),
                    Text(
                      location,
                      style: AppTextStyles.bodyMd.copyWith(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        height: 1.2,
                      ),
                      softWrap: true,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            children: [
              InfoTag(
                icon: Icons.payments,
                iconColor: AppColors.primary,
                label: formatConsultationFee(doctor),
                labelSuffix: ' / consult',
                bgColor: AppColors.surfaceContainerHigh,
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    Navigator.of(context).pushNamed(
                      '/doctor-profile',
                      arguments: {'doctorId': doctor.id},
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: BorderSide(color: AppColors.primary),
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterSm,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        spacing.AppSpacing.radiusLg,
                      ),
                    ),
                  ),
                  child: const Text(
                    'View Profile',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(context).pushNamed(
                      '/doctor-schedule',
                      arguments: {
                        'doctorId': doctor.id,
                        'doctorName': doctor.fullName,
                        'specialty': doctor.specialty,
                        'clinic': doctor.practiceName,
                        'consultationFee': doctor.consultationFee.toString(),
                        'professionalPhotoUrl': doctor.professionalPhotoUrl,
                      },
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.onPrimary,
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterSm,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(
                        spacing.AppSpacing.radiusLg,
                      ),
                    ),
                  ),
                  child: const Text(
                    'Book Visit',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}