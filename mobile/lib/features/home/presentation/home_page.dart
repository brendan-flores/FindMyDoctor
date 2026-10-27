import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/widgets/doctor_profile_image.dart';
import '../../../core/services/doctor_service.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/push_notification_service.dart';
import '../../../core/models/doctor.dart';
import '../../../features/auth/presentation/change_password_page.dart';
import '../../appointments/presentation/appointments_page.dart';
import '../../doctors/presentation/doctors_page.dart';
import '../../conversations/models/conversation.dart';
import '../../notifications/models/notification.dart' as notif_model;
import '../../../core/constants/ai_constants.dart';

class HomePage extends StatefulWidget {
  final int? initialTab;

  /// Test-only override for the push-notification service. When omitted the
  /// process-wide [PushNotificationService.instance] is used.
  final PushNotificationService? pushNotificationService;

  const HomePage({super.key, this.initialTab, this.pushNotificationService});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  int _currentIndex = 0;
  String? _selectedSpecialtyFromHome;
  final DoctorService _doctorService = DoctorService();
  final ApiService _apiService = ApiService();
  List<String> _specialties = [];
  List<Doctor> _recommendedDoctors = [];
  List<String> _hospitals = [];
  bool _isLoadingSpecialties = true;
  bool _isLoadingDoctors = true;
  List<Conversation> _conversations = [];
  bool _isLoadingConversations = true;
  int _totalUnreadCount = 0;
  int _notificationUnreadCount = 0;
  String? _userName;
  String? _userEmail;
  bool _accountInfoFailed = false;
  String _chatSegment = 'clinic'; // M1: Segmented control state

  // Profile "About" and "Notifications" section state.
  String? _appVersion;
  bool _pushEnabled = true;
  bool _isPushBusy = false;
  bool _permissionDeniedHintVisible = false;
  late final PushNotificationService _pushService;

  @override
  void initState() {
    super.initState();
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
  }

