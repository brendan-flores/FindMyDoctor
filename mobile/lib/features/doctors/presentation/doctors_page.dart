import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/models/doctor.dart';
import '../../../core/services/doctor_service.dart';

class DoctorsPage extends StatefulWidget {
  final String? specialty;
  final Function(int)? onNavigateToTab;
  final VoidCallback? onClearSpecialtyFromHome;

  const DoctorsPage({
    super.key,
    this.specialty,
    this.onNavigateToTab,
    this.onClearSpecialtyFromHome,
  });

  @override
  State<DoctorsPage> createState() => _DoctorsPageState();
}

class _DoctorsPageState extends State<DoctorsPage> {
  final DoctorService _doctorService = DoctorService();
  final TextEditingController _searchController = TextEditingController();
  String _selectedSpecialty = 'All';
  String _selectedHospital = 'All';
  bool _verifiedOnlyFilter = false;
  List<Doctor> _doctors = [];
  List<Doctor> _allDoctors = []; // Store all doctors for counting
  List<String> _specialties = ['All'];
  List<String> _hospitals = ['All'];
  bool _isLoading = true;

  bool get _isFilteredListView =>
      _selectedSpecialty != 'All' ||
      _verifiedOnlyFilter ||
      _selectedHospital != 'All';

  List<String> get _displayHospitals =>
      _hospitals.where((h) => h != 'All' && h.isNotEmpty).toList();

  @override
  void initState() {
    super.initState();
    // Set the initial specialty if provided from HomePage
    if (widget.specialty != null && widget.specialty!.isNotEmpty) {
      _selectedSpecialty = widget.specialty!;
    }
    _loadDoctors();
  }

