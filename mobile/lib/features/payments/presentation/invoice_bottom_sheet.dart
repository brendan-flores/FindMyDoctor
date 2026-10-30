import 'dart:io';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/services/api_service.dart';

class InvoiceBottomSheet extends StatefulWidget {
  final String paymentId;

  const InvoiceBottomSheet({
    super.key,
    required this.paymentId,
  });

  @override
  State<InvoiceBottomSheet> createState() => _InvoiceBottomSheetState();
}

class _InvoiceBottomSheetState extends State<InvoiceBottomSheet> {
  final ApiService _apiService = ApiService();
  Map<String, dynamic>? _invoice;
  bool _isLoading = true;
  bool _isDownloading = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchInvoice();
  }

  Future<void> _fetchInvoice() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      print('Fetching invoice for paymentId: ${widget.paymentId}');
      final response = await _apiService.getInvoiceByPayment(widget.paymentId);
      print('Invoice response: $response');

      if (response['success'] == true) {
        setState(() {
          _invoice = response['data'];
          _isLoading = false;
        });
        print('Invoice loaded successfully: ${response['data']}');
      } else {
        final error = response['error']?['message'] ?? 'Invoice not found';
        print('Invoice fetch failed: $error');
        setState(() {
          _errorMessage = error;
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Invoice fetch exception: $e');
      setState(() {
        _errorMessage = 'Failed to load invoice: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _retryFetchInvoice() async {
    await _fetchInvoice();
  }

  Future<void> _downloadInvoice() async {
    if (_invoice == null) return;

    setState(() {
      _isDownloading = true;
    });

    try {
      final invoiceId = _invoice!['id']?.toString();
      if (invoiceId == null) {
        throw Exception('Invoice ID not found');
      }

      print('Downloading invoice PDF for invoiceId: $invoiceId');
      final pdfBytes = await _apiService.downloadInvoicePdf(invoiceId);
      print('PDF download successful, size: ${pdfBytes.length} bytes');
      
      final invoiceNumber = _invoice!['invoice_number']?.toString() ?? 'invoice';

      // Save file to device
      final directory = await getApplicationDocumentsDirectory();
      final file = File('${directory.path}/$invoiceNumber.pdf');
      await file.writeAsBytes(pdfBytes);
      print('Invoice saved to: ${file.path}');

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Invoice saved to: ${file.path}'),
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      print('Invoice download exception: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download invoice: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isDownloading = false;
        });
      }
    }
  }

  String _formatCurrency(double amount) {
    return '₱${amount.toStringAsFixed(2)}';
  }

  String _formatDate(String dateString) {
    final date = DateTime.parse(dateString);
    return DateFormat('MMMM d, yyyy • h:mm a').format(date);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: _isLoading
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(32.0),
                child: CircularProgressIndicator(),
              ),
            )
          : _errorMessage != null
              ? _buildErrorView()
              : _invoice != null
                  ? _buildInvoiceView()
                  : const Center(child: Text('No invoice data')),
    );
  }

  Widget _buildErrorView() {
    return Padding(
      padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.receipt_long,
            size: 64,
            color: AppColors.outline,
          ),
          const SizedBox(height: 16),
          Text(
            'Invoice Not Available',
            style: AppTextStyles.headlineSm.copyWith(
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _errorMessage ?? 'Invoice not available',
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.secondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Please make sure the payment has been marked as paid by the secretary.',
            style: AppTextStyles.bodySm.copyWith(
              color: AppColors.outline,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _retryFetchInvoice(),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterMd,
                    ),
                  ),
                  child: const Text('Retry'),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInvoiceView() {
    final data = _invoice!['invoice_data'];
    final invoiceNumber = _invoice!['invoice_number']?.toString() ?? '';
    final invoiceDate = _invoice!['invoice_date']?.toString() ?? '';

    return Column(
      children: [
        // Header with close button
        Container(
          padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border(
              bottom: BorderSide(
                color: AppColors.outline.withValues(alpha: 0.2),
              ),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Invoice',
                  style: AppTextStyles.headlineSm,
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),

        // Invoice Content
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Invoice header with number and date
                Container(
                  padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Invoice #$invoiceNumber',
                            style: AppTextStyles.headlineSm,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _formatDate(invoiceDate),
                            style: AppTextStyles.bodySm.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: spacing.AppSpacing.gutterMd,
                          vertical: spacing.AppSpacing.gutterSm,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.green,
                          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusSm),
                        ),
                        child: Text(
                          'PAID',
                          style: AppTextStyles.labelSm.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterLg),

                // Two-column layout for Clinic and Doctor
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _buildCompactInfoSection(
                        'Clinic',
                        [
                          if (data['clinic']?['name'] != null)
                            data['clinic']['name'],
                          if (data['clinic']?['address'] != null)
                            data['clinic']['address'],
                          if (data['clinic']?['contact_number'] != null)
                            data['clinic']['contact_number'],
                        ],
                      ),
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterMd),
                    Expanded(
                      child: _buildCompactInfoSection(
                        'Doctor',
                        [
                          'Dr. ${data['doctor']?['first_name'] ?? ''} ${data['doctor']?['last_name'] ?? ''}',
                          if (data['doctor']?['specialty'] != null)
                            data['doctor']['specialty'],
                          if (data['doctor']?['practice_name'] != null)
                            data['doctor']['practice_name'],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterLg),

                // Patient info (full width)
                _buildCompactInfoSection(
                  'Bill To',
                  [
                    '${data['patient']?['first_name'] ?? ''} ${data['patient']?['last_name'] ?? ''}',
                    if (data['patient']?['email'] != null)
                      data['patient']['email'],
                    if (data['patient']?['phone'] != null)
                      data['patient']['phone'],
                    if (data['patient']?['address'] != null)
                      data['patient']['address'],
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterLg),

                // Charges table
                _buildChargesTable(data),
                const SizedBox(height: spacing.AppSpacing.gutterLg),

                // Payment breakdown
                _buildPaymentBreakdown(data),
                const SizedBox(height: spacing.AppSpacing.gutterLg),

                // Footer
                Container(
                  padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: Column(
                    children: [
                      if (data['clinic']?['footer_line'] != null)
                        Text(
                          data['clinic']['footer_line'],
                          style: AppTextStyles.bodySm.copyWith(
                            color: AppColors.secondary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      const SizedBox(height: spacing.AppSpacing.gutterXs),
                      Text(
                        'This is a computer-generated invoice.',
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.outline,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Footer buttons
        Container(
          padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border(
              top: BorderSide(
                color: AppColors.outline.withValues(alpha: 0.2),
              ),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterMd,
                    ),
                  ),
                  child: const Text('Done'),
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: ElevatedButton(
                  onPressed: _isDownloading ? null : _downloadInvoice,
                  style: ElevatedButton.styleFrom(
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterMd,
                    ),
                  ),
                  child: _isDownloading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.download, size: 18),
                            SizedBox(width: 8),
                            Text('Download'),
                          ],
                        ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCompactInfoSection(String title, List<String?> items) {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          ...items.where((item) => item != null && item.isNotEmpty).map(
                (item) => Padding(
                  padding: EdgeInsets.only(
                    bottom: spacing.AppSpacing.gutterXs,
                  ),
                  child: Text(
                    item!,
                    style: AppTextStyles.bodySm,
                  ),
                ),
              ),
        ],
      ),
    );
  }

  Widget _buildChargesTable(Map<String, dynamic> data) {
    final payment = data['payment'] ?? {};
    final charges = data['charges'] as List<dynamic>? ?? [];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.outline.withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        children: [
          // Table header
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.primaryContainer.withValues(alpha: 0.1),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(spacing.AppSpacing.radiusLg),
                topRight: Radius.circular(spacing.AppSpacing.radiusLg),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text(
                    'Description',
                    style: AppTextStyles.labelSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Expanded(
                  flex: 1,
                  child: Text(
                    'Qty',
                    style: AppTextStyles.labelSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                Expanded(
                  flex: 1,
                  child: Text(
                    'Rate',
                    style: AppTextStyles.labelSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ),
                Expanded(
                  flex: 1,
                  child: Text(
                    'Amount',
                    style: AppTextStyles.labelSm.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),

          // Consultation fee row
          _buildChargeRow(
            'Consultation Fee',
            '1',
            _formatCurrency(payment['consultation_amount']?.toDouble() ?? 0),
            _formatCurrency(payment['consultation_amount']?.toDouble() ?? 0),
          ),

          // Additional charges
          ...charges.map((charge) {
            final description = charge['description'] ?? 'Additional Charge';
            final chargeType = charge['charge_type'];
            final amount = charge['amount']?.toDouble() ?? 0;

            if (chargeType == 'MEDICINE') {
              final quantity = charge['quantity'] ?? 1;
              final unitPrice = charge['unit_price']?.toDouble() ?? amount;
              return _buildChargeRow(
                description,
                quantity.toString(),
                _formatCurrency(unitPrice),
                _formatCurrency(amount),
              );
            } else {
              return _buildChargeRow(
                description,
                '-',
                '-',
                _formatCurrency(amount),
              );
            }
          }),
        ],
      ),
    );
  }

  Widget _buildChargeRow(String description, String qty, String rate, String amount) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterMd,
        vertical: spacing.AppSpacing.gutterSm,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: AppColors.outline.withValues(alpha: 0.1),
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              description,
              style: AppTextStyles.bodySm,
            ),
          ),
          Expanded(
            flex: 1,
            child: Text(
              qty,
              style: AppTextStyles.bodySm,
              textAlign: TextAlign.center,
            ),
          ),
          Expanded(
            flex: 1,
            child: Text(
              rate,
              style: AppTextStyles.bodySm,
              textAlign: TextAlign.right,
            ),
          ),
          Expanded(
            flex: 1,
            child: Text(
              amount,
              style: AppTextStyles.bodySm.copyWith(
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentBreakdown(Map<String, dynamic> data) {
    final payment = data['payment'] ?? {};
    final subtotal = payment['subtotal']?.toDouble() ?? 0;
    final advancePayment = payment['advance_payment']?.toDouble() ?? 0;
    final cashTendered = payment['cash_tendered']?.toDouble() ?? 0;
    final amountApplied = payment['amount_applied']?.toDouble() ?? 0;
    final changeAmount = payment['change_amount']?.toDouble() ?? 0;
    final finalBalance = payment['final_balance']?.toDouble() ?? 0;
    final totalPaid = advancePayment + cashTendered;

    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        border: Border.all(
          color: AppColors.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Summary',
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Subtotal
          _buildPaymentRow('Subtotal', _formatCurrency(subtotal)),
          const SizedBox(height: spacing.AppSpacing.gutterSm),

          // Payment breakdown
          if (advancePayment > 0) ...[
            _buildPaymentRow('GCash Advance', _formatCurrency(advancePayment)),
            if (amountApplied > 0)
              _buildPaymentRow('  Applied to balance', _formatCurrency(amountApplied), isIndented: true),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
          ],

          if (cashTendered > 0) ...[
            _buildPaymentRow('Cash Payment', _formatCurrency(cashTendered)),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
          ],

          if (changeAmount > 0) ...[
            _buildPaymentRow('Change Returned', _formatCurrency(changeAmount), isHighlighted: true),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
          ],

          // Divider
          Container(
            height: 1,
            color: AppColors.outline.withValues(alpha: 0.2),
            margin: EdgeInsets.symmetric(vertical: spacing.AppSpacing.gutterSm),
          ),

          // Total paid
          _buildPaymentRow('TOTAL PAID', _formatCurrency(totalPaid), isBold: true),

          if (finalBalance > 0) ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            _buildPaymentRow('Remaining Balance', _formatCurrency(finalBalance), isError: true),
          ],
        ],
      ),
    );
  }

  Widget _buildPaymentRow(String label, String value, {bool isBold = false, bool isHighlighted = false, bool isError = false, bool isIndented = false}) {
    return Padding(
      padding: EdgeInsets.only(
        left: isIndented ? spacing.AppSpacing.gutterLg : 0,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTextStyles.bodySm.copyWith(
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
              color: isError ? Colors.red : (isHighlighted ? Colors.green : AppColors.onSurface),
            ),
          ),
          Text(
            value,
            style: AppTextStyles.bodySm.copyWith(
              fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
              color: isError ? Colors.red : (isHighlighted ? Colors.green : AppColors.onSurface),
            ),
          ),
        ],
      ),
    );
  }
}
