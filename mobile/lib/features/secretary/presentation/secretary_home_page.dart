import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/services/api_service.dart';
import '../../../app/app.dart' show MyApp;
import '../../conversations/models/conversation.dart';
import 'patient_info_sheet.dart';

/// Secretary home screen: a chat-first conversation list scoped by the
/// backend to the secretary's assigned doctor. It reuses the shared
/// Conversation model and the existing conversation endpoints so the mobile
/// and web secretary experiences stay in sync.
class SecretaryHomePage extends StatefulWidget {
  const SecretaryHomePage({super.key});

  @override
  State<SecretaryHomePage> createState() => _SecretaryHomePageState();
}

class _SecretaryHomePageState extends State<SecretaryHomePage> {
  final ApiService _apiService = ApiService();

  List<_SecretaryConversation> _conversations = [];
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadConversations();
    // Keep unread counts and previews fresh while the list is open.
    _refreshTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      _loadConversations(silent: true);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadConversations({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _errorMessage = null;
      });
    }

    try {
      final response = await _apiService.getConversations();
      if (!mounted) return;

      if (response['success'] == true && response['data'] is List) {
        final entries = <_SecretaryConversation>[];
        for (final item in response['data'] as List) {
          if (item is! Map) continue;
          final entry = _SecretaryConversation.tryParse(
            Map<String, dynamic>.from(item),
          );
          if (entry != null) entries.add(entry);
        }
        // Most recent conversations first (latest message, then last update).
        entries.sort((a, b) {
          final aTime =
              a.conversation.lastMessageSentAt ?? a.conversation.updatedAt;
          final bTime =
              b.conversation.lastMessageSentAt ?? b.conversation.updatedAt;
          return bTime.compareTo(aTime);
        });
        setState(() {
          _conversations = entries;
          _isLoading = false;
          _errorMessage = null;
        });
      } else {
        setState(() {
          _conversations = [];
          _isLoading = false;
          if (!silent) _errorMessage = 'Unable to load conversations.';
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoading = false;
        if (!silent) _errorMessage = 'Unable to load conversations.';
      });
    }
  }

  int get _totalUnread =>
      _conversations.fold(0, (sum, entry) => sum + entry.conversation.unreadCount);

  String get _doctorName {
    if (_conversations.isEmpty) return 'your assigned doctor';
    final name = _conversations.first.conversation.doctorName.trim();
    return name.isEmpty ? 'your assigned doctor' : name;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: Column(
        children: [
          AppHeader(
            showNotifications: false,
            showProfile: false,
            actions: [
              IconButton(
                icon: const Icon(Icons.more_vert),
                onPressed: _showMenu,
                tooltip: 'Menu',
              ),
            ],
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _loadConversations,
              child: _buildBody(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && _conversations.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 160),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: EdgeInsets.fromLTRB(
        spacing.AppSpacing.screenPadding,
        spacing.AppSpacing.gutterMd,
        spacing.AppSpacing.screenPadding,
        spacing.AppSpacing.gutter3xl,
      ),
      children: [
        _buildListHeader(),
        const SizedBox(height: spacing.AppSpacing.gutterLg),
        if (_errorMessage != null) _buildErrorState(),
        if (_errorMessage == null && _conversations.isEmpty) _buildEmptyState(),
        if (_errorMessage == null)
          ..._conversations.map(
            (entry) => Padding(
              padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
              child: _buildConversationCard(entry),
            ),
          ),
      ],
    );
  }

  Widget _buildListHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('Messages', style: AppTextStyles.headlineLg),
            if (_totalUnread > 0) ...[
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: spacing.AppSpacing.gutterSm,
                  vertical: 2,
                ),
                decoration: BoxDecoration(
                  color: AppColors.error,
                  borderRadius: BorderRadius.circular(
                    spacing.AppSpacing.radiusFull,
                  ),
                ),
                child: Text(
                  _totalUnread > 99 ? '99+' : _totalUnread.toString(),
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.onError,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterXs),
        Text(
          'Patients of Dr. $_doctorName',
          style: AppTextStyles.labelSm.copyWith(color: AppColors.secondary),
        ),
      ],
    );
  }

  Widget _buildErrorState() {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        children: [
          const Icon(Icons.error_outline, color: AppColors.error, size: 40),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Text(
            _errorMessage ?? 'Unable to load conversations.',
            textAlign: TextAlign.center,
            style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          OutlinedButton.icon(
            onPressed: _loadConversations,
            icon: const Icon(Icons.refresh, size: 18),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return SizedBox(
      height: MediaQuery.of(context).size.height - 300,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.chat_bubble_outline,
              size: 64,
              color: AppColors.secondary,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            Text(
              'No conversations yet',
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.secondary),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            Text(
              'Patient chats will appear here',
              style: AppTextStyles.labelSm.copyWith(color: AppColors.outline),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConversationCard(_SecretaryConversation entry) {
    final conversation = entry.conversation;
    final hasUnread = conversation.unreadCount > 0;

    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      onTap: () => _openThread(entry),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Center(
              child: Text(
                _initials(entry.patientName),
                style: AppTextStyles.bodyMdMedium.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.patientName,
                  style: AppTextStyles.bodyMdMedium.copyWith(
                    fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: spacing.AppSpacing.gutterXs),
                Text(
                  conversation.lastMessagePreview ?? 'No messages yet',
                  style: AppTextStyles.labelSm.copyWith(
                    color: AppColors.secondary,
                    fontWeight: hasUnread ? FontWeight.w700 : FontWeight.w400,
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
              const SizedBox(height: spacing.AppSpacing.gutterXs),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (hasUnread)
                    Container(
                      margin: EdgeInsets.only(
                        right: spacing.AppSpacing.gutterXs,
                      ),
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
                  IconButton(
                    onPressed: () => PatientInfoSheet.show(
                      context,
                      conversationId: conversation.id,
                      patientName: entry.patientName,
                    ),
                    icon: const Icon(Icons.info_outline, size: 20),
                    color: AppColors.primary,
                    tooltip: 'Patient information',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 36,
                      minHeight: 36,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openThread(_SecretaryConversation entry) async {
    await Navigator.of(context).pushNamed(
      '/conversation-thread',
      arguments: {
        'conversationId': entry.conversation.id,
        'counterpartName': entry.patientName,
      },
    );
    // Opening the thread marks it read; refresh previews and unread counts.
    if (mounted) {
      _loadConversations(silent: true);
    }
  }

  // ---------------------------------------------------------------------------
  // Minimal secretary menu
  // ---------------------------------------------------------------------------

  void _showMenu() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surfaceLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(spacing.AppSpacing.radius2xl),
        ),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Notifications'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _showNotifications();
              },
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Profile'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _showProfile();
              },
            ),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('Settings'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _showSettings();
              },
            ),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.error),
              title: const Text(
                'Logout',
                style: TextStyle(color: AppColors.error),
              ),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _confirmLogout();
              },
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
          ],
        ),
      ),
    );
  }

  Future<void> _showNotifications() async {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(spacing.AppSpacing.radius2xl),
        ),
      ),
      builder: (_) => _NotificationsSheet(apiService: _apiService),
    );
  }

  Future<void> _showProfile() async {
    ListTile buildTile(IconData icon, String title, String subtitle) {
      return ListTile(
        leading: Icon(icon, color: AppColors.primary),
        title: Text(title, style: AppTextStyles.bodyMdMedium),
        subtitle: Text(subtitle, style: AppTextStyles.labelSm),
      );
    }

    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Profile'),
        content: FutureBuilder<Map<String, dynamic>>(
          future: _apiService.getCurrentUser(),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const SizedBox(
                height: 80,
                child: Center(child: CircularProgressIndicator()),
              );
            }

            final data = snapshot.data;
            final user = data != null && data['data'] is Map
                ? Map<String, dynamic>.from(data['data'] as Map)
                : const <String, dynamic>{};
            final firstName = (user['firstName'] ?? '').toString();
            final lastName = (user['lastName'] ?? '').toString();
            final name = '$firstName $lastName'.trim();

            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                buildTile(
                  Icons.badge_outlined,
                  'Name',
                  name.isEmpty ? 'Not set' : name,
                ),
                buildTile(
                  Icons.email_outlined,
                  'Email',
                  (user['email'] ?? user['username'] ?? 'Not available')
                      .toString(),
                ),
                buildTile(
                  Icons.verified_user_outlined,
                  'Role',
                  (user['role'] ?? 'SECRETARY').toString(),
                ),
              ],
            );
          },
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showSettings() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: AppColors.surfaceLowest,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(spacing.AppSpacing.radius2xl),
        ),
      ),
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            ListTile(
              leading: const Icon(Icons.lock_outline),
              title: const Text('Change Password'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                Navigator.of(context).pushNamed('/change-password');
              },
            ),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('About'),
              subtitle: const Text(
                'Appointment management stays on the secretary web dashboard.',
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmLogout() async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to log out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Logout', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );

    if (shouldLogout != true || !mounted) return;

    await _apiService.logout();
    MyApp.appStateKey.currentState?.updateAuthState(false, false);

    if (!mounted) return;
    Navigator.of(context).pushNamedAndRemoveUntil('/login', (route) => false);
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
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
      return DateFormat('M/d/yyyy').format(dateTime);
    }
  }
}

