import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/skeleton.dart';
import 'package:shimmer/shimmer.dart';

void main() {
  for (final brightness in [Brightness.light, Brightness.dark]) {
    final label = brightness == Brightness.light ? 'light' : 'dark';

    testWidgets('shared primitives share one Shimmer and non-zero size ($label)', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(brightness: brightness),
          home: const Scaffold(
            body: SkeletonScope(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SkeletonBox(width: 80, height: 24),
                  SkeletonLine(width: 120),
                  SkeletonCircle(size: 40),
                  SkeletonTile(size: 40),
                ],
              ),
            ),
          ),
        ),
      );

      expect(find.byType(Shimmer), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(Shimmer),
          matching: find.byType(Shimmer),
        ),
        findsNothing,
      );

      final renderBox = tester.renderObject(find.byType(Shimmer)) as RenderBox;
      expect(renderBox.size.width, greaterThan(0));
      expect(renderBox.size.height, greaterThan(0));
    });

    testWidgets('all screen skeletons have one Shimmer and non-zero size ($label)', (
      WidgetTester tester,
    ) async {
      const selfScoped = <Widget>[
        AppointmentDetailSkeleton(),
        ChatThreadSkeleton(),
        PrescriptionDetailSkeleton(),
        DoctorProfileSkeleton(),
        WeekCalendarSkeleton(),
        CalendarDayCellsSkeleton(),
        LiveQueueBodySkeleton(),
        PatientProfileSkeleton(),
        HomeUpcomingAppointmentSkeleton(),
        HomeRecentUpdatesSkeleton(),
      ];

      for (final skeleton in selfScoped) {
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(brightness: brightness),
            home: Scaffold(body: skeleton),
          ),
        );

        expect(find.byType(Shimmer), findsOneWidget, reason: '${skeleton.runtimeType}');
        expect(
          find.descendant(
            of: find.byType(Shimmer),
            matching: find.byType(Shimmer),
          ),
          findsNothing,
          reason: '${skeleton.runtimeType} must not nest Shimmer',
        );

        final renderBox = tester.renderObject(find.byType(Shimmer)) as RenderBox;
        expect(renderBox.size.width, greaterThan(0));
        expect(renderBox.size.height, greaterThan(0));
      }

      const cardSkeletons = <Widget>[
        AppointmentCardSkeleton(),
        DoctorCardSkeleton(),
        HomeDoctorCardSkeleton(),
        ClinicCardSkeleton(),
        ConversationTileSkeleton(squareAvatar: true),
        PaymentCardSkeleton(),
        VisitCardSkeleton(),
        PrescriptionCardSkeleton(),
        NotificationTileSkeleton(),
        WaitlistCardSkeleton(),
        RecentUpdateTileSkeleton(),
      ];

      for (final skeleton in cardSkeletons) {
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(brightness: brightness),
            home: Scaffold(
              body: SingleChildScrollView(
                child: SkeletonScope(child: skeleton),
              ),
            ),
          ),
        );

        expect(find.byType(Shimmer), findsOneWidget, reason: '${skeleton.runtimeType}');
        expect(
          find.descendant(
            of: find.byType(Shimmer),
            matching: find.byType(Shimmer),
          ),
          findsNothing,
          reason: '${skeleton.runtimeType} must not nest Shimmer',
        );

        final renderBox = tester.renderObject(find.byType(Shimmer)) as RenderBox;
        expect(renderBox.size.width, greaterThan(0));
        expect(renderBox.size.height, greaterThan(0));
      }
    });
  }
}