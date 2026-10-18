import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/services/api_service.dart';

class AppointmentsPage extends StatefulWidget {
  final ApiService? apiService;

  const AppointmentsPage({super.key, this.apiService});

  @override
  State<AppointmentsPage> createState() => _AppointmentsPageState();
}

class _AppointmentsPageState extends State<AppointmentsPage> {
  String _selectedFilter = 'upcoming';
  late final ApiService _apiService;
  List<dynamic> _appointments = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _fetchAppointments();
  }

  Future<void> _fetchAppointments() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      String? statusFilter;
      switch (_selectedFilter) {
        case 'upcoming':
          statusFilter = 'SCHEDULED';
          break;
        case 'completed':
          statusFilter = 'COMPLETED';
          break;
        case 'cancelled':
          statusFilter = 'CANCELLED';
          break;
      }

      final response = await _apiService.getAppointments(status: statusFilter);

      if (response['success'] == true) {
        setState(() {
          _appointments = response['data'] ?? [];
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = response['error']?['message'] ?? 'Failed to load appointments';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load appointments: $e';
        _isLoading = false;
      });
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
                    _buildHeader(),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    _buildSearchBar(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildFilterTabs(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildAppointmentsList(),
                    const SizedBox(height: spacing.AppSpacing.gutter3xl),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final upcomingCount = _appointments.where((a) => a['status'] == 'SCHEDULED').length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text(
                  'My Appointments',
                  style: AppTextStyles.headlineMd,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterSm,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                  ),
                  child: Text(
                    '$upcomingCount Active',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.onPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Text(
          'Manage your clinic visits, queue passes & medical records',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.secondary,
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterSm,
        vertical: spacing.AppSpacing.gutterXs,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(
            Icons.search,
            color: AppColors.outline,
            size: spacing.AppSpacing.iconLg,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search doctor, hospital, or specialty...',
                hintStyle: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.outline,
                ),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                  vertical: spacing.AppSpacing.gutterXs,
                ),
              ),
            ),
          ),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              Icons.tune,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconSm,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterXs),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildFilterTab('Upcoming', 'upcoming'),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Expanded(
            child: _buildFilterTab('Completed', 'completed'),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Expanded(
            child: _buildFilterTab('Cancelled', 'cancelled'),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label, String filter) {
    final isSelected = _selectedFilter == filter;
    final count = _appointments.where((a) {
      switch (filter) {
        case 'upcoming':
          return a['status'] == 'SCHEDULED';
        case 'completed':
          return a['status'] == 'COMPLETED';
        case 'cancelled':
          return a['status'] == 'CANCELLED';
        default:
          return false;
      }
    }).length;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedFilter = filter;
        });
        _fetchAppointments();
      },
      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterSm,
          vertical: spacing.AppSpacing.gutterSm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceLowest : Colors.transparent,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.slate800.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: AppTextStyles.labelMd.copyWith(
                color: isSelected ? AppColors.primary : AppColors.secondary,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
              ),
              child: Center(
                child: Text(
                  count.toString(),
                  style: AppTextStyles.labelSm.copyWith(
                    color: isSelected ? AppColors.primary : AppColors.secondary,
                    fontSize: 10,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppointmentsList() {
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
                onPressed: _fetchAppointments,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_appointments.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: [
              Icon(
                Icons.event_busy,
                size: 64,
                color: AppColors.outline,
              ),
              const SizedBox(height: 16),
              Text(
                'No appointments yet',
                style: AppTextStyles.headlineSm.copyWith(
                  color: AppColors.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your appointments will appear here',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final filteredAppointments = _appointments.where((a) {
      switch (_selectedFilter) {
        case 'upcoming':
          return a['status'] == 'SCHEDULED';
        case 'completed':
          return a['status'] == 'COMPLETED';
        case 'cancelled':
          return a['status'] == 'CANCELLED';
        default:
          return false;
      }
    }).toList();

    if (filteredAppointments.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: [
              Icon(
                Icons.event_busy,
                size: 64,
                color: AppColors.outline,
              ),
              const SizedBox(height: 16),
              Text(
                'No $_selectedFilter appointments',
                style: AppTextStyles.headlineSm.copyWith(
                  color: AppColors.onSurface,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: filteredAppointments.map((appointment) {
        return Padding(
          padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
          child: _buildAppointmentCard(appointment),
        );
      }).toList(),
    );
  }

  Widget _buildAppointmentCard(Map<String, dynamic> appointment) {
    final doctorFirstName = appointment['doctor_first_name'] ?? '';
    final doctorLastName = appointment['doctor_last_name'] ?? '';
    final specialty = appointment['specialty'] ?? '';
    final practiceName = appointment['practice_name'] ?? 'Private Practice';
    final appointmentDate = DateTime.parse(appointment['appointment_date']);
    final queueNumber = appointment['queue_number'];
    final status = appointment['status'];

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                decoration: BoxDecoration(
                  color: status == 'SCHEDULED'
                      ? AppColors.tertiaryContainer.withValues(alpha: 0.15)
                      : status == 'COMPLETED'
                          ? AppColors.surfaceContainer
                          : AppColors.errorContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Row(
                  children: [
                    Icon(
                      status == 'SCHEDULED'
                          ? Icons.radio_button_checked
                          : status == 'COMPLETED'
                              ? Icons.check_circle
                              : Icons.cancel,
                      size: spacing.AppSpacing.iconSm,
                      color: status == 'SCHEDULED'
                          ? AppColors.onTertiaryContainer
                          : status == 'COMPLETED'
                              ? AppColors.tertiary
                              : AppColors.onErrorContainer,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Text(
                      status == 'SCHEDULED'
                          ? queueNumber != null
                              ? 'Confirmed • Queue #$queueNumber'
                              : 'Confirmed'
                          : status == 'COMPLETED'
                              ? 'Completed'
                              : 'Cancelled',
                      style: AppTextStyles.labelMd.copyWith(
                        color: status == 'SCHEDULED'
                            ? AppColors.onTertiaryContainer
                            : status == 'COMPLETED'
                                ? AppColors.secondary
                                : AppColors.onErrorContainer,
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
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                ),
                child: Text(
                  'In-Person',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Doctor info
          Row(
            children: [
              Stack(
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
                  Positioned(
                    bottom: -4,
                    right: -4,
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: AppColors.tertiary,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.verified,
                        color: AppColors.onTertiary,
                        size: 13,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Dr. $doctorFirstName $doctorLastName',
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
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Schedule info
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLowest,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                      ),
                      child: Icon(
                        Icons.event,
                        color: AppColors.primary,
                        size: spacing.AppSpacing.iconMd,
                      ),
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DateFormat('EEEE, MMM d, yyyy').format(appointmentDate),
                          style: AppTextStyles.bodyMdMedium,
                        ),
                        Text(
                          DateFormat('hh:mm a').format(appointmentDate),
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Consultation',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      '₱1,000',
                      style: AppTextStyles.headlineSm,
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (status == 'SCHEDULED') ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                    ),
                    child: ElevatedButton(
                      onPressed: () {},
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryContainer,
                        foregroundColor: AppColors.onPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.confirmation_number,
                            size: spacing.AppSpacing.iconMd,
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterSm),
                          Text(
                            'View Queue Pass',
                            style: AppTextStyles.bodyLgMedium,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Container(
                  height: 48,
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterMd,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: Icon(
                    Icons.chat,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: Icon(
                    Icons.directions,
                    color: AppColors.secondary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
