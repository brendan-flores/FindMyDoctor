import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  final _apiService = ApiService();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      try {
        final email = _emailController.text.trim();
        final password = _passwordController.text;

        final response = await _apiService.login(email, password);

        if (mounted) {
          setState(() {
            _isLoading = false;
          });

          if (response['success'] == true) {
            // Navigate to home screen on successful login
            Navigator.of(context).pushReplacementNamed('/home');
          } else {
            // Show error message from backend
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(response['error']['message'] ?? 'Login failed'),
                backgroundColor: AppColors.error,
                duration: Duration(seconds: 3),
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });

          // Show error message for network/error
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Login failed. Please check your connection and try again.'),
              backgroundColor: AppColors.error,
              duration: Duration(seconds: 3),
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
                  // Back button
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.arrow_back_ios_new),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Brand Header
                  _buildBrandHeader(),
                  const SizedBox(height: AppSpacing.gutter3xl),

                  // Welcome Header
                  _buildWelcomeHeader(),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Login Form
                  _buildLoginForm(),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Forgot Password
                  _buildForgotPassword(),
                  const SizedBox(height: AppSpacing.gutterMd),

                  // Login Button
                  PrimaryButton(
                    text: 'Log In',
                    onPressed: _handleLogin,
                    isLoading: _isLoading,
                    icon: const Icon(Icons.arrow_forward, size: 20),
                  ),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Sign Up Link
                  _buildSignUpLink(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBrandHeader() {
    return Row(
      children: [
        // Logo placeholder - replace with actual logo
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.brandAccentBlue,
                AppColors.brandPrimary,
              ],
            ),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary.withValues(alpha: 0.15),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(
            Icons.location_on,
            color: AppColors.onPrimary,
            size: 24,
          ),
        ),
        const SizedBox(width: AppSpacing.gutterMd),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'FindMyDoctor',
              style: AppTextStyles.headlineMd.copyWith(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.brandNavy,
              ),
            ),
            Text(
              'PHILIPPINES',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.brandTealBadge,
                letterSpacing: 0.16,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildWelcomeHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Welcome Back',
          style: AppTextStyles.headlineLg.copyWith(
            fontSize: 26,
            color: AppColors.brandNavy,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Text(
          'Log in to continue to your account.',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.slate500,
          ),
        ),
      ],
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
          prefixIcon: Icons.person_outline,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter your email or username';
            }
            return null;
          },
        ),
        const SizedBox(height: AppSpacing.gutterMd),
        CustomTextField(
          label: 'Password',
          hint: 'Enter your password',
          controller: _passwordController,
          obscureText: true,
          enablePasswordToggle: true,
          prefixIcon: Icons.lock_outlined,
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
          padding: EdgeInsets.zero,
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
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

  Widget _buildSignUpLink() {
    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            "Don't have an account? ",
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.slate500,
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pushNamed('/signup');
            },
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
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
}
