import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../appointments/presentation/appointments_page.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: IndexedStack(
          index: _currentIndex,
          children: [
            _buildHomeContent(),
            _buildAppointmentsContent(),
            _buildChatContent(),
            _buildProfileContent(),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  Widget _buildHomeContent() {
    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            _buildHeader(),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildSearchBar(),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildSpecialties(),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildQuickActions(),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildRecommendedDoctors(),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildNearbyClinics(),
            const SizedBox(height: spacing.AppSpacing.gutter3xl),
          ],
        ),
      ),
    );
  }

  Widget _buildAppointmentsContent() {
    return const AppointmentsPage();
  }

  Widget _buildChatContent() {
    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              'Secretary Chat',
              style: AppTextStyles.headlineLg,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            SizedBox(
              height: MediaQuery.of(context).size.height - 200,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.chat_bubble,
                      size: 64,
                      color: AppColors.secondary,
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    Text(
                      'No conversations yet',
                      style: AppTextStyles.bodyMd.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterSm),
                    Text(
                      'Start a conversation with a clinic secretary',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.outline,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileContent() {
    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              'My Profile',
              style: AppTextStyles.headlineLg,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            SizedBox(
              height: MediaQuery.of(context).size.height - 200,
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.account_circle,
                      size: 64,
                      color: AppColors.secondary,
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterMd),
                    Text(
                      'Juan Reyes',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      'user@gmail.com',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.outline,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Magandang umaga',
              style: AppTextStyles.bodyMdMedium.copyWith(
                color: AppColors.secondary,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              'Juan Reyes',
              style: AppTextStyles.headlineMd,
            ),
          ],
        ),
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: AppColors.surfaceLow,
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
            boxShadow: [
              BoxShadow(
                color: AppColors.slate800.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Stack(
            children: [
              Center(
                child: Icon(
                  Icons.notifications_outlined,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconLg,
                ),
              ),
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.surface, width: 2),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterXs,
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
                hintText: 'Search doctor, specialty, St. Luke\'s...',
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
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              Icons.tune,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpecialties() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSpecialtyChip('All Doctors', Icons.medical_services, true),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        SizedBox(
          height: 40,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _buildSpecialtyChip('Pediatrics', Icons.child_care, false),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              _buildSpecialtyChip('Dermatology', Icons.face_retouching_natural, false),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              _buildSpecialtyChip('Dentistry', Icons.sentiment_satisfied, false),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              _buildSpecialtyChip('OB-GYN', Icons.pregnant_woman, false),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              _buildSpecialtyChip('Cardiology', Icons.favorite, false),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              _buildSpecialtyChip('ENT', Icons.hearing, false),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSpecialtyChip(String label, IconData icon, bool isSelected) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterMd,
        vertical: spacing.AppSpacing.gutterXs,
      ),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.primary : AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: spacing.AppSpacing.iconMd,
            color: isSelected ? AppColors.onPrimary : AppColors.tertiary,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Text(
            label,
            style: AppTextStyles.labelMd.copyWith(
              color: isSelected ? AppColors.onPrimary : AppColors.secondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: spacing.AppSpacing.gutterMd,
      crossAxisSpacing: spacing.AppSpacing.gutterMd,
      childAspectRatio: 2.2,
      children: [
        _buildQuickActionCard(
          'Find a Doctor',
          'By specialty',
          Icons.medical_services,
          AppColors.primaryFixed,
          AppColors.primary,
        ),
        _buildQuickActionCard(
          'My Appointments',
          'Schedules',
          Icons.calendar_month,
          AppColors.secondaryContainer,
          AppColors.secondary,
        ),
        _buildQuickActionCard(
          'Secretary Chat',
          'Inquiries',
          Icons.chat,
          AppColors.tertiary.withValues(alpha: 0.1),
          AppColors.tertiary,
        ),
        _buildQuickActionCard(
          'My Profile',
          'Settings',
          Icons.person,
          AppColors.primaryContainer.withValues(alpha: 0.15),
          AppColors.primaryContainer,
        ),
      ],
    );
  }

  Widget _buildQuickActionCard(
    String title,
    String subtitle,
    IconData icon,
    Color iconBgColor,
    Color iconColor,
  ) {
    return AppCard(
      onTap: () {
        if (title == 'Find a Doctor') {
          Navigator.of(context).pushNamed('/doctor-schedule');
        }
      },
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: spacing.AppSpacing.iconLg,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: AppTextStyles.bodyMdMedium,
                ),
                Text(
                  subtitle,
                  style: AppTextStyles.labelSm,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendedDoctors() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Recommended Doctors',
                  style: AppTextStyles.headlineSm,
                ),
                Text(
                  'Family health specialists',
                  style: AppTextStyles.labelSm,
                ),
              ],
            ),
            TextButton(
              onPressed: () {},
              child: Text(
                'See all',
                style: AppTextStyles.labelMd,
              ),
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        _buildDoctorCard(
          'Dr. Rafael Cruz, MD',
          'Pediatrics • Medical City',
          '₱700',
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        _buildDoctorCard(
          'Dra. Lim',
          'Dermatology • St. Luke\'s',
          '₱800',
        ),
      ],
    );
  }

  Widget _buildDoctorCard(String name, String specialty, String fee) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              Icons.person,
              color: AppColors.outline,
              size: spacing.AppSpacing.iconLg,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: AppTextStyles.bodyMdMedium,
                ),
                Text(
                  specialty,
                  style: AppTextStyles.labelSm,
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  fee,
                  style: AppTextStyles.labelSm.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 60,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).pushNamed('/doctor-schedule');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.onPrimary,
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                ),
              ),
              child: Text(
                'Book',
                style: AppTextStyles.labelSm,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNearbyClinics() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Accredited Nearby',
                  style: AppTextStyles.headlineSm,
                ),
                Text(
                  'Walk-ins & queue updates available',
                  style: AppTextStyles.labelSm,
                ),
              ],
            ),
            Icon(
              Icons.near_me,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        _buildClinicCard(
          'Healthway Multi-Specialty',
          'Market! Market! BGC • 0.8 km',
          '4 On Duty',
          AppColors.secondaryContainer,
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        _buildClinicCard(
          'Kindred Health Clinic',
          'Serendra Piazza, BGC • 1.2 km',
          'Women & Pedia',
          AppColors.surfaceContainer,
        ),
      ],
    );
  }

  Widget _buildClinicCard(String name, String location, String status, Color statusColor) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              Icons.local_hospital,
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
                  name,
                  style: AppTextStyles.bodyMdMedium,
                ),
                Text(
                  location,
                  style: AppTextStyles.labelSm,
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
              color: statusColor,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
            ),
            child: Text(
              status,
              style: AppTextStyles.labelSm,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNavigation() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(color: AppColors.slate200.withValues(alpha: 0.5)),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.gutterMd,
            vertical: spacing.AppSpacing.gutterSm,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(Icons.local_hospital, 'Home', 0),
              _buildNavItem(Icons.calendar_month, 'Appointments', 1),
              _buildNavItem(Icons.chat_bubble, 'Chat', 2),
              _buildNavItem(Icons.account_circle, 'Profile', 3),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, int index) {
    final isActive = _currentIndex == index;
    return InkWell(
      onTap: () {
        setState(() {
          _currentIndex = index;
        });
      },
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterSm,
          vertical: spacing.AppSpacing.gutterSm,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isActive ? AppColors.primaryContainer : AppColors.secondary,
              size: spacing.AppSpacing.iconLg,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              label,
              style: AppTextStyles.labelSm.copyWith(
                color: isActive ? AppColors.primaryContainer : AppColors.secondary,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
