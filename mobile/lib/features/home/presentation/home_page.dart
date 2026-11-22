import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/widgets/skeleton.dart';

import '../../../core/services/api_service.dart';
import '../../../core/services/push_notification_service.dart';

import '../../../features/auth/presentation/change_password_page.dart';
import '../../appointments/presentation/appointments_page.dart';
import '../../doctors/presentation/doctors_page.dart';
import '../../conversations/models/conversation.dart';
import '../../../core/constants/ai_constants.dart';

class HomePage extends StatefulWidget {
  final int? initialTab;

  /// Test-only override for the push-notification service. When omitted the
  /// process-wide [PushNotificationService.instance] is used.
  final PushNotificationService? pushNotificationService;

  /// Optional injected API service used by widget tests. Production callers
  /// leave this null and fall back to the shared [ApiService] singleton.
  final ApiService? apiService;

  /// Test-only override for how long loaded conversations stay fresh.
  /// Production uses [_HomePageState._conversationFreshness].
  final Duration? conversationFreshness;

  const HomePage({
    super.key,
    this.initialTab,
    this.pushNotificationService,
    this.apiService,
    this.conversationFreshness,
  });

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _currentIndex = 0;
  String? _selectedSpecialtyFromHome;
  late final ApiService _apiService;
  List<Conversation> _conversations = [];
  bool _isLoadingConversations = true;
  bool _isFetchingConversations = false;
  bool _pendingForcedConversationRefresh = false;
  DateTime? _conversationsLoadedAt;
  int _totalUnreadCount = 0;
  int _notificationUnreadCount = 0;
  int _waitlistCount = 0;
  String? _userName;
  String? _userEmail;
  bool _accountInfoFailed = false;
  bool _isLoadingAccountInfo = true;
  String _chatSegment = 'clinic'; // M1: Segmented control state

  // Upcoming appointment state
  List<dynamic> _upcomingAppointments = [];
  Map<String, dynamic>? _nextAppointment;
  bool _isLoadingUpcomingAppointment = true;
  bool _upcomingAppointmentError = false;

  // Recent updates state
  List<dynamic> _recentUpdates = [];
  bool _isLoadingRecentUpdates = true;
  bool _recentUpdatesError = false;

  // Conversation data is reused within this window instead of refetched on
  // every Chat-tab visit. A thread return or pull-to-refresh bypasses it.
  static const Duration _conversationFreshness = Duration(seconds: 30);

  // Profile "About" and "Notifications" section state.
  String? _appVersion;
  bool _pushEnabled = true;
  bool _isPushBusy = false;
  bool _permissionDeniedHintVisible = false;
  late final PushNotificationService _pushService;

  @override
  void initState() {
    super.initState();
    _apiService = widget.apiService ?? ApiService();
    _pushService =
        widget.pushNotificationService ?? PushNotificationService.instance;
    if (widget.initialTab != null) {
      _currentIndex = widget.initialTab!;
    }
    _loadData();
    _loadUserInfo();
    _loadProfileExtras();
    // Load conversations in background to show unread badge
    _loadConversations();
    // Load notification unread count
    _loadNotificationUnreadCount();
    // Load waitlist count
    _loadWaitlistCount();
    // Load upcoming appointment
    _loadUpcomingAppointment();
    // Load recent updates
    _loadRecentUpdates();
  }

  Future<void> _loadUserInfo() async {
    try {
      final response = await _apiService.getCurrentPatient();
      if (response['success'] == true && response['data'] != null) {
        if (!mounted) return;
        setState(() {
          _userName =
              response['data']['first_name'] != null &&
                  response['data']['last_name'] != null
              ? '${response['data']['first_name']} ${response['data']['last_name']}'
              : response['data']['email'];
          _userEmail = response['data']['email'];
          _accountInfoFailed = false;
          _isLoadingAccountInfo = false;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _accountInfoFailed = true;
          _isLoadingAccountInfo = false;
        });
      }
    } catch (e) {
      // Surface a retry affordance in the profile; other tabs are unaffected.
      if (!mounted) return;
      setState(() {
        _accountInfoFailed = true;
        _isLoadingAccountInfo = false;
      });
    }
  }

