import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/services/api_service.dart';
import '../../payments/presentation/payment_screen.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  final ApiService _apiService = ApiService();
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final response = await _apiService.getNotifications();
      if (!mounted) return;
      final items = <Map<String, dynamic>>[];
      if (response['success'] == true && response['data'] is List) {
        for (final item in response['data'] as List) {
          if (item is Map) {
            items.add(Map<String, dynamic>.from(item));
          }
        }
      }
      setState(() {
        _notifications = items;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _notifications = [];
        _isLoading = false;
      });
    }
  }

  Future<void> _markAsRead(String notificationId) async {
    try {
      await _apiService.markNotificationRead(notificationId);
      if (!mounted) return;
      setState(() {
        _notifications = _notifications.map((n) {
          if (n['id'] == notificationId) {
            final updated = Map<String, dynamic>.from(n);
            updated['is_read'] = true;
            return updated;
          }
          return n;
        }).toList();
      });
    } catch (_) {
      // Silently fail - user can try again
    }
  }

  Future<void> _markAllAsRead() async {
    try {
      await _apiService.markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        _notifications = _notifications.map((n) {
          final updated = Map<String, dynamic>.from(n);
          updated['is_read'] = true;
          return updated;
        }).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All notifications marked as read')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to mark all as read')),
      );
    }
  }

  String _formatTimestamp(String? timestamp) {
    if (timestamp == null) return '';
    final dateTime = DateTime.parse(timestamp);
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        elevation: 0,
        actions: [
          if (!_isLoading && _notifications.any((n) => n['is_read'] == false))
            TextButton.icon(
              onPressed: _markAllAsRead,
              icon: const Icon(Icons.mark_email_read),
              label: const Text('Read all'),
            ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_notifications.isEmpty)
                SizedBox(
                  height: MediaQuery.of(context).size.height - 200,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.notifications_outlined,
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
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadNotifications,
                    child: ListView.builder(
                      itemCount: _notifications.length,
                      itemBuilder: (context, index) {
                        final notification = _notifications[index];
                        final isRead = notification['is_read'] == true;
                        final message = notification['message'] ?? '';
                        final type = notification['type']?.toString();
                        final isPaymentNotification = type == 'ADDITIONAL_CHARGE_ADDED' || type == 'PAYMENT_VERIFIED' || type == 'PAYMENT_REJECTED';

                        return Card(
                          margin: EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
                          color: isRead ? AppColors.surface : AppColors.surfaceLow,
                          child: InkWell(
                            onTap: () async {
                              if (!isRead) {
                                await _markAsRead(notification['id']);
                              }

                              // Handle payment-related notifications - navigate to payment details
                              if (isPaymentNotification) {
                                final paymentId = notification['related_entity_id']?.toString();
                                if (paymentId != null && paymentId.isNotEmpty) {
                                  try {
                                    final paymentResponse = await _apiService.getPaymentById(paymentId);
                                    if (paymentResponse['success'] == true && paymentResponse['data'] != null) {
                                      final paymentData = paymentResponse['data'];
                                      final appointmentId = paymentData['appointment_id']?.toString();
                                      if (appointmentId != null && mounted) {
                                        Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder: (context) => PaymentScreen(
                                              appointmentId: appointmentId,
                                            ),
                                          ),
                                        );
                                      }
                                    }
                                  } catch (e) {
                                    // Silently fail - notification remains marked as read
                                  }
                                }
                              }
                            },
                            child: Padding(
                              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          notification['title'] ?? 'Notification',
                                          style: AppTextStyles.bodyMdMedium.copyWith(
                                            fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                      if (!isRead)
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: BoxDecoration(
                                            color: AppColors.error,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                                  Text(
                                    message,
                                    style: AppTextStyles.labelSm.copyWith(
                                      color: AppColors.secondary,
                                    ),
                                    maxLines: isPaymentNotification ? 8 : 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (isPaymentNotification)
                                    Padding(
                                      padding: EdgeInsets.only(top: spacing.AppSpacing.gutterXs),
                                      child: Text(
                                        'Tap to view details',
                                        style: AppTextStyles.labelSm.copyWith(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                                  Text(
                                    _formatTimestamp(notification['created_at']),
                                    style: AppTextStyles.labelSm.copyWith(
                                      color: AppColors.outline,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
