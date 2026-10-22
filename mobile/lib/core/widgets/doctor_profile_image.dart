import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;

class DoctorProfileImage extends StatelessWidget {
  final String? photoUrl;
  final double size;
  final bool showVerifiedBadge;

  const DoctorProfileImage({
    super.key,
    this.photoUrl,
    this.size = 64,
    this.showVerifiedBadge = true,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: AppColors.surfaceContainer,
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            boxShadow: [
              BoxShadow(
                color: AppColors.slate800.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            child: photoUrl != null && photoUrl!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: photoUrl!,
                    fit: BoxFit.cover,
                    width: size,
                    height: size,
                    placeholder: (context, url) => Center(
                      child: Icon(
                        Icons.person,
                        color: AppColors.outline,
                        size: size * 0.5,
                      ),
                    ),
                    errorWidget: (context, url, error) => Center(
                      child: Icon(
                        Icons.person,
                        color: AppColors.outline,
                        size: size * 0.5,
                      ),
                    ),
                    fadeInDuration: const Duration(milliseconds: 300),
                  )
                : Center(
                    child: Icon(
                      Icons.person,
                      color: AppColors.outline,
                      size: size * 0.5,
                    ),
                  ),
          ),
        ),
        if (showVerifiedBadge)
          Positioned(
            bottom: -4,
            right: -4,
            child: Container(
              width: size * 0.25,
              height: size * 0.25,
              decoration: BoxDecoration(
                color: AppColors.tertiary,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.surface, width: 2),
              ),
              child: Icon(
                Icons.verified,
                color: AppColors.onTertiary,
                size: size * 0.2,
              ),
            ),
          ),
      ],
    );
  }
}
