import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/widgets/custom_text_field.dart';
import '../../../core/widgets/primary_button.dart';
import '../../../core/services/auth_service.dart';
import '../../../core/services/api_service.dart';

class SignUpPage extends StatefulWidget {
  const SignUpPage({super.key});

  @override
  State<SignUpPage> createState() => _SignUpPageState();
}

class _SignUpPageState extends State<SignUpPage> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
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

  final AuthService _authService = AuthService();

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
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

  Future<void> _handleSignUp() async {
    print('🔵 Form validation: ${_formKey.currentState!.validate()}');
    
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

      setState(() {
        _isLoading = true;
      });

      try {
        final nameParts = _fullNameController.text.trim().split(' ');
        final firstName = nameParts.isNotEmpty ? nameParts[0] : '';
        final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';

        print('🔵 Starting registration...');
        print('🔵 Email: ${_emailController.text.trim()}');
        print('🔵 First Name: $firstName');
        print('🔵 Last Name: $lastName');
        print('🔵 API Base URL: ${_authService.baseUrl}');

        final response = await _authService.register(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          role: 'PATIENT',
          firstName: firstName,
          lastName: lastName,
        );

        print('🟢 Registration response received: $response');

        if (mounted) {
          setState(() {
            _isLoading = false;
          });

          if (response['success'] == true) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Account created successfully!'),
                backgroundColor: AppColors.medicalTeal,
              ),
            );
            // Navigate to home screen on successful registration
            Navigator.of(context).pushReplacementNamed('/home');
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(response['error']?['message'] ?? 'Registration failed'),
                backgroundColor: AppColors.error,
              ),
            );
          }
        }
      } catch (e) {
        print('🔴 Registration error: $e');
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
              duration: const Duration(seconds: 5),
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
        CustomTextField(
          label: 'Full Name',
          hint: 'e.g. Juan Michael Reyes',
          controller: _fullNameController,
          keyboardType: TextInputType.name,
          prefixIcon: Icons.person,
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
        CustomTextField(
          label: 'Email Address',
          hint: 'Enter your email',
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          prefixIcon: Icons.email_outlined,
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

        // Mobile Number Field with Philippine prefix
        _buildMobileNumberField(),
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

  Widget _buildMobileNumberField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Mobile Number',
              style: AppTextStyles.labelMd.copyWith(
                color: AppColors.brandNavy,
              ),
            ),
            Text(
              'For SMS queue alerts',
              style: AppTextStyles.labelSm.copyWith(
                color: AppColors.slate400,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        Container(
          decoration: BoxDecoration(
            color: AppColors.slate100,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(color: AppColors.slate300),
          ),
          child: Row(
            children: [
              // Philippine flag and country code
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.gutterSm,
                  vertical: AppSpacing.gutterSm,
                ),
                decoration: BoxDecoration(
                  border: const Border(
                    right: BorderSide(color: AppColors.slate300),
                  ),
                ),
                child: Row(
                  children: [
                    const Text('🇵🇭', style: TextStyle(fontSize: 18)),
                    const SizedBox(width: 6),
                    Text(
                      '+63',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.slate700,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    hintText: '917 123 4567',
                    hintStyle: AppTextStyles.bodyMd.copyWith(
                      color: AppColors.slate400,
                    ),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.gutterMd,
                      vertical: AppSpacing.gutterSm,
                    ),
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                ),
              ),
            ],
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
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        TextField(
          controller: _passwordController,
          obscureText: _obscurePassword,
          onChanged: _validatePassword,
          decoration: InputDecoration(
            hintText: 'Create password (min. 8 characters)',
            hintStyle: AppTextStyles.bodyMd.copyWith(
              color: AppColors.slate400,
            ),
            prefixIcon: const Icon(Icons.lock_outlined, color: AppColors.slate400),
            suffixIcon: IconButton(
              icon: Icon(
                _obscurePassword ? Icons.visibility_off : Icons.visibility,
                color: AppColors.slate400,
              ),
              onPressed: _togglePasswordVisibility,
            ),
            filled: true,
            fillColor: AppColors.slate100,
            border: OutlineInputBorder(
              borderSide: BorderSide(color: AppColors.slate300),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.gutterMd,
              vertical: AppSpacing.gutterSm,
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
          ),
        ),
        const SizedBox(height: AppSpacing.gutterXs),
        TextField(
          controller: _confirmPasswordController,
          obscureText: _obscureConfirmPassword,
          decoration: InputDecoration(
            hintText: 'Confirm your password',
            hintStyle: AppTextStyles.bodyMd.copyWith(
              color: AppColors.slate400,
            ),
            prefixIcon: const Icon(Icons.lock_outlined, color: AppColors.slate400),
            suffixIcon: IconButton(
              icon: Icon(
                _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                color: AppColors.slate400,
              ),
              onPressed: _toggleConfirmPasswordVisibility,
            ),
            filled: true,
            fillColor: AppColors.slate100,
            border: OutlineInputBorder(
              borderSide: BorderSide(color: AppColors.slate300),
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.gutterMd,
              vertical: AppSpacing.gutterSm,
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
        color: isMet ? AppColors.brandAccentBlue.withValues(alpha: 0.1) : AppColors.slate100,
        border: Border.all(
          color: isMet ? AppColors.brandPrimary.withValues(alpha: 0.3) : AppColors.slate300,
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isMet ? Icons.check_circle : Icons.circle,
            size: 12,
            color: isMet ? AppColors.brandPrimary : AppColors.slate400,
          ),
          const SizedBox(width: 4),
          Text(
            text,
            style: AppTextStyles.labelSm.copyWith(
              color: isMet ? AppColors.brandPrimary : AppColors.slate600,
              fontWeight: FontWeight.w500,
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
