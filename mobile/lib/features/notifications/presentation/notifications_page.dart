import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/services/api_service.dart';
import '../../payments/presentation/payment_screen.dart';
import '../../payments/presentation/invoice_bottom_sheet.dart';

class NotificationsPage extends StatefulWidget {
  final ApiService? apiService;

  const NotificationsPage({super.key, this.apiService});

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  late final ApiService _apiService;
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final response = await _apiService.getNotifications();
      if (!mounted) return;
      final items = <Map<String, dynamic>>[];
      if (response['success'] == true && response['data'] is List) {
        for (final item in response['data'] as List) {
          if (item is Map) {
            items.add(Map<String, dynamic>.from(item));
          }
        }
      }
      setState(() {
        _notifications = items;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _notifications = [];
        _isLoading = false;
      });
    }
  }

  Future<void> _markAsRead(String notificationId) async {
    try {
      await _apiService.markNotificationRead(notificationId);
      if (!mounted) return;
      setState(() {
        _notifications = _notifications.map((n) {
          if (n['id'] == notificationId) {
            final updated = Map<String, dynamic>.from(n);
            updated['is_read'] = true;
            return updated;
          }
          return n;
        }).toList();
      });
    } catch (_) {
      // Silently fail - user can try again
    }
  }

  /// Normalizes a backend waitlist date into the `yyyy-MM-dd` format expected
  /// by the doctor schedule route. The waitlist endpoint returns a date-only
  /// value, so the calendar date is kept as-is without timezone conversion.
  String _normalizeWaitlistDate(dynamic value) {
    final raw = value?.toString().trim() ?? '';
    if (raw.isEmpty) return '';

    final match = RegExp(r'^\d{4}-\d{2}-\d{2}').firstMatch(raw);
    if (match != null) {
      return match.group(0)!;
    }

    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return '';

    final year = parsed.year.toString().padLeft(4, '0');
    final month = parsed.month.toString().padLeft(2, '0');
    final day = parsed.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  /// Formats the doctor's consultation fee for the schedule screen.
  String? _formatConsultationFee(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toStringAsFixed(0);

    final parsed = double.tryParse(value.toString());
    return parsed != null ? parsed.toStringAsFixed(0) : value.toString();
  }

  /// Opens the availability notification directly on the doctor's schedule so
  /// the patient can book the slot that just became available.
  Future<void> _openWaitlistSlot(Map<String, dynamic> notification) async {
    final waitlistId = notification['related_entity_id']?.toString();
    if (waitlistId == null || waitlistId.isEmpty) {
      Navigator.pushNamed(context, '/waitlist');
      return;
    }

    try {
      final waitlistResponse = await _apiService.getWaitlistEntry(waitlistId);
      final waitlistData = waitlistResponse['success'] == true
          ? waitlistResponse['data']
          : null;

      if (waitlistData is! Map) {
        _openWaitlistFallback();
        return;
      }

      final waitlist = Map<String, dynamic>.from(waitlistData);
      final doctorId = waitlist['doctor_id']?.toString() ?? '';
      final waitlistDate = _normalizeWaitlistDate(waitlist['waitlist_date']);

      if (doctorId.isEmpty || waitlistDate.isEmpty) {
        _openWaitlistFallback();
        return;
      }

      Map<String, dynamic>? doctor;
      try {
        final doctorResponse = await _apiService.getDoctor(doctorId);
        if (doctorResponse['success'] == true &&
            doctorResponse['data'] is Map) {
          doctor = Map<String, dynamic>.from(doctorResponse['data'] as Map);
        }
      } catch (_) {
        // Fall back to the doctor details embedded in the waitlist entry.
      }

      if (!mounted) return;

      final firstName = doctor?['first_name']?.toString() ??
          waitlist['doctor_first_name']?.toString() ??
          '';
      final lastName = doctor?['last_name']?.toString() ??
          waitlist['doctor_last_name']?.toString() ??
          '';
      final doctorName = '$firstName $lastName'.trim();

      Navigator.pushNamed(
        context,
        '/doctor-schedule',
        arguments: {
          'doctorId': doctorId,
          'doctorName': doctorName.isEmpty ? null : doctorName,
          'specialty': doctor?['specialty']?.toString() ??
              waitlist['specialty']?.toString(),
          'clinic': doctor?['practice_name']?.toString() ??
              waitlist['practice_name']?.toString(),
          'consultationFee':
              _formatConsultationFee(doctor?['consultation_fee']),
          'professionalPhotoUrl':
              doctor?['professional_photo_url']?.toString(),
          'defaultDate': waitlistDate,
        },
      );
    } catch (_) {
      _openWaitlistFallback();
    }
  }

  void _openWaitlistFallback() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Unable to open the available slot. Showing your waitlist.',
        ),
      ),
    );
    Navigator.pushNamed(context, '/waitlist');
  }

  Future<void> _markAllAsRead() async {
    try {
      await _apiService.markAllNotificationsRead();
      if (!mounted) return;
      setState(() {
        _notifications = _notifications.map((n) {
          final updated = Map<String, dynamic>.from(n);
          updated['is_read'] = true;
          return updated;
        }).toList();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All notifications marked as read')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to mark all as read')),
      );
    }
  }

  String _formatTimestamp(String? timestamp) {
    if (timestamp == null) return '';
    final dateTime = DateTime.parse(timestamp);
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inMinutes < 1) {
      return 'Just now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${dateTime.day}/${dateTime.month}/${dateTime.year}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Notifications'),
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        elevation: 0,
        actions: [
          if (!_isLoading && _notifications.any((n) => n['is_read'] == false))
            TextButton.icon(
              onPressed: _markAllAsRead,
              icon: const Icon(Icons.mark_email_read),
              label: const Text('Read all'),
            ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_notifications.isEmpty)
                SizedBox(
                  height: MediaQuery.of(context).size.height - 200,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.notifications_outlined,
                          size: 64,
                          color: AppColors.secondary,
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterMd),
                        Text(
                          'No notifications',
                          style: AppTextStyles.bodyMd.copyWith(
                            color: AppColors.secondary,
                          ),
                        ),
                        const SizedBox(height: spacing.AppSpacing.gutterSm),
                        Text(
                          'You\'re all caught up!',
                          style: AppTextStyles.labelSm.copyWith(
                            color: AppColors.outline,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _loadNotifications,
                    child: ListView.builder(
                      itemCount: _notifications.length,
                      itemBuilder: (context, index) {
                        final notification = _notifications[index];
                        final isRead = notification['is_read'] == true;
                        final message = notification['message'] ?? '';
                        final type = notification['type']?.toString();
                        final isPaymentNotification = type == 'ADDITIONAL_CHARGE_ADDED' || type == 'PAYMENT_VERIFIED' || type == 'PAYMENT_REJECTED';
                        final isWaitlistNotification = type == 'WAITLIST_UPDATE';
                        final isAppointmentNotification = type == 'APPOINTMENT_CANCELLED' ||
                            type == 'APPOINTMENT_RESCHEDULED' ||
                            type == 'SCHEDULE_CHANGE_NOTICE';
                        final isPrescriptionNotification = type == 'PRESCRIPTION_AVAILABLE';
                        final isInvoiceNotification = type == 'INVOICE_AVAILABLE';

                        return Card(
                          margin: EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
                          color: isRead ? AppColors.surface : AppColors.surfaceLow,
                          child: InkWell(
                            onTap: () async {
                              if (!isRead) {
                                await _markAsRead(notification['id']);
                              }

                              // Handle waitlist notifications - open the newly
                              // available slot on the doctor's schedule.
                              if (isWaitlistNotification) {
                                await _openWaitlistSlot(notification);
                                return;
                              }

                              // Cancellation / reschedule notifications deep-link
                              // to the related appointment.
                              if (isAppointmentNotification) {
                                final appointmentId = notification['related_entity_id']?.toString();
                                if (appointmentId != null && appointmentId.isNotEmpty) {
                                  Navigator.pushNamed(
                                    context,
                                    '/appointment-detail',
                                    arguments: {'appointmentId': appointmentId},
                                  );
                                }
                                return;
                              }

                              // Handle prescription notifications - deep-link to prescription detail
                              if (isPrescriptionNotification) {
                                final prescriptionId = notification['related_entity_id']?.toString();
                                if (prescriptionId != null && prescriptionId.isNotEmpty) {
                                  Navigator.pushNamed(
                                    context,
                                    '/prescription-detail',
                                    arguments: {'prescriptionId': prescriptionId},
                                  );
                                }
                                return;
                              }

                              // Handle invoice notifications - open the invoice
                              // preview directly, falling back to the payments hub.
                              if (isInvoiceNotification) {
                                final invoiceId = notification['related_entity_id']?.toString();
                                if (invoiceId != null && invoiceId.isNotEmpty) {
                                  showModalBottomSheet(
                                    context: context,
                                    isScrollControlled: true,
                                    backgroundColor: Colors.transparent,
                                    builder: (context) => InvoiceBottomSheet(invoiceId: invoiceId),
                                  );
                                } else {
                                  Navigator.pushNamed(context, '/payments');
                                }
                                return;
                              }

                              // Handle payment-related notifications - navigate to payment details
                              if (isPaymentNotification) {
                                final paymentId = notification['related_entity_id']?.toString();
                                if (paymentId != null && paymentId.isNotEmpty) {
                                  try {
                                    final paymentResponse = await _apiService.getPaymentById(paymentId);
                                    if (paymentResponse['success'] == true && paymentResponse['data'] != null) {
                                      final paymentData = paymentResponse['data'];
                                      final appointmentId = paymentData['appointment_id']?.toString();
                                      if (appointmentId != null && mounted) {
                                        Navigator.of(context).push(
                                          MaterialPageRoute(
                                            builder: (context) => PaymentScreen(
                                              appointmentId: appointmentId,
                                            ),
                                          ),
                                        );
                                      }
                                    }
                                  } catch (e) {
                                    // Silently fail - notification remains marked as read
                                  }
                                }
                              }
                            },
                            child: Padding(
                              padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          notification['title'] ?? 'Notification',
                                          style: AppTextStyles.bodyMdMedium.copyWith(
                                            fontWeight: isRead ? FontWeight.w500 : FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                      if (!isRead)
                                        Container(
                                          width: 8,
                                          height: 8,
                                          decoration: BoxDecoration(
                                            color: AppColors.error,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                                  Text(
                                    message,
                                    style: AppTextStyles.labelSm.copyWith(
                                      color: AppColors.secondary,
                                    ),
                                    maxLines: isPaymentNotification ? 8 : 3,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  if (isPaymentNotification)
                                    Padding(
                                      padding: EdgeInsets.only(top: spacing.AppSpacing.gutterXs),
                                      child: Text(
                                        'Tap to view details',
                                        style: AppTextStyles.labelSm.copyWith(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  if (isWaitlistNotification)
                                    Padding(
                                      padding: EdgeInsets.only(top: spacing.AppSpacing.gutterXs),
                                      child: Row(
                                        children: [
                                          Text(
                                            'Tap to book your slot',
                                            style: AppTextStyles.labelSm.copyWith(
                                              color: AppColors.primary,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(width: spacing.AppSpacing.gutterSm),
                                          Expanded(
                                            child: OutlinedButton(
                                              onPressed: () async {
                                                if (!isRead) {
                                                  await _markAsRead(notification['id']);
                                                }
                                                await _openWaitlistSlot(notification);
                                              },
                                              style: OutlinedButton.styleFrom(
                                                foregroundColor: AppColors.primary,
                                                side: BorderSide(color: AppColors.primary),
                                                padding: EdgeInsets.symmetric(
                                                  horizontal: spacing.AppSpacing.gutterSm,
                                                  vertical: spacing.AppSpacing.gutterXs,
                                                ),
                                              ),
                                              child: const Text('Book Now'),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  if (isInvoiceNotification)
                                    Padding(
                                      padding: EdgeInsets.only(top: spacing.AppSpacing.gutterXs),
                                      child: Text(
                                        'Tap to view invoice',
                                        style: AppTextStyles.labelSm.copyWith(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  if (isAppointmentNotification)
                                    Padding(
                                      padding: EdgeInsets.only(top: spacing.AppSpacing.gutterXs),
                                      child: Text(
                                        'Tap to view appointment',
                                        style: AppTextStyles.labelSm.copyWith(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                                  Text(
                                    _formatTimestamp(notification['created_at']),
                                    style: AppTextStyles.labelSm.copyWith(
                                      color: AppColors.outline,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
