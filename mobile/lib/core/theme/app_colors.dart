import 'package:flutter/material.dart';

class AppColors {
  // Primary Colors
  static const Color primary = Color(0xFF006591);
  static const Color primaryContainer = Color(0xFF0EA5E9);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer = Color(0xFF003751);
  static const Color primaryFixed = Color(0xFFC9E6FF);
  static const Color primaryFixedDim = Color(0xFF89CEFF);
  static const Color onPrimaryFixed = Color(0xFF001E2F);
  static const Color onPrimaryFixedVariant = Color(0xFF004C6E);

  // Secondary Colors
  static const Color secondary = Color(0xFF565E74);
  static const Color secondaryContainer = Color(0xFFDAE2FD);
  static const Color onSecondary = Color(0xFFFFFFFF);
  static const Color onSecondaryContainer = Color(0xFF5C647A);
  static const Color secondaryFixed = Color(0xFFDAE2FD);
  static const Color secondaryFixedDim = Color(0xFFBEC6E0);
  static const Color onSecondaryFixed = Color(0xFF131B2E);
  static const Color onSecondaryFixedVariant = Color(0xFF3F465C);

  // Tertiary Colors
  static const Color tertiary = Color(0xFF006B5F);
  static const Color tertiaryContainer = Color(0xFF00AE9D);
  static const Color onTertiary = Color(0xFFFFFFFF);
  static const Color onTertiaryContainer = Color(0xFF003A33);
  static const Color tertiaryFixed = Color(0xFF71F8E4);
  static const Color tertiaryFixedDim = Color(0xFF4FDBC8);
  static const Color onTertiaryFixed = Color(0xFF00201C);
  static const Color onTertiaryFixedVariant = Color(0xFF005048);

  // Surface Colors
  static const Color background = Color(0xFFF8F9FF);
  static const Color onBackground = Color(0xFF0B1C30);
  static const Color surface = Color(0xFFF8F9FF);
  static const Color onSurface = Color(0xFF0B1C30);
  static const Color surfaceVariant = Color(0xFFD3E4FE);
  static const Color onSurfaceVariant = Color(0xFF3E4850);
  static const Color surfaceDim = Color(0xFFCBDBF5);
  static const Color surfaceBright = Color(0xFFF8F9FF);
  static const Color surfaceLowest = Color(0xFFFFFFFF);
  static const Color surfaceLow = Color(0xFFEFF4FF);
  static const Color surfaceContainer = Color(0xFFE5EEFF);
  static const Color surfaceContainerHigh = Color(0xFFDCE9FF);
  static const Color surfaceContainerHighest = Color(0xFFD3E4FE);
  static const Color surfaceContainerLowest = Color(0xFFFFFFFF);
  static const Color surfaceTint = Color(0xFF006591);

  // Inverse Colors
  static const Color inverseSurface = Color(0xFF213145);
  static const Color inverseOnSurface = Color(0xFFEAF1FF);
  static const Color inversePrimary = Color(0xFF89CEFF);

  // Error Colors
  static const Color error = Color(0xFFBA1A1A);
  static const Color onError = Color(0xFFFFFFFF);
  static const Color errorContainer = Color(0xFFFFDAD6);
  static const Color onErrorContainer = Color(0xFF93000A);

  // Outline Colors
  static const Color outline = Color(0xFF6E7881);
  static const Color outlineVariant = Color(0xFFBEC8D2);

  // Status Colors — semantic tokens for success, warning, and
  // appointment/queue status indicators. Use these instead of raw hex
  // values or ad-hoc color picks.
  static const Color statusSuccess = Color(0xFF059669);
  static const Color statusSuccessContainer = Color(0xFFECFDF5);
  static const Color statusSuccessBorder = Color(0xFFA7F3D0);
  static const Color statusWarning = Color(0xFFF59E0B);
  static const Color statusError = Color(0xFFDC2626);
  static const Color statusErrorContainer = Color(0xFFFEF2F2);
  static const Color statusErrorBorder = Color(0xFFFECACA);
  static const Color statusInProgress = Color(0xFF9333EA);
  static const Color statusCompleted = Color(0xFF0284C7);

  // Neutral Colors — slate scale used for text, borders, and subtle
  // surfaces where the semantic surface/outline tokens are too coarse.
  static const Color slate50 = Color(0xFFF8FAFC);
  static const Color slate100 = Color(0xFFF1F5F9);
  static const Color slate200 = Color(0xFFE2E8F0);
  static const Color slate300 = Color(0xFFCBD5E1);
  static const Color slate400 = Color(0xFF94A3B8);
  static const Color slate500 = Color(0xFF64748B);
  static const Color slate600 = Color(0xFF475569);
  static const Color slate700 = Color(0xFF334155);
  static const Color slate800 = Color(0xFF1E293B);
  static const Color slate900 = Color(0xFF0F172A);

  // Brand Palette — intentional brand identity colors used by the auth,
  // onboarding, and brand-accent surfaces. Prefer the semantic tokens
  // above for general UI; only use these where the brand look is required.
  static const Color brandNavy = Color(0xFF002B49);
  static const Color brandPrimary = Color(0xFF005B94);
  static const Color brandPrimaryHover = Color(0xFF004C7D);
  static const Color brandTealBadge = Color(0xFF00A86B);
  static const Color medicalTeal = Color(0xFF14B8A6);
  static const Color emergencyCrimson = Color(0xFFEF4444);

  // Legacy aliases — retained for backward compatibility. These are
  // exact duplicates of canonical tokens; prefer the canonical name.
  static const Color brandBgLight = background;
  static const Color brandSoftGray = slate100;
  static const Color brandDark = slate900;
  static const Color deepNavy = slate900;
  static const Color canvasBase = slate50;
  static const Color pureWhite = surfaceLowest;
  static const Color skyBlue = primaryContainer;
  static const Color slateMuted = slate500;
  static const Color urgentAmber = statusWarning;
  static const Color brandTeal = statusSuccess;
  static const Color brandAccentBlue = statusCompleted;
}
