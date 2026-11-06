import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/json_parsers.dart';
import '../../../core/widgets/app_card.dart';

/// Live queue card for a single appointment.
///
/// Reads `GET /api/v1/queue/today/me` (the backend resolves the patient from the
/// token) and keeps itself current by polling while the screen is visible. The
/// card refreshes itself every [pollInterval] and also exposes a manual refresh
/// button.
class LiveQueueCard extends StatefulWidget {
  final String appointmentId;
  final ApiService? apiService;
  final Duration pollInterval;

  const LiveQueueCard({
    super.key,
    required this.appointmentId,
    this.apiService,
    this.pollInterval = const Duration(seconds: 30),
  });

  @override
  State<LiveQueueCard> createState() => _LiveQueueCardState();
}

class _LiveQueueCardState extends State<LiveQueueCard>
    with WidgetsBindingObserver {
  late final ApiService _apiService;
  Timer? _pollTimer;
  Map<String, dynamic>? _queueEntry;
  bool _isLoading = true;
  bool _isRefreshing = false;
  String? _errorMessage;
  DateTime? _lastUpdated;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    WidgetsBinding.instance.addObserver(this);
    _loadQueue();
    _startPolling();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadQueue();
      _startPolling();
    } else {
      _pollTimer?.cancel();
    }
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(widget.pollInterval, (_) {
      if (!_isRefreshing && _isLoading == false) {
        _loadQueue(isBackgroundRefresh: true);
      }
    });
  }

  /// Stops the timer once the visit is over - nothing left to poll.
  bool get _isQueueFinished {
    final status = parseString(_queueEntry?['queueStatus']);
    return status == 'COMPLETED' ||
        status == 'CANCELLED' ||
        status == 'NO_SHOW';
  }

  Future<void> _loadQueue({bool isBackgroundRefresh = false}) async {
    if (!isBackgroundRefresh) {
      setState(() {
        _isLoading = _queueEntry == null;
        _isRefreshing = true;
        _errorMessage = null;
      });
    }

    try {
      final response = await _apiService.getMyQueueToday();
      if (!mounted) return;

      if (response['success'] == true) {
        final data = response['data'];
        final queues = (data is Map ? data['queues'] : null) as List? ?? [];

        Map<String, dynamic>? match;
        for (final item in queues) {
          if (item is Map &&
              item['appointmentId']?.toString() == widget.appointmentId) {
            match = Map<String, dynamic>.from(item);
            break;
          }
        }

        setState(() {
          _queueEntry = match;
          _isLoading = false;
          _isRefreshing = false;
          _errorMessage = null;
          _lastUpdated = DateTime.now();
        });

        if (_isQueueFinished) {
          _pollTimer?.cancel();
        }
      } else {
        setState(() {
          _isLoading = false;
          _isRefreshing = false;
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load queue status';
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _isRefreshing = false;
        _errorMessage = 'Failed to load queue status';
      });
    }
  }

  String _formatStatus(String? status) {
    switch (status) {
      case 'WAITING':
        return 'Waiting';
      case 'CALLED':
        return 'You are being called';
      case 'IN_CHECKUP':
        return 'In consultation';
      case 'COMPLETED':
        return 'Completed';
      case 'NOT_PRESENT':
        return 'Marked not present';
      case 'SKIPPED':
        return 'Skipped';
      case 'NO_SHOW':
        return 'No show';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return 'Waiting';
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'CALLED':
        return AppColors.primary;
      case 'IN_CHECKUP':
        return const Color(0xFF9333EA);
      case 'COMPLETED':
        return AppColors.brandAccentBlue;
      case 'CANCELLED':
      case 'NO_SHOW':
        return AppColors.error;
      case 'NOT_PRESENT':
      case 'SKIPPED':
        return AppColors.urgentAmber;
      default:
        return AppColors.tertiary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.confirmation_number_outlined,
                size: spacing.AppSpacing.iconMd,
                color: AppColors.primary,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Text(
                'Live Queue',
                style: AppTextStyles.labelMd.copyWith(
                  color: AppColors.secondary,
                ),
              ),
              const Spacer(),
              IconButton(
                tooltip: 'Refresh queue',
                visualDensity: VisualDensity.compact,
                onPressed: _isRefreshing ? null : () => _loadQueue(),
                icon: _isRefreshing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh, size: 20),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_errorMessage != null)
            _buildMessage(_errorMessage!, AppColors.error, Icons.error_outline)
          else if (_queueEntry == null)
            _buildMessage(
              'No queue for today yet. Your queue number appears here on your appointment day.',
              AppColors.secondary,
              Icons.event_available,
            )
          else
            _buildQueueDetails(_queueEntry!),
          if (_lastUpdated != null && _queueEntry != null) ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              'Updated ${DateFormat('h:mm a').format(_lastUpdated!)} • refreshes automatically',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.outline,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMessage(String message, Color color, IconData icon) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: spacing.AppSpacing.gutterMd),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: spacing.AppSpacing.iconMd, color: color),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Text(
              message,
              style: AppTextStyles.bodySm.copyWith(color: color),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQueueDetails(Map<String, dynamic> entry) {
    final queueNumber = parseInt(entry['queueNumber']);
    final status = parseString(entry['queueStatus']);
    final nowServing = parseInt(entry['nowServing']);
    final patientsAhead = parseInt(entry['patientsAhead']) ?? 0;
    final estimatedWait = parseInt(entry['estimatedWaitMinutes']) ?? 0;
    final doctorName = parseString(entry['doctorName']);
    final roomNumber = parseString(entry['roomNumber']);
    final statusColor = _statusColor(status);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusMd,
                ),
              ),
              child: Center(
                child: Text(
                  queueNumber != null ? '#$queueNumber' : '#--',
                  style: AppTextStyles.queueNum.copyWith(
                    fontSize: 22,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterSm,
                      vertical: spacing.AppSpacing.gutterXs,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(
                        spacing.AppSpacing.radiusFull,
                      ),
                    ),
                    child: Text(
                      _formatStatus(status),
                      style: AppTextStyles.labelSm.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (doctorName != null) ...[
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(doctorName, style: AppTextStyles.bodyMdMedium),
                  ],
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        Container(
          padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
          decoration: BoxDecoration(
            color: AppColors.surfaceLow,
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildStat(
                'Now serving',
                nowServing != null ? '#$nowServing' : '—',
              ),
              _buildDivider(),
              _buildStat(
                'Ahead of you',
                '$patientsAhead ${patientsAhead == 1 ? 'patient' : 'patients'}',
              ),
              _buildDivider(),
              _buildStat(
                'Est. wait',
                estimatedWait > 0 ? '$estimatedWait min' : 'Ready soon',
              ),
            ],
          ),
        ),
        if (roomNumber != null && roomNumber.isNotEmpty) ...[
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Row(
            children: [
              Icon(
                Icons.meeting_room,
                size: spacing.AppSpacing.iconSm,
                color: AppColors.secondary,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterXs),
              Text(
                'Room $roomNumber',
                style: AppTextStyles.labelSm.copyWith(
                  color: AppColors.secondary,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildStat(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: AppTextStyles.labelSm.copyWith(
            color: AppColors.secondary,
            fontSize: 11,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: AppTextStyles.bodyMdMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1,
      height: 28,
      color: AppColors.surfaceContainerHighest,
    );
  }
}
