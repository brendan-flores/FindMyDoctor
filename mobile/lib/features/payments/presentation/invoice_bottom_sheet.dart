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
            child: Container(
              color: const Color(0xFFF8FAFC),
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              child: Container(
                color: Colors.white,
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header section - Logo + Clinic Info on left, Invoice # + Date on right
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Logo and clinic info
                        Row(
                          children: [
                            // Logo from cross.png
                            Image.asset(
                              'assets/images/cross.png',
                              width: 48,
                              height: 48,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Find My Doctor',
                                    style: const TextStyle(
                                      fontSize: 18,
                                      color: Color(0xFF1B5EB8),
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  if (data['clinic']?['name'] != null)
                                    Text(
                                      data['clinic']['name'],
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  if (data['clinic']?['address'] != null)
                                    Text(
                                      data['clinic']['address'],
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  if (data['clinic']?['contact_number'] != null)
                                    Text(
                                      'Contact: ${data['clinic']['contact_number']}',
                                      style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        // Invoice # and Date on right
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'INVOICE',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  'Invoice #: $invoiceNumber',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                                Text(
                                  _formatDate(invoiceDate),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Bill To section
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Bill To:',
                          style: AppTextStyles.bodySm.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${data['patient']?['first_name'] ?? ''} ${data['patient']?['last_name'] ?? ''}',
                          style: AppTextStyles.bodySm,
                        ),
                        if (data['patient']?['email'] != null)
                          Text('Email: ${data['patient']['email']}', style: AppTextStyles.bodySm),
                        if (data['patient']?['phone'] != null)
                          Text('Phone: ${data['patient']['phone']}', style: AppTextStyles.bodySm),
                        if (data['patient']?['address'] != null)
                          Text('Address: ${data['patient']['address']}', style: AppTextStyles.bodySm),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Line separator
                    Container(
                      height: 1,
                      color: const Color(0xFFE2E8F0),
                    ),
                    const SizedBox(height: 16),

                    // Charges Table
                    _buildChargesTable(data),
                    const SizedBox(height: 16),

                    // Totals
                    _buildTotalsSection(data),
                    const SizedBox(height: 24),

                    // Footer
                    Container(
                      height: 1,
                      color: const Color(0xFFE2E8F0),
                    ),
                    const SizedBox(height: 16),
                    if (data['clinic']?['footer_line'] != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          data['clinic']['footer_line'],
                          style: const TextStyle(
                            fontSize: 14,
                            color: Color(0xFF64748B),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    const Text(
                      'This is a computer-generated invoice.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF94A3B8),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Footer buttons
        Container(
          padding: EdgeInsets.only(
            left: spacing.AppSpacing.gutterMd,
            right: spacing.AppSpacing.gutterMd,
            top: spacing.AppSpacing.gutterMd,
          ),
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border(
              top: BorderSide(
                color: AppColors.outline.withValues(alpha: 0.2),
              ),
            ),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 48),
                        padding: EdgeInsets.symmetric(
                          horizontal: spacing.AppSpacing.gutterLg,
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
                        minimumSize: const Size(0, 48),
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
                  ),
                ],
              ),
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
        // Table header with border
        Container(
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: Color(0xFFE2E8F0)),
            ),
          ),
          child: const Row(
            children: [
              Expanded(
                flex: 1,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Description',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    softWrap: false,
                  ),
                ),
              ),
              SizedBox(width: 4),
              SizedBox(
                width: 28,
                child: Text(
                  'Qty',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              SizedBox(
                width: 72,
                child: Text(
                  'Rate',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.right,
                ),
              ),
              SizedBox(
                width: 72,
                child: Text(
                  'Amount',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
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
    return Container(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Color(0xFFF1F5F9)),
        ),
      ),
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            flex: 1,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                description,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF334155),
                ),
                maxLines: 1,
                softWrap: false,
              ),
            ),
          ),
          SizedBox(width: 4),
          SizedBox(
            width: 28,
            child: Text(
              quantity,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF334155),
              ),
              textAlign: TextAlign.center,
            ),
          ),
          SizedBox(
            width: 72,
            child: Text(
              rate,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF334155),
              ),
              textAlign: TextAlign.right,
            ),
          ),
          SizedBox(
            width: 72,
            child: Text(
              amount,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF334155),
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRefundLine(String label, double amount) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFFECACA)),
        borderRadius: BorderRadius.circular(8),
        color: const Color(0xFFFEF2F2),
      ),
      margin: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Color(0xFFB91C1C),
            ),
          ),
          Text(
            '-₱${amount.toStringAsFixed(2)}',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Color(0xFFB91C1C),
            ),
            textAlign: TextAlign.right,
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

    // Compute the breakdown from the accepted transaction snapshot — the same
    // source the PDF uses. Falls back to the legacy advance/cash columns for
    // invoices issued before the snapshot existed.
    final rawTxns = payment['transactions'];
    final txns = (rawTxns is List) ? rawTxns : const <dynamic>[];
    double cashPaid = 0;
    double gcashPaid = 0;
    double cashRefund = 0;
    double gcashRefund = 0;
    final gcashRefs = <String>[];
    for (final t in txns) {
      if (t is! Map) continue;
      final tx = Map<String, dynamic>.from(t);
      if ((tx['status'] ?? '').toString().toUpperCase() != 'ACCEPTED') continue;
      final kind = (tx['kind'] ?? 'PAYMENT').toString().toUpperCase();
      final method = (tx['method'] ?? '').toString().toUpperCase();
      final amount = _parseDouble(tx['amount']);
      final ref = tx['reference_no']?.toString();
      if (kind == 'REFUND') {
        if (method == 'CASH') {
          cashRefund += amount;
        } else if (method == 'GCASH') {
          gcashRefund += amount;
        }
        continue;
      }
      if (method == 'CASH') {
        cashPaid += amount;
      } else if (method == 'GCASH') {
        gcashPaid += amount;
        if (ref != null && ref.isNotEmpty) gcashRefs.add(ref);
      }
    }
    final hasTxnSnapshot = txns.isNotEmpty;
    gcashRefs.sort();
    final gcashRefsText = gcashRefs.join(', ');
    final cashLineAmount = hasTxnSnapshot ? cashPaid : cashTendered;
    final gcashLineAmount = hasTxnSnapshot ? gcashPaid : advancePayment;
    final totalPaidAmount = hasTxnSnapshot
        ? cashPaid + gcashPaid - cashRefund - gcashRefund
        : advancePayment + cashTendered;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Subtotal
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Flexible(
              child: Text(
                'Subtotal:',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF475569),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                _formatCurrency(subtotal),
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF475569),
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Line separator
        Container(
          height: 1,
          color: const Color(0xFFE2E8F0),
        ),
        const SizedBox(height: 8),

        // Payment Breakdown Section
        const Text(
          'Payment Breakdown',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: Color(0xFF64748B),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),

        // Cash line
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFE2E8F0)),
            borderRadius: BorderRadius.circular(8),
            color: const Color(0xFFF8FAFC),
          ),
          margin: const EdgeInsets.only(bottom: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Flexible(
                child: Text(
                  'Cash',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E293B),
                  ),
                ),
              ),
              Flexible(
                child: Text(
                  '₱${cashLineAmount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E293B),
                  ),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
        ),

        // GCash line
        if (gcashLineAmount != 0 || gcashRefsText.isNotEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(8),
              color: const Color(0xFFF8FAFC),
            ),
            margin: const EdgeInsets.only(bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    gcashRefsText.isNotEmpty
                        ? 'GCash · Ref: $gcashRefsText'
                        : 'GCash',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: gcashRefsText.isNotEmpty
                          ? FontWeight.w400
                          : FontWeight.w600,
                      color: gcashRefsText.isNotEmpty
                          ? const Color(0xFF475569)
                          : const Color(0xFF1E293B),
                    ),
                    softWrap: true,
                    overflow: TextOverflow.visible,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '₱${gcashLineAmount.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E293B),
                  ),
                  textAlign: TextAlign.right,
                ),
              ],
            ),
          ),

        // Refund lines (separate negative lines by method)
        if (cashRefund > 0)
          _buildRefundLine('Cash Refund', cashRefund),
        if (gcashRefund > 0)
          _buildRefundLine('GCash Refund', gcashRefund),

        // GCash Advance Payment
        if (!hasTxnSnapshot && advancePayment > 0)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(8),
              color: const Color(0xFFF8FAFC),
            ),
            margin: const EdgeInsets.only(bottom: 8),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Flexible(
                      child: Text(
                        'GCash Advance Payment',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        _formatCurrency(advancePayment),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E293B),
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
                      const Flexible(
                        child: Text(
                          'Amount applied to balance',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          _formatCurrency(_parseDouble(payment['amount_applied'])),
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
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
        if (!hasTxnSnapshot && cashTendered > 0)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(8),
              color: const Color(0xFFF8FAFC),
            ),
            margin: const EdgeInsets.only(bottom: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Flexible(
                  child: Text(
                    'Cash Payment at Clinic',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _formatCurrency(cashTendered),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1E293B),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),

        // Change Returned
        if (changeAmount > 0) ...[
          const SizedBox(height: 8),
          Container(
            height: 1,
            color: const Color(0xFFA7F3D0),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFECFDF5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Flexible(
                  child: Text(
                    'Change Returned',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF059669),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _formatCurrency(changeAmount),
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF059669),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 8),
        Container(
          height: 1,
          color: const Color(0xFFCBD5E1),
        ),
        const SizedBox(height: 8),

        // Total Paid
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Flexible(
              child: Text(
                'TOTAL PAID:',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                _formatCurrency(totalPaidAmount),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),

        // Remaining Balance
        if (finalBalance > 0)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Flexible(
                  child: Text(
                    'Remaining Balance:',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    _formatCurrency(finalBalance),
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFFDC2626),
                      fontWeight: FontWeight.w500,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
