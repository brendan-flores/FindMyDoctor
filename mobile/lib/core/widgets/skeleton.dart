import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart' as spacing;
import 'app_card.dart';

/// Wraps a subtree in the shared shimmer animation used by all skeleton
/// loaders. Place one [SkeletonScope] around a list of skeleton widgets so the
/// whole group animates in sync.
class SkeletonScope extends StatelessWidget {
  const SkeletonScope({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppColors.slate200,
      highlightColor: AppColors.surfaceLowest,
      child: child,
    );
  }
}

/// A single shimmering rectangle.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({super.key, this.width, this.height, this.borderRadius});

  final double? width;
  final double? height;
  final double? borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(borderRadius ?? 8),
      ),
    );
  }
}

/// A shimmering text-line placeholder.
class SkeletonLine extends StatelessWidget {
  const SkeletonLine({super.key, this.width, this.height = 12});

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(width: width, height: height, borderRadius: height / 2);
  }
}

/// A shimmering circular avatar placeholder.
class SkeletonCircle extends StatelessWidget {
  const SkeletonCircle({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(width: size, height: size, borderRadius: size / 2);
  }
}

/// A shimmering rounded-square placeholder (badges, icon tiles).
class SkeletonTile extends StatelessWidget {
  const SkeletonTile({super.key, this.size = 40, this.borderRadius});

  final double size;
  final double? borderRadius;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(
      width: size,
      height: size,
      borderRadius: borderRadius ?? spacing.AppSpacing.radiusMd,
    );
  }
}

/// Scrollable skeleton list used in place of a `ListView` while data loads.
class SkeletonListView extends StatelessWidget {
  const SkeletonListView({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.padding,
    this.itemSpacing = spacing.AppSpacing.gutterMd,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final EdgeInsetsGeometry? padding;
  final double itemSpacing;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: ListView.separated(
        padding: padding,
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: itemCount,
        separatorBuilder: (_, _) => SizedBox(height: itemSpacing),
        itemBuilder: itemBuilder,
      ),
    );
  }
}

/// Non-scrollable skeleton column for use inside `SliverToBoxAdapter` or
/// `RefreshIndicator` children.
class SkeletonColumn extends StatelessWidget {
  const SkeletonColumn({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.itemSpacing = spacing.AppSpacing.gutterMd,
  });

  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final double itemSpacing;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        children: [
          for (var i = 0; i < itemCount; i++) ...[
            if (i > 0) SizedBox(height: itemSpacing),
            itemBuilder(context, i),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Screen-shaped skeletons
// ---------------------------------------------------------------------------

/// Matches the appointment card on `appointments_page.dart`: status badge,
/// doctor avatar + name/specialty/practice lines, schedule block, action row.
class AppointmentCardSkeleton extends StatelessWidget {
  const AppointmentCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SkeletonBox(
                width: 120,
                height: 24,
                borderRadius: spacing.AppSpacing.radiusFull,
              ),
              SkeletonBox(
                width: 72,
                height: 24,
                borderRadius: spacing.AppSpacing.radiusFull,
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            children: [
              const SkeletonCircle(size: 64),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonLine(width: 160, height: 16),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 120, height: 13),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 140, height: 12),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          SkeletonBox(height: 64, borderRadius: spacing.AppSpacing.radiusLg),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            children: [
              Expanded(
                child: SkeletonBox(
                  height: 44,
                  borderRadius: spacing.AppSpacing.radiusLg,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              const SkeletonTile(size: 44, borderRadius: 12),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              const SkeletonTile(size: 44, borderRadius: 12),
            ],
          ),
        ],
      ),
    );
  }
}

