import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import '../theme/app_text_styles.dart';
import '../services/api_service.dart';
import '../../features/notifications/models/notification.dart' as notif_model;

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
  final VoidCallback? onNotificationTap;
  final Function(notif_model.Notification)? onNotificationItemTap;
  final VoidCallback? onUnreadCountUpdate;
  final VoidCallback? onViewAll;
  final ApiService? apiService;

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
    this.onNotificationTap,
    this.onNotificationItemTap,
    this.onUnreadCountUpdate,
    this.onViewAll,
    this.apiService,
  });

  @override
  Size get preferredSize => const Size.fromHeight(60);

  @override
  State<AppHeader> createState() => _AppHeaderState();
}

class _AppHeaderState extends State<AppHeader> {
  late final ApiService _apiService = widget.apiService ?? ApiService();
  bool _isDropdownOpen = false;
  List<notif_model.Notification> _notifications = [];
  bool _isLoadingNotifications = false;
  final GlobalKey _dropdownKey = GlobalKey();
  double _dropdownHeight = 400;
  OverlayEntry? _overlayEntry;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _calculateDropdownHeight();
    });
  }

  @override
  void dispose() {
    _overlayEntry?.remove();
    super.dispose();
  }

  void _calculateDropdownHeight() {
    final screenHeight = MediaQuery.of(context).size.height;
    final availableHeight =
        screenHeight - 100; // Reserve space for header and bottom padding
    _dropdownHeight = availableHeight.clamp(200, 400).toDouble();
  }

  void _showDropdown() {
    _overlayEntry?.remove();
    _overlayEntry = _createOverlayEntry();
    Overlay.of(context).insert(_overlayEntry!);
    setState(() {
      _isDropdownOpen = true;
    });
    _loadNotifications();
  }

  void _closeDropdown() {
    _overlayEntry?.remove();
    _overlayEntry = null;
    setState(() {
      _isDropdownOpen = false;
    });
  }

  // The dropdown lives in an OverlayEntry, so it does not rebuild when this
  // State calls setState. Without this, the dropdown would keep showing the
  // loading spinner (or stale notifications) forever.
  void _rebuildDropdown() {
    final entry = _overlayEntry;
    if (entry != null && entry.mounted) {
      entry.markNeedsBuild();
    }
  }

  OverlayEntry _createOverlayEntry() {
    return OverlayEntry(
      builder: (context) => GestureDetector(
        onTap: _closeDropdown,
        behavior: HitTestBehavior.translucent,
        child: Container(
          color: Colors.black.withValues(alpha: 0.3),
          child: Stack(
            children: [
              Positioned(
                right: spacing.AppSpacing.screenPadding,
                top: 70, // Offset from top to account for header
                child: GestureDetector(
                  onTap: () {},
                  // The overlay is inserted above the app's Material widgets, so
                  // the dropdown needs its own Material ancestor for InkWell.
                  child: Material(
                    color: AppColors.surface,
                    elevation: 8,
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusLg,
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: SizedBox(
                      width: 320,
                      height: _dropdownHeight,
                      child: Column(
                        children: [
                          if (_isLoadingNotifications)
                            const Expanded(
                              child: Center(
                                child: Padding(
                                  padding: EdgeInsets.all(32.0),
                                  child: CircularProgressIndicator(),
                                ),
                              ),
                            )
                          else if (_notifications.isEmpty)
                            Expanded(
                              child: Center(
                                child: Padding(
                                  padding: EdgeInsets.all(
                                    spacing.AppSpacing.gutterXl,
                                  ),
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.notifications_none,
                                        size: 48,
                                        color: AppColors.secondary,
                                      ),
                                      const SizedBox(
                                        height: spacing.AppSpacing.gutterMd,
                                      ),
                                      Text(
                                        'No notifications',
                                        style: AppTextStyles.bodyMd.copyWith(
                                          color: AppColors.secondary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            )
                          else
                            Expanded(
                              child: ListView.separated(
                                padding: EdgeInsets.zero,
                                itemCount: _notifications.length,
                                separatorBuilder: (context, index) => Divider(
                                  height: 1,
                                  thickness: 1,
                                  color: AppColors.slate200,
                                ),
                                itemBuilder: (context, index) {
                                  final notification = _notifications[index];
                                  return InkWell(
                                    onTap: () {
                                      _handleNotificationItemClick(
                                        notification,
                                      );
                                      _closeDropdown();
                                    },
                                    child: Padding(
                                      padding: EdgeInsets.all(
                                        spacing.AppSpacing.gutterMd,
                                      ),
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Container(
                                            padding: EdgeInsets.symmetric(
                                              horizontal:
                                                  spacing.AppSpacing.gutterSm,
                                              vertical:
                                                  spacing.AppSpacing.gutterXs,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _getTypeBadgeColor(
                                                notification.type,
                                              ).withValues(alpha: 0.1),
                                              borderRadius:
                                                  BorderRadius.circular(
                                                    spacing.AppSpacing.radiusMd,
                                                  ),
                                            ),
                                            child: Text(
                                              _getTypeBadgeText(
                                                notification.type,
                                              ),
                                              style: AppTextStyles.labelSm
                                                  .copyWith(
                                                    color: _getTypeBadgeColor(
                                                      notification.type,
                                                    ),
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                            ),
                                          ),
                                          const SizedBox(
                                            width: spacing.AppSpacing.gutterMd,
                                          ),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  children: [
                                                    Expanded(
                                                      child: Text(
                                                        notification.title,
                                                        style: AppTextStyles
                                                            .bodyMdMedium
                                                            .copyWith(
                                                              fontWeight:
                                                                  notification
                                                                      .isRead
                                                                  ? FontWeight
                                                                        .w500
                                                                  : FontWeight
                                                                        .w700,
                                                            ),
                                                      ),
                                                    ),
                                                    if (!notification.isRead)
                                                      Container(
                                                        width: 8,
                                                        height: 8,
                                                        decoration:
                                                            BoxDecoration(
                                                              color: AppColors
                                                                  .primary,
                                                              shape: BoxShape
                                                                  .circle,
                                                            ),
                                                      ),
                                                  ],
                                                ),
                                                const SizedBox(
                                                  height: spacing
                                                      .AppSpacing
                                                      .gutterXs,
                                                ),
                                                Text(
                                                  notification.message,
                                                  style: AppTextStyles.labelSm
                                                      .copyWith(
                                                        color:
                                                            AppColors.secondary,
                                                      ),
                                                  maxLines: 2,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                ),
                                                const SizedBox(
                                                  height: spacing
                                                      .AppSpacing
                                                      .gutterXs,
                                                ),
                                                Text(
                                                  _formatTimestamp(
                                                    notification.createdAt,
                                                  ),
                                                  style: AppTextStyles.labelSm
                                                      .copyWith(
                                                        color:
                                                            AppColors.outline,
                                                      ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                          if (!_isLoadingNotifications &&
                              _notifications.isNotEmpty)
                            Container(
                              width: double.infinity,
                              padding: EdgeInsets.all(
                                spacing.AppSpacing.gutterMd,
                              ),
                              decoration: BoxDecoration(
                                border: Border(
                                  top: BorderSide(color: AppColors.slate200),
                                ),
                              ),
                              child: InkWell(
                                onTap: () {
                                  _closeDropdown();
                                  if (widget.onViewAll != null) {
                                    widget.onViewAll!();
                                  }
                                },
                                child: Text(
                                  'View All',
                                  style: AppTextStyles.labelMd.copyWith(
                                    color: AppColors.primary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loadNotifications() async {
    if (_isLoadingNotifications) return;

    setState(() {
      _isLoadingNotifications = true;
    });
    _rebuildDropdown();

    try {
      final response = await _apiService.getNotifications();
      if (response['success'] == true && response['data'] != null) {
        final List<dynamic> data = response['data'];
        final notifications = data
            .map((json) => notif_model.Notification.fromJson(json))
            .toList()
            .take(20)
            .toList();
        if (mounted) {
          setState(() {
            _notifications = notifications;
            _isLoadingNotifications = false;
          });
          _rebuildDropdown();
        }
      } else {
        if (mounted) {
          setState(() {
            _notifications = [];
            _isLoadingNotifications = false;
          });
          _rebuildDropdown();
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _notifications = [];
          _isLoadingNotifications = false;
        });
        _rebuildDropdown();
      }
    }
  }

  Future<void> _markAsRead(notif_model.Notification notification) async {
    try {
      await _apiService.markNotificationAsRead(notification.id);
      if (mounted) {
        setState(() {
          final index = _notifications.indexWhere(
            (n) => n.id == notification.id,
          );
          if (index != -1) {
            _notifications[index] = notif_model.Notification(
              id: notification.id,
              userId: notification.userId,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              isRead: true,
              createdAt: notification.createdAt,
              relatedEntityType: notification.relatedEntityType,
              relatedEntityId: notification.relatedEntityId,
            );
          }
        });
        _rebuildDropdown();
        // Notify parent to update unread count
        if (widget.onUnreadCountUpdate != null) {
          widget.onUnreadCountUpdate!();
        }
      }
    } catch (e) {
      // Silently fail - notification will remain unread
    }
  }

  void _handleNotificationTap() {
    if (widget.onNotificationTap != null) {
      widget.onNotificationTap!();
    } else {
      if (_isDropdownOpen) {
        _closeDropdown();
      } else {
        _showDropdown();
      }
    }
  }

  void _handleNotificationItemClick(notif_model.Notification notification) {
    if (!notification.isRead) {
      _markAsRead(notification);
    }

    if (widget.onNotificationItemTap != null) {
      widget.onNotificationItemTap!(notification);
    }
  }

  String _formatTimestamp(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
    }
  }

  Color _getTypeBadgeColor(String type) {
    switch (type) {
      case 'PAYMENT_VERIFIED':
        return AppColors.medicalTeal;
      case 'PAYMENT_REJECTED':
        return AppColors.error;
      case 'NEW_SECRETARY_MESSAGE':
      case 'NEW_PATIENT_MESSAGE':
        return AppColors.primary;
      default:
        return AppColors.outline;
    }
  }

  String _getTypeBadgeText(String type) {
    switch (type) {
      case 'PAYMENT_VERIFIED':
        return 'Payment';
      case 'PAYMENT_REJECTED':
        return 'Payment';
      case 'NEW_SECRETARY_MESSAGE':
        return 'Message';
      case 'NEW_PATIENT_MESSAGE':
        return 'Message';
      default:
        return 'Notification';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
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
                if (widget.showBackButton)
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new),
                    onPressed:
                        widget.onBackPressed ??
                        () => Navigator.of(context).pop(),
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
                        key: _dropdownKey,
                        icon: Icon(
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
                    child: Icon(
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
