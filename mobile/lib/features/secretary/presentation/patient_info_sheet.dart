import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/services/api_service.dart';
import '../models/patient_summary.dart';

/// Read-only patient information sheet for the secretary chat.
///
/// Displays only the authorized appointment-summary fields returned by
/// `GET /api/v1/conversations/:id/appointment-summary`. There are no edit or
/// appointment-management actions here; appointment management stays on the
/// secretary web dashboard.
class PatientInfoSheet extends StatefulWidget {
  final String conversationId;
  final String? patientName;

  const PatientInfoSheet({
    super.key,
    required this.conversationId,
    this.patientName,
  });

  static Future<void> show(
    BuildContext context, {
    required String conversationId,
    String? patientName,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PatientInfoSheet(
        conversationId: conversationId,
        patientName: patientName,
      ),
    );
  }

  @override
  State<PatientInfoSheet> createState() => _PatientInfoSheetState();
}

class _PatientInfoSheetState extends State<PatientInfoSheet> {
  final ApiService _apiService = ApiService();

  PatientSummary? _summary;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getAppointmentSummary(
        widget.conversationId,
      );

      if (!mounted) return;

      if (response['success'] == true && response['data'] is Map) {
        setState(() {
          _summary = PatientSummary.fromJson(
            Map<String, dynamic>.from(response['data'] as Map),
          );
          _isLoading = false;
        });
      } else {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Unable to load patient information.';
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _errorMessage = 'Unable to load patient information.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final maxHeight = MediaQuery.of(context).size.height * 0.85;

    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(maxHeight: maxHeight),
        decoration: const BoxDecoration(
          color: AppColors.surfaceLowest,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppSpacing.radius2xl),
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: AppSpacing.gutterSm),
            Container(
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.slate200,
                borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
              ),
            ),
            _buildHeader(),
            const Divider(height: 1),
            Flexible(
              child: _isLoading
                  ? const Padding(
                      padding: EdgeInsets.all(AppSpacing.gutter3xl),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : _errorMessage != null
                  ? _buildError()
                  : _buildContent(_summary!),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final name = _summary?.patient.fullName ?? widget.patientName ?? 'Patient';

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenPadding,
        AppSpacing.gutterMd,
        AppSpacing.screenPadding,
        AppSpacing.gutterMd,
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Patient Information',
                  style: AppTextStyles.headlineSm.copyWith(
                    color: AppColors.brandNavy,
                  ),
                ),
                const SizedBox(height: AppSpacing.gutterXs),
                Text(
                  name,
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.gutterSm,
              vertical: AppSpacing.gutterXs,
            ),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            ),
            child: Text(
              'Read-only',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.secondary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          IconButton(
            onPressed: () => Navigator.of(context).pop(),
            icon: const Icon(Icons.close),
            color: AppColors.secondary,
            tooltip: 'Close',
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.screenPadding),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 40),
          const SizedBox(height: AppSpacing.gutterMd),
          Text(
            _errorMessage ?? 'Unable to load patient information.',
            textAlign: TextAlign.center,
            style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
          ),
          const SizedBox(height: AppSpacing.gutterMd),
          OutlinedButton.icon(
            onPressed: _loadSummary,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(PatientSummary summary) {
    final appointment = summary.appointment;
    final dateOfBirth = summary.patient.dateOfBirthValue;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenPadding,
        AppSpacing.gutterLg,
        AppSpacing.screenPadding,
        AppSpacing.gutter3xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Patient Details'),
          const SizedBox(height: AppSpacing.gutterMd),
          _buildInfoRow('Full name', summary.patient.fullName),
          _buildInfoRow(
            'Date of birth',
            dateOfBirth != null
                ? DateFormat('MMMM d, y').format(dateOfBirth)
                : 'Not provided',
          ),
          _buildInfoRow('Phone', summary.patient.phone ?? 'Not provided'),
          _buildInfoRow('Email', summary.patient.email ?? 'Not provided'),
          const SizedBox(height: AppSpacing.gutterLg),
          _buildSectionTitle('Appointment'),
          const SizedBox(height: AppSpacing.gutterMd),
          if (appointment == null)
            Text(
              'No appointment on record for this patient and doctor.',
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
            )
          else ...[
            _buildInfoRow(
              'Date & time',
              appointment.appointmentDate != null
                  ? DateFormat(
                      'MMMM d, y • h:mm a',
                    ).format(appointment.appointmentDate!)
                  : 'Not scheduled',
            ),
            _buildStatusRow(appointment.status),
            _buildInfoRow(
              'Reason for visit',
              appointment.reasonForVisit ?? 'Not provided',
            ),
            _buildInfoRow(
              'Queue number',
              appointment.queueNumber?.toString() ?? 'Not assigned',
            ),
          ],
          const SizedBox(height: AppSpacing.gutterLg),
          _buildSectionTitle('Doctor'),
          const SizedBox(height: AppSpacing.gutterMd),
          _buildInfoRow('Doctor', summary.doctor.fullName),
          _buildInfoRow(
            'Practice',
            summary.doctor.practiceName ?? 'Not provided',
          ),
          const SizedBox(height: AppSpacing.gutterLg),
          Container(
            padding: const EdgeInsets.all(AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.lock_outline,
                  size: AppSpacing.iconMd,
                  color: AppColors.secondary,
                ),
                const SizedBox(width: AppSpacing.gutterSm),
                Expanded(
                  child: Text(
                    'This information is for reference only. '
                    'Appointment changes are handled on the secretary web dashboard.',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.secondary,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: AppTextStyles.labelMd.copyWith(
        color: AppColors.brandNavy,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.gutterSm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: AppTextStyles.labelSm.copyWith(color: AppColors.slate500),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusRow(String status) {
    final color = _statusColor(status);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.gutterSm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              'Status',
              style: AppTextStyles.labelSm.copyWith(color: AppColors.slate500),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.gutterSm,
              vertical: 2,
            ),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
            ),
            child: Text(
              status.isEmpty ? 'UNKNOWN' : status,
              style: AppTextStyles.labelSm.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'SCHEDULED':
      case 'CONFIRMED':
        return AppColors.primary;
      case 'IN_PROGRESS':
        return AppColors.brandTealBadge;
      case 'COMPLETED':
        return AppColors.secondary;
      case 'CANCELLED':
      case 'NO_SHOW':
        return AppColors.error;
      default:
        return AppColors.secondary;
    }
  }
}