/// Matches the stacked detail sections of `appointment_detail_page.dart`.
class AppointmentDetailSkeleton extends StatelessWidget {
  const AppointmentDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBox(height: 140, borderRadius: spacing.AppSpacing.radiusLg),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _detailCard(
              child: Row(
                children: [
                  const SkeletonCircle(size: 56),
                  const SizedBox(width: spacing.AppSpacing.gutterMd),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        SkeletonLine(width: 140, height: 15),
                        SizedBox(height: spacing.AppSpacing.gutterXs),
                        SkeletonLine(width: 100, height: 12),
                        SizedBox(height: spacing.AppSpacing.gutterXs),
                        SkeletonLine(width: 160, height: 12),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _detailCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  SkeletonLine(width: 90, height: 14),
                  SizedBox(height: spacing.AppSpacing.gutterMd),
                  SkeletonLine(width: double.infinity, height: 14),
                  SizedBox(height: spacing.AppSpacing.gutterSm),
                  SkeletonLine(width: 220, height: 14),
                  SizedBox(height: spacing.AppSpacing.gutterMd),
                  SkeletonLine(width: 80, height: 14),
                  SizedBox(height: spacing.AppSpacing.gutterSm),
                  SkeletonLine(width: double.infinity, height: 14),
                  SizedBox(height: spacing.AppSpacing.gutterSm),
                  SkeletonLine(width: 180, height: 14),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            _detailCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  SkeletonLine(width: 110, height: 14),
                  SizedBox(height: spacing.AppSpacing.gutterMd),
                  SkeletonLine(width: double.infinity, height: 14),
                  SizedBox(height: spacing.AppSpacing.gutterSm),
                  SkeletonLine(width: double.infinity, height: 14),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            SkeletonBox(height: 48, borderRadius: spacing.AppSpacing.radiusLg),
          ],
        ),
      ),
    );
  }

  Widget _detailCard({required Widget child}) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: child,
    );
  }
}

/// Matches `_buildDetailedDoctorCard` on `doctors_page.dart` (also reused in
/// the horizontal "Top Verified Doctors" rail).
class DoctorCardSkeleton extends StatelessWidget {
  const DoctorCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SkeletonCircle(size: 64),
              const SizedBox(width: spacing.AppSpacing.gutterMd),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonLine(width: 180, height: 17),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 120, height: 13),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 150, height: 12),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Row(
            children: const [
              SkeletonBox(width: 90, height: 24, borderRadius: 12),
              SizedBox(width: spacing.AppSpacing.gutterSm),
              SkeletonBox(width: 110, height: 24, borderRadius: 12),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          const SkeletonBox(height: 44, borderRadius: 12),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Row(
            children: [
              Expanded(
                child: SkeletonBox(
                  height: 40,
                  borderRadius: spacing.AppSpacing.radiusLg,
                ),
              ),
              const SizedBox(width: spacing.AppSpacing.gutterSm),
              Expanded(
                child: SkeletonBox(
                  height: 40,
                  borderRadius: spacing.AppSpacing.radiusLg,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Matches the compact doctor row on `home_page.dart` (`_buildDoctorCard`).
class HomeDoctorCardSkeleton extends StatelessWidget {
  const HomeDoctorCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          const SkeletonCircle(size: 48),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonLine(width: 140, height: 14),
                SizedBox(height: spacing.AppSpacing.gutterXs),
                SkeletonLine(width: 170, height: 11),
                SizedBox(height: spacing.AppSpacing.gutterXs),
                SkeletonLine(width: 80, height: 11),
              ],
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          SkeletonBox(
            width: 60,
            height: 30,
            borderRadius: spacing.AppSpacing.radiusMd,
          ),
        ],
      ),
    );
  }
}

/// Matches `_buildClinicCard` on `home_page.dart` (nearby clinics list).
class ClinicCardSkeleton extends StatelessWidget {
  const ClinicCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          const SkeletonTile(size: 40),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonLine(width: 160, height: 14),
                SizedBox(height: spacing.AppSpacing.gutterXs),
                SkeletonLine(width: 80, height: 11),
              ],
            ),
          ),
          SkeletonBox(
            width: 32,
            height: 24,
            borderRadius: spacing.AppSpacing.radiusFull,
          ),
        ],
      ),
    );
  }
}

/// Matches `_buildHospitalCard` on `doctors_page.dart` (horizontal hospital
/// rail).
class HospitalCardSkeleton extends StatelessWidget {
  const HospitalCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 256,
      height: 240,
      margin: EdgeInsets.only(right: spacing.AppSpacing.gutterSm),
      decoration: BoxDecoration(
        color: AppColors.surfaceLowest,
        borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusXl),
        border: Border.all(color: AppColors.slate200),
      ),
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 3,
            child: SkeletonBox(
              width: double.infinity,
              borderRadius: spacing.AppSpacing.radiusLg,
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          const SkeletonLine(width: 140, height: 13),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
          const SkeletonLine(width: 100, height: 11),
          const SizedBox(height: spacing.AppSpacing.gutterXs),
          const SkeletonLine(width: 70, height: 11),
        ],
      ),
    );
  }
}

