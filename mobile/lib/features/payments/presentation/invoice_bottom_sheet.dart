import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/file_save_service.dart';

class InvoiceBottomSheet extends StatefulWidget {
  final String? paymentId;
  final String? invoiceId;
  final ApiService? apiService;

  const InvoiceBottomSheet({
    super.key,
    this.paymentId,
    this.invoiceId,
    this.apiService,
  }) : assert(paymentId != null || invoiceId != null, 'Either paymentId or invoiceId must be provided');

  @override
  State<InvoiceBottomSheet> createState() => _InvoiceBottomSheetState();
}

class _InvoiceBottomSheetState extends State<InvoiceBottomSheet> {
  late final ApiService _apiService;
  Map<String, dynamic>? _invoice;
  bool _isLoading = true;
  bool _isDownloading = false;
  String? _errorMessage;

  @override
  void initState() {
    _apiService = widget.apiService ?? ApiService();
    super.initState();
    _fetchInvoice();
  }

  Future<void> _fetchInvoice() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      Map<String, dynamic> response;

      if (widget.invoiceId != null) {
        response = await _apiService.getInvoiceById(widget.invoiceId!);
      } else {
        response = await _apiService.getInvoiceByPayment(widget.paymentId!);
      }

      if (response['success'] == true) {
        setState(() {
          _invoice = response['data'];
          _isLoading = false;
        });
      } else {
        final error = response['error']?['message'] ?? 'Invoice not found';
        setState(() {
          _errorMessage = error;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to load invoice: $e';
        _isLoading = false;
      });
    }
  }

  Future<void> _downloadInvoice() async {
    if (_invoice == null) return;

    setState(() {
      _isDownloading = true;
    });

    try {
      final invoiceId = widget.invoiceId ?? _invoice!['id']?.toString();
      if (invoiceId == null) {
        throw Exception('Invoice ID not found');
      }

      final pdfBytes = await _apiService.downloadInvoicePdf(invoiceId);

      if (pdfBytes.isEmpty) {
        throw Exception('Downloaded PDF is empty');
      }

      final invoiceNumber = _invoice!['invoice_number']?.toString() ?? 'invoice';
      final fileName = 'invoice-$invoiceNumber.pdf';

      final savedFile = await FileSaveService.savePdf(pdfBytes, fileName);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              savedFile.requiresShareSheet
                  ? 'Invoice ready. Choose where to save $fileName.'
                  : 'Invoice saved to ${savedFile.displayLocation}/$fileName',
            ),
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to download invoice: ${e.toString()}'),
            backgroundColor: AppColors.error,
            duration: const Duration(seconds: 5),
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

  double _parseDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) {
      return double.tryParse(value) ?? 0.0;
    }
    return 0.0;
  }

  String _formatDate(String dateString) {
    if (dateString.trim().isEmpty) return '';
    try {
      final date = DateTime.parse(dateString);
      return DateFormat('MMMM d, yyyy • h:mm a').format(date);
    } catch (_) {
      return dateString;
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.9,
        ),
        decoration: const BoxDecoration(
          color: AppColors.surfaceLowest,
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        clipBehavior: Clip.antiAlias,
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
      ),
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
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _fetchInvoice,
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
    dynamic rawInvoiceData = _invoice!['invoice_data'];
    if (rawInvoiceData is String) {
      try {
        rawInvoiceData = jsonDecode(rawInvoiceData);
      } catch (_) {
        rawInvoiceData = <String, dynamic>{};
      }
    }

    final data = (rawInvoiceData is Map<String, dynamic>)
        ? rawInvoiceData
        : (rawInvoiceData is Map
            ? Map<String, dynamic>.from(rawInvoiceData)
            : <String, dynamic>{});

    final invoiceNumber = _invoice!['invoice_number']?.toString() ?? '';
    final invoiceDate = _invoice!['invoice_date']?.toString() ?? '';

    return Column(
      mainAxisSize: MainAxisSize.min,
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
                  'Invoice Preview',
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
        Flexible(
          child: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header section
                  Text(
                    'Find My Doctor',
                    style: AppTextStyles.headlineMd.copyWith(
                      color: const Color(0xFF1B5EB8),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          'INVOICE #$invoiceNumber',
                          style: AppTextStyles.headlineSm.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          _formatDate(invoiceDate),
                          style: AppTextStyles.bodySm,
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Bill To
                  Text(
                    'Bill To: ${data['patient']?['first_name'] ?? ''} ${data['patient']?['last_name'] ?? ''}',
                    style: AppTextStyles.bodyMd,
                  ),
                  const SizedBox(height: 8),
                  if (data['patient']?['email'] != null)
                    Text('Email: ${data['patient']['email']}', style: AppTextStyles.bodySm),
                  if (data['patient']?['phone'] != null)
                    Text('Phone: ${data['patient']['phone']}', style: AppTextStyles.bodySm),
                  const SizedBox(height: 16),

                  // Charges Table
                  _buildChargesTable(data),
                  const SizedBox(height: 16),

                  // Totals
                  _buildTotalsSection(data),
                  const SizedBox(height: 16),

                  // Footer
                  if (data['clinic']?['footer_line'] != null)
                    Text(
                      data['clinic']['footer_line'],
                      style: AppTextStyles.bodySm.copyWith(
                        color: AppColors.secondary,
                      ),
                      textAlign: TextAlign.center,
                    ),
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
          child: Align(
            alignment: Alignment.centerRight,
            child: Wrap(
              alignment: WrapAlignment.end,
              spacing: spacing.AppSpacing.gutterMd,
              runSpacing: spacing.AppSpacing.gutterSm,
              children: [
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  style: OutlinedButton.styleFrom(
                    // The global theme sets an infinite minimum width, which
                    // overflows the footer on narrow screens.
                    minimumSize: const Size(0, spacing.AppSpacing.buttonHeight),
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterLg,
                      vertical: spacing.AppSpacing.gutterMd,
                    ),
                  ),
                  child: const Text('Done'),
                ),
                ElevatedButton(
                  onPressed: _isDownloading ? null : _downloadInvoice,
                  style: ElevatedButton.styleFrom(
                    // Prevent the global infinite minimum width from forcing
                    // an unbounded width in the footer.
                    minimumSize: const Size(0, spacing.AppSpacing.buttonHeight),
                    backgroundColor: AppColors.primary,
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterLg,
                      vertical: spacing.AppSpacing.gutterMd,
                    ),
                  ),
                  child: _isDownloading
                      ? const SizedBox(
                          height: 16,
                          width: 16,
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
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildChargesTable(Map<String, dynamic> data) {
    final payment = data['payment'] ?? {};
    final charges = data['charges'] as List<dynamic>? ?? [];

    return Column(
      children: [
        // Table header
        Row(
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
            SizedBox(
              width: 40,
              child: Text(
                'Qty',
                style: AppTextStyles.labelSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            SizedBox(
              width: 60,
              child: Text(
                'Rate',
                style: AppTextStyles.labelSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.right,
              ),
            ),
            SizedBox(
              width: 60,
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
        const SizedBox(height: 8),

        // Consultation fee row
        _buildChargeRow(
          'Consultation Fee',
          '1',
          _formatCurrency(_parseDouble(payment['consultation_amount'])),
          _formatCurrency(_parseDouble(payment['consultation_amount'])),
        ),

        // Additional charges
        ...charges.map((charge) {
          final description = charge['description']?.toString() ?? 'Additional Charge';
          final chargeType = charge['charge_type']?.toString();
          final amount = _parseDouble(charge['amount']);

          if (chargeType == 'MEDICINE') {
            final quantity = charge['quantity'] ?? 1;
            final unitPrice = _parseDouble(charge['unit_price']) > 0
                ? _parseDouble(charge['unit_price'])
                : amount;
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
    );
  }

  Widget _buildChargeRow(String description, String quantity, String rate, String amount) {
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              description,
              style: AppTextStyles.bodySm,
            ),
          ),
          SizedBox(
            width: 40,
            child: Text(
              quantity,
              style: AppTextStyles.bodySm,
              textAlign: TextAlign.center,
            ),
          ),
          SizedBox(
            width: 60,
            child: Text(
              rate,
              style: AppTextStyles.bodySm,
              textAlign: TextAlign.right,
            ),
          ),
          SizedBox(
            width: 60,
            child: Text(
              amount,
              style: AppTextStyles.bodySm,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalsSection(Map<String, dynamic> data) {
    final payment = (data['payment'] is Map<String, dynamic>)
        ? data['payment'] as Map<String, dynamic>
        : (data['payment'] is Map
            ? Map<String, dynamic>.from(data['payment'] as Map)
            : <String, dynamic>{});
    final subtotal = _parseDouble(payment['subtotal']);
    final advancePayment = _parseDouble(payment['advance_payment']);
    final cashTendered = _parseDouble(payment['cash_tendered']);
    final changeAmount = _parseDouble(payment['change_amount']);
    final finalBalance = _parseDouble(payment['final_balance']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Subtotal
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                'Subtotal:',
                style: AppTextStyles.bodySm,
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                _formatCurrency(subtotal),
                style: AppTextStyles.bodySm,
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Payment Breakdown Section
        Text(
          'Payment Breakdown',
          style: AppTextStyles.labelSm.copyWith(
            fontWeight: FontWeight.bold,
            color: AppColors.secondary,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),

        // GCash Advance Payment
        if (advancePayment > 0)
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              border: Border.all(
                color: AppColors.outline.withValues(alpha: 0.2),
              ),
              borderRadius: BorderRadius.circular(8),
              color: AppColors.surfaceLow,
            ),
            margin: EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: Text(
                        'GCash Advance Payment',
                        style: AppTextStyles.bodySm.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        _formatCurrency(advancePayment),
                        style: AppTextStyles.bodySm.copyWith(
                          fontWeight: FontWeight.w500,
                        ),
                        textAlign: TextAlign.right,
                      ),
                    ),
                  ],
                ),
                if (_parseDouble(payment['amount_applied']) > 0) ...[
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(
                        child: Text(
                          'Amount applied to balance',
                          style: AppTextStyles.bodySm.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          _formatCurrency(_parseDouble(payment['amount_applied'])),
                          style: AppTextStyles.bodySm.copyWith(
                            color: AppColors.secondary,
                          ),
                          textAlign: TextAlign.right,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),

        // Cash Payment at Clinic
        if (cashTendered > 0)
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              border: Border.all(
                color: AppColors.outline.withValues(alpha: 0.2),
              ),
              borderRadius: BorderRadius.circular(8),
              color: AppColors.surfaceLow,
            ),
            margin: EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    'Cash Payment at Clinic',
                    style: AppTextStyles.bodySm.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _formatCurrency(cashTendered),
                    style: AppTextStyles.bodySm.copyWith(
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),

        // Change Returned
        if (changeAmount > 0) ...[
          const SizedBox(height: 8),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.gutterMd,
              vertical: spacing.AppSpacing.gutterSm,
            ),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    'Change Returned',
                    style: AppTextStyles.headlineSm.copyWith(
                      color: Colors.green,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _formatCurrency(changeAmount),
                    style: AppTextStyles.headlineSm.copyWith(
                      color: Colors.green,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 8),
        Container(
          height: 1,
          color: AppColors.outline.withValues(alpha: 0.3),
        ),
        const SizedBox(height: 8),

        // Total Paid
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                'TOTAL PAID:',
                style: AppTextStyles.headlineSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                _formatCurrency(advancePayment + cashTendered),
                style: AppTextStyles.headlineSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),

        // Remaining Balance
        if (finalBalance > 0)
          Padding(
            padding: EdgeInsets.only(top: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    'Remaining Balance:',
                    style: AppTextStyles.bodySm.copyWith(
                      color: Colors.red,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _formatCurrency(finalBalance),
                    style: AppTextStyles.bodySm.copyWith(
                      color: Colors.red,
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.right,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
