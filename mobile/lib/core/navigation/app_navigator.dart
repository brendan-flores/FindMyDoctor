import 'package:flutter/material.dart';

/// Holds the app-level navigator so services outside the widget tree (for
/// example push-notification deep links) can open routes safely.
class AppNavigator {
  AppNavigator._();

  static final GlobalKey<NavigatorState> key = GlobalKey<NavigatorState>();
}
