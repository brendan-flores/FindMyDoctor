import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/services/api_service.dart';
import '../models/notification.dart' as notif_model;

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final ApiService _apiService = ApiService();
  List<notif_model.Notification> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final response = await _apiService.getNotifications();
      if (response['success'] == true && response['data'] != null) {
        final List<dynamic> data = response['data'];
        final notifications = data.map((json) => notif_model.Notification.fromJson(json)).toList();
        if (!mounted) return;
        setState(() {
          _notifications = notifications;
          _isLoading = false;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _notifications = [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _notifications = [];
        _isLoading = false;
      });
    }
  }

  Future<void> _markAsRead(notif_model.Notification notification) async {
    try {
      await _apiService.markNotificationAsRead(notification.id);
      if (!mounted) return;
      setState(() {
        final index = _notifications.indexWhere((n) => n.id == notification.id);
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
    } catch (e) {
      // Silently fail - notification will remain unread
    }
  }

  void _handleNotificationTap(notif_model.Notification notification) {
    // Mark as read when tapped
    if (!notification.isRead) {
      _markAsRead(notification);
    }

    // Navigate based on notification type
    if (notification.isPaymentRelated) {
      // Navigate to home with appointments tab (payments are accessed via appointments)
      Navigator.of(context).pushNamed('/home', arguments: {'initialTab': 2});
    } else if (notification.isMessageRelated) {
      // Navigate to chat screen
      Navigator.of(context).pushNamed('/home', arguments: {'initialTab': 3});
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
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const AppHeader(showNotifications: true, showProfile: true),
          Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    Text(
                      'Notifications',
                      style: AppTextStyles.headlineLg,
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    if (_isLoading)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.all(32.0),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    else if (_notifications.isEmpty)
                      SizedBox(
                        height: MediaQuery.of(context).size.height - 300,
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.notifications_none,
                                size: 64,
                                color: AppColors.secondary,
                              ),
                              const SizedBox(height: spacing.AppSpacing.gutterMd),
                              Text(
                                'No notifications',
                                style: AppTextStyles.bodyMd.copyWith(
                                  color: AppColors.secondary,
                                ),
                              ),
                              const SizedBox(height: spacing.AppSpacing.gutterSm),
                              Text(
                                'You\'re all caught up!',
                                style: AppTextStyles.labelSm.copyWith(
                                  color: AppColors.outline,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ..._notifications.map((notification) => _buildNotificationCard(notification)),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(notif_model.Notification notification) {
    return AppCard(
      onTap: () => _handleNotificationTap(notification),
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Type badge
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.gutterSm,
              vertical: spacing.AppSpacing.gutterXs,
            ),
            decoration: BoxDecoration(
              color: _getTypeBadgeColor(notification.type).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Text(
              _getTypeBadgeText(notification.type),
              style: AppTextStyles.labelSm.copyWith(
                color: _getTypeBadgeColor(notification.type),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          // Notification content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: AppTextStyles.bodyMdMedium.copyWith(
                          fontWeight: notification.isRead
                              ? FontWeight.w500
                              : FontWeight.w700,
                        ),
                      ),
                    ),
                    if (!notification.isRead)
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  notification.message,
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  _formatTimestamp(notification.createdAt),
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.outline,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
