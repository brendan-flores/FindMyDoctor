import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';

class AppHeader extends StatefulWidget implements PreferredSizeWidget {
  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final bool showLogo;
  final bool showBackButton;
  final VoidCallback? onBackPressed;
  final bool showNotifications;
  final bool showProfile;
  final int? unreadCount;
  /// Called when the user returns from the notifications page so the
  /// caller can refresh the unread badge.
  final VoidCallback? onUnreadCountUpdate;

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
    this.unreadCount,
    this.onUnreadCountUpdate,
  });

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  State<AppHeader> createState() => _AppHeaderState();
}

class _AppHeaderState extends State<AppHeader> {
  /// Open the notifications page. The header deliberately does not render
  /// a notifications overlay of its own; the notifications page is the
  /// single, full-page notification surface. Uses the standard page
  /// transition used across the app.
  Future<void> _handleNotificationTap() async {
    if (ModalRoute.of(context)?.settings.name == '/notifications') {
      // Already on the notifications page.
      return;
    }

    await Navigator.of(context).pushNamed('/notifications');

    if (mounted && widget.onUnreadCountUpdate != null) {
      widget.onUnreadCountUpdate!();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(
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
                if (widget.showBackButton)
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new),
                    onPressed:
                        widget.onBackPressed ?? () => Navigator.of(context).pop(),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  )
                else if (widget.leading != null)
                  widget.leading!,
                if (widget.showLogo) ...[
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Image.asset(
                    'assets/images/findmydoctor_logo.png',
                    height: 32,
                    fit: BoxFit.contain,
                  ),
                ],
                if (widget.title != null && !widget.showLogo) ...[
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Text(
                    widget.title!,
                    style: AppTextStyles.headlineSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
                const Spacer(),
                if (widget.showNotifications)
                  Stack(
                    children: [
                      IconButton(
                        key: const ValueKey('notification_bell'),
                        icon: const Icon(
                          Icons.notifications_outlined,
                          color: AppColors.onSurface,
                        ),
                        onPressed: _handleNotificationTap,
                      ),
                      if (widget.unreadCount != null && widget.unreadCount! > 0)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.error,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: AppColors.surface,
                                width: 2,
                              ),
                            ),
                            constraints: const BoxConstraints(
                              minWidth: 14,
                              minHeight: 14,
                            ),
                            child: Text(
                              widget.unreadCount! > 9
                                  ? '9+'
                                  : widget.unreadCount.toString(),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                if (widget.showProfile) ...[
                  const SizedBox(width: spacing.AppSpacing.gutterXs),
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(
                        spacing.AppSpacing.radiusFull,
                      ),
                    ),
                    child: const Icon(
                      Icons.person,
                      color: AppColors.onSurfaceVariant,
                      size: spacing.AppSpacing.iconMd,
                    ),
                  ),
                ],
                if (widget.actions != null) ...[
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  ...widget.actions!,
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}
