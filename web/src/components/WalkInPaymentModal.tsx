'use client';

import { useState, useEffect } from 'react';
import { secretaryApi } from '@/lib/api/secretaryApi';
import Toast from './ui/Toast';

interface WalkInPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  consultationFee: number;
  patientName: string;
  onSuccess: () => void;
}

interface AdditionalCharge {
  id: string;
  description: string;
  amount: number;
}

export default function WalkInPaymentModal({
  isOpen,
  onClose,
  appointmentId,
  consultationFee,
  patientName,
  onSuccess,
}: WalkInPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH'>('CASH');
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);
  const [newChargeDescription, setNewChargeDescription] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [chargeFormError, setChargeFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('CASH');
      setAdditionalCharges([]);
      setNewChargeDescription('');
      setNewChargeAmount('');
      setChargeFormError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleAddCharge = () => {
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
      description: trimmedDescription,
      amount: numAmount,
    };

    setAdditionalCharges([...additionalCharges, newCharge]);
    setNewChargeDescription('');
    setNewChargeAmount('');
    setChargeFormError(null);
  };

  const handleDeleteCharge = (chargeId: string) => {
    setAdditionalCharges(additionalCharges.filter(charge => charge.id !== chargeId));
  };

  const calculateTotal = () => {
    const totalCharges = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const validConsultationFee = (consultationFee !== null && consultationFee !== undefined && !isNaN(consultationFee) && isFinite(consultationFee))
      ? consultationFee
      : 0;
    return validConsultationFee + totalCharges;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setChargeFormError(null);

    try {
      const response = await secretaryApi.recordWalkInPayment({
        appointmentId,
        paymentMethod,
        consultationFee,
        additionalCharges,
      });

      if (response.success) {
        const message = paymentMethod === 'CASH'
          ? 'Payment Recorded'
          : 'Payment Pending - Patient will upload receipt later';
        setToastMessage(message);
        setToastType('success');
        setShowToast(true);
        onSuccess();
        onClose();
      } else {
        setToastMessage(response.error || 'Failed to record payment');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setToastMessage('Failed to record payment');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined || isNaN(amount) || !isFinite(amount)) {
      return '₱0.00';
    }
    return `₱${amount.toFixed(2)}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Record Walk-in Payment</h2>
          </div>

          <div className="p-6 space-y-6">
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

            {/* Additional Charges */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Additional Charges</h3>
              </div>

              {/* Add Charge Form */}
              <div className="bg-slate-50 rounded-lg p-4 mb-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newChargeDescription}
                    onChange={(e) => {
                      setNewChargeDescription(e.target.value);
                      setChargeFormError(null);
                    }}
                    placeholder="Description (e.g., Medicine)"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm"
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
                    className="w-full sm:w-32 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm"
                  />
                  <button
                    onClick={handleAddCharge}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
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
            </div>

            {/* Total */}
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-purple-900">Total Amount</span>
                <span className="text-2xl font-bold text-purple-900">{formatAmount(calculateTotal())}</span>
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
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
