import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/json_parsers.dart';

class BookingConfirmationPage extends StatefulWidget {
  final String? doctorId;
  final String? doctorName;
  final String? specialty;
  final String? clinic;
  final String? consultationFee;
  final DateTime? selectedDate;
  final String? paymentMethod;

  const BookingConfirmationPage({
    super.key,
    this.doctorId,
    this.doctorName,
    this.specialty,
    this.clinic,
    this.consultationFee,
    this.selectedDate,
    this.paymentMethod,
  });

  @override
  State<BookingConfirmationPage> createState() => _BookingConfirmationPageState();
}

class _BookingConfirmationPageState extends State<BookingConfirmationPage> {
  final ApiService _apiService = ApiService();
  bool _isSubmitting = false;
  String? _errorMessage;
  String? _queueNumber;
  int? _totalPatients;
  bool _isSuccess = false;
  String? _appointmentId;

  Future<void> _submitReservation() async {
    if (widget.doctorId == null || widget.selectedDate == null) {
      setState(() {
        _errorMessage = 'Missing required information';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      // Use only the date (no time)
      final appointmentDate = DateFormat('yyyy-MM-dd').format(widget.selectedDate!);

      final response = await _apiService.bookAppointment(
        doctorId: widget.doctorId!,
        appointmentDate: appointmentDate,
        reasonForVisit: 'Regular consultation',
        paymentMethod: widget.paymentMethod,
      );

      if (response['success'] == true) {
        setState(() {
          _queueNumber = response['data']?['queueNumber']?.toString();
          _totalPatients = parseInt(response['data']?['totalPatients']);
          _appointmentId = response['data']?['appointmentId']?.toString();
          _isSuccess = true;
          _isSubmitting = false;
        });
      } else {
        setState(() {
          _errorMessage = response['error']?['message'] ?? 'Failed to book appointment';
          _isSubmitting = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to book appointment: $e';
        _isSubmitting = false;
      });
    }
  }



  @override
  void initState() {
    super.initState();
    // Auto-submit when page loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _submitReservation();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          AppHeader(
            showBackButton: true,
            onBackPressed: () => Navigator.of(context).pop(),
            showNotifications: false,
            showProfile: false,
          ),
          Expanded(
            child: SingleChildScrollView(
              child: Padding(
                padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    if (_isSubmitting)
                      _buildLoadingState()
                    else if (_errorMessage != null)
                      _buildErrorState()
                    else if (_isSuccess)
                      _buildSuccessContent(),
                  ],
                ),
              ),
            ),
          ),
          if (_isSuccess) _buildBottomButton(context),
        ],
      ),
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32.0),
        child: Column(
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Booking your appointment...'),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32.0),
        child: Column(
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: AppColors.error,
            ),
            const SizedBox(height: 16),
            Text(
              _errorMessage!,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.error,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
              },
              child: const Text('Go Back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccessContent() {
    return Column(
      children: [
        _buildSuccessMessage(),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildQueueSlip(),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        if (widget.paymentMethod?.toUpperCase() == 'GCASH') _buildUploadReceiptButton(),
        if (widget.paymentMethod?.toUpperCase() == 'GCASH') const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildSecretaryChat(),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildLocationCard(),
        const SizedBox(height: spacing.AppSpacing.gutter3xl),
      ],
    );
  }

  Widget _buildSuccessMessage() {
    return Column(
      children: [
        Center(
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.primaryFixed,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.slate800.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(
              Icons.check_circle,
              color: AppColors.primary,
              size: 36,
            ),
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        Text(
          'Appointment Confirmed!',
          style: AppTextStyles.headlineMd.copyWith(
            fontWeight: FontWeight.bold,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _buildQueueSlip() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top banner
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(spacing.AppSpacing.radiusLg),
                topRight: Radius.circular(spacing.AppSpacing.radiusLg),
              ),
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
                        color: AppColors.surfaceLowest.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                      ),
                      child: Icon(
                        Icons.local_hospital,
                        color: AppColors.onPrimary,
                        size: spacing.AppSpacing.iconMd,
                      ),
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'CareFlow Verified Slip',
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.primaryFixed.withValues(alpha: 0.9),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'CLINIC QUEUE PASS',
                          style: AppTextStyles.headlineSm.copyWith(
                            color: AppColors.onPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterSm,
                        vertical: spacing.AppSpacing.gutterXs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.primaryFixed,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                      ),
                      child: Text(
                        widget.selectedDate != null
                            ? DateFormat('MMM d, yyyy').format(widget.selectedDate!)
                            : 'Date',
                        style: AppTextStyles.labelSm.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      'Ref: FMD-SLB-${DateTime.now().millisecondsSinceEpoch % 10000}',
                      style: AppTextStyles.labelSm.copyWith(
                        fontSize: 11,
                        color: AppColors.primaryFixed.withValues(alpha: 0.8),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Doctor info
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
            ),
            child: Row(
              children: [
                Stack(
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
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: AppColors.tertiaryContainer,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.check,
                          color: AppColors.onTertiaryContainer,
                          size: 9,
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
                        widget.doctorName ?? 'Doctor Name',
                        style: AppTextStyles.bodyLgMedium,
                      ),
                      Text(
                        widget.specialty ?? 'Specialty',
                        style: AppTextStyles.bodyMd.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      Text(
                        widget.clinic ?? 'Clinic Location',
                        style: AppTextStyles.bodyMd.copyWith(
                          fontSize: 12,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // Queue number
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            child: Column(
              children: [
                Text(
                  'Your Priority Order',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      _queueNumber != null ? '#$_queueNumber' : '#--',
                      style: AppTextStyles.queueNum.copyWith(
                        fontSize: 60,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterMd,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.secondaryFixed,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: AppColors.primaryContainer,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: spacing.AppSpacing.gutterXs),
                      Text(
                        _totalPatients != null && _queueNumber != null
                            ? 'You are patient #$_queueNumber out of $_totalPatients'
                            : 'Serving #01 now • ~45 min estimated wait',
                        style: AppTextStyles.bodyMdMedium.copyWith(
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

  Widget _buildSecretaryChat() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
      ),
      child: InkWell(
        onTap: () {
          // Launch SMS to secretary
          final Uri smsUri = Uri(
            scheme: 'sms',
            path: '09178823490',
            queryParameters: {'body': 'Hello Secretary Grace, this is Juan Michael Reyes regarding Queue #04'},
          );
          launchUrl(smsUri);
        },
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AppColors.primaryFixed,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.chat,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconMd,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Clinic Secretary Grace Lim',
                        style: AppTextStyles.bodyMdMedium,
                      ),
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: AppColors.tertiaryContainer,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                  Text(
                    'Tap to chat with secretary desk',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: AppColors.outline,
              size: spacing.AppSpacing.iconMd,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLocationCard() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              Icons.pin_drop,
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
                  'St. Luke\'s Medical Center - Global City',
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'Medical Arts Bldg, 4th Flr, Suite 412 • BGC, Taguig',
                  style: AppTextStyles.labelSm.copyWith(
                    fontSize: 12,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Container(
            height: 36,
            padding: EdgeInsets.symmetric(horizontal: spacing.AppSpacing.gutterSm),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Row(
              children: [
                Icon(
                  Icons.directions,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconSm,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Text(
                  'Map',
                  style: AppTextStyles.labelMd,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadReceiptButton() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.primaryFixed.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Icon(
                Icons.receipt_long,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconMd,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Upload Receipt',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                    Text(
                      'Upload your payment receipt for verification',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          PrimaryButton(
            text: 'Upload Receipt',
            onPressed: () {
              Navigator.of(context).pushNamed(
                '/payment',
                arguments: {
                  'appointmentId': _appointmentId,
                  'doctorName': widget.doctorName,
                  'consultationFee': widget.consultationFee,
                  'appointmentDate': widget.selectedDate,
                  'doctorId': widget.doctorId,
                },
              );
            },
            icon: const Icon(Icons.upload, size: 20),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomButton(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.95),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: PrimaryButton(
          text: 'View in Appointments',
          onPressed: () {
            Navigator.of(context).pushReplacementNamed(
              '/home',
              arguments: {'initialTab': 2},
            );
          },
          icon: const Icon(Icons.event_available, size: 20),
        ),
      ),
    );
  }
}
