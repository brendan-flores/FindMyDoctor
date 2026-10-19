import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/app_card.dart';
import '../../../core/widgets/app_header.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/doctor_service.dart';
import '../../../core/services/api_service.dart';
import '../../../core/models/doctor.dart';
import '../../appointments/presentation/appointments_page.dart';
import '../../doctors/presentation/doctors_page.dart';
import '../../conversations/models/conversation.dart';

class HomePage extends StatefulWidget {
  final int? initialTab;

  const HomePage({super.key, this.initialTab});

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
  String? _userName;
  String? _userEmail;

  @override
  void initState() {
    super.initState();
    if (widget.initialTab != null) {
      _currentIndex = widget.initialTab!;
    }
    _loadData();
    _loadUserInfo();
    // Load conversations in background to show unread badge
    _loadConversations();
  }

  Future<void> _loadUserInfo() async {
    try {
      final response = await _apiService.getCurrentUser();
      if (response['success'] == true && response['data'] != null) {
        if (!mounted) return;
        setState(() {
          _userName = response['data']['firstName'] != null && response['data']['lastName'] != null
              ? '${response['data']['firstName']} ${response['data']['lastName']}'
              : response['data']['email'];
          _userEmail = response['data']['email'];
        });
      }
    } catch (e) {
      // Silently fail - keep default profile info
    }
  }

  Future<void> _loadData() async {
    try {
      final allDoctors = await _doctorService.getDoctors();

      // Extract unique specialties
      final uniqueSpecialties = allDoctors
          .map((d) => d.specialty)
          .where((s) => s.isNotEmpty)
          .toSet()
          .toList()
        ..sort();

      // Extract unique hospitals/clinics
      final uniqueHospitals = allDoctors
          .map((d) => d.practiceName)
          .whereType<String>()
          .where((h) => h.isNotEmpty && h != 'Private Practice')
          .toSet()
          .toList()
        ..sort();

      // Take first 2 doctors as recommended
      final recommended = allDoctors.take(2).toList();

      if (!mounted) return;
      setState(() {
        _specialties = uniqueSpecialties;
        _hospitals = uniqueHospitals;
        _recommendedDoctors = recommended;
        _isLoadingSpecialties = false;
        _isLoadingDoctors = false;
      });
    } catch (e) {
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
        final conversations = data.map((json) => Conversation.fromJson(json)).toList();
        final totalUnread = conversations.fold<int>(0, (sum, conv) => sum + conv.unreadCount);
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
    );
  }

  Widget _buildHomeContent() {
    return Column(
      children: [
        const AppHeader(showNotifications: true, showProfile: true),
        Expanded(
          child: SingleChildScrollView(
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
        const AppHeader(showNotifications: true, showProfile: true),
        Expanded(
          child: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  Text(
                    'Secretary Chat',
                    style: AppTextStyles.headlineLg,
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  if (_isLoadingConversations)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.all(32.0),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  else if (_conversations.isEmpty)
                    SizedBox(
                      height: MediaQuery.of(context).size.height - 300,
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.chat_bubble,
                              size: 64,
                              color: AppColors.secondary,
                            ),
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
                    )
                  else
                    ..._conversations.map((conversation) => _buildConversationCard(conversation)),
                ],
              ),
            ),
          ),
        ),
      ],
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
    // See _buildChatContent: keep the filler valid on the zero-sized first
    // layout pass instead of subtracting from a zero height.
    final double emptyStateHeight =
        MediaQuery.of(context).size.height - 350;

    return Column(
      children: [
        const AppHeader(showNotifications: true, showProfile: true),
        Expanded(
          child: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  Text(
                    'My Profile',
                    style: AppTextStyles.headlineLg,
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
                  if (emptyStateHeight > 0)
                    SizedBox(
                      height: emptyStateHeight,
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.account_circle,
                              size: 64,
                              color: AppColors.secondary,
                            ),
                            const SizedBox(height: spacing.AppSpacing.gutterMd),
                            Text(
                              _userName ?? 'Loading...',
                              style: AppTextStyles.headlineSm.copyWith(
                                color: AppColors.secondary,
                              ),
                            ),
                            const SizedBox(height: spacing.AppSpacing.gutterSm),
                            Text(
                              _userEmail ?? 'Loading...',
                              style: AppTextStyles.bodyMd.copyWith(
                                color: AppColors.outline,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: spacing.AppSpacing.gutterLg),
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

  Widget _buildSpecialtyChip(String label, IconData icon, bool isSelected, String? specialty) {
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
        }
      },
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
            ),
            child: Icon(
              icon,
              color: iconColor,
              size: spacing.AppSpacing.iconLg,
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  title,
                  style: AppTextStyles.bodyMdMedium,
                ),
                Text(
                  subtitle,
                  style: AppTextStyles.labelSm,
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
                Text(
                  'Recommended Doctors',
                  style: AppTextStyles.headlineSm,
                ),
                Text(
                  'Family health specialists',
                  style: AppTextStyles.labelSm,
                ),
              ],
            ),
            TextButton(
              onPressed: () {
                setState(() {
                  _selectedSpecialtyFromHome = null;
                  _currentIndex = 1;
                });
              },
              child: Text(
                'See all',
                style: AppTextStyles.labelMd,
              ),
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
                Icon(
                  Icons.person_search,
                  size: 64,
                  color: AppColors.outline,
                ),
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
                Text(
                  doctor.fullName,
                  style: AppTextStyles.bodyMdMedium,
                ),
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
                  borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusMd),
                ),
              ),
              child: Text(
                'Book',
                style: AppTextStyles.labelSm,
              ),
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
                Text(
                  'Accredited Nearby',
                  style: AppTextStyles.headlineSm,
                ),
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
    final doctorCount = _recommendedDoctors.where((d) => d.practiceName == hospitalName).length;

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
                Text(
                  hospitalName,
                  style: AppTextStyles.bodyMdMedium,
                ),
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
              borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
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

  Widget _buildNavItem(IconData icon, String label, int index, {int? unreadCount}) {
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
                  color: isActive ? AppColors.primaryContainer : AppColors.secondary,
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
                        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusFull),
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
                color: isActive ? AppColors.primaryContainer : AppColors.secondary,
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