  @override
  void didUpdateWidget(DoctorsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.specialty != oldWidget.specialty) {
      if (widget.specialty != null && widget.specialty!.isNotEmpty) {
        setState(() {
          _selectedSpecialty = widget.specialty!;
          _selectedHospital = 'All';
          _verifiedOnlyFilter = false;
        });
        _loadDoctors();
      } else if (oldWidget.specialty != null &&
          oldWidget.specialty!.isNotEmpty &&
          _selectedSpecialty == oldWidget.specialty) {
        _clearAllFilters();
      }
    }
  }

  Future<void> _loadDoctors() async {
    setState(() {
      _isLoading = true;
    });

    try {
      // Fetch all doctors once (backend already filters for approval_status = 'ACTIVE')
      final allDoctors = await _doctorService.getDoctors();

      // Apply filters client-side for better performance
      var doctors = allDoctors;

      // Filter by specialty
      if (_selectedSpecialty != 'All') {
        doctors = doctors.where((d) => d.specialty == _selectedSpecialty).toList();
      }

      // Filter by hospital/clinic
      if (_selectedHospital != 'All') {
        doctors = doctors.where((d) => d.practiceName != null && d.practiceName == _selectedHospital).toList();
      }

      // Filter by verified status
      if (_verifiedOnlyFilter) {
        doctors = doctors.where((d) => d.isApproved).toList();
      }

      // Filter by search
      if (_searchController.text.isNotEmpty) {
        final query = _searchController.text.toLowerCase();
        doctors = doctors.where((d) =>
            d.fullName.toLowerCase().contains(query) ||
            d.specialty.toLowerCase().contains(query) ||
            (d.practiceName?.toLowerCase().contains(query) ?? false)
        ).toList();
      }

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
          .where((h) => h.isNotEmpty)
          .toSet()
          .toList()
        ..sort();

      setState(() {
        _allDoctors = allDoctors;
        _specialties = ['All', ...uniqueSpecialties];
        _hospitals = ['All', ...uniqueHospitals];
        _doctors = doctors;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _clearAllFilters({bool navigateHome = false}) {
    setState(() {
      _selectedSpecialty = 'All';
      _selectedHospital = 'All';
      _verifiedOnlyFilter = false;
    });
    widget.onClearSpecialtyFromHome?.call();
    _loadDoctors();
    if (navigateHome) {
      widget.onNavigateToTab?.call(0);
    }
  }

  String _formatConsultationFee(Doctor doctor) {
    final amount = doctor.consultationFee > 0 ? doctor.consultationFee.round() : 1000;
    final digits = amount.toString();
    final buffer = StringBuffer('₱');
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) {
        buffer.write(',');
      }
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildHeader(),
        Expanded(
          child: _isFilteredListView
              ? _buildFilteredDoctorListView()
              : SingleChildScrollView(
                  padding: const EdgeInsets.only(bottom: 80),
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

  Widget _buildFilteredDoctorListView() {
    return Column(
      children: [
        _buildSearchBar(),
        _buildFilterChips(),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _doctors.isEmpty
                  ? _buildEmptyDoctorsState()
                  : ListView.builder(
                      padding: EdgeInsets.only(
                        left: spacing.AppSpacing.screenPadding,
                        right: spacing.AppSpacing.screenPadding,
                        top: spacing.AppSpacing.gutterSm,
                        bottom: 80,
                      ),
                      itemCount: _doctors.length,
                      itemBuilder: (context, index) {
                        return Padding(
                          padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
                          child: _buildDetailedDoctorCard(_doctors[index]),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  Widget _buildEmptyDoctorsState() {
    return Padding(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterXl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
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
            'Try adjusting your filters or search',
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    if (_isFilteredListView) {
      final fromHomeSpecialty = widget.specialty != null &&
          widget.specialty!.isNotEmpty &&
          _selectedSpecialty == widget.specialty;

      String chipLabel;
      IconData chipIcon;
      if (_selectedSpecialty != 'All') {
        chipLabel = _selectedSpecialty;
        chipIcon = _getSpecialtyIcon(_selectedSpecialty);
      } else if (_selectedHospital != 'All') {
        chipLabel = _selectedHospital;
        chipIcon = Icons.local_hospital;
      } else {
        chipLabel = 'Verified Doctors';
        chipIcon = Icons.verified;
      }

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
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () {
                if (fromHomeSpecialty) {
                  _clearAllFilters(navigateHome: true);
                } else {
                  _clearAllFilters();
                }
              },
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            // Specialty chip
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
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    chipIcon,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconSm,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterXs),
                  Text(
                    chipLabel,
                    style: AppTextStyles.labelMd.copyWith(
                      color: AppColors.onSecondaryFixed,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            Text(
              '${_doctors.length} Available',
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const Spacer(),
            TextButton(
              onPressed: _clearAllFilters,
              child: Row(
                children: [
                  Text(
                    'Change',
                    style: AppTextStyles.labelMd.copyWith(
                      color: AppColors.primary,
                    ),
                  ),
                  Icon(
                    Icons.expand_more,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconSm,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // Default header for normal doctors tab navigation
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
          // Logo with PH badge
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'FindMyDoctor',
                        style: AppTextStyles.headlineSm.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
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
                            letterSpacing: 0.5,
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
            ],
          ),
          const Spacer(),
          // Notifications icon with red dot
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined),
                onPressed: () {},
              ),
              Positioned(
                top: 10,
                right: 10,
                child: Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.surface, width: 2),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          // Profile picture with green dot
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
                  setState(() {});
                  _loadDoctors();
                },
              ),
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          // Filter button with dot indicator
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
                      color: AppColors.primaryContainer,
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

  Widget _buildFilterChips() {
    if (!_isFilteredListView) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterSm,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildFilterChip('All', _selectedHospital == 'All' && !_verifiedOnlyFilter),
            _buildFilterChip('Available Today', false, showDot: true),
            ..._displayHospitals.take(3).map((hospital) =>
              _buildFilterChip(hospital, _selectedHospital == hospital)),
            _buildFilterChip('Top Rated', _verifiedOnlyFilter, showStar: true),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, bool isActive, {bool showDot = false, bool showStar = false}) {
    // Determine actual active state based on current filters
    bool isActuallyActive = isActive;
    if (label == 'All') {
      isActuallyActive = _selectedHospital == 'All' && !_verifiedOnlyFilter;
    } else if (label == 'Top Rated') {
      isActuallyActive = _verifiedOnlyFilter;
    } else if (_displayHospitals.contains(label)) {
      isActuallyActive = _selectedHospital == label;
    }

    return Container(
      margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
      child: GestureDetector(
        onTap: () {
          setState(() {
            if (label == 'All') {
              _selectedHospital = 'All';
              _verifiedOnlyFilter = false;
            } else if (label == 'Available Today') {
              // Filter for available today (placeholder for now)
            } else if (label == 'Top Rated') {
              _verifiedOnlyFilter = true;
              _selectedHospital = 'All';
            } else if (_displayHospitals.contains(label)) {
              _selectedHospital = label;
              _verifiedOnlyFilter = false;
            }
          });
          _loadDoctors();
        },
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.gutterMd,
            vertical: spacing.AppSpacing.gutterSm,
          ),
          decoration: BoxDecoration(
            color: isActuallyActive ? AppColors.primary : AppColors.surfaceContainerLowest,
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
            children: [
              if (showDot)
                Container(
                  width: 8,
                  height: 8,
                  margin: EdgeInsets.only(right: spacing.AppSpacing.gutterXs),
                  decoration: BoxDecoration(
                    color: AppColors.tertiary,
                    shape: BoxShape.circle,
                  ),
                ),
              if (showStar)
                Icon(
                  Icons.star,
                  color: Colors.amber,
                  size: 14,
                  weight: 700,
                ),
              Text(
                label,
                style: AppTextStyles.labelMd.copyWith(
                  color: isActuallyActive ? AppColors.onPrimary : AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLocationIndicator() {
    if (_isFilteredListView) {
      return const SizedBox.shrink();
    }

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
              color: AppColors.surfaceLow,
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
                  'Metro Manila • Near me (5km)',
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    color: AppColors.onSurface,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${_allDoctors.length} Active Now',
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
          _selectedHospital = 'All';
          _verifiedOnlyFilter = false;
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
    if (specialty == 'All') return _allDoctors.length;
    return _allDoctors.where((d) => d.specialty == specialty).length;
  }

  void _openVerifiedDoctorsList() {
    setState(() {
      _verifiedOnlyFilter = true;
      _selectedSpecialty = 'All';
      _selectedHospital = 'All';
    });
    _loadDoctors();
  }

  void _openHospitalDoctorsList(String hospitalName) {
    if (hospitalName == 'All') return;
    setState(() {
      _selectedHospital = hospitalName;
      _selectedSpecialty = 'All';
      _verifiedOnlyFilter = false;
    });
    _loadDoctors();
  }

  Widget _buildTopDoctorsSection() {
    // Filter only approved/verified doctors for the Top Verified Doctors section
    final verifiedDoctors = _allDoctors.where((d) => d.isApproved).toList();

    return Column(
      children: [
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.screenPadding,
          ),
          child: InkWell(
            onTap: _openVerifiedDoctorsList,
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            child: Padding(
              padding:
                  EdgeInsets.symmetric(vertical: spacing.AppSpacing.gutterXs),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
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
                  ),
                  Icon(
                    Icons.verified,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconLg,
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        if (_isLoading && verifiedDoctors.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32.0),
              child: CircularProgressIndicator(),
            ),
          )
        else if (verifiedDoctors.isEmpty)
          Padding(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.screenPadding,
              vertical: spacing.AppSpacing.gutterMd,
            ),
            child: Center(
              child: Text(
                'No verified doctors available at the moment.',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ),
          )
        else
          SizedBox(
            height: 320,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              primary: false,
              padding: EdgeInsets.symmetric(
                horizontal: spacing.AppSpacing.screenPadding,
              ),
              itemCount: verifiedDoctors.length,
              itemBuilder: (context, index) {
                return Padding(
                  padding: EdgeInsets.only(right: spacing.AppSpacing.gutterMd),
                  child: SizedBox(
                    width: 288,
                    child: _buildDetailedDoctorCard(verifiedDoctors[index]),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }



  Widget _buildDetailedDoctorCard(Doctor doctor) {
    final location = doctor.practiceName ?? 'Private Practice';
    // Generate deterministic rating based on doctor ID hash
    final idHash = doctor.id.hashCode.abs();
    final rating = (4.5 + (idHash % 10) / 10).toStringAsFixed(2);
    final reviewCount = 50 + (idHash % 200);

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with avatar and info
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
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            doctor.fullName,
                            style: AppTextStyles.headlineSm.copyWith(
                              color: AppColors.onSurface,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.bookmark_border,
                            color: AppColors.outline,
                            size: spacing.AppSpacing.iconLg,
                          ),
                          onPressed: () {},
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    Text(
                      doctor.specialty,
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(
                          Icons.apartment,
                          color: AppColors.outline,
                          size: 15,
                        ),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            location,
                            style: AppTextStyles.bodyMd.copyWith(
                              color: AppColors.onSurfaceVariant,
                            ),
                            maxLines: 1,
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
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          // Metadata badges
          Wrap(
            spacing: spacing.AppSpacing.gutterSm,
            runSpacing: spacing.AppSpacing.gutterSm,
            children: [
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.star,
                      color: Colors.amber,
                      size: 14,
                      weight: 700,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      rating,
                      style: AppTextStyles.labelMd.copyWith(
                        color: AppColors.onSurface,
                      ),
                    ),
                    Text(
                      ' ($reviewCount reviews)',
                      style: AppTextStyles.labelMd.copyWith(
                        color: AppColors.onSurfaceVariant,
                        fontWeight: FontWeight.normal,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.payments,
                      color: AppColors.primary,
                      size: 14,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '${_formatConsultationFee(doctor)} / consult',
                      style: AppTextStyles.labelMd.copyWith(
                        color: AppColors.onPrimaryContainer,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          // Availability banner
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.gutterMd,
              vertical: spacing.AppSpacing.gutterSm,
            ),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
                  decoration: BoxDecoration(
                    color: AppColors.tertiary,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Text(
                    'Available Today',
                    style: AppTextStyles.labelMd.copyWith(
                      color: AppColors.tertiary,
                    ),
                  ),
                ),
                Text(
                  'Check Schedule',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          // Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    side: BorderSide(color: AppColors.primary),
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterSm,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                    ),
                  ),
                  child: Text(
                    'View Profile',
                    style: AppTextStyles.bodyMdMedium,
                  ),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => widget.onNavigateToTab?.call(2),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.onPrimary,
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterSm,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                    ),
                  ),
                  child: Text(
                    'Book Visit',
                    style: AppTextStyles.bodyMdMedium,
                  ),
                ),
              ),
            ],
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
            itemCount: _displayHospitals.isEmpty ? 1 : _displayHospitals.length,
            itemBuilder: (context, index) {
              if (_displayHospitals.isEmpty) {
                return _buildEmptyHospitalCard();
              }
              return _buildHospitalCard(_displayHospitals[index]);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildHospitalCard(String hospitalName) {
    final doctorCount = _allDoctors
        .where((d) => d.practiceName != null && d.practiceName == hospitalName)
        .length;

    return GestureDetector(
      onTap: () => _openHospitalDoctorsList(hospitalName),
      child: Container(
      width: 256,
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
            // Image area with badges
            Container(
              width: double.infinity,
              height: 112,
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
                            Icons.directions_walk,
                            color: AppColors.primary,
                            size: 13,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            '2.4 km',
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
            // Hospital info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    hospitalName,
                    style: AppTextStyles.bodyMdMedium.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
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
          ],
        ),
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
