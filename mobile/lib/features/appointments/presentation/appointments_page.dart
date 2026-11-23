import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/navigation/app_navigator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/json_parsers.dart';
import 'appointment_detail_page.dart';

class AppointmentsPage extends StatefulWidget {
  final ApiService? apiService;
  final VoidCallback? onNavigateToWaitlist;
  final VoidCallback? onWaitlistCountUpdate;

  const AppointmentsPage({
    super.key,
    this.apiService,
    this.onNavigateToWaitlist,
    this.onWaitlistCountUpdate,
  });

  @override
  State<AppointmentsPage> createState() => _AppointmentsPageState();
}

class _AppointmentsPageState extends State<AppointmentsPage> {
  String _selectedFilter = 'all';
  DateTime? _selectedDate;
  late final ApiService _apiService;
  List<dynamic> _allAppointments = []; // Store all appointments
  List<dynamic> _appointments = []; // Filtered appointments for display
  bool _isLoading = true;
  String? _errorMessage;

  // Waitlist state
  List<dynamic> _waitlists = [];

  // Today's live queue (one entry per doctor the patient is seeing today)
  List<Map<String, dynamic>> _todayQueues = [];

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _fetchAppointments();
    _fetchWaitlists();
    _fetchTodayQueue();
  }

  Future<void> _fetchTodayQueue() async {
    try {
      final response = await _apiService.getMyQueueToday();
      if (!mounted) return;

      if (response['success'] == true && response['data'] is Map) {
        final queues = (response['data']['queues'] as List?) ?? [];
        final entries = <Map<String, dynamic>>[];
        for (final item in queues) {
          if (item is Map) {
            entries.add(Map<String, dynamic>.from(item));
          }
        }
        setState(() {
          _todayQueues = entries;
        });
      }
    } catch (_) {
      // Today's queue is supplementary - the appointment list must still render.
    }
  }

  Future<void> _fetchAppointments() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Fetch all appointments without status filter
      final response = await _apiService.getAppointments(status: null);

      if (response['success'] == true) {
        final appointments = response['data'] ?? [];
        print('Fetched ${appointments.length} appointments');

        // Log completed appointments with payment status
        final completedAppointments = appointments
            .where((a) => a['status'] == 'COMPLETED')
            .toList();
        print('Completed appointments: ${completedAppointments.length}');
        for (var apt in completedAppointments) {
          print(
            '  - ID: ${apt['id']}, PaymentStatus: ${apt['payment_status']}, PaymentId: ${apt['payment_id']}',
          );
        }

        setState(() {
          _allAppointments = appointments;
          _filterAppointments();
          _isLoading = false;
        });
      } else {
        print('Failed to fetch appointments: ${response['error']}');
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load appointments';
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Exception fetching appointments: $e');
      setState(() {
        _errorMessage = 'Failed to load appointments: $e';
        _isLoading = false;
      });
    }
  }

  List<dynamic> _appointmentsOnSelectedDate() {
    if (_selectedDate == null) return _allAppointments;

    final selected = DateTime(
      _selectedDate!.year,
      _selectedDate!.month,
      _selectedDate!.day,
    );
    return _allAppointments.where((a) {
      final raw = a['appointment_date']?.toString();
      final parsed = raw != null ? DateTime.tryParse(raw)?.toLocal() : null;
      if (parsed == null) return false;
      final date = DateTime(parsed.year, parsed.month, parsed.day);
      return date == selected;
    }).toList();
  }

  bool _matchesStatusFilter(dynamic appointment, String filter) {
    final status = (appointment['status'] ?? '').toString().toUpperCase();
    switch (filter) {
      case 'upcoming':
        return status == 'SCHEDULED' ||
            status == 'CONFIRMED' ||
            status == 'IN_PROGRESS';
      case 'completed':
        return status == 'COMPLETED';
      case 'cancelled':
        return status == 'CANCELLED' ||
            status == 'NO_SHOW';
      case 'all':
      default:
        return true;
    }
  }

  void _filterAppointments() {
    // Counts and the visible list are both derived from the date-filtered
    // dataset so they stay consistent when a date is selected.
    _appointments = _appointmentsOnSelectedDate()
        .where((a) => _matchesStatusFilter(a, _selectedFilter))
        .toList();
  }

  Future<void> _fetchWaitlists() async {
    try {
      final response = await _apiService.getMyWaitlists();
      if (response['success'] == true && response['data'] != null) {
        final waitlists = response['data'] as List;
        if (mounted) {
          setState(() {
            _waitlists = waitlists;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _waitlists = [];
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _waitlists = [];
        });
      }
    }
  }

  Future<void> _navigateToDetail(String appointmentId) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AppointmentDetailPage(
          appointmentId: appointmentId,
          apiService: _apiService,
        ),
      ),
    );

    // Refresh the list if returning from detail page after cancellation
    if (result == true) {
      _fetchAppointments();
    }
  }

  Future<void> _navigateToReschedule(String appointmentId) async {
    final result = await Navigator.pushNamed(
      context,
      '/reschedule',
      arguments: {'appointmentId': appointmentId},
    );

    if (result == true) {
      _fetchAppointments();
      _fetchTodayQueue();
    }
  }

  Future<void> _refreshAll() async {
    await Future.wait([
      _fetchAppointments(),
      _fetchWaitlists(),
      _fetchTodayQueue(),
    ]);
  }

  Widget _buildTodayQueueSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.confirmation_number_outlined,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            Text('Today\'s Queue', style: AppTextStyles.headlineSm),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        ..._todayQueues.map((entry) => _buildTodayQueueCard(entry)),
      ],
    );
  }

  Widget _buildTodayQueueCard(Map<String, dynamic> entry) {
    final queueNumber = parseInt(entry['queueNumber']);
    final nowServing = parseInt(entry['nowServing']);
    final patientsAhead = parseInt(entry['patientsAhead']) ?? 0;
    final estimatedWait = parseInt(entry['estimatedWaitMinutes']) ?? 0;
    final doctorName = parseString(entry['doctorName']) ?? 'Your doctor';
    final appointmentId = parseString(entry['appointmentId']);
    final queueStatus = parseString(entry['queueStatus']);
    final isCalled = queueStatus == 'CALLED' || queueStatus == 'IN_CHECKUP';

    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: AppCard(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        onTap: appointmentId != null
            ? () => _navigateToDetail(appointmentId)
            : null,
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
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
                    fontSize: 20,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
            SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(doctorName, style: AppTextStyles.bodyMdMedium),
                  const SizedBox(height: 2),
                  Text(
                    isCalled
                        ? 'It\'s your turn'
                        : 'Now serving ${nowServing != null ? '#$nowServing' : '—'} • '
                              '$patientsAhead ${patientsAhead == 1 ? 'patient' : 'patients'} ahead'
                              '${estimatedWait > 0 ? ' • ~$estimatedWait min' : ''}',
                    style: AppTextStyles.labelSm.copyWith(
                      color: isCalled ? AppColors.primary : AppColors.secondary,
                      fontWeight: isCalled
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.outline),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredAppointments = _appointments;

    final showWaitlistRow =
        _selectedFilter == 'upcoming' &&
        _waitlists.isNotEmpty &&
        widget.onNavigateToWaitlist != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Semantics(
        container: true,
        label: 'My Appointments',
        child: Column(
          children: [
            const AppHeader(showNotifications: true, showProfile: true),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                spacing.AppSpacing.screenPadding,
                spacing.AppSpacing.gutterXs,
                spacing.AppSpacing.screenPadding,
                0,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Flexible(
                    fit: FlexFit.loose,
                    child: _buildDateFilterButton(),
                  ),
                  if (_selectedDate != null || _selectedFilter != 'upcoming') ...[
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    _buildClearAction(),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                spacing.AppSpacing.screenPadding,
                spacing.AppSpacing.gutterXs,
                spacing.AppSpacing.screenPadding,
                spacing.AppSpacing.gutterXs,
              ),
              child: _buildFilterTabs(),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refreshAll,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    if (_todayQueues.isNotEmpty)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                            spacing.AppSpacing.screenPadding,
                            0,
                            spacing.AppSpacing.screenPadding,
                            spacing.AppSpacing.gutterSm,
                          ),
                          child: _buildTodayQueueSection(),
                        ),
                      ),
                    if (showWaitlistRow)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(
                            spacing.AppSpacing.screenPadding,
                            0,
                            spacing.AppSpacing.screenPadding,
                            spacing.AppSpacing.gutterSm,
                          ),
                          child: _buildWaitlistRow(),
                        ),
                      ),
                    if (_isLoading) ...[
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: spacing.AppSpacing.screenPadding,
                            ).copyWith(bottom: spacing.AppSpacing.gutterLg),
                            child: const SkeletonScope(
                              child: AppointmentCardSkeleton(),
                            ),
                          ),
                          childCount: 4,
                        ),
                      ),
                      const SliverToBoxAdapter(child: SizedBox(height: 112)),
                    ]
                    else if (_errorMessage != null)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32.0),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
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
                        ),
                      )
                    else if (filteredAppointments.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32.0),
                            child: _allAppointments.isEmpty
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(
                                        Icons.event_busy,
                                        size: 64,
                                        color: AppColors.outline,
                                      ),
                                      const SizedBox(height: 16),
                                      Text(
                                        'No appointments yet',
                                        style: AppTextStyles.headlineSm
                                            .copyWith(
                                              color: AppColors.onSurface,
                                            ),
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Your appointments will appear here',
                                        style: AppTextStyles.bodyMd.copyWith(
                                          color: AppColors.onSurfaceVariant,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                                    ],
                                  )
                                : Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(
                                        Icons.event_busy,
                                        size: 64,
                                        color: AppColors.outline,
                                      ),
                                      const SizedBox(height: 16),
                                      Text(
                                        'No appointments match your filters.',
                                        style: AppTextStyles.headlineSm
                                            .copyWith(
                                              color: AppColors.onSurface,
                                            ),
                                        textAlign: TextAlign.center,
                                      ),
                                    ],
                                  ),
                          ),
                        ),
                      )
                    else ...[
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: spacing.AppSpacing.screenPadding,
                            ).copyWith(bottom: spacing.AppSpacing.gutterLg),
                            child: _buildAppointmentCard(
                              filteredAppointments[index],
                            ),
                          ),
                          childCount: filteredAppointments.length,
                        ),
                      ),
                      // Keep the last card clear of the floating "Ask MediGuide" button
                      const SliverToBoxAdapter(child: SizedBox(height: 112)),
                    ],
                  ],
                ),
              ),
             ),
          ],
        ),
      ),
    );
  }

  Widget _buildDateFilterButton() {
    final label = _selectedDate == null
        ? 'Select date'
        : DateFormat('MMM d, yyyy').format(_selectedDate!);
    return OutlinedButton.icon(
      onPressed: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: _selectedDate ?? DateTime.now(),
          firstDate: DateTime(2020),
          lastDate: DateTime(2100),
        );
        if (picked != null) {
          setState(() {
            _selectedDate = picked;
            _filterAppointments();
          });
        }
      },
      icon: const Icon(Icons.calendar_today, size: 16),
      label: SizedBox(
        width: double.infinity,
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  Widget _buildClearAction() {
    return TextButton(
      onPressed: () {
        setState(() {
          _selectedFilter = 'upcoming';
          _selectedDate = null;
          _filterAppointments();
        });
      },
      child: const Text(
        'Clear All',
        style: TextStyle(fontSize: 12),
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
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildFilterTab('All', 'all'),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            _buildFilterTab('Upcoming', 'upcoming'),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            _buildFilterTab('Completed', 'completed'),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            _buildFilterTab('Cancelled', 'cancelled'),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterTab(String label, String filter) {
    final isSelected = _selectedFilter == filter;
    // Counts respect the selected date but ignore the individual status filter
    // so every tab shows how many appointments match the current date.
    final count = _appointmentsOnSelectedDate()
        .where((a) => _matchesStatusFilter(a, filter))
        .length;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedFilter = filter;
          _filterAppointments();
        });
      },
      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterSm,
          vertical: spacing.AppSpacing.gutterXs,
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
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: AppTextStyles.labelSm.copyWith(
                fontWeight: FontWeight.w600,
                color: isSelected ? AppColors.primary : AppColors.secondary,
              ),
            ),
            if (count > 0) const SizedBox(width: spacing.AppSpacing.gutterXs),
            if (count > 0)
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppColors.primary.withValues(alpha: 0.1)
                      : AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusFull,
                  ),
                ),
                child: Center(
                  child: Text(
                    count.toString(),
                    style: AppTextStyles.labelSm.copyWith(
                      color: isSelected ? AppColors.primary : AppColors.secondary,
                      fontSize: 9,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildWaitlistRow() {
    final count = _waitlists.length;

    return Material(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        child: InkWell(
          onTap: widget.onNavigateToWaitlist,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.gutterMd,
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.hourglass_empty,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconMd,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Expanded(
                  child: Text(
                    count == 1
                        ? "You're on 1 waitlist"
                        : "You're on $count waitlists",
                    style: AppTextStyles.bodyMdMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.secondary),
              ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppointmentCard(Map<String, dynamic> appointment) {
    final doctorFirstName = appointment['doctor_first_name'] ?? '';
    final doctorLastName = appointment['doctor_last_name'] ?? '';
    final specialty = appointment['specialty'] ?? '';
    final practiceName = appointment['practice_name'] ?? 'Private Practice';
    final professionalPhotoUrl = appointment['professional_photo_url']
        ?.toString();
    final appointmentDateStr = parseString(appointment['appointment_date']);
    final appointmentDate = appointmentDateStr != null
        ? DateTime.tryParse(appointmentDateStr)
        : null;
    final queueNumber = parseInt(appointment['queue_number']);
    final status = appointment['status'];
    final appointmentId = appointment['id']?.toString() ?? '';
    final isCompleted = status == 'COMPLETED';
    final isScheduled = status == 'SCHEDULED' || status == 'CONFIRMED';
    // consultation_fee is a PostgreSQL DECIMAL column, so the API delivers it
    // as a JSON string (e.g. "500.00") - parse it instead of casting.
    final consultationFee = parseNum(appointment['consultation_fee']);
    final paymentStatus = parseString(appointment['payment_status']);
    final paymentMethod = parseString(appointment['payment_method']);
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      onTap: () => _navigateToDetail(appointmentId),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header badge — skip for COMPLETED appointments since the
          // user is already viewing the Completed tab.
          if (isScheduled) ...[
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
                        : AppColors.errorContainer,
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusFull,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.check_circle,
                        color: AppColors.tertiary,
                        size: spacing.AppSpacing.iconSm,
                      ),
                      const SizedBox(width: spacing.AppSpacing.gutterXs),
                      Text(
                        'Confirmed',
                        style: AppTextStyles.labelMd.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.onTertiaryContainer,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
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
                    color: AppColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusFull,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Queue #',
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.secondary,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                        ),
                      ),
                      Text(
                        queueNumber != null ? queueNumber.toString() : '--',
                        style: AppTextStyles.labelMd.copyWith(
                          color: AppColors.onSurface,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
          ] else if (isCompleted) ...[
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: spacing.AppSpacing.gutterSm,
                vertical: spacing.AppSpacing.gutterXs,
              ),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusFull,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.check_circle,
                    color: AppColors.tertiary,
                    size: spacing.AppSpacing.iconSm,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterXs),
                  Text(
                    'Completed',
                    style: AppTextStyles.labelMd.copyWith(
                      fontWeight: FontWeight.w600,
                      color: AppColors.secondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
          ],
          if (appointment['needs_attention'] == true &&
              (status == 'SCHEDULED' ||
                  status == 'CONFIRMED' ||
                  status == 'IN_PROGRESS')) ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  color: AppColors.statusWarning,
                  size: spacing.AppSpacing.iconSm,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Expanded(
                  child: Text(
                    "The clinic changed the doctor's schedule. They will contact you.",
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.slate700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Doctor info
          Row(
            children: [
              DoctorProfileImage(
                photoUrl: professionalPhotoUrl,
                size: 56,
                showVerifiedBadge: true,
              ),
              SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Dr. $doctorFirstName $doctorLastName',
                      style: AppTextStyles.headlineSm.copyWith(
                        fontSize: 17,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      specialty,
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                        fontSize: 13,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
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
                              fontSize: 13,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
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
          // Schedule + Fee container
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLowest,
                          borderRadius: BorderRadius.circular(
                            spacing.AppSpacing.radiusMd,
                          ),
                        ),
                        child: Icon(
                          Icons.event,
                          color: AppColors.primary,
                          size: spacing.AppSpacing.iconMd,
                        ),
                      ),
                      const SizedBox(width: spacing.AppSpacing.gutterSm),
                      Flexible(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              appointmentDate != null
                                  ? DateFormat('EEEE, MMM d, yyyy').format(
                                    appointmentDate,
                                  )
                                  : 'Date not available',
                              style: AppTextStyles.bodyMdMedium,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              appointmentDate != null
                                  ? '${DateFormat('hh:mm a').format(appointmentDate)} Slot'
                                  : 'Time not available',
                              style: AppTextStyles.labelSm.copyWith(
                                color: AppColors.secondary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
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
                      consultationFee != null
                          ? '₱${consultationFee.toStringAsFixed(0)}'
                          : '₱---',
                      style: AppTextStyles.headlineSm,
                    ),
                    if (paymentStatus != null) ...[
                      const SizedBox(height: spacing.AppSpacing.gutterXs),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            paymentStatus == 'PAID'
                                ? Icons.check_circle
                                : paymentStatus == 'PENDING_VERIFICATION'
                                ? Icons.pending
                                : paymentStatus == 'REJECTED'
                                ? Icons.cancel
                                : Icons.schedule,
                            size: 12,
                            color: paymentStatus == 'PAID'
                                ? AppColors.statusCompleted
                                : paymentStatus == 'PENDING_VERIFICATION'
                                ? AppColors.statusWarning
                                : paymentStatus == 'REJECTED'
                                ? AppColors.error
                                : AppColors.secondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _formatPaymentStatus(paymentStatus),
                            style: AppTextStyles.labelSm.copyWith(
                              color: paymentStatus == 'PAID'
                                  ? AppColors.statusCompleted
                                  : paymentStatus == 'PENDING_VERIFICATION'
                                  ? AppColors.statusWarning
                                  : paymentStatus == 'REJECTED'
                                  ? AppColors.error
                                  : AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (paymentMethod != null) ...[
                      const SizedBox(height: spacing.AppSpacing.gutterXs),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            paymentMethod.toUpperCase() == 'GCASH'
                                ? Icons.account_balance_wallet
                                : Icons.local_atm,
                            size: 12,
                            color: AppColors.secondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            paymentMethod.toUpperCase(),
                            style: AppTextStyles.labelSm.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Action buttons
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 44,
                  decoration: BoxDecoration(
                    color: isCompleted
                        ? AppColors.surfaceLowest
                        : AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusLg,
                    ),
                    border: Border.all(
                      color: isCompleted
                          ? AppColors.primary.withValues(alpha: 0.3)
                          : AppColors.primary.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () {
                        if (isCompleted) {
                          Navigator.of(context).pushNamed(
                            '/appointment-detail',
                            arguments: {'appointmentId': appointmentId},
                          );
                        } else {
                          _navigateToReschedule(appointmentId);
                        }
                      },
                      borderRadius: BorderRadius.circular(
                        spacing.AppSpacing.radiusLg,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.event_repeat,
                            color: AppColors.primary,
                            size: 18,
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterXs),
                          Text(
                            isCompleted ? 'View Summary' : 'Reschedule',
                            style: AppTextStyles.labelMd.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600,
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Container(
                height: 44,
                width: 44,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusLg,
                  ),
                ),
                child: Icon(
                  Icons.chat,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconMd,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Container(
                height: 44,
                width: 44,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusLg,
                  ),
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
      ),
    );
  }

  String _formatPaymentStatus(String? status) {
    if (status == null) return 'Not Available';
    switch (status) {
      case 'UNPAID':
        return 'Unpaid';
      case 'PENDING_VERIFICATION':
        return 'Pending';
      case 'PAID':
        return 'Paid';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  }
}


