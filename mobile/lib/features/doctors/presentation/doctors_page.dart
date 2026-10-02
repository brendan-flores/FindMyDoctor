import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/models/doctor.dart';
import '../../../core/services/doctor_service.dart';

class DoctorsPage extends StatefulWidget {
  final Function(int)? onNavigateToTab;

  const DoctorsPage({super.key, this.onNavigateToTab});

  @override
  State<DoctorsPage> createState() => _DoctorsPageState();
}

class _DoctorsPageState extends State<DoctorsPage> {
  final DoctorService _doctorService = DoctorService();
  final TextEditingController _searchController = TextEditingController();
  String _selectedSpecialty = 'All';
  final String _selectedHospital = 'All';
  List<Doctor> _doctors = [];
  List<String> _specialties = ['All'];
  List<String> _hospitals = ['All'];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDoctors();
  }

  Future<void> _loadDoctors() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Fetch all doctors first to get unique specialties and hospitals
      final allDoctors = await _doctorService.getDoctors();

      // Extract unique specialties
      final uniqueSpecialties = allDoctors
          .map((d) => d.specialty)
          .where((s) => s.isNotEmpty)
          .toSet()
          .toList()
        ..sort();

      // Extract unique hospitals/clinics
      final uniqueHospitals = allDoctors
          .map((d) => d.practiceName)
          .whereType<String>()
          .where((h) => h.isNotEmpty && h != 'Private Practice')
          .toSet()
          .toList()
        ..sort();

      setState(() {
        _specialties = ['All', ...uniqueSpecialties];
        _hospitals = ['All', ...uniqueHospitals];
      });

      // Apply filters
      final filteredDoctors = _filterDoctors(allDoctors);

      setState(() {
        _doctors = filteredDoctors;
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading doctors: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  List<Doctor> _filterDoctors(List<Doctor> doctors) {
    var filtered = doctors;

    // Filter by specialty
    if (_selectedSpecialty != 'All') {
      filtered = filtered.where((d) => d.specialty == _selectedSpecialty).toList();
    }

    // Filter by hospital/clinic
    if (_selectedHospital != 'All') {
      filtered = filtered.where((d) => d.practiceName != null && d.practiceName == _selectedHospital).toList();
    }

    // Filter by search
    if (_searchController.text.isNotEmpty) {
      final query = _searchController.text.toLowerCase();
      filtered = filtered.where((d) =>
          d.fullName.toLowerCase().contains(query) ||
          d.specialty.toLowerCase().contains(query) ||
          (d.practiceName?.toLowerCase().contains(query) ?? false)
      ).toList();
    }

    return filtered;
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildHeader(),
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.only(bottom: 80), // Space for bottom navigation bar
            child: Column(
              children: [
                _buildSearchBar(),
                _buildLocationIndicator(),
                _buildSpecializations(),
                _buildTopDoctorsSection(),
                _buildHospitalsSection(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterMd,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              Icons.local_hospital,
              color: AppColors.onPrimary,
              size: spacing.AppSpacing.iconLg,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      'FindMyDoctor',
                      style: AppTextStyles.headlineSm.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterXs,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.tertiary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                      ),
                      child: Text(
                        'PH',
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.tertiary,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  'Doctors Directory',
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.onSurfaceVariant,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Stack(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Icon(
                  Icons.person,
                  color: AppColors.onSurfaceVariant,
                  size: spacing.AppSpacing.iconMd,
                ),
              ),
              Positioned(
                bottom: 0,
                right: 0,
                child: Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: AppColors.tertiary,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.surface, width: 2),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterMd,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.slate800.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search doctors, specialties, or clinics...',
                  hintStyle: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.outline,
                  ),
                  prefixIcon: Icon(
                    Icons.search,
                    color: AppColors.outline,
                    size: spacing.AppSpacing.iconLg,
                  ),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.cancel),
                          onPressed: () {
                            _searchController.clear();
                            _loadDoctors();
                          },
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterMd,
                    vertical: spacing.AppSpacing.gutterSm,
                  ),
                ),
                onChanged: (value) {
                  _loadDoctors();
                },
              ),
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
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
                    Icons.tune,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconLg,
                  ),
                ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
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

  Widget _buildLocationIndicator() {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterMd,
      ),
      child: Row(
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
                  Icons.near_me,
                  color: AppColors.tertiary,
                  size: spacing.AppSpacing.iconSm,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Text(
                  'Cebu City, Philippines',
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    color: AppColors.onSurface,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${_doctors.length} Active Doctors',
            style: AppTextStyles.bodyMdMedium.copyWith(
              color: AppColors.tertiary,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpecializations() {
    return Column(
      children: [
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.screenPadding,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    'Specializations',
                    style: AppTextStyles.headlineSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterSm,
                      vertical: spacing.AppSpacing.gutterXs,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainerHigh,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                    ),
                    child: Text(
                      '${_specialties.length - 1}', // Exclude 'All' from count
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.onSecondaryContainer,
                      ),
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: () {},
                child: Row(
                  children: [
                    Text(
                      'See all',
                      style: AppTextStyles.labelMd.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Icon(
                      Icons.chevron_right,
                      color: AppColors.primary,
                      size: spacing.AppSpacing.iconSm,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        SizedBox(
          height: 80,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.screenPadding,
            ),
            itemCount: _specialties.length,
            itemBuilder: (context, index) {
              final specialty = _specialties[index];
              return _buildSpecialtyChip(specialty, index);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSpecialtyChip(String specialty, int index) {
    final isSelected = _selectedSpecialty == specialty;
    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedSpecialty = specialty;
        });
        _loadDoctors();
      },
      child: Container(
        margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterMd,
          vertical: spacing.AppSpacing.gutterSm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceContainerLowest,
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
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.surfaceContainerLowest.withValues(alpha: 0.2)
                    : _getSpecialtyColor(specialty),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: Icon(
                _getSpecialtyIcon(specialty),
                color: isSelected ? AppColors.onPrimary : _getSpecialtyIconColor(specialty),
                size: spacing.AppSpacing.iconMd,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  specialty,
                  style: AppTextStyles.labelMd.copyWith(
                    color: isSelected ? AppColors.onPrimary : AppColors.onSurface,
                    fontWeight: FontWeight.normal,
                  ),
                ),
                Text(
                  '${_getDoctorCountForSpecialty(specialty)} Docs',
                  style: AppTextStyles.labelSm.copyWith(
                    color: isSelected
                        ? AppColors.onPrimary.withValues(alpha: 0.8)
                        : AppColors.onSurfaceVariant,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  int _getDoctorCountForSpecialty(String specialty) {
    if (specialty == 'All') return _doctors.length;
    return _doctors.where((d) => d.specialty == specialty).length;
  }

  Widget _buildTopDoctorsSection() {
    return Column(
      children: [
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.screenPadding,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Top Verified Doctors',
                    style: AppTextStyles.headlineSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'Recommended for your family health plan',
                    style: AppTextStyles.bodyMd.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              Icon(
                Icons.verified,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconLg,
              ),
            ],
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        if (_isLoading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32.0),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_doctors.isEmpty)
          Padding(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterXl),
            child: Column(
              children: [
                Icon(
                  Icons.person_search,
                  size: 64,
                  color: AppColors.outline,
                ),
                const SizedBox(height: 16),
                Text(
                  'No Doctors Found',
                  style: AppTextStyles.headlineSm.copyWith(
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Register doctors to see them here',
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 320,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsets.symmetric(
                horizontal: spacing.AppSpacing.screenPadding,
              ),
              itemCount: _doctors.length,
              itemBuilder: (context, index) {
                return _buildDoctorCard(_doctors[index]);
              },
            ),
          ),
      ],
    );
  }

  Widget _buildDoctorCard(Doctor doctor) {
    return Container(
      width: 288,
      height: 320,
      margin: EdgeInsets.only(right: spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusXl),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          Padding(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
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
                          bottom: 4,
                          right: 4,
                          child: Container(
                            width: 10,
                            height: 10,
                            decoration: BoxDecoration(
                              color: AppColors.tertiary,
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.surfaceContainerLowest, width: 2),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            doctor.fullName,
                            style: AppTextStyles.bodyLgMedium.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            doctor.specialty,
                            style: AppTextStyles.labelSm.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 4),
                          if (doctor.credentials != null && doctor.credentials!.isNotEmpty)
                            Text(
                              doctor.credentials ?? '',
                              style: AppTextStyles.labelSm.copyWith(
                                color: AppColors.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
                _buildDoctorInfoRow(Icons.apartment, doctor.practiceName ?? 'Private Practice'),
                if (doctor.practicePhone != null && doctor.practicePhone!.isNotEmpty)
                  _buildDoctorInfoRow(Icons.phone, doctor.practicePhone ?? ''),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(spacing.AppSpacing.radiusXl),
                bottomRight: Radius.circular(spacing.AppSpacing.radiusXl),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Consultation',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                    Text(
                      '₱${doctor.consultationFeeText ?? '1,000'}',
                      style: AppTextStyles.bodyLgMedium.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                PrimaryButton(
                  text: 'Book Visit',
                  onPressed: () {
                    // Navigate to doctor schedule page
                    widget.onNavigateToTab?.call(2);
                  },
                  height: 40,
                ),
              ],
            ),
          ),
          ],
        ),
      ),
    );
  }

  Widget _buildDoctorInfoRow(IconData icon, String text) {
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterXs),
      child: Row(
        children: [
          Icon(
            icon,
            color: AppColors.outline,
            size: spacing.AppSpacing.iconSm,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Expanded(
            child: Text(
              text,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHospitalsSection() {
    return Column(
      children: [
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.screenPadding,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Hospitals & Medical Centers',
                    style: AppTextStyles.headlineSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'Accredited clinics with real-time digital queue',
                    style: AppTextStyles.bodyMd.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerLowest,
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
                  Icons.map,
                  color: AppColors.onSurfaceVariant,
                  size: spacing.AppSpacing.iconLg,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        SizedBox(
          height: 240,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.screenPadding,
            ),
            itemCount: _hospitals.isNotEmpty ? _hospitals.length : 1,
            itemBuilder: (context, index) {
              if (_hospitals.isEmpty) {
                return _buildEmptyHospitalCard();
              }
              return _buildHospitalCard(_hospitals[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildHospitalCard(String hospitalName) {
    final doctorCount = _doctors.where((d) => d.practiceName != null && d.practiceName == hospitalName).length;

    return Container(
      width: 300,
      height: 240,
      margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusXl),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: double.infinity,
              height: 130,
              decoration: BoxDecoration(
                color: AppColors.primaryFixed,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
              ),
              child: Stack(
                children: [
                  Center(
                    child: Icon(
                      Icons.local_hospital,
                      color: AppColors.primary,
                      size: spacing.AppSpacing.iconXl * 2,
                    ),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterXs,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusSm),
                      ),
                      child: Text(
                        'JCI',
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.onPrimary,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 8,
                    right: 8,
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterSm,
                        vertical: spacing.AppSpacing.gutterXs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surface.withValues(alpha: 0.9),
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.people,
                            color: AppColors.primary,
                            size: spacing.AppSpacing.iconSm,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '$doctorCount',
                            style: AppTextStyles.labelSm.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              hospitalName,
              style: AppTextStyles.bodyMdMedium.copyWith(
                fontWeight: FontWeight.bold,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              'Cebu City, Philippines',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '$doctorCount Doctor${doctorCount != 1 ? 's' : ''}',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyHospitalCard() {
    return Container(
      width: 300,
      height: 240,
      margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusXl),
        border: Border.all(color: AppColors.outline.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.local_hospital_outlined,
              color: AppColors.outline,
              size: spacing.AppSpacing.iconXl * 2,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              'No Hospitals Yet',
              style: AppTextStyles.bodyMdMedium.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Register doctors to see hospitals',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.outline,
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getSpecialtyIcon(String specialty) {
    switch (specialty) {
      case 'Cardiology':
        return Icons.favorite;
      case 'Pediatrics':
        return Icons.child_care;
      case 'Dermatology':
        return Icons.face;
      case 'Dentistry':
        return Icons.mood;
      case 'Orthopedics':
        return Icons.accessibility;
      case 'OB-GYN':
        return Icons.pregnant_woman;
      case 'Ophthalmology':
        return Icons.visibility;
      default:
        return Icons.medical_services;
    }
  }

  Color _getSpecialtyColor(String specialty) {
    switch (specialty) {
      case 'Cardiology':
        return AppColors.errorContainer;
      case 'Pediatrics':
        return AppColors.secondaryFixed;
      case 'Dermatology':
        return AppColors.primaryFixed;
      case 'Dentistry':
        return AppColors.surfaceContainerHigh;
      case 'Orthopedics':
        return AppColors.surfaceContainerHigh;
      case 'OB-GYN':
        return AppColors.tertiaryFixed;
      case 'Ophthalmology':
        return AppColors.surfaceVariant;
      default:
        return AppColors.surfaceContainerLowest;
    }
  }

  Color _getSpecialtyIconColor(String specialty) {
    switch (specialty) {
      case 'Cardiology':
        return AppColors.onErrorContainer;
      case 'Pediatrics':
        return AppColors.onSecondaryFixed;
      case 'Dermatology':
        return AppColors.onPrimaryFixed;
      case 'Dentistry':
        return AppColors.primary;
      case 'Orthopedics':
        return AppColors.onSecondaryFixed;
      case 'OB-GYN':
        return AppColors.onTertiaryFixed;
      case 'Ophthalmology':
        return AppColors.onPrimaryContainer;
      default:
        return AppColors.onSurface;
    }
  }
}
