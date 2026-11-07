'use client';

import React, { useState, useEffect } from 'react';
import {
  secretaryApi,
  PaymentBillingData,
  PaymentCharge,
  PaymentTransaction,
  BillingStatus,
} from '@/lib/api/secretaryApi';

interface BillingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
  appointmentId?: string;
  queueNumber?: number | string;
  onPaymentComplete?: () => void;
}

type ChargeType = 'SERVICE' | 'MEDICINE' | 'OTHER';

const STATUS_CHIPS: Record<BillingStatus, string> = {
  UNPAID: 'bg-red-100 text-red-800',
  FOR_REVIEW: 'bg-amber-100 text-amber-800',
  PARTIAL: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  OVERPAID: 'bg-purple-100 text-purple-800',
};

const STATUS_LABELS: Record<BillingStatus, string> = {
  UNPAID: 'Unpaid',
  FOR_REVIEW: 'For review',
  PARTIAL: 'Partial',
  PAID: 'Paid ✓',
  OVERPAID: 'Overpaid',
};

const TX_STATUS_CLASSES: Record<string, string> = {
  ACCEPTED: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  REJECTED: 'bg-red-100 text-red-800',
  VOIDED: 'bg-gray-100 text-gray-800',
};

const CHARGE_TYPE_LABELS: Record<string, string> = {
  SERVICE: 'Service',
  MEDICINE: 'Medicine',
  OTHER: 'Other',
  ADDITIONAL: 'Service',
};

const money = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: unknown): string => `₱${money(value).toFixed(2)}`;

// Asia/Manila date + time, e.g. "Nov 7, 2026 · 2:48 PM". Split payments often
// land minutes apart, so the time matters.
const formatTransactionDate = (value: string): string => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return '';
  const formatted = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return formatted.replace(',', ' ·');
};

const formatMethod = (method?: string | null): string => {
  if (!method) return '';
  if (method === 'CASH') return 'Cash';
  if (method === 'GCASH') return 'GCash';
  return method.charAt(0) + method.slice(1).toLowerCase();
};

export default function BillingPanel({
  isOpen,
  onClose,
  paymentId,
  appointmentId,
  queueNumber,
  onPaymentComplete,
}: BillingPanelProps) {
  const [paymentData, setPaymentData] = useState<PaymentBillingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Payment form state
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'GCASH'>('CASH');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [cashTendered, setCashTendered] = useState('');

  // Add-charge form state (one row for every charge type)
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [chargeType, setChargeType] = useState<ChargeType>('SERVICE');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeQuantity, setChargeQuantity] = useState('1');
  const [chargeUnitPrice, setChargeUnitPrice] = useState('');
  const [chargeError, setChargeError] = useState('');

  // Remove-charge confirmation state
  const [deleteTarget, setDeleteTarget] = useState<PaymentCharge | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Reject receipt state
  const [selectedTransaction, setSelectedTransaction] = useState<PaymentTransaction | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  // Void/correct reason state
  const [voidTarget, setVoidTarget] = useState<PaymentTransaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidNote, setVoidNote] = useState('');
  const [correctInvoiceOpen, setCorrectInvoiceOpen] = useState(false);
  const [correctReason, setCorrectReason] = useState('');
  const [correctNote, setCorrectNote] = useState('');

  // Receipt viewer state
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransaction | null>(null);
  const [receiptImageUrl, setReceiptImageUrl] = useState<string | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    if (isOpen && (paymentId || appointmentId)) {
      fetchPaymentData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, paymentId, appointmentId]);

  // Prefill the amount with the current balance, and keep it in sync after a
  // payment is recorded (the balance shrinks to the remaining amount).
  useEffect(() => {
    if (!paymentData) return;
    const summary = paymentData.billingSummary;
    if (
      !paymentData.activeInvoice &&
      summary.billingStatus !== 'PAID' &&
      summary.billingStatus !== 'OVERPAID'
    ) {
      setPaymentAmount(summary.balance > 0 ? summary.balance.toFixed(2) : '');
    }
  }, [paymentData]);

  const fetchPaymentData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = appointmentId
        ? await secretaryApi.getPaymentBillingByAppointment(appointmentId)
        : await secretaryApi.getPaymentBillingById(paymentId);
      if (response.success && response.data) {
        setPaymentData(response.data);
      } else {
        setError(response.error || 'Failed to load payment data');
      }
    } catch {
      setError('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const resetChargeForm = () => {
    setChargeDescription('');
    setChargeQuantity('1');
    setChargeUnitPrice('');
    setChargeError('');
  };

  const handleAddCharge = async () => {
    setChargeError('');

    if (!chargeDescription.trim()) {
      setChargeError('Name is required');
      return;
    }

    const quantity = parseFloat(chargeQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setChargeError('Quantity must be a positive number');
      return;
    }

    const unitPrice = parseFloat(chargeUnitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setChargeError('Unit price must be a positive number');
      return;
    }

    const lineTotal = Math.round(quantity * unitPrice * 100) / 100;

    const response = await secretaryApi.addCharge(paymentId, {
      chargeType,
      name: chargeDescription.trim(),
      description: chargeDescription.trim(),
      quantity,
      unitPrice,
      amount: lineTotal,
    });

    if (response.success) {
      // Keep the row open so the secretary can add another item right away.
      resetChargeForm();
      fetchPaymentData();
    } else {
      setChargeError(response.error || 'Failed to add charge');
    }
  };

  const handleDeleteCharge = (charge: PaymentCharge) => {
    setDeleteError('');
    setDeleteTarget(charge);
  };

  const confirmDeleteCharge = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    setDeleteError('');
    setError('');
    try {
      const response = await secretaryApi.deleteCharge(paymentId, deleteTarget.id);
      if (response.success) {
        setDeleteTarget(null);
        fetchPaymentData();
      } else {
        setDeleteError(response.error || 'Failed to delete charge');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async () => {
    if (saving) return;

    const amount = parseFloat(paymentAmount);
    if (!paymentAmount || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }
    if (paymentMethod === 'GCASH' && !referenceNo.trim()) {
      setError('Reference number is required for GCash payments');
      return;
    }
    if (paymentMethod === 'CASH' && cashTendered.trim() !== '') {
      const tendered = parseFloat(cashTendered);
      if (!Number.isFinite(tendered)) {
        setError('Please enter a valid cash tendered amount');
        return;
      }
      if (tendered + 0.005 < amount) {
        setError(
          `Cash tendered (${formatMoney(tendered)}) is less than the amount to record (${formatMoney(amount)}).`
        );
        return;
      }
    }

    setError('');
    setSaving(true);
    try {
      const response = await secretaryApi.recordTransaction(paymentId, {
        kind: 'PAYMENT',
        method: paymentMethod,
        amount,
        reference_no: referenceNo.trim() || null,
      });

      if (response.success) {
        setPaymentAmount('');
        setReferenceNo('');
        setCashTendered('');
        fetchPaymentData();
        onPaymentComplete?.();
      } else {
        setError(response.error || 'Failed to record payment');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptReceipt = async (tx: PaymentTransaction) => {
    const response = await secretaryApi.acceptTransaction(paymentId, tx.id);
    if (response.success) {
      fetchPaymentData();
      onPaymentComplete?.();
    } else {
      setError(response.error || 'Failed to accept receipt');
    }
  };

  const handleRejectReceipt = async () => {
    if (!selectedTransaction) return;
    if (!rejectReason) {
      setError('Please provide a rejection reason');
      return;
    }
    const response = await secretaryApi.rejectTransaction(paymentId, selectedTransaction.id, {
      reason: rejectReason,
      note: rejectNote || undefined,
    });
    if (response.success) {
      setSelectedTransaction(null);
      setRejectReason('');
      setRejectNote('');
      fetchPaymentData();
      onPaymentComplete?.();
    } else {
      setError(response.error || 'Failed to reject receipt');
    }
  };

  const handleVoidTransaction = async () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      setError('Please provide a void reason');
      return;
    }
    const response = await secretaryApi.voidTransaction(paymentId, voidTarget.id, {
      reason: voidReason.trim(),
      note: voidNote || undefined,
    });
    if (response.success) {
      setVoidTarget(null);
      setVoidReason('');
      setVoidNote('');
      fetchPaymentData();
      onPaymentComplete?.();
    } else {
      setError(response.error || 'Failed to void payment');
    }
  };

  const handleRefund = async () => {
    const amountStr = window.prompt('Enter refund amount:');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setError('Invalid refund amount');
      return;
    }
    const reason = window.prompt('Enter refund reason:');
    if (!reason) return;
    const response = await secretaryApi.createRefund(paymentId, {
      method: paymentMethod,
      amount,
      reason,
    });
    if (response.success) {
      fetchPaymentData();
      onPaymentComplete?.();
    } else {
      setError(response.error || 'Failed to process refund');
    }
  };

  const handleIssueInvoice = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await secretaryApi.issueInvoice(paymentId);
      if (response.success) {
        fetchPaymentData();
      } else {
        setError(response.error || 'Failed to issue invoice');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleViewReceipt = async (tx: PaymentTransaction) => {
    if (!tx.receipt_url) return;
    setLoadingReceipt(true);
    setSelectedReceipt(tx);
    try {
      const response = await secretaryApi.getSignedReceiptUrl(paymentId);
      if (response.success && response.data?.signedUrl) {
        setReceiptImageUrl(response.data.signedUrl);
      } else {
        setError(response.error || 'Failed to load receipt');
        setSelectedReceipt(null);
      }
    } catch {
      setError('Failed to load receipt');
      setSelectedReceipt(null);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleCloseReceiptViewer = () => {
    setSelectedReceipt(null);
    setReceiptImageUrl(null);
  };

  const handleCorrectInvoice = async () => {
    if (!paymentData?.activeInvoice || saving) return;
    if (!correctReason.trim()) {
      setError('Please provide a reason for editing the bill');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await secretaryApi.correctInvoice(paymentData.activeInvoice.id, {
        reason: correctReason.trim(),
        note: correctNote.trim() || undefined,
      });
      if (response.success) {
        setCorrectInvoiceOpen(false);
        setCorrectReason('');
        setCorrectNote('');
        fetchPaymentData();
      } else {
        setError(response.error || 'Failed to edit the bill');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const billingStatus: BillingStatus = (paymentData?.billingSummary?.billingStatus as BillingStatus) || 'UNPAID';
  const balance = money(paymentData?.billingSummary?.balance);
  const billTotal = money(paymentData?.billingSummary?.billTotal);
  const netPaid = money(paymentData?.billingSummary?.netPaid);
  const consultationAmount = money(paymentData?.payment?.consultation_amount);
  const transactions = paymentData?.transactions || [];
  const charges = paymentData?.charges || [];
  const hasActiveInvoice = !!paymentData?.activeInvoice;

  const patientName = paymentData?.payment
    ? `${paymentData.payment.patient_first_name || ''} ${paymentData.payment.patient_last_name || ''}`.trim() || 'Patient'
    : 'Loading...';

  const effectiveQueueNumber = queueNumber ?? paymentData?.payment?.queue_number ?? null;
  const queueLabel = effectiveQueueNumber !== undefined && effectiveQueueNumber !== null && effectiveQueueNumber !== ''
    ? `Q-${String(effectiveQueueNumber).padStart(2, '0')}`
    : '';
  const headerTitle = `Billing${queueLabel ? ` · ${queueLabel}` : ''} · ${patientName}`;

  const enteredAmount = parseFloat(paymentAmount);
  const validEnteredAmount = Number.isFinite(enteredAmount) ? enteredAmount : 0;
  const remainingAfterPayment = balance - validEnteredAmount;
  const recordButtonLabel = validEnteredAmount > 0
    ? remainingAfterPayment > 0.005
      ? `Record ${formatMoney(validEnteredAmount)} · ${formatMoney(remainingAfterPayment)} left`
      : `Record ${formatMoney(validEnteredAmount)}`
    : 'Record payment';

  const cashTenderedValue = cashTendered.trim() === '' ? null : parseFloat(cashTendered);
  const cashTenderedValid = cashTenderedValue !== null && Number.isFinite(cashTenderedValue);
  const showCashChange = paymentMethod === 'CASH' && cashTenderedValid && validEnteredAmount > 0;
  const changeAmount = showCashChange ? (cashTenderedValue as number) - validEnteredAmount : 0;
  const cashShortfall = showCashChange && changeAmount < -0.005 ? Math.abs(changeAmount) : 0;

  const deleteNewBillTotal = deleteTarget ? Math.max(0, billTotal - money(deleteTarget.amount)) : 0;
  const deleteOverpayment = deleteTarget && netPaid > deleteNewBillTotal + 0.005
    ? netPaid - deleteNewBillTotal
    : 0;

  const chargeLineTotal = (parseFloat(chargeQuantity) || 0) * (parseFloat(chargeUnitPrice) || 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{headerTitle}</h2>
            <p className="text-sm text-gray-600">Review the bill, record payments, and issue the invoice.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary Strip */}
        <div className="bg-gray-50 p-4 border-b">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-lg font-bold text-gray-900">{formatMoney(billTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Paid</p>
              <p className="text-lg font-bold text-green-600">{formatMoney(netPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Balance</p>
              <p className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(balance)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <div className="mt-1 flex justify-center">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${STATUS_CHIPS[billingStatus] || STATUS_CHIPS.UNPAID}`}>
                  {STATUS_LABELS[billingStatus] || billingStatus}
                </span>
              </div>
            </div>
          </div>
          {paymentData?.payment?.payment_method && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Booked as: {formatMethod(paymentData.payment.payment_method)}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && !paymentData ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !paymentData ? (
            <div className="text-red-600 text-center py-8">{error || 'No payment data found'}</div>
          ) : (
            <div className="p-6 space-y-6">
              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {error}
                </div>
              )}

              {/* Bill */}
              <section className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
                  <div>
                    <h3 className="font-semibold text-gray-900">Bill</h3>
                    <p className="text-xs text-gray-500">Consultation fee and additional charges</p>
                  </div>
                  {!hasActiveInvoice ? (
                    <button
                      onClick={() => {
                        setShowAddCharge((open) => !open);
                        setChargeError('');
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                    >
                      {showAddCharge ? 'Close form' : '+ Add charge'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setCorrectInvoiceOpen(true);
                        setCorrectReason('');
                        setCorrectNote('');
                      }}
                      className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                    >
                      Edit bill…
                    </button>
                  )}
                </div>

                {hasActiveInvoice && (
                  <p className="text-sm text-amber-700 bg-amber-50 border-b border-amber-200 px-4 py-2">
                    Invoice issued. Edit bill to change charges.
                  </p>
                )}

                <div className="divide-y divide-gray-100">
                  {/* Consultation fee is part of the bill total, so show it as a locked line. */}
                  <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/60">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Consultation fee</p>
                      <p className="text-xs text-gray-500">Locked · set by the doctor&apos;s fee</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatMoney(consultationAmount)}</span>
                  </div>

                  {charges.map((charge) => (
                    <div key={charge.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{charge.description}</p>
                        <p className="text-xs text-gray-500">
                          {CHARGE_TYPE_LABELS[charge.charge_type || 'ADDITIONAL'] || charge.charge_type}
                          {charge.quantity != null && charge.unit_price != null && (
                            <> · {charge.quantity} × {formatMoney(charge.unit_price)}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-900">{formatMoney(charge.amount)}</span>
                        {!hasActiveInvoice && (
                          <button
                            onClick={() => handleDeleteCharge(charge)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {charges.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No additional charges</p>
                  )}

                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                    <span className="text-sm font-semibold text-gray-700">Total</span>
                    <span className="text-sm font-bold text-gray-900">{formatMoney(billTotal)}</span>
                  </div>
                </div>

                {showAddCharge && !hasActiveInvoice && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                        <select
                          value={chargeType}
                          onChange={(e) => { setChargeType(e.target.value as ChargeType); setChargeError(''); }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                          <option value="SERVICE">Service</option>
                          <option value="MEDICINE">Medicine</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                        <input
                          type="text"
                          value={chargeDescription}
                          onChange={(e) => { setChargeDescription(e.target.value); setChargeError(''); }}
                          placeholder="e.g. Wound dressing"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={chargeQuantity}
                          onChange={(e) => { setChargeQuantity(e.target.value); setChargeError(''); }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Unit price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={chargeUnitPrice}
                          onChange={(e) => { setChargeUnitPrice(e.target.value); setChargeError(''); }}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="md:col-span-2 text-right">
                        <p className="text-xs font-medium text-gray-600 mb-1">Line total</p>
                        <p className="text-sm font-bold text-gray-900 py-2">{formatMoney(chargeLineTotal)}</p>
                      </div>
                    </div>

                    {chargeError && (
                      <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
                        {chargeError}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCharge}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        Add item
                      </button>
                      <button
                        onClick={() => { setShowAddCharge(false); resetChargeForm(); }}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 text-sm font-medium"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Payments */}
              <section className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
                  <div>
                    <h3 className="font-semibold text-gray-900">Payments</h3>
                    <p className="text-xs text-gray-500">Accepted, pending, and voided transactions</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className={`flex items-start justify-between gap-3 px-4 py-3 ${tx.status === 'PENDING' ? 'bg-yellow-50/60' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {tx.kind === 'PAYMENT' ? 'Payment' : 'Refund'} · {formatMethod(tx.method)}
                          {tx.source === 'PATIENT_UPLOAD' && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Patient upload</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTransactionDate(tx.created_at)}
                          {tx.reference_no && ` · Ref: ${tx.reference_no}`}
                          {tx.patient_declared_amount != null && ` · Declared: ${formatMoney(tx.patient_declared_amount)}`}
                          {tx.void_reason && ` · Void: ${tx.void_reason}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className={`text-sm font-bold ${tx.kind === 'REFUND' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.kind === 'REFUND' ? '-' : '+'}{formatMoney(tx.amount)}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${TX_STATUS_CLASSES[tx.status] || 'bg-gray-100 text-gray-800'}`}>
                          {tx.status}
                        </span>
                        {tx.receipt_url && (
                          <button
                            onClick={() => handleViewReceipt(tx)}
                            disabled={loadingReceipt}
                            className="text-xs text-blue-600 underline hover:text-blue-800 disabled:opacity-50"
                          >
                            Receipt
                          </button>
                        )}
                        {tx.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleAcceptReceipt(tx)}
                              className="px-2.5 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => { setSelectedTransaction(tx); setRejectReason(''); setRejectNote(''); }}
                              className="px-2.5 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {tx.status === 'ACCEPTED' && !hasActiveInvoice && (
                          <button
                            onClick={() => { setVoidTarget(tx); setVoidReason(''); setVoidNote(''); }}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Void
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No transactions yet</p>
                  )}
                </div>
              </section>

              {/* Collect payment */}
              {!hasActiveInvoice && billingStatus !== 'PAID' && billingStatus !== 'OVERPAID' && (
                <section className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">Collect payment</h3>
                      <p className="text-xs text-gray-500">Record a cash or GCash payment against this bill</p>
                    </div>
                    <p className="text-sm text-gray-600">
                      Balance <span className="font-bold text-gray-900">{formatMoney(balance)}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Payment method</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPaymentMethod('CASH')}
                          className={`flex-1 px-4 py-2 rounded ${paymentMethod === 'CASH' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          Cash
                        </button>
                        <button
                          onClick={() => setPaymentMethod('GCASH')}
                          className={`flex-1 px-4 py-2 rounded ${paymentMethod === 'GCASH' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                          GCash
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {paymentMethod === 'CASH' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cash tendered</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                        {showCashChange && (
                          <p className={`text-sm mt-1 font-medium ${cashShortfall > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {cashShortfall > 0
                              ? `Short by ${formatMoney(cashShortfall)} — collect at least ${formatMoney(validEnteredAmount)}.`
                              : `Change: ${formatMoney(changeAmount)}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reference number</label>
                        <input
                          type="text"
                          value={referenceNo}
                          onChange={(e) => setReferenceNo(e.target.value)}
                          placeholder="GCash reference number"
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    The record button stays at the bottom of this window.
                  </p>
                </section>
              )}

              {/* Refund */}
              {billingStatus === 'OVERPAID' && (
                <section className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-800 mb-1">Overpaid — refund required</h3>
                  <p className="text-sm text-purple-700 mb-4">
                    This bill is overpaid by {formatMoney(netPaid - billTotal)}. Please process a refund.
                  </p>
                  <button
                    onClick={handleRefund}
                    className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Process refund
                  </button>
                </section>
              )}

              {/* Invoice card (only once it exists) */}
              {paymentData.activeInvoice ? (
                <section className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{paymentData.activeInvoice.invoice_number}</h3>
                      <p className="text-sm text-gray-600">
                        Issued: {new Date(paymentData.activeInvoice.created_at).toLocaleDateString()}
                      </p>
                      {paymentData.activeInvoice.invoice_data?.replaces_invoice_number && (
                        <p className="text-xs text-gray-500">
                          Replaces {paymentData.activeInvoice.invoice_data.replaces_invoice_number}
                        </p>
                      )}
                    </div>
                    <span className="px-3 py-1 bg-green-600 text-white text-sm rounded">ACTIVE</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total amount</p>
                      <p className="font-bold">{formatMoney(paymentData.activeInvoice.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Payment method</p>
                      <p className="font-bold">{formatMethod(paymentData.activeInvoice.payment_method)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => secretaryApi.getInvoiceDownloadUrl(paymentData.activeInvoice!.id).then((r) => {
                        if (r.success && r.data?.downloadUrl) window.open(r.data.downloadUrl, '_blank');
                      })}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                    >
                      View / Print
                    </button>
                    <button
                      onClick={() => {
                        setCorrectInvoiceOpen(true);
                        setCorrectReason('');
                        setCorrectNote('');
                      }}
                      className="flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 text-sm"
                    >
                      Edit bill…
                    </button>
                  </div>
                </section>
              ) : billingStatus === 'PAID' ? (
                <section className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-800 font-medium">This bill is paid in full.</p>
                  <p className="text-sm text-green-700 mt-1">
                    No active invoice, issue one when paid.
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    Issue the invoice to give the patient their receipt.
                  </p>
                </section>
              ) : null}
            </div>
          )}
        </div>

        {/* Sticky primary action */}
        {paymentData && !hasActiveInvoice && billingStatus !== 'OVERPAID' && (
          <div className="border-t bg-white px-6 py-4 shrink-0">
            {billingStatus === 'PAID' ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-green-700">Paid in full</p>
                  <p className="text-xs text-gray-500">Issue the invoice to give the patient their receipt.</p>
                </div>
                <button
                  onClick={handleIssueInvoice}
                  disabled={saving}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Issuing…' : 'Issue invoice'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Balance {formatMoney(balance)}</p>
                  <p className="text-xs text-gray-500">
                    {formatMethod(paymentMethod)}
                    {cashShortfall > 0
                      ? ` · cash short by ${formatMoney(cashShortfall)}`
                      : validEnteredAmount > 0
                        ? ` · recording ${formatMoney(validEnteredAmount)}`
                        : ' · enter an amount above'}
                  </p>
                </div>
                <button
                  onClick={handleRecordPayment}
                  disabled={saving || cashShortfall > 0}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Recording…' : recordButtonLabel}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Remove Charge Modal */}
        {deleteTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-2">Remove charge?</h3>
              <p className="text-sm text-gray-700">
                Remove <span className="font-medium">{deleteTarget.description}</span> ({formatMoney(deleteTarget.amount)}) from this bill?
              </p>
              {deleteOverpayment > 0 && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  Removing this would overpay the bill by {formatMoney(deleteOverpayment)}. Void a payment first.
                </div>
              )}
              {deleteError && (
                <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {deleteError}
                </div>
              )}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={confirmDeleteCharge}
                  disabled={saving || deleteOverpayment > 0}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Removing…' : 'Remove charge'}
                </button>
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={saving}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Receipt Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Reject Receipt</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Required)</label>
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select reason...</option>
                    <option value="INVALID_RECEIPT">Invalid receipt</option>
                    <option value="WRONG_AMOUNT">Wrong amount</option>
                    <option value="DUPLICATE">Duplicate receipt</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note (Optional)</label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleRejectReceipt}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                >
                  Reject
                </button>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Void Transaction Modal */}
        {voidTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-4">Void Payment</h3>
              <p className="text-sm text-gray-600 mb-4">
                Voiding {formatMoney(voidTarget.amount)} ({formatMethod(voidTarget.method)}).
                {hasActiveInvoice ? ' The active invoice will also be voided.' : ''}
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Required)</label>
                  <input
                    type="text"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="e.g. Wrong amount, duplicate entry"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note (Optional)</label>
                  <textarea
                    value={voidNote}
                    onChange={(e) => setVoidNote(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleVoidTransaction}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
                >
                  Void
                </button>
                <button
                  onClick={() => setVoidTarget(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Bill Modal */}
        {correctInvoiceOpen && paymentData?.activeInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold mb-2">Edit bill</h3>
              <p className="text-sm font-semibold text-amber-800 mb-4">
                This will void {paymentData.activeInvoice.invoice_number} and unlock the bill.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                After voiding, you can change charges and issue a replacement invoice.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Required)</label>
                <select
                  value={correctReason}
                  onChange={(e) => setCorrectReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select reason...</option>
                  <option value="Forgot item">Forgot item</option>
                  <option value="Wrong amount">Wrong amount</option>
                  <option value="Wrong price">Wrong price</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Note (Optional)</label>
                <textarea
                  value={correctNote}
                  onChange={(e) => setCorrectNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Optional details for the audit trail"
                />
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleCorrectInvoice}
                  disabled={saving || !correctReason.trim()}
                  className="flex-1 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Unlocking…' : 'Void & unlock'}
                </button>
                <button
                  onClick={() => setCorrectInvoiceOpen(false)}
                  disabled={saving}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Viewer Modal */}
        {selectedReceipt && receiptImageUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Receipt</h3>
                <button
                  onClick={handleCloseReceiptViewer}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4 bg-gray-50">
                <img
                  src={receiptImageUrl}
                  alt="Payment receipt"
                  className="max-w-full h-auto mx-auto"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
