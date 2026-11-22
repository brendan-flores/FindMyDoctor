import 'package:flutter/material.dart';

/// Holds the app-level navigator so services outside the widget tree (for
/// example push-notification deep links) can open routes safely.
class AppNavigator {
  AppNavigator._();

  static final GlobalKey<NavigatorState> key = GlobalKey<NavigatorState>();

  /// Whether the OS/platform has requested reduced motion. When true, page,
  /// dialog, and bottom-sheet transitions collapse to instant swaps.
  static bool isReducedMotion(BuildContext context) {
    final mediaQuery = MediaQuery.maybeOf(context);
    if (mediaQuery == null) return false;
    return mediaQuery.disableAnimations || mediaQuery.accessibleNavigation;
  }

  /// Consistent timing for modal dialogs: a quick, subtle fade/scale.
  static const AnimationStyle dialogAnimationStyle = AnimationStyle(
    duration: Duration(milliseconds: 200),
    reverseDuration: Duration(milliseconds: 160),
    curve: Curves.easeOutCubic,
    reverseCurve: Curves.easeInCubic,
  );

  /// Consistent timing for modal bottom sheets: slide-up/fade matching the
  /// page-transition feel.
  static const AnimationStyle bottomSheetAnimationStyle = AnimationStyle(
    duration: Duration(milliseconds: 280),
    reverseDuration: Duration(milliseconds: 200),
    curve: Curves.easeOutCubic,
    reverseCurve: Curves.easeInCubic,
  );

  /// Drop-in replacement for [showDialog] that applies the app's consistent
  /// dialog transition and honors reduced-motion preferences.
  ///
  /// Pass [animationStyle] to override the default timing; reduced-motion
  /// users always get an instant transition unless [animationStyle] is
  /// explicitly provided.
  static Future<T?> showAppDialog<T>({
    required BuildContext context,
    required WidgetBuilder builder,
    bool barrierDismissible = true,
    Color? barrierColor,
    String? barrierLabel,
    bool useSafeArea = true,
    bool useRootNavigator = true,
    RouteSettings? routeSettings,
    Offset? anchorPoint,
    TraversalEdgeBehavior? traversalEdgeBehavior,
    bool fullscreenDialog = false,
    bool? requestFocus,
    AnimationStyle? animationStyle,
  }) {
    return showDialog<T>(
      context: context,
      builder: builder,
      barrierDismissible: barrierDismissible,
      barrierColor: barrierColor,
      barrierLabel: barrierLabel,
      useSafeArea: useSafeArea,
      useRootNavigator: useRootNavigator,
      routeSettings: routeSettings,
      anchorPoint: anchorPoint,
      traversalEdgeBehavior: traversalEdgeBehavior,
      fullscreenDialog: fullscreenDialog,
      requestFocus: requestFocus,
      animationStyle:
          animationStyle ??
          (isReducedMotion(context)
              ? AnimationStyle.noAnimation
              : dialogAnimationStyle),
    );
  }

  /// Drop-in replacement for [showModalBottomSheet] that applies the app's
  /// consistent bottom-sheet transition and honors reduced-motion
  /// preferences.
  static Future<T?> showAppModalBottomSheet<T>({
    required BuildContext context,
    required WidgetBuilder builder,
    Color? backgroundColor,
    String? barrierLabel,
    double? elevation,
    ShapeBorder? shape,
    Clip? clipBehavior,
    BoxConstraints? constraints,
    Color? barrierColor,
    bool isScrollControlled = false,
    double scrollControlDisabledMaxHeightRatio = 9.0 / 16.0,
    bool useRootNavigator = false,
    bool isDismissible = true,
    bool enableDrag = true,
    bool? showDragHandle,
    bool useSafeArea = false,
    RouteSettings? routeSettings,
    AnimationController? transitionAnimationController,
    Offset? anchorPoint,
    AnimationStyle? sheetAnimationStyle,
    bool? requestFocus,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      builder: builder,
      backgroundColor: backgroundColor,
      barrierLabel: barrierLabel,
      elevation: elevation,
      shape: shape,
      clipBehavior: clipBehavior,
      constraints: constraints,
      barrierColor: barrierColor,
      isScrollControlled: isScrollControlled,
      scrollControlDisabledMaxHeightRatio: scrollControlDisabledMaxHeightRatio,
      useRootNavigator: useRootNavigator,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      showDragHandle: showDragHandle,
      useSafeArea: useSafeArea,
      routeSettings: routeSettings,
      transitionAnimationController: transitionAnimationController,
      anchorPoint: anchorPoint,
      sheetAnimationStyle:
          sheetAnimationStyle ??
          (isReducedMotion(context)
              ? AnimationStyle.noAnimation
              : bottomSheetAnimationStyle),
      requestFocus: requestFocus,
    );
  }
}

/// A subtle, branded page transition used for every [MaterialPageRoute] in the
/// app via [ThemeData.pageTransitionsTheme]: the incoming page fades in while
/// drifting up a few percent, and the reverse runs on pop. When the platform
/// requests reduced motion the transition is skipped entirely.
class AppPageTransitionsBuilder extends PageTransitionsBuilder {
  const AppPageTransitionsBuilder();

  static const Offset _slideBegin = Offset(0, 0.06);

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (AppNavigator.isReducedMotion(context)) {
      return child;
    }

    final curvedAnimation = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );

    return FadeTransition(
      opacity: curvedAnimation,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: _slideBegin,
          end: Offset.zero,
        ).animate(curvedAnimation),
        child: child,
      ),
    );
  }
}
