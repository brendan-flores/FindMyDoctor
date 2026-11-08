import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';

class PrescriptionDetailPage extends StatefulWidget {
  final String prescriptionId;
  final ApiService? apiService;

  /// Test seam: inject how a URL is opened. Defaults to opening in an
  /// external application (e.g. the browser / PDF viewer).
  final Future<bool> Function(Uri)? openUrl;

  const PrescriptionDetailPage({
    super.key,
    required this.prescriptionId,
    this.apiService,
    this.openUrl,
  });

  @override
  State<PrescriptionDetailPage> createState() =>
      _PrescriptionDetailPageState();
}

class _PrescriptionDetailPageState extends State<PrescriptionDetailPage> {
  late final ApiService _apiService;
  Map<String, dynamic>? _prescription;
  List<dynamic> _items = [];
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
        setState(() {
          _prescription = response['data'] as Map<String, dynamic>;
          _items = _prescription!['items'] as List<dynamic>? ?? [];
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage = response['error']?['message'] ?? 'Failed to load prescription';
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

  Future<void> _loadPdfUrl() async {
    setState(() {
      _isLoadingPdf = true;
      _pdfError = null;
    });

    try {
      final response =
          await _apiService.getPrescriptionPdfUrl(widget.prescriptionId);
      if (!mounted) return;

      if (response['success'] == true) {
        final signedUrl = response['data']?['signedUrl'] as String?;
        if (!mounted) return;
        setState(() {
          _isLoadingPdf = false;
        });

        // Open PDF if URL is available
        if (signedUrl != null && signedUrl.isNotEmpty) {
          // Don't rely on canLaunchUrl: on Android 11+ it returns false for
          // https links unless the manifest declares an intent query. Call
          // launchUrl directly and handle its boolean result instead.
          final openUrl = widget.openUrl ??
              (Uri target) =>
                  launchUrl(target, mode: LaunchMode.externalApplication);
          try {
            final opened = await openUrl(Uri.parse(signedUrl));
            if (!opened && mounted) {
              setState(() {
                _pdfError = 'Could not open PDF';
              });
            }
          } catch (_) {
            if (mounted) {
              setState(() {
                _pdfError = 'Could not open PDF';
              });
            }
          }
        } else if (mounted) {
          setState(() {
            _pdfError = 'Could not open PDF';
          });
        }
      } else {
        setState(() {
          _pdfError = response['error']?['message'] ?? 'Failed to load PDF';
          _isLoadingPdf = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _pdfError = 'Failed to load PDF';
        _isLoadingPdf = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppHeader(
        title: 'Prescription',
        showBackButton: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? _buildErrorState(_errorMessage!, _loadPrescription)
              : _buildPrescriptionContent(),
    );
  }

  Widget _buildPrescriptionContent() {
    if (_prescription == null) {
      return const Center(child: Text('Prescription not found'));
    }

    final doctorName =
        '${_prescription!['doctor_first_name']} ${_prescription!['doctor_last_name']}'
            .trim();
    final prescriptionDate = _prescription!['prescription_date'] != null
        ? DateFormat('MMM dd, yyyy').format(
            DateTime.parse(_prescription!['prescription_date']))
        : 'Unknown date';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Doctor info
          AppCard(
            child: Row(
              children: [
                DoctorProfileImage(
                  size: 56,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterLg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        doctorName,
                        style: AppTextStyles.bodyLg,
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
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),

          // Notes
          if (_prescription!['notes'] != null &&
              _prescription!['notes'].toString().isNotEmpty) ...[
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Notes',
                    style: AppTextStyles.labelMd,
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterSm),
                  Text(
                    _prescription!['notes'].toString(),
                    style: AppTextStyles.bodyMd,
                  ),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
          ],

          // Medications
          Text(
            'Medications',
            style: AppTextStyles.labelMd,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          ..._items.map((item) => _buildMedicationCard(item)),
          const SizedBox(height: spacing.AppSpacing.gutterLg),

          // PDF download button
          if (_prescription!['has_pdf'] == true) ...[
            if (_pdfError != null) ...[
              Container(
                padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
                decoration: BoxDecoration(
                  color: AppColors.error.withOpacity(0.1),
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
              onPressed: _isLoadingPdf ? null : _loadPdfUrl,
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
        ],
      ),
    );
  }

  Widget _buildMedicationCard(dynamic item) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item['medication_name'] as String? ?? 'Unknown medication',
            style: AppTextStyles.bodyMd,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          if (item['dosage'] != null && item['dosage'].toString().isNotEmpty)
            _buildMedicationField('Dosage', item['dosage'].toString()),
          if (item['frequency'] != null &&
              item['frequency'].toString().isNotEmpty)
            _buildMedicationField('Frequency', item['frequency'].toString()),
          if (item['duration'] != null && item['duration'].toString().isNotEmpty)
            _buildMedicationField('Duration', item['duration'].toString()),
          if (item['instructions'] != null &&
              item['instructions'].toString().isNotEmpty)
            _buildMedicationField('Instructions', item['instructions'].toString()),
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
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.secondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTextStyles.bodySm,
            ),
          ),
        ],
      ),
    );
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
