import 'package:flutter/material.dart';

import '../../../core/models/doctor.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/doctor_card.dart';
import '../../../core/widgets/specialty_picker_sheet.dart';

class DoctorResultsPage extends StatefulWidget {
  const DoctorResultsPage({
    super.key,
    required this.allDoctors,
    this.initialSpecialty = '',
    this.initialHospital = 'All',
    this.initialVerifiedOnly = false,
    this.startedFromSearch = false,
    this.onRefresh,
    required this.iconFor,
    required this.bgFor,
    required this.iconColorFor,
  });

  final List<Doctor> allDoctors;
  final String initialSpecialty;
  final String initialHospital;
  final bool initialVerifiedOnly;
  final bool startedFromSearch;
  final Future<List<Doctor>> Function()? onRefresh;
  final IconData Function(String) iconFor;
  final Color Function(String) bgFor;
  final Color Function(String) iconColorFor;

  @override
  State<DoctorResultsPage> createState() => _DoctorResultsPageState();
}

class _DoctorResultsPageState extends State<DoctorResultsPage> {
  late List<Doctor> _allDoctors;
  late String _specialty;
  late String _hospital;
  late bool _verifiedOnly;
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();

  List<Doctor> get _results {
    var result = _allDoctors;
    if (_specialty.isNotEmpty) {
      result = result.where((d) => d.specialty == _specialty).toList();
    }
    if (_hospital != 'All') {
      result = result.where((d) => d.practiceName == _hospital).toList();
    }
    if (_verifiedOnly) {
      result = result.where((d) => d.isApproved).toList();
    }
    if (_searchController.text.isNotEmpty) {
      final query = _searchController.text.toLowerCase();
      result = result.where((d) =>
          d.fullName.toLowerCase().contains(query) ||
          d.specialty.toLowerCase().contains(query) ||
          (d.practiceName?.toLowerCase().contains(query) ?? false)).toList();
    }
    return result;
  }

  void _clearFilters() {
    setState(() {
      _hospital = 'All';
      _verifiedOnly = false;
    });
  }

