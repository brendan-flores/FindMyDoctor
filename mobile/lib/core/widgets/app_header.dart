import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final bool showLogo;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final bool showNotifications;
  final bool showProfile;

  const AppHeader({
    super.key,
    this.title,
    this.leading,
    this.actions,
    this.showLogo = true,
    this.showBackButton = false,
    this.onBackPressed,
    this.showNotifications = true,
    this.showProfile = true,
  });

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterMd,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            if (showBackButton)
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new),
                onPressed: onBackPressed ?? () => Navigator.of(context).pop(),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              )
            else if (leading != null)
              leading!,
            if (showLogo) ...[
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Image.asset(
                'assets/images/findmydoctor_logo.png',
                height: 32,
                fit: BoxFit.contain,
              ),
            ],
            if (title != null && !showLogo) ...[
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Text(
                title!,
                style: AppTextStyles.headlineSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
            const Spacer(),
            if (showNotifications)
              Stack(
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_outlined),
                    onPressed: () {},
                  ),
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        shape: BoxShape.circle,
                        border: Border.all(color: AppColors.surface, width: 2),
                      ),
                    ),
                  ),
                ],
              ),
            if (showProfile) ...[
              const SizedBox(width: spacing.AppSpacing.gutterXs),
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Icon(
                  Icons.person,
                  color: AppColors.onSurfaceVariant,
                  size: spacing.AppSpacing.iconMd,
                ),
              ),
            ],
            if (actions != null) ...[
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              ...actions!,
            ],
          ],
        ),
      ),
    );
  }
}
