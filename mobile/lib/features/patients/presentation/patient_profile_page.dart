import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/services/api_service.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';

/// Standalone read-only view of the signed-in patient's own profile.
///
/// Mirrors the fields collected in [PatientDetailsPage] during booking
/// (name, email, date of birth, sex, mobile number, address) but without any
/// booking-related arguments. Patients only ever see their own data; the
/// backend scopes `GET /api/v1/patients/me` to the authenticated caller.
class PatientProfilePage extends StatefulWidget {
  const PatientProfilePage({super.key});

  @override
  State<PatientProfilePage> createState() => _PatientProfilePageState();
}

class _PatientProfilePageState extends State<PatientProfilePage> {
  final ApiService _apiService = ApiService();

  Map<String, dynamic>? _patient;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getCurrentPatient();
      if (response['success'] == true && response['data'] is Map) {
        if (!mounted) return;
        setState(() {
          _patient = Map<String, dynamic>.from(response['data'] as Map);
          _isLoading = false;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load patient profile';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage =
            'Cannot reach the server. Please check your connection and try again.';
        _isLoading = false;
      });
    }
  }

  String _formatDateOfBirth(dynamic value) {
    if (value == null) return '—';
    try {
      final dob = DateTime.parse(value.toString());
      return DateFormat('yyyy-MM-dd').format(dob);
    } catch (_) {
      return value.toString();
    }
  }

  String _formatSex(dynamic value) {
    switch (value?.toString()) {
      case 'MALE':
        return 'Male';
      case 'FEMALE':
        return 'Female';
      case 'OTHER':
        return 'Other';
      default:
        return 'Not specified';
    }
  }

  String get _displayName {
    final patient = _patient;
    if (patient == null) return 'Patient';
    final first = (patient['first_name'] ?? '').toString();
    final last = (patient['last_name'] ?? '').toString();
    final name = '$first $last'.trim();
    if (name.isNotEmpty) return name;
    final email = (patient['email'] ?? '').toString();
    return email.isNotEmpty ? email : 'Patient';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          AppHeader(
            title: 'Patient Profile',
            showBackButton: true,
            onBackPressed: () => Navigator.of(context).pop(),
            showNotifications: false,
            showProfile: false,
          ),
          Expanded(
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              'Loading your profile…',
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
            ),
          ],
        ),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.cloud_off,
                size: 48,
                color: AppColors.error.withValues(alpha: 0.7),
              ),
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: AppTextStyles.bodyMd.copyWith(color: AppColors.error),
              ),
              const SizedBox(height: spacing.AppSpacing.gutterLg),
              PrimaryButton(
                text: 'Try again',
                onPressed: _loadProfile,
                icon: const Icon(Icons.refresh, size: 20),
              ),
            ],
          ),
        ),
      );
    }

    final patient = _patient ?? const <String, dynamic>{};
    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildSummaryTile(patient),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Text(
              'PATIENT DETAILS',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.secondary,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                fontSize: 12,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            AppCard(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              child: Column(
                children: [
                  _buildInfoRow(
                    icon: Icons.email_outlined,
                    label: 'Email',
                    value: (patient['email'] ?? '—').toString(),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  _buildInfoRow(
                    icon: Icons.badge_outlined,
                    label: 'First name',
                    value: (patient['first_name'] ?? '—').toString(),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  _buildInfoRow(
                    icon: Icons.badge_outlined,
                    label: 'Middle name',
                    value: (patient['middle_name'] ?? '—').toString(),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  _buildInfoRow(
                    icon: Icons.badge_outlined,
                    label: 'Last name',
                    value: (patient['last_name'] ?? '—').toString(),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  _buildInfoRow(
                    icon: Icons.cake_outlined,
                    label: 'Date of birth',
                    value: _formatDateOfBirth(patient['date_of_birth']),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  _buildInfoRow(
                    icon: Icons.person_outline,
                    label: 'Sex',
                    value: _formatSex(patient['sex']),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  _buildInfoRow(
                    icon: Icons.phone_outlined,
                    label: 'Mobile number',
                    value: (patient['phone'] ?? '—').toString(),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  _buildInfoRow(
                    icon: Icons.home_outlined,
                    label: 'Address',
                    value: (patient['address'] ?? '—').toString(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutter3xl),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryTile(Map<String, dynamic> patient) {
    final email = (patient['email'] ?? '').toString();
    final initials = _displayName
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: AppColors.surfaceContainer,
            child: Text(
              initials.isEmpty ? '?' : initials,
              style: AppTextStyles.headlineSm.copyWith(
                color: AppColors.primary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _displayName,
                  style: AppTextStyles.headlineSm.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  email.isNotEmpty ? email : '—',
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Semantics(
      label: '$label: ${value.isEmpty ? 'not provided' : value}, read only',
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            color: AppColors.secondary,
            size: spacing.AppSpacing.iconMd,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.outline,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  value.isEmpty ? '—' : value,
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    color: AppColors.onSurface,
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
