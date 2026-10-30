'use client';

import { useState, useEffect, useMemo } from 'react';
import { secretaryApi, Payment, PaymentCharge } from '@/lib/api/secretaryApi';
import Toast from './ui/Toast';
import InvoiceModal from './InvoiceModal';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  consultationFee: number;
  patientName: string;
  onSuccess: () => void;
  initialPaymentMethod?: 'CASH' | 'GCASH'; // Optional initial payment method for booked patients
  isWalkIn?: boolean; // True for walk-in patients, false for booked patients
}

export default function PaymentModal({
  isOpen,
  onClose,
  appointmentId,
  consultationFee,
  patientName,
  onSuccess,
  initialPaymentMethod,
  isWalkIn = true,
}: PaymentModalProps) {
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH'>(initialPaymentMethod || 'CASH');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showDeleteChargeDialog, setShowDeleteChargeDialog] = useState(false);
  const [chargeToDelete, setChargeToDelete] = useState<PaymentCharge | null>(null);
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeFormError, setChargeFormError] = useState<string | null>(null);
  const [chargeType, setChargeType] = useState<'ADDITIONAL' | 'MEDICINE'>('ADDITIONAL');
  const [medicineName, setMedicineName] = useState('');
  const [medicineQuantity, setMedicineQuantity] = useState('');
  const [medicineUnitPrice, setMedicineUnitPrice] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptImageLoaded, setReceiptImageLoaded] = useState(false);
  const [receiptImageError, setReceiptImageError] = useState(false);
  const [receiptSignedUrl, setReceiptSignedUrl] = useState<string | null>(null);
  const [isFetchingReceiptUrl, setIsFetchingReceiptUrl] = useState(false);
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState('');
  const [advancePaymentError, setAdvancePaymentError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [cashPaymentAmount, setCashPaymentAmount] = useState('');
  const [showCompleteCheckupModal, setShowCompleteCheckupModal] = useState(false);
  const [cashPaymentError, setCashPaymentError] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  // Charges for walk-in payment creation
  const [tempCharges, setTempCharges] = useState<Array<{ description: string; amount: number; chargeType: 'ADDITIONAL' | 'MEDICINE'; name?: string; quantity?: number; unitPrice?: number }>>([]);
  // Track payment method editing state
  const [isEditingPaymentMethod, setIsEditingPaymentMethod] = useState(false);
  const [editedPaymentMethod, setEditedPaymentMethod] = useState<'CASH' | 'GCASH'>('CASH');

  // Reset and fetch payment when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod(initialPaymentMethod || 'CASH');
      setTempCharges([]);
      setCashPaymentAmount('');
      setAdvancePaymentAmount('');
      setIsEditingPaymentMethod(false);
      setEditedPaymentMethod(initialPaymentMethod || 'CASH');
      fetchPayment();
    }
  }, [isOpen, appointmentId, initialPaymentMethod]);

  const fetchPayment = async () => {
    setIsLoadingPayment(true);
    try {
      const response = await secretaryApi.getPayment(appointmentId);
      if (response.success && response.data) {
        setSelectedPayment(response.data);
      } else {
        // Payment doesn't exist yet - set to null to show creation form
        setSelectedPayment(null);
      }
    } catch (error) {
      console.error('Failed to fetch payment:', error);
      setSelectedPayment(null);
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleCreatePayment = async () => {
    setActionLoading(true);
    setToastMessage('');
    setToastType('success');
    setChargeFormError(null);

    try {
      const response = await secretaryApi.recordPayment({
        appointmentId,
        paymentMethod: paymentMethod,
        consultationFee,
        additionalCharges: tempCharges,
      });

      if (response.success) {
        setToastMessage('Payment created successfully');
        setShowToast(true);
        // Fetch the newly created payment
        await fetchPayment();

        // If cash payment amount is provided, record the payment
        if (cashPaymentAmount && parseFloat(cashPaymentAmount) > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const paymentResponse = await secretaryApi.getPayment(appointmentId);
          if (paymentResponse.success && paymentResponse.data) {
            const numericAmount = parseFloat(cashPaymentAmount);
            const tenderResponse = await secretaryApi.recordPartialPayment(paymentResponse.data.id, numericAmount, 'CASH');
            if (tenderResponse.success) {
              setCashPaymentAmount('');
              // Refresh payment data to show updated status
              await new Promise(resolve => setTimeout(resolve, 500));
              const refreshResponse = await secretaryApi.getPayment(appointmentId);
              if (refreshResponse.success && refreshResponse.data) {
                setSelectedPayment(refreshResponse.data);
              }
            }
          }
        }
      } else {
        setChargeFormError(response.error || 'Failed to create payment');
        setToastMessage(response.error || 'Failed to create payment');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setChargeFormError('Failed to create payment. Please try again.');
      setToastMessage('Failed to create payment');
      setToastType('error');
      setShowToast(true);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatAmount = (amount: number | string | null | undefined) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (numAmount === null || numAmount === undefined || isNaN(numAmount)) {
      return '₱0.00';
    }
    return `₱${numAmount.toFixed(2)}`;
  };

  // Calculate total amount from consultation and charges (recalculated for accuracy)
  // Using integer arithmetic in cents for 100% accuracy
  const calculateTotalAmount = (payment: Payment) => {
    const consultationAmount = typeof payment.consultation_amount === 'string'
      ? parseFloat(payment.consultation_amount)
      : (payment.consultation_amount || 0);
    const charges = payment.charges || [];
    const chargesTotal = charges.reduce((sum, charge) => {
      const amount = typeof charge.amount === 'string' ? parseFloat(charge.amount) : charge.amount;
      return sum + (amount || 0);
    }, 0);

    // Convert to cents for integer arithmetic
    const totalCents = Math.round(consultationAmount * 100) + Math.round(chargesTotal * 100);
    // Convert back to pesos
    return totalCents / 100;
  };

  // Calculate real-time balance from current data
  // Using integer arithmetic in cents for 100% accuracy
  const calculateBalance = (payment: Payment) => {
    const totalAmount = calculateTotalAmount(payment);
    const amountPaid = typeof payment.amount_paid === 'string'
      ? parseFloat(payment.amount_paid)
      : (payment.amount_paid || 0);

    // Convert to cents for integer arithmetic
    const totalCents = Math.round(totalAmount * 100);
    const paidCents = Math.round(amountPaid * 100);
    const balanceCents = Math.max(0, totalCents - paidCents);

    // Convert back to pesos
    return balanceCents / 100;
  };

  // Calculate real-time balance after receipt payment
  const getBalanceAfterPayment = (amount: string) => {
    if (!selectedPayment || !amount) return null;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return null;
    const currentBalance = calculateBalance(selectedPayment);
    const newBalance = Math.max(0, currentBalance - numericAmount);
    return newBalance.toFixed(2);
  };

  // Calculate change when cash tender amount exceeds balance
  const getChange = (amount: string) => {
    if (!selectedPayment || !amount) return null;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return null;
    const currentBalance = calculateBalance(selectedPayment);
    const change = numericAmount - currentBalance;
    return change > 0 ? change.toFixed(2) : null;
  };

  // Calculate total for walk-in payment including temporary charges
  const calculateWalkInTotal = () => {
    const chargesTotal = tempCharges.reduce((sum, charge) => sum + charge.amount, 0);
    return consultationFee + chargesTotal;
  };

  // Calculate change for walk-in payment
  const getWalkInChange = (amount: string) => {
    if (!amount) return null;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return null;
    const total = calculateWalkInTotal();
    const change = numericAmount - total;
    return change > 0 ? change.toFixed(2) : null;
  };

  // Add temporary charge for walk-in payment
  const handleAddTempCharge = () => {
    let finalChargeAmount: number = 0;
    let finalChargeDescription: string = '';
    let chargeData: any;

    if (chargeType === 'MEDICINE') {
      const trimmedName = medicineName.trim();
      if (!trimmedName) {
        setChargeFormError('Medicine name is required');
        return;
      }

      const numQuantity = parseFloat(medicineQuantity);
      if (isNaN(numQuantity) || !isFinite(numQuantity) || numQuantity <= 0) {
        setChargeFormError('Quantity must be a valid positive number');
        return;
      }

      const numUnitPrice = parseFloat(medicineUnitPrice);
      if (isNaN(numUnitPrice) || !isFinite(numUnitPrice) || numUnitPrice <= 0) {
        setChargeFormError('Unit price must be a valid positive number');
        return;
      }

      finalChargeAmount = numQuantity * numUnitPrice;
      finalChargeAmount = Math.round(finalChargeAmount * 100) / 100;
      finalChargeDescription = trimmedName;
      chargeData = {
        description: finalChargeDescription,
        amount: finalChargeAmount,
        chargeType: 'MEDICINE',
        name: trimmedName,
        quantity: numQuantity,
        unitPrice: numUnitPrice
      };
    } else {
      const trimmedDescription = chargeDescription.trim();
      if (!trimmedDescription) {
        setChargeFormError('Description is required');
        return;
      }

      const numAmount = parseFloat(chargeAmount);
      if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
        setChargeFormError('Amount must be a valid positive number');
        return;
      }

      finalChargeAmount = numAmount;
      finalChargeDescription = trimmedDescription;
      chargeData = {
        description: finalChargeDescription,
        amount: finalChargeAmount,
        chargeType: 'ADDITIONAL'
      };
    }

    setTempCharges([...tempCharges, chargeData]);
    setChargeDescription('');
    setChargeAmount('');
    setMedicineName('');
    setMedicineQuantity('');
    setMedicineUnitPrice('');
    setChargeType('ADDITIONAL');
    setChargeFormError(null);
    setShowAddChargeModal(false);
  };

  // Remove temporary charge
  const handleRemoveTempCharge = (index: number) => {
    setTempCharges(tempCharges.filter((_, i) => i !== index));
  };

  const handleAddCharge = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);
    setToastMessage('');
    setToastType('success');
    setChargeFormError(null);

    try {
      let payload: any;

      if (chargeType === 'MEDICINE') {
        const trimmedName = medicineName.trim();
        if (!trimmedName) {
          setChargeFormError('Medicine name is required');
          setActionLoading(false);
          return;
        }

        const numQuantity = parseFloat(medicineQuantity);
        if (isNaN(numQuantity) || !isFinite(numQuantity) || numQuantity <= 0) {
          setChargeFormError('Quantity must be a valid positive number');
          setActionLoading(false);
          return;
        }

        const numUnitPrice = parseFloat(medicineUnitPrice);
        if (isNaN(numUnitPrice) || !isFinite(numUnitPrice) || numUnitPrice <= 0) {
          setChargeFormError('Unit price must be a valid positive number');
          setActionLoading(false);
          return;
        }

        payload = {
          chargeType: 'MEDICINE',
          name: trimmedName,
          quantity: numQuantity,
          unitPrice: numUnitPrice
        };
      } else {
        const trimmedDescription = chargeDescription.trim();
        if (!trimmedDescription) {
          setChargeFormError('Description is required');
          setActionLoading(false);
          return;
        }

        const numAmount = parseFloat(chargeAmount);
        if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
          setChargeFormError('Amount must be a valid positive number');
          setActionLoading(false);
          return;
        }

        payload = {
          chargeType: 'ADDITIONAL',
          description: trimmedDescription,
          amount: numAmount
        };
      }

      const response = await secretaryApi.addCharge(selectedPayment.id, payload);

      if (response.success) {
        setToastMessage('Charge added successfully');
        setShowToast(true);
        setShowAddChargeModal(false);
        setChargeDescription('');
        setChargeAmount('');
        setMedicineName('');
        setMedicineQuantity('');
        setMedicineUnitPrice('');
        setChargeType('ADDITIONAL');

        await new Promise(resolve => setTimeout(resolve, 500));
        const paymentResponse = await secretaryApi.getPayment(appointmentId);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      } else {
        setToastMessage(response.error || 'Failed to add charge');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setToastMessage('Failed to add charge');
      setToastType('error');
      setShowToast(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCharge = async () => {
    if (!selectedPayment || !chargeToDelete) return;

    setActionLoading(true);
    setToastMessage('');
    setToastType('success');

    try {
      const response = await secretaryApi.deleteCharge(selectedPayment.id, chargeToDelete.id);

      if (response.success) {
        setToastMessage('Charge deleted successfully');
        setShowToast(true);
        setShowDeleteChargeDialog(false);
        setChargeToDelete(null);

        const paymentResponse = await secretaryApi.getPayment(appointmentId);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      } else {
        setToastMessage(response.error || 'Failed to delete charge');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setToastMessage('Failed to delete charge');
      setToastType('error');
      setShowToast(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordAdvancePayment = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);
    setToastMessage('');
    setToastType('success');
    setAdvancePaymentError(null);

    try {
      const numericAmount = parseFloat(advancePaymentAmount);
      if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
        setAdvancePaymentError('Amount must be a valid positive number');
        setActionLoading(false);
        return;
      }

      const response = await secretaryApi.recordPartialPayment(selectedPayment.id, numericAmount, 'GCASH');

      if (response.success) {
        setToastMessage(response.data?.status === 'PAID' ? 'Payment fully paid' : 'Advance payment recorded');
        setShowToast(true);
        setAdvancePaymentAmount('');

        await new Promise(resolve => setTimeout(resolve, 500));
        const paymentResponse = await secretaryApi.getPayment(appointmentId);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      } else {
        setAdvancePaymentError(response.error || 'Failed to record advance payment');
      }
    } catch (error) {
      setAdvancePaymentError('Failed to record advance payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordCashPayment = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);
    setToastMessage('');
    setToastType('success');
    setCashPaymentError(null);

    try {
      const numericAmount = parseFloat(cashPaymentAmount);
      if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
        setCashPaymentError('Amount must be a valid positive number');
        setActionLoading(false);
        return;
      }

      const response = await secretaryApi.recordPartialPayment(selectedPayment.id, numericAmount, 'CASH');

      if (response.success) {
        setToastMessage(response.data?.status === 'PAID' ? 'Payment fully paid' : 'Cash payment recorded');
        setShowToast(true);
        setCashPaymentAmount('');

        await new Promise(resolve => setTimeout(resolve, 500));
        const paymentResponse = await secretaryApi.getPaymentById(selectedPayment.id);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      } else {
        setCashPaymentError(response.error || 'Failed to record cash payment');
      }
    } catch (error) {
      setCashPaymentError('Failed to record cash payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    setActionLoading(true);

    const response = await secretaryApi.markAsPaid(paymentId);

    if (response.success) {
      setToastMessage('Payment marked as paid successfully');
      setToastType('success');
      setShowToast(true);
      if (selectedPayment) {
        const paymentResponse = await secretaryApi.getPayment(appointmentId);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      }
      onClose();
      onSuccess();
    } else {
      setToastMessage(response.error || 'Failed to mark payment as paid');
      setToastType('error');
      setShowToast(true);
    }
    setActionLoading(false);
  };

  const handleSavePaymentMethod = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);
    setToastMessage('');
    setToastType('success');

    try {
      const response = await secretaryApi.updatePaymentMethod(selectedPayment.id, editedPaymentMethod);

      if (response.success) {
        setToastMessage('Payment method updated successfully');
        setShowToast(true);
        setIsEditingPaymentMethod(false);

        await new Promise(resolve => setTimeout(resolve, 500));
        const paymentResponse = await secretaryApi.getPayment(appointmentId);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      } else {
        setToastMessage(response.error || 'Failed to update payment method');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setToastMessage('Failed to update payment method');
      setToastType('error');
      setShowToast(true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteCheckup = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);

    // Check if payment is already fully paid
    if (selectedPayment.status === 'PAID') {
      // Payment is already paid, just complete the checkup and show invoice
      setToastMessage('Checkup completed successfully');
      setToastType('success');
      setShowToast(true);
      setShowCompleteCheckupModal(false);
      setShowInvoiceModal(true);
      setActionLoading(false);
      return;
    }

    // Payment is not fully paid yet, mark it as paid
    const response = await secretaryApi.markAsPaid(selectedPayment.id);

    if (response.success) {
      setToastMessage('Checkup completed and payment marked as paid');
      setToastType('success');
      setShowToast(true);
      setShowCompleteCheckupModal(false);
      if (selectedPayment) {
        const paymentResponse = await secretaryApi.getPayment(appointmentId);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      }
      // Show invoice modal after successful payment
      setShowInvoiceModal(true);
    } else {
      setToastMessage(response.error || 'Failed to complete checkup');
      setToastType('error');
      setShowToast(true);
    }
    setActionLoading(false);
  };

  const handleViewReceipt = async (paymentId: string) => {
    setIsFetchingReceiptUrl(true);
    setReceiptSignedUrl(null);
    setReceiptImageLoaded(false);
    setReceiptImageError(false);

    const response = await secretaryApi.getSignedReceiptUrl(paymentId);

    if (response.success && response.data?.signedUrl) {
      setReceiptSignedUrl(response.data.signedUrl);
      setShowReceiptModal(true);
    } else {
      setToastMessage(response.error || 'Failed to load receipt');
      setToastType('error');
      setShowToast(true);
      setReceiptImageError(true);
    }
    setIsFetchingReceiptUrl(false);
  };

  if (!isOpen) return null;

  if (isLoadingPayment) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="text-slate-600 mt-3">Loading payment details...</p>
        </div>
      </div>
    );
  }

  // Show initial modal only if payment doesn't exist
  if (!selectedPayment) {
    // Show payment creation form (but display receipt if payment exists with one)
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">
                {isWalkIn ? 'Record Walk-in Payment' : 'Record Payment'}
              </h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                isWalkIn
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {isWalkIn ? 'Walk-in' : 'Booked'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[24px] text-slate-500">close</span>
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Form Error */}
            {chargeFormError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-700">{chargeFormError}</p>
              </div>
            )}

            {/* Patient Information */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Patient Information</h3>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-700">
                  <span className="font-medium">Patient:</span> {patientName}
                </p>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'GCASH')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="CASH">CASH</option>
                <option value="GCASH">GCASH</option>
              </select>
            </div>

            {/* Consultation Fee */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Consultation Fee
              </label>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-lg font-bold text-slate-900">{formatAmount(consultationFee)}</p>
              </div>
            </div>

            {/* Additional Charges Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Additional Charges</h3>
                <button
                  onClick={() => setShowAddChargeModal(true)}
                  disabled={actionLoading}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                >
                  + Add Charge
                </button>
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                {tempCharges.length === 0 ? (
                  <p className="text-slate-500 italic">No additional charges</p>
                ) : (
                  tempCharges.map((charge, index) => (
                    <div key={index} className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <span className="text-slate-600">{charge.description}:</span>
                          <span className="text-slate-900">{formatAmount(charge.amount)}</span>
                        </div>
                        {charge.chargeType === 'MEDICINE' && charge.quantity && charge.unitPrice && (
                          <div className="text-xs text-slate-500 mt-1">
                            Qty: {charge.quantity} × {formatAmount(charge.unitPrice)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveTempCharge(index)}
                        disabled={actionLoading}
                        className="ml-2 text-red-600 hover:text-red-700 disabled:opacity-50"
                        title="Remove charge"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  ))
                )}
                {tempCharges.length > 0 && (
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold">
                    <span className="text-slate-900">Total:</span>
                    <span className="text-slate-900">{formatAmount(calculateWalkInTotal())}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cash Payment Section */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Cash Payment (At Clinic)</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                {/* Amount Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Amount Received (₱)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCashPaymentAmount(calculateWalkInTotal().toString());
                        setCashPaymentError(null);
                      }}
                      disabled={actionLoading}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                    >
                      Use total amount
                    </button>
                  </div>
                  <input
                    type="number"
                    value={cashPaymentAmount}
                    onChange={(e) => {
                      setCashPaymentAmount(e.target.value);
                      setCashPaymentError(null);
                    }}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    disabled={actionLoading}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                {/* Change Display */}
                {cashPaymentAmount && getWalkInChange(cashPaymentAmount) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-700 font-medium">Change:</span>
                      <span className="font-bold text-emerald-900">{formatAmount(getWalkInChange(cashPaymentAmount))}</span>
                    </div>
                  </div>
                )}

                {cashPaymentError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                    {cashPaymentError}
                  </div>
                )}
              </div>
            </div>

            {/* Info message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[20px] text-blue-600 mt-0.5">info</span>
                <div className="text-sm">
                  <p className="font-medium text-blue-900">Create Payment Record</p>
                  <p className="text-blue-700 mt-1">
                    Click "Create Payment" to create the payment record with charges and payment. The payment will be marked as paid if the full amount is received.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePayment}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {actionLoading ? 'Creating...' : 'Create Payment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900">Payment Details</h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                isWalkIn
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {isWalkIn ? 'Walk-in' : 'Booked'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[24px] text-slate-500">close</span>
            </button>
          </div>
          <div className="p-6 space-y-6">
            {/* Patient Information */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Patient Information</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Name:</span>
                  <span className="text-slate-900 font-medium">
                    {selectedPayment.patient_first_name} {selectedPayment.patient_last_name}
                  </span>
                </div>
                {selectedPayment.patient_phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Phone:</span>
                    <span className="text-slate-900">{selectedPayment.patient_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Appointment Information */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Appointment Information</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Date & Time:</span>
                  <span className="text-slate-900">{formatDate(selectedPayment.appointment_date)}</span>
                </div>
                {selectedPayment.reason_for_visit && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Reason for Visit:</span>
                    <span className="text-slate-900">{selectedPayment.reason_for_visit}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600">Payment Method:</span>
                  {isEditingPaymentMethod ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editedPaymentMethod}
                        onChange={(e) => setEditedPaymentMethod(e.target.value as 'CASH' | 'GCASH')}
                        className="px-3 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm"
                      >
                        <option value="CASH">CASH</option>
                        <option value="GCASH">GCASH</option>
                      </select>
                      <button
                        onClick={() => handleSavePaymentMethod()}
                        disabled={actionLoading}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setIsEditingPaymentMethod(false);
                          setEditedPaymentMethod(selectedPayment.payment_method as 'CASH' | 'GCASH');
                        }}
                        disabled={actionLoading}
                        className="text-xs text-slate-600 hover:text-slate-700 font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900">{selectedPayment.payment_method}</span>
                      {selectedPayment.amount_paid === 0 && (selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && (
                        <button
                          onClick={() => {
                            setIsEditingPaymentMethod(true);
                            setEditedPaymentMethod(selectedPayment.payment_method as 'CASH' | 'GCASH');
                          }}
                          disabled={actionLoading}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Receipt */}
            {selectedPayment.payment_method === 'GCASH' ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment Receipt</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                  {selectedPayment.receipt_url ? (
                    <>
                      <button
                        onClick={() => handleViewReceipt(selectedPayment.id)}
                        disabled={isFetchingReceiptUrl}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                        {isFetchingReceiptUrl ? 'Loading...' : 'View Receipt'}
                      </button>
                      {(selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && calculateBalance(selectedPayment) > 0 && (
                        <button
                          onClick={async () => {
                            const balance = calculateBalance(selectedPayment);
                            setAdvancePaymentAmount(balance.toString());
                            setAdvancePaymentError(null);
                            // Automatically record the payment as GCash
                            setActionLoading(true);
                            try {
                              const response = await secretaryApi.recordPartialPayment(selectedPayment.id, balance, 'GCASH');
                              if (response.success) {
                                setToastMessage(response.data?.status === 'PAID' ? 'Payment fully paid' : 'Advance payment recorded');
                                setShowToast(true);
                                setAdvancePaymentAmount('');
                                await new Promise(resolve => setTimeout(resolve, 500));
                                const paymentResponse = await secretaryApi.getPayment(appointmentId);
                                if (paymentResponse.success && paymentResponse.data) {
                                  setSelectedPayment(paymentResponse.data);
                                }
                              } else {
                                setAdvancePaymentError(response.error || 'Failed to record advance payment');
                              }
                            } catch (error) {
                              setAdvancePaymentError('Failed to record advance payment');
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          disabled={actionLoading}
                          className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[20px]">request_quote</span>
                          {actionLoading ? 'Recording...' : 'Apply Receipt Amount to Balance'}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
                      No receipt uploaded yet
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Charges Breakdown */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Charges Breakdown</h3>
                {(selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && (
                  <button
                    onClick={() => setShowAddChargeModal(true)}
                    disabled={actionLoading}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    + Add Charge
                  </button>
                )}
              </div>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Consultation Fee:</span>
                  <span className="text-slate-900">{formatAmount(selectedPayment.consultation_amount)}</span>
                </div>
                {selectedPayment.charges && selectedPayment.charges.length > 0 && (
                  <>
                    {selectedPayment.charges.map((charge: PaymentCharge) => (
                      <div key={charge.id} className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="text-slate-600">{charge.description}:</span>
                            <span className="text-slate-900">{formatAmount(charge.amount)}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Added {formatDate(charge.created_at)}
                            {charge.created_by_first_name && charge.created_by_last_name && (
                              <> by {charge.created_by_first_name} {charge.created_by_last_name}</>
                            )}
                          </div>
                        </div>
                        {(selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && (
                          <button
                            onClick={() => {
                              setChargeToDelete(charge);
                              setShowDeleteChargeDialog(true);
                            }}
                            disabled={actionLoading}
                            className="ml-2 text-red-600 hover:text-red-700 disabled:opacity-50"
                            title="Delete charge"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </>
                )}
                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold">
                  <span className="text-slate-900">Total:</span>
                  <span className="text-slate-900">
                    {formatAmount(calculateTotalAmount(selectedPayment))}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Balance Breakdown */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment Status</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Amount:</span>
                  <span className="text-slate-900 font-semibold">
                    {formatAmount(calculateTotalAmount(selectedPayment))}
                  </span>
                </div>
                {selectedPayment.payment_method === 'GCASH' && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Advance Paid (GCash):</span>
                    <span className="text-purple-700 font-semibold">{formatAmount(selectedPayment.amount_paid)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-600">Cash Paid (At Clinic):</span>
                  <span className="text-emerald-700 font-semibold">{formatAmount(0)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                  <span className="text-slate-700 font-medium">Total Paid:</span>
                  <span className="text-slate-900 font-bold">{formatAmount(selectedPayment.amount_paid)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                  <span className="text-slate-700 font-medium">Remaining Balance:</span>
                  <span className="text-slate-900 font-bold">{formatAmount(calculateBalance(selectedPayment))}</span>
                </div>
              </div>
            </div>

            {/* Advance Payment Section (GCash Receipts) */}
            {selectedPayment.payment_method === 'GCASH' && (selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && calculateBalance(selectedPayment) > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Advance Payment (GCash Receipt)</h3>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Advance Payment Amount from Receipt (₱)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setAdvancePaymentAmount(calculateBalance(selectedPayment).toString());
                          setAdvancePaymentError(null);
                        }}
                        disabled={actionLoading}
                        className="text-xs text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
                      >
                        Use outstanding balance
                      </button>
                    </div>
                    <input
                      type="number"
                      value={advancePaymentAmount}
                      onChange={(e) => {
                        setAdvancePaymentAmount(e.target.value);
                        setAdvancePaymentError(null);
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      disabled={actionLoading}
                      className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Outstanding balance: {formatAmount(calculateBalance(selectedPayment))}
                    </p>
                  </div>

                  {/* Balance After Payment */}
                  {advancePaymentAmount && getBalanceAfterPayment(advancePaymentAmount) && (
                    <div className="bg-purple-100 border border-purple-300 rounded-lg px-3 py-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-700 font-medium">Balance after this payment:</span>
                        <span className="font-bold text-purple-900">{formatAmount(getBalanceAfterPayment(advancePaymentAmount))}</span>
                      </div>
                    </div>
                  )}

                  {advancePaymentError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                      {advancePaymentError}
                    </div>
                  )}

                  <button
                    onClick={handleRecordAdvancePayment}
                    disabled={actionLoading || !advancePaymentAmount}
                    className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {actionLoading ? 'Processing...' : 'Record Advance Payment'}
                  </button>
                </div>
              </div>
            )}

            {/* Cash Payment Section (At Clinic) */}
            {(selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && calculateBalance(selectedPayment) > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Cash Payment (At Clinic)</h3>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Cash Amount Received (₱)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setCashPaymentAmount(calculateBalance(selectedPayment).toString());
                          setCashPaymentError(null);
                        }}
                        disabled={actionLoading}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                      >
                        Use outstanding balance
                      </button>
                    </div>
                    <input
                      type="number"
                      value={cashPaymentAmount}
                      onChange={(e) => {
                        setCashPaymentAmount(e.target.value);
                        setCashPaymentError(null);
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      disabled={actionLoading}
                      className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Outstanding balance: {formatAmount(calculateBalance(selectedPayment))}
                    </p>
                  </div>

                  {/* Balance After Payment */}
                  {cashPaymentAmount && getBalanceAfterPayment(cashPaymentAmount) && (
                    <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-3 py-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-700 font-medium">Balance after this payment:</span>
                        <span className="font-bold text-emerald-900">{formatAmount(getBalanceAfterPayment(cashPaymentAmount))}</span>
                      </div>
                    </div>
                  )}

                  {/* Change Display */}
                  {cashPaymentAmount && getChange(cashPaymentAmount) && (
                    <div className="bg-emerald-100 border border-emerald-300 rounded-lg px-3 py-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-700 font-medium">Change:</span>
                        <span className="font-bold text-emerald-900">{formatAmount(getChange(cashPaymentAmount))}</span>
                      </div>
                    </div>
                  )}

                  {cashPaymentError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                      {cashPaymentError}
                    </div>
                  )}

                  <button
                    onClick={handleRecordCashPayment}
                    disabled={actionLoading || !cashPaymentAmount}
                    className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {actionLoading ? 'Processing...' : 'Record Cash Payment'}
                  </button>
                </div>
              </div>
            )}

            {/* Mark as Paid Button - only shown when amount_paid > 0 and status is not PAID */}
            {selectedPayment.amount_paid > 0 && (selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && (
              <div>
                <button
                  onClick={() => setShowCompleteCheckupModal(true)}
                  disabled={actionLoading}
                  className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {actionLoading ? 'Processing...' : 'Complete Payment & Mark as Paid'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Complete Checkup Modal */}
      {showCompleteCheckupModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Complete Checkup</h3>
            <p className="text-sm text-slate-600 mb-4">
              Confirm that the checkup is complete and the payment should be marked as fully paid?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCompleteCheckupModal(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteCheckup}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {actionLoading ? 'Completing...' : 'Confirm Complete Checkup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Image Modal */}
      {showReceiptModal && receiptSignedUrl && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-slate-900">GCash Advance Payment Receipt</h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptSignedUrl(null);
                  setAdvancePaymentAmount('');
                  setAdvancePaymentError(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[24px] text-slate-500">close</span>
              </button>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center bg-slate-100 min-h-[200px] overflow-auto">
              {!receiptImageLoaded && !receiptImageError && (
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="text-slate-600 mt-3 text-sm">Loading receipt...</p>
                </div>
              )}
              {receiptImageError && (
                <div className="text-center">
                  <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">broken_image</span>
                  <p className="text-slate-600 font-medium">Failed to load receipt</p>
                  <p className="text-xs text-slate-500 mt-1">The receipt image could not be loaded</p>
                </div>
              )}
              <img
                src={receiptSignedUrl}
                alt="Payment Receipt"
                className={`max-w-full max-h-[400px] object-contain rounded-lg ${!receiptImageLoaded && !receiptImageError ? 'hidden' : ''}`}
                onLoad={() => setReceiptImageLoaded(true)}
                onError={() => setReceiptImageError(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Charge Modal */}
      {showAddChargeModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Charge</h3>
            <div className="space-y-4">
              {/* Charge Type Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Charge Type</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setChargeType('ADDITIONAL');
                      setChargeFormError(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      chargeType === 'ADDITIONAL'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    disabled={actionLoading}
                  >
                    Additional
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChargeType('MEDICINE');
                      setChargeFormError(null);
                    }}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      chargeType === 'MEDICINE'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                    disabled={actionLoading}
                  >
                    Medicine
                  </button>
                </div>
              </div>

              {chargeType === 'ADDITIONAL' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={chargeDescription}
                      onChange={(e) => {
                        setChargeDescription(e.target.value);
                        setChargeFormError(null);
                      }}
                      placeholder="e.g., Lab tests, Additional services"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900"
                      disabled={actionLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₱)</label>
                    <input
                      type="number"
                      value={chargeAmount}
                      onChange={(e) => {
                        setChargeAmount(e.target.value);
                        setChargeFormError(null);
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900"
                      disabled={actionLoading}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Medicine Name</label>
                    <input
                      type="text"
                      value={medicineName}
                      onChange={(e) => {
                        setMedicineName(e.target.value);
                        setChargeFormError(null);
                      }}
                      placeholder="e.g., Paracetamol 500mg"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900"
                      disabled={actionLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={medicineQuantity}
                      onChange={(e) => {
                        setMedicineQuantity(e.target.value);
                        setChargeFormError(null);
                      }}
                      placeholder="1"
                      step="1"
                      min="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900"
                      disabled={actionLoading}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unit Price (₱)</label>
                    <input
                      type="number"
                      value={medicineUnitPrice}
                      onChange={(e) => {
                        setMedicineUnitPrice(e.target.value);
                        setChargeFormError(null);
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900"
                      disabled={actionLoading}
                    />
                  </div>
                  {medicineQuantity && medicineUnitPrice && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <span className="text-slate-600">Total: </span>
                      <span className="font-semibold text-slate-900">
                        ₱{(parseFloat(medicineQuantity) * parseFloat(medicineUnitPrice)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              )}

              {chargeFormError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {chargeFormError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowAddChargeModal(false);
                    setChargeFormError(null);
                    setChargeDescription('');
                    setChargeAmount('');
                    setMedicineName('');
                    setMedicineQuantity('');
                    setMedicineUnitPrice('');
                    setChargeType('ADDITIONAL');
                  }}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCharge}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  {actionLoading ? 'Adding...' : 'Add Charge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Charge Confirmation Dialog */}
      {showDeleteChargeDialog && chargeToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Charge</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete the charge "{chargeToDelete.description}" with amount {formatAmount(chargeToDelete.amount)}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteChargeDialog(false);
                  setChargeToDelete(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCharge}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <Toast
          type={toastType}
          message={toastMessage}
          onClose={() => setShowToast(false)}
        />
      )}

      {showInvoiceModal && selectedPayment && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            onClose();
            onSuccess();
          }}
          paymentId={selectedPayment.id}
        />
      )}
    </>
  );
}
