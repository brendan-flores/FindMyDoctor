import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/services/api_service.dart';
import '../models/waitlist.dart';

class WaitlistPage extends StatefulWidget {
  final ApiService? apiService;

  const WaitlistPage({super.key, this.apiService});

  @override
  State<WaitlistPage> createState() => _WaitlistPageState();
}

class _WaitlistPageState extends State<WaitlistPage> {
  late final ApiService _apiService;
  List<Waitlist> _waitlists = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _fetchWaitlists();
  }

  Future<void> _fetchWaitlists() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getMyWaitlists();

      if (response['success'] == true) {
        final data = response['data'] ?? [];
        setState(() {
          _waitlists = (data as List).map((w) => Waitlist.fromMap(w)).toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = response['error']?['message'] ?? 'Failed to load waitlists';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load waitlists: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _leaveWaitlist(Waitlist waitlist) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Leave Waitlist'),
        content: Text('Are you sure you want to leave the waitlist for ${waitlist.doctorName} on ${_formatDate(waitlist.waitlistDate)}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final response = await _apiService.leaveWaitlist(waitlist.id);
        if (response['success'] == true) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Successfully left waitlist')),
          );
          _fetchWaitlists();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['error']?['message'] ?? 'Failed to leave waitlist')),
          );
        }
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to leave waitlist: $e')),
        );
      }
    }
  }

  String _formatDate(String dateStr) {
    final date = DateTime.tryParse(dateStr);
    if (date == null) return dateStr;
    return DateFormat('MMM dd, yyyy').format(date);
  }

  String _getTimeSince(String dateStr) {
    final date = DateTime.tryParse(dateStr);
    if (date == null) return '';
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  Future<void> _bookNow(Waitlist waitlist) async {
    Navigator.of(context).pushNamed(
      '/doctor-schedule',
      arguments: {
        'doctorId': waitlist.doctorId,
        'doctorName': waitlist.doctorName,
        'specialty': waitlist.doctorSpecialty,
        'clinic': waitlist.doctorPracticeName,
        'consultationFee': null,
        'defaultDate': waitlist.waitlistDate,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const AppHeader(showNotifications: true, showProfile: true),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchWaitlists,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildHeader(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildWaitlistList(),
                      const SizedBox(height: spacing.AppSpacing.gutter3xl),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'My Waitlists',
          style: AppTextStyles.headlineMd,
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Text(
          'Track your waitlist positions and booking offers',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.secondary,
          ),
        ),
      ],
    );
  }

  Widget _buildWaitlistList() {
    if (_isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: [
              Icon(
                Icons.error_outline,
                size: 64,
                color: AppColors.error,
              ),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.error,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _fetchWaitlists,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_waitlists.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: [
              Icon(
                Icons.hourglass_empty,
                size: 64,
                color: AppColors.outline,
              ),
              const SizedBox(height: 16),
              Text(
                'No waitlist entries',
                style: AppTextStyles.headlineSm.copyWith(
                  color: AppColors.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Join a waitlist when a doctor\'s schedule is fully booked',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: _waitlists.map((waitlist) {
        return Padding(
          padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
          child: _buildWaitlistCard(waitlist),
        );
      }).toList(),
    );
  }

  Widget _buildWaitlistCard(Waitlist waitlist) {
    Color statusColor;
    String statusText;
    String statusMessage;

    switch (waitlist.status) {
      case 'WAITING':
        statusColor = AppColors.tertiary;
        statusText = 'Waiting';
        statusMessage = 'Position #${waitlist.position}. You\'ll be notified when a slot opens.';
        break;
      case 'OFFERED':
        statusColor = AppColors.primary;
        statusText = 'You\'re Position #${waitlist.position}!';
        statusMessage = 'A slot is now available! Book within 24 hours to secure it.';
        break;
      case 'EXPIRED':
        statusColor = AppColors.error;
        statusText = 'Offer Expired';
        statusMessage = 'The offer has expired. The slot was offered to the next patient.';
        break;
      case 'CANCELLED':
        statusColor = AppColors.secondary;
        statusText = 'Cancelled';
        statusMessage = 'You left this waitlist.';
        break;
      case 'CONVERTED':
        statusColor = AppColors.tertiary;
        statusText = 'Booked';
        statusMessage = 'You successfully booked an appointment from this waitlist.';
        break;
      default:
        statusColor = AppColors.secondary;
        statusText = waitlist.status;
        statusMessage = '';
    }

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with status badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      waitlist.doctorName,
                      style: AppTextStyles.headlineSm,
                    ),
                    if (waitlist.doctorSpecialty != null)
                      Text(
                        waitlist.doctorSpecialty!,
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.secondary,
                        ),
                      ),
                  ],
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Text(
                  statusText,
                  style: AppTextStyles.labelSm.copyWith(
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Date and position
          Row(
            children: [
              Icon(
                Icons.calendar_today,
                size: spacing.AppSpacing.iconSm,
                color: AppColors.secondary,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterXs),
              Text(
                _formatDate(waitlist.waitlistDate),
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.onSurface,
                ),
              ),
              if (waitlist.isWaiting) ...[
                const SizedBox(width: spacing.AppSpacing.gutterMd),
                Icon(
                  Icons.format_list_numbered,
                  size: spacing.AppSpacing.iconSm,
                  color: AppColors.secondary,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Text(
                  'Position #${waitlist.position}',
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.onSurface,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Status message
          Text(
            statusMessage,
            style: AppTextStyles.bodySm.copyWith(
              color: AppColors.secondary,
            ),
          ),
          // Time remaining for OFFERED entries
          if (waitlist.isOffered && waitlist.expiresAt != null) ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: spacing.AppSpacing.gutterSm,
                vertical: spacing.AppSpacing.gutterXs,
              ),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.timer,
                    size: spacing.AppSpacing.iconSm,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterXs),
                  Text(
                    waitlist.getTimeRemaining(),
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Time since joined
          Text(
            'Joined ${_getTimeSince(waitlist.createdAt)}',
            style: AppTextStyles.bodySm.copyWith(
              color: AppColors.outline,
            ),
          ),
          // Book Now button for OFFERED entries
          if (waitlist.isOffered) ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _bookNow(waitlist),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                ),
                child: const Text('Book Now'),
              ),
            ),
          ],
          // Leave button for active entries (but not for OFFERED - they should book instead)
          if (waitlist.isWaiting) ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () => _leaveWaitlist(waitlist),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.error,
                  side: BorderSide(color: AppColors.error.withValues(alpha: 0.3)),
                ),
                child: const Text('Leave Waitlist'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
