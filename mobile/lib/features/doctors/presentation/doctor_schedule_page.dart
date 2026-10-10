import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/doctor_service.dart';

class DoctorSchedulePage extends StatefulWidget {
  final String doctorId;
  final String? doctorName;
  final String? specialty;
  final String? clinic;
  final String? consultationFee;

  const DoctorSchedulePage({
    super.key,
    required this.doctorId,
    this.doctorName,
    this.specialty,
    this.clinic,
    this.consultationFee,
  });

  @override
  State<DoctorSchedulePage> createState() => _DoctorSchedulePageState();
}

class _DoctorSchedulePageState extends State<DoctorSchedulePage> {
  final DoctorService _doctorService = DoctorService();
  
  DateTime _currentMonth = DateTime.now();
  DateTime? _selectedDate;
  String? _selectedTimeSlot;
  
  Map<String, dynamic>? _availabilityData;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateTime.now();
    _fetchAvailability();
  }

  Future<void> _fetchAvailability() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final startDate = DateTime(_currentMonth.year, _currentMonth.month, 1);
      final endDate = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
      
      final availability = await _doctorService.getDoctorAvailability(
        doctorId: widget.doctorId,
        startDate: DateFormat('yyyy-MM-dd').format(startDate),
        endDate: DateFormat('yyyy-MM-dd').format(endDate),
      );

      if (availability != null && availability['dates'] != null) {
        setState(() {
          _availabilityData = availability;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = 'No availability data found';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load availability: $e';
        _isLoading = false;
      });
    }
  }

  void _previousMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month - 1);
    });
    _fetchAvailability();
  }

  void _nextMonth() {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + 1);
    });
    _fetchAvailability();
  }

  Map<String, dynamic>? _getDateAvailability(DateTime date) {
    if (_availabilityData == null || _availabilityData!['dates'] == null) {
      return null;
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    final dates = _availabilityData!['dates'] as List;
    
    try {
      return dates.firstWhere((d) => d['date'] == dateStr);
    } catch (e) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Padding(
                  padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: spacing.AppSpacing.gutterMd),
                      _buildHeader(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildDoctorCard(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildCalendarSection(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      if (_selectedDate != null) _buildTimeSlotsSection(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildQueueSummary(),
                      const SizedBox(height: spacing.AppSpacing.gutter3xl),
                    ],
                  ),
                ),
              ),
            ),
            _buildBottomConfirmationBar(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.arrow_back_ios_new),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
        const SizedBox(width: spacing.AppSpacing.gutterSm),
        Text(
          'Doctor Schedule & Date',
          style: AppTextStyles.headlineSm.copyWith(
            fontSize: 15,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildDoctorCard() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Stack(
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.slate800.withValues(alpha: 0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
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
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: AppColors.tertiary,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.surface, width: 2),
                  ),
                  child: Icon(
                    Icons.check,
                    color: AppColors.onTertiary,
                    size: 10,
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
                  widget.doctorName ?? 'Doctor Name',
                  style: AppTextStyles.headlineSm.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  '${widget.specialty ?? 'Specialty'} • ${widget.clinic ?? 'Clinic'}',
                  style: AppTextStyles.bodyMd.copyWith(
                    fontSize: 13,
                    color: AppColors.secondary,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
                Row(
                  children: [
                    Icon(
                      Icons.meeting_room,
                      color: AppColors.primary,
                      size: spacing.AppSpacing.iconSm,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Expanded(
                      child: Text(
                        'Room 412, Medical Arts',
                        style: AppTextStyles.labelSm.copyWith(
                          fontSize: 12,
                          color: AppColors.secondary,
                        ),
                      ),
                    ),
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterSm,
                        vertical: spacing.AppSpacing.gutterXs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                        border: Border.all(color: AppColors.surfaceContainerHighest),
                      ),
                      child: Text(
                        '₱${widget.consultationFee ?? '1,000'} / consult',
                        style: AppTextStyles.labelSm.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
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
    );
  }

  Widget _buildCalendarSection() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  border: Border.all(color: AppColors.surfaceContainerHighest),
                ),
                child: Icon(
                  Icons.calendar_month,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconMd,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Clinic Schedule & Calendar',
                      style: AppTextStyles.headlineSm.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    if (_selectedDate != null) ...[
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: AppColors.tertiary,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterXs),
                          Text(
                            _getWorkingHoursText(_selectedDate!),
                            style: AppTextStyles.labelMd.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: _previousMonth,
                icon: const Icon(Icons.chevron_left),
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
              ),
              Row(
                children: [
                  Text(
                    DateFormat('MMMM yyyy').format(_currentMonth),
                    style: AppTextStyles.bodyMdMedium.copyWith(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterSm,
                      vertical: spacing.AppSpacing.gutterXs,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainer,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                      border: Border.all(color: AppColors.surfaceContainerHighest),
                    ),
                    child: Text(
                      'Regular Clinic',
                      style: AppTextStyles.labelSm.copyWith(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              IconButton(
                onPressed: _nextMonth,
                icon: const Icon(Icons.chevron_right),
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (_isLoading)
            const Center(child: CircularProgressIndicator())
          else if (_errorMessage != null)
            Center(
              child: Text(
                _errorMessage!,
                style: AppTextStyles.bodyMd.copyWith(color: AppColors.error),
              ),
            )
          else
            Column(
              children: [
                _buildCalendarGrid(),
                const SizedBox(height: spacing.AppSpacing.gutterMd),
                _buildCalendarLegend(),
              ],
            ),
        ],
      ),
    );
  }

  String _getWorkingHoursText(DateTime date) {
    final availability = _getDateAvailability(date);
    if (availability == null || availability['workingHours'] == null) {
      return 'No schedule';
    }

    final workingHours = availability['workingHours'] as List;
    if (workingHours.isEmpty) {
      return 'Not available';
    }

    final first = workingHours.first;
    final last = workingHours.last;
    return '${first['start']} – ${last['end']}';
  }

  Widget _buildCalendarGrid() {
    final firstDayOfMonth = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDayOfMonth = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    final startWeekday = firstDayOfMonth.weekday % 7; // 0 = Sunday
    final totalDays = lastDayOfMonth.day;

    return Column(
      children: [
        // Weekday headers
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
              .map((day) => Text(
                    day,
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.slate400,
                      fontWeight: FontWeight.bold,
                      fontSize: 11,
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        // Calendar days
        ...List.generate(6, (weekIndex) {
          final weekDays = <Widget>[];
          
          for (int dayIndex = 0; dayIndex < 7; dayIndex++) {
            final dayNumber = weekIndex * 7 + dayIndex - startWeekday + 1;
            
            if (dayNumber > 0 && dayNumber <= totalDays) {
              final date = DateTime(_currentMonth.year, _currentMonth.month, dayNumber);
              final availability = _getDateAvailability(date);
              final status = availability?['status'] ?? 'NON_WORKING';
              final isSelected = _selectedDate != null && 
                  date.year == _selectedDate!.year &&
                  date.month == _selectedDate!.month &&
                  date.day == _selectedDate!.day;
              
              weekDays.add(
                Expanded(
                  child: _buildCalendarDay(dayNumber, status, isSelected, date),
                ),
              );
            } else {
              weekDays.add(const Expanded(child: SizedBox()));
            }
          }
          
          return Padding(
            padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterXs),
            child: Row(children: weekDays),
          );
        }),
      ],
    );
  }

  Widget _buildCalendarDay(int day, String status, bool isSelected, DateTime date) {
    final isAvailable = status == 'AVAILABLE';
    final isFull = status == 'FULL';
    final isUnavailable = status == 'UNAVAILABLE';
    final isPast = status == 'PAST';
    final isNonWorking = status == 'NON_WORKING';

    Color? backgroundColor;
    Color? textColor;
    
    if (isSelected) {
      backgroundColor = AppColors.primary;
      textColor = AppColors.onPrimary;
    } else if (isPast) {
      backgroundColor = null;
      textColor = AppColors.slate300;
    } else if (isUnavailable) {
      backgroundColor = AppColors.errorContainer.withValues(alpha: 0.3);
      textColor = AppColors.error;
    } else if (isFull) {
      backgroundColor = AppColors.surfaceContainerHighest;
      textColor = AppColors.slate400;
    } else if (isNonWorking) {
      backgroundColor = null;
      textColor = AppColors.slate400;
    } else {
      backgroundColor = null;
      textColor = AppColors.onSurface;
    }

    return GestureDetector(
      onTap: isAvailable
          ? () {
              setState(() {
                _selectedDate = date;
                _selectedTimeSlot = null;
              });
            }
          : null,
      child: Container(
        margin: EdgeInsets.symmetric(horizontal: 2),
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          border: isSelected ? null : Border.all(
            color: isAvailable ? AppColors.primary.withValues(alpha: 0.3) : Colors.transparent,
            width: 1,
          ),
        ),
        child: Center(
          child: Text(
            day.toString(),
            style: AppTextStyles.labelSm.copyWith(
              color: textColor,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTimeSlotsSection() {
    if (_selectedDate == null) return const SizedBox();

    final availability = _getDateAvailability(_selectedDate!);
    if (availability == null) {
      return AppCard(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Text(
          'No availability data for selected date',
          style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
        ),
      );
    }

    final timeSlots = availability['timeSlots'] as List?;
    final capacity = availability['capacity'] as Map?;

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.confirmation_number,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconMd,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Text(
                'Available Time Slots',
                style: AppTextStyles.headlineSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (capacity != null)
            Container(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.surfaceContainer,
                    AppColors.surfaceContainer.withValues(alpha: 0.6),
                  ],
                ),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                border: Border.all(color: AppColors.surfaceContainerHighest),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Slots',
                          style: AppTextStyles.labelSm.copyWith(
                            fontSize: 9,
                            color: AppColors.primaryFixed,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${capacity['remaining'] ?? 0}',
                          style: AppTextStyles.queueNum.copyWith(
                            fontSize: 22,
                            color: AppColors.onPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterMd),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DateFormat('EEEE, MMM d, yyyy').format(_selectedDate!),
                          style: AppTextStyles.bodyMdMedium.copyWith(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterXs),
                        Row(
                          children: [
                            Icon(
                              Icons.schedule,
                              color: AppColors.primary,
                              size: spacing.AppSpacing.iconSm,
                            ),
                            const SizedBox(width: spacing.AppSpacing.gutterXs),
                            Text(
                              _getWorkingHoursText(_selectedDate!),
                              style: AppTextStyles.labelSm.copyWith(
                                fontSize: 12,
                                color: AppColors.secondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Divider(color: AppColors.slate200),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (timeSlots == null || timeSlots.isEmpty)
            Text(
              'No available time slots',
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
            )
          else
            Wrap(
              spacing: spacing.AppSpacing.gutterSm,
              runSpacing: spacing.AppSpacing.gutterSm,
              children: timeSlots.map<Widget>((slot) {
                final start = slot['start'];
                final end = slot['end'];
                final isAvailable = slot['isAvailable'];
                final slotStatus = slot['status'];
                final isSelected = _selectedTimeSlot == start;

                Color? backgroundColor;
                Color? textColor;
                String? labelText;

                if (isSelected) {
                  backgroundColor = AppColors.primary;
                  textColor = AppColors.onPrimary;
                } else if (slotStatus == 'BREAK') {
                  backgroundColor = AppColors.errorContainer.withValues(alpha: 0.3);
                  textColor = AppColors.error;
                  labelText = 'Break';
                } else if (slotStatus == 'PAST') {
                  backgroundColor = AppColors.surfaceContainerHighest;
                  textColor = AppColors.slate400;
                } else if (slotStatus == 'BOOKED') {
                  backgroundColor = AppColors.surfaceContainerHighest;
                  textColor = AppColors.slate400;
                  labelText = 'Booked';
                } else if (slotStatus == 'FULL') {
                  backgroundColor = AppColors.surfaceContainerHighest;
                  textColor = AppColors.slate400;
                  labelText = 'Full';
                } else if (isAvailable) {
                  backgroundColor = AppColors.surfaceContainer;
                  textColor = AppColors.onSurface;
                } else {
                  backgroundColor = AppColors.surfaceContainerHighest;
                  textColor = AppColors.slate400;
                }

                return GestureDetector(
                  onTap: isAvailable
                      ? () {
                          setState(() {
                            _selectedTimeSlot = start;
                          });
                        }
                      : null,
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterMd,
                      vertical: spacing.AppSpacing.gutterSm,
                    ),
                    decoration: BoxDecoration(
                      color: backgroundColor,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : isAvailable
                                ? AppColors.primary.withValues(alpha: 0.3)
                                : AppColors.slate300,
                        width: 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '$start - $end',
                          style: AppTextStyles.labelSm.copyWith(
                            color: textColor,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                        if (labelText != null) ...[
                          const SizedBox(width: 4),
                          Container(
                            padding: EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: slotStatus == 'BREAK'
                                  ? AppColors.error.withValues(alpha: 0.1)
                                  : AppColors.slate300.withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              labelText,
                              style: AppTextStyles.labelSm.copyWith(
                                fontSize: 9,
                                color: slotStatus == 'BREAK'
                                    ? AppColors.error
                                    : AppColors.slate600,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          _buildInfoRow(
            Icons.payments,
            'Consultation Fee',
            '₱${widget.consultationFee ?? '1,000'} (Pay at clinic cashier)',
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          _buildInfoRow(
            Icons.access_time,
            'Est. Wait Time',
            '~45 minutes',
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(
              icon,
              color: AppColors.secondary,
              size: spacing.AppSpacing.iconMd,
            ),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            Text(
              label,
              style: AppTextStyles.labelSm.copyWith(
                fontSize: 12,
                color: AppColors.secondary,
              ),
            ),
          ],
        ),
        Text(
          value,
          style: AppTextStyles.labelSm.copyWith(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: AppColors.onSurface,
          ),
        ),
      ],
    );
  }

  Widget _buildQueueSummary() {
    if (_selectedDate == null) return const SizedBox();

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Selected Date',
            style: AppTextStyles.labelSm.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Text(
            DateFormat('EEEE, MMM d, yyyy').format(_selectedDate!),
            style: AppTextStyles.bodyMdMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
          Text(
            _selectedTimeSlot != null
                ? '$_selectedTimeSlot - ${_getEndTime(_selectedTimeSlot!)}'
                : _getWorkingHoursText(_selectedDate!),
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.secondary,
            ),
          ),
        ],
      ),
    );
  }

  String _getEndTime(String startTime) {
    final parts = startTime.split(':');
    final hours = int.parse(parts[0]);
    final minutes = int.parse(parts[1]);
    final totalMinutes = hours * 60 + minutes + 30;
    final endHours = totalMinutes ~/ 60;
    final endMinutes = totalMinutes % 60;
    return '${endHours.toString().padLeft(2, '0')}:${endMinutes.toString().padLeft(2, '0')}';
  }

  Widget _buildCalendarLegend() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterSm),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      ),
      child: Wrap(
        spacing: spacing.AppSpacing.gutterMd,
        runSpacing: spacing.AppSpacing.gutterSm,
        children: [
          _buildLegendItem(AppColors.primary, 'Available'),
          _buildLegendItem(AppColors.slate400, 'Past'),
          _buildLegendItem(AppColors.error.withValues(alpha: 0.3), 'Unavailable'),
          _buildLegendItem(AppColors.surfaceContainerHighest, 'Full'),
          _buildLegendItem(AppColors.slate400, 'Non-working'),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTextStyles.labelSm.copyWith(
            fontSize: 10,
            color: AppColors.secondary,
          ),
        ),
      ],
    );
  }

  Widget _buildBottomConfirmationBar() {
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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Total',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                    Text(
                      '₱${widget.consultationFee ?? '1,000'}',
                      style: AppTextStyles.headlineMd.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Pay at clinic',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.slate600,
                      ),
                    ),
                    if (_selectedDate != null)
                      Text(
                        DateFormat('EEE, MMM d, yyyy').format(_selectedDate!),
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.tertiary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            PrimaryButton(
              text: 'Confirm Clinic Date & Reserve Queue',
              onPressed: _selectedDate != null && _selectedTimeSlot != null
                  ? () {
                      Navigator.of(context).pushNamed('/booking-confirmation');
                    }
                  : null,
              icon: const Icon(Icons.arrow_forward, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}
