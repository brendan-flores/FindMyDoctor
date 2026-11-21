import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/file_save_service.dart';
import '../models/prescription.dart';

class PrescriptionDetailPage extends StatefulWidget {
  final String prescriptionId;
  final ApiService? apiService;
  final Future<SavedFile> Function(List<int>, String)? savePdf;

  const PrescriptionDetailPage({
    super.key,
    required this.prescriptionId,
    this.apiService,
    this.savePdf,
  });

  @override
  State<PrescriptionDetailPage> createState() => _PrescriptionDetailPageState();
}

class _PrescriptionDetailPageState extends State<PrescriptionDetailPage> {
  late final ApiService _apiService;
  PrescriptionDetail? _prescription;
  bool _isLoading = true;
  String? _errorMessage;
  bool _isLoadingPdf = false;
  String? _pdfError;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _loadPrescription();
  }

  Future<void> _loadPrescription() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getPrescription(widget.prescriptionId);
      if (!mounted) return;

      if (response['success'] == true) {
        final data = response['data'];
        if (data is Map<String, dynamic>) {
          setState(() {
            _prescription = PrescriptionDetail.fromJson(data);
            _isLoading = false;
          });
        } else {
          setState(() {
            _errorMessage = 'Prescription not found';
            _isLoading = false;
          });
        }
      } else {
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load prescription';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to load prescription';
        _isLoading = false;
      });
    }
  }

  Future<void> _downloadPdf() async {
    setState(() {
      _isLoadingPdf = true;
      _pdfError = null;
    });

    try {
      final download = await _apiService.downloadPrescriptionPdf(
        widget.prescriptionId,
      );
      if (download.bytes.isEmpty) {
        throw Exception('Downloaded PDF is empty');
      }

      final fileName = download.fileName;
      final savePdf = widget.savePdf ?? FileSaveService.savePdf;
      final savedFile = await savePdf(download.bytes, fileName);
      if (!mounted) return;

      setState(() {
        _isLoadingPdf = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            savedFile.requiresShareSheet
                ? 'Prescription ready. Choose where to save $fileName.'
                : 'Prescription saved to ${savedFile.displayLocation}/$fileName',
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _pdfError = 'Failed to download PDF';
        _isLoadingPdf = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(title: 'Prescription', showBackButton: true),
      body: _isLoading
          ? const PrescriptionDetailSkeleton()
          : _errorMessage != null
          ? _buildErrorState(_errorMessage!, _loadPrescription)
          : _buildPrescriptionContent(),
    );
  }

  Widget _buildPrescriptionContent() {
    final prescription = _prescription;
    if (prescription == null) {
      return const Center(child: Text('Prescription not found'));
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildDoctorAndClinicCard(prescription),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          _buildPatientCard(prescription),
          if (_hasConsultationInfo(prescription)) ...[
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildConsultationCard(prescription),
          ],
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          _buildMedicationsSection(prescription),
          if (prescription.notes != null) ...[
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildNotesCard(prescription),
          ],
          if (prescription.replacesPrescriptionNumber != null) ...[
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _buildReplacementCard(prescription),
          ],
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          _buildPdfSection(prescription),
        ],
      ),
    );
  }

  Widget _buildDoctorAndClinicCard(PrescriptionDetail prescription) {
    final doctorName = prescription.doctorFullName.isEmpty
        ? 'Doctor'
        : 'Dr. ${prescription.doctorFullName}';
    final date = _formatDate(prescription.prescriptionDate);

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DoctorProfileImage(
                size: 56,
                photoUrl: prescription.doctorProfessionalPhotoUrl,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterLg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(doctorName, style: AppTextStyles.bodyLgMedium),
                    if (prescription.doctorSpecialty != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        prescription.doctorSpecialty!,
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                    if (prescription.doctorCredentials != null)
                      Text(
                        prescription.doctorCredentials!,
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.secondary,
                        ),
                      ),
                    if (prescription.prcLicenseNumber != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'PRC License No.: ${prescription.prcLicenseNumber}',
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.secondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (_hasClinicInfo(prescription)) ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            _buildClinicInfo(prescription),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(
              vertical: spacing.AppSpacing.gutterMd,
            ),
            child: Divider(height: 1),
          ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.primaryFixed,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusMd,
                  ),
                ),
                child: Text(
                  'Rx',
                  style: AppTextStyles.headlineSm.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PRESCRIPTION',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                        letterSpacing: 1.1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      prescription.prescriptionNumber ?? 'Prescription',
                      style: AppTextStyles.bodyMdMedium,
                    ),
                  ],
                ),
              ),
              if (date != null)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Issue date',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(date, style: AppTextStyles.bodySm),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  bool _hasClinicInfo(PrescriptionDetail prescription) {
    return prescription.practiceName != null ||
        prescription.practiceAddress != null ||
        prescription.practicePhone != null ||
        prescription.roomNumber != null;
  }

  Widget _buildClinicInfo(PrescriptionDetail prescription) {
    final clinicName = prescription.practiceName;
    final room = prescription.roomNumber;
    final lines = <String>[
      if (clinicName != null && room != null)
        '$clinicName · Room $room'
      else if (clinicName != null)
        clinicName
      else if (room != null)
        'Room $room',
      if (prescription.practiceAddress != null) prescription.practiceAddress!,
      if (prescription.practicePhone != null)
        'Contact: ${prescription.practicePhone}',
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'CLINIC INFORMATION',
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.tertiary,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          ...lines.map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(line, style: AppTextStyles.bodySm),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPatientCard(PrescriptionDetail prescription) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Patient Information', Icons.person_outline),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          _buildInfoRow('Name', prescription.patientFullName),
          if (prescription.patientAge != null)
            _buildInfoRow('Age', '${prescription.patientAge} years old'),
          if (prescription.formattedSex != null)
            _buildInfoRow('Sex', prescription.formattedSex!),
          if (prescription.dateOfBirth != null)
            _buildInfoRow(
              'Date of birth',
              _formatDate(prescription.dateOfBirth) ?? '—',
            ),
        ],
      ),
    );
  }

  bool _hasConsultationInfo(PrescriptionDetail prescription) {
    return prescription.visitDate != null ||
        prescription.reasonForVisit != null ||
        prescription.diagnosis != null;
  }

  Widget _buildConsultationCard(PrescriptionDetail prescription) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle(
            'Consultation',
            Icons.medical_information_outlined,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (prescription.visitDate != null)
            _buildInfoRow(
              'Visit date',
              _formatDate(prescription.visitDate) ?? '—',
            ),
          if (prescription.reasonForVisit != null)
            _buildInfoRow('Reason', prescription.reasonForVisit!),
          if (prescription.diagnosis != null)
            _buildInfoRow('Diagnosis', prescription.diagnosis!),
        ],
      ),
    );
  }

  Widget _buildMedicationsSection(PrescriptionDetail prescription) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 32,
              height: 32,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.primaryFixed,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusSm,
                ),
              ),
              child: Text(
                'Rx',
                style: AppTextStyles.labelMd.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
            Text('Medications', style: AppTextStyles.labelMd),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        if (prescription.items.isEmpty)
          AppCard(
            child: Row(
              children: [
                Icon(
                  Icons.medication_outlined,
                  color: AppColors.outline,
                  size: 20,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Expanded(
                  child: Text(
                    'No medications were recorded on this prescription.',
                    style: AppTextStyles.bodySm.copyWith(
                      color: AppColors.secondary,
                    ),
                  ),
                ),
              ],
            ),
          )
        else
          ...prescription.items.asMap().entries.map(
            (entry) => _buildMedicationCard(entry.value, entry.key + 1),
          ),
      ],
    );
  }

  Widget _buildMedicationCard(PrescriptionItem item, int index) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '$index',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.primary,
                  ),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Expanded(
                child: Text(
                  item.medicationName,
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          if (item.dosage != null)
            _buildMedicationField('Dosage', item.dosage!),
          if (item.frequency != null)
            _buildMedicationField('Frequency', item.frequency!),
          if (item.duration != null)
            _buildMedicationField('Duration', item.duration!),
          if (item.quantity != null)
            _buildMedicationField('Quantity', '${item.quantity}'),
          if (item.instructions != null)
            _buildMedicationField('Instructions', item.instructions!),
        ],
      ),
    );
  }

  Widget _buildNotesCard(PrescriptionDetail prescription) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSectionTitle('Doctor\'s Notes', Icons.description_outlined),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Text(prescription.notes!, style: AppTextStyles.bodyMd),
        ],
      ),
    );
  }

  Widget _buildReplacementCard(PrescriptionDetail prescription) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(spacing.AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.tertiaryFixed.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        border: Border.all(color: AppColors.tertiaryFixedDim),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            Icons.restore_page_outlined,
            size: 20,
            color: AppColors.tertiary,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Replacement prescription',
                  style: AppTextStyles.labelMd.copyWith(
                    color: AppColors.onTertiaryContainer,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Replaces ${prescription.replacesPrescriptionNumber}.',
                  style: AppTextStyles.bodySm.copyWith(
                    color: AppColors.onTertiaryContainer,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPdfSection(PrescriptionDetail prescription) {
    if (!prescription.hasPdf) {
      return const SizedBox.shrink();
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_pdfError != null) ...[
          Container(
            padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
            decoration: BoxDecoration(
              color: AppColors.error.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.error_outline,
                  color: AppColors.error,
                  size: 20,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Expanded(
                  child: Text(
                    _pdfError!,
                    style: AppTextStyles.bodySm.copyWith(
                      color: AppColors.error,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
        ],
        PrimaryButton(
          text: _isLoadingPdf ? 'Loading...' : 'Download PDF',
          onPressed: _isLoadingPdf ? null : _downloadPdf,
          icon: _isLoadingPdf
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.picture_as_pdf),
        ),
      ],
    );
  }

  Widget _buildSectionTitle(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.primary),
        const SizedBox(width: spacing.AppSpacing.gutterSm),
        Text(title, style: AppTextStyles.labelMd),
      ],
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 104,
            child: Text(
              label,
              style: AppTextStyles.bodySm.copyWith(color: AppColors.secondary),
            ),
          ),
          Expanded(child: Text(value, style: AppTextStyles.bodySm)),
        ],
      ),
    );
  }

  Widget _buildMedicationField(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              '$label:',
              style: AppTextStyles.labelSm.copyWith(color: AppColors.secondary),
            ),
          ),
          Expanded(child: Text(value, style: AppTextStyles.bodySm)),
        ],
      ),
    );
  }

  String? _formatDate(DateTime? date) {
    if (date == null) return null;
    return DateFormat('MMM dd, yyyy').format(date);
  }

  Widget _buildErrorState(String message, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppColors.error.withValues(alpha: 0.5),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Text(
              message,
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
