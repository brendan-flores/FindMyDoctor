import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/models/doctor_profile.dart';
import '../../../core/services/doctor_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/widgets/primary_button.dart';

/// Patient-only public doctor profile.
///
/// The screen only renders the whitelisted fields returned by
/// `GET /api/v1/patient/doctors/:id/profile`. Private contact details, license
/// numbers, and account status are never part of the model or the UI.
class DoctorProfilePage extends StatefulWidget {
  final String doctorId;

  /// Test seams. Production callers use the real service and platform URL
  /// launcher; tests inject deterministic fakes without performing network or
  /// OS calls.
  final Future<DoctorProfile?> Function(String doctorId)? loadProfile;
  final Future<bool> Function(Uri uri)? openUrl;

  const DoctorProfilePage({
    super.key,
    required this.doctorId,
    this.loadProfile,
    this.openUrl,
  });

  @override
  State<DoctorProfilePage> createState() => _DoctorProfilePageState();
}

class _DoctorProfilePageState extends State<DoctorProfilePage> {
  final DoctorService _doctorService = DoctorService();

  DoctorProfile? _profile;
  bool _isLoading = true;
  bool _notFound = false;
  String? _errorMessage;
  bool _showFullBiography = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _notFound = false;
    });

    if (widget.doctorId.trim().isEmpty) {
      setState(() {
        _isLoading = false;
        _notFound = true;
      });
      return;
    }

    try {
      final loader =
          widget.loadProfile ?? _doctorService.getPatientDoctorProfile;
      final profile = await loader(widget.doctorId);

      if (!mounted) return;
      setState(() {
        _profile = profile;
        _notFound = profile == null;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = "Unable to load this doctor's profile. Please check your connection and try again.";
        _isLoading = false;
      });
    }
  }

  void _openBooking() {
    final profile = _profile;
    if (profile == null) return;

    Navigator.of(context).pushNamed(
      '/doctor-schedule',
      arguments: {
        'doctorId': profile.id,
        'doctorName': profile.displayName,
        'specialty': profile.specialty,
        'clinic': profile.practiceName,
        'consultationFee': profile.consultationFee?.toStringAsFixed(0) ?? '',
        'professionalPhotoUrl': profile.photoUrl,
      },
    );
  }

  Future<void> _openDirections(DoctorProfile profile) async {
    final address = profile.practiceAddress;
    if (address == null || address.isEmpty) return;

    final query = [
      if (profile.practiceName != null) profile.practiceName!,
      address,
    ].join(', ');

    final uri = Uri.https('www.google.com', '/maps/search/', {
      'api': '1',
      'query': query,
    });

    final launcher =
        widget.openUrl ??
        (Uri target) => launchUrl(target, mode: LaunchMode.externalApplication);

    try {
      final opened = await launcher(uri);
      if (!opened && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to open maps on this device.')),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open maps on this device.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = _profile;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          AppHeader(
            title: 'Doctor Profile',
            showLogo: false,
            showBackButton: true,
            showNotifications: false,
            showProfile: false,
          ),
          Expanded(
            child: _isLoading
                ? _buildLoadingState()
                : _errorMessage != null
                ? _buildErrorState()
                : _notFound || profile == null
                ? _buildNotFoundState()
                : _buildProfile(profile),
          ),
        ],
      ),
      bottomNavigationBar:
          (!_isLoading &&
              _errorMessage == null &&
              !_notFound &&
              profile != null)
          ? _buildStickyBookBar()
          : null,
    );
  }

  Widget _buildLoadingState() {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: spacing.AppSpacing.gutterMd),
          Text('Loading profile...'),
        ],
      ),
    );
  }

  Widget _buildErrorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(spacing.AppSpacing.gutter2xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_outlined,
              size: 48,
              color: AppColors.outline,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            OutlinedButton(onPressed: _loadProfile, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _buildNotFoundState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(spacing.AppSpacing.gutter2xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.person_off_outlined,
              size: 48,
              color: AppColors.outline,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              'Doctor not found',
              style: AppTextStyles.headlineSm.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              'This doctor is no longer available in FindMyDoctor.',
              textAlign: TextAlign.center,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfile(DoctorProfile profile) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        spacing.AppSpacing.screenPadding,
        spacing.AppSpacing.gutterLg,
        spacing.AppSpacing.screenPadding,
        spacing.AppSpacing.gutter2xl,
      ),
      children: [
        _buildIdentity(profile),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildAvailabilityBanner(profile.availability),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildQuickFacts(profile),
        if (profile.biography != null) ...[
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          _buildAbout(profile.biography!),
        ],
        if (profile.languagesSpoken.isNotEmpty) ...[
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          _buildLanguages(profile.languagesSpoken),
        ],
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        _buildSchedule(profile.availability),
        if (_hasClinicDetails(profile)) ...[
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          _buildClinic(profile),
        ],
      ],
    );
  }

  Widget _buildIdentity(DoctorProfile profile) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DoctorProfileImage(photoUrl: profile.photoUrl, size: 88),
        const SizedBox(width: spacing.AppSpacing.gutterLg),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  profile.displayName,
                  style: AppTextStyles.headlineSm.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  semanticsLabel: profile.displayName,
                ),
              ),
              if (profile.specialty != null) ...[
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  profile.specialty!,
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    color: AppColors.primary,
                  ),
                ),
              ],
              if (profile.credentials != null) ...[
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  profile.credentials!,
                  style: AppTextStyles.bodySm.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAvailabilityBanner(DoctorAvailability availability) {
    final available = availability.availableToday;
    final nextDate = availability.nextAvailableDate;
    final slotsLeft = availability.slotsLeftToday;

    // Determine container style based on state
    Color backgroundColor;
    Color textColor;
    IconData icon;
    
    if (available) {
      // Available today - light green (same as Next available chip)
      backgroundColor = AppColors.tertiary.withOpacity(0.1);
      textColor = AppColors.tertiary;
      icon = Icons.check_circle_rounded;
    } else {
      // Not available today (regardless of fully booked or not) - neutral gray
      backgroundColor = AppColors.surfaceContainer;
      textColor = AppColors.onSurface;
      icon = Icons.info_outline_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterMd,
        vertical: 8,
      ),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 20,
            color: textColor,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Text(
              available
                  ? 'Available today · ${_slotsLabel(slotsLeft)}'
                  : (nextDate != null
                      ? 'Not available today · Next available: ${_formatDate(nextDate)}'
                      : 'Not available today · No upcoming availability yet'),
              style: AppTextStyles.labelMd.copyWith(
                color: textColor,
                fontWeight: FontWeight.w600,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _slotsLabel(int slots) {
    if (slots <= 0) return 'Fully booked today';
    return slots == 1 ? '1 slot left today' : '$slots slots left today';
  }

  Widget _buildQuickFacts(DoctorProfile profile) {
    return AppCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: _quickFact(
              icon: Icons.payments_outlined,
              label: 'Consultation fee',
              value: _formatFee(profile.consultationFee),
            ),
          ),
          _factDivider(),
          Expanded(
            child: _quickFact(
              icon: Icons.workspace_premium_outlined,
              label: 'Experience',
              value: _experienceLabel(profile.yearsOfExperience),
            ),
          ),
        ],
      ),
    );
  }

  Widget _quickFact({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Icon(icon, size: spacing.AppSpacing.iconMd, color: AppColors.primary),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Text(
          value,
          textAlign: TextAlign.center,
          style: AppTextStyles.bodyMdMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppTextStyles.labelSm.copyWith(
            color: AppColors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  Widget _factDivider() {
    return Container(width: 1, height: 52, color: AppColors.slate200);
  }

  Widget _buildAbout(String biography) {
    final canCollapse = biography.length > 160;

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'About',
            style: AppTextStyles.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Text(
            biography,
            maxLines: canCollapse && !_showFullBiography ? 4 : null,
            overflow: canCollapse && !_showFullBiography
                ? TextOverflow.ellipsis
                : TextOverflow.visible,
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.onSurfaceVariant,
              height: 1.5,
            ),
          ),
          if (canCollapse)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () {
                  setState(() {
                    _showFullBiography = !_showFullBiography;
                  });
                },
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(0, 36),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  _showFullBiography ? 'Show less' : 'Read more',
                  style: AppTextStyles.labelMd.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildLanguages(List<String> languages) {
    return _titledCard(
      title: 'Languages spoken',
      child: Text(
        languages.join(', '),
        style: AppTextStyles.bodyMd.copyWith(color: AppColors.onSurfaceVariant),
      ),
    );
  }

  Widget _buildExpertise(List<String> areas) {
    return _titledCard(
      title: 'Areas of expertise',
      child: Wrap(
        spacing: spacing.AppSpacing.gutterSm,
        runSpacing: spacing.AppSpacing.gutterSm,
        children: areas
            .map(
              (area) => Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterMd,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusFull,
                  ),
                ),
                child: Text(
                  area,
                  style: AppTextStyles.labelMd.copyWith(
                    color: AppColors.onPrimaryContainer,
                  ),
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _buildSchedule(DoctorAvailability availability) {
    final grouped = <int, List<DoctorWorkingDay>>{};
    for (final day in availability.workingDays) {
      grouped.putIfAbsent(day.dayOfWeek, () => []).add(day);
    }

    final sortedDays = grouped.keys.toList()
      ..sort((a, b) => _dayOrder(a).compareTo(_dayOrder(b)));

    final now = DateTime.now();
    final todayDayOfWeek = now.weekday % 7; // 0 = Sunday, 1 = Monday, etc.

    return _titledCard(
      title: 'Schedule',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (availability.nextAvailableDate != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: spacing.AppSpacing.gutterMd,
                vertical: 6,
              ),
              decoration: BoxDecoration(
                color: AppColors.tertiary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: Text(
                'Next available: ${_formatDate(availability.nextAvailableDate!)}',
                style: AppTextStyles.labelSm.copyWith(
                  color: AppColors.tertiary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (sortedDays.isNotEmpty)
              const SizedBox(height: spacing.AppSpacing.gutterLg),
          ],
          if (sortedDays.isEmpty)
            Text(
              'Schedule not available yet',
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            )
          else
            ...sortedDays.asMap().entries.map((entry) {
              final index = entry.key;
              final dayOfWeek = entry.value;
              final ranges = grouped[dayOfWeek]!;
              final dayName = ranges.first.dayName.isNotEmpty
                  ? ranges.first.dayName
                  : '';
              final isToday = dayOfWeek == todayDayOfWeek;
              
              // Check if day off (no ranges or empty time strings)
              final isDayOff = ranges.isEmpty || 
                  (ranges.length == 1 && 
                   ranges.first.startTime.isEmpty && 
                   ranges.first.endTime.isEmpty);
              
              final hours = isDayOff
                  ? 'Day off'
                  : ranges
                      .map(
                        (range) =>
                            '${_formatTime12h(range.startTime)} – ${_formatTime12h(range.endTime)}',
                      )
                      .join(', ');
              
              return _buildScheduleTile(
                dayName: dayName,
                hours: hours,
                isToday: isToday,
                isDayOff: isDayOff,
                index: index,
              );
            }),
        ],
      ),
    );
  }

  Widget _buildScheduleTile({
    required String dayName,
    required String hours,
    required bool isToday,
    required bool isDayOff,
    required int index,
  }) {
    final mediaQuery = MediaQuery.of(context);
    final reduceMotion = mediaQuery.disableAnimations || mediaQuery.boldText;
    
    return Padding(
      padding: const EdgeInsets.only(
        bottom: spacing.AppSpacing.gutterSm,
      ),
      child: AnimatedSlide(
        offset: reduceMotion ? Offset.zero : const Offset(0, 0.05),
        duration: reduceMotion ? Duration.zero : const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        onEnd: () {},
        child: FadeTransition(
          opacity: AlwaysStoppedAnimation(reduceMotion ? 1.0 : 1.0),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.gutterLg,
              vertical: 12,
            ),
            decoration: BoxDecoration(
              color: isToday
                  ? AppColors.primaryFixedDim.withOpacity(0.15)
                  : AppColors.surfaceLowest,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: isToday
                    ? AppColors.primary
                    : (isDayOff ? AppColors.outlineVariant : AppColors.outlineVariant),
                width: isToday ? 1.5 : 1,
              ),
              boxShadow: isToday
                  ? [
                      BoxShadow(
                        color: AppColors.primary.withOpacity(0.1),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              children: [
                Icon(
                  Icons.access_time_rounded,
                  size: 18,
                  color: isToday
                      ? AppColors.primary
                      : (isDayOff ? AppColors.onSurfaceVariant : AppColors.outline),
                ),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                Expanded(
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: dayName,
                          style: AppTextStyles.labelMd.copyWith(
                            fontWeight: isToday ? FontWeight.w600 : FontWeight.w500,
                            color: AppColors.onSurface,
                          ),
                        ),
                        const TextSpan(
                          text: '  •  ',
                          style: TextStyle(
                            color: AppColors.outline,
                            fontSize: 14,
                          ),
                        ),
                        TextSpan(
                          text: hours,
                          style: AppTextStyles.bodySm.copyWith(
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                    maxLines: null,
                    overflow: TextOverflow.visible,
                    semanticsLabel: isToday
                        ? '$dayName, today, ${isDayOff ? 'day off' : hours}'
                        : '$dayName, ${isDayOff ? 'day off' : hours}',
                  ),
                ),
                if (isToday)
                  Container(
                    margin: const EdgeInsets.only(left: spacing.AppSpacing.gutterSm),
                    padding: const EdgeInsets.symmetric(
                      horizontal: spacing.AppSpacing.gutterSm,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                    ),
                    child: Text(
                      'Today',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.onPrimary,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildClinic(DoctorProfile profile) {
    final hasAddress =
        profile.practiceAddress != null && profile.practiceAddress!.isNotEmpty;

    return _titledCard(
      title: 'Clinic',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (profile.practiceName != null)
            Text(
              profile.practiceName!,
              style: AppTextStyles.bodyMdMedium.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          if (profile.practiceAddress != null) ...[
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              profile.practiceAddress!,
              style: AppTextStyles.bodySm.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
          if (profile.roomNumber != null) ...[
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              'Room ${profile.roomNumber}',
              style: AppTextStyles.bodySm.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
          if (hasAddress) ...[
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            TextButton.icon(
              onPressed: () => _openDirections(profile),
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 36),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              icon: const Icon(Icons.directions_outlined, size: 18),
              label: const Text('Get directions'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _titledCard({required String title, required Widget child}) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTextStyles.cardTitle.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          child,
        ],
      ),
    );
  }

  Widget _buildStickyBookBar() {
    return SafeArea(
      top: false,
      child: Container(
        padding: const EdgeInsets.fromLTRB(
          spacing.AppSpacing.screenPadding,
          spacing.AppSpacing.gutterMd,
          spacing.AppSpacing.screenPadding,
          spacing.AppSpacing.gutterMd,
        ),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.slate200)),
        ),
        child: PrimaryButton(text: 'Book appointment', onPressed: _openBooking),
      ),
    );
  }

  bool _hasClinicDetails(DoctorProfile profile) {
    return profile.practiceName != null ||
        profile.practiceAddress != null ||
        profile.roomNumber != null;
  }

  bool _expertiseAddsValue(DoctorProfile profile) {
    if (profile.areasOfExpertise.isEmpty) return false;
    final specialty = profile.specialty?.toLowerCase().trim() ?? '';
    if (specialty.isEmpty) return true;

    // Only show the section when at least one listed area is not already
    // conveyed by the specialty line.
    return profile.areasOfExpertise.any((area) {
      final normalized = area.toLowerCase().trim();
      return normalized.isNotEmpty && !specialty.contains(normalized);
    });
  }

  String _formatFee(double? fee) {
    if (fee == null || fee <= 0) return '—';
    final digits = fee.round().toString();
    final buffer = StringBuffer('\u20B1');
    for (var i = 0; i < digits.length; i++) {
      if (i > 0 && (digits.length - i) % 3 == 0) {
        buffer.write(',');
      }
      buffer.write(digits[i]);
    }
    return buffer.toString();
  }

  String _experienceLabel(int? years) {
    if (years == null || years <= 0) return '—';
    return years == 1 ? '1 year' : '$years years';
  }

  String _formatDate(String value) {
    final parsed = DateTime.tryParse(value);
    if (parsed == null) return value;

    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final date = DateTime(parsed.year, parsed.month, parsed.day);
    final difference = date.difference(today).inDays;

    if (difference == 0) return 'Today';
    if (difference == 1) return 'Tomorrow';
    return DateFormat('MMM d, yyyy').format(date);
  }

  String _formatTime12h(String value) {
    final parts = value.split(':');
    if (parts.length < 2) return value;
    final hour = int.tryParse(parts[0]);
    final minute = int.tryParse(parts[1]);
    if (hour == null || minute == null) return value;

    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour % 12 == 0 ? 12 : hour % 12;
    return '$displayHour:${minute.toString().padLeft(2, '0')} $period';
  }

  int _dayOrder(int dayOfWeek) => (dayOfWeek + 6) % 7;
}