/// Pairs the shared [Conversation] model with the patient name fields the
/// secretary conversation query returns (the shared model is patient-facing,
/// so patient names are read from the raw response instead of duplicated).
class _SecretaryConversation {
  final Conversation conversation;
  final String patientName;

  const _SecretaryConversation({
    required this.conversation,
    required this.patientName,
  });

  static _SecretaryConversation? tryParse(Map<String, dynamic> json) {
    final id = json['id']?.toString();
    if (id == null || id.isEmpty || id == 'null') {
      // Patients without an existing conversation have a null conversation id
      // and are not shown in the conversation list.
      return null;
    }

    try {
      final patientFirst = (json['patient_first_name'] ?? '').toString().trim();
      final patientLast = (json['patient_last_name'] ?? '').toString().trim();
      final patientName = [patientFirst, patientLast]
          .where((part) => part.isNotEmpty)
          .join(' ');

      final conversation = Conversation(
        id: id,
        patientId: (json['patient_id'] ?? '').toString(),
        secretaryId: (json['secretary_id'] ?? '').toString(),
        doctorId: (json['doctor_id'] ?? '').toString(),
        status: (json['status'] ?? 'OPEN').toString(),
        createdAt:
            DateTime.tryParse((json['created_at'] ?? '').toString()) ??
            DateTime.now(),
        updatedAt:
            DateTime.tryParse((json['updated_at'] ?? '').toString()) ??
            DateTime.now(),
        secretaryFirstName: (json['secretary_first_name'] ?? '').toString(),
        secretaryLastName: (json['secretary_last_name'] ?? '').toString(),
        doctorFirstName: (json['doctor_first_name'] ?? '').toString(),
        doctorLastName: (json['doctor_last_name'] ?? '').toString(),
        practiceName: json['practice_name']?.toString(),
        unreadCount: json['unread_count'] != null
            ? int.tryParse(json['unread_count'].toString()) ?? 0
            : 0,
        lastMessagePreview: json['last_message_preview']?.toString(),
        lastMessageSentAt: json['last_message_sent_at'] != null
            ? DateTime.tryParse(json['last_message_sent_at'].toString())
            : null,
      );

      return _SecretaryConversation(
        conversation: conversation,
        patientName: patientName.isEmpty ? 'Patient' : patientName,
      );
    } catch (_) {
      return null;
    }
  }
}