/// Matches the conversation list rows used by `secretary_home_page.dart` and
/// the patient Chat tab (`ChatTabContent` in `home_page.dart`): rounded
/// avatar, name + preview lines, trailing timestamp/badge column.
class ConversationTileSkeleton extends StatelessWidget {
  const ConversationTileSkeleton({super.key, this.squareAvatar = false});

  /// Secretary home uses a rounded-square initials tile; the patient chat tab
  /// uses a circular avatar.
  final bool squareAvatar;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          squareAvatar
              ? const SkeletonTile(size: 48, borderRadius: 12)
              : const SkeletonCircle(size: 48),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonLine(width: 150, height: 14),
                SizedBox(height: spacing.AppSpacing.gutterXs),
                SkeletonLine(width: 210, height: 11),
              ],
            ),
          ),
          const SizedBox(width: spacing.AppSpacing.gutterSm),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: const [
              SkeletonLine(width: 36, height: 10),
              SizedBox(height: spacing.AppSpacing.gutterXs),
              SkeletonBox(width: 20, height: 20, borderRadius: 10),
            ],
          ),
        ],
      ),
    );
  }
}

/// Alternating left/right message bubbles for `conversation_thread_page.dart`.
class ChatThreadSkeleton extends StatelessWidget {
  const ChatThreadSkeleton({super.key, this.bubbleCount = 6});

  final int bubbleCount;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        itemCount: bubbleCount,
        itemBuilder: (context, index) {
          final isFromPatient = index.isEven;
          final widths = [180.0, 140.0, 220.0, 160.0];
          final width = widths[index % widths.length];
          return Padding(
            padding: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
            child: Row(
              mainAxisAlignment: isFromPatient
                  ? MainAxisAlignment.end
                  : MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (!isFromPatient) ...[
                  const SkeletonCircle(size: 36),
                  const SizedBox(width: spacing.AppSpacing.gutterSm),
                ],
                SkeletonBox(
                  width: width,
                  height: 44,
                  borderRadius: spacing.AppSpacing.radiusLg,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

/// Matches `_buildPaymentCard` on `payments_hub_page.dart`.
class PaymentCardSkeleton extends StatelessWidget {
  const PaymentCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonLine(width: 160, height: 14),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 110, height: 11),
                  ],
                ),
              ),
              SkeletonBox(
                width: 80,
                height: 24,
                borderRadius: spacing.AppSpacing.radiusFull,
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          const SkeletonLine(width: double.infinity, height: 12),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          const SkeletonLine(width: 200, height: 12),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          const Divider(height: 1),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              SkeletonLine(width: 50, height: 14),
              SkeletonLine(width: 80, height: 14),
            ],
          ),
        ],
      ),
    );
  }
}

/// Matches `_buildVisitCard` on `medical_records_page.dart`.
class VisitCardSkeleton extends StatelessWidget {
  const VisitCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SkeletonCircle(size: 48),
              const SizedBox(width: spacing.AppSpacing.gutterLg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonLine(width: 140, height: 14),
                    SizedBox(height: spacing.AppSpacing.gutterSm),
                    SkeletonLine(width: 100, height: 11),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          const SkeletonLine(width: 80, height: 11),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          const SkeletonLine(width: double.infinity, height: 13),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          const SkeletonLine(width: 260, height: 13),
        ],
      ),
    );
  }
}

/// Matches `_buildPrescriptionCard` on `medical_records_page.dart`.
class PrescriptionCardSkeleton extends StatelessWidget {
  const PrescriptionCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const SkeletonCircle(size: 48),
              const SizedBox(width: spacing.AppSpacing.gutterLg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonLine(width: 140, height: 14),
                    SizedBox(height: spacing.AppSpacing.gutterSm),
                    SkeletonLine(width: 100, height: 11),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.slate200),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          Row(
            children: const [
              SkeletonTile(size: 16, borderRadius: 4),
              SizedBox(width: spacing.AppSpacing.gutterSm),
              SkeletonLine(width: 120, height: 11),
            ],
          ),
        ],
      ),
    );
  }
}

/// Matches the notification rows on `notifications_page.dart`.
class NotificationTileSkeleton extends StatelessWidget {
  const NotificationTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.only(bottom: spacing.AppSpacing.gutterSm),
      color: AppColors.surfaceLowest,
      child: Padding(
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(child: SkeletonLine(width: 200, height: 14)),
                const SizedBox(width: spacing.AppSpacing.gutterSm),
                SkeletonBox(width: 8, height: 8, borderRadius: 4),
              ],
            ),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            const SkeletonLine(width: double.infinity, height: 11),
            const SizedBox(height: spacing.AppSpacing.gutterXs),
            const SkeletonLine(width: 220, height: 11),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            const SkeletonLine(width: 80, height: 10),
          ],
        ),
      ),
    );
  }
}

/// Matches the stacked cards on `prescription_detail_page.dart`.
class PrescriptionDetailSkeleton extends StatelessWidget {
  const PrescriptionDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(spacing.AppSpacing.screenPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const SkeletonCircle(size: 56),
                      const SizedBox(width: spacing.AppSpacing.gutterLg),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: const [
                            SkeletonLine(width: 140, height: 15),
                            SizedBox(height: 2),
                            SkeletonLine(width: 100, height: 12),
                            SizedBox(height: 2),
                            SkeletonLine(width: 130, height: 11),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  const SkeletonLine(width: double.infinity, height: 12),
                  const SizedBox(height: spacing.AppSpacing.gutterXs),
                  const SkeletonLine(width: 200, height: 12),
                  const Padding(
                    padding: EdgeInsets.symmetric(
                      vertical: spacing.AppSpacing.gutterMd,
                    ),
                    child: Divider(height: 1),
                  ),
                  Row(
                    children: const [
                      SkeletonTile(size: 44),
                      SizedBox(width: spacing.AppSpacing.gutterMd),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SkeletonLine(width: 160, height: 12),
                            SizedBox(height: spacing.AppSpacing.gutterXs),
                            SkeletonLine(width: 110, height: 11),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  SkeletonLine(width: 90, height: 13),
                  SizedBox(height: spacing.AppSpacing.gutterMd),
                  SkeletonLine(width: double.infinity, height: 13),
                  SizedBox(height: spacing.AppSpacing.gutterSm),
                  SkeletonLine(width: 240, height: 13),
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            AppCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SkeletonLine(width: 120, height: 13),
                  const SizedBox(height: spacing.AppSpacing.gutterMd),
                  for (var i = 0; i < 3; i++) ...[
                    Row(
                      children: [
                        const SkeletonTile(size: 36),
                        const SizedBox(width: spacing.AppSpacing.gutterMd),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SkeletonLine(
                                width: i.isEven ? 160.0 : 120.0,
                                height: 13,
                              ),
                              const SizedBox(
                                height: spacing.AppSpacing.gutterXs,
                              ),
                              const SkeletonLine(width: 200, height: 11),
                            ],
                          ),
                        ),
                      ],
                    ),
                    if (i < 2)
                      const SizedBox(height: spacing.AppSpacing.gutterMd),
                  ],
                ],
              ),
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
            SkeletonBox(height: 52, borderRadius: spacing.AppSpacing.radiusLg),
          ],
        ),
      ),
    );
  }
}

/// Matches the profile layout on `doctor_profile_page.dart`: identity row,
/// availability banner, quick facts card, about/schedule cards.
class DoctorProfileSkeleton extends StatelessWidget {
  const DoctorProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          spacing.AppSpacing.screenPadding,
          spacing.AppSpacing.gutterLg,
          spacing.AppSpacing.screenPadding,
          spacing.AppSpacing.gutter2xl,
        ),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SkeletonCircle(size: 88),
              const SizedBox(width: spacing.AppSpacing.gutterLg),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonLine(width: 180, height: 20),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 120, height: 13),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 150, height: 11),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          SkeletonBox(height: 40, borderRadius: 12),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          AppCard(
            child: Row(
              children: const [
                Expanded(
                  child: Column(
                    children: [
                      SkeletonTile(size: 20),
                      SizedBox(height: spacing.AppSpacing.gutterXs),
                      SkeletonLine(width: 80, height: 14),
                      SizedBox(height: 2),
                      SkeletonLine(width: 70, height: 10),
                    ],
                  ),
                ),
                SizedBox(width: spacing.AppSpacing.gutterLg),
                SizedBox(width: 1, height: 52, child: SkeletonBox()),
                SizedBox(width: spacing.AppSpacing.gutterLg),
                Expanded(
                  child: Column(
                    children: [
                      SkeletonTile(size: 20),
                      SizedBox(height: spacing.AppSpacing.gutterXs),
                      SkeletonLine(width: 80, height: 14),
                      SizedBox(height: 2),
                      SkeletonLine(width: 70, height: 10),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonLine(width: 60, height: 13),
                SizedBox(height: spacing.AppSpacing.gutterMd),
                SkeletonLine(width: double.infinity, height: 12),
                SizedBox(height: spacing.AppSpacing.gutterSm),
                SkeletonLine(width: double.infinity, height: 12),
                SizedBox(height: spacing.AppSpacing.gutterSm),
                SkeletonLine(width: 180, height: 12),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonLine(width: 110, height: 13),
                SizedBox(height: spacing.AppSpacing.gutterMd),
                SkeletonLine(width: double.infinity, height: 12),
                SizedBox(height: spacing.AppSpacing.gutterSm),
                SkeletonLine(width: double.infinity, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Matches a waitlist entry card on `waitlist_page.dart`: doctor name +
/// specialty with a status pill, date/position icon rows, status message,
/// and action buttons.
class WaitlistCardSkeleton extends StatelessWidget {
  const WaitlistCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    SkeletonLine(width: 170, height: 18),
                    SizedBox(height: spacing.AppSpacing.gutterXs),
                    SkeletonLine(width: 110, height: 12),
                  ],
                ),
              ),
              SkeletonBox(
                width: 90,
                height: 26,
                borderRadius: spacing.AppSpacing.radiusFull,
              ),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          const SkeletonLine(width: 190, height: 13),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          const SkeletonLine(width: double.infinity, height: 12),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          const SkeletonLine(width: 200, height: 12),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          const SkeletonLine(width: 120, height: 11),
          const SizedBox(height: spacing.AppSpacing.gutterMd),
          SkeletonBox(
            height: 44,
            borderRadius: spacing.AppSpacing.radiusLg,
          ),
        ],
      ),
    );
  }
}

/// Matches the queue-details body of `live_queue_card.dart` (rendered inside
/// the card that already shows the static "Live Queue" header): queue number
/// tile + status pill/doctor line, three-stat container, room line.
class LiveQueueBodySkeleton extends StatelessWidget {
  const LiveQueueBodySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const SkeletonTile(size: 64, borderRadius: 12),
            const SizedBox(width: spacing.AppSpacing.gutterMd),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  SkeletonBox(
                    width: 110,
                    height: 24,
                    borderRadius: spacing.AppSpacing.radiusFull,
                  ),
                  SizedBox(height: spacing.AppSpacing.gutterXs),
                  SkeletonLine(width: 140, height: 13),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: spacing.AppSpacing.gutterMd),
        Container(
          padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
          decoration: BoxDecoration(
            color: AppColors.surfaceLow,
            borderRadius: BorderRadius.circular(spacing.AppSpacing.radiusLg),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: const [
              _SkeletonStat(),
              _SkeletonStatDivider(),
              _SkeletonStat(),
              _SkeletonStatDivider(),
              _SkeletonStat(),
            ],
          ),
        ),
        const SizedBox(height: spacing.AppSpacing.gutterSm),
        const SkeletonLine(width: 90, height: 11),
      ],
    );
  }
}

class _SkeletonStat extends StatelessWidget {
  const _SkeletonStat();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        SkeletonLine(width: 60, height: 10),
        SizedBox(height: 4),
        SkeletonLine(width: 44, height: 14),
      ],
    );
  }
}

class _SkeletonStatDivider extends StatelessWidget {
  const _SkeletonStatDivider();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 28,
      color: AppColors.surfaceContainerHighest,
    );
  }
}

/// Matches the week calendar on `doctor_schedule_page.dart` and
/// `reschedule_page.dart`: week navigation row, static weekday headers, and
/// seven day-cell placeholders.
class WeekCalendarSkeleton extends StatelessWidget {
  const WeekCalendarSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              SkeletonCircle(size: 40),
              SkeletonLine(width: 160, height: 14),
              SkeletonCircle(size: 40),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: const [
              SkeletonLine(width: 14, height: 10),
              SkeletonLine(width: 14, height: 10),
              SkeletonLine(width: 14, height: 10),
              SkeletonLine(width: 14, height: 10),
              SkeletonLine(width: 14, height: 10),
              SkeletonLine(width: 14, height: 10),
              SkeletonLine(width: 14, height: 10),
            ],
          ),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          Row(
            children: List.generate(
              7,
              (_) => const Expanded(
                child: Center(child: SkeletonBox(height: 36, borderRadius: 10)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Just the seven day cells (used inside an already-rendered calendar card,
/// e.g. `reschedule_page.dart` where only availability is still loading).
class CalendarDayCellsSkeleton extends StatelessWidget {
  const CalendarDayCellsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Row(
        children: List.generate(
          7,
          (_) => const Expanded(
            child: Center(child: SkeletonBox(height: 52, borderRadius: 10)),
          ),
        ),
      ),
    );
  }
}

/// Matches the patient profile layout on `patient_profile_page.dart`: summary
/// tile (avatar + name/email) followed by a card of labelled info rows.
class PatientProfileSkeleton extends StatelessWidget {
  const PatientProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(spacing.AppSpacing.screenPadding),
        children: [
          AppCard(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            child: Row(
              children: [
                const SkeletonCircle(size: 64),
                const SizedBox(width: spacing.AppSpacing.gutterMd),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      SkeletonLine(width: 160, height: 16),
                      SizedBox(height: spacing.AppSpacing.gutterXs),
                      SkeletonLine(width: 200, height: 12),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          const SkeletonLine(width: 130, height: 11),
          const SizedBox(height: spacing.AppSpacing.gutterSm),
          AppCard(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            child: Column(
              children: [
                for (var i = 0; i < 6; i++) ...[
                  if (i > 0) const SizedBox(height: spacing.AppSpacing.gutterMd),
                  const _SkeletonInfoRow(),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SkeletonInfoRow extends StatelessWidget {
  const _SkeletonInfoRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        SkeletonTile(size: 20, borderRadius: 6),
        SizedBox(width: spacing.AppSpacing.gutterSm),
        Expanded(child: SkeletonLine(width: 90, height: 12)),
        SizedBox(width: spacing.AppSpacing.gutterMd),
        SkeletonLine(width: 140, height: 13),
      ],
    );
  }
}

/// Label + rounded input-box pairs matching the patient details form on
/// `patient_details_page.dart`.
class FormFieldsSkeleton extends StatelessWidget {
  const FormFieldsSkeleton({super.key, this.fieldCount = 5});

  final int fieldCount;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppCard(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonLine(width: double.infinity, height: 13),
                SizedBox(height: spacing.AppSpacing.gutterXs),
                SkeletonLine(width: 220, height: 11),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          for (var i = 0; i < fieldCount; i++) ...[
            const SkeletonLine(width: 110, height: 11),
            const SizedBox(height: spacing.AppSpacing.gutterSm),
            SkeletonBox(
              height: 52,
              borderRadius: spacing.AppSpacing.radiusMd,
            ),
            const SizedBox(height: spacing.AppSpacing.gutterLg),
          ],
        ],
      ),
    );
  }
}

/// Matches the rows inside `patient_info_sheet.dart`: section titles with
/// label/value info rows.
class InfoRowsSkeleton extends StatelessWidget {
  const InfoRowsSkeleton({super.key, this.sectionCount = 3});

  final int sectionCount;

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var s = 0; s < sectionCount; s++) ...[
            const SkeletonLine(width: 110, height: 13),
            const SizedBox(height: spacing.AppSpacing.gutterMd),
            for (var i = 0; i < 4; i++) ...[
              const _SkeletonInfoRow(),
              const SizedBox(height: spacing.AppSpacing.gutterSm),
            ],
            const SizedBox(height: spacing.AppSpacing.gutterLg),
          ],
        ],
      ),
    );
  }
}

/// Matches the AI conversation rows on `ai_conversation_history_page.dart`:
/// chat icon, title + date lines, trailing overflow icon.
class AiConversationTileSkeleton extends StatelessWidget {
  const AiConversationTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
      margin: EdgeInsets.only(bottom: spacing.AppSpacing.gutterMd),
      child: Row(
        children: [
          const SkeletonTile(size: 24, borderRadius: 6),
          const SizedBox(width: spacing.AppSpacing.gutterMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonLine(width: 180, height: 13),
                SizedBox(height: spacing.AppSpacing.gutterXs),
                SkeletonLine(width: 80, height: 11),
              ],
            ),
          ),
          const SkeletonTile(size: 20, borderRadius: 6),
        ],
      ),
    );
  }
}

/// Matches `payment_screen.dart` while payment details load: status card
/// (icon circle + status lines + amount pill) and the receipt-upload card
/// header with GCash account lines.
class PaymentUploadSkeleton extends StatelessWidget {
  const PaymentUploadSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: Column(
        children: [
          AppCard(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
            child: Row(
              children: [
                const SkeletonCircle(size: 48),
                const SizedBox(width: spacing.AppSpacing.gutterMd),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      SkeletonLine(width: 90, height: 11),
                      SizedBox(height: spacing.AppSpacing.gutterXs),
                      SkeletonLine(width: 130, height: 13),
                    ],
                  ),
                ),
                SkeletonBox(
                  width: 70,
                  height: 30,
                  borderRadius: spacing.AppSpacing.radiusFull,
                ),
              ],
            ),
          ),
          const SizedBox(height: spacing.AppSpacing.gutterLg),
          AppCard(
            padding: EdgeInsets.all(spacing.AppSpacing.gutterLg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const SkeletonTile(size: 20, borderRadius: 6),
                    const SizedBox(width: spacing.AppSpacing.gutterSm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          SkeletonLine(width: 150, height: 13),
                          SizedBox(height: spacing.AppSpacing.gutterXs),
                          SkeletonLine(width: 220, height: 11),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: spacing.AppSpacing.gutterLg),
                SkeletonBox(
                  height: 72,
                  borderRadius: spacing.AppSpacing.radiusMd,
                ),
                const SizedBox(height: spacing.AppSpacing.gutterLg),
                SkeletonBox(
                  height: 48,
                  borderRadius: spacing.AppSpacing.radiusLg,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Matches the invoice document inside `invoice_bottom_sheet.dart`: clinic
/// header block, invoice number/date lines, charge rows and a total.
class InvoiceSkeleton extends StatelessWidget {
  const InvoiceSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return SkeletonScope(
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(spacing.AppSpacing.gutterMd),
        child: Container(
          color: AppColors.surfaceLowest,
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const SkeletonTile(size: 48, borderRadius: 10),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        SkeletonLine(width: 140, height: 15),
                        SizedBox(height: 4),
                        SkeletonLine(width: 180, height: 11),
                        SizedBox(height: 4),
                        SkeletonLine(width: 140, height: 11),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const SkeletonLine(width: 80, height: 14),
              const SizedBox(height: 4),
              const SkeletonLine(width: 120, height: 11),
              const SizedBox(height: 16),
              for (var i = 0; i < 4; i++) ...[
                const _SkeletonInvoiceRow(),
                const SizedBox(height: spacing.AppSpacing.gutterSm),
              ],
              const SizedBox(height: spacing.AppSpacing.gutterMd),
              Container(
                padding: const EdgeInsets.only(top: spacing.AppSpacing.gutterSm),
                decoration: const BoxDecoration(
                  border: Border(
                    top: BorderSide(color: AppColors.slate200),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    SkeletonLine(width: 60, height: 13),
                    SkeletonLine(width: 90, height: 14),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SkeletonInvoiceRow extends StatelessWidget {
  const _SkeletonInvoiceRow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        Expanded(child: SkeletonLine(width: 200, height: 12)),
        SizedBox(width: spacing.AppSpacing.gutterMd),
        SkeletonLine(width: 70, height: 12),
      ],
    );
  }
}

/// Horizontal row of pill placeholders matching the specialty chips.
class SpecialtyChipsSkeleton extends StatelessWidget {
  const SpecialtyChipsSkeleton({super.key, this.chipCount = 5});

  final int chipCount;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: SkeletonScope(
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: chipCount,
          separatorBuilder: (_, _) =>
              SizedBox(width: spacing.AppSpacing.gutterSm),
          itemBuilder: (context, index) => SkeletonBox(
            width: index == 0 ? 100 : 80 + (index * 12.0),
            height: 40,
            borderRadius: spacing.AppSpacing.radiusFull,
          ),
        ),
      ),
    );
  }
}
