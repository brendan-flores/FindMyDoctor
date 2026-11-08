import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import '../../../core/utils/json_parsers.dart';
import 'invoice_bottom_sheet.dart';

/// Centralized patient payments hub: lists every payment record for the
/// authenticated patient (newest first), filters by derived payment status,
/// shows GCash QR/account details, receipt upload entry points, and invoice
/// view/download actions when an ACTIVE invoice exists.
class PaymentsHubPage extends StatefulWidget {
  final ApiService? apiService;

  const PaymentsHubPage({super.key, this.apiService});

  @override
  State<PaymentsHubPage> createState() => _PaymentsHubPageState();
}

class _PaymentsHubPageState extends State<PaymentsHubPage> {
  late final ApiService _apiService;

  List<Map<String, dynamic>> _payments = [];
  bool _isLoading = true;
  String? _errorMessage;
  String _selectedFilter = 'all';

  static const List<({String key, String label})> _filters = [
    (key: 'all', label: 'All'),
    (key: 'unpaid', label: 'Unpaid'),
    (key: 'pending', label: 'Pending'),
    (key: 'paid', label: 'Paid'),
    (key: 'rejected', label: 'Rejected'),
  ];

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _fetchPayments();
  }

  Future<void> _fetchPayments() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await _apiService.getMyPayments();
      if (!mounted) return;

      if (response['success'] == true && response['data'] is List) {
        final items = <Map<String, dynamic>>[];
        for (final item in response['data'] as List) {
          if (item is Map) {
            items.add(Map<String, dynamic>.from(item));
          }
        }
        setState(() {
          _payments = items;
          _isLoading = false;
        });
      } else {
        setState(() {
          _errorMessage =
              response['error']?['message'] ?? 'Failed to load payments';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Failed to load payments. Check your connection.';
        _isLoading = false;
      });
    }
  }

  /// Maps a raw payment status to one of the hub filter buckets.
  String _filterBucket(String? status) {
    switch (status) {
      case 'UNPAID':
      case 'PARTIAL':
        return 'unpaid';
      case 'PENDING_VERIFICATION':
      case 'FOR_REVIEW':
        return 'pending';
      case 'PAID':
      case 'OVERPAID':
        return 'paid';
      case 'REJECTED':
        return 'rejected';
      default:
        // CANCELLED and unknown statuses only appear under "All".
        return 'other';
    }
  }

  List<Map<String, dynamic>> get _visiblePayments {
    if (_selectedFilter == 'all') return _payments;
    return _payments
        .where((p) => _filterBucket(parseString(p['status'])) == _selectedFilter)
        .toList();
  }

  String _formatCurrency(num? amount) {
    if (amount == null) return '₱---';
    return '₱${amount.toStringAsFixed(2)}';
  }

  String _formatDate(dynamic value) {
    final raw = parseString(value);
    if (raw == null) return 'Date not available';
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return DateFormat('EEEE, MMM d, yyyy • h:mm a').format(parsed.toLocal());
  }

  String _doctorName(Map<String, dynamic> payment) {
    final first = parseString(payment['doctor_first_name']) ?? '';
    final last = parseString(payment['doctor_last_name']) ?? '';
    final name = 'Dr. $first $last'.trim();
    return name == 'Dr.' ? 'Doctor' : name;
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'UNPAID':
        return 'Unpaid';
      case 'PARTIAL':
        return 'Partially Paid';
      case 'PENDING_VERIFICATION':
      case 'FOR_REVIEW':
        return 'Pending Verification';
      case 'PAID':
        return 'Paid';
      case 'OVERPAID':
        return 'Overpaid';
      case 'REJECTED':
        return 'Rejected';
      case 'CANCELLED':
        return 'Cancelled';
      default:
        return status ?? 'Unknown';
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'PAID':
      case 'OVERPAID':
        return AppColors.primary;
      case 'PENDING_VERIFICATION':
      case 'FOR_REVIEW':
        return AppColors.tertiary;
      case 'REJECTED':
        return AppColors.error;
      default:
        return AppColors.secondary;
    }
  }

  IconData _statusIcon(String? status) {
    switch (status) {
      case 'PAID':
      case 'OVERPAID':
        return Icons.check_circle;
      case 'PENDING_VERIFICATION':
      case 'FOR_REVIEW':
        return Icons.pending;
      case 'REJECTED':
        return Icons.cancel;
      case 'CANCELLED':
        return Icons.event_busy;
      default:
        return Icons.schedule;
    }
  }

  void _openPaymentUpload(Map<String, dynamic> payment) {
    final appointmentId = parseString(payment['appointment_id']);
    if (appointmentId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'This payment is not linked to an appointment. Please contact the clinic.',
          ),
        ),
      );
      return;
    }

    final appointmentDateRaw = parseString(payment['appointment_date']);
    final total = parseNum(payment['total_amount']);

    Navigator.of(context).pushNamed(
      '/payment',
      arguments: {
        'appointmentId': appointmentId,
        'doctorName': _doctorName(payment),
        'consultationFee': total?.toStringAsFixed(2),
        'appointmentDate': appointmentDateRaw != null
            ? DateTime.tryParse(appointmentDateRaw)
            : null,
        'doctorId': parseString(payment['doctor_id']),
      },
    );
  }

  Future<void> _viewReceipt(Map<String, dynamic> payment) async {
    final appointmentId = parseString(payment['appointment_id']);
    if (appointmentId == null) return;

    try {
      final response = await _apiService.getMyReceiptUrl(appointmentId);
      final signedUrl = response['data']?['signedUrl']?.toString();
      if (!mounted) return;

      if (signedUrl == null || signedUrl.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No receipt found for this payment.')),
        );
        return;
      }

      showDialog(
        context: context,
        builder: (_) => _ReceiptViewerDialog(imageUrl: signedUrl),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to load the receipt. Please try again.'),
        ),
      );
    }
  }

  void _viewInvoice(Map<String, dynamic> payment) {
    final invoiceId = parseString(payment['invoice_id']);
    final paymentId = parseString(payment['id']);

    if (invoiceId == null && paymentId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invoice is not available yet.')),
      );
      return;
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => InvoiceBottomSheet(
        invoiceId: invoiceId,
        paymentId: invoiceId == null ? paymentId : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const AppHeader(
            showBackButton: true,
            showNotifications: true,
            showProfile: true,
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchPayments,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: spacing.AppSpacing.gutterLg),
                          Text('Payments', style: AppTextStyles.headlineLg),
                          const SizedBox(height: spacing.AppSpacing.gutterXs),
                          Text(
                            'Your consultation payments and invoices',
                            style: AppTextStyles.bodyMd.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                          const SizedBox(height: spacing.AppSpacing.gutterLg),
                          _buildFilterBar(),
                          const SizedBox(height: spacing.AppSpacing.gutterLg),
                        ],
                      ),
                    ),
                  ),
                  if (_isLoading)
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (_errorMessage != null)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildErrorState(),
                    )
                  else if (_visiblePayments.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: _buildEmptyState(),
                    )
                  else
                    SliverPadding(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.screenPadding,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (context, index) => Padding(
                            padding: EdgeInsets.only(
                              bottom: spacing.AppSpacing.gutterMd,
                            ),
                            child: _buildPaymentCard(_visiblePayments[index]),
                          ),
                          childCount: _visiblePayments.length,
                        ),
                      ),
                    ),
                  const SliverToBoxAdapter(
                    child: SizedBox(height: spacing.AppSpacing.gutter3xl),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final filter in _filters) ...[
            _buildFilterChip(filter.key, filter.label),
            const SizedBox(width: spacing.AppSpacing.gutterSm),
          ],
        ],
      ),
    );
  }

  Widget _buildFilterChip(String key, String label) {
    final isSelected = _selectedFilter == key;
    final count = key == 'all'
        ? _payments.length
        : _payments
              .where((p) => _filterBucket(parseString(p['status'])) == key)
              .length;

    return InkWell(
      onTap: () => setState(() => _selectedFilter = key),
      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterMd,
          vertical: spacing.AppSpacing.gutterSm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceLow,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.slate200,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: AppTextStyles.labelMd.copyWith(
                color: isSelected ? AppColors.onPrimary : AppColors.secondary,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.onPrimary.withValues(alpha: 0.2)
                    : AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusFull,
                ),
              ),
              child: Text(
                '$count',
                style: AppTextStyles.labelSm.copyWith(
                  color: isSelected ? AppColors.onPrimary : AppColors.secondary,
                  fontSize: 10,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 64, color: AppColors.error),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              _errorMessage!,
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.error),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            OutlinedButton.icon(
              onPressed: _fetchPayments,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.receipt_long_outlined,
              size: 64,
              color: AppColors.outline,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              _selectedFilter == 'all'
                  ? 'No payments yet'
                  : 'No ${_filters.firstWhere((f) => f.key == _selectedFilter).label.toLowerCase()} payments',
              style: AppTextStyles.headlineSm.copyWith(
                color: AppColors.onSurface,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              'Payments for your consultations will appear here.',
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentCard(Map<String, dynamic> payment) {
    final status = parseString(payment['status']);
    final statusColor = _statusColor(status);
    final consultation = parseNum(payment['consultation_amount']);
    final charges = parseNum(payment['total_additional_charges']);
    final total = parseNum(payment['total_amount']);
    final amountPaid = parseNum(payment['amount_paid']) ?? 0;
    final balance = parseNum(payment['balance']);
    final paymentMethod = parseString(payment['payment_method']);
    final doctorId = parseString(payment['doctor_id']);
    final hasReceipt = payment['has_receipt'] == true ||
        parseString(payment['receipt_url']) != null;
    final invoiceId = parseString(payment['invoice_id']);
    final invoiceNumber = parseString(payment['invoice_number']);
    final rejectionReason = parseString(payment['reject_reason']);
    final rejectionNote = parseString(payment['reject_note']);
    final appointmentId = parseString(payment['appointment_id']);

    final bucket = _filterBucket(status);
    final canPay =
        (bucket == 'unpaid' || status == 'REJECTED') && appointmentId != null;

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: doctor + status
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _doctorName(payment),
                      style: AppTextStyles.bodyMdMedium,
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      _formatDate(payment['appointment_date']),
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusFull,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(_statusIcon(status), size: 14, color: statusColor),
                    const SizedBox(width: 4),
                    Text(
                      _statusLabel(status),
                      style: AppTextStyles.labelSm.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Amount breakdown
          _buildBreakdownRow('Consultation', consultation),
          if (charges != null && charges > 0)
            _buildBreakdownRow('Medicine & other charges', charges),
          const Divider(height: spacing.AppSpacing.gutterMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Total', style: AppTextStyles.bodyMdMedium),
              Text(
                _formatCurrency(total),
                style: AppTextStyles.bodyMdMedium.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          if (amountPaid > 0 && status != 'PAID' && status != 'OVERPAID') ...[
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Amount paid',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
                Text(
                  _formatCurrency(amountPaid),
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Balance',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
                Text(
                  _formatCurrency(balance),
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
          ],

          const SizedBox(height: spacing.AppSpacing.gutterSm),

          // Payment method + receipt indicator
          Row(
            children: [
              Icon(
                paymentMethod?.toUpperCase() == 'GCASH'
                    ? Icons.account_balance_wallet_outlined
                    : Icons.local_atm_outlined,
                size: 14,
                color: AppColors.secondary,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterXs),
              Text(
                paymentMethod?.toUpperCase() ?? 'No method',
                style: AppTextStyles.labelSm.copyWith(
                  color: AppColors.secondary,
                ),
              ),
              if (hasReceipt) ...[
                const SizedBox(width: spacing.AppSpacing.gutterMd),
                Icon(
                  Icons.receipt_long,
                  size: 14,
                  color: AppColors.secondary,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Text(
                  'Receipt uploaded',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ],
          ),

          // Rejection reason
          if (status == 'REJECTED' &&
              (rejectionReason != null || rejectionNote != null)) ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(spacing.AppSpacing.gutterSm),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                border: Border.all(
                  color: AppColors.error.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Reason: ${rejectionReason ?? 'Not provided'}',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.error,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (rejectionNote != null) ...[
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      rejectionNote,
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.error,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],

          const SizedBox(height: spacing.AppSpacing.gutterMd),

          // Actions
          if (canPay) ...[
            _GcashQrSection(doctorId: doctorId, apiService: _apiService),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            PrimaryButton(
              text: status == 'REJECTED'
                  ? 'Upload New Receipt'
                  : 'Pay with GCash',
              onPressed: () => _openPaymentUpload(payment),
              icon: const Icon(Icons.qr_code_2, size: 20),
            ),
            if (status == 'REJECTED' && hasReceipt)
              TextButton.icon(
                onPressed: () => _viewReceipt(payment),
                icon: const Icon(Icons.image_outlined, size: 16),
                label: const Text('View previous receipt'),
              ),
          ],

          if (bucket == 'pending') ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Your receipt is being reviewed by the clinic.',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.secondary,
                    ),
                  ),
                ),
                if (hasReceipt)
                  TextButton.icon(
                    onPressed: () => _viewReceipt(payment),
                    icon: const Icon(Icons.image_outlined, size: 16),
                    label: const Text('View receipt'),
                  ),
              ],
            ),
          ],

          if ((status == 'PAID' || status == 'OVERPAID') &&
              invoiceId != null) ...[
            OutlinedButton.icon(
              onPressed: () => _viewInvoice(payment),
              icon: const Icon(Icons.receipt_long, size: 18),
              label: Text('View Invoice${invoiceNumber != null ? ' ($invoiceNumber)' : ''}'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: BorderSide(
                  color: AppColors.primary.withValues(alpha: 0.3),
                ),
                padding: EdgeInsets.symmetric(
                  vertical: spacing.AppSpacing.gutterMd,
                ),
              ),
            ),
          ],

          if ((status == 'PAID' || status == 'OVERPAID') &&
              invoiceId == null) ...[
            Text(
              'Invoice will be available once issued by the clinic.',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.secondary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildBreakdownRow(String label, num? amount) {
    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterXs),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.secondary,
            ),
          ),
          Text(
            _formatCurrency(amount),
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

/// Lazily loads and displays the doctor's GCash QR code and account details.
/// Shows clear fallback states for missing QR configuration, loading, and
/// network failures, each with a retry action.
class _GcashQrSection extends StatefulWidget {
  final String? doctorId;
  final ApiService apiService;

  const _GcashQrSection({required this.doctorId, required this.apiService});

  @override
  State<_GcashQrSection> createState() => _GcashQrSectionState();
}

class _GcashQrSectionState extends State<_GcashQrSection> {
  bool _expanded = false;
  bool _isLoading = false;
  bool _hasLoaded = false;
  String? _qrUrl;
  String? _accountName;
  String? _accountNumber;
  String? _error;

  Future<void> _load() async {
    if (widget.doctorId == null) {
      setState(() {
        _error = 'QR code is not available for this payment.';
        _hasLoaded = true;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await widget.apiService.getGcashQr(
        doctorId: widget.doctorId!,
      );
      if (!mounted) return;

      if (response['success'] == true && response['data'] != null) {
        setState(() {
          _qrUrl = response['data']['qrUrl']?.toString();
          _accountName = response['data']['accountName']?.toString();
          _accountNumber = response['data']['accountNumber']?.toString();
          _isLoading = false;
          _hasLoaded = true;
        });
      } else {
        setState(() {
          _error = response['error']?['message'] ??
              'GCash QR code is not configured for this doctor.';
          _isLoading = false;
          _hasLoaded = true;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load the GCash QR code. Check your connection.';
        _isLoading = false;
        _hasLoaded = true;
      });
    }
  }

  void _toggle() {
    setState(() {
      _expanded = !_expanded;
    });
    if (_expanded && !_hasLoaded && !_isLoading) {
      _load();
    }
  }

  void _copyAccountNumber() {
    if (_accountNumber == null) return;
    Clipboard.setData(ClipboardData(text: _accountNumber!));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Account number copied')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: _toggle,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          child: Padding(
            padding: EdgeInsets.symmetric(
              vertical: spacing.AppSpacing.gutterXs,
            ),
            child: Row(
              children: [
                Icon(
                  Icons.qr_code_2,
                  size: spacing.AppSpacing.iconMd,
                  color: AppColors.primary,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Expanded(
                  child: Text(
                    'GCash QR & account details',
                    style: AppTextStyles.labelMd.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  color: AppColors.secondary,
                ),
              ],
            ),
          ),
        ),
        if (_expanded) ...[
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          _buildContent(),
        ],
      ],
    );
  }

  Widget _buildContent() {
    if (_isLoading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: spacing.AppSpacing.gutterMd),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Container(
        width: double.infinity,
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        decoration: BoxDecoration(
          color: AppColors.surfaceLow,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          border: Border.all(color: AppColors.surfaceContainerHighest),
        ),
        child: Column(
          children: [
            Text(
              _error!,
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.secondary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            TextButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
        border: Border.all(color: AppColors.surfaceContainerHighest),
      ),
      child: Column(
        children: [
          if (_qrUrl != null)
            ClipRRect(
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              child: Image.network(
                _qrUrl!,
                width: 180,
                height: 180,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const SizedBox(
                    width: 180,
                    height: 180,
                    child: Center(child: CircularProgressIndicator()),
                  );
                },
                errorBuilder: (context, error, stackTrace) => Container(
                  width: 180,
                  height: 180,
                  color: AppColors.surfaceContainer,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.broken_image, color: AppColors.outline),
                      const SizedBox(height: spacing.AppSpacing.gutterXs),
                      TextButton.icon(
                        onPressed: _load,
                        icon: const Icon(Icons.refresh, size: 16),
                        label: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(
                vertical: spacing.AppSpacing.gutterMd,
              ),
              child: Text(
                'QR image is not available. Use the account details below.',
                style: AppTextStyles.labelSm.copyWith(
                  color: AppColors.secondary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          if (_accountName != null || _accountNumber != null) ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            if (_accountName != null)
              Text(
                _accountName!,
                style: AppTextStyles.bodyMd.copyWith(
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
            if (_accountNumber != null) ...[
              const SizedBox(height: spacing.AppSpacing.gutterXs),
              InkWell(
                onTap: _copyAccountNumber,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusSm,
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _accountNumber!,
                        style: AppTextStyles.bodyMdMedium.copyWith(
                          fontSize: 18,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(width: spacing.AppSpacing.gutterXs),
                      const Icon(Icons.copy, size: 14, color: AppColors.primary),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// Full-screen receipt image viewer for the signed receipt URL.
class _ReceiptViewerDialog extends StatelessWidget {
  final String imageUrl;

  const _ReceiptViewerDialog({required this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.black,
      insetPadding: const EdgeInsets.all(16),
      child: Stack(
        children: [
          InteractiveViewer(
            maxScale: 5,
            child: Center(
              child: Image.network(
                imageUrl,
                fit: BoxFit.contain,
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const Padding(
                    padding: EdgeInsets.all(48),
                    child: CircularProgressIndicator(color: Colors.white),
                  );
                },
                errorBuilder: (context, error, stackTrace) => const Padding(
                  padding: EdgeInsets.all(48),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.broken_image, color: Colors.white54, size: 48),
                      SizedBox(height: 12),
                      Text(
                        'Could not load receipt',
                        style: TextStyle(color: Colors.white70),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
        ],
      ),
    );
  }
}