  /// Loads the Profile-only extras: the app version (from pubspec.yaml via
  /// package_info_plus) and the stored push preference, which defaults to
  /// enabled to match the existing auto-registration behavior at startup.
  Future<void> _loadProfileExtras() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (!mounted) return;
      setState(() {
        _appVersion = info.version;
      });
    } catch (_) {
      // Version display is cosmetic; leave the placeholder on failure.
    }

    try {
      final preferred = await _pushService.isPushPreferred();
      if (!mounted) return;
      setState(() {
        _pushEnabled = preferred;
      });
    } catch (_) {
      // Keep the default (enabled), matching device startup behavior.
    }
  }

  Future<void> _loadData() async {
    try {
      print('📱 HomePage: Starting to load home data...');

      // Load upcoming appointments and recent updates in parallel
      await Future.wait([
        _loadUpcomingAppointment(),
        _loadRecentUpdates(),
      ]);

      print('📱 HomePage: Home data loaded');
    } catch (e) {
      print('🔴 HomePage: Error loading data: $e');
      if (!mounted) return;
      setState(() {
        _upcomingAppointmentError = true;
        _isLoadingUpcomingAppointment = false;
        _recentUpdatesError = true;
        _isLoadingRecentUpdates = false;
      });
    }
  }

  bool get _isConversationDataStale =>
      _conversationsLoadedAt == null ||
      DateTime.now().difference(_conversationsLoadedAt!) >=
          (widget.conversationFreshness ?? _conversationFreshness);

  Future<void> _loadConversations({bool force = false}) async {
    // Never stack a second conversation request on top of one in flight. A
    // forced refresh requested meanwhile is replayed once it settles.
    if (_isFetchingConversations) {
      if (force) {
        _pendingForcedConversationRefresh = true;
      }
      return;
    }
    // Reuse the in-memory list until it is stale, unless the caller explicitly
    // invalidated it (thread return or pull-to-refresh).
    if (!force && !_isConversationDataStale) return;

    _isFetchingConversations = true;
    try {
      final response = await _apiService.getConversations();
      if (response['success'] == true && response['data'] != null) {
        final List<dynamic> data = response['data'];
        final conversations = data
            .map((json) => Conversation.fromJson(json))
            .toList();
        final totalUnread = conversations.fold<int>(
          0,
          (sum, conv) => sum + conv.unreadCount,
        );
        if (!mounted) return;
        setState(() {
          _conversations = conversations;
          _totalUnreadCount = totalUnread;
          _isLoadingConversations = false;
          _conversationsLoadedAt = DateTime.now();
        });
      } else {
        if (!mounted) return;
        setState(() {
          _conversations = [];
          _totalUnreadCount = 0;
          _isLoadingConversations = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _conversations = [];
        _totalUnreadCount = 0;
        _isLoadingConversations = false;
      });
    } finally {
      _isFetchingConversations = false;
    }

    if (mounted && _pendingForcedConversationRefresh) {
      _pendingForcedConversationRefresh = false;
      await _loadConversations(force: true);
    }
  }

  Future<void> _loadNotificationUnreadCount() async {
    try {
      final response = await _apiService.getUnreadNotificationCount();
      if (response['success'] == true && response['data'] != null) {
        final count = response['data']['count'] as int? ?? 0;
        if (!mounted) return;
        setState(() {
          _notificationUnreadCount = count;
        });
      }
    } catch (e) {
      // Silently fail - notification count not critical
    }
  }

  Future<void> _loadWaitlistCount() async {
    try {
      final response = await _apiService.getWaitlistCount();
      if (response['success'] == true && response['data'] != null) {
        final count = response['data']['count'] as int? ?? 0;
        if (!mounted) return;
        setState(() {
          _waitlistCount = count;
        });
      }
    } catch (e) {
      // Silently fail - waitlist count not critical
    }
  }

  
  /// Loads upcoming appointments and selects the nearest eligible one.
  /// Only SCHEDULED, CONFIRMED, or IN_PROGRESS appointments with a future
  /// date are considered "upcoming."
  Future<void> _loadUpcomingAppointment() async {
    if (!mounted) return;
    setState(() {
      _isLoadingUpcomingAppointment = true;
      _upcomingAppointmentError = false;
    });

    try {
      final response = await _apiService.getAppointments(status: null);
      if (response['success'] == true && response['data'] != null) {
        final appointments = response['data'] as List;
        final now = DateTime.now();

        final upcoming = appointments.where((a) {
          final status = a['status'] as String?;
          if (status != 'SCHEDULED' && status != 'CONFIRMED' && status != 'IN_PROGRESS') {
            return false;
          }
          final dateStr = a['appointment_date']?.toString();
          if (dateStr == null) return false;
          final date = DateTime.tryParse(dateStr)?.toLocal();
          if (date == null) return false;
          return date.isAfter(now);
        }).toList();

        // Sort by appointment date (nearest first)
        upcoming.sort((a, b) {
          final dateA = DateTime.tryParse(a['appointment_date']?.toString() ?? '')?.toLocal() ?? DateTime.now();
          final dateB = DateTime.tryParse(b['appointment_date']?.toString() ?? '')?.toLocal() ?? DateTime.now();
          return dateA.compareTo(dateB);
        });

        if (!mounted) return;
        setState(() {
          _upcomingAppointments = upcoming;
          _nextAppointment = upcoming.isNotEmpty ? upcoming.first : null;
          _isLoadingUpcomingAppointment = false;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _upcomingAppointmentError = true;
          _isLoadingUpcomingAppointment = false;
        });
      }
    } catch (e) {
      print('🔴 HomePage: Error loading upcoming appointment: ');
      if (!mounted) return;
      setState(() {
        _upcomingAppointmentError = true;
        _isLoadingUpcomingAppointment = false;
      });
    }
  }

  /// Loads recent updates from notifications, filtered to appointment,
  /// prescription, and payment-related types.
  Future<void> _loadRecentUpdates() async {
    if (!mounted) return;
    setState(() {
      _isLoadingRecentUpdates = true;
      _recentUpdatesError = false;
    });

    try {
      final response = await _apiService.getNotifications();
      if (response['success'] == true && response['data'] != null) {
        final notifications = response['data'] as List;

        // Filter to supported update categories
        final updates = notifications.where((n) {
          final type = n['type'] as String?;
          return type == 'APPOINTMENT_CREATED' ||
              type == 'APPOINTMENT_UPDATED' ||
              type == 'APPOINTMENT_CANCELLED' ||
              type == 'APPOINTMENT_REMINDER' ||
              type == 'PRESCRIPTION_READY' ||
              type == 'PRESCRIPTION_UPDATED' ||
              type == 'PAYMENT_VERIFIED' ||
              type == 'PAYMENT_REJECTED' ||
              type == 'PAYMENT_PENDING';
        }).toList();

        // Sort by created_at descending (newest first)
        updates.sort((a, b) {
          final dateA = DateTime.tryParse(a['created_at']?.toString() ?? '') ?? DateTime.now();
          final dateB = DateTime.tryParse(b['created_at']?.toString() ?? '') ?? DateTime.now();
          return dateB.compareTo(dateA);
        });

        // Limit to 5 most recent updates
        final limitedUpdates = updates.take(5).toList();

        if (!mounted) return;
        setState(() {
          _recentUpdates = limitedUpdates;
          _isLoadingRecentUpdates = false;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _recentUpdatesError = true;
          _isLoadingRecentUpdates = false;
        });
      }
    } catch (e) {
      print('🔴 HomePage: Error loading recent updates: ');
      if (!mounted) return;
      setState(() {
        _recentUpdatesError = true;
        _isLoadingRecentUpdates = false;
      });
    }
  }

  Future<void> _logout() async {
    await _apiService.logout();
    Navigator.of(context).pushReplacementNamed('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(
        index: _currentIndex,
        children: [
          _buildHomeContent(),
          _buildDoctorsContent(),
          _buildAppointmentsContent(),
          _buildChatContent(),
          _buildProfileContent(),
        ],
      ),
      bottomNavigationBar: _buildBottomNavigation(),
      // M2: Floating "Ask MediGuide" shortcut in patient shell
      // HomePage is only shown to patients (secretaries get SecretaryHomePage)
      // Hide on Chat tab (index 3) and Profile/Settings tab (index 4)
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      floatingActionButton: _currentIndex == 3 || _currentIndex == 4
          ? null
          : FloatingActionButton(
              tooltip: AiConstants.shortcutLabel,
              onPressed: () {
                setState(() {
                  _currentIndex = 3; // Chat tab
                  _chatSegment = 'ai'; // Switch to AI segment
                });
              },
              backgroundColor: Colors.transparent,
              foregroundColor: AppColors.onPrimary,
              elevation: 0,
              shape: const CircleBorder(),
              child: SizedBox(
                width: 72,
                height: 72,
                child: Image.asset(
                  'assets/images/mediguide_badge.png',
                  fit: BoxFit.contain,
                ),
              ),
            ),
    );
  }

  Widget _buildHomeContent() {
    return Column(
      children: [
        AppHeader(
          showNotifications: true,
          showProfile: true,
          unreadCount: _notificationUnreadCount,
          onUnreadCountUpdate: () {
            _loadNotificationUnreadCount();
          },
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadData,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              child: Padding(
                padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    _buildQuickActions(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildUpcomingAppointment(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildRecentUpdates(),
                    const SizedBox(height: spacing.AppSpacing.gutter2xl),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDoctorsContent() {
    return DoctorsPage(
      specialty: _selectedSpecialtyFromHome,
      onClearSpecialtyFromHome: () {
        setState(() {
          _selectedSpecialtyFromHome = null;
        });
      },
      onNavigateToTab: (index) {
        setState(() {
          _currentIndex = index;
          // Clear specialty when navigating away from doctors tab
          if (index != 1) {
            _selectedSpecialtyFromHome = null;
          }
        });
      },
    );
  }

  Widget _buildAppointmentsContent() {
    return AppointmentsPage(
      onNavigateToWaitlist: () {
        Navigator.pushNamed(context, '/waitlist');
      },
      onWaitlistCountUpdate: () {
        _loadWaitlistCount();
      },
    );
  }

  Widget _buildChatContent() {
    return Column(
      children: [
        AppHeader(
          showNotifications: true,
          showProfile: true,
          unreadCount: _notificationUnreadCount,
          onUnreadCountUpdate: () {
            _loadNotificationUnreadCount();
          },
        ),
        // M1: Segmented control for Clinic | AI Assistant
        Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.screenPadding,
            vertical: spacing.AppSpacing.gutterMd,
          ),
          child: SegmentedButton<String>(
            segments: const [
              ButtonSegment(
                value: 'clinic',
                label: Text('Clinic'),
                icon: Icon(Icons.chat_bubble_outline),
              ),
              ButtonSegment(
                value: 'ai',
                label: Text(AiConstants.shortName),
                icon: Icon(Icons.smart_toy),
              ),
            ],
            selected: {_chatSegment},
            onSelectionChanged: (value) {
              setState(() {
                _chatSegment = value.first;
              });
            },
          ),
        ),
        Expanded(
          child: _chatSegment == 'clinic'
              ? SingleChildScrollView(
                  child: Padding(
                    padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: spacing.AppSpacing.gutterLg),
                        Text('Secretary Chat', style: AppTextStyles.headlineLg),
                        const SizedBox(height: spacing.AppSpacing.gutterLg),
                        ChatTabContent(
                          isLoading: _isLoadingConversations,
                          conversations: _conversations,
                          onRefresh: () {
                            if (mounted) {
                              _loadConversations(force: true);
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  child: Padding(
                    padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: spacing.AppSpacing.gutterLg),
                        Text('AI Assistant', style: AppTextStyles.headlineLg),
                        const SizedBox(height: spacing.AppSpacing.gutterLg),
                        _buildAiQuickActions(),
                        const SizedBox(height: spacing.AppSpacing.gutterLg),
                        _buildAiConversationsList(),
                      ],
                    ),
                  ),
                ),
        ),
      ],
    );
  }

  // M3: AI quick actions in Chat tab
  Widget _buildAiQuickActions() {
    return AppCard(
      onTap: () {
        Navigator.of(context).pushNamed('/ai-conversation');
      },
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: ClipOval(
              child: Image.asset(
                'assets/images/mediguide_badge.png',
                width: 48,
                height: 48,
                fit: BoxFit.cover,
              ),
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Start AI Conversation',
                  style: AppTextStyles.bodyMdMedium,
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  'Ask health questions',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: AppColors.outline),
        ],
      ),
    );
  }

  // M4: AI conversations list
  Widget _buildAiConversationsList() {
    return AppCard(
      onTap: () {
        Navigator.of(context).pushNamed('/ai-conversation-history');
      },
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Icon(Icons.history, color: AppColors.outline),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Text(
              'Conversation history',
              style: AppTextStyles.bodyMd,
            ),
          ),
          Icon(Icons.chevron_right, color: AppColors.outline),
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime dateTime) {
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

  Widget _buildProfileContent() {
    return Column(
      children: [
        AppHeader(
          showNotifications: true,
          showProfile: true,
          unreadCount: _notificationUnreadCount,
          onUnreadCountUpdate: () {
            _loadNotificationUnreadCount();
          },
        ),
        Expanded(
          child: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  Text('My Profile', style: AppTextStyles.headlineLg),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  _buildAccountSection(),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  _buildSecuritySection(),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  _buildNotificationsSection(),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  _buildAboutSection(),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  // Log out keeps its existing behavior exactly (no dialogs);
                  // API logout removes this device's push token.
                  PrimaryButton(
                    text: 'Log Out',
                    onPressed: _logout,
                    icon: const Icon(Icons.logout, size: 20),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutter3xl),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSectionLabel(String title) {
    return Text(
      title.toUpperCase(),
      style: AppTextStyles.labelSm.copyWith(
        color: AppColors.slate500,
        fontWeight: FontWeight.bold,
        letterSpacing: 0.8,
        fontSize: 12,
      ),
    );
  }

  Widget _buildSection({
    required String label,
    required List<Widget> children,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSectionLabel(label),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        AppCard(
          padding: EdgeInsets.zero,
          child: Column(
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0)
                  const Divider(
                    height: 1,
                    thickness: 1,
                    indent: spacing.AppSpacing.gutterLg,
                    color: AppColors.slate200,
                  ),
                children[i],
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAccountSection() {
    return _buildSection(
      label: 'Account',
      children: [
        _buildAccountSummaryRow(),
        _buildActionRow(
          key: const ValueKey('profile_view_details'),
          icon: Icons.person_outline,
          title: 'View patient profile',
          semanticLabel: 'View patient profile',
          onTap: () {
            Navigator.of(context).pushNamed('/patient-profile');
          },
        ),
        _buildActionRow(
          key: const ValueKey('profile_medical_records'),
          icon: Icons.folder_open,
          title: 'Medical Records',
          semanticLabel: 'Medical Records',
          onTap: () {
            Navigator.of(context).pushNamed('/medical-records');
          },
        ),
        _buildActionRow(
          key: const ValueKey('profile_payments'),
          icon: Icons.receipt_long,
          title: 'Payments & Invoices',
          semanticLabel: 'Payments & Invoices',
          onTap: () {
            Navigator.of(context).pushNamed('/payments');
          },
        ),
      ],
    );
  }

  Widget _buildAccountSummaryRow() {
    return Padding(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.surfaceContainer,
            child: Icon(
              Icons.person,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconLg,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: _accountInfoFailed
                ? _buildAccountErrorContent()
                : _isLoadingAccountInfo
                ? const SkeletonScope(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonLine(width: 160, height: 16),
                        SizedBox(height: spacing.AppSpacing.gutterXs),
                        SkeletonLine(width: 200, height: 12),
                      ],
                    ),
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _userName ?? 'Patient',
                        style: AppTextStyles.headlineSm.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (_userEmail != null) ...[
                        const SizedBox(height: spacing.AppSpacing.gutterXs),
                        Text(
                          _userEmail!,
                          style: AppTextStyles.bodySm.copyWith(
                            color: AppColors.secondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountErrorContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Couldn\'t load account info',
          style: AppTextStyles.bodyMdMedium.copyWith(
            color: AppColors.onSurface,
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Row(
          children: [
            Text(
              'Check your connection.',
              style: AppTextStyles.bodySm.copyWith(color: AppColors.error),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            Semantics(
              button: true,
              label: 'Retry loading account info',
              child: InkWell(
                onTap: _loadUserInfo,
                borderRadius: BorderRadius.circular(
                  spacing.AppSpacing.radiusSm,
                ),
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterSm,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  child: Text(
                    'Retry',
                    style: AppTextStyles.labelMd.copyWith(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSecuritySection() {
    return _buildSection(
      label: 'Security',
      children: [
        _buildActionRow(
          key: const ValueKey('profile_change_password'),
          icon: Icons.lock_outline,
          title: 'Change password',
          semanticLabel: 'Change password',
          onTap: () {
            // The change-password screen shows "Password changed
            // successfully" and revokes this user's other sessions and
            // refresh tokens server-side while keeping this session signed
            // in (it stores the fresh access token before navigating back).
            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ChangePasswordPage(
                  onSuccess: () => Navigator.of(context).pop(),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildNotificationsSection() {
    return _buildSection(
      label: 'Notifications',
      children: [
        _buildSwitchRow(
          icon: Icons.notifications_outlined,
          title: 'Push notifications',
          subtitle: 'Appointment and message alerts on this device',
          value: _pushEnabled,
          busy: _isPushBusy,
          onChanged: _togglePushNotifications,
        ),
        if (_permissionDeniedHintVisible) _buildPermissionHintRow(),
      ],
    );
  }

  Future<void> _togglePushNotifications(bool enabled) async {
    if (_isPushBusy) return;

    setState(() {
      _isPushBusy = true;
    });

    final pushService = _pushService;

    try {
      if (!enabled) {
        final removed = await pushService.disableForCurrentUser();
        await pushService.setPushPreferred(false);
        if (!mounted) return;
        setState(() {
          _pushEnabled = false;
          _isPushBusy = false;
          _permissionDeniedHintVisible = false;
        });
        _showProfileSnackBar(
          removed
              ? 'Push notifications turned off for this device.'
              : 'Push notifications are off, but removing this device\'s '
                    'registration from the server failed. It will stop working '
                    'after your next logout.',
        );
        return;
      }

      // Ask for the OS notification permission only when it is undecided.
      var status = await Permission.notification.status;
      if (status.isDenied || status.isRestricted) {
        status = await Permission.notification.request();
      }

      if (!status.isGranted && !status.isLimited) {
        if (!mounted) return;
        setState(() {
          _permissionDeniedHintVisible = true;
          _pushEnabled = false;
          _isPushBusy = false;
        });
        return;
      }

      await pushService.setPushPreferred(true);
      final registered = await pushService.registerForCurrentUser();
      if (!mounted) return;
      setState(() {
        _pushEnabled = true;
        _permissionDeniedHintVisible = false;
        _isPushBusy = false;
      });
      _showProfileSnackBar(
        registered
            ? 'Push notifications enabled for this device.'
            : 'Push notifications are on for this device, but it is not yet '
                  'registered for push. Registration will run when the app '
                  'starts with its native push configuration.',
      );
    } catch (_) {
      // Missing native plumbing (or another platform error) must never crash
      // the profile; surface it as an "off" state with the hint.
      if (!mounted) return;
      setState(() {
        _isPushBusy = false;
        _pushEnabled = false;
      });
      _showProfileSnackBar('Notifications are not available on this device.');
    }
  }

  void _showProfileSnackBar(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 4)),
    );
  }

  Widget _buildPermissionHintRow() {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterLg,
        vertical: spacing.AppSpacing.gutterSm,
      ),
      child: Row(
        children: [
          Icon(
            Icons.info_outline,
            color: AppColors.secondary,
            size: spacing.AppSpacing.iconMd,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Text(
              'Notification permission is turned off for FindMyDoctor. Enable it in system settings to get alerts.',
              style: AppTextStyles.bodySm.copyWith(color: AppColors.secondary),
            ),
          ),
          Semantics(
            button: true,
            label: 'Open system notification settings',
            child: InkWell(
              onTap: () async {
                await openAppSettings();
              },
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusSm),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                child: Text(
                  'Open Settings',
                  style: AppTextStyles.labelMd.copyWith(
                    color: AppColors.primary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAboutSection() {
    return _buildSection(
      label: 'About',
      children: [
        _buildValueRow(
          icon: Icons.info_outline,
          title: 'App version',
          value: _appVersion ?? '—',
        ),
        _buildActionRow(
          key: const ValueKey('profile_privacy_notice'),
          icon: Icons.privacy_tip_outlined,
          title: 'Privacy notice',
          semanticLabel: 'Privacy notice',
          onTap: () {
            Navigator.of(context).pushNamed('/privacy-notice');
          },
        ),
      ],
    );
  }

  Widget _buildActionRow({
    Key? key,
    required IconData icon,
    required String title,
    required String semanticLabel,
    required VoidCallback onTap,
  }) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: key,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: spacing.AppSpacing.touchTarget,
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: spacing.AppSpacing.gutterLg,
                vertical: spacing.AppSpacing.gutterSm,
              ),
              child: Row(
                children: [
                  Icon(
                    icon,
                    color: AppColors.primary,
                    size: spacing.AppSpacing.iconMd,
                  ),
                  const SizedBox(width: spacing.AppSpacing.gutterMd),
                  Expanded(
                    child: Text(
                      title,
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        color: AppColors.onSurface,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    color: AppColors.outline,
                    size: spacing.AppSpacing.iconLg,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSwitchRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool value,
    required bool busy,
    required ValueChanged<bool> onChanged,
  }) {
    return ConstrainedBox(
      constraints: const BoxConstraints(
        minHeight: spacing.AppSpacing.touchTarget,
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterLg,
          vertical: spacing.AppSpacing.gutterSm,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.bodyMdMedium.copyWith(
                      color: AppColors.onSurface,
                    ),
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                  Text(
                    subtitle,
                    style: AppTextStyles.bodySm.copyWith(
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Semantics(
              toggled: value,
              label: 'Push notifications for this device',
              child: Switch(
                key: const ValueKey('profile_push_switch'),
                value: value,
                onChanged: busy ? null : onChanged,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildValueRow({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return ConstrainedBox(
      constraints: const BoxConstraints(
        minHeight: spacing.AppSpacing.touchTarget,
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterLg,
          vertical: spacing.AppSpacing.gutterSm,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Text(
                title,
                style: AppTextStyles.bodyMdMedium.copyWith(
                  color: AppColors.onSurface,
                ),
              ),
            ),
            Text(
              value,
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Quick Access',
              style: AppTextStyles.headlineSm.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: spacing.AppSpacing.gutterMd,
          crossAxisSpacing: spacing.AppSpacing.gutterMd,
          childAspectRatio: 2.2,
          children: [
            _buildQuickActionCard(
              'Find a Doctor',
              'By specialty',
              Icons.local_hospital,
              AppColors.primaryFixed,
              AppColors.primary,
            ),
            _buildQuickActionCard(
              'Appointments',
              'Schedules',
              Icons.calendar_month,
              AppColors.secondaryContainer,
              AppColors.secondary,
            ),
            _buildQuickActionCard(
              'Medical Records',
              'History & Prescriptions',
              Icons.folder_open,
              AppColors.tertiary.withValues(alpha: 0.1),
              AppColors.tertiary,
            ),
            _buildQuickActionCard(
              'Payments',
              'Bills & Invoices',
              Icons.receipt_long,
              AppColors.secondaryContainer,
              AppColors.secondary,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildQuickActionCard(
    String title,
    String subtitle,
    IconData icon,
    Color iconBgColor,
    Color iconColor,
  ) {
    return AppCard(
      onTap: () {
        if (title == 'Find a Doctor') {
          setState(() {
            _selectedSpecialtyFromHome = null;
            _currentIndex = 1;
          });
        } else if (title == 'Appointments') {
          setState(() {
            _currentIndex = 2;
          });
        } else if (title == 'Medical Records') {
          Navigator.of(context).pushNamed('/medical-records');
        } else if (title == 'Payments') {
          Navigator.of(context).pushNamed('/payments');
        }
      },
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterXs,
        vertical: spacing.AppSpacing.gutterXs,
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: spacing.AppSpacing.iconMd,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  subtitle,
                  style: AppTextStyles.bodySm.copyWith(
                    color: AppColors.secondary,
                    fontSize: 10,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUpcomingAppointment() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Upcoming Appointment',
              style: AppTextStyles.headlineSm.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  _currentIndex = 2;
                });
              },
              child: const Text('See all'),
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        if (_isLoadingUpcomingAppointment)
          const SizedBox(
            height: 200,
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_upcomingAppointmentError)
          const SizedBox(
            height: 100,
            child: Center(child: Text('Error loading appointment')),
          )
        else if (_nextAppointment == null)
          const SizedBox(
            height: 100,
            child: Center(child: Text('No upcoming appointments')),
          )
        else
          _buildUpcomingAppointmentCard(_nextAppointment!),
      ],
    );
  }

  Widget _buildUpcomingAppointmentCard(Map<String, dynamic> appointment) {
    final doctorFirstName = appointment['doctor_first_name'] ?? '';
    final doctorLastName = appointment['doctor_last_name'] ?? '';
    final specialty = appointment['specialty'] ?? '';
    final practiceName = appointment['practice_name'] ?? 'Private Practice';
    final professionalPhotoUrl = appointment['professional_photo_url']?.toString();
    final appointmentDateStr = appointment['appointment_date']?.toString();
    final appointmentDate = appointmentDateStr != null
        ? DateTime.tryParse(appointmentDateStr)?.toLocal()
        : null;
    final status = appointment['status'] as String?;
    final appointmentId = appointment['id']?.toString() ?? '';

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      onTap: appointmentId.isNotEmpty
          ? () {
              Navigator.of(context).pushNamed(
                '/appointment-detail',
                arguments: {'appointmentId': appointmentId},
              );
            }
          : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DoctorProfileImage(
                photoUrl: professionalPhotoUrl,
                size: 56,
                showVerifiedBadge: true,
              ),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Dr. $doctorFirstName $doctorLastName',
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      specialty,
                      style: AppTextStyles.bodySm.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Divider(
            height: 1,
            color: AppColors.slate200,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          _buildDetailRow(
            icon: Icons.event,
            label: 'Date',
            value: appointmentDate != null
                ? DateFormat('EEEE, MMM d, yyyy').format(appointmentDate)
                : 'Date not available',
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          _buildDetailRow(
            icon: Icons.access_time,
            label: 'Time',
            value: appointmentDate != null
                ? DateFormat('hh:mm a').format(appointmentDate)
                : 'Time not available',
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          _buildDetailRow(
            icon: Icons.location_on,
            label: 'Clinic',
            value: practiceName,
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: spacing.AppSpacing.gutterSm,
              vertical: spacing.AppSpacing.gutterXs,
            ),
            decoration: BoxDecoration(
              color: _getStatusColor(status).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
              border: Border.all(
                color: _getStatusColor(status).withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _getStatusIcon(status),
                  color: _getStatusColor(status),
                  size: spacing.AppSpacing.iconSm,
                ),
                const SizedBox(width: spacing.AppSpacing.gutterXs),
                Text(
                  _getStatusLabel(status),
                  style: AppTextStyles.labelSm.copyWith(
                    color: _getStatusColor(status),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          PrimaryButton(
            text: 'View Appointment Details',
            onPressed: appointmentId.isNotEmpty
                ? () {
                    Navigator.of(context).pushNamed(
                      '/appointment-detail',
                      arguments: {'appointmentId': appointmentId},
                    );
                  }
                : null,
            height: 44,
            isFullWidth: true,
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: AppColors.surfaceLow,
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
          ),
          child: Icon(
            icon,
            color: AppColors.primary,
            size: spacing.AppSpacing.iconMd,
          ),
        ),
        const SizedBox(width: spacing.AppSpacing.gutterSm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label.toUpperCase(),
                style: AppTextStyles.labelSm.copyWith(
                  color: AppColors.secondary,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: AppTextStyles.bodyMd.copyWith(
                  color: AppColors.onSurface,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Color _getStatusColor(String? status) {
    switch (status) {
      case 'SCHEDULED':
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return AppColors.tertiary;
      case 'COMPLETED':
        return AppColors.secondary;
      case 'CANCELLED':
      case 'NO_SHOW':
        return AppColors.error;
      default:
        return AppColors.onSurfaceVariant;
    }
  }

  IconData _getStatusIcon(String? status) {
    switch (status) {
      case 'SCHEDULED':
      case 'CONFIRMED':
      case 'IN_PROGRESS':
        return Icons.event_available;
      case 'COMPLETED':
        return Icons.check_circle;
      case 'CANCELLED':
      case 'NO_SHOW':
        return Icons.event_busy;
      default:
        return Icons.info_outline;
    }
  }

  String _getStatusLabel(String? status) {
    switch (status) {
      case 'SCHEDULED':
        return 'Confirmed';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No Show';
      default:
        return 'Unknown';
    }
  }

  Widget _buildRecentUpdates() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Updates',
              style: AppTextStyles.headlineSm.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            if (_recentUpdates.isNotEmpty)
              TextButton(
                onPressed: () {
                  Navigator.of(context).pushNamed('/recent-updates');
                },
                child: const Text('See all'),
              ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        if (_isLoadingRecentUpdates)
          Column(
            children: List.generate(3, (index) {
              return Padding(
                padding: EdgeInsets.only(
                  bottom: index < 2 ? spacing.AppSpacing.gutterMd : 0,
                ),
                child: const SizedBox(
                  height: 80,
                  child: Center(child: CircularProgressIndicator()),
                ),
              );
            }),
          )
        else if (_recentUpdatesError)
          const SizedBox(
            height: 100,
            child: Center(child: Text('Error loading updates')),
          )
        else if (_recentUpdates.isEmpty)
          const SizedBox(
            height: 100,
            child: Center(child: Text('No recent updates')),
          )
        else
          ..._recentUpdates.map((update) => _buildRecentUpdateItem(update)),
      ],
    );
  }

  Widget _buildRecentUpdateItem(dynamic update) {
    final type = update['type'] as String?;
    final title = update['title'] as String? ?? 'Update';
    final message = update['message'] as String? ?? '';
    final createdAtStr = update['created_at']?.toString();
    final createdAt = createdAtStr != null
        ? DateTime.tryParse(createdAtStr)?.toLocal()
        : null;

    final iconData = _getUpdateIcon(type);
    final iconColor = _getUpdateColor(type);

    return Padding(
      padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: AppCard(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: iconColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
              ),
              child: Icon(
                iconData,
                color: iconColor,
                size: spacing.AppSpacing.iconMd,
              ),
            ),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.bodyMdMedium.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (message.isNotEmpty) ...[
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      message,
                      style: AppTextStyles.bodySm.copyWith(
                        color: AppColors.onSurfaceVariant,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (createdAt != null) ...[
                    const SizedBox(height: spacing.AppSpacing.gutterXs),
                    Text(
                      _formatTimestamp(createdAt),
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.secondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              color: AppColors.outline,
              size: spacing.AppSpacing.iconSm,
            ),
          ],
        ),
      ),
    );
  }

  IconData _getUpdateIcon(String? type) {
    switch (type) {
      case 'APPOINTMENT_CREATED':
      case 'APPOINTMENT_UPDATED':
      case 'APPOINTMENT_CANCELLED':
      case 'APPOINTMENT_REMINDER':
        return Icons.event;
      case 'PRESCRIPTION_READY':
      case 'PRESCRIPTION_UPDATED':
        return Icons.medication;
      case 'PAYMENT_VERIFIED':
      case 'PAYMENT_REJECTED':
      case 'PAYMENT_PENDING':
        return Icons.payment;
      default:
        return Icons.notifications_outlined;
    }
  }

  Color _getUpdateColor(String? type) {
    switch (type) {
      case 'APPOINTMENT_CREATED':
      case 'APPOINTMENT_UPDATED':
      case 'APPOINTMENT_CANCELLED':
      case 'APPOINTMENT_REMINDER':
        return AppColors.primary;
      case 'PRESCRIPTION_READY':
      case 'PRESCRIPTION_UPDATED':
        return AppColors.tertiary;
      case 'PAYMENT_VERIFIED':
      case 'PAYMENT_REJECTED':
      case 'PAYMENT_PENDING':
        return AppColors.secondary;
      default:
        return AppColors.onSurfaceVariant;
    }
  }

  Widget _buildBottomNavigation() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        border: Border(
          top: BorderSide(color: AppColors.slate200),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        bottom: true,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.gutterMd,
            vertical: spacing.AppSpacing.gutterXs,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(Icons.home, 'Home', 0),
              _buildNavItem(Icons.local_hospital, 'Doctors', 1),
              _buildNavItem(
                Icons.calendar_month,
                'Appointments',
                2,
                unreadCount: _waitlistCount,
              ),
              _buildNavItem(
                Icons.chat_bubble,
                'Chat',
                3,
                unreadCount: _totalUnreadCount,
              ),
              _buildNavItem(Icons.account_circle, 'Profile', 4),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(
    IconData icon,
    String label,
    int index, {
    int? unreadCount,
  }) {
    final isActive = _currentIndex == index;
    return InkWell(
      onTap: () {
        setState(() {
          _currentIndex = index;
          if (index != 1) {
            _selectedSpecialtyFromHome = null;
          }
        });
        if (index == 3) {
          _loadConversations();
        }
      },
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterSm,
          vertical: spacing.AppSpacing.gutterXs,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  icon,
                  color: isActive
                      ? AppColors.primary
                      : AppColors.onSurfaceVariant,
                  size: spacing.AppSpacing.iconLg,
                ),
                if (unreadCount != null && unreadCount > 0)
                  Positioned(
                    right: -6,
                    top: -6,
                    child: Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: spacing.AppSpacing.gutterXs,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(
                          spacing.AppSpacing.radiusFull,
                        ),
                      ),
                      constraints: const BoxConstraints(
                        minWidth: 16,
                        minHeight: 16,
                      ),
                      child: Text(
                        unreadCount > 99 ? '99+' : unreadCount.toString(),
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.onError,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            Text(
              label,
              style: AppTextStyles.labelSm.copyWith(
                color: isActive
                    ? AppColors.primary
                    : AppColors.onSurfaceVariant,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

}

class ChatTabContent extends StatelessWidget {
  const ChatTabContent({
    super.key,
    required this.isLoading,
    required this.conversations,
    required this.onRefresh,
  });

  final bool isLoading;
  final List<Conversation> conversations;

  /// Called after a conversation thread is closed so the list refreshes.
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return SkeletonColumn(
        itemCount: 4,
        itemBuilder: (context, index) => const ConversationTileSkeleton(),
      );
    }

    if (conversations.isEmpty) {
      // Keep the filler valid on the zero-sized first layout pass instead of
      // subtracting from a zero height. See test/initial_frame_layout_test.dart.
      if (MediaQuery.of(context).size.height > 300) {
        return SizedBox(
          height: MediaQuery.of(context).size.height - 300,
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.chat_bubble, size: 64, color: AppColors.secondary),
                const SizedBox(height: spacing.AppSpacing.gutterMd),
                Text(
                  'No conversations yet',
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.secondary,
                  ),
                ),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
                Text(
                  'Secretaries will start conversations with you',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.outline,
                  ),
                ),
              ],
            ),
          ),
        );
      }
      return const SizedBox.shrink();
    }

    return Column(
      children: conversations
          .map((conversation) => _buildConversationCard(context, conversation))
          .toList(),
    );
  }

  Widget _buildConversationCard(
    BuildContext context,
    Conversation conversation,
  ) {
    return AppCard(
      onTap: () async {
        await Navigator.of(context).pushNamed(
          '/conversation-thread',
          arguments: {'conversationId': conversation.id},
        );
        // Reload conversations when returning to update unread count
        onRefresh();
      },
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          DoctorProfileImage(
            photoUrl: conversation.doctorProfessionalPhotoUrl,
            size: 48,
            showVerifiedBadge: false,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      conversation.secretaryName,
                      style: AppTextStyles.bodyMdMedium.copyWith(
                        fontWeight: conversation.unreadCount > 0
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                    if (conversation.practiceName != null) ...[
                      const SizedBox(width: spacing.AppSpacing.gutterXs),
                      Text(
                        '•',
                        style: AppTextStyles.labelSm.copyWith(
                          color: AppColors.outline,
                        ),
                      ),
                      const SizedBox(width: spacing.AppSpacing.gutterXs),
                      Expanded(
                        child: Text(
                          conversation.practiceName!,
                          style: AppTextStyles.labelSm,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  conversation.lastMessagePreview ?? 'No messages yet',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                    fontWeight: conversation.unreadCount > 0
                        ? FontWeight.w700
                        : FontWeight.w400,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (conversation.lastMessageSentAt != null)
                Text(
                  _formatTimestamp(conversation.lastMessageSentAt!),
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.outline,
                  ),
                ),
              if (conversation.unreadCount > 0) ...[
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: spacing.AppSpacing.gutterSm,
                    vertical: spacing.AppSpacing.gutterXs,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    borderRadius: BorderRadius.circular(
                      spacing.AppSpacing.radiusFull,
                    ),
                  ),
                  constraints: const BoxConstraints(
                    minWidth: 20,
                    minHeight: 20,
                  ),
                  child: Text(
                    conversation.unreadCount > 99
                        ? '99+'
                        : conversation.unreadCount.toString(),
                    style: AppTextStyles.labelSm.copyWith(
                      color: AppColors.onError,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime dateTime) {
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
}
