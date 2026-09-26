import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import '../../home/presentation/home_page.dart';

class OnboardingPage extends StatefulWidget {
  final bool forceShow;

  const OnboardingPage({super.key, this.forceShow = false});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<OnboardingData> _onboardingData = [
    OnboardingData(
      title: 'Find the right doctor',
      description: 'Search for specialists based on location, availability, and symptoms.',
      icon: Icons.search,
    ),
    OnboardingData(
      title: 'Manage your health',
      description: 'Keep track of your appointments and prescriptions in one place.',
      icon: Icons.medical_services,
    ),
    OnboardingData(
      title: 'Book appointments\neasily',
      description: 'Real-time availability at your fingertips.\nNo more phone calls.',
      icon: Icons.calendar_today,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _checkOnboardingStatus();
  }

  Future<void> _checkOnboardingStatus() async {
    // If forceShow is true, skip the check and always show onboarding
    if (widget.forceShow) return;

    final prefs = await SharedPreferences.getInstance();
    final hasCompletedOnboarding = prefs.getBool('has_completed_onboarding') ?? false;

    if (hasCompletedOnboarding && mounted) {
      // If onboarding already completed, go directly to home
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => const HomePage(),
        ),
        (route) => false,
      );
    }
  }

  Future<void> _markOnboardingCompleted() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('has_completed_onboarding', true);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _nextPage() {
    if (_currentPage < _onboardingData.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _completeOnboarding();
    }
  }

  void _skipOnboarding() async {
    await _markOnboardingCompleted();
    _completeOnboarding();
  }

  void _completeOnboarding() async {
    // Mark onboarding as completed so it won't show again
    await _markOnboardingCompleted();
    
    // Navigate to home page after onboarding completion
    // User is already authenticated after successful registration
    if (mounted) {
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (context) => const HomePage(),
        ),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.brandBgLight,
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar with Skip Button
            _buildTopBar(),
            // PageView for Onboarding Screens
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                itemCount: _onboardingData.length,
                itemBuilder: (context, index) {
                  return _buildOnboardingScreen(_onboardingData[index]);
                },
              ),
            ),
            // Bottom Controls
            _buildBottomControls(),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar() {
    return Padding(
      padding: EdgeInsets.only(
        top: AppSpacing.gutterMd,
        right: AppSpacing.screenPadding,
        left: AppSpacing.screenPadding,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          TextButton(
            onPressed: _skipOnboarding,
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Skip',
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.slate500,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOnboardingScreen(OnboardingData data) {
    return Padding(
      padding: EdgeInsets.all(AppSpacing.screenPadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Concentric Badge Illustration
          _buildIllustrationBadge(data.icon),
          const SizedBox(height: AppSpacing.gutter3xl),
          // Main Headline
          Text(
            data.title,
            style: AppTextStyles.headlineLg.copyWith(
              fontSize: 26,
              color: AppColors.brandNavy,
              height: 1.2,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.gutterMd),
          // Subtitle Description
          Text(
            data.description,
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.slate500,
            ),
            textAlign: TextAlign.center,
            maxLines: 3,
          ),
        ],
      ),
    );
  }

  Widget _buildIllustrationBadge(IconData icon) {
    return SizedBox(
      width: 224,
      height: 224,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer diffuse concentric circle
          Container(
            width: 224,
            height: 224,
            decoration: BoxDecoration(
              color: AppColors.skyBlue.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
          ),
          // Inner concentric circle
          Container(
            width: 176,
            height: 176,
            decoration: BoxDecoration(
              color: AppColors.skyBlue.withValues(alpha: 0.25),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppColors.skyBlue.withValues(alpha: 0.1),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
          ),
          // Solid Blue Rounded Square Badge
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppColors.brandPrimary,
              borderRadius: BorderRadius.circular(22),
              boxShadow: [
                BoxShadow(
                  color: AppColors.brandPrimary.withValues(alpha: 0.25),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              icon,
              color: AppColors.onPrimary,
              size: 40,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomControls() {
    return Padding(
      padding: EdgeInsets.all(AppSpacing.screenPadding),
      child: Column(
        children: [
          // Primary Action Button
          PrimaryButton(
            text: _currentPage == _onboardingData.length - 1 ? 'Get Started' : 'Next',
            onPressed: _nextPage,
            icon: Icon(
              _currentPage == _onboardingData.length - 1 ? Icons.check : Icons.arrow_forward,
              size: 16,
            ),
          ),
          const SizedBox(height: AppSpacing.gutterLg),
          // Pagination Indicators
          _buildPaginationIndicators(),
          const SizedBox(height: AppSpacing.gutterMd),
        ],
      ),
    );
  }

  Widget _buildPaginationIndicators() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(_onboardingData.length, (index) {
        final isActive = index == _currentPage;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: EdgeInsets.symmetric(horizontal: isActive ? 3 : 6),
          width: isActive ? 24 : 6,
          height: 6,
          decoration: BoxDecoration(
            color: isActive ? AppColors.brandPrimary : AppColors.slate300,
            borderRadius: BorderRadius.circular(3),
          ),
        );
      }),
    );
  }
}

class OnboardingData {
  final String title;
  final String description;
  final IconData icon;

  OnboardingData({
    required this.title,
    required this.description,
    required this.icon,
  });
}