'use client';

import { useState, useEffect, useMemo } from 'react';
import { secretaryApi } from '@/lib/api/secretaryApi';
import Toast from './ui/Toast';

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

interface AdditionalCharge {
  id: string;
  chargeType?: 'ADDITIONAL' | 'MEDICINE';
  description: string;
  amount: number;
  name?: string;
  quantity?: number;
  unitPrice?: number;
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
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH'>('CASH');
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);
  const [newChargeDescription, setNewChargeDescription] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [chargeFormError, setChargeFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [chargeType, setChargeType] = useState<'ADDITIONAL' | 'MEDICINE'>('ADDITIONAL');
  const [medicineName, setMedicineName] = useState('');
  const [medicineQuantity, setMedicineQuantity] = useState('');
  const [medicineUnitPrice, setMedicineUnitPrice] = useState('');
  const [existingPayment, setExistingPayment] = useState<{
    amountPaid: number;
    balance: number;
    status: string;
  } | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod(initialPaymentMethod || 'CASH');
      setAdditionalCharges([]);
      setNewChargeDescription('');
      setNewChargeAmount('');
      setChargeFormError(null);
      setIsSubmitting(false);
      setChargeType('ADDITIONAL');
      setMedicineName('');
      setMedicineQuantity('');
      setMedicineUnitPrice('');
      setExistingPayment(null);

      // Fetch existing payment data for booked patients
      if (!isWalkIn) {
        fetchExistingPayment();
      }
    }
  }, [isOpen, initialPaymentMethod, isWalkIn, appointmentId]);

  const fetchExistingPayment = async () => {
    setIsLoadingPayment(true);
    try {
      const response = await secretaryApi.getPayment(appointmentId);
      if (response.success && response.data) {
        setExistingPayment({
          amountPaid: response.data.amount_paid || 0,
          balance: response.data.balance || 0,
          status: response.data.status,
        });
      }
    } catch (error) {
      console.error('Failed to fetch existing payment:', error);
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleAddCharge = () => {
    setChargeFormError(null);

    if (chargeType === 'MEDICINE') {
      // Medicine charge validation
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

      const totalAmount = numQuantity * numUnitPrice;

      const newCharge: AdditionalCharge = {
        id: Date.now().toString(),
        chargeType: 'MEDICINE',
        description: trimmedName,
        amount: totalAmount,
        name: trimmedName,
        quantity: numQuantity,
        unitPrice: numUnitPrice,
      };

      setAdditionalCharges([...additionalCharges, newCharge]);
      setMedicineName('');
      setMedicineQuantity('');
      setMedicineUnitPrice('');
    } else {
      // Additional charge validation
      const trimmedDescription = newChargeDescription.trim();
      if (!trimmedDescription) {
        setChargeFormError('Description is required');
        return;
      }

      const numAmount = parseFloat(newChargeAmount);
      if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
        setChargeFormError('Amount must be a valid positive number');
        return;
      }

      const newCharge: AdditionalCharge = {
        id: Date.now().toString(),
        chargeType: 'ADDITIONAL',
        description: trimmedDescription,
        amount: numAmount,
      };

      setAdditionalCharges([...additionalCharges, newCharge]);
      setNewChargeDescription('');
      setNewChargeAmount('');
    }
  };

  const handleDeleteCharge = (chargeId: string) => {
    setAdditionalCharges(additionalCharges.filter(charge => charge.id !== chargeId));
  };

  const totalCharges = useMemo(() => {
    return additionalCharges.reduce((sum, charge) => {
      const chargeAmount = typeof charge.amount === 'string' ? parseFloat(charge.amount) : charge.amount;
      return sum + (isNaN(chargeAmount) || !isFinite(chargeAmount) ? 0 : chargeAmount);
    }, 0);
  }, [additionalCharges]);

  const totalAmount = useMemo(() => {
    // If there's an existing payment with a balance, use that as the base amount
    // Otherwise, use the consultation fee
    const baseAmount = existingPayment && existingPayment.balance > 0
      ? existingPayment.balance
      : (consultationFee !== null && consultationFee !== undefined && !isNaN(consultationFee) && isFinite(consultationFee)
          ? consultationFee
          : 0);
    // Round to 2 decimal places to avoid floating-point precision errors
    return Math.round((baseAmount + totalCharges) * 100) / 100;
  }, [totalCharges, consultationFee, existingPayment]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setChargeFormError(null);

    try {
      // Convert charges to the format expected by the backend
      const chargesPayload = additionalCharges.map(charge => ({
        description: charge.description,
        amount: charge.amount,
      }));

      const response = await secretaryApi.recordPayment({
        appointmentId,
        paymentMethod,
        consultationFee,
        additionalCharges: chargesPayload,
      });

      if (response.success) {
        const message = paymentMethod === 'CASH'
          ? 'Payment recorded. You must explicitly confirm receipt as PAID.'
          : 'Payment recorded. Patient will upload GCash receipt for verification.';
        setToastMessage(message);
        setToastType('success');
        setShowToast(true);
        onSuccess();
        onClose();
      } else {
        setChargeFormError(response.error || 'Failed to record payment');
        setToastMessage(response.error || 'Failed to record payment');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setChargeFormError('Failed to record payment. Please try again.');
      setToastMessage('Failed to record payment');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount: number | string | null | undefined) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (numAmount === null || numAmount === undefined || isNaN(numAmount) || !isFinite(numAmount)) {
      return '₱0.00';
    }
    return `₱${numAmount.toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">
              {isWalkIn ? 'Record Walk-in Payment' : 'Record Payment'}
            </h2>
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

            {/* Payment Status for Booked Patients */}
            {!isWalkIn && (
              <>
                {isLoadingPayment ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <p className="text-sm text-slate-600">Loading payment status...</p>
                  </div>
                ) : existingPayment ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment Status</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Amount Paid:</span>
                        <span className="text-slate-900 font-medium">{formatAmount(existingPayment.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200">
                        <span className="text-slate-700 font-medium">Remaining Balance:</span>
                        <span className="text-slate-900 font-bold">{formatAmount(existingPayment.balance)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[20px] text-amber-600 mt-0.5">info</span>
                      <div className="text-sm">
                        <p className="font-medium text-amber-900">New Payment</p>
                        <p className="text-amber-700 mt-1">
                          This patient will have a new payment record created. 
                          Use the Payments page to mark payments as PAID or verify GCash receipts.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Additional Charges */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Additional Charges</h3>
              </div>

              {/* Charge Type Selector */}
              <div className="bg-slate-50 rounded-lg p-4 mb-3">
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
                    disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  >
                    Medicine
                  </button>
                </div>
              </div>

              {/* Add Charge Form */}
              <div className="bg-slate-50 rounded-lg p-4 mb-3">
                {chargeType === 'ADDITIONAL' ? (
                  <>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={newChargeDescription}
                        onChange={(e) => {
                          setNewChargeDescription(e.target.value);
                          setChargeFormError(null);
                        }}
                        placeholder="Description (e.g., Lab tests, Additional services)"
                        className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm text-slate-900"
                      />
                      <input
                        type="number"
                        value={newChargeAmount}
                        onChange={(e) => {
                          setNewChargeAmount(e.target.value);
                          setChargeFormError(null);
                        }}
                        placeholder="Amount"
                        min="0"
                        step="0.01"
                        className="w-full sm:w-32 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-sm text-slate-900"
                      />
                      <button
                        onClick={handleAddCharge}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Add
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
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
                          disabled={isSubmitting}
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
                          disabled={isSubmitting}
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
                          disabled={isSubmitting}
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
                      <button
                        onClick={handleAddCharge}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Add Charge
                      </button>
                    </div>
                  </>
                )}
                {chargeFormError && (
                  <p className="text-red-600 text-xs mt-2">{chargeFormError}</p>
                )}
              </div>

              {/* Charges List */}
              {additionalCharges.length > 0 && (
                <div className="space-y-2">
                  {additionalCharges.map((charge) => (
                    <div
                      key={charge.id}
                      className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{charge.description}</p>
                        <p className="text-sm text-slate-600">{formatAmount(charge.amount)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCharge(charge.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete charge"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing Payment Balance Display */}
              {existingPayment && existingPayment.balance > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-800 font-medium">Existing Balance</span>
                    <span className="text-amber-900 font-bold">{formatAmount(existingPayment.balance)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="space-y-2 mb-3">
                {existingPayment && existingPayment.balance > 0 ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-800">Remaining Balance</span>
                      <span className="text-blue-900 font-medium">{formatAmount(existingPayment.balance)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-800">Consultation Fee</span>
                    <span className="text-blue-900 font-medium">{formatAmount(consultationFee)}</span>
                  </div>
                )}
                {additionalCharges.length > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-800">Additional Charges</span>
                    <span className="text-blue-900 font-medium">
                      {formatAmount(totalCharges)}
                    </span>
                  </div>
                )}
                {existingPayment && existingPayment.amountPaid > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-800">Previously Paid</span>
                    <span className="text-blue-900 font-medium">{formatAmount(existingPayment.amountPaid)}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-blue-200 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">
                    Total Amount Owed
                  </span>
                  <span className="text-2xl font-bold text-blue-900">
                    {formatAmount(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>

      {showToast && (
        <Toast
          type={toastType}
          message={toastMessage}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}
