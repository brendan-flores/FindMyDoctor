import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/json_parsers.dart';
import '../models/visit.dart';
import '../models/prescription.dart';
import 'prescription_detail_page.dart';

class MedicalRecordsPage extends StatefulWidget {
  const MedicalRecordsPage({super.key});

  @override
  State<MedicalRecordsPage> createState() => _MedicalRecordsPageState();
}

class _MedicalRecordsPageState extends State<MedicalRecordsPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _apiService = ApiService();

  // History tab state
  List<Visit> _visits = [];
  bool _isLoadingVisits = true;
  String? _visitsError;

  // Prescriptions tab state
  List<Prescription> _prescriptions = [];
  bool _isLoadingPrescriptions = true;
  String? _prescriptionsError;

  // Date filter state
  String _selectedDateFilter = 'all'; // 'all', '7days', '30days'

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    await Future.wait([
      _loadVisits(),
      _loadPrescriptions(),
    ]);
  }

  Future<void> _loadVisits() async {
    setState(() {
      _isLoadingVisits = true;
      _visitsError = null;
    });

    try {
      final response = await _apiService.getMyVisits();
      if (!mounted) return;

      if (response['success'] == true) {
        final visits = (response['data'] as List?)
                ?.map((v) => Visit.fromJson(v as Map<String, dynamic>))
                .toList() ??
            [];

        // Apply date filter
        final filteredVisits = _filterByDate(visits);

        setState(() {
          _visits = filteredVisits;
          _isLoadingVisits = false;
        });
      } else {
        setState(() {
          _visitsError = response['error']?['message'] ?? 'Failed to load visits';
          _isLoadingVisits = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _visitsError = 'Failed to load visits';
        _isLoadingVisits = false;
      });
    }
  }

  Future<void> _loadPrescriptions() async {
    setState(() {
      _isLoadingPrescriptions = true;
      _prescriptionsError = null;
    });

    try {
      final response = await _apiService.getMyPrescriptions();
      if (!mounted) return;

      if (response['success'] == true) {
        final prescriptions = (response['data'] as List?)
                ?.map((p) => Prescription.fromJson(p as Map<String, dynamic>))
                .toList() ??
            [];

        // Apply date filter
        final filteredPrescriptions = _filterByDate(prescriptions);

        setState(() {
          _prescriptions = filteredPrescriptions;
          _isLoadingPrescriptions = false;
        });
      } else {
        setState(() {
          _prescriptionsError =
              response['error']?['message'] ?? 'Failed to load prescriptions';
          _isLoadingPrescriptions = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _prescriptionsError = 'Failed to load prescriptions';
        _isLoadingPrescriptions = false;
      });
    }
  }

  List<T> _filterByDate<T extends dynamic>(List<T> items) {
    if (_selectedDateFilter == 'all') return items;

    final now = DateTime.now();
    final cutoffDate = _selectedDateFilter == '7days'
        ? now.subtract(const Duration(days: 7))
        : now.subtract(const Duration(days: 30));

    return items.where((item) {
      final date = item is Visit
          ? item.visitDate
          : (item as Prescription).prescriptionDate;
      if (date == null) return false;
      return date.isAfter(cutoffDate);
    }).toList();
  }

  void _onDateFilterChanged(String filter) {
    setState(() {
      _selectedDateFilter = filter;
    });
    _loadData();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(
        title: 'Medical Records',
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: _onDateFilterChanged,
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'all',
                child: Text('All time'),
              ),
              const PopupMenuItem(
                value: '7days',
                child: Text('Last 7 days'),
              ),
              const PopupMenuItem(
                value: '30days',
                child: Text('Last 30 days'),
              ),
            ],
          ),
        ],
      ),
      body: Column(
        children: [
          TabBar(
            controller: _tabController,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.secondary,
            indicatorColor: AppColors.primary,
            tabs: const [
              Tab(text: 'History'),
              Tab(text: 'Prescriptions'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildHistoryTab(),
                _buildPrescriptionsTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryTab() {
    return RefreshIndicator(
      onRefresh: _loadVisits,
      child: _isLoadingVisits
          ? const Center(child: CircularProgressIndicator())
          : _visitsError != null
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: constraints.maxHeight),
                      child: Center(child: _buildErrorState(_visitsError!, _loadVisits)),
                    ),
                  ),
                )
              : _visits.isEmpty
                  ? LayoutBuilder(
                      builder: (context, constraints) => SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(minHeight: constraints.maxHeight),
                          child: Center(child: _buildEmptyState('No medical history found')),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.only(
                        left: spacing.AppSpacing.screenPadding,
                        right: spacing.AppSpacing.screenPadding,
                        top: spacing.AppSpacing.screenPadding,
                        bottom: spacing.AppSpacing.screenPadding + MediaQuery.of(context).padding.bottom,
                      ),
                      itemCount: _visits.length,
                      itemBuilder: (context, index) {
                        final visit = _visits[index];
                        return _buildVisitCard(visit);
                      },
                    ),
    );
  }

  Widget _buildPrescriptionsTab() {
    return RefreshIndicator(
      onRefresh: _loadPrescriptions,
      child: _isLoadingPrescriptions
          ? const Center(child: CircularProgressIndicator())
          : _prescriptionsError != null
              ? LayoutBuilder(
                  builder: (context, constraints) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(minHeight: constraints.maxHeight),
                      child: Center(child: _buildErrorState(_prescriptionsError!, _loadPrescriptions)),
                    ),
                  ),
                )
              : _prescriptions.isEmpty
                  ? LayoutBuilder(
                      builder: (context, constraints) => SingleChildScrollView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        child: ConstrainedBox(
                          constraints: BoxConstraints(minHeight: constraints.maxHeight),
                          child: Center(child: _buildEmptyState('No prescriptions found')),
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.only(
                        left: spacing.AppSpacing.screenPadding,
                        right: spacing.AppSpacing.screenPadding,
                        top: spacing.AppSpacing.screenPadding,
                        bottom: spacing.AppSpacing.screenPadding + MediaQuery.of(context).padding.bottom,
                      ),
                      itemCount: _prescriptions.length,
                      itemBuilder: (context, index) {
                        final prescription = _prescriptions[index];
                        return _buildPrescriptionCard(prescription);
                      },
                    ),
    );
  }

  Widget _buildVisitCard(Visit visit) {
    final doctorName =
        '${visit.doctorFirstName} ${visit.doctorLastName}'.trim();
    final visitDate = visit.visitDate != null
        ? DateFormat('MMM dd, yyyy').format(visit.visitDate!)
        : 'Unknown date';

    return AppCard(
      margin: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              DoctorProfileImage(
                size: 48,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterLg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      doctorName,
                      style: AppTextStyles.bodyMdMedium,
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterSm),
                    Text(
                      visitDate,
                      style: AppTextStyles.bodySm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (visit.diagnosis != null && visit.diagnosis!.isNotEmpty) ...[
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Text(
              'Diagnosis',
              style: AppTextStyles.labelSm,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              visit.diagnosis!,
              style: AppTextStyles.bodyMd,
            ),
          ],
          if (visit.notes != null && visit.notes!.isNotEmpty) ...[
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Text(
              'Notes',
              style: AppTextStyles.labelSm,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              visit.notes!,
              style: AppTextStyles.bodyMd,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPrescriptionCard(Prescription prescription) {
    final doctorName =
        '${prescription.doctorFirstName} ${prescription.doctorLastName}'.trim();
    final prescriptionDate = prescription.prescriptionDate != null
        ? DateFormat('MMM dd, yyyy').format(prescription.prescriptionDate!)
        : 'Unknown date';

    return AppCard(
      margin: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => PrescriptionDetailPage(
                prescriptionId: prescription.id,
              ),
            ),
          );
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                DoctorProfileImage(
                  size: 48,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterLg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doctorName,
                        style: AppTextStyles.bodyMdMedium,
                      ),
                      const SizedBox(height: spacing.AppSpacing.gutterSm),
                      Text(
                        prescriptionDate,
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.secondary,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: AppColors.secondary,
                ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Row(
              children: [
                const Icon(
                  Icons.medication,
                  size: 16,
                  color: AppColors.primary,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Text(
                  '${prescription.medicationCount} medication${prescription.medicationCount != 1 ? 's' : ''}',
                  style: AppTextStyles.bodySm,
                ),
                const Spacer(),
                if (prescription.hasPdf)
                  const Icon(
                    Icons.picture_as_pdf,
                    size: 16,
                    color: AppColors.primary,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(String message) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.folder_open,
              size: 64,
              color: AppColors.secondary.withOpacity(0.5),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Text(
              message,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.secondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(String message, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppColors.error.withOpacity(0.5),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Text(
              message,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.secondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            ElevatedButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
