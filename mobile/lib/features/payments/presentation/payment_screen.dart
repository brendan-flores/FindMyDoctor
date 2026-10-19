import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import '../../../core/constants/api_constants.dart';

class PaymentScreen extends StatefulWidget {
  final String appointmentId;
  final String? doctorName;
  final String? consultationFee;
  final DateTime? appointmentDate;

  const PaymentScreen({
    super.key,
    required this.appointmentId,
    this.doctorName,
    this.consultationFee,
    this.appointmentDate,
  });

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final ApiService _apiService = ApiService();
  final ImagePicker _imagePicker = ImagePicker();

  String _selectedPaymentMethod = 'CASH'; // 'GCASH' or 'CASH'
  File? _receiptImage;
  bool _isUploading = false;
  bool _isLoadingPayment = true;
  Map<String, dynamic>? _paymentData;
  String? _errorMessage;
  String? _gcashQrUrl;

  @override
  void initState() {
    super.initState();
    _fetchPaymentDetails();
    _fetchGcashQr();
  }

  Future<void> _fetchPaymentDetails() async {
    setState(() {
      _isLoadingPayment = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getPayment(widget.appointmentId);

      if (response['success'] == true) {
        setState(() {
          _paymentData = response['data'];
          _isLoadingPayment = false;
        });
      } else {
        // If payment not found (404), it's normal - patient hasn't made a payment yet
        // Initialize with default UNPAID status
        if (response['error']?['code'] == 'NOT_FOUND') {
          setState(() {
            _paymentData = {
              'status': 'UNPAID',
              'payment_method': null,
            };
            _isLoadingPayment = false;
          });
        } else {
          setState(() {
            _errorMessage = response['error']?['message'] ?? 'Failed to load payment details';
            _isLoadingPayment = false;
          });
        }
      }
    } catch (e) {
      // Check if it's a 404 error (payment not found)
      if (e.toString().contains('NOT_FOUND') || e.toString().contains('404')) {
        setState(() {
          _paymentData = {
            'status': 'UNPAID',
            'payment_method': null,
          };
          _isLoadingPayment = false;
        });
      } else {
        setState(() {
          _errorMessage = 'Failed to load payment details: $e';
          _isLoadingPayment = false;
        });
      }
    }
  }

  Future<void> _fetchGcashQr() async {
    try {
      final response = await _apiService.getGcashQr();
      if (response['success'] == true) {
        final qrPath = response['data']?['qrUrl'];
        // Construct full URL for the QR code
        if (qrPath != null) {
          setState(() {
            _gcashQrUrl = '${ApiConstants.baseUrl}$qrPath';
          });
        }
      }
    } catch (e) {
      print('Failed to load GCash QR: $e');
    }
  }

  Future<void> _pickReceiptImage() async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1080,
        imageQuality: 85,
      );

      if (image != null) {
        // Check file size (5MB limit)
        final file = File(image.path);
        final fileSize = await file.length();
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (fileSize > maxSize) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Image size must be less than 5MB'),
                backgroundColor: AppColors.error,
              ),
            );
          }
          return;
        }

        setState(() {
          _receiptImage = file;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick image: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Future<void> _uploadReceipt() async {
    if (_receiptImage == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please select a receipt image'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() {
      _isUploading = true;
    });

    try {
      // TODO: Implement actual image upload to backend
      // This requires backend support for multipart/form-data file uploads
      // For now, simulate upload with a placeholder URL
      final receiptUrl = 'https://placeholder.com/receipt.jpg';

      final response = await _apiService.uploadPaymentReceipt(
        appointmentId: widget.appointmentId,
        receiptUrl: receiptUrl,
      );

      if (response['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Receipt uploaded successfully'),
              backgroundColor: AppColors.primary,
            ),
          );
          // Refresh payment details
          _fetchPaymentDetails();
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['error']?['message'] ?? 'Failed to upload receipt'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to upload receipt: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      setState(() {
        _isUploading = false;
      });
    }
  }

  String _getPaymentStatusText(String? status) {
    switch (status) {
      case 'UNPAID':
        return 'Unpaid';
      case 'PENDING_VERIFICATION':
        return 'Pending Verification';
      case 'PAID':
        return 'Paid';
      case 'REJECTED':
        return 'Rejected';
      default:
        return 'Unknown';
    }
  }

  Color _getPaymentStatusColor(String? status) {
    switch (status) {
      case 'UNPAID':
        return AppColors.secondary;
      case 'PENDING_VERIFICATION':
        return AppColors.tertiary;
      case 'PAID':
        return AppColors.primary;
      case 'REJECTED':
        return AppColors.error;
      default:
        return AppColors.secondary;
    }
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
                    _buildHeader(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    if (_isLoadingPayment)
                      const Center(child: CircularProgressIndicator())
                    else if (_errorMessage != null)
                      _buildErrorState()
                    else
                      _buildPaymentContent(),
                    const SizedBox(height: spacing.AppSpacing.gutter3xl),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Payment',
          style: AppTextStyles.headlineMd.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Text(
          'Choose your payment method',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.secondary,
          ),
        ),
      ],
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
              onPressed: _fetchPaymentDetails,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentContent() {
    final status = _paymentData?['status'] as String?;
    final paymentMethod = _paymentData?['payment_method'] as String?;

    return Column(
      children: [
        _buildPaymentStatusCard(status),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildPaymentMethodSelection(paymentMethod, status),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        if (_selectedPaymentMethod == 'GCASH') _buildGcashSection(status),
        if (_selectedPaymentMethod == 'CASH') _buildCashSection(status),
      ],
    );
  }

  Widget _buildPaymentStatusCard(String? status) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: _getPaymentStatusColor(status).withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              status == 'PAID' ? Icons.check_circle : Icons.payment,
              color: _getPaymentStatusColor(status),
              size: spacing.AppSpacing.iconXl,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Payment Status',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  _getPaymentStatusText(status),
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    color: _getPaymentStatusColor(status),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.gutterMd,
              vertical: spacing.AppSpacing.gutterSm,
            ),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
            ),
            child: Text(
              '₱${widget.consultationFee ?? '1,000'}',
              style: AppTextStyles.bodyMdMedium.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelection(String? paymentMethod, String? status) {
    final isPaid = status == 'PAID';

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Method',
            style: AppTextStyles.headlineSm.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          _buildPaymentMethodOption(
            'GCash',
            'Pay online with GCash',
            Icons.account_balance_wallet,
            customIcon: Image.asset(
              'assets/images/gcash_logo.png',
              width: 24,
              height: 24,
            ),
            isSelected: _selectedPaymentMethod == 'GCASH',
            isEnabled: !isPaid,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          _buildPaymentMethodOption(
            'Cash at Clinic',
            'Pay when you arrive',
            Icons.local_atm,
            isSelected: _selectedPaymentMethod == 'CASH',
            isEnabled: !isPaid,
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodOption(
    String title,
    String subtitle,
    IconData icon, {
    Widget? customIcon,
    bool isSelected = false,
    bool isEnabled = true,
  }) {
    // Handle the icon based on whether customIcon is provided
    // Custom icons (like GCash logo) should use their own colors
    // Standard icons should use theme colors
    Widget iconWidget;
    if (customIcon != null) {
      iconWidget = customIcon;
    } else {
      iconWidget = Icon(
        icon,
        color: isSelected ? AppColors.onPrimary : AppColors.secondary,
        size: spacing.AppSpacing.iconMd,
      );
    }
    return InkWell(
      onTap: isEnabled
          ? () {
              setState(() {
                _selectedPaymentMethod = title == 'GCash' ? 'GCASH' : 'CASH';
              });
            }
          : null,
      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      child: Container(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primaryFixed.withValues(alpha: 0.1)
              : AppColors.surfaceLow,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.surfaceContainerHighest,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary
                    : AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: iconWidget,
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.bodyMdMedium.copyWith(
                      color: isSelected ? AppColors.primary : AppColors.onSurface,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.secondary,
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              Icon(
                Icons.check_circle,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconLg,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildGcashSection(String? status) {
    final isPending = status == 'PENDING_VERIFICATION';
    final isPaid = status == 'PAID';
    final isRejected = status == 'REJECTED';

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Image.asset(
                'assets/images/gcash_logo.png',
                width: 32,
                height: 32,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Text(
                'GCash Payment',
                style: AppTextStyles.headlineSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (_gcashQrUrl != null)
            Center(
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  border: Border.all(color: AppColors.surfaceContainerHighest),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  child: Image.network(
                    _gcashQrUrl!,
                    width: 200,
                    height: 200,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.qr_code_2,
                              size: 80,
                              color: AppColors.secondary,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'QR code not available',
                              style: AppTextStyles.labelSm.copyWith(
                                color: AppColors.secondary,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                    loadingBuilder: (context, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return Center(
                        child: CircularProgressIndicator(
                          value: loadingProgress.expectedTotalBytes != null
                              ? loadingProgress.cumulativeBytesLoaded /
                                  loadingProgress.expectedTotalBytes!
                              : null,
                        ),
                      );
                    },
                  ),
                ),
              ),
            )
          else
            Center(
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  color: AppColors.surfaceLow,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  border: Border.all(color: AppColors.surfaceContainerHighest),
                ),
                child: const Center(
                  child: CircularProgressIndicator(),
                ),
              ),
            ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                'assets/images/gcash_logo.png',
                width: 24,
                height: 24,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Text(
                'Scan the QR code with GCash to pay',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.secondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          if (isPending || isRejected)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Image.asset(
                      'assets/images/gcash_logo.png',
                      width: 20,
                      height: 20,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Text(
                      'Upload Receipt',
                      style: AppTextStyles.labelSm.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
                if (_receiptImage != null)
                  Container(
                    width: double.infinity,
                    height: 150,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLow,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                      border: Border.all(color: AppColors.surfaceContainerHighest),
                    ),
                    child: Stack(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                          child: Image.file(
                            _receiptImage!,
                            width: double.infinity,
                            height: 150,
                            fit: BoxFit.cover,
                          ),
                        ),
                        Positioned(
                          top: spacing.AppSpacing.gutterSm,
                          right: spacing.AppSpacing.gutterSm,
                          child: GestureDetector(
                            onTap: () {
                              setState(() {
                                _receiptImage = null;
                              });
                            },
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.close,
                                color: AppColors.onError,
                                size: spacing.AppSpacing.iconSm,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  InkWell(
                    onTap: _pickReceiptImage,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                    child: Container(
                      width: double.infinity,
                      height: 150,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLow,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                        border: Border.all(
                          color: AppColors.surfaceContainerHighest,
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.add_photo_alternate,
                            size: 48,
                            color: AppColors.secondary,
                          ),
                          const SizedBox(height: spacing.AppSpacing.gutterSm),
                          Text(
                            'Tap to upload receipt',
                            style: AppTextStyles.labelSm.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                          Text(
                            'JPEG/PNG, max 5MB',
                            style: AppTextStyles.labelSm.copyWith(
                              fontSize: 11,
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: spacing.AppSpacing.gutterMd),
                PrimaryButton(
                  text: _isUploading ? 'Uploading...' : 'Upload Receipt',
                  onPressed: _isUploading ? null : _uploadReceipt,
                  icon: const Icon(Icons.upload, size: 20),
                ),
              ],
            )
          else if (isPaid)
            Container(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                color: AppColors.primaryFixed.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.check_circle,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: Text(
                      'Payment verified',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            PrimaryButton(
              text: 'I have paid',
              onPressed: _pickReceiptImage,
              icon: const Icon(Icons.upload, size: 20),
            ),
        ],
      ),
    );
  }

  Widget _buildCashSection(String? status) {
    final isPaid = status == 'PAID';

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Cash at Clinic',
            style: AppTextStyles.headlineSm.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primaryFixed,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                ),
                child: Icon(
                  Icons.store,
                  color: AppColors.primary,
                  size: spacing.AppSpacing.iconXl,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Pay at the clinic cashier',
                      style: AppTextStyles.bodyMdMedium,
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      'Please bring exact amount if possible',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          if (isPaid)
            Container(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                color: AppColors.primaryFixed.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.check_circle,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: Text(
                      'Payment recorded',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            )
          else
            Container(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                color: AppColors.surfaceLow,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: AppColors.tertiary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                  Expanded(
                    child: Text(
                      'Payment will be recorded when you visit the clinic',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
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
}
