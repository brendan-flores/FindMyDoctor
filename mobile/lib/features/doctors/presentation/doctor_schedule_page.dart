import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/primary_button.dart';

class DoctorSchedulePage extends StatefulWidget {
  const DoctorSchedulePage({super.key});

  @override
  State<DoctorSchedulePage> createState() => _DoctorSchedulePageState();
}

class _DoctorSchedulePageState extends State<DoctorSchedulePage> {
  final int _queueNumber = 4;
  final int _slotsLeft = 4;

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
                      _buildTimeSlotsSection(),
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
                  'Dr. Maria Angela Santos, MD',
                  style: AppTextStyles.headlineSm.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  'Adult Cardiology • St. Luke\'s BGC',
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
                        '₱1,000 / consult',
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
                          'Tue & Thu • 9:00 AM – 3:00 PM',
                          style: AppTextStyles.labelMd.copyWith(
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
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                onPressed: () {},
                icon: const Icon(Icons.chevron_left),
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
              ),
              Row(
                children: [
                  Text(
                    'October 2025',
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
                onPressed: () {},
                icon: const Icon(Icons.chevron_right),
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          _buildCalendarGrid(),
        ],
      ),
    );
  }

  Widget _buildCalendarGrid() {
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
        // Calendar days (simplified for demo)
        _buildCalendarRow([29, 30, 1, 2, 3, 4, 5]),
        _buildCalendarRow([6, 7, 8, 9, 10, 11, 12]),
        _buildCalendarRow([13, 14, 15, 16, 17, 18, 19]),
        _buildCalendarRow([20, 21, 22, 23, 24, 25, 26]),
        _buildCalendarRow([27, 28, 29, 30, 31, 1, 2]),
      ],
    );
  }

  Widget _buildCalendarRow(List<int> days) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceAround,
      children: days.map((day) {
        final isSelected = day == 21; // Example selection
        final isToday = day == 8; // Example today
        final isAvailable = day != 23; // Example unavailable day

        return GestureDetector(
          onTap: isAvailable
              ? () {
                  // Date selection logic
                }
              : null,
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.primary
                  : isToday
                      ? AppColors.surfaceContainer
                      : Colors.transparent,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Center(
              child: Text(
                day.toString(),
                style: AppTextStyles.labelSm.copyWith(
                  color: isSelected
                      ? AppColors.onPrimary
                      : isAvailable
                          ? AppColors.onSurface
                          : AppColors.slate400,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildTimeSlotsSection() {
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
                'Selected Day & Queue Summary',
                style: AppTextStyles.headlineSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
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
                        'Queue',
                        style: AppTextStyles.labelSm.copyWith(
                          fontSize: 9,
                          color: AppColors.primaryFixed,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        '#$_queueNumber',
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
                        'Tuesday, Oct 21, 2025',
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
                            '9:00 AM – 3:00 PM',
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
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterSm,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.tertiary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                    border: Border.all(
                      color: AppColors.tertiary.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
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
                        '$_slotsLeft Slots Left',
                        style: AppTextStyles.labelSm.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColors.tertiary,
                        ),
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
          _buildInfoRow(
            Icons.payments,
            'Consultation Fee',
            '₱1,000 (Pay at clinic cashier)',
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
            'Tuesday, Oct 21, 2025',
            style: AppTextStyles.bodyMdMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
          Text(
            '9:00 AM – 3:00 PM',
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.secondary,
            ),
          ),
        ],
      ),
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
                      '₱1,000',
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
                    Text(
                      'Tue, Oct 21, 2025 (Clinic Day)',
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
              onPressed: () {
                Navigator.of(context).pushNamed('/booking-confirmation');
              },
              icon: const Icon(Icons.arrow_forward, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}
