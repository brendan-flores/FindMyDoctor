import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_text_styles.dart';
import 'app_spacing.dart';

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.primary,
        brightness: Brightness.light,
        primary: AppColors.primary,
        onPrimary: AppColors.onPrimary,
        primaryContainer: AppColors.primaryContainer,
        onPrimaryContainer: AppColors.onPrimaryContainer,
        secondary: AppColors.secondary,
        onSecondary: AppColors.onSecondary,
        secondaryContainer: AppColors.secondaryContainer,
        onSecondaryContainer: AppColors.onSecondaryContainer,
        tertiary: AppColors.tertiary,
        onTertiary: AppColors.onTertiary,
        tertiaryContainer: AppColors.tertiaryContainer,
        onTertiaryContainer: AppColors.onTertiaryContainer,
        error: AppColors.error,
        onError: AppColors.onError,
        errorContainer: AppColors.errorContainer,
        onErrorContainer: AppColors.onErrorContainer,
        surface: AppColors.surface,
        onSurface: AppColors.onSurface,
        surfaceContainerHighest: AppColors.surfaceVariant,
        onSurfaceVariant: AppColors.onSurfaceVariant,
        outline: AppColors.outline,
        outlineVariant: AppColors.outlineVariant,
      ),
      scaffoldBackgroundColor: AppColors.background,
      fontFamily: AppTextStyles.fontFamily,
      textTheme: TextTheme(
        displayLarge: AppTextStyles.headlineLg,
        displayMedium: AppTextStyles.headlineMd,
        displaySmall: AppTextStyles.headlineSm,
        bodyLarge: AppTextStyles.bodyLg,
        bodyMedium: AppTextStyles.bodyMd,
        bodySmall: AppTextStyles.labelMd,
        labelLarge: AppTextStyles.labelMd,
        labelMedium: AppTextStyles.labelSm,
        labelSmall: AppTextStyles.labelSm,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: AppTextStyles.headlineSm,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surfaceLowest,
        elevation: AppSpacing.elevation1,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        ),
        margin: EdgeInsets.zero,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.onPrimary,
          elevation: AppSpacing.elevation2,
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacing.gutterLg,
            vertical: AppSpacing.gutterMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTextStyles.buttonText,
          minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          side: BorderSide(color: AppColors.primary, width: 1.5),
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacing.gutterLg,
            vertical: AppSpacing.gutterMd,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          ),
          textStyle: AppTextStyles.buttonText,
          minimumSize: Size(double.infinity, AppSpacing.buttonHeight),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: AppTextStyles.labelMd,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceLowest,
        contentPadding: EdgeInsets.symmetric(
          horizontal: AppSpacing.gutterLg,
          vertical: AppSpacing.gutterMd,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(color: AppColors.slate300),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(color: AppColors.slate300),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(color: AppColors.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(color: AppColors.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
          borderSide: BorderSide(color: AppColors.error, width: 2),
        ),
        hintStyle: AppTextStyles.inputPlaceholder,
        labelStyle: AppTextStyles.inputLabel,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: AppColors.surfaceLowest,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.secondary,
        selectedLabelStyle: AppTextStyles.navLabelActive,
        unselectedLabelStyle: AppTextStyles.navLabel,
        type: BottomNavigationBarType.fixed,
        elevation: AppSpacing.elevation2,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.onPrimary,
        elevation: AppSpacing.elevation4,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceLow,
        selectedColor: AppColors.primary,
        labelStyle: AppTextStyles.labelMd,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: AppColors.slate200,
        thickness: 1,
        space: AppSpacing.gutterMd,
      ),
    );
  }
}
