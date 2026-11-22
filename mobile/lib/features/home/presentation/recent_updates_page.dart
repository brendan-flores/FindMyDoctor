import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/app_card.dart';

class RecentUpdatesPage extends StatefulWidget {
  final ApiService? apiService;

  const RecentUpdatesPage({super.key, this.apiService});

  @override
  State<RecentUpdatesPage> createState() => _RecentUpdatesPageState();
}
class _RecentUpdatesPageState extends State<RecentUpdatesPage> {
  late final ApiService _apiService;
  List<Map<String, dynamic>> _updates = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _loadUpdates();
  }

  Future<void> _loadUpdates() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getNotifications();
      if (!mounted) return;

      if (response['success'] == true && response['data'] is List) {
        final items = <Map<String, dynamic>>[];
        for (final item in response['data'] as List) {
          if (item is Map) {
            final type = item['type'] as String?;
            if (type == 'APPOINTMENT_CREATED' ||
                type == 'APPOINTMENT_UPDATED' ||
                type == 'APPOINTMENT_CANCELLED' ||
                type == 'APPOINTMENT_REMINDER' ||
                type == 'PRESCRIPTION_READY' ||
                type == 'PRESCRIPTION_UPDATED' ||
                type == 'PAYMENT_VERIFIED' ||
                type == 'PAYMENT_REJECTED' ||
                type == 'PAYMENT_PENDING') {
              items.add(Map<String, dynamic>.from(item));
            }
          }
        }

        items.sort((a, b) {
          final dateA = DateTime.tryParse(a['created_at']?.toString() ?? '') ??
              DateTime.now();
          final dateB = DateTime.tryParse(b['created_at']?.toString() ?? '') ??
              DateTime.now();
          return dateB.compareTo(dateA);
        });

        setState(() {
          _updates = items;
          _isLoading = false;
          _errorMessage = null;
        });
      } else {
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load updates';
          _isLoading = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to load updates. Check your connection.';
        _isLoading = false;
      });
    }
  }
  IconData _getUpdateIcon(String? type) {
    switch (type) {
      case 'APPOINTMENT_CREATED':
      case 'APPOINTMENT_UPDATED':
      case 'APPOINTMENT_CANCELLED':
      case 'APPOINTMENT_REMINDER':
        return Icons.event;
      case 'PRESCRIPTION_READY':
      case 'PRESCRIPTION_UPDATED':
        return Icons.medication;
      case 'PAYMENT_VERIFIED':
      case 'PAYMENT_REJECTED':
      case 'PAYMENT_PENDING':
        return Icons.payment;
      default:
        return Icons.notifications_outlined;
    }
  }

  Color _getUpdateColor(String? type) {
    switch (type) {
      case 'APPOINTMENT_CREATED':
      case 'APPOINTMENT_UPDATED':
      case 'APPOINTMENT_CANCELLED':
      case 'APPOINTMENT_REMINDER':
        return AppColors.primary;
      case 'PRESCRIPTION_READY':
      case 'PRESCRIPTION_UPDATED':
        return AppColors.tertiary;
      case 'PAYMENT_VERIFIED':
      case 'PAYMENT_REJECTED':
      case 'PAYMENT_PENDING':
        return AppColors.secondary;
      default:
        return AppColors.onSurfaceVariant;
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

  String _groupHeader(DateTime dateTime) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final updateDate = DateTime(dateTime.year, dateTime.month, dateTime.day);

    if (updateDate == today) return 'Today';
    if (updateDate == yesterday) return 'Yesterday';

    final months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return months[dateTime.month - 1] + ' ' + dateTime.day.toString();
  }
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Recent Updates'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        elevation: 0,
        centerTitle: false,
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              if (_isLoading)
                Expanded(
                  child: ListView.builder(
                    itemCount: 6,
                    itemBuilder: (context, index) => _buildUpdateSkeleton(),
                  ),
                )
              else if (_errorMessage != null)
                SizedBox(
                  height: MediaQuery.of(context).size.height - 200,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.cloud_off,
                          size: 64,
                          color: AppColors.error,
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterMd),
                        Text(
                          _errorMessage!,
                          style: AppTextStyles.bodyMd.copyWith(
                            color: AppColors.error,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterMd),
                        OutlinedButton.icon(
                          onPressed: _loadUpdates,
                          icon: const Icon(Icons.refresh),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_updates.isEmpty)
                SizedBox(
                  height: MediaQuery.of(context).size.height - 200,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.notifications_none,
                          size: 64,
                          color: AppColors.secondary,
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterMd),
                        Text(
                          "You're All Caught Up!",
                          style: AppTextStyles.bodyMdMedium.copyWith(
                            color: AppColors.onSurface,
                          ),
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterSm),
                        Text(
                          'There are no recent healthcare updates to display.',
                          style: AppTextStyles.bodySm.copyWith(
                            color: AppColors.onSurfaceVariant,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              else
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadUpdates,
                    child: ListView.builder(
                      itemCount: _updates.length,
                      itemBuilder: (context, index) => _buildUpdateRow(context, index),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
  Widget _buildUpdateRow(BuildContext context, int index) {
    final update = _updates[index];
    final createdAtStr = update['created_at']?.toString();
    final createdAt = createdAtStr != null
        ? DateTime.tryParse(createdAtStr)?.toLocal()
        : null;

    String? groupHeader;
    if (index == 0 || createdAt == null) {
      groupHeader = createdAt != null ? _groupHeader(createdAt) : null;
    } else {
      final prevStr = _updates[index - 1]['created_at']?.toString();
      final prevDate = prevStr != null
          ? DateTime.tryParse(prevStr)?.toLocal()
          : null;
      if (prevDate != null && createdAt != null) {
        final currKey =
            createdAt.year.toString() +
            '-' +
            createdAt.month.toString() +
            '-' +
            createdAt.day.toString();
        final prevKey =
            prevDate.year.toString() +
            '-' +
            prevDate.month.toString() +
            '-' +
            prevDate.day.toString();
        if (currKey != prevKey) {
          groupHeader = _groupHeader(createdAt);
        }
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (groupHeader != null) ...[
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Padding(
            padding: EdgeInsets.only(left: spacing.AppSpacing.gutterSm),
            child: Text(
              groupHeader,
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                fontSize: 12,
              ),
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
        ],
        _buildUpdateItem(update),
      ],
    );
  }

  Widget _buildUpdateItem(Map<String, dynamic> update) {
    final type = update['type'] as String?;
    final title = update['title'] as String? ?? 'Update';
    final message = update['message'] as String? ?? '';
    final createdAtStr = update['created_at']?.toString();
    final createdAt = createdAtStr != null
        ? DateTime.tryParse(createdAtStr)?.toLocal()
        : null;

    final iconData = _getUpdateIcon(type);
    final iconColor = _getUpdateColor(type);

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      onTap: () => _handleUpdateTap(context, update),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              iconData,
              color: iconColor,
              size: spacing.AppSpacing.iconMd,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (message.isNotEmpty) ...[
                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                  Text(
                    message,
                    style: AppTextStyles.bodySm.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                if (createdAt != null) ...[
                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                  Text(
                    _formatTimestamp(createdAt.toIso8601String()),
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.secondary,
                    ),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                ],
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right,
            color: AppColors.outline,
            size: spacing.AppSpacing.iconSm,
          ),
        ],
      ),
    );
  }

  void _handleUpdateTap(BuildContext context, Map<String, dynamic> update) {
    final type = update['type'] as String?;

    switch (type) {
      case 'APPOINTMENT_CREATED':
      case 'APPOINTMENT_UPDATED':
      case 'APPOINTMENT_CANCELLED':
      case 'APPOINTMENT_REMINDER':
        Navigator.of(context).pushNamed('/appointments');
        break;
      case 'PRESCRIPTION_READY':
      case 'PRESCRIPTION_UPDATED':
        Navigator.of(context).pushNamed('/medical-records');
        break;
      case 'PAYMENT_VERIFIED':
      case 'PAYMENT_REJECTED':
      case 'PAYMENT_PENDING':
        Navigator.of(context).pushNamed('/payments');
        break;
      default:
        break;
    }
  }

  Widget _buildUpdateSkeleton() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 120,
                  height: 14,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Container(
                  width: 200,
                  height: 11,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(4),
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