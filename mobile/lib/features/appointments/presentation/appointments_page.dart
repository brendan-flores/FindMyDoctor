import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';

class AppointmentsPage extends StatefulWidget {
  const AppointmentsPage({super.key});

  @override
  State<AppointmentsPage> createState() => _AppointmentsPageState();
}

class _AppointmentsPageState extends State<AppointmentsPage> {
  String _selectedFilter = 'upcoming';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
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
    );
  }

  Widget _buildHeader() {
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
                    '2 Active',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.onPrimary,
                    ),
                  ),
                ),
              ],
            ),
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
              ),
              child: Icon(
                Icons.history_edu,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconMd,
              ),
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
            child: _buildFilterTab('Upcoming', '2', 'upcoming'),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Expanded(
            child: _buildFilterTab('Completed', '4', 'completed'),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Expanded(
            child: _buildFilterTab('Cancelled', '1', 'cancelled'),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label, String count, String filter) {
    final isSelected = _selectedFilter == filter;
    return InkWell(
      onTap: () {
        setState(() {
          _selectedFilter = filter;
        });
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
                  count,
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
    switch (_selectedFilter) {
      case 'upcoming':
        return _buildUpcomingAppointments();
      case 'completed':
        return _buildCompletedAppointments();
      case 'cancelled':
        return _buildCancelledAppointments();
      default:
        return _buildUpcomingAppointments();
    }
  }

  Widget _buildUpcomingAppointments() {
    return Column(
      children: [
        _buildUpcomingAppointmentCard1(),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildUpcomingAppointmentCard2(),
      ],
    );
  }

  Widget _buildUpcomingAppointmentCard1() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusXl),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top accent bar
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: AppColors.primaryContainer,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(spacing.AppSpacing.radiusXl),
                topRight: Radius.circular(spacing.AppSpacing.radiusXl),
              ),
            ),
          ),
          Padding(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header badges
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterSm,
                        vertical: spacing.AppSpacing.gutterXs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.tertiaryContainer.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: AppColors.tertiary,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterXs),
                          Text(
                            'Confirmed • Queue #04',
                            style: AppTextStyles.labelMd.copyWith(
                              color: AppColors.onTertiaryContainer,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
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
                        const SizedBox(width: spacing.AppSpacing.gutterXs),
                        Icon(
                          Icons.more_vert,
                          color: AppColors.outline,
                          size: spacing.AppSpacing.iconSm,
                        ),
                      ],
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
                            'Dr. Maria Angela Santos, MD',
                            style: AppTextStyles.headlineSm,
                          ),
                          Text(
                            'Adult Cardiology • Echocardiology',
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
                                  'St. Luke\'s BGC • Rm 412, MAB',
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
                  child: Column(
                    children: [
                      Row(
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
                                    'Tuesday, Oct 21, 2025',
                                    style: AppTextStyles.bodyMdMedium,
                                  ),
                                  Text(
                                    '09:45 AM • Clinic opens 9:00 AM',
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
                      const SizedBox(height: spacing.AppSpacing.gutterMd),
                      // Queue info
                      Container(
                        padding: EdgeInsets.all(spacing.AppSpacing.gutterSm),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceLowest,
                          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  Icons.radio_button_checked,
                                  color: AppColors.tertiary,
                                  size: spacing.AppSpacing.iconMd,
                                ),
                                const SizedBox(width: spacing.AppSpacing.gutterSm),
                                Text(
                                  'Now Serving: ',
                                  style: AppTextStyles.bodyMdMedium,
                                ),
                                Text(
                                  '#01',
                                  style: AppTextStyles.headlineSm.copyWith(
                                    color: AppColors.tertiary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              'Est. wait: ',
                              style: AppTextStyles.labelSm.copyWith(
                                color: AppColors.secondary,
                              ),
                            ),
                            Text(
                              '~45 min',
                              style: AppTextStyles.labelSm.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
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
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUpcomingAppointmentCard2() {
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
                  color: AppColors.secondaryContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.event_available,
                      size: spacing.AppSpacing.iconSm,
                      color: AppColors.onSecondaryContainer,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Text(
                      'Scheduled • Follow-up',
                      style: AppTextStyles.labelMd.copyWith(
                        color: AppColors.onSecondaryContainer,
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
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.verified,
                        color: AppColors.onPrimary,
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
                      'Dr. Rafael Cruz, MD',
                      style: AppTextStyles.headlineSm,
                    ),
                    Text(
                      'Pediatrics • Developmental Specialist',
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
                            'The Medical City • Rm 208, Pod B',
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
                        Icons.calendar_today,
                        color: AppColors.primary,
                        size: spacing.AppSpacing.iconMd,
                      ),
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Friday, Oct 24, 2025',
                          style: AppTextStyles.bodyMdMedium,
                        ),
                        Text(
                          '02:00 PM • Slot 6',
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
                      '₱900',
                      style: AppTextStyles.headlineSm,
                    ),
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
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.surfaceLow,
                      foregroundColor: AppColors.onSurface,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.touch_app,
                          color: AppColors.primary,
                          size: spacing.AppSpacing.iconMd,
                        ),
                        const SizedBox(width: spacing.AppSpacing.gutterSm),
                        Text(
                          'Check-in Online',
                          style: AppTextStyles.bodyMdMedium,
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
                  color: AppColors.surfaceLowest,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                ),
                child: Icon(
                  Icons.edit_calendar,
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

  Widget _buildCompletedAppointments() {
    return Column(
      children: [
        _buildCompletedAppointmentCard(),
      ],
    );
  }

  Widget _buildCompletedAppointmentCard() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header badges
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.check_circle,
                      size: spacing.AppSpacing.iconSm,
                      color: AppColors.tertiary,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Text(
                      'Completed • Oct 05, 2025',
                      style: AppTextStyles.labelMd.copyWith(
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
                  color: AppColors.tertiaryContainer.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.medication,
                      size: spacing.AppSpacing.iconSm,
                      color: AppColors.tertiary,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Text(
                      '2 Meds Issued',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.tertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Doctor info
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
                      'Dra. Kristine Lim, DPDS',
                      style: AppTextStyles.headlineSm,
                    ),
                    Text(
                      'Dermatology • Skin Health',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
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
                            'Asian Hospital • Suite 514',
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
          // Notes preview
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
                    Icon(
                      Icons.description,
                      color: AppColors.primary,
                      size: spacing.AppSpacing.iconMd,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Expanded(
                      child: Text(
                        'Diagnosis: Contact Dermatitis (Resolved)',
                        style: AppTextStyles.bodyMd,
                      ),
                    ),
                  ],
                ),
                Icon(
                  Icons.chevron_right,
                  color: AppColors.outline,
                  size: spacing.AppSpacing.iconMd,
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
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.surfaceLow,
                      foregroundColor: AppColors.onSurface,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.description,
                          color: AppColors.primary,
                          size: spacing.AppSpacing.iconMd,
                        ),
                        const SizedBox(width: spacing.AppSpacing.gutterSm),
                        Text(
                          'View e-Prescription',
                          style: AppTextStyles.bodyMdMedium,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Container(
                height: 44,
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterMd,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                ),
                child: Icon(
                  Icons.replay,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconMd,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCancelledAppointments() {
    return Column(
      children: [
        _buildCancelledAppointmentCard(),
      ],
    );
  }

  Widget _buildCancelledAppointmentCard() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusXl),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Opacity(
        opacity: 0.9,
        child: Padding(
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
                      color: AppColors.errorContainer,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.cancel,
                          size: spacing.AppSpacing.iconSm,
                          color: AppColors.onErrorContainer,
                        ),
                        const SizedBox(width: spacing.AppSpacing.gutterXs),
                        Text(
                          'Cancelled by Patient',
                          style: AppTextStyles.labelMd.copyWith(
                            color: AppColors.onErrorContainer,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    'Sep 18, 2025',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.secondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              // Doctor info
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
                          'Dr. Antonio Ramos',
                          style: AppTextStyles.headlineSm,
                        ),
                        Text(
                          'General Internal Medicine',
                          style: AppTextStyles.bodyMdMedium.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterXs),
                        Text(
                          'Reason: Schedule conflict • Refund processed',
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.error,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              // Action button
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Container(
                    height: 44,
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterLg,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.event,
                          color: AppColors.primary,
                          size: spacing.AppSpacing.iconMd,
                        ),
                        const SizedBox(width: spacing.AppSpacing.gutterSm),
                        Text(
                          'Re-book Consultation',
                          style: AppTextStyles.bodyMdMedium,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}