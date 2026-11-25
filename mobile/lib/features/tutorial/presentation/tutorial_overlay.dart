import 'dart:math' as math;
import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart' as spacing;
import '../../../core/theme/app_text_styles.dart';
import '../models/tutorial_step.dart';

/// Custom painter that draws a dimmed overlay with a spotlight cutout.
///
/// The area outside the cutout is filled with a semi-transparent dark color
/// using [PathFillType.evenOdd]: points inside both the outer screen rect
/// and the inner rounded rect are "outside" the path (not drawn), creating
/// a transparent hole through which the actual target widget shines at full
/// brightness. A highlight border is drawn around the cutout edge.
class _TutorialSpotlightPainter extends CustomPainter {
  /// Rect of the target widget in screen coordinates, or null when no
  /// target is available (full-screen dim, no cutout).
  final Rect? cutout;

  /// Opacity of the dim overlay (0.0 = transparent, 1.0 = opaque).
  final double dimAlpha;

  /// Color of the highlight border around the cutout.
  final Color highlightColor;

  /// Width of the highlight border.
  final double borderWidth;

  /// Corner radius of the cutout and highlight border.
  final double cornerRadius;

  const _TutorialSpotlightPainter({
    this.cutout,
    this.dimAlpha = 0.5,
    this.highlightColor = AppColors.primary,
    this.borderWidth = 3.0,
    this.cornerRadius = 12.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Build a path: full screen rect minus the cutout RRect.
    // evenOdd fill means:
    //  - Outside outer rect: 0 crossings → not drawn
    //  - Inside outer rect, outside inner RRect: 1 crossing → drawn (dim)
    //  - Inside inner RRect: 2 crossings → not drawn (cutout = transparent)
    final path = Path()
      ..addRect(Offset.zero & size)
      ..addRRect(
        RRect.fromRectAndRadius(
          cutout ?? Rect.zero,
          Radius.circular(cornerRadius),
        ),
      )
      ..fillType = PathFillType.evenOdd;

    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.black.withValues(alpha: dimAlpha)
        ..style = PaintingStyle.fill,
    );

    // Draw the highlight border around the cutout edge.
    if (cutout != null && cutout!.width > 0 && cutout!.height > 0) {
      final borderPaint = Paint()
        ..color = highlightColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth;

      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(
            cutout!.left - borderWidth / 2,
            cutout!.top - borderWidth / 2,
            cutout!.width + borderWidth,
            cutout!.height + borderWidth,
          ),
          Radius.circular(cornerRadius),
        ),
        borderPaint,
      );
    }
  }

  @override
  bool shouldRepaint(_TutorialSpotlightPainter old) =>
      old.cutout != cutout ||
      old.dimAlpha != dimAlpha ||
      old.highlightColor != highlightColor ||
      old.borderWidth != borderWidth ||
      old.cornerRadius != cornerRadius;
}

/// Resolves the live BuildContext of a tutorial target at measurement time.
typedef TutorialTargetResolver = BuildContext? Function(TutorialTarget target);

/// Interactive coach-mark overlay: dimmed backdrop, spotlight cutout around a
/// real widget, and an instructional tooltip card placed next to the target.
class TutorialOverlay extends StatefulWidget {
  /// The step currently being shown.
  final TutorialStep step;

  /// Looks up a target's CURRENT BuildContext when measuring. This is a lookup
  /// callback, not a Map snapshot, because contexts are captured in post-frame
  /// callbacks and a map built during build() would be stale.
  final TutorialTargetResolver targetContextFor;

  final VoidCallback onNext;
  final VoidCallback onPrevious;
  final VoidCallback onSkip;
  final VoidCallback onFinish;
  final ValueChanged<int> onTabChanged;
  final bool reducedMotion;

  const TutorialOverlay({
    super.key,
    required this.step,
    required this.targetContextFor,
    required this.onNext,
    required this.onPrevious,
    required this.onSkip,
    required this.onFinish,
    required this.onTabChanged,
    this.reducedMotion = false,
  });

  @override
  State<TutorialOverlay> createState() => _TutorialOverlayState();
}

