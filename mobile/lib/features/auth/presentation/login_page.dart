import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/push_notification_service.dart';
import '../../../core/models/user.dart';
import '../../../app/app.dart' show MyApp;

// Interface for dependency injection (test seam)
// Exported for use in widget tests
abstract class LoginService {
  Future<Map<String, dynamic>> login(String email, String password);
}

// Adapter to make ApiService compatible with LoginService
class _ApiServiceLoginAdapter implements LoginService {
  final ApiService _apiService = ApiService();

  @override
  Future<Map<String, dynamic>> login(String email, String password) {
    return _apiService.login(email, password);
  }
}

class LoginPage extends StatefulWidget {
  final LoginService? loginService;

  const LoginPage({super.key, this.loginService});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocusNode = FocusNode();

  bool _isLoading = false;
  bool _isSuccess = false;
  String? _errorMessage;

  LoginService get _loginService =>
      widget.loginService ?? _ApiServiceLoginAdapter();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _passwordFocusNode.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    // Dismiss the keyboard for a cleaner transition into the loading state.
    FocusScope.of(context).unfocus();

    if (_errorMessage != null) {
      setState(() {
        _errorMessage = null;
      });
    }

    if (_formKey.currentState?.validate() ?? false) {
      setState(() {
        _isLoading = true;
        _isSuccess = false;
      });

      try {
        final email = _emailController.text.trim();
        final password = _passwordController.text;

        final response = await _loginService.login(email, password);

        if (mounted) {
          if (response['success'] == true) {
            final data = response['data'];

            // Secretary 2FA (when enabled) requires a login OTP that is
            // completed on the web dashboard; the mobile app keeps the shared
            // username/password login as required.
            if (data is Map && data['requiresOtp'] == true) {
              setState(() {
                _isLoading = false;
                _errorMessage =
                    'Two-factor authentication is required. Please complete sign-in on the web dashboard.';
              });
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(_errorMessage!),
                  backgroundColor: AppColors.error,
                  duration: const Duration(seconds: 4),
                  behavior: SnackBarBehavior.floating,
                ),
              );
              return;
            }

            if (data is! Map || data['user'] == null) {
              setState(() {
                _isLoading = false;
                _errorMessage = 'Login failed. Please try again.';
              });
              return;
            }

            // Parse user data from response
            final userData = data['user'];
            final user = User.fromJson(Map<String, dynamic>.from(userData));

            // Persist the authenticated role so route guards and restored
            // sessions can distinguish patients from secretaries.
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('user_role', user.role);

            // Persist mustChangePassword flag
            if (user.mustChangePassword) {
              await prefs.setBool('must_change_password', true);
            } else {
              // Explicitly clear any stale persisted requirement
              await prefs.remove('must_change_password');
            }

            // Update cached app state for route guards
            MyApp.appStateKey.currentState?.updateAuthState(
              true, // authenticated
              user.mustChangePassword,
              user.role,
            );

            if (!mounted) return;

            // Register this device for push notifications now that the user is
            // authenticated (best-effort, never blocks navigation).
            unawaited(PushNotificationService.instance.registerForCurrentUser());

            // Brief success feedback before navigating away.
            setState(() {
              _isLoading = false;
              _isSuccess = true;
            });

            await Future.delayed(const Duration(milliseconds: 450));

            if (!mounted) return;

            // Check if user must change password
            if (user.mustChangePassword) {
              // Navigate to change password page
              Navigator.of(context).pushReplacementNamed('/change-password');
            } else if (user.role == 'SECRETARY') {
              // Secretaries land on the shared chat-first home
              Navigator.of(context).pushReplacementNamed('/secretary-home');
            } else {
              // Navigate to home screen for normal patient login
              Navigator.of(context).pushReplacementNamed('/home');
            }
          } else {
            // Show error message from backend
            final message =
                response['error']?['message'] ?? 'Login failed';
            setState(() {
              _isLoading = false;
              _errorMessage = message;
            });
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(message),
                backgroundColor: AppColors.error,
                duration: const Duration(seconds: 3),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage =
                'Login failed. Please check your connection and try again.';
          });