  Future<void> _loadUserInfo() async {
    try {
      final response = await _apiService.getCurrentUser();
      if (response['success'] == true && response['data'] != null) {
        if (!mounted) return;
        setState(() {
          _userName =
              response['data']['firstName'] != null &&
                  response['data']['lastName'] != null
              ? '${response['data']['firstName']} ${response['data']['lastName']}'
              : response['data']['email'];
          _userEmail = response['data']['email'];
          _accountInfoFailed = false;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _accountInfoFailed = true;
        });
      }
    } catch (e) {
      // Surface a retry affordance in the profile; other tabs are unaffected.
      if (!mounted) return;
      setState(() {
        _accountInfoFailed = true;
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
      print('📱 HomePage: Starting to load doctors data...');
      final allDoctors = await _doctorService.getDoctors();
      print('📱 HomePage: Loaded ${allDoctors.length} doctors');

      // Extract unique specialties
      final uniqueSpecialties =
          allDoctors
              .map((d) => d.specialty)
              .where((s) => s.isNotEmpty)
              .toSet()
              .toList()
            ..sort();

      // Extract unique hospitals/clinics
      final uniqueHospitals =
          allDoctors
              .map((d) => d.practiceName)
              .whereType<String>()
              .where((h) => h.isNotEmpty && h != 'Private Practice')
              .toSet()
              .toList()
            ..sort();

      // Take first 2 doctors as recommended
      final recommended = allDoctors.take(2).toList();

      print('📱 HomePage: Extracted ${uniqueSpecialties.length} specialties, ${uniqueHospitals.length} hospitals');

      if (!mounted) return;
      setState(() {
        _specialties = uniqueSpecialties;
        _hospitals = uniqueHospitals;
        _recommendedDoctors = recommended;
        _isLoadingSpecialties = false;
        _isLoadingDoctors = false;
      });
    } catch (e) {
      print('🔴 HomePage: Error loading data: $e');
      if (!mounted) return;
      setState(() {
        _isLoadingSpecialties = false;
        _isLoadingDoctors = false;
      });
    }
  }

  Future<void> _loadConversations() async {
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

  Future<void> _logout() async {
    await _apiService.logout();
    Navigator.of(context).pushReplacementNamed('/login');
  }

  void _handleNotificationItemTap(notif_model.Notification notification) {
    // Reload notification unread count to update badge
    _loadNotificationUnreadCount();

    // Navigate based on notification type
    if (notification.isPaymentRelated) {
      // Navigate to appointments tab (payments are accessed via appointments)
      setState(() {
        _currentIndex = 2;
      });
    } else if (notification.isMessageRelated) {
      // Navigate to chat tab
      setState(() {
        _currentIndex = 3;
      });
    }
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
              elevation: 0,
              child: SizedBox(
                width: 100,
                height: 100,
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
          onNotificationItemTap: (notif_model.Notification notification) {
            _handleNotificationItemTap(notification);
          },
          onUnreadCountUpdate: () {
            _loadNotificationUnreadCount();
          },
          onViewAll: () {
            Navigator.of(context).pushNamed('/notifications');
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
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildSearchBar(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildSpecialties(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildQuickActions(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildRecommendedDoctors(),
                    const SizedBox(height: spacing.AppSpacing.gutterLg),
                    _buildNearbyClinics(),
                    const SizedBox(height: spacing.AppSpacing.gutter3xl),
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
    return const AppointmentsPage();
  }

  Widget _buildChatContent() {
    // Load conversations when this tab is accessed
    if (_isLoadingConversations) {
      _loadConversations();
    }

    return Column(
      children: [
        AppHeader(
          showNotifications: true,
          showProfile: true,
          unreadCount: _notificationUnreadCount,
          onNotificationItemTap: (notif_model.Notification notification) {
            _handleNotificationItemTap(notification);
          },
          onUnreadCountUpdate: () {
            _loadNotificationUnreadCount();
          },
          onViewAll: () {
            Navigator.of(context).pushNamed('/notifications');
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
                              _loadConversations();
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

  Widget _buildConversationCard(Conversation conversation) {
    return AppCard(
      onTap: () async {
        await Navigator.of(context).pushNamed(
          '/conversation-thread',
          arguments: {'conversationId': conversation.id},
        );
        // Reload conversations when returning to update unread count
        if (mounted) {
          _loadConversations();
        }
      },
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              Icons.person,
              color: AppColors.outline,
              size: spacing.AppSpacing.iconLg,
            ),
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
                    borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
                  ),
                  constraints: const BoxConstraints(
                    minWidth: 20,
                    minHeight: 20,
                  ),
                  child: Text(
                    conversation.unreadCount > 99 ? '99+' : conversation.unreadCount.toString(),
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

  Widget _buildProfileContent() {
    return Column(
      children: [
        AppHeader(
          showNotifications: true,
          showProfile: true,
          unreadCount: _notificationUnreadCount,
          onNotificationItemTap: (notif_model.Notification notification) {
            _handleNotificationItemTap(notification);
          },
          onUnreadCountUpdate: () {
            _loadNotificationUnreadCount();
          },
          onViewAll: () {
            Navigator.of(context).pushNamed('/notifications');
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
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _userName ?? 'Loading…',
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

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterXs,
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
                hintText: 'Search doctor, specialty, St. Luke\'s...',
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
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceLow,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              Icons.tune,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSpecialties() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSpecialtyChip('All Doctors', Icons.medical_services, true, null),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        if (_isLoadingSpecialties)
          const SizedBox(
            height: 40,
            child: Center(
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          )
        else if (_specialties.isEmpty)
          const SizedBox(
            height: 40,
            child: Center(
              child: Text(
                'No specialties available',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ),
          )
        else
          SizedBox(
            height: 40,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _specialties.length,
              itemBuilder: (context, index) {
                final specialty = _specialties[index];
                return Padding(
                  padding: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
                  child: _buildSpecialtyChip(
                    specialty,
                    _getSpecialtyIcon(specialty),
                    false,
                    specialty,
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _buildSpecialtyChip(
    String label,
    IconData icon,
    bool isSelected,
    String? specialty,
  ) {
    return GestureDetector(
      onTap: specialty != null
          ? () {
              setState(() {
                _selectedSpecialtyFromHome = specialty;
                _currentIndex = 1;
              });
            }
          : null,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterMd,
          vertical: spacing.AppSpacing.gutterXs,
        ),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.surfaceLowest,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
          boxShadow: [
            BoxShadow(
              color: AppColors.slate800.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: spacing.AppSpacing.iconMd,
              color: isSelected ? AppColors.onPrimary : AppColors.tertiary,
            ),
            const SizedBox(width: spacing.AppSpacing.gutterXs),
            Text(
              label,
              style: AppTextStyles.labelMd.copyWith(
                color: isSelected ? AppColors.onPrimary : AppColors.secondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: spacing.AppSpacing.gutterMd,
      crossAxisSpacing: spacing.AppSpacing.gutterMd,
      childAspectRatio: 2.5,
      children: [
        _buildQuickActionCard(
          'Find a Doctor',
          'By specialty',
          Icons.local_hospital,
          AppColors.primaryFixed,
          AppColors.primary,
        ),
        _buildQuickActionCard(
          'My Appointments',
          'Schedules',
          Icons.calendar_month,
          AppColors.secondaryContainer,
          AppColors.secondary,
        ),
        _buildQuickActionCard(
          'Secretary Chat',
          'Inquiries',
          Icons.chat,
          AppColors.tertiary.withValues(alpha: 0.1),
          AppColors.tertiary,
        ),
        _buildQuickActionCard(
          'My Profile',
          'Settings',
          Icons.person,
          AppColors.primaryContainer.withValues(alpha: 0.15),
          AppColors.primaryContainer,
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
        } else if (title == 'My Appointments') {
          setState(() {
            _currentIndex = 2;
          });
        } else if (title == 'Secretary Chat') {
          setState(() {
            _currentIndex = 3;
            _chatSegment = 'clinic';
          });
        } else if (title == 'My Profile') {
          setState(() {
            _currentIndex = 4;
          });
        }
      },
      padding: EdgeInsets.symmetric(
        horizontal: spacing.AppSpacing.gutterSm,
        vertical: spacing.AppSpacing.gutterSm,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: spacing.AppSpacing.iconSm,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: AppTextStyles.labelMd.copyWith(fontSize: 12),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 1),
                Text(
                  subtitle,
                  style: AppTextStyles.labelSm.copyWith(fontSize: 10),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendedDoctors() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Recommended Doctors', style: AppTextStyles.headlineSm),
                Text('Family health specialists', style: AppTextStyles.labelSm),
              ],
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  _selectedSpecialtyFromHome = null;
                  _currentIndex = 1;
                });
              },
              child: Text('See all', style: AppTextStyles.labelMd),
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        if (_isLoadingDoctors)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32.0),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_recommendedDoctors.isEmpty)
          Padding(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterXl),
            child: Column(
              children: [
                Icon(Icons.person_search, size: 64, color: AppColors.outline),
                const SizedBox(height: 16),
                Text(
                  'No Doctors Found',
                  style: AppTextStyles.headlineSm.copyWith(
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Register doctors to see them here',
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          )
        else
          for (var doctor in _recommendedDoctors)
            Padding(
              padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
              child: _buildDoctorCard(doctor),
            ),
      ],
    );
  }

  Widget _buildDoctorCard(Doctor doctor) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          DoctorProfileImage(
            photoUrl: doctor.professionalPhotoUrl,
            size: 48,
            showVerifiedBadge: doctor.isApproved,
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(doctor.fullName, style: AppTextStyles.bodyMdMedium),
                Text(
                  '${doctor.specialty} • ${doctor.practiceName ?? 'Private Practice'}',
                  style: AppTextStyles.labelSm,
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  '₱${doctor.consultationFeeText ?? '1,000'}',
                  style: AppTextStyles.labelSm.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 60,
            child: ElevatedButton(
              onPressed: () {
                setState(() {
                  _selectedSpecialtyFromHome = null;
                  _currentIndex = 1;
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.onPrimary,
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: spacing.AppSpacing.gutterXs,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusMd,
                  ),
                ),
              ),
              child: Text('Book', style: AppTextStyles.labelSm),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNearbyClinics() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Accredited Nearby', style: AppTextStyles.headlineSm),
                Text(
                  'Walk-ins & queue updates available',
                  style: AppTextStyles.labelSm,
                ),
              ],
            ),
            Icon(
              Icons.near_me,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        if (_isLoadingDoctors)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(32.0),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_hospitals.isEmpty)
          Padding(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterXl),
            child: Column(
              children: [
                Icon(
                  Icons.local_hospital_outlined,
                  size: 64,
                  color: AppColors.outline,
                ),
                const SizedBox(height: 16),
                Text(
                  'No Clinics Yet',
                  style: AppTextStyles.headlineSm.copyWith(
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Register doctors to see clinics',
                  style: AppTextStyles.bodyMd.copyWith(
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          )
        else
          for (var hospital in _hospitals)
            Padding(
              padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
              child: _buildClinicCard(hospital),
            ),
      ],
    );
  }

  Widget _buildClinicCard(String hospitalName) {
    final doctorCount = _recommendedDoctors
        .where((d) => d.practiceName == hospitalName)
        .length;

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
            ),
            child: Icon(
              Icons.local_hospital,
              color: AppColors.primary,
              size: spacing.AppSpacing.iconMd,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(hospitalName, style: AppTextStyles.bodyMdMedium),
                Text(
                  '$doctorCount Doctor${doctorCount != 1 ? 's' : ''}',
                  style: AppTextStyles.labelSm,
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
              color: AppColors.secondaryContainer,
              borderRadius: BorderRadius.circular(
                spacing.AppSpacing.radiusFull,
              ),
            ),
            child: Text(
              '$doctorCount',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.onSecondaryFixed,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNavigation() {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest.withValues(alpha: 0.95),
        border: Border(
          top: BorderSide(color: AppColors.slate200.withValues(alpha: 0.5)),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.slate800.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: spacing.AppSpacing.gutterMd,
            vertical: spacing.AppSpacing.gutterSm,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(Icons.home, 'Home', 0),
              _buildNavItem(Icons.local_hospital, 'Doctors', 1),
              _buildNavItem(Icons.calendar_month, 'Appointments', 2),
              _buildNavItem(Icons.chat_bubble, 'Chat', 3, unreadCount: _totalUnreadCount),
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
          // Clear specialty when switching tabs
          if (index != 1) {
            _selectedSpecialtyFromHome = null;
          }
          // Reload conversations when switching to chat tab
          if (index == 3) {
            _loadConversations();
          }
        });
      },
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: spacing.AppSpacing.gutterSm,
          vertical: spacing.AppSpacing.gutterSm,
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
                      ? AppColors.primaryContainer
                      : AppColors.secondary,
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
                    ? AppColors.primaryContainer
                    : AppColors.secondary,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _getSpecialtyIcon(String specialty) {
    switch (specialty.toLowerCase()) {
      case 'cardiology':
        return Icons.favorite;
      case 'pediatrics':
        return Icons.child_care;
      case 'dermatology':
        return Icons.face;
      case 'dentistry':
        return Icons.mood;
      case 'orthopedics':
        return Icons.accessibility;
      case 'ob-gyn':
      case 'obstetrics':
      case 'gynecology':
        return Icons.pregnant_woman;
      case 'ophthalmology':
        return Icons.visibility;
      case 'anesthesiology':
        return Icons.medical_services;
      case 'ent':
      case 'otolaryngology':
        return Icons.hearing;
      default:
        return Icons.medical_services;
    }
  }
}

/// Body content of the patient Secretary Chat tab.
///
/// Kept public so it can be unit-tested directly (see
/// test/chat_tab_content_test.dart): the previous inline collection-if chain
/// let the final `else` bind to a nested guard instead of the
/// `_conversations.isEmpty` branch, leaving the tab blank whenever
/// conversations actually existed.
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
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32.0),
          child: CircularProgressIndicator(),
        ),
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
