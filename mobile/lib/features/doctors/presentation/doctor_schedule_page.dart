import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/services/doctor_service.dart';
import '../../../core/services/api_service.dart';

class DoctorSchedulePage extends StatefulWidget {
  final String doctorId;
  final String? doctorName;
  final String? specialty;
  final String? clinic;
  final String? consultationFee;
  final String? professionalPhotoUrl;

  const DoctorSchedulePage({
    super.key,
    required this.doctorId,
    this.doctorName,
    this.specialty,
    this.clinic,
    this.consultationFee,
    this.professionalPhotoUrl,
  });

  @override
  State<DoctorSchedulePage> createState() => _DoctorSchedulePageState();
}

class _DoctorSchedulePageState extends State<DoctorSchedulePage> {
  final DoctorService _doctorService = DoctorService();
  final ApiService _apiService = ApiService();

  DateTime? _selectedDate;
  String _selectedPaymentMethod = 'CASH'; // 'GCASH' or 'CASH'
  bool _isDownloading = false;
  bool _isLoadingQr = true;
  String? _qrUrl;

  Map<String, dynamic>? _availabilityData;
  bool _isLoading = true;
  bool _isCheckingRecord = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _selectedDate = null;
    _fetchAvailability();
    _fetchGcashQr();
  }

  Future<void> _fetchAvailability() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Backend handles week filtering for patients automatically
      // Just send current month as placeholder
      final now = DateTime.now();
      final startDate = DateTime(now.year, now.month, 1);
      final endDate = DateTime(now.year, now.month + 1, 0);

      final availability = await _doctorService.getDoctorAvailability(
        doctorId: widget.doctorId,
        startDate: DateFormat('yyyy-MM-dd').format(startDate),
        endDate: DateFormat('yyyy-MM-dd').format(endDate),
      );

      if (availability != null && availability['dates'] != null) {
        if (mounted) {
          setState(() {
            _availabilityData = availability;
            _isLoading = false;
          });
        }
      } else {
        if (mounted) {
          setState(() {
            _errorMessage = 'No availability data found';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to load availability: $e';
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _fetchGcashQr() async {
    try {
      final response = await _apiService.getGcashQr(doctorId: widget.doctorId);

      if (response['success'] == true && response['data'] != null) {
        if (mounted) {
          setState(() {
            _qrUrl = response['data']['qrUrl'];
            _isLoadingQr = false;
          });
        }
      } else {
        // QR code not configured
        if (mounted) {
          setState(() {
            _isLoadingQr = false;
          });
        }
      }
    } catch (e) {
      // QR code not available
      if (mounted) {
        setState(() {
          _isLoadingQr = false;
        });
      }
    }
  }

  Map<String, dynamic>? _getDateAvailability(DateTime date) {
    if (_availabilityData == null || _availabilityData!['dates'] == null) {
      return null;
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(date);
    final dates = _availabilityData!['dates'] as List;

    try {
      return dates.firstWhere((d) => d['date'] == dateStr);
    } catch (e) {
      return null;
    }
  }

  Future<void> _downloadQrCode() async {
    if (_qrUrl == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('QR code not available'),
            backgroundColor: AppColors.error,
          ),
        );
      }
      return;
    }

    setState(() {
      _isDownloading = true;
    });

    try {
      // Use application documents directory (no permission required on Android 10+)
      final directory = await getApplicationDocumentsDirectory();
      final fileName = 'gcash_qr_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final filePath = '${directory.path}/$fileName';

      // Download the QR code from the URL
      final response = await http.get(Uri.parse(_qrUrl!));
      if (response.statusCode == 200) {
        await File(filePath).writeAsBytes(response.bodyBytes);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('QR code saved to app storage'),
              backgroundColor: AppColors.primary,
            ),
          );
        }
      } else {
        throw Exception('Failed to download QR code');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save QR code: $e'),
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
                    _buildDoctorCard(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildCalendarSection(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    if (_selectedDate != null) _buildDateInfoSection(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildQueueSummary(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildPaymentMethodSelection(),
                    const SizedBox(height: spacing.AppSpacing.gutter3xl),
                  ],
                ),
              ),
            ),
          ),
          _buildBottomConfirmationBar(),
        ],
      ),
    );
  }

  Widget _buildDoctorCard() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          DoctorProfileImage(
            photoUrl: widget.professionalPhotoUrl,
            size: 56,
            showVerifiedBadge: true,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.doctorName ?? 'Doctor Name',
                  style: AppTextStyles.headlineSm.copyWith(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  '${widget.specialty ?? 'Specialty'} • ${widget.clinic ?? 'Clinic'}',
                  style: AppTextStyles.bodyMd.copyWith(
                    fontSize: 13,
                    color: AppColors.secondary,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
                Row(
                  children: [
                    Icon(
                      Icons.meeting_room,
                      color: AppColors.primary,
                      size: spacing.AppSpacing.iconSm,
                    ),
                    const SizedBox(width: spacing.AppSpacing.gutterXs),
                    Expanded(
                      child: Text(
                        'Room 412, Medical Arts',
                        style: AppTextStyles.labelSm.copyWith(
                          fontSize: 12,
                          color: AppColors.secondary,
                        ),
                      ),
                    ),
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterSm,
                        vertical: spacing.AppSpacing.gutterXs,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainer,
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                        border: Border.all(color: AppColors.surfaceContainerHighest),
                      ),
                      child: Text(
                        '₱${widget.consultationFee ?? '1,000'} / consult',
                        style: AppTextStyles.labelSm.copyWith(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
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
    );
  }

  Widget _buildCalendarSection() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                  border: Border.all(color: AppColors.surfaceContainerHighest),
                ),
                child: Icon(
                  Icons.calendar_month,
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
                      'Clinic Schedule & Calendar',
                      style: AppTextStyles.headlineSm.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    if (_selectedDate != null) ...[
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: AppColors.tertiary,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: spacing.AppSpacing.gutterXs),
                          Text(
                            _getWorkingHoursText(_selectedDate!),
                            style: AppTextStyles.labelMd.copyWith(
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                _getWeekRangeText(),
                style: AppTextStyles.bodyMdMedium.copyWith(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                  border: Border.all(color: AppColors.surfaceContainerHighest),
                ),
                child: Text(
                  'Regular Clinic',
                  style: AppTextStyles.labelSm.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (_isLoading)
            const Center(child: CircularProgressIndicator())
          else if (_errorMessage != null)
            Center(
              child: Text(
                _errorMessage!,
                style: AppTextStyles.bodyMd.copyWith(color: AppColors.error),
              ),
            )
          else
            Column(
              children: [
                _buildCalendarGrid(),
                const SizedBox(height: spacing.AppSpacing.gutterMd),
                _buildCalendarLegend(),
              ],
            ),
        ],
      ),
    );
  }

  String _getWorkingHoursText(DateTime date) {
    final availability = _getDateAvailability(date);
    if (availability == null || availability['workingHours'] == null) {
      return 'No schedule';
    }

    final workingHours = availability['workingHours'] as List;
    if (workingHours.isEmpty) {
      return 'Not available';
    }

    final first = workingHours.first;
    final last = workingHours.last;
    return '${first['start']} – ${last['end']}';
  }

  String _getWeekRangeText() {
    final now = DateTime.now();
    final dayOfWeek = now.weekday; // 1 = Monday, 7 = Sunday
    final startOfWeek = now.subtract(Duration(days: dayOfWeek % 7));
    final endOfWeek = startOfWeek.add(const Duration(days: 6));

    final startFormat = DateFormat('MMM d');
    final endFormat = DateFormat('MMM d, yyyy');

    return '${startFormat.format(startOfWeek)} - ${endFormat.format(endOfWeek)}';
  }

  Widget _buildCalendarGrid() {
    if (_availabilityData == null || _availabilityData!['dates'] == null) {
      return const SizedBox();
    }

    final dates = _availabilityData!['dates'] as List;
    final availabilityMap = <String, dynamic>{};
    for (final dateData in dates) {
      availabilityMap[dateData['date'] as String] = dateData;
    }

    // Calculate current week (Sunday to Saturday)
    final now = DateTime.now();
    final dayOfWeek = now.weekday; // 1 = Monday, 7 = Sunday
    final startOfWeek = now.subtract(Duration(days: dayOfWeek % 7));

    return Column(
      children: [
        // Weekday headers
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
              .map((day) => Expanded(
                    child: Center(
                      child: Text(
                        day,
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.slate400,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        // Calendar days - display as a single row of 7 days (this week)
        Row(
          children: List.generate(7, (index) {
            final date = startOfWeek.add(Duration(days: index));
            final dateStr = DateFormat('yyyy-MM-dd').format(date);
            final availability = availabilityMap[dateStr];
            final status = availability?['status'] as String? ?? 'NON_WORKING';
            final isSelected = _selectedDate != null &&
                date.year == _selectedDate!.year &&
                date.month == _selectedDate!.month &&
                date.day == _selectedDate!.day;

            return Expanded(
              child: Center(
                child: _buildCalendarDay(date.day, status, isSelected, date),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildCalendarDay(int day, String status, bool isSelected, DateTime date) {
    final isAvailable = status == 'AVAILABLE';
    final isFull = status == 'FULL';
    final isUnavailable = status == 'UNAVAILABLE';
    final isPast = status == 'PAST';
    final isNonWorking = status == 'NON_WORKING';
    final isAlreadyBooked = status == 'ALREADY_BOOKED';

    Color? backgroundColor;
    Color? textColor;

    if (isSelected) {
      backgroundColor = AppColors.primary;
      textColor = AppColors.onPrimary;
    } else if (isPast) {
      backgroundColor = null;
      textColor = AppColors.slate300;
    } else if (isUnavailable) {
      backgroundColor = AppColors.errorContainer.withValues(alpha: 0.3);
      textColor = AppColors.error;
    } else if (isAlreadyBooked) {
      backgroundColor = AppColors.secondaryContainer.withValues(alpha: 0.5);
      textColor = AppColors.secondary;
    } else if (isFull) {
      backgroundColor = AppColors.surfaceContainerHighest;
      textColor = AppColors.slate400;
    } else if (isNonWorking) {
      backgroundColor = null;
      textColor = AppColors.slate400;
    } else {
      backgroundColor = null;
      textColor = AppColors.onSurface;
    }

    return GestureDetector(
      onTap: isAvailable
          ? () {
              setState(() {
                _selectedDate = date;
              });
            }
          : null,
      child: Container(
        margin: EdgeInsets.symmetric(horizontal: 2),
        height: 36,
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          border: isSelected ? null : Border.all(
            color: isAvailable ? AppColors.primary.withValues(alpha: 0.3) : Colors.transparent,
            width: 1,
          ),
        ),
        child: Center(
          child: Text(
            day.toString(),
            style: AppTextStyles.labelSm.copyWith(
              color: textColor,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDateInfoSection() {
    if (_selectedDate == null) return const SizedBox();

    final availability = _getDateAvailability(_selectedDate!);
    if (availability == null) {
      return AppCard(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Text(
          'No availability data for selected date',
          style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
        ),
      );
    }

    final status = availability['status'] as String?;
    final capacity = availability['capacity'] as Map?;

    // Show message if patient already has an appointment on this date
    if (status == 'ALREADY_BOOKED') {
      return AppCard(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.event_busy,
                  color: AppColors.secondary,
                  size: spacing.AppSpacing.iconMd,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Text(
                  'Already Booked',
                  style: AppTextStyles.headlineSm.copyWith(
                    fontWeight: FontWeight.bold,
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              'You already have an appointment with this doctor on this date.',
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.secondary,
              ),
            ),
          ],
        ),
      );
    }

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.confirmation_number,
                color: AppColors.primary,
                size: spacing.AppSpacing.iconMd,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Text(
                'Date Information',
                style: AppTextStyles.headlineSm.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (capacity != null)
            Container(
              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    AppColors.surfaceContainer,
                    AppColors.surfaceContainer.withValues(alpha: 0.6),
                  ],
                ),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                border: Border.all(color: AppColors.surfaceContainerHighest),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Slots',
                          style: AppTextStyles.labelSm.copyWith(
                            fontSize: 9,
                            color: AppColors.primaryFixed,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '${capacity['remaining'] ?? 0}',
                          style: AppTextStyles.queueNum.copyWith(
                            fontSize: 22,
                            color: AppColors.onPrimary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterMd),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          DateFormat('EEEE, MMM d, yyyy').format(_selectedDate!),
                          style: AppTextStyles.bodyMdMedium.copyWith(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterXs),
                        Row(
                          children: [
                            Icon(
                              Icons.schedule,
                              color: AppColors.primary,
                              size: spacing.AppSpacing.iconSm,
                            ),
                            const SizedBox(width: spacing.AppSpacing.gutterXs),
                            Text(
                              _getWorkingHoursText(_selectedDate!),
                              style: AppTextStyles.labelSm.copyWith(
                                fontSize: 12,
                                color: AppColors.secondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Divider(color: AppColors.slate200),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          _buildInfoRow(
            Icons.payments,
            'Consultation Fee',
            '₱${widget.consultationFee ?? '1,000'} (Pay at clinic cashier)',
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          _buildInfoRow(
            Icons.access_time,
            'Est. Wait Time',
            '~45 minutes',
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(
              icon,
              color: AppColors.secondary,
              size: spacing.AppSpacing.iconMd,
            ),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            Text(
              label,
              style: AppTextStyles.labelSm.copyWith(
                fontSize: 12,
                color: AppColors.secondary,
              ),
            ),
          ],
        ),
        Text(
          value,
          style: AppTextStyles.labelSm.copyWith(
            fontSize: 12,
            fontWeight: FontWeight.bold,
            color: AppColors.onSurface,
          ),
        ),
      ],
    );
  }

  Widget _buildQueueSummary() {
    if (_selectedDate == null) return const SizedBox();

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Selected Date',
            style: AppTextStyles.labelSm.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Text(
            DateFormat('EEEE, MMM d, yyyy').format(_selectedDate!),
            style: AppTextStyles.bodyMdMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
          Text(
            _getWorkingHoursText(_selectedDate!),
            style: AppTextStyles.labelSm.copyWith(
              color: AppColors.secondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentMethodSelection() {
    if (_selectedDate == null) return const SizedBox();

    final hasGcashQr = _qrUrl != null;

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Method',
            style: AppTextStyles.labelSm.copyWith(
              fontWeight: FontWeight.bold,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          if (hasGcashQr) ...[
            _buildPaymentOption('GCash', 'Pay online with GCash'),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
          ],
          _buildPaymentOption('Cash at Clinic', 'Pay when you arrive'),
          if (_selectedPaymentMethod == 'GCASH') ...[
            const SizedBox(height: spacing.AppSpacing.gutterLg),
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
                  child: _isLoadingQr
                      ? const Center(
                          child: CircularProgressIndicator(),
                        )
                      : _qrUrl != null
                          ? Image.network(
                              _qrUrl!,
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
                            )
                          : Center(
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
                            ),
                ),
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Center(
              child: Text(
                'Scan the QR code with GCash to pay',
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.secondary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            Row(
              children: [
                Expanded(
                  child: PrimaryButton(
                    text: _isDownloading ? 'Downloading...' : 'Download QR',
                    onPressed: _isDownloading ? null : _downloadQrCode,
                    icon: const Icon(Icons.download, size: 20),
                    maxLines: 2,
                    height: 56,
                  ),
                ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Center(
              child: Text(
                'You can upload your GCash receipt after booking',
                style: AppTextStyles.bodySm.copyWith(
                  color: AppColors.secondary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPaymentOption(String title, String subtitle) {
    final isSelected = _selectedPaymentMethod == (title == 'GCash' ? 'GCASH' : 'CASH');
    final isGcash = title == 'GCash';

    return InkWell(
      onTap: () {
        setState(() {
          _selectedPaymentMethod = title == 'GCash' ? 'GCASH' : 'CASH';
        });
      },
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
                    ? (isGcash ? AppColors.surfaceLowest : AppColors.primary)
                    : AppColors.surfaceContainer,
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: isGcash
                  ? Image.asset(
                      'assets/images/gcash_logo.png',
                      width: 24,
                      height: 24,
                    )
                  : Icon(
                      Icons.local_atm,
                      color: isSelected ? AppColors.onPrimary : AppColors.secondary,
                      size: spacing.AppSpacing.iconMd,
                    ),
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

  Widget _buildCalendarLegend() {
    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterSm),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
      ),
      child: Wrap(
        spacing: spacing.AppSpacing.gutterMd,
        runSpacing: spacing.AppSpacing.gutterSm,
        children: [
          _buildLegendItem(AppColors.primary, 'Available'),
          _buildLegendItem(AppColors.slate400, 'Past'),
          _buildLegendItem(AppColors.error.withValues(alpha: 0.3), 'Unavailable'),
          _buildLegendItem(AppColors.surfaceContainerHighest, 'Full'),
          _buildLegendItem(AppColors.secondary, 'Already Booked'),
          _buildLegendItem(AppColors.slate400, 'Non-working'),
        ],
      ),
    );
  }

  Widget _buildLegendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: AppTextStyles.labelSm.copyWith(
            fontSize: 10,
            color: AppColors.secondary,
          ),
        ),
      ],
    );
  }

  Future<void> _handleBookingConfirmation() async {
    if (_selectedDate == null) return;

    if (mounted) {
      setState(() {
        _isCheckingRecord = true;
      });
    }

    try {
      // Check if patient has an existing record with this doctor
      final response = await _apiService.checkPatientRecord(
        doctorId: widget.doctorId,
      );

      if (mounted) {
        setState(() {
          _isCheckingRecord = false;
        });
      }

      if (response['success'] == true) {
        final hasRecord = response['data']?['hasRecord'] as bool? ?? false;

        if (hasRecord) {
          // Patient has complete record - proceed directly to booking
          if (mounted) {
            Navigator.of(context).pushNamed(
              '/booking-confirmation',
              arguments: {
                'doctorId': widget.doctorId,
                'doctorName': widget.doctorName,
                'specialty': widget.specialty,
                'clinic': widget.clinic,
                'consultationFee': widget.consultationFee,
                'selectedDate': _selectedDate,
                'paymentMethod': _selectedPaymentMethod,
                'professionalPhotoUrl': widget.professionalPhotoUrl,
              },
            );
          }
        } else {
          // Patient needs to submit details first
          if (mounted) {
            Navigator.of(context).pushNamed(
              '/patient-details',
              arguments: {
                'doctorId': widget.doctorId,
                'doctorName': widget.doctorName,
                'specialty': widget.specialty,
                'clinic': widget.clinic,
                'consultationFee': widget.consultationFee,
                'selectedDate': _selectedDate,
                'paymentMethod': _selectedPaymentMethod,
                'professionalPhotoUrl': widget.professionalPhotoUrl,
              },
            );
          }
        }
      } else {
        // API error - show error message
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                response['error']?['message'] ?? 'Failed to check patient record',
              ),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isCheckingRecord = false;
        });
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to check patient record: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  Widget _buildBottomConfirmationBar() {
    final availability = _selectedDate != null ? _getDateAvailability(_selectedDate!) : null;
    final status = availability?['status'] as String?;
    final isAlreadyBooked = status == 'ALREADY_BOOKED';

    return Container(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest.withValues(alpha: 0.95),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(spacing.AppSpacing.radiusLg),
          topRight: Radius.circular(spacing.AppSpacing.radiusLg),
        ),
        border: Border(
          top: BorderSide(color: AppColors.slate200.withValues(alpha: 0.8)),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Total',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                    Text(
                      '₱${widget.consultationFee ?? '1,000'}',
                      style: AppTextStyles.headlineMd.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Pay at clinic',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.slate600,
                      ),
                    ),
                    if (_selectedDate != null)
                      Text(
                        DateFormat('EEE, MMM d, yyyy').format(_selectedDate!),
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.tertiary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            PrimaryButton(
              text: _isCheckingRecord
                  ? 'Checking...'
                  : (isAlreadyBooked ? 'Already Booked' : 'Continue Booking'),
              onPressed: _selectedDate != null && !isAlreadyBooked && !_isCheckingRecord
                  ? _handleBookingConfirmation
                  : null,
              icon: const Icon(Icons.arrow_forward, size: 20),
            ),
          ],
        ),
      ),
    );
  }
}