  @override
  void initState() {
    super.initState();
    _allDoctors = List<Doctor>.from(widget.allDoctors);
    _specialty = widget.initialSpecialty;
    _hospital = widget.initialHospital;
    _verifiedOnly = widget.initialVerifiedOnly;
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: Column(
          children: [
            if (!widget.startedFromSearch) ...[
              _buildHeader(),
              _buildSearchBar(),
            ] else ...[
              _buildSearchHeader(),
            ],
            _buildChipRow(),
            if (widget.startedFromSearch) _buildCountLine(),
            Expanded(
              child: _buildList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final title = _specialty.isNotEmpty ? _specialty : 'All Doctors';
    final subtitle = '${_results.length} doctor${_results.length != 1 ? 's' : ''}';

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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          GestureDetector(
            onTap: _openSpecialtyPicker,
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () {
                    Navigator.of(context).maybePop(_specialty);
                  },
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTextStyles.headlineSm.copyWith(
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterXs),
                          Icon(
                            Icons.keyboard_arrow_down,
                            color: AppColors.primary,
                            size: spacing.AppSpacing.iconMd,
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: AppTextStyles.bodyMd.copyWith(
                          color: AppColors.onSurfaceVariant,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchHeader() {
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
              Navigator.of(context).maybePop(_specialty);
            },
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocus,
              autofocus: true,
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
                filled: true,
                fillColor: AppColors.surfaceContainerLowest,
              ),
              onChanged: (value) {
                setState(() {});
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChipRow() {
    final specialtyScoped = _specialty.isNotEmpty
        ? _allDoctors.where((d) => d.specialty == _specialty).toList()
        : _allDoctors;
    final hospitalCounts = <String, int>{};
    for (final d in specialtyScoped) {
      final h = d.practiceName;
      if (h != null && h.isNotEmpty) {
        hospitalCounts[h] = (hospitalCounts[h] ?? 0) + 1;
      }
    }

    final hospitalNames = hospitalCounts.keys.toList()..sort();

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterSm,
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildChip(
              'All',
              _hospital == 'All' && !_verifiedOnly,
              onTap: () {
                setState(() {
                  _hospital = 'All';
                  _verifiedOnly = false;
                });
              },
            ),
            for (final hospital in hospitalNames)
              _buildChip(
                '$hospital (${hospitalCounts[hospital]})',
                _hospital == hospital,
                onTap: () {
                  setState(() {
                    _hospital = _hospital == hospital ? 'All' : hospital;
                  });
                },
              ),
            _buildChip(
              'Verified',
              _verifiedOnly,
              icon: Icons.verified,
              onTap: () {
                setState(() {
                  _verifiedOnly = !_verifiedOnly;
                });
              },
            ),
            if (_hospital != 'All' || _verifiedOnly)
              TextButton(
                onPressed: _clearFilters,
                child: const Text('Clear filters'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildChip(
    String label,
    bool isActive, {
    IconData? icon,
    required VoidCallback onTap,
  }) {
    return Container(
      margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.gutterMd,
            vertical: spacing.AppSpacing.gutterSm,
          ),
          decoration: BoxDecoration(
            color: isActive
                ? AppColors.primary
                : AppColors.surfaceContainerLowest,
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
              if (icon != null) ...[
                Icon(
                  icon,
                  color: isActive ? AppColors.onPrimary : AppColors.primary,
                  size: 14,
                  weight: 700,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
              ],
              Text(
                label,
                style: AppTextStyles.labelMd.copyWith(
                  color: isActive
                      ? AppColors.onPrimary
                      : AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCountLine() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.screenPadding,
        vertical: spacing.AppSpacing.gutterXs,
      ),
      child: Row(
        children: [
          Text(
            '${_results.length} result${_results.length != 1 ? 's' : ''}',
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList() {
    if (_results.isEmpty) {
      return RefreshIndicator(
        onRefresh: _handleRefresh,
        child: ListView(
          padding: EdgeInsets.only(
            left: spacing.AppSpacing.screenPadding,
            right: spacing.AppSpacing.screenPadding,
            top: spacing.AppSpacing.gutterSm,
            bottom: 80,
          ),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const SizedBox(height: 40),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
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
                    textAlign: TextAlign.center,
                    style: AppTextStyles.bodyMd.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 24),
                  if (_hospital != 'All' || _verifiedOnly || _searchController.text.isNotEmpty)
                    TextButton(
                      onPressed: () {
                        setState(() {
                          _hospital = 'All';
                          _verifiedOnly = false;
                        });
                        _searchController.clear();
                      },
                      child: const Text('Clear filters'),
                    ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _handleRefresh,
      child: ListView.builder(
        padding: EdgeInsets.only(
          left: spacing.AppSpacing.screenPadding,
          right: spacing.AppSpacing.screenPadding,
          top: spacing.AppSpacing.gutterSm,
          bottom: 80,
        ),
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: _results.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: EdgeInsets.only(
              bottom: spacing.AppSpacing.gutterMd,
            ),
            child: DoctorCard(key: ValueKey(_results[index].id), doctor: _results[index]),
          );
        },
      ),
    );
  }

  Future<void> _handleRefresh() async {
    if (widget.onRefresh == null) return;
    final refreshed = await widget.onRefresh!();
    if (!mounted) return;
    setState(() {
      _allDoctors = List<Doctor>.from(refreshed);
    });
  }

  void _openSpecialtyPicker() {
    final counts = <String, int>{};
    for (final d in _allDoctors) {
      final s = d.specialty;
      if (s.isNotEmpty) {
        counts[s] = (counts[s] ?? 0) + 1;
      }
    }

    showSpecialtyPickerSheet(
      context,
      specialties: _allDoctors
          .map((d) => d.specialty)
          .where((s) => s.isNotEmpty)
          .toSet()
          .toList()
        ..sort(),
      counts: counts,
      totalDoctors: _allDoctors.length,
      selected: _specialty,
      allSelected: _specialty.isEmpty,
      onSelected: (specialty) {
        setState(() {
          _specialty = specialty;
          if (_hospital != 'All' &&
              !_allDoctors.any((d) => d.practiceName == _hospital && d.specialty == _specialty)) {
            _hospital = 'All';
          }
        });
      },
      onSelectAll: () {
        setState(() {
          _specialty = '';
          if (_hospital != 'All' &&
              !_allDoctors.any((d) => d.practiceName == _hospital)) {
            _hospital = 'All';
          }
        });
      },
      iconFor: widget.iconFor,
      bgFor: widget.bgFor,
      iconColorFor: widget.iconColorFor,
    );
  }

  Widget _buildSearchBar() {
    final hint = _specialty.isNotEmpty
        ? 'Search in $_specialty…'
        : 'Search doctors, specialties, or clinics…';

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
                focusNode: _searchFocus,
                decoration: InputDecoration(
                  hintText: hint,
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
}