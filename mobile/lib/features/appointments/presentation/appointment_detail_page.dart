import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';

class AppointmentDetailPage extends StatefulWidget {
  final String appointmentId;
  final ApiService? apiService;

  const AppointmentDetailPage({
    super.key,
    required this.appointmentId,
    this.apiService,
  });

  @override
  State<AppointmentDetailPage> createState() => _AppointmentDetailPageState();
}

class _AppointmentDetailPageState extends State<AppointmentDetailPage> {
  late final ApiService _apiService;
  Map<String, dynamic>? _appointment;
  bool _isLoading = true;
  bool _isCancelling = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _fetchAppointmentDetails();
  }

  Future<void> _fetchAppointmentDetails() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getAppointmentById(widget.appointmentId);

      if (response['success'] == true) {
        setState(() {
          _appointment = response['data'];
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = response['error']?['message'] ?? 'Failed to load appointment details';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load appointment details: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _cancelAppointment() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Appointment?'),
        content: const Text('Are you sure you want to cancel this appointment? This will also cancel your queue number.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isCancelling = true;
    });

    try {
      final response = await _apiService.cancelAppointment(widget.appointmentId);

      if (response['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Appointment cancelled successfully')),
          );
          Navigator.pop(context, true); // Return true to indicate refresh needed
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['error']?['message'] ?? 'Failed to cancel appointment'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to cancel appointment: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isCancelling = false;
        });
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'SCHEDULED':
        return AppColors.tertiary;
      case 'CONFIRMED':
        return AppColors.primary;
      case 'IN_PROGRESS':
        return const Color(0xFF9333EA); // Purple
      case 'COMPLETED':
        return AppColors.brandAccentBlue;
      case 'CANCELLED':
        return AppColors.error;
      case 'NO_SHOW':
        return AppColors.urgentAmber;
      default:
        return AppColors.secondary;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'SCHEDULED':
        return Icons.calendar_today;
      case 'CONFIRMED':
        return Icons.check_circle;
      case 'IN_PROGRESS':
        return Icons.access_time;
      case 'COMPLETED':
        return Icons.done_all;
      case 'CANCELLED':
        return Icons.cancel;
      case 'NO_SHOW':
        return Icons.event_busy;
      default:
        return Icons.help_outline;
    }
  }

  String _formatStatus(String status) {
    switch (status) {
      case 'SCHEDULED':
        return 'Scheduled';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No Show';
      default:
        return status;
    }
  }

  String _formatQueueStatus(String? queueStatus) {
    if (queueStatus == null) return 'Not Available';
    switch (queueStatus) {
      case 'WAITING':
        return 'Waiting';
      case 'CALLED':
        return 'Called';
      case 'NOT_PRESENT':
        return 'Not Present';
      case 'SKIPPED':
        return 'Skipped';
      case 'IN_CHECKUP':
        return 'In Checkup';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No Show';
      default:
        return queueStatus;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? _buildErrorView()
                : _appointment != null
                    ? _buildContentView()
                    : const Center(child: Text('No appointment data')),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
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
              onPressed: _fetchAppointmentDetails,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContentView() {
    final appointment = _appointment!;
    final status = appointment['status'] as String? ?? 'SCHEDULED';
    final doctorFirstName = appointment['doctor_first_name'] ?? '';
    final doctorLastName = appointment['doctor_last_name'] ?? '';
    final specialty = appointment['specialty'] ?? '';
    final practiceName = appointment['practice_name'] ?? 'Private Practice';
    final practiceAddress = appointment['practice_address'] ?? '';
    final appointmentDate = appointment['appointment_date'] != null
        ? DateTime.parse(appointment['appointment_date'])
        : null;
    final endTime = appointment['end_time'];
    final queueNumber = appointment['queue_number'];
    final queueStatus = appointment['queue_status'];
    final registrationSource = appointment['registration_source'] ?? 'ONLINE';
    final notes = appointment['notes'];
    final statusColor = _getStatusColor(status);
    final statusIcon = _getStatusIcon(status);

    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildHeader(status, statusColor, statusIcon),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildDoctorInfo(doctorFirstName, doctorLastName, specialty, practiceName, practiceAddress),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildAppointmentDetails(appointmentDate, endTime, queueNumber, registrationSource, notes),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            if (queueNumber != null)
              _buildQueueStatus(queueNumber, queueStatus),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            if (status == 'SCHEDULED')
              _buildActions(),
            const SizedBox(height: spacing.AppSpacing.gutter3xl),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(String status, Color statusColor, IconData statusIcon) {
    return Row(
      children: [
        GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
            ),
            child: Icon(
              Icons.arrow_back,
              color: AppColors.onSurface,
              size: spacing.AppSpacing.iconLg,
            ),
          ),
        ),
        const SizedBox(width: spacing.AppSpacing.gutterMd),
        Expanded(
          child: Text(
            'Appointment Details',
            style: AppTextStyles.headlineMd,
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
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                statusIcon,
                size: spacing.AppSpacing.iconSm,
                color: statusColor,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterXs),
              Text(
                _formatStatus(status),
                style: AppTextStyles.labelSm.copyWith(
                  color: statusColor,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDoctorInfo(
    String firstName,
    String lastName,
    String specialty,
    String practiceName,
    String practiceAddress,
  ) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Doctor Information',
            style: AppTextStyles.labelMd.copyWith(
              color: AppColors.secondary,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                ),
                child: Icon(
                  Icons.person,
                  color: AppColors.outline,
                  size: spacing.AppSpacing.iconXl,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Dr. $firstName $lastName',
                      style: AppTextStyles.headlineSm,
                    ),
                    Text(
                      specialty,
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Row(
                      children: [
                        Icon(
                          Icons.apartment,
                          color: AppColors.outline,
                          size: spacing.AppSpacing.iconSm,
                        ),
                        const SizedBox(width: spacing.AppSpacing.gutterXs),
                        Expanded(
                          child: Text(
                            practiceName,
                            style: AppTextStyles.bodyMd.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (practiceAddress.isNotEmpty) ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Row(
              children: [
                Icon(
                  Icons.location_on,
                  color: AppColors.outline,
                  size: spacing.AppSpacing.iconSm,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Expanded(
                  child: Text(
                    practiceAddress,
                    style: AppTextStyles.bodySm.copyWith(
                      color: AppColors.secondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAppointmentDetails(
    DateTime? appointmentDate,
    String? endTime,
    int? queueNumber,
    String registrationSource,
    String? notes,
  ) {
    final dateFormat = DateFormat('EEEE, MMMM d, yyyy');
    final timeFormat = DateFormat('h:mm a');

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Appointment Details',
            style: AppTextStyles.labelMd.copyWith(
              color: AppColors.secondary,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (appointmentDate != null)
            _buildDetailRow(
              Icons.calendar_today,
              'Date',
              dateFormat.format(appointmentDate),
            ),
          if (appointmentDate != null)
            _buildDetailRow(
              Icons.access_time,
              'Time',
              timeFormat.format(appointmentDate),
            ),
          if (queueNumber != null)
            _buildDetailRow(
              Icons.format_list_numbered,
              'Queue Number',
              '#$queueNumber',
            ),
          _buildDetailRow(
            Icons.source,
            'Registration',
            registrationSource == 'ONLINE' ? 'Online Booking' : 'Walk-in',
          ),
          if (notes != null && notes.isNotEmpty) ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              'Notes',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.secondary,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              notes,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurface,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Icon(
            icon,
            color: AppColors.outline,
            size: spacing.AppSpacing.iconSm,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Text(
            label,
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.secondary,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Text(
              value,
              style: AppTextStyles.bodyMdMedium.copyWith(
                color: AppColors.onSurface,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQueueStatus(int queueNumber, String? queueStatus) {
    final statusColor = queueStatus == 'WAITING'
        ? AppColors.tertiary
        : queueStatus == 'CALLED'
            ? AppColors.primary
            : queueStatus == 'IN_CHECKUP'
                ? const Color(0xFF9333EA) // Purple
                : queueStatus == 'COMPLETED'
                    ? AppColors.brandAccentBlue
                    : queueStatus == 'CANCELLED'
                        ? AppColors.error
                        : queueStatus == 'NO_SHOW'
                            ? AppColors.urgentAmber
                            : AppColors.secondary;

    final statusIcon = queueStatus == 'WAITING'
        ? Icons.hourglass_empty
        : queueStatus == 'CALLED'
            ? Icons.notifications_active
            : queueStatus == 'IN_CHECKUP'
                ? Icons.local_hospital
                : queueStatus == 'COMPLETED'
                    ? Icons.check_circle
                    : queueStatus == 'CANCELLED'
                        ? Icons.cancel
                        : queueStatus == 'NO_SHOW'
                            ? Icons.event_busy
                            : Icons.help_outline;

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Queue Status',
            style: AppTextStyles.labelMd.copyWith(
              color: AppColors.secondary,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                ),
                child: Icon(
                  statusIcon,
                  color: statusColor,
                  size: spacing.AppSpacing.iconLg,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Queue #$queueNumber',
                      style: AppTextStyles.headlineSm,
                    ),
                    Text(
                      _formatQueueStatus(queueStatus),
                      style: AppTextStyles.bodyMd.copyWith(
                        color: statusColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActions() {
    return PrimaryButton(
      text: 'Cancel Appointment',
      onPressed: _isCancelling ? null : _cancelAppointment,
      isLoading: _isCancelling,
      backgroundColor: AppColors.error,
      textColor: AppColors.onError,
    );
  }
}
