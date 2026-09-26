import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/api_service.dart';
import 'otp_verification_page.dart';

class SignUpPage extends StatefulWidget {
  const SignUpPage({super.key});

  @override
  State<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends State<SignUpPage> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _agreeToTerms = false;

  // Password requirement indicators
  bool _hasMinLength = false;
  bool _hasNumber = false;
  bool _hasUppercase = false;

  // Field validation states
  bool _isFullNameValid = false;
  bool _isEmailValid = false;
  bool _isUsernameValid = false;

  final ApiService _apiService = ApiService();



  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _togglePasswordVisibility() {
    setState(() {
      _obscurePassword = !_obscurePassword;
    });
  }

  void _toggleConfirmPasswordVisibility() {
    setState(() {
      _obscureConfirmPassword = !_obscureConfirmPassword;
    });
  }

  void _validatePassword(String value) {
    setState(() {
      _hasMinLength = value.length >= 8;
      _hasNumber = value.contains(RegExp(r'[0-9]'));
      _hasUppercase = value.contains(RegExp(r'[A-Z]'));
    });
  }

  void _validateFullName(String value) {
    setState(() {
      _isFullNameValid = value.trim().split(' ').length >= 2;
    });
  }

  void _validateEmail(String value) {
    setState(() {
      _isEmailValid = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value);
    });
  }

  void _validateUsername(String value) {
    setState(() {
      _isUsernameValid = value.trim().length >= 3;
    });
  }

  Future<void> _handleSignUp() async {
    if (_formKey.currentState!.validate()) {
      if (!_agreeToTerms) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please agree to the Terms of Service and Privacy Policy'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }

      if (_passwordController.text != _confirmPasswordController.text) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Passwords do not match'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }

      // Validate username is not empty
      if (_usernameController.text.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please enter a username'),
            backgroundColor: AppColors.error,
          ),
        );
        return;
      }

      setState(() {
        _isLoading = true;
      });

      try {
        final fullName = _fullNameController.text.trim();
        final email = _emailController.text.trim();
        final username = _usernameController.text.trim();
        final password = _passwordController.text;
        final confirmPassword = _confirmPasswordController.text;

        // Call the backend API to send OTP
        final response = await _apiService.sendPatientOtp(
          email: email,
          fullName: fullName,
          username: username,
          password: password,
          confirmPassword: confirmPassword,
        );

        if (mounted) {
          setState(() {
            _isLoading = false;
          });

          if (response['success'] == true) {
            // Navigate to OTP verification page
            final nameParts = fullName.split(' ');
            final firstName = nameParts.isNotEmpty ? nameParts[0] : '';
            final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';

            Navigator.of(context).push(
              MaterialPageRoute(
                builder: (context) => OTPVerificationPage(
                  email: email,
                  firstName: firstName,
                  lastName: lastName,
                  username: username,
                  password: password,
                ),
              ),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(response['error']?['message'] ?? 'Failed to send OTP'),
                backgroundColor: AppColors.error,
              ),
            );
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
          String errorMessage = 'An error occurred. Please try again.';
          String errorString = e.toString();
          
          if (errorString.contains('Connection refused') || errorString.contains('Failed host lookup')) {
            errorMessage = 'Cannot connect to server. Please ensure backend is running at http://10.0.2.2:3000';
          } else if (errorString.contains('timeout')) {
            errorMessage = 'Request timed out. Please check your connection.';
          } else if (errorString.contains('409')) {
            errorMessage = 'Email already exists. Please use a different email.';
          } else if (errorString.contains('400')) {
            errorMessage = 'Invalid input. Please check your information.';
          } else if (errorString.contains('500')) {
            errorMessage = 'Server error. Please try again later.';
          } else if (errorString.length < 100) {
            errorMessage = errorString; // Show short error messages
          }
          
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMessage),
              backgroundColor: AppColors.error,
              duration: Duration(seconds: 5),
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
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.surface,
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
                      icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Brand Header
                  _buildBrandHeader(),
                  const SizedBox(height: AppSpacing.gutter3xl),

                  // Sign Up Header
                  _buildSignUpHeader(),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Sign Up Form
                  _buildSignUpForm(),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Create Account Button
                  PrimaryButton(
                    text: 'Create Account',
                    onPressed: _handleSignUp,
                    isLoading: _isLoading,
                    icon: const Icon(Icons.arrow_forward, size: 20),
                  ),
                  const SizedBox(height: AppSpacing.gutterLg),

                  // Login Link
                  _buildLoginLink(),
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
        // Logo with gradient background
        Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.skyBlue,
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

  Widget _buildSignUpHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Create an Account',
          style: AppTextStyles.headlineLg.copyWith(
            fontSize: 28,
            color: AppColors.brandNavy,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Text(
          'Join FindMyDoctor to book clinic appointments and track live queue passes.',
          style: AppTextStyles.bodyMd.copyWith(
            color: AppColors.slate500,
          ),
        ),
      ],
    );
  }

  Widget _buildSignUpForm() {
    return Column(
      children: [
        // Full Name Field
        _buildInputField(
          label: 'Full Name',
          hint: 'e.g. Juan Michael Reyes',
          controller: _fullNameController,
          keyboardType: TextInputType.name,
          icon: Icons.person,
          isValid: _isFullNameValid,
          onChanged: _validateFullName,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter your full name';
            }
            if (value.trim().split(' ').length < 2) {
              return 'Please enter both first and last name';
            }
            return null;
          },
        ),
        const SizedBox(height: AppSpacing.gutterMd),

        // Email Address Field
        _buildInputField(
          label: 'Email Address',
          hint: 'Enter your email',
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          icon: Icons.email_outlined,
          isValid: _isEmailValid,
          onChanged: _validateEmail,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter your email';
            }
            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) {
              return 'Please enter a valid email';
            }
            return null;
          },
        ),
        const SizedBox(height: AppSpacing.gutterMd),

        // Username Field
        _buildInputField(
          label: 'Username',
          hint: 'e.g. juanreyes',
          controller: _usernameController,
          keyboardType: TextInputType.text,
          icon: Icons.badge,
          isValid: _isUsernameValid,
          onChanged: _validateUsername,
          validator: (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter a username';
            }
            if (value.trim().length < 3) {
              return 'Username must be at least 3 characters';
            }
            return null;
          },
        ),
        const SizedBox(height: AppSpacing.gutterMd),

        // Password Field
        _buildPasswordField(),
        const SizedBox(height: AppSpacing.gutterMd),

        // Confirm Password Field
        _buildConfirmPasswordField(),
        const SizedBox(height: AppSpacing.gutterMd),

        // Terms and Privacy Checkbox
        _buildTermsCheckbox(),
      ],
    );
  }

  Widget _buildInputField({
    required String label,
    required String hint,
    required TextEditingController controller,
    required TextInputType keyboardType,
    required IconData icon,
    required bool isValid,
    required Function(String) onChanged,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTextStyles.labelMd.copyWith(
            color: AppColors.brandNavy,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Container(
          decoration: BoxDecoration(
            color: AppColors.slate100.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(
              color: isValid ? AppColors.brandPrimary.withValues(alpha: 0.3) : AppColors.slate200,
            ),
          ),
          child: TextField(
            controller: controller,
            keyboardType: keyboardType,
            onChanged: onChanged,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: AppTextStyles.bodyMd.copyWith(
                color: AppColors.slate400,
                fontSize: 15,
              ),
              prefixIcon: Icon(icon, color: AppColors.slate400, size: 20),
              suffixIcon: isValid
                  ? const Icon(Icons.check_circle, color: AppColors.brandTealBadge, size: 20)
                  : null,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutterMd,
                vertical: AppSpacing.gutterSm,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Password',
          style: AppTextStyles.labelMd.copyWith(
            color: AppColors.brandNavy,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Container(
          decoration: BoxDecoration(
            color: AppColors.slate100.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(color: AppColors.slate200),
          ),
          child: TextField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            onChanged: _validatePassword,
            decoration: InputDecoration(
              hintText: 'Create password (min. 8 characters)',
              hintStyle: AppTextStyles.bodyMd.copyWith(
                color: AppColors.slate400,
                fontSize: 15,
              ),
              prefixIcon: const Icon(Icons.lock_outlined, color: AppColors.slate400, size: 20),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? Icons.visibility_off : Icons.visibility,
                  color: AppColors.slate400,
                  size: 20,
                ),
                onPressed: _togglePasswordVisibility,
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutterMd,
                vertical: AppSpacing.gutterSm,
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.gutterSm),
        // Password requirement pills
        _buildPasswordRequirements(),
      ],
    );
  }

  Widget _buildConfirmPasswordField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Confirm Password',
          style: AppTextStyles.labelMd.copyWith(
            color: AppColors.brandNavy,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Container(
          decoration: BoxDecoration(
            color: AppColors.slate100.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            border: Border.all(color: AppColors.slate200),
          ),
          child: TextField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            decoration: InputDecoration(
              hintText: 'Confirm your password',
              hintStyle: AppTextStyles.bodyMd.copyWith(
                color: AppColors.slate400,
                fontSize: 15,
              ),
              prefixIcon: const Icon(Icons.lock_outlined, color: AppColors.slate400, size: 20),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                  color: AppColors.slate400,
                  size: 20,
                ),
                onPressed: _toggleConfirmPasswordVisibility,
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.gutterMd,
                vertical: AppSpacing.gutterSm,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPasswordRequirements() {
    return Wrap(
      spacing: AppSpacing.gutterSm,
      children: [
        _buildRequirementPill('8+ chars', _hasMinLength),
        _buildRequirementPill('1 number', _hasNumber),
        _buildRequirementPill('1 uppercase', _hasUppercase),
      ],
    );
  }

  Widget _buildRequirementPill(String text, bool isMet) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.gutterSm,
        vertical: 2,
      ),
      decoration: BoxDecoration(
        color: isMet ? AppColors.brandTealBadge.withValues(alpha: 0.1) : AppColors.slate100,
        border: Border.all(
          color: isMet ? AppColors.brandTealBadge.withValues(alpha: 0.6) : AppColors.slate300,
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isMet ? Icons.check : Icons.circle,
            size: 12,
            color: isMet ? AppColors.brandTealBadge : AppColors.slate400,
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: AppTextStyles.labelSm.copyWith(
              color: isMet ? AppColors.brandTealBadge : AppColors.slate600,
              fontWeight: FontWeight.w500,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTermsCheckbox() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.gutterSm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: _agreeToTerms,
            onChanged: (value) {
              setState(() {
                _agreeToTerms = value!;
              });
            },
            activeColor: AppColors.brandPrimary,
          ),
          const SizedBox(width: AppSpacing.gutterMd),
          Expanded(
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _agreeToTerms = !_agreeToTerms;
                });
              },
              child: Text(
                'I agree to FindMyDoctor\'s Terms of Service and Privacy Policy, including Philippine Data Privacy Act compliance.',
                style: AppTextStyles.bodySm.copyWith(
                  color: AppColors.slate600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginLink() {
    return Center(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            "Already have an account? ",
            style: AppTextStyles.bodyMd.copyWith(
              color: AppColors.slate500,
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
            },
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Log In',
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