class _NotificationsSheet extends StatefulWidget {
  final ApiService apiService;

  const _NotificationsSheet({required this.apiService});

  @override
  State<_NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<_NotificationsSheet> {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final response = await widget.apiService.getNotifications();
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
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          spacing.AppSpacing.screenPadding,
          spacing.AppSpacing.gutterMd,
          spacing.AppSpacing.screenPadding,
          spacing.AppSpacing.gutterLg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Notifications', style: AppTextStyles.headlineSm),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(spacing.AppSpacing.gutterXl),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_notifications.isEmpty)
              Padding(
                padding: EdgeInsets.symmetric(
                  vertical: spacing.AppSpacing.gutterXl,
                ),
                child: Center(
                  child: Text(
                    'No notifications yet',
                    style: AppTextStyles.bodyMd.copyWith(
                      color: AppColors.secondary,
                    ),
                  ),
                ),
              )
            else
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _notifications.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final notification = _notifications[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(
                        Icons.chat_bubble_outline,
                        color: AppColors.primary,
                      ),
                      title: Text(
                        (notification['title'] ?? 'Notification').toString(),
                        style: AppTextStyles.bodyMdMedium,
                      ),
                      subtitle: Text(
                        (notification['message'] ?? '').toString(),
                        style: AppTextStyles.labelSm,
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
