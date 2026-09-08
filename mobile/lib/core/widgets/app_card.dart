import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final double? elevation;
  final double? borderRadius;
  final Border? border;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.backgroundColor,
    this.elevation,
    this.borderRadius,
    this.border,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      margin: margin,
      padding: padding ?? EdgeInsets.all(spacing.AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(borderRadius ?? spacing.AppSpacing.radiusLg),
        border: border ?? Border.all(color: AppColors.slate200),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(borderRadius ?? spacing.AppSpacing.radiusLg),
        child: card,
      );
    }

    return card;
  }
}
