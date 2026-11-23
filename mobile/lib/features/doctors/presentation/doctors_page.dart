import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/doctor_card.dart';
import 'doctor_results_page.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/models/doctor.dart';
import '../../../core/services/doctor_service.dart';
import 'specializations_page.dart';

class DoctorsPage extends StatefulWidget {
  final String? specialty;
  final Function(int)? onNavigateToTab;
  final VoidCallback? onClearSpecialtyFromHome;

  /// Test seam. Production callers use the real service; tests inject a fake
  /// without performing network requests.
  final DoctorService? doctorService;

  const DoctorsPage({
    super.key,
    this.specialty,
    this.onNavigateToTab,
    this.onClearSpecialtyFromHome,
    this.doctorService,
  });

  @override
  State<DoctorsPage> createState() => _DoctorsPageState();
}

class _DoctorsPageState extends State<DoctorsPage> {
  late final DoctorService _doctorService;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  bool _showAllHospitals =
      false; // Flag to show filtered list view with all hospitals
  List<Doctor> _allDoctors = []; // Store all doctors for counting
  List<String> _specialties = [];
  List<String> _hospitals = ['All'];
  bool _isLoading = true;
  bool _hasLoadError = false;
  bool _resultsOpen = false; // Guard: only one results page at a time

  List<String> get _displayHospitals {
    var hospitals = _hospitals
        .where((h) => h != 'All' && h.isNotEmpty)
        .toList();
    if (_showAllHospitals && _searchController.text.isNotEmpty) {
      final query = _searchController.text.toLowerCase();
      hospitals = hospitals
          .where((h) => h.toLowerCase().contains(query))
          .toList();
    }
    return hospitals;
  }

