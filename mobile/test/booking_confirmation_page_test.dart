import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/appointments/presentation/booking_confirmation_page.dart';

void main() {
  group('Booking Confirmation Page Tests', () {
    testWidgets('Booking confirmation page can be created with required parameters', (WidgetTester tester) async {
      // This test verifies the page can be instantiated with required parameters
      await tester.pumpWidget(
        MaterialApp(
          home: BookingConfirmationPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
          ),
        ),
      );

      expect(find.byType(BookingConfirmationPage), findsOneWidget);
    });

    testWidgets('Payment method and receipt image parameters are preserved in widget', (WidgetTester tester) async {
      // This test verifies paymentMethod and receiptImage are properly passed through navigation
      await tester.pumpWidget(
        MaterialApp(
          home: BookingConfirmationPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
            paymentMethod: 'GCASH',
            receiptImage: null, // File cannot be tested directly in widget test
          ),
        ),
      );

      final bookingConfirmationPage = tester.widget<BookingConfirmationPage>(find.byType(BookingConfirmationPage));

      expect(bookingConfirmationPage.paymentMethod, 'GCASH');
      expect(bookingConfirmationPage.receiptImage, isNull);
    });

    testWidgets('All booking state parameters are preserved in widget', (WidgetTester tester) async {
      // This test verifies all booking state parameters are preserved
      await tester.pumpWidget(
        MaterialApp(
          home: BookingConfirmationPage(
            doctorId: 'test-doctor-id',
            doctorName: 'Dr. Test',
            specialty: 'Cardiology',
            clinic: 'Test Clinic',
            consultationFee: '1000',
            selectedDate: DateTime(2026, 10, 20),
            paymentMethod: 'GCASH',
          ),
        ),
      );

      final bookingConfirmationPage = tester.widget<BookingConfirmationPage>(find.byType(BookingConfirmationPage));

      expect(bookingConfirmationPage.doctorId, 'test-doctor-id');
      expect(bookingConfirmationPage.doctorName, 'Dr. Test');
      expect(bookingConfirmationPage.specialty, 'Cardiology');
      expect(bookingConfirmationPage.clinic, 'Test Clinic');
      expect(bookingConfirmationPage.consultationFee, '1000');
      expect(bookingConfirmationPage.selectedDate, DateTime(2026, 10, 20));
      expect(bookingConfirmationPage.paymentMethod, 'GCASH');
    });
  });
}