          // Show error message for network/error
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'Login failed. Please check your connection and try again.',
              ),
              backgroundColor: AppColors.error,
              duration: Duration(seconds: 3),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.brandBgLight,
      body: Stack(
        children: [
          _buildBackground(),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.screenPadding + AppSpacing.gutterXs,
                    AppSpacing.gutterSm,
                    AppSpacing.screenPadding + AppSpacing.gutterXs,
                    AppSpacing.gutter2xl,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      // Guard against a zero-sized first layout pass (Android
                      // reports a 0x0 viewport before the surface is ready),
                      // which would otherwise produce an invalid negative
                      // minHeight and break the whole frame's layout.
                      minHeight: math.max(
                        0.0,
                        constraints.maxHeight - AppSpacing.gutter2xl,
                      ),
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 460),
                        child: Form(
                          key: _formKey,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              _buildTopBar(),
                              const SizedBox(height: AppSpacing.gutterLg),
                              _buildBrandMark(),
                              const SizedBox(height: AppSpacing.gutterXl),
                              _buildWelcomeHeader(),
                              const SizedBox(height: AppSpacing.gutterLg),
                              _buildFormCard(),
                              const SizedBox(height: AppSpacing.gutterLg),
                              _buildSignUpLink(),
                              const SizedBox(height: AppSpacing.gutterXl),
                              _buildTrustFooter(),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Background decoration
  // ---------------------------------------------------------------------------

  Widget _buildBackground() {
    return Positioned.fill(
      child: IgnorePointer(
        child: Stack(
          children: [
            const ColoredBox(color: AppColors.brandBgLight),
            Positioned(
              top: -130,
              right: -100,
              child: _softBlob(
                size: 320,
                color: AppColors.brandAccentBlue.withValues(alpha: 0.14),
              ),
            ),
            Positioned(
              bottom: -150,
              left: -120,
              child: _softBlob(
                size: 340,
                color: AppColors.medicalTeal.withValues(alpha: 0.12),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _softBlob({required double size, required Color color}) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [color, color.withValues(alpha: 0.0)],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Top bar
  // ---------------------------------------------------------------------------

  Widget _buildTopBar() {
    // Only show a back affordance when this page was pushed onto the stack.
    if (!Navigator.of(context).canPop()) {
      return const SizedBox(height: AppSpacing.gutterSm);
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.surfaceLowest,
          shape: BoxShape.circle,
          border: Border.all(
            color: AppColors.slate200.withValues(alpha: 0.8),
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.brandNavy.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          tooltip: 'Back',
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          color: AppColors.brandNavy,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Branding
  // ---------------------------------------------------------------------------

  Widget _buildBrandMark() {
    return SizedBox(
      width: double.infinity,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Image.asset(
          'assets/images/findmydoctor_logo.png',
          height: 80,
          fit: BoxFit.contain,
        ),
      ),
    );
  }

  Widget _buildWelcomeHeader() {
    return Column(
      children: [
        Text(
          'Welcome Back',
          textAlign: TextAlign.center,
          style: AppTextStyles.headlineLg.copyWith(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: AppColors.brandNavy,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterSm),
        Text(
          'Log in to your account to continue.',
          textAlign: TextAlign.center,
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.slate500,
            height: 1.5,
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------

  Widget _buildFormCard() {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.gutterLg + 2),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(AppSpacing.radius2xl),
        border: Border.all(
          color: AppColors.slate200.withValues(alpha: 0.7),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.brandNavy.withValues(alpha: 0.07),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildLoginForm(),
          const SizedBox(height: AppSpacing.gutterXs),
          _buildForgotPassword(),
          const SizedBox(height: AppSpacing.gutterMd),
          _buildErrorBanner(),
          _buildLoginButton(),
        ],
      ),
    );
  }

  Widget _buildLoginForm() {
    return Column(
      children: [
        CustomTextField(
          label: 'Email or Username',
          hint: 'Enter your email or username',
          controller: _emailController,
          keyboardType: TextInputType.text,
          textInputAction: TextInputAction.next,
          prefixIcon: Icons.person_outline,
          enabled: !_isLoading,
          borderRadius: AppSpacing.radiusXl,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter your email or username';
            }
            return null;
          },
        ),
        const SizedBox(height: AppSpacing.gutterMd + 2),
        CustomTextField(
          label: 'Password',
          hint: 'Enter your password',
          controller: _passwordController,
          obscureText: true,
          enablePasswordToggle: true,
          prefixIcon: Icons.lock_outlined,
          focusNode: _passwordFocusNode,
          enabled: !_isLoading,
          borderRadius: AppSpacing.radiusXl,
          onSubmitted: (_) => _handleLogin(),
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter your password';
            }
            if (value.length < 6) {
              return 'Password must be at least 6 characters';
            }
            return null;
          },
        ),
      ],
    );
  }

  Widget _buildForgotPassword() {
    return Align(
      alignment: Alignment.centerRight,
      child: TextButton(
        onPressed: () {
          // Handle forgot password
        },
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.gutterSm,
            vertical: AppSpacing.gutterXs,
          ),
          minimumSize: const Size(0, 44),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          foregroundColor: AppColors.brandPrimary,
        ),
        child: Text(
          'Forgot Password?',
          style: AppTextStyles.labelMd.copyWith(
            color: AppColors.brandPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }

  Widget _buildErrorBanner() {
    return AnimatedSize(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      child: _errorMessage == null
          ? const SizedBox(width: double.infinity)
          : Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.gutterMd),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.gutterMd,
                  vertical: AppSpacing.gutterMd,
                ),
                decoration: BoxDecoration(
                  color: AppColors.errorContainer.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                  border: Border.all(
                    color: AppColors.error.withValues(alpha: 0.35),
                  ),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.error_outline,
                      color: AppColors.error,
                      size: AppSpacing.iconMd,
                    ),
                    const SizedBox(width: AppSpacing.gutterSm),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: AppTextStyles.bodySm.copyWith(
                          color: AppColors.onErrorContainer,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildLoginButton() {
    final Color buttonColor = _isSuccess
        ? AppColors.brandTealBadge
        : AppColors.brandPrimary;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        boxShadow: [
          BoxShadow(
            color: buttonColor.withValues(alpha: 0.30),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: PrimaryButton(
        text: _isSuccess ? 'Signed In' : 'Log In',
        onPressed: _handleLogin,
        isLoading: _isLoading,
        backgroundColor: buttonColor,
        icon: Icon(
          _isSuccess ? Icons.check_circle_outline : Icons.login,
          size: 20,
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  Widget _buildSignUpLink() {
    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Flexible(
            child: Text(
              "Don't have an account?",
              style: AppTextStyles.bodyMd.copyWith(color: AppColors.slate500),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pushNamed('/signup');
            },
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutterSm,
              ),
              minimumSize: const Size(0, AppSpacing.touchTarget),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              foregroundColor: AppColors.brandPrimary,
            ),
            child: Text(
              'Sign Up',
              style: AppTextStyles.bodyMd.copyWith(
                color: AppColors.brandPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTrustFooter() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(
          Icons.lock_outline,
          size: 14,
          color: AppColors.slate400,
        ),
        const SizedBox(width: AppSpacing.gutterSm),
        Flexible(
          child: Text(
            'Your information is kept secure and private.',
            textAlign: TextAlign.center,
            style: AppTextStyles.bodySm.copyWith(color: AppColors.slate400),
          ),
        ),
      ],
    );
  }
}
