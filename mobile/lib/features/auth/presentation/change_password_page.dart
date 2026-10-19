import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import '../../../app/app.dart' show MyApp;
import 'onboarding_page.dart';

// Interface for dependency injection
abstract class PasswordChangeService {
  Future<Map<String, dynamic>> changePassword(
    String? currentPassword,
    String newPassword,
  );
}

// Adapter to make ApiService compatible with PasswordChangeService
class _ApiServiceAdapter implements PasswordChangeService {
  final ApiService _apiService = ApiService();

  @override
  Future<Map<String, dynamic>> changePassword(
    String? currentPassword,
    String newPassword,
  ) {
    return _apiService.changePassword(currentPassword, newPassword);
  }
}

class ChangePasswordPage extends StatefulWidget {
  final VoidCallback? onSuccess;
  final PasswordChangeService? passwordChangeService;

  const ChangePasswordPage({
    super.key,
    this.onSuccess,
    this.passwordChangeService,
  });

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  bool _isSubmitting = false;
  bool _isRequiredChange = false;

  PasswordChangeService get _passwordChangeService =>
      widget.passwordChangeService ?? _ApiServiceAdapter();

  @override
  void initState() {
    super.initState();
    _checkIfRequiredChange();
  }

  Future<void> _checkIfRequiredChange() async {
    final prefs = await SharedPreferences.getInstance();
    final mustChangePassword = prefs.getBool('must_change_password') ?? false;
    if (mounted) {
      setState(() {
        _isRequiredChange = mustChangePassword;
      });
    }
  }

  @override
  void dispose() {
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleChangePassword() async {
    // Early guard to prevent duplicate submissions
    if (_isSubmitting) {
      return;
    }

    if (_formKey.currentState?.validate() ?? false) {
      setState(() {
        _isSubmitting = true;
        _isLoading = true;
      });

      try {
        // Only send currentPassword if this is not a required change (walk-in first login)
        final currentPassword = _isRequiredChange ? null : _currentPasswordController.text;
        final newPassword = _newPasswordController.text;

        final response = await _passwordChangeService.changePassword(
          currentPassword,
          newPassword,
        );

        if (mounted) {
          setState(() {
            _isSubmitting = false;
            _isLoading = false;
          });

          if (response['success'] == true) {
            // Clear the must_change_password flag from storage
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove('must_change_password');
            final role = prefs.getString('user_role');

            // Update cached app state for route guards
            MyApp.appStateKey.currentState?.clearPasswordChangeRequirement();

            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Password changed successfully'),
                  backgroundColor: AppColors.brandTealBadge,
                  duration: Duration(seconds: 3),
                ),
              );

              if (role == 'SECRETARY') {
                // Secretaries land on the chat-first secretary home
                Navigator.of(context).pushNamedAndRemoveUntil(
                  '/secretary-home',
                  (route) => false,
                );
              } else if (_isRequiredChange) {
                // Walk-in first login - show onboarding
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (context) => const OnboardingPage(forceShow: true),
                  ),
                  (route) => false,
                );
              } else {
                // Regular password change - use callback or go to home
                if (widget.onSuccess != null) {
                  widget.onSuccess!();
                } else {
                  // Default navigation to home screen
                  Navigator.of(context).pushReplacementNamed('/home');
                }
              }
            }
          } else {
            // Show error message from backend
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  response['error']?['message'] ?? 'Password change failed',
                ),
                backgroundColor: AppColors.error,
                duration: const Duration(seconds: 3),
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isSubmitting = false;
            _isLoading = false;
          });

          String errorMessage = 'Password change failed. Please try again.';
          String errorString = e.toString();

          if (errorString.contains('INVALID_CREDENTIALS') ||
              errorString.contains('401')) {
            errorMessage = 'Current password is incorrect';
          } else if (errorString.contains('Connection refused') ||
              errorString.contains('Failed host lookup')) {
            errorMessage =
                'Cannot connect to server. Please check your connection.';
          } else if (errorString.contains('timeout')) {
            errorMessage = 'Request timed out. Please try again.';
          } else if (errorString.contains('401') ||
              errorString.contains('Unauthorized')) {
            errorMessage = 'Session expired. Please log in again.';
          } else if (errorString.contains('500')) {
            errorMessage = 'Server error. Please try again later.';
          } else if (errorString.length < 100) {
            errorMessage = errorString;
          }

          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMessage),
              backgroundColor: AppColors.error,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_isRequiredChange,
      child: Scaffold(
        backgroundColor: AppColors.brandBgLight,
        body: SafeArea(
          child: SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.screenPadding),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.gutterMd),
                    // Back button - disabled if this is a required password change
                    Opacity(
                      opacity: _isRequiredChange ? 0.3 : 1.0,
                      child: IconButton(
                        onPressed: _isRequiredChange
                            ? null
                            : () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.arrow_back_ios_new),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.gutterLg),

                    // Brand Header
                    _buildBrandHeader(),
                    const SizedBox(height: AppSpacing.gutter3xl),

                    // Page Header
                    _buildPageHeader(),
                    const SizedBox(height: AppSpacing.gutterLg),

                    // Change Password Form
                    _buildChangePasswordForm(),
                    const SizedBox(height: AppSpacing.gutterLg),

                    // Change Password Button
                    PrimaryButton(
                      text: 'Change Password',
                      onPressed: _isLoading ? null : _handleChangePassword,
                      isLoading: _isLoading,
                      icon: const Icon(Icons.lock_reset, size: 20),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Image.asset(
      'assets/images/findmydoctor_logo.png',
      height: 60,
      fit: BoxFit.contain,
    );
  }

  Widget _buildPageHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Change Password',
          style: AppTextStyles.headlineLg.copyWith(
            fontSize: 26,
            color: AppColors.brandNavy,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Text(
          _isRequiredChange
              ? 'Create your new password to continue.'
              : 'Enter your current password and create a new one.',
          style: AppTextStyles.bodyMd.copyWith(color: AppColors.slate500),
        ),
      ],
    );
  }

  Widget _buildChangePasswordForm() {
    return Column(
      children: [
        // Only show current password field if this is not a required change (walk-in first login)
        if (!_isRequiredChange) ...[
          CustomTextField(
            label: 'Current Password',
            hint: 'Enter your current password',
            controller: _currentPasswordController,
            obscureText: true,
            enablePasswordToggle: true,
            prefixIcon: Icons.lock_outlined,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Please enter your current password';
              }
              return null;
            },
          ),
          const SizedBox(height: AppSpacing.gutterMd),
        ],
        CustomTextField(
          label: 'New Password',
          hint: 'Enter your new password (min. 8 characters)',
          controller: _newPasswordController,
          obscureText: true,
          enablePasswordToggle: true,
          prefixIcon: Icons.lock_outlined,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter your new password';
            }
            if (value.length < 8) {
              return 'New password must be at least 8 characters';
            }
            return null;
          },
        ),
        const SizedBox(height: AppSpacing.gutterMd),
        CustomTextField(
          label: 'Confirm New Password',
          hint: 'Confirm your new password',
          controller: _confirmPasswordController,
          obscureText: true,
          enablePasswordToggle: true,
          prefixIcon: Icons.lock_outlined,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please confirm your new password';
            }
            if (value != _newPasswordController.text) {
              return 'Passwords do not match';
            }
            return null;
          },
        ),
      ],
    );
  }
}
