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
import 'appointment_detail_page.dart';
import '../../payments/presentation/invoice_bottom_sheet.dart';

class AppointmentsPage extends StatefulWidget {
  final ApiService? apiService;

  const AppointmentsPage({super.key, this.apiService});

  @override
  State<AppointmentsPage> createState() => _AppointmentsPageState();
}

class _AppointmentsPageState extends State<AppointmentsPage> {
  String _selectedFilter = 'upcoming';
  late final ApiService _apiService;
  List<dynamic> _allAppointments = []; // Store all appointments
  List<dynamic> _appointments = []; // Filtered appointments for display
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _fetchAppointments();
  }

  Future<void> _fetchAppointments() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Fetch all appointments without status filter
      final response = await _apiService.getAppointments(status: null);

      if (response['success'] == true) {
        final appointments = response['data'] ?? [];
        print('Fetched ${appointments.length} appointments');
        
        // Log completed appointments with payment status
        final completedAppointments = appointments.where((a) => a['status'] == 'COMPLETED').toList();
        print('Completed appointments: ${completedAppointments.length}');
        for (var apt in completedAppointments) {
          print('  - ID: ${apt['id']}, PaymentStatus: ${apt['payment_status']}, PaymentId: ${apt['payment_id']}');
        }
        
        setState(() {
          _allAppointments = appointments;
          _filterAppointments();
          _isLoading = false;
        });
      } else {
        print('Failed to fetch appointments: ${response['error']}');
        setState(() {
          _errorMessage = response['error']?['message'] ?? 'Failed to load appointments';
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Exception fetching appointments: $e');
      setState(() {
        _errorMessage = 'Failed to load appointments: $e';
        _isLoading = false;
      });
    }
  }

  void _filterAppointments() {
    switch (_selectedFilter) {
      case 'upcoming':
        _appointments = _allAppointments.where((a) => a['status'] == 'SCHEDULED').toList();
        break;
      case 'completed':
        _appointments = _allAppointments.where((a) => a['status'] == 'COMPLETED').toList();
        break;
      case 'cancelled':
        _appointments = _allAppointments.where((a) => a['status'] == 'CANCELLED').toList();
        break;
    }
  }

  Future<void> _navigateToDetail(String appointmentId) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => AppointmentDetailPage(
          appointmentId: appointmentId,
          apiService: _apiService,
        ),
      ),
    );

    // Refresh the list if returning from detail page after cancellation
    if (result == true) {
      _fetchAppointments();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          const AppHeader(showNotifications: true, showProfile: true),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchAppointments,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Padding(
                  padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildHeader(),
                      const SizedBox(height: spacing.AppSpacing.gutterMd),
                      _buildSearchBar(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildFilterTabs(),
                      const SizedBox(height: spacing.AppSpacing.gutterLg),
                      _buildAppointmentsList(),
                      const SizedBox(height: spacing.AppSpacing.gutter3xl),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final upcomingCount = _allAppointments.where((a) => a['status'] == 'SCHEDULED').length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Text(
                  'My Appointments',
                  style: AppTextStyles.headlineMd,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterSm,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primaryContainer,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                  ),
                  child: Text(
                    '$upcomingCount Active',
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.onPrimary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Text(
          'Manage your clinic visits, queue passes & medical records',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.secondary,
          ),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterSm,
        vertical: spacing.AppSpacing.gutterXs,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(
            Icons.search,
            color: AppColors.outline,
            size: spacing.AppSpacing.iconLg,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search doctor, hospital, or specialty...',
                hintStyle: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.outline,
                ),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(
                  vertical: spacing.AppSpacing.gutterXs,
                ),
              ),
            ),
          ),
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              Icons.tune,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconSm,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterXs),
      decoration: BoxDecoration(
        color: AppColors.surfaceLow,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildFilterTab('Upcoming', 'upcoming'),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Expanded(
            child: _buildFilterTab('Completed', 'completed'),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterXs),
          Expanded(
            child: _buildFilterTab('Cancelled', 'cancelled'),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label, String filter) {
    final isSelected = _selectedFilter == filter;
    final count = _allAppointments.where((a) {
      switch (filter) {
        case 'upcoming':
          return a['status'] == 'SCHEDULED';
        case 'completed':
          return a['status'] == 'COMPLETED';
        case 'cancelled':
          return a['status'] == 'CANCELLED';
        default:
          return false;
      }
    }).length;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedFilter = filter;
          _filterAppointments();
        });
      },
      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterXs,
          vertical: spacing.AppSpacing.gutterSm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.surfaceLowest : Colors.transparent,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.slate800.withValues(alpha: 0.05),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: AppTextStyles.labelMd.copyWith(
                color: isSelected ? AppColors.primary : AppColors.secondary,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.1)
                    : AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
              ),
              child: Center(
                child: Text(
                  count.toString(),
                  style: AppTextStyles.labelSm.copyWith(
                    color: isSelected ? AppColors.primary : AppColors.secondary,
                    fontSize: 10,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppointmentsList() {
    if (_isLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: CircularProgressIndicator(),
        ),
      );
    }

    if (_errorMessage != null) {
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
                onPressed: _fetchAppointments,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_appointments.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: [
              Icon(
                Icons.event_busy,
                size: 64,
                color: AppColors.outline,
              ),
              const SizedBox(height: 16),
              Text(
                'No appointments yet',
                style: AppTextStyles.headlineSm.copyWith(
                  color: AppColors.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your appointments will appear here',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final filteredAppointments = _appointments.where((a) {
      switch (_selectedFilter) {
        case 'upcoming':
          return a['status'] == 'SCHEDULED';
        case 'completed':
          return a['status'] == 'COMPLETED';
        case 'cancelled':
          return a['status'] == 'CANCELLED';
        default:
          return false;
      }
    }).toList();

    if (filteredAppointments.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: Column(
            children: [
              Icon(
                Icons.event_busy,
                size: 64,
                color: AppColors.outline,
              ),
              const SizedBox(height: 16),
              Text(
                'No $_selectedFilter appointments',
                style: AppTextStyles.headlineSm.copyWith(
                  color: AppColors.onSurface,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: filteredAppointments.map((appointment) {
        return Padding(
          padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
          child: _buildAppointmentCard(appointment),
        );
      }).toList(),
    );
  }

  Widget _buildAppointmentCard(Map<String, dynamic> appointment) {
    final doctorFirstName = appointment['doctor_first_name'] ?? '';
    final doctorLastName = appointment['doctor_last_name'] ?? '';
    final specialty = appointment['specialty'] ?? '';
    final practiceName = appointment['practice_name'] ?? 'Private Practice';
    final professionalPhotoUrl = appointment['professional_photo_url']?.toString();
    final appointmentDateStr = parseString(appointment['appointment_date']);
    final appointmentDate = appointmentDateStr != null
        ? DateTime.tryParse(appointmentDateStr)
        : null;
    final queueNumber = parseInt(appointment['queue_number']);
    final status = appointment['status'];
    final appointmentId = appointment['id']?.toString() ?? '';
    // consultation_fee is a PostgreSQL DECIMAL column, so the API delivers it
    // as a JSON string (e.g. "500.00") - parse it instead of casting.
    final consultationFee = parseNum(appointment['consultation_fee']);
    final paymentStatus = parseString(appointment['payment_status']);
    final paymentMethod = parseString(appointment['payment_method']);
    final paymentId = appointment['payment_id']?.toString();

    // Show invoice button only for completed appointments with PAID status (case-insensitive)
    final showInvoiceButton = status == 'COMPLETED' && paymentStatus?.toUpperCase() == 'PAID' && paymentId != null;

    // Enhanced debug logging for invoice button visibility
    print('=== Invoice Button Debug (Appointments List) ===');
    print('Appointment ID: $appointmentId');
    print('Status: $status');
    print('Payment Status: $paymentStatus');
    print('Payment Status (uppercase): ${paymentStatus?.toUpperCase()}');
    print('Payment ID: $paymentId');
    print('Show Invoice Button: $showInvoiceButton');
    print('Full appointment object: $appointment');
    print('================================================');

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      onTap: () => _navigateToDetail(appointmentId),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                decoration: BoxDecoration(
                  color: status == 'SCHEDULED'
                      ? AppColors.tertiaryContainer.withValues(alpha: 0.15)
                      : status == 'COMPLETED'
                          ? AppColors.surfaceContainer
                          : AppColors.errorContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                ),
                child: Row(
                  children: [
                    Icon(
                      status == 'SCHEDULED'
                          ? Icons.radio_button_checked
                          : status == 'COMPLETED'
                              ? Icons.check_circle
                              : Icons.cancel,
                      size: spacing.AppSpacing.iconSm,
                      color: status == 'SCHEDULED'
                          ? AppColors.onTertiaryContainer
                          : status == 'COMPLETED'
                              ? AppColors.tertiary
                              : AppColors.onErrorContainer,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Text(
                      status == 'SCHEDULED'
                          ? queueNumber != null
                              ? 'Confirmed • Queue #$queueNumber'
                              : 'Confirmed'
                          : status == 'COMPLETED'
                              ? 'Completed'
                              : 'Cancelled',
                      style: AppTextStyles.labelMd.copyWith(
                        color: status == 'SCHEDULED'
                            ? AppColors.onTertiaryContainer
                            : status == 'COMPLETED'
                                ? AppColors.secondary
                                : AppColors.onErrorContainer,
                      ),
                    ),
                  ],
                ),
              ),
              if (showInvoiceButton)
                GestureDetector(
                  onTap: () {
                    print('Invoice button tapped for paymentId: $paymentId');
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (context) => InvoiceBottomSheet(paymentId: paymentId!),
                    );
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterSm,
                      vertical: spacing.AppSpacing.gutterXs,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.receipt_long,
                          size: spacing.AppSpacing.iconSm,
                          color: AppColors.primary,
                        ),
                        const SizedBox(width: spacing.AppSpacing.gutterXs),
                        Text(
                          'View Invoice',
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Doctor info
          Row(
            children: [
              DoctorProfileImage(
                photoUrl: professionalPhotoUrl,
                size: 64,
                showVerifiedBadge: true,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Dr. $doctorFirstName $doctorLastName',
                      style: AppTextStyles.headlineSm,
                    ),
                    Text(
                      specialty,
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Row(
                      children: [
                        Icon(
                          Icons.apartment,
                          color: AppColors.outline,
                          size: spacing.AppSpacing.iconSm,
                        ),
                        const SizedBox(width: spacing.AppSpacing.gutterXs),
                        Expanded(
                          child: Text(
                            practiceName,
                            style: AppTextStyles.bodyMd.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          // Schedule info
          Container(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
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
                        color: AppColors.surfaceLowest,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                      ),
                      child: Icon(
                        Icons.event,
                        color: AppColors.primary,
                        size: spacing.AppSpacing.iconMd,
                      ),
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          appointmentDate != null
                              ? DateFormat('EEEE, MMM d, yyyy').format(appointmentDate)
                              : 'Date not available',
                          style: AppTextStyles.bodyMdMedium,
                        ),
                        Text(
                          appointmentDate != null
                              ? DateFormat('hh:mm a').format(appointmentDate)
                              : 'Time not available',
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Consultation',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                        letterSpacing: 0.5,
                      ),
                    ),
                    Text(
                      consultationFee != null
                          ? '₱${consultationFee.toStringAsFixed(0)}'
                          : '₱---',
                      style: AppTextStyles.headlineSm,
                    ),
                    if (paymentStatus != null) ...[
                      const SizedBox(height: spacing.AppSpacing.gutterXs),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            paymentStatus == 'PAID'
                                ? Icons.check_circle
                                : paymentStatus == 'PENDING_VERIFICATION'
                                    ? Icons.pending
                                    : paymentStatus == 'REJECTED'
                                        ? Icons.cancel
                                        : Icons.schedule,
                            size: 12,
                            color: paymentStatus == 'PAID'
                                ? AppColors.brandAccentBlue
                                : paymentStatus == 'PENDING_VERIFICATION'
                                    ? AppColors.urgentAmber
                                    : paymentStatus == 'REJECTED'
                                        ? AppColors.error
                                        : AppColors.secondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _formatPaymentStatus(paymentStatus),
                            style: AppTextStyles.labelSm.copyWith(
                              color: paymentStatus == 'PAID'
                                  ? AppColors.brandAccentBlue
                                  : paymentStatus == 'PENDING_VERIFICATION'
                                      ? AppColors.urgentAmber
                                      : paymentStatus == 'REJECTED'
                                          ? AppColors.error
                                          : AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                    if (paymentMethod != null) ...[
                      const SizedBox(height: spacing.AppSpacing.gutterXs),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            paymentMethod.toUpperCase() == 'GCASH'
                                ? Icons.account_balance_wallet
                                : Icons.local_atm,
                            size: 12,
                            color: AppColors.secondary,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            paymentMethod.toUpperCase(),
                            style: AppTextStyles.labelSm.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (status == 'SCHEDULED') ...[
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primaryContainer,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                    ),
                    child: ElevatedButton(
                      onPressed: () {},
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primaryContainer,
                        foregroundColor: AppColors.onPrimary,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.confirmation_number,
                            size: spacing.AppSpacing.iconMd,
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterSm),
                          Text(
                            'View Queue Pass',
                            style: AppTextStyles.bodyLgMedium,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Container(
                  height: 48,
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterMd,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: Icon(
                    Icons.chat,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceLow,
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  ),
                  child: Icon(
                    Icons.directions,
                    color: AppColors.secondary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  String _formatPaymentStatus(String? status) {
    if (status == null) return 'Not Available';
    switch (status) {
      case 'UNPAID':
        return 'Unpaid';
      case 'PENDING_VERIFICATION':
        return 'Pending';
      case 'PAID':
        return 'Paid';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  }
}