  @override
  void initState() {
    super.initState();
    _doctorService = widget.doctorService ?? DoctorService();
    _loadDoctors().then((_) {
      if (!mounted) return;
      if (widget.specialty != null && widget.specialty!.isNotEmpty) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _openResults(specialty: widget.specialty!, fromHome: true);
        });
      }
    });
  }

  @override
  void didUpdateWidget(DoctorsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.specialty != oldWidget.specialty &&
        widget.specialty != null &&
        widget.specialty!.isNotEmpty) {
      if (_isLoading) {
        _loadDoctors().then((_) {
          if (!mounted) return;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            _openResults(specialty: widget.specialty!, fromHome: true);
          });
        });
      } else {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          _openResults(specialty: widget.specialty!, fromHome: true);
        });
      }
    }
  }

  Future<void> _loadDoctors() async {
    setState(() {
      _isLoading = true;
      _hasLoadError = false;
    });

    try {
      // Fetch all doctors once (backend already filters for approval_status = 'ACTIVE')
      final allDoctors = await _doctorService.getDoctors();

      // Extract unique specialties
      final uniqueSpecialties =
          allDoctors
              .map((d) => d.specialty)
              .where((s) => s.isNotEmpty)
              .toSet()
              .toList()
            ..sort();

      // Extract unique hospitals/clinics
      final uniqueHospitals =
          allDoctors
              .map((d) => d.practiceName)
              .whereType<String>()
              .where((h) => h.isNotEmpty)
              .toSet()
              .toList()
            ..sort();

      if (!mounted) return;
      setState(() {
        _allDoctors = allDoctors;
        _specialties = uniqueSpecialties;
        _hospitals = ['All', ...uniqueHospitals];
        _isLoading = false;
        _hasLoadError = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        _hasLoadError = true;
      });
    }
  }



  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    super.dispose();
  }



  void _openSpecialtyList() {
    Navigator.of(context)
        .push<String>(
          MaterialPageRoute(
            builder: (context) => SpecializationsPage(
              specialties: _specialties,
              selectedSpecialty: null,
              onSpecialtySelected: null,
            ),
          ),
        )
        .then((specialty) {
          if (mounted && specialty != null && specialty.isNotEmpty) {
            _openResults(specialty: specialty);
          }
        });
  }

  void _openHospitalsList() {
    setState(() {
      _showAllHospitals = true;
      _searchController.clear();
    });
  }

  void _openResults({
    String specialty = '',
    String hospital = 'All',
    bool verifiedOnly = false,
    bool startedFromSearch = false,
    bool fromHome = false,
  }) {
    if (_resultsOpen) return;
    if (_isLoading) return;
    if (_allDoctors.isEmpty && _hasLoadError) return;

    _resultsOpen = true;

    Navigator.of(context)
        .push<String>(
          MaterialPageRoute(
            builder: (_) => DoctorResultsPage(
              allDoctors: _allDoctors,
              initialSpecialty: specialty,
              initialHospital: hospital,
              initialVerifiedOnly: verifiedOnly,
              startedFromSearch: startedFromSearch,
              onRefresh: () async {
                await _loadDoctors();
                return _allDoctors;
              },
              iconFor: _getSpecialtyIcon,
              bgFor: _getSpecialtyColor,
              iconColorFor: _getSpecialtyIconColor,
            ),
          ),
        )
        .then((finalSpecialty) {
          if (!mounted) return;
          _resultsOpen = false;
          if (fromHome) {
            widget.onClearSpecialtyFromHome?.call();
            if (finalSpecialty == widget.specialty) {
              widget.onNavigateToTab?.call(0);
            }
          }
        });
  }



  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildStickyHeader(),
        Expanded(
          child: _showAllHospitals
              ? _buildAllHospitalsView()
              : _hasLoadError && _allDoctors.isEmpty
              ? _buildLoadErrorState()
              : SingleChildScrollView(
                  padding: const EdgeInsets.only(bottom: 80),
                  child: Column(
                    children: [
                      _buildSearchBar(),
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

  Widget _buildStickyHeader() {
    if (_showAllHospitals) {
      return SafeArea(
        child: Container(
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
                  setState(() {
                    _showAllHospitals = false;
                    _searchController.clear();
                  });
                },
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Expanded(
                child: Text(
                  'All Hospitals',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.headlineSm.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }
    return const AppHeader(showNotifications: true, showProfile: true);
  }

  Widget _buildSearchBar() {
    if (!_showAllHospitals) {
      return Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.screenPadding,
          vertical: spacing.AppSpacing.gutterMd,
        ),
        decoration: BoxDecoration(color: AppColors.surface),
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerLowest,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusLg,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.slate800.withValues(alpha: 0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
                ),
                child: TextField(
                  readOnly: true,
                  onTap: () => _openResults(startedFromSearch: true),
                  decoration: InputDecoration(
                    hintText: 'Search doctors, specialties, or clinics…',
                    hintStyle: AppTextStyles.bodyMd.copyWith(
                      color: AppColors.outline,
                    ),
                    prefixIcon: Icon(
                      Icons.search,
                      color: AppColors.outline,
                      size: spacing.AppSpacing.iconLg,
                    ),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterMd,
                      vertical: spacing.AppSpacing.gutterXs,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterMd,
      ),
      decoration: BoxDecoration(color: AppColors.surface),
      child: Row(
        children: [
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusLg,
                ),
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
                focusNode: _searchFocusNode,
                decoration: InputDecoration(
                  hintText: 'Search hospitals or medical centers...',
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
                          tooltip: 'Clear search',
                          onPressed: () {
                            _searchController.clear();
                            setState(() {});
                          },
                        )
                      : null,
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterMd,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                ),
                onChanged: (value) {
                  setState(() {});
                },
              ),
            ),
          ),
        ],
      ),
    );
  }



  Widget _buildAllHospitalsView() {
    return Column(
      children: [
        _buildSearchBar(),
        Expanded(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _displayHospitals.isEmpty
              ? _buildEmptyHospitalsState()
              : RefreshIndicator(
                  onRefresh: _loadDoctors,
                  child: ListView.builder(
                    padding: EdgeInsets.only(
                      left: spacing.AppSpacing.screenPadding,
                      right: spacing.AppSpacing.screenPadding,
                      top: spacing.AppSpacing.gutterSm,
                      bottom: 80,
                    ),
                    itemCount: _displayHospitals.length,
                    itemBuilder: (context, index) {
                      return Padding(
                        padding: EdgeInsets.only(
                          bottom: spacing.AppSpacing.gutterMd,
                        ),
                        child: _buildHospitalCard(_displayHospitals[index]),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  Widget _buildLoadErrorState() {
    return Padding(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterXl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.cloud_off_outlined, size: 64, color: AppColors.outline),
          const SizedBox(height: 16),
          Text(
            'Unable to load doctors',
            style: AppTextStyles.headlineSm.copyWith(
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Please check your connection and try again.',
            textAlign: TextAlign.center,
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: _loadDoctors, child: const Text('Retry')),
        ],
      ),
    );
  }



  Widget _buildEmptyHospitalsState() {
    return Padding(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterXl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.local_hospital_outlined,
            size: 64,
            color: AppColors.outline,
          ),
          const SizedBox(height: 16),
          Text(
            'No Hospitals Found',
            style: AppTextStyles.headlineSm.copyWith(
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'No hospitals or medical centers registered yet',
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.onSurfaceVariant,
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
                      borderRadius: BorderRadius.circular(
                        spacing.AppSpacing.radiusFull,
                      ),
                    ),
                    child: Text(
                      '${_specialties.length}',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.onSecondaryContainer,
                      ),
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: _openSpecialtyList,
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
    return GestureDetector(
      onTap: () => _openResults(specialty: specialty),
      child: Container(
        margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterMd,
          vertical: spacing.AppSpacing.gutterSm,
        ),
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
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: _getSpecialtyColor(specialty),
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusMd,
                ),
              ),
              child: Icon(
                _getSpecialtyIcon(specialty),
                color: _getSpecialtyIconColor(specialty),
                size: spacing.AppSpacing.iconMd,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            Flexible(
              child: Text(
                specialty,
                style: AppTextStyles.labelMd.copyWith(
                  color: AppColors.onSurface,
                  fontWeight: FontWeight.normal,
                ),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            ),
          ],
        ),
      ),
    );
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
            onTap: () => _openResults(verifiedOnly: true),
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            child: Padding(
              padding: EdgeInsets.symmetric(
                vertical: spacing.AppSpacing.gutterXs,
              ),
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
          SizedBox(
            height: 210,
            child: SkeletonScope(
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                primary: false,
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.screenPadding,
                ),
                itemCount: 3,
                itemBuilder: (context, index) {
                  return Padding(
                    padding: EdgeInsets.only(
                      right: spacing.AppSpacing.gutterMd,
                    ),
                    child: const SizedBox(
                      width: 288,
                      child: DoctorCardSkeleton(),
                    ),
                  );
                },
              ),
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
        else ...[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            primary: false,
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.screenPadding,
              vertical: 4,
            ),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final doctor in verifiedDoctors)
                    Padding(
                      padding: EdgeInsets.only(
                        right: spacing.AppSpacing.gutterMd,
                      ),
                      child: SizedBox(
                        width: (MediaQuery.sizeOf(context).width * 0.85).clamp(280.0, 340.0).toDouble(),
                        child: DoctorCard(key: ValueKey(doctor.id), doctor: doctor),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
        ],
      ],
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
            children: [
              // Expanded lets the title/subtitle wrap on narrow screens
              // instead of overflowing the row by a few pixels.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hospitals & Medical Centers',
                      style: AppTextStyles.headlineSm.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: _openHospitalsList,
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
          height: 240,
          child: _isLoading
              ? SkeletonScope(
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.screenPadding,
                    ),
                    itemCount: 3,
                    itemBuilder: (context, index) {
                      return const HospitalCardSkeleton();
                    },
                  ),
                )
              : ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.screenPadding,
                  ),
                  itemCount: _displayHospitals.isEmpty
                      ? 1
                      : _displayHospitals.length,
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
      onTap: () => _openResults(hospital: hospitalName),
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
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusLg,
                  ),
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
                          borderRadius: BorderRadius.circular(
                            spacing.AppSpacing.radiusSm,
                          ),
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
                          borderRadius: BorderRadius.circular(
                            spacing.AppSpacing.radiusFull,
                          ),
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
                      maxLines: 1,
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
              style: AppTextStyles.labelSm.copyWith(color: AppColors.outline),
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























