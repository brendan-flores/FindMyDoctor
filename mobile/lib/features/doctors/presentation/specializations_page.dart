import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';

class SpecializationsPage extends StatefulWidget {
  final List<String> specialties;
  final String? selectedSpecialty;
  final ValueChanged<String>? onSpecialtySelected;

  const SpecializationsPage({
    super.key,
    required this.specialties,
    this.selectedSpecialty,
    this.onSpecialtySelected,
  });

  @override
  State<SpecializationsPage> createState() => _SpecializationsPageState();
}

class _SpecializationsPageState extends State<SpecializationsPage> {
  IconData _getSpecialtyIcon(String specialty) {
    switch (specialty) {
      case 'Cardiology':
        return Icons.favorite;
      case 'Pediatrics':
        return Icons.child_care;
      case 'Dermatology':
        return Icons.face;
      case 'Dentistry':
        return Icons.mood;
      case 'Orthopedics':
        return Icons.accessibility;
      case 'OB-GYN':
        return Icons.pregnant_woman;
      case 'Ophthalmology':
        return Icons.visibility;
      default:
        return Icons.medical_services;
    }
  }

  Color _getSpecialtyColor(String specialty) {
    switch (specialty) {
      case 'Cardiology':
        return AppColors.errorContainer;
      case 'Pediatrics':
        return AppColors.secondaryFixed;
      case 'Dermatology':
        return AppColors.primaryFixed;
      case 'Dentistry':
        return AppColors.surfaceContainerHigh;
      case 'Orthopedics':
        return AppColors.surfaceContainerHigh;
      case 'OB-GYN':
        return AppColors.tertiaryFixed;
      case 'Ophthalmology':
        return AppColors.surfaceVariant;
      default:
        return AppColors.surfaceContainerLowest;
    }
  }

  Color _getSpecialtyIconColor(String specialty) {
    switch (specialty) {
      case 'Cardiology':
        return AppColors.onErrorContainer;
      case 'Pediatrics':
        return AppColors.onSecondaryFixed;
      case 'Dermatology':
        return AppColors.onPrimaryFixed;
      case 'Dentistry':
        return AppColors.primary;
      case 'Orthopedics':
        return AppColors.onSecondaryFixed;
      case 'OB-GYN':
        return AppColors.onTertiaryFixed;
      case 'Ophthalmology':
        return AppColors.onPrimaryContainer;
      default:
        return AppColors.onSurface;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Specializations'),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.screenPadding,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              'Choose a specialty',
              style: AppTextStyles.headlineSm.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.1,
                  crossAxisSpacing: spacing.AppSpacing.gutterMd,
                  mainAxisSpacing: spacing.AppSpacing.gutterMd,
                ),
                itemCount: widget.specialties.length,
                itemBuilder: (context, index) {
                  final specialty = widget.specialties[index];
                  final isSelected = widget.selectedSpecialty == specialty;
                  return _buildSpecialtyCard(specialty, isSelected);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpecialtyCard(String specialty, bool isSelected) {
    return GestureDetector(
      onTap: () {
        widget.onSpecialtySelected?.call(specialty);
        Navigator.of(context).pop(specialty);
      },
      child: Container(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.1)
              : AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
          border: Border.all(
            color: isSelected
                ? AppColors.primary
                : AppColors.outline.withValues(alpha: 0.2),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary
                    : _getSpecialtyColor(specialty),
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusMd,
                ),
              ),
              child: Icon(
                _getSpecialtyIcon(specialty),
                color: isSelected
                    ? AppColors.onPrimary
                    : _getSpecialtyIconColor(specialty),
                size: spacing.AppSpacing.iconLg,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              specialty,
              textAlign: TextAlign.center,
              style: AppTextStyles.labelMd.copyWith(
                color: isSelected
                    ? AppColors.primary
                    : AppColors.onSurface,
                fontWeight: FontWeight.normal,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}