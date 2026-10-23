import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';

class PaymentScreen extends StatefulWidget {
  final String appointmentId;
  final String? doctorName;
  final String? consultationFee;
  final DateTime? appointmentDate;
  final String? doctorId;

  const PaymentScreen({
    super.key,
    required this.appointmentId,
    this.doctorName,
    this.consultationFee,
    this.appointmentDate,
    this.doctorId,
  });

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  final ApiService _apiService = ApiService();
  final ImagePicker _imagePicker = ImagePicker();

  File? _receiptImage;
  bool _isUploading = false;
  bool _isLoadingPayment = true;
  Map<String, dynamic>? _paymentData;
  String? _errorMessage;
  bool _hasUploadedReceipt = false;

  @override
  void initState() {
    super.initState();
    _fetchPaymentDetails();
  }

  Future<void> _fetchPaymentDetails() async {
    setState(() {
      _isLoadingPayment = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getPayment(widget.appointmentId);

      if (kDebugMode) {
        print('Payment response: $response');
      }

      if (response['success'] == true) {
        setState(() {
          _paymentData = response['data'];
          _isLoadingPayment = false;
          // Check if receipt was already uploaded
          if (_paymentData?['receipt_url'] != null) {
            _hasUploadedReceipt = true;
          }
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
      if (kDebugMode) {
        print('Payment fetch error: $e');
      }
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
      final response = await _apiService.uploadPaymentReceipt(
        appointmentId: widget.appointmentId,
        receiptFile: _receiptImage!,
      );

      if (response['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Receipt uploaded successfully'),
              backgroundColor: AppColors.primary,
            ),
          );
          // Clear the selected image after successful upload
          setState(() {
            _receiptImage = null;
            _hasUploadedReceipt = true;
          });
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
            onBackPressed: () {
              if (_hasUploadedReceipt) {
                // If receipt was uploaded, navigate to appointments page
                Navigator.of(context).pushNamedAndRemoveUntil('/appointments', (route) {
                  // Keep the home page in the stack to maintain proper navigation
                  return route.settings.name == '/home';
                });
              } else {
                // If no receipt uploaded, go back to previous page (booking confirmation)
                Navigator.of(context).pop();
              }
            },
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
                    else if (_paymentData == null)
                      const Center(
                        child: Text('No payment data available'),
                      )
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
          'Upload Receipt',
          style: AppTextStyles.headlineMd.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Text(
          'Upload your GCash payment receipt for verification',
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
    final receiptUrl = _paymentData?['receipt_url'] as String?;

    // If already paid or receipt uploaded, show status
    if (status == 'PAID' || receiptUrl != null) {
      return Column(
        children: [
          _buildPaymentStatusCard(status),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          if (receiptUrl != null) _buildReceiptView(receiptUrl),
        ],
      );
    }

    // Show receipt upload interface for pending verification or unpaid
    return Column(
      children: [
        _buildPaymentStatusCard(status),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildReceiptUploadSection(),
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

  Widget _buildReceiptUploadSection() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
                      'Upload GCash Receipt',
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
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          PrimaryButton(
            text: 'Select Receipt Image',
            onPressed: _pickReceiptImage,
            icon: const Icon(Icons.upload, size: 20),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          if (_receiptImage != null) ...[
            Row(
              children: [
                Image.asset(
                  'assets/images/gcash_logo.png',
                  width: 20,
                  height: 20,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Text(
                  'Receipt Preview',
                  style: AppTextStyles.labelSm.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
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
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            PrimaryButton(
              text: _isUploading ? 'Uploading...' : 'Submit Receipt',
              onPressed: _isUploading ? null : _uploadReceipt,
              icon: const Icon(Icons.upload, size: 20),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildReceiptView(String receiptUrl) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.check_circle,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconMd,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Receipt Uploaded',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                    Text(
                      'Your receipt has been uploaded and is pending verification',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
