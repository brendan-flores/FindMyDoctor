import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/services/api_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/utils/json_parsers.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';

/// Patient-side rescheduling screen.
///
/// The appointment is date-only (the clinic does not book specific time
/// slots), so the patient picks a new date from the doctor's availability and
/// the backend moves the appointment and re-issues the queue number.
class ReschedulePage extends StatefulWidget {
  final String appointmentId;
  final ApiService? apiService;

  const ReschedulePage({
    super.key,
    required this.appointmentId,
    this.apiService,
  });

  @override
  State<ReschedulePage> createState() => _ReschedulePageState();
}

class _ReschedulePageState extends State<ReschedulePage> {
  late final ApiService _apiService;

  Map<String, dynamic>? _appointment;
  bool _isLoading = true;
  String? _errorMessage;

  String? _doctorId;
  String? _currentDateKey;
  DateTime _weekStart = DateTime.now();
  DateTime? _selectedDate;

  Map<String, Map<String, dynamic>> _availabilityByDate = {};
  bool _isLoadingAvailability = false;

  bool _isSubmitting = false;
  bool _isJoiningWaitlist = false;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _loadAppointment();
  }

  DateTime _getStartOfWeek(DateTime date) {
    final dayOfWeek = date.weekday;
    return date.subtract(Duration(days: dayOfWeek % 7));
  }

  String _dateKey(DateTime date) => DateFormat('yyyy-MM-dd').format(date);

  DateTime? _parseDate(dynamic value) {
    final raw = parseString(value);
    if (raw == null) return null;
    // Appointments are stored at the clinic's midnight; convert to the device's
    // local date so the picker aligns with the availability dates from the API.
    return DateTime.tryParse(raw)?.toLocal();
  }

  Future<void> _loadAppointment() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getAppointmentById(
        widget.appointmentId,
      );
      if (!mounted) return;

      if (response['success'] != true || response['data'] is! Map) {
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load appointment';
          _isLoading = false;
        });
        return;
      }

      final appointment = Map<String, dynamic>.from(response['data'] as Map);
      final currentDate = _parseDate(appointment['appointment_date']);

      setState(() {
        _appointment = appointment;
        _doctorId = parseString(appointment['doctor_id']);
        _currentDateKey = currentDate != null ? _dateKey(currentDate) : null;
        _weekStart = _getStartOfWeek(currentDate ?? DateTime.now());
        _isLoading = false;
      });

      await _loadAvailability();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to load appointment';
        _isLoading = false;
      });
    }
  }

  Future<void> _loadAvailability() async {
    final doctorId = _doctorId;
    if (doctorId == null) return;

    setState(() {
      _isLoadingAvailability = true;
    });

    final startDate = _weekStart;
    final endDate = _weekStart.add(const Duration(days: 6));

    try {
      final response = await _apiService.getDoctorAvailability(
        doctorId: doctorId,
        startDate: _dateKey(startDate),
        endDate: _dateKey(endDate),
      );

      if (!mounted) return;

      if (response['success'] == true && response['data'] is Map) {
        final dates = (response['data']['dates'] as List?) ?? [];
        final map = <String, Map<String, dynamic>>{};
        for (final item in dates) {
          if (item is Map) {
            final entry = Map<String, dynamic>.from(item);
            final key = parseString(entry['date']);
            if (key != null) {
              map[key] = entry;
            }
          }
        }
        setState(() {
          _availabilityByDate = map;
          _isLoadingAvailability = false;
        });
      } else {
        setState(() {
          _availabilityByDate = {};
          _isLoadingAvailability = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _availabilityByDate = {};
        _isLoadingAvailability = false;
      });
    }
  }

  void _changeWeek(int offset) {
    final today = DateTime.now();
    final nextWeek = _weekStart.add(Duration(days: 7 * offset));
    if (nextWeek.isBefore(_getStartOfWeek(today))) return;

    setState(() {
      _weekStart = nextWeek;
      _selectedDate = null;
    });
    _loadAvailability();
  }

  void _selectDate(DateTime date) {
    setState(() {
      _selectedDate = date;
    });
  }

  bool _isCurrentDate(DateTime date) => _dateKey(date) == _currentDateKey;

  bool _isPastDate(DateTime date) {
    final today = DateTime.now();
    final todayStart = DateTime(today.year, today.month, today.day);
    return date.isBefore(todayStart);
  }

  bool _isSelectable(DateTime date, Map<String, dynamic>? availability) {
    if (_isPastDate(date) || _isCurrentDate(date)) return false;
    final status = parseString(availability?['status']);
    if (status == null) return false;
    return status != 'PAST' &&
        status != 'NON_WORKING' &&
        status != 'UNAVAILABLE';
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'AVAILABLE':
        return 'Slots available';
      case 'FULL':
        return 'Fully booked';
      case 'UNAVAILABLE':
        return 'Doctor unavailable';
      case 'NON_WORKING':
        return 'Clinic closed';
      case 'ALREADY_BOOKED':
        return 'You already have an appointment';
      case 'PAST':
        return 'Date has passed';
      default:
        return 'Not available';
    }
  }

  String? _selectedStatus() {
    if (_selectedDate == null) return null;
    return parseString(
      _availabilityByDate[_dateKey(_selectedDate!)]?['status'],
    );
  }

  Future<void> _confirmReschedule() async {
    final selected = _selectedDate;
    if (selected == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reschedule appointment?'),
        content: Text(
          'Your appointment will move from '
          '${_formatFullDate(_parseDate(_appointment?['appointment_date']))} to '
          '${_formatFullDate(selected)}.\n\n'
          'Your previous queue number will be released and a new one will be '
          'assigned for the new date.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep current'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final response = await _apiService.rescheduleAppointment(
        id: widget.appointmentId,
        newAppointmentDate: _dateKey(selected),
      );

      if (!mounted) return;

      if (response['success'] == true) {
        final queueNumber = parseInt(response['data']?['queueNumber']);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              queueNumber != null
                  ? 'Appointment rescheduled. New queue number: #$queueNumber'
                  : 'Appointment rescheduled successfully',
            ),
          ),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              response['error']?['message'] ??
                  'Failed to reschedule appointment',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to reschedule appointment: $e'),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  Future<void> _joinWaitlist() async {
    final doctorId = _doctorId;
    final selected = _selectedDate;
    if (doctorId == null || selected == null) return;

    setState(() {
      _isJoiningWaitlist = true;
    });

    try {
      final response = await _apiService.joinWaitlist(
        doctorId: doctorId,
        waitlistDate: _dateKey(selected),
      );

      if (!mounted) return;

      if (response['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Added to the waitlist. We will notify you if a slot opens up.',
            ),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              response['error']?['message'] ?? 'Failed to join the waitlist',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to join the waitlist: $e'),
          backgroundColor: AppColors.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isJoiningWaitlist = false;
        });
      }
    }
  }

  String _formatFullDate(DateTime? date) {
    if (date == null) return 'the selected date';
    return DateFormat('EEEE, MMM d, yyyy').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          AppHeader(
            showBackButton: true,
            onBackPressed: () => Navigator.of(context).pop(),
            showNotifications: false,
            showProfile: false,
          ),
          Expanded(child: _buildBody()),
          if (!_isLoading && _errorMessage == null && _appointment != null)
            _buildBottomBar(),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                style: AppTextStyles.bodyMd.copyWith(color: AppColors.error),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadAppointment,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text('Reschedule Appointment', style: AppTextStyles.headlineMd),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              'Pick a new date for the same doctor. Your queue number is re-issued for that date.',
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildCurrentAppointmentCard(),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildCalendar(),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildSelectedDateSummary(),
            const SizedBox(height: spacing.AppSpacing.gutter3xl),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentAppointmentCard() {
    final appointment = _appointment ?? {};
    final doctorName =
        'Dr. ${parseString(appointment['doctor_first_name']) ?? ''} ${parseString(appointment['doctor_last_name']) ?? ''}'
            .trim();
    final currentDate = _parseDate(appointment['appointment_date']);
    final queueNumber = parseInt(appointment['queue_number']);

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Current schedule',
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.secondary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Text(doctorName, style: AppTextStyles.bodyMdMedium),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
          Row(
            children: [
              Icon(
                Icons.calendar_today,
                size: spacing.AppSpacing.iconSm,
                color: AppColors.primary,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterXs),
              Text(
                _formatFullDate(currentDate),
                style: AppTextStyles.bodySm.copyWith(
                  color: AppColors.secondary,
                ),
              ),
              if (queueNumber != null) ...[
                const SizedBox(width: spacing.AppSpacing.gutterMd),
                Icon(
                  Icons.confirmation_number_outlined,
                  size: spacing.AppSpacing.iconSm,
                  color: AppColors.secondary,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Text(
                  '#$queueNumber',
                  style: AppTextStyles.bodySm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCalendar() {
    final today = DateTime.now();
    final days = List.generate(
      7,
      (index) => _weekStart.add(Duration(days: index)),
    );
    final weekLabel =
        '${DateFormat('MMM d').format(_weekStart)} - ${DateFormat('MMM d, yyyy').format(_weekStart.add(const Duration(days: 6)))}';
    final canGoBack = _weekStart.isAfter(_getStartOfWeek(today));

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: canGoBack ? () => _changeWeek(-1) : null,
                icon: const Icon(Icons.chevron_left),
              ),
              Text(weekLabel, style: AppTextStyles.bodyMdMedium),
              IconButton(
                onPressed: () => _changeWeek(1),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          if (_isLoadingAvailability)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: CircularProgressIndicator(),
            )
          else
            Row(
              children: days.map((date) {
                final availability = _availabilityByDate[_dateKey(date)];
                final selectable = _isSelectable(date, availability);
                final isSelected =
                    _selectedDate != null &&
                    _dateKey(_selectedDate!) == _dateKey(date);
                final isCurrent = _isCurrentDate(date);
                final status = parseString(availability?['status']);

                return Expanded(
                  child: GestureDetector(
                    onTap: selectable ? () => _selectDate(date) : null,
                    child: Container(
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      padding: const EdgeInsets.symmetric(
                        vertical: 8,
                        horizontal: 2,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primary
                            : selectable
                            ? AppColors.surfaceLow
                            : AppColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(
                          spacing.AppSpacing.radiusMd,
                        ),
                        border: isCurrent
                            ? Border.all(color: AppColors.tertiary, width: 1.5)
                            : null,
                      ),
                      child: Column(
                        children: [
                          Text(
                            DateFormat('EEE').format(date).substring(0, 1),
                            style: AppTextStyles.labelSm.copyWith(
                              color: isSelected
                                  ? AppColors.onPrimary
                                  : AppColors.secondary,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            DateFormat('d').format(date),
                            style: AppTextStyles.bodyMdMedium.copyWith(
                              color: isSelected
                                  ? AppColors.onPrimary
                                  : selectable
                                  ? AppColors.onSurface
                                  : AppColors.outline,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isSelected
                                  ? AppColors.onPrimary
                                  : status == 'AVAILABLE'
                                  ? AppColors.tertiary
                                  : status == 'FULL'
                                  ? AppColors.urgentAmber
                                  : Colors.transparent,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          if (_isCurrentDateSelectedWeek()) ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              'Your current appointment date is outlined in orange.',
              style: AppTextStyles.labelSm.copyWith(color: AppColors.outline),
            ),
          ],
        ],
      ),
    );
  }

  bool _isCurrentDateSelectedWeek() {
    if (_currentDateKey == null) return false;
    final current = DateTime.tryParse(_currentDateKey!);
    if (current == null) return false;
    return !current.isBefore(_weekStart) &&
        current.isBefore(_weekStart.add(const Duration(days: 7)));
  }

  Widget _buildSelectedDateSummary() {
    if (_selectedDate == null) {
      return AppCard(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Text(
          'Select an available date to continue.',
          style: AppTextStyles.bodySm.copyWith(color: AppColors.secondary),
        ),
      );
    }

    final availability = _availabilityByDate[_dateKey(_selectedDate!)];
    final status = parseString(availability?['status']);
    final capacity = availability?['capacity'];
    final remaining = capacity is Map ? parseInt(capacity['remaining']) : null;

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _formatFullDate(_selectedDate),
            style: AppTextStyles.bodyMdMedium,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
          Row(
            children: [
              Icon(
                status == 'AVAILABLE' ? Icons.check_circle : Icons.info_outline,
                size: spacing.AppSpacing.iconSm,
                color: status == 'AVAILABLE'
                    ? AppColors.tertiary
                    : AppColors.urgentAmber,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterXs),
              Text(
                status == 'AVAILABLE' && remaining != null
                    ? '${_statusLabel(status)} ($remaining slot${remaining == 1 ? '' : 's'} left)'
                    : _statusLabel(status),
                style: AppTextStyles.labelSm.copyWith(
                  color: status == 'AVAILABLE'
                      ? AppColors.tertiary
                      : AppColors.urgentAmber,
                ),
              ),
            ],
          ),
          if (status == 'FULL') ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              'This date is fully booked. You can join the waitlist and we will offer you the next freed slot.',
              style: AppTextStyles.bodySm.copyWith(color: AppColors.secondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    final status = _selectedStatus();
    final canReschedule =
        _selectedDate != null && status == 'AVAILABLE' && !_isSubmitting;

    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest.withValues(alpha: 0.95),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(spacing.AppSpacing.radiusLg),
          topRight: Radius.circular(spacing.AppSpacing.radiusLg),
        ),
        border: Border(
          top: BorderSide(color: AppColors.slate200.withValues(alpha: 0.8)),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (status == 'FULL')
              PrimaryButton(
                text: _isJoiningWaitlist ? 'Joining...' : 'Join Waitlist',
                onPressed: _isJoiningWaitlist ? null : _joinWaitlist,
                icon: const Icon(Icons.hourglass_empty, size: 20),
              )
            else
              PrimaryButton(
                text: _isSubmitting ? 'Rescheduling...' : 'Confirm Reschedule',
                onPressed: canReschedule ? _confirmReschedule : null,
                isLoading: _isSubmitting,
                icon: const Icon(Icons.event_repeat, size: 20),
              ),
          ],
        ),
      ),
    );
  }
}