class _TutorialOverlayState extends State<TutorialOverlay>
    with WidgetsBindingObserver {
  Rect? _targetRect;
  bool _positionComputed = false;
  int _retryCount = 0;

  /// Contexts are captured by post-frame callbacks in HomePage, so they can be
  /// a few frames late right after a tab switch (~12 frames is ~200ms).
  static const int _maxRetries = 12;

  /// Extra room around the target so the highlight does not touch it.
  static const double _spotlightPadding = 6.0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _scheduleMeasure();
  }

  @override
  void didUpdateWidget(TutorialOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.step != widget.step) {
      _positionComputed = false;
      _retryCount = 0;
      _scheduleMeasure();
    }
  }

  @override
  void didChangeMetrics() {
    super.didChangeMetrics();
    _scheduleMeasure();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _scheduleMeasure() {
    WidgetsBinding.instance.addPostFrameCallback(_measureTarget);
    // addPostFrameCallback does NOT schedule a frame by itself.
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  void _measureTarget(Duration _) {
    if (!mounted) return;
    final step = widget.step;
    final targetContext = widget.targetContextFor(step.target);
    final renderObject = (targetContext != null && targetContext.mounted)
        ? targetContext.findRenderObject()
        : null;

    if (renderObject is! RenderBox ||
        !renderObject.attached ||
        !renderObject.hasSize ||
        renderObject.size.isEmpty) {
      if (_retryCount < _maxRetries) {
        _retryCount++;
        _scheduleMeasure();
        return;
      }
      debugPrint(
        'TUTORIAL: target ${step.target} (${step.title}) not measurable '
        'after $_maxRetries retries. Using centered fallback without spotlight.',
      );
      setState(() {
        _targetRect = null;
        _positionComputed = true;
      });
      return;
    }

    final overlayBox = context.findRenderObject();
    final origin = renderObject.localToGlobal(
      Offset.zero,
      ancestor: overlayBox is RenderBox ? overlayBox : null,
    );
    setState(() {
      _targetRect = (origin & renderObject.size).inflate(_spotlightPadding);
      _positionComputed = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final step = widget.step;
    final index = tutorialSteps.indexOf(step);
    return Stack(
      children: [
        const SizedBox.expand(),
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () {}, // swallow taps on the dimmed backdrop
            child: CustomPaint(
              painter: _TutorialSpotlightPainter(
                cutout: _targetRect,
                dimAlpha: 0.5,
                highlightColor: AppColors.primary,
                borderWidth: 3.0,
                cornerRadius: spacing.AppSpacing.radiusLg + 6,
              ),
            ),
          ),
        ),
        if (_positionComputed)
          Positioned.fill(
            child: CustomSingleChildLayout(
              delegate: _TooltipLayoutDelegate(
                target: _targetRect,
                padding: MediaQuery.paddingOf(context),
              ),
              child: _TooltipCard(
                key: const ValueKey('tutorial_tooltip_card'),
                step: step,
                currentStep: index + 1,
                totalSteps: tutorialSteps.length,
                isFirstStep: step == tutorialSteps.first,
                isLastStep: step == tutorialSteps.last,
                onNext: widget.onNext,
                onPrevious: widget.onPrevious,
                onSkip: widget.onSkip,
                onFinish: widget.onFinish,
              ),
            ),
          ),
      ],
    );
  }
}

enum _Placement { below, above, center }

class _Band {
  const _Band(this.top, this.bottom, this.placement);
  final double top;
  final double bottom;
  final _Placement placement;
  double get height => math.max(0.0, bottom - top);
}

/// Lays the tooltip out using its REAL size. It never overlaps the target and
/// never leaves the safe area. Targets in the top half get the card below
/// them; targets in the bottom half get it above. With no target the card is
/// centered vertically.
class _TooltipLayoutDelegate extends SingleChildLayoutDelegate {
  const _TooltipLayoutDelegate({required this.target, required this.padding});

  final Rect? target;
  final EdgeInsets padding;

  static const double margin = 16.0;
  static const double gap = 12.0;
  static const double maxWidth = 600.0;
  static const double minUsableHeight = 180.0;

  _Band _band(Size screen) {
    final safeTop = padding.top + margin;
    final safeBottom = screen.height - padding.bottom - margin;
    final t = target;
    if (t == null) return _Band(safeTop, safeBottom, _Placement.center);

    final below = _Band(
        math.max(safeTop, t.bottom + gap), safeBottom, _Placement.below);
    final above = _Band(
        safeTop, math.min(safeBottom, t.top - gap), _Placement.above);

    final preferBelow = t.center.dy < screen.height / 2;
    if (preferBelow) {
      return (below.height >= minUsableHeight || below.height >= above.height)
          ? below
          : above;
    }
    return (above.height >= minUsableHeight || above.height >= below.height)
        ? above
        : below;
  }

  @override
  BoxConstraints getConstraintsForChild(BoxConstraints constraints) {
    final screen = constraints.biggest;
    final band = _band(screen);
    final width = math.min(maxWidth, math.max(0.0, screen.width - 2 * margin));
    return BoxConstraints(
      minWidth: width,
      maxWidth: width,
      maxHeight: band.height,
    );
  }

  @override
  Offset getPositionForChild(Size size, Size childSize) {
    final band = _band(size);
    final x = (size.width - childSize.width) / 2;
    final y = switch (band.placement) {
      _Placement.below => band.top,
      _Placement.above => band.bottom - childSize.height,
      _Placement.center => band.top + (band.height - childSize.height) / 2,
    };
    return Offset(x, y);
  }

  @override
  bool shouldRelayout(_TooltipLayoutDelegate old) =>
      old.target != target || old.padding != padding;
}

/// Instructional tooltip card. Text scrolls if space is tight; the button row
/// is always fully visible.
class _TooltipCard extends StatelessWidget {
  final TutorialStep step;
  final int currentStep;
  final int totalSteps;
  final bool isFirstStep;
  final bool isLastStep;
  final VoidCallback onNext;
  final VoidCallback onPrevious;
  final VoidCallback onSkip;
  final VoidCallback onFinish;

  const _TooltipCard({
    Key? key,
    required this.step,
    required this.currentStep,
    required this.totalSteps,
    required this.isFirstStep,
    required this.isLastStep,
    required this.onNext,
    required this.onPrevious,
    required this.onSkip,
    required this.onFinish,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      key: const ValueKey('tutorial_tooltip_card'),
      label:
          '${step.title}. ${step.description} Step $currentStep of $totalSteps.',
      child: Container(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
        decoration: BoxDecoration(
          color: AppColors.surfaceLowest,
          borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
          border: Border.all(color: AppColors.outlineVariant),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Step $currentStep of $totalSteps',
                      style: AppTextStyles.labelSm.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterSm),
                    Text(
                      step.title,
                      style: AppTextStyles.headlineSm.copyWith(
                        color: AppColors.brandNavy,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: spacing.AppSpacing.gutterSm),
                    Text(
                      step.description,
                      style: AppTextStyles.bodyMd.copyWith(
                        color: AppColors.onSurface,
                        height: 1.43,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            _TooltipButtons(
              isFirstStep: isFirstStep,
              isLastStep: isLastStep,
              onPrevious: onPrevious,
              onSkip: onSkip,
              onNext: onNext,
              onFinish: onFinish,
            ),
          ],
        ),
      ),
    );
  }
}

/// One compact row at every width: Previous | Skip | Next/Finish.
/// Uses plain Material buttons with explicit styles (not PrimaryButton or
/// SecondaryButton) so nothing can expand to full width.
class _TooltipButtons extends StatelessWidget {
  final bool isFirstStep;
  final bool isLastStep;
  final VoidCallback onPrevious;
  final VoidCallback onSkip;
  final VoidCallback onNext;
  final VoidCallback onFinish;

  const _TooltipButtons({
    required this.isFirstStep,
    required this.isLastStep,
    required this.onPrevious,
    required this.onSkip,
    required this.onNext,
    required this.onFinish,
  });

  Widget _label(String text) => FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(text, maxLines: 1),
      );

  @override
  Widget build(BuildContext context) {
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
    );
    const minSize = Size(0, 44);
    const pad = EdgeInsets.symmetric(horizontal: 8);

    final outlined = OutlinedButton.styleFrom(
      minimumSize: minSize,
      padding: pad,
      foregroundColor: AppColors.primary,
      side: const BorderSide(color: AppColors.primary, width: 1.5),
      shape: shape,
    );
    final filled = FilledButton.styleFrom(
      minimumSize: minSize,
      padding: pad,
      backgroundColor: AppColors.primary,
      foregroundColor: Colors.white,
      shape: shape,
    );

    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            style: outlined,
            onPressed: isFirstStep ? null : onPrevious,
            child: _label('Previous'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: OutlinedButton(
            style: outlined,
            onPressed: onSkip,
            child: _label('Skip'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: FilledButton(
            style: filled,
            onPressed: isLastStep ? onFinish : onNext,
            child: _label(
              isLastStep ? TutorialCompletionStep.buttonLabel : 'Next',
            ),
          ),
        ),
      ],
    );
  }
}
