'use client';

import { useState, useEffect } from 'react';
import { secretaryApi, Payment, PaymentCharge } from '@/lib/api/secretaryApi';
import Toast from '@/components/ui/Toast';

type TabType = 'UNPAID' | 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED' | 'CANCELLED';

const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  UNPAID: 'Unpaid',
  CANCELLED: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  UNPAID: 'bg-slate-50 text-slate-600 border-slate-200',
  CANCELLED: 'bg-slate-50 text-slate-500 border-slate-300',
};

export default function SecretaryPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('UNPAID');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentDetailsLoading, setPaymentDetailsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptImageLoaded, setReceiptImageLoaded] = useState(false);
  const [receiptImageError, setReceiptImageError] = useState(false);
  const [receiptSignedUrl, setReceiptSignedUrl] = useState<string | null>(null);
  const [isFetchingReceiptUrl, setIsFetchingReceiptUrl] = useState(false);
  const [paymentCounts, setPaymentCounts] = useState({ unpaid: 0, pending: 0, paid: 0, rejected: 0, cancelled: 0 });
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
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState('');
  const [recordPaymentError, setRecordPaymentError] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptPaymentError, setReceiptPaymentError] = useState<string | null>(null);

  // Calculate real-time balance after receipt payment
  const getBalanceAfterPayment = (amount: string) => {
    if (!selectedPayment || !amount) return null;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) return null;
    const currentBalance = parseFloat(selectedPayment.balance);
    const newBalance = currentBalance - numericAmount;
    return newBalance >= 0 ? newBalance.toFixed(2) : null;
  };

  useEffect(() => {
    fetchPayments();
    fetchPaymentCounts();
  }, [activeTab]);

  // Auto-refresh payments every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPayments();
      fetchPaymentCounts();
    }, 60000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchPayments = async () => {
    setLoading(true);

    const response = await secretaryApi.getPayments(activeTab);
    if (response.success && response.data) {
      setPayments(response.data);
    } else {
      setToastMessage(response.error || 'Failed to fetch payments');
      setToastType('error');
      setShowToast(true);
    }
    setLoading(false);
  };

  const fetchPaymentCounts = async () => {
    const response = await secretaryApi.getPaymentCounts();
    if (response.success && response.data) {
      setPaymentCounts({
        unpaid: response.data.UNPAID,
        pending: response.data.PENDING_VERIFICATION,
        paid: response.data.PAID,
        rejected: response.data.REJECTED,
        cancelled: response.data.CANCELLED,
      });
    }
  };

  const handleVerify = async (paymentId: string) => {
    setActionLoading(true);

    const response = await secretaryApi.verifyPayment(paymentId);

    if (response.success) {
      setToastMessage('Payment verified successfully');
      setToastType('success');
      setShowToast(true);
      setShowVerifyDialog(false);
      // Refresh payment details to show verification metadata
      if (selectedPayment) {
        const paymentResponse = await secretaryApi.getPayment(selectedPayment.appointment_id);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      }
      fetchPayments();
      fetchPaymentCounts();
    } else {
      setToastMessage(response.error || 'Failed to verify payment');
      setToastType('error');
      setShowToast(true);
    }
    setActionLoading(false);
  };

  const handleReject = async (paymentId: string) => {
    setActionLoading(true);

    const response = await secretaryApi.rejectPayment(paymentId);

    if (response.success) {
      setToastMessage('Payment rejected successfully');
      setToastType('success');
      setShowToast(true);
      setShowRejectDialog(false);
      setShowDetailsModal(false);
      fetchPayments();
      fetchPaymentCounts();
    } else {
      setToastMessage(response.error || 'Failed to reject payment');
      setToastType('error');
      setShowToast(true);
    }
    setActionLoading(false);
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    setActionLoading(true);

    const response = await secretaryApi.markAsPaid(paymentId);

    if (response.success) {
      setToastMessage('Payment marked as paid successfully');
      setToastType('success');
      setShowToast(true);
      // Refresh payment details to show updated status
      if (selectedPayment) {
        const paymentResponse = await secretaryApi.getPayment(selectedPayment.appointment_id);
        if (paymentResponse.success && paymentResponse.data) {
          setSelectedPayment(paymentResponse.data);
        }
      }
      // Close the modal since payment is now PAID (different from verification)
      setShowDetailsModal(false);
      fetchPayments();
      fetchPaymentCounts();
    } else {
      setToastMessage(response.error || 'Failed to mark payment as paid');
      setToastType('error');
      setShowToast(true);
    }
    setActionLoading(false);
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
        // Medicine charge validation
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
        // Additional charge validation
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

      console.log('Add charge response:', response);

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

        // Refresh payment list, counts, and the selected payment details
        try {
          await Promise.all([
            fetchPayments(),
            fetchPaymentCounts(),
          ]);

          // Wait a moment for database to commit, then re-fetch
          await new Promise(resolve => setTimeout(resolve, 500));

          // Re-fetch the specific payment to update selectedPayment state
          if (selectedPayment) {
            const paymentResponse = await secretaryApi.getPaymentById(selectedPayment.id);
            if (paymentResponse.success && paymentResponse.data) {
              console.log('Refreshed payment data:', paymentResponse.data);
              console.log('Total amount:', paymentResponse.data.total_amount);
              console.log('Amount paid:', paymentResponse.data.amount_paid);
              console.log('Balance:', paymentResponse.data.balance);
              setSelectedPayment(paymentResponse.data);
            }
          }
        } catch (refreshError) {
          setToastMessage('Charge added but failed to refresh payment data');
          setToastType('error');
          setShowToast(true);
        }
      } else {
        console.error('Failed to add charge:', response.error);
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

        // Refresh payment list, counts, and the selected payment details
        try {
          await Promise.all([
            fetchPayments(),
            fetchPaymentCounts(),
          ]);

          // Re-fetch the specific payment to update selectedPayment state
          const paymentResponse = await secretaryApi.getPayment(selectedPayment.appointment_id);
          if (paymentResponse.success && paymentResponse.data) {
            setSelectedPayment(paymentResponse.data);
          }
        } catch (refreshError) {
          setToastMessage('Charge deleted but failed to refresh payment data');
          setToastType('error');
          setShowToast(true);
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

  const handleRecordPayment = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);
    setToastMessage('');
    setToastType('success');
    setRecordPaymentError(null);

    try {
      const numericAmount = parseFloat(amountReceived);
      if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
        setRecordPaymentError('Amount must be a valid positive number');
        setActionLoading(false);
        return;
      }

      const response = await secretaryApi.recordPartialPayment(selectedPayment.id, numericAmount);

      if (response.success) {
        setToastMessage(response.data?.status === 'PAID' ? 'Payment fully paid' : 'Partial payment recorded');
        setShowToast(true);
        setShowRecordPaymentModal(false);
        setAmountReceived('');

        // Refresh payment list, counts, and the selected payment details
        try {
          await Promise.all([
            fetchPayments(),
            fetchPaymentCounts(),
          ]);

          // Re-fetch the specific payment to update selectedPayment state
          const paymentResponse = await secretaryApi.getPayment(selectedPayment.appointment_id);
          if (paymentResponse.success && paymentResponse.data) {
            console.log('Record payment - Refreshed payment data:', paymentResponse.data);
            console.log('Record payment - Total amount:', paymentResponse.data.total_amount);
            console.log('Record payment - Amount paid:', paymentResponse.data.amount_paid);
            console.log('Record payment - Balance:', paymentResponse.data.balance);
            setSelectedPayment(paymentResponse.data);
          }
        } catch (refreshError) {
          setToastMessage('Payment recorded but failed to refresh payment data');
          setToastType('error');
          setShowToast(true);
        }
      } else {
        // Enhance error message with outstanding balance context
        if (response.error?.includes('cannot exceed outstanding balance')) {
          setRecordPaymentError(
            `${response.error}. Please adjust the amount or click "Use outstanding balance" to record the correct payment.`
          );
        } else {
          setRecordPaymentError(response.error || 'Failed to record payment');
        }
      }
    } catch (error) {
      setRecordPaymentError('Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPaymentFromReceipt = async () => {
    if (!selectedPayment) return;

    setActionLoading(true);
    setToastMessage('');
    setToastType('success');
    setReceiptPaymentError(null);

    try {
      const numericAmount = parseFloat(receiptAmount);
      if (isNaN(numericAmount) || !isFinite(numericAmount) || numericAmount <= 0) {
        setReceiptPaymentError('Amount must be a valid positive number');
        setActionLoading(false);
        return;
      }

      console.log('Recording payment from receipt:', {
        paymentId: selectedPayment.id,
        amount: numericAmount,
        currentAmountPaid: selectedPayment.amount_paid,
        currentBalance: selectedPayment.balance
      });

      const response = await secretaryApi.recordPartialPayment(selectedPayment.id, numericAmount);

      console.log('Record payment response:', response);

      if (response.success) {
        setToastMessage(response.data?.status === 'PAID' ? 'Payment fully paid' : 'Partial payment recorded');
        setShowToast(true);
        setShowReceiptModal(false);
        setReceiptAmount('');
        setReceiptSignedUrl(null);

        // Refresh payment list, counts, and the selected payment details
        try {
          await Promise.all([
            fetchPayments(),
            fetchPaymentCounts(),
          ]);

          // Wait a moment for database to commit, then re-fetch
          await new Promise(resolve => setTimeout(resolve, 500));

          // Re-fetch the specific payment to update selectedPayment state
          const paymentResponse = await secretaryApi.getPaymentById(selectedPayment.id);
          if (paymentResponse.success && paymentResponse.data) {
            console.log('Refreshed payment data:', paymentResponse.data);
            console.log('Total amount:', paymentResponse.data.total_amount);
            console.log('Amount paid:', paymentResponse.data.amount_paid);
            console.log('Balance:', paymentResponse.data.balance);
            setSelectedPayment(paymentResponse.data);
          }
        } catch (refreshError) {
          setToastMessage('Payment recorded but failed to refresh payment data');
          setToastType('error');
          setShowToast(true);
        }
      } else {
        console.error('Failed to record payment:', response.error);
        // Enhance error message with outstanding balance context
        if (response.error?.includes('cannot exceed outstanding balance')) {
          setReceiptPaymentError(
            `${response.error}. Please adjust the amount or click "Use outstanding balance" to record the correct payment.`
          );
        } else {
          setReceiptPaymentError(response.error || 'Failed to record payment');
        }
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      setReceiptPaymentError('Failed to record payment');
    } finally {
      setActionLoading(false);
    }
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

  const unpaidCount = paymentCounts.unpaid;
  const pendingCount = paymentCounts.pending;
  const paidCount = paymentCounts.paid;
  const rejectedCount = paymentCounts.rejected;
  const cancelledCount = paymentCounts.cancelled;

  const filteredPayments = payments.filter(p => p.status === activeTab);

  // Group payments by appointment date
  const groupPaymentsByDate = (payments: Payment[]): Record<string, { payments: Payment[]; originalDate: string }> => {
    const grouped: Record<string, { payments: Payment[]; originalDate: string }> = {};
    payments.forEach(payment => {
      if (payment.appointment_date) {
        const originalDate = payment.appointment_date;
        const displayDate = new Date(originalDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        if (!grouped[displayDate]) {
          grouped[displayDate] = { payments: [], originalDate };
        }
        grouped[displayDate].payments.push(payment);
      }
    });
    return grouped;
  };

  const groupedPayments = groupPaymentsByDate(filteredPayments);
  const sortedDates = Object.keys(groupedPayments).sort((a, b) => {
    // Sort dates in ascending order (oldest first, newest last)
    return new Date(groupedPayments[a].originalDate).getTime() - new Date(groupedPayments[b].originalDate).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <nav className="flex overflow-x-auto gap-1 p-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('UNPAID')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'UNPAID'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Unpaid ({unpaidCount})
          </button>
          <button
            onClick={() => setActiveTab('PENDING_VERIFICATION')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'PENDING_VERIFICATION'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setActiveTab('PAID')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'PAID'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Paid ({paidCount})
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'REJECTED'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
          <button
            onClick={() => setActiveTab('CANCELLED')}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors ${
              activeTab === 'CANCELLED'
                ? 'bg-[#1b5eb8] text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Cancelled ({cancelledCount})
          </button>
        </nav>

        {/* Refresh Button */}
        <div className="px-4 py-3 border-b border-slate-200 flex justify-end">
          <button
            onClick={fetchPayments}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-sm text-slate-700 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-500">refresh</span>
            Refresh
          </button>
        </div>

        {/* Payment List */}
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              <p className="text-slate-600 mt-3">Loading payments...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-5xl text-slate-300 mb-3">receipt_long</span>
              <p className="text-slate-600 font-medium">No {STATUS_LABELS[activeTab].toLowerCase()} payments</p>
              <p className="text-xs text-slate-500 mt-1">
                {activeTab === 'UNPAID'
                  ? 'Payments without receipts will appear here'
                  : activeTab === 'PENDING_VERIFICATION'
                  ? 'Payments awaiting verification will appear here'
                  : activeTab === 'PAID'
                  ? 'Paid payments will appear here'
                  : activeTab === 'REJECTED'
                  ? 'Rejected payments will appear here'
                  : 'Cancelled GCash payments will appear here'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-700 bg-slate-100 px-4 py-2 rounded-lg inline-block">
                      {date}
                    </h3>
                  </div>

                  {/* Payments for this date */}
                  <div className="grid gap-4">
                    {groupedPayments[date].payments.map((payment) => (
                      <div
                        key={payment.id}
                        className={`bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors cursor-pointer ${paymentDetailsLoading ? 'opacity-50 pointer-events-none' : ''}`}
                        onClick={async () => {
                          setPaymentDetailsLoading(true);
                          // Fetch fresh payment details with charges
                          const paymentResponse = await secretaryApi.getPayment(payment.appointment_id);
                          setPaymentDetailsLoading(false);
                          if (paymentResponse.success && paymentResponse.data) {
                            setSelectedPayment(paymentResponse.data);
                            setShowDetailsModal(true);
                          } else {
                            setToastMessage(paymentResponse.error || 'Failed to load payment details');
                            setToastType('error');
                            setShowToast(true);
                          }
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="material-symbols-outlined text-[20px] text-slate-500">person</span>
                              <h3 className="text-sm font-semibold text-slate-900 truncate">
                                {payment.patient_first_name} {payment.patient_last_name}
                              </h3>
                            </div>
                            <div className="space-y-1 text-xs text-slate-600">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
                                <span>{formatDate(payment.appointment_date)}</span>
                              </div>
                              {payment.reason_for_visit && (
                                <div className="flex items-center gap-2">
                                  <span className="material-symbols-outlined text-[16px] text-slate-400">description</span>
                                  <span className="truncate">{payment.reason_for_visit}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">payments</span>
                                <span>{payment.payment_method}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                                <span>{payment.status === 'UNPAID' ? 'Created' : 'Uploaded'} {formatDate(payment.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[payment.status]}`}>
                              {STATUS_LABELS[payment.status]}
                            </span>
                            <span className="text-lg font-bold text-slate-900">
                              {formatAmount(payment.balance)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Payment Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
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
                  <div className="flex justify-between">
                    <span className="text-slate-600">Payment Method:</span>
                    <span className="text-slate-900">{selectedPayment.payment_method}</span>
                  </div>
                </div>
              </div>

              {/* Receipt */}
              {selectedPayment.payment_method === 'GCASH' ? (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment Receipt</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    {selectedPayment.receipt_url ? (
                      <button
                        onClick={() => handleViewReceipt(selectedPayment.id)}
                        disabled={isFetchingReceiptUrl}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                        {isFetchingReceiptUrl ? 'Loading...' : 'View Receipt'}
                      </button>
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
                      {(() => {
                        const consultationAmount = typeof selectedPayment.consultation_amount === 'string'
                          ? parseFloat(selectedPayment.consultation_amount)
                          : (selectedPayment.consultation_amount || 0);
                        const charges = selectedPayment.charges || [];
                        const chargesTotal = charges.reduce((sum, charge) => {
                          const amount = typeof charge.amount === 'string' ? parseFloat(charge.amount) : charge.amount;
                          return sum + (amount || 0);
                        }, 0);
                        const total = consultationAmount + chargesTotal;
                        return formatAmount(total);
                      })()}
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
                      {formatAmount(
                        (typeof selectedPayment.consultation_amount === 'string'
                          ? parseFloat(selectedPayment.consultation_amount)
                          : (selectedPayment.consultation_amount || 0)) +
                        (selectedPayment.charges?.reduce((sum, charge) => {
                          const amount = typeof charge.amount === 'string' ? parseFloat(charge.amount) : charge.amount;
                          return sum + (amount || 0);
                        }, 0) || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Amount Paid:</span>
                    <span className="text-slate-900 font-semibold">{formatAmount(selectedPayment.amount_paid)}</span>
                  </div>
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between">
                    <span className="text-slate-700 font-medium">Remaining Balance:</span>
                    <span className="text-slate-900 font-bold">{formatAmount(selectedPayment.balance)}</span>
                  </div>
                </div>
              </div>

              {/* Verifier Information (for verified payments and verified pending payments) */}
              {(selectedPayment.status === 'PAID' || (selectedPayment.status === 'PENDING_VERIFICATION' && selectedPayment.verified_by)) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Verification Details</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Status:</span>
                      <span className="text-slate-900">
                        {selectedPayment.status === 'PAID' ? 'Verified & Paid' : 'Receipt Verified'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Verified By:</span>
                      <span className="text-slate-900">
                        {selectedPayment.verified_by_first_name} {selectedPayment.verified_by_last_name}
                      </span>
                    </div>
                    {selectedPayment.verified_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Verified At:</span>
                        <span className="text-slate-900">{formatDate(selectedPayment.verified_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rejection Details (for rejected payments) */}
              {selectedPayment.status === 'REJECTED' && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Rejection Details</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Rejected By:</span>
                      <span className="text-slate-900">
                        {selectedPayment.verified_by_first_name} {selectedPayment.verified_by_last_name}
                      </span>
                    </div>
                    {selectedPayment.verified_at && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">Rejected At:</span>
                        <span className="text-slate-900">{formatDate(selectedPayment.verified_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions for unpaid payments (cash) */}
              {selectedPayment.status === 'UNPAID' && (
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setShowRecordPaymentModal(true)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {actionLoading ? 'Recording...' : 'Record Payment'}
                  </button>
                  <button
                    onClick={() => handleMarkAsPaid(selectedPayment.id)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {actionLoading ? 'Marking...' : 'Mark Full Payment'}
                  </button>
                </div>
              )}

              {/* Actions for pending payments (GCash) */}
              {selectedPayment.status === 'PENDING_VERIFICATION' && (
                <div className="flex gap-3 pt-4 border-t border-slate-200">
                  {selectedPayment.verified_by ? (
                    // Receipt verified - show Mark as Paid button
                    <button
                      onClick={() => handleMarkAsPaid(selectedPayment.id)}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {actionLoading ? 'Marking...' : 'Mark as Paid'}
                    </button>
                  ) : (
                    // Receipt not verified - show Verify and Reject buttons
                    <>
                      <button
                        onClick={() => setShowVerifyDialog(true)}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      >
                        {actionLoading ? 'Verifying...' : 'Verify Payment'}
                      </button>
                      <button
                        onClick={() => setShowRejectDialog(true)}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      >
                        {actionLoading ? 'Rejecting...' : 'Reject Payment'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verify Confirmation Dialog */}
      {showVerifyDialog && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Verify Payment</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to verify this payment with a remaining balance of {formatAmount(selectedPayment.balance)} from{' '}
              {selectedPayment.patient_first_name} {selectedPayment.patient_last_name}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowVerifyDialog(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerify(selectedPayment.id)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {actionLoading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {showRejectDialog && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Reject Payment</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to reject this payment with a remaining balance of {formatAmount(selectedPayment.balance)} from{' '}
              {selectedPayment.patient_first_name} {selectedPayment.patient_last_name}?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectDialog(false)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedPayment.id)}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {actionLoading ? 'Rejecting...' : 'Reject'}
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
              <h3 className="text-lg font-bold text-slate-900">Payment Receipt</h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptSignedUrl(null);
                  setReceiptAmount('');
                  setReceiptPaymentError(null);
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
            {/* Payment Recording Section */}
            {(selectedPayment.status === 'UNPAID' || selectedPayment.status === 'PENDING_VERIFICATION') && (
              <div className="p-4 border-t border-slate-200 bg-white flex-shrink-0 max-h-[50vh] overflow-y-auto">
                <div className="space-y-3">
                  {/* Outstanding Balance Display */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Total Amount:</span>
                      <span className="font-semibold text-slate-900">
                        {formatAmount(
                          (typeof selectedPayment.consultation_amount === 'string' ? parseFloat(selectedPayment.consultation_amount) : (selectedPayment.consultation_amount || 0)) +
                          (selectedPayment.charges?.reduce((sum, charge) => {
                            const amount = typeof charge.amount === 'string' ? parseFloat(charge.amount) : charge.amount;
                            return sum + (amount || 0);
                          }, 0) || 0)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-600">Amount Paid:</span>
                      <span className="font-semibold text-slate-900">{formatAmount(selectedPayment.amount_paid)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 pt-2 border-t border-slate-200">
                      <span className="text-slate-700 font-medium">Outstanding Balance:</span>
                      <span className="font-bold text-slate-900">{formatAmount(selectedPayment.balance)}</span>
                    </div>
                  </div>

                  {/* Amount Received Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-slate-700">Amount from Receipt (₱)</label>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptAmount(selectedPayment.balance);
                          setReceiptPaymentError(null);
                        }}
                        disabled={actionLoading}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                      >
                        Use outstanding balance
                      </button>
                    </div>
                    <input
                      type="number"
                      value={receiptAmount}
                      onChange={(e) => {
                        setReceiptAmount(e.target.value);
                        setReceiptPaymentError(null);
                      }}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900 ${
                        receiptAmount && parseFloat(receiptAmount) > parseFloat(selectedPayment.balance)
                          ? 'border-amber-300 focus:ring-amber-500'
                          : 'border-slate-300'
                      }`}
                      disabled={actionLoading}
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Outstanding balance: {formatAmount(selectedPayment.balance)}
                    </p>
                  </div>

                  {/* Warning when amount exceeds balance */}
                  {receiptAmount && parseFloat(receiptAmount) > parseFloat(selectedPayment.balance) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">warning</span>
                        <div className="text-sm">
                          <p className="text-amber-800 font-medium">Amount exceeds outstanding balance</p>
                          <p className="text-amber-700 mt-1">
                            The receipt amount ({formatAmount(receiptAmount)}) is greater than the outstanding balance ({formatAmount(selectedPayment.balance)}).
                            This may be due to additional charges added after the receipt was uploaded.
                          </p>
                          <p className="text-amber-700 mt-1">
                            Please adjust the amount or click "Use outstanding balance" to record the correct payment.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Real-time Balance After Payment */}
                  {receiptAmount && getBalanceAfterPayment(receiptAmount) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 font-medium">Balance after this payment:</span>
                        <span className="font-bold text-blue-900">{formatAmount(getBalanceAfterPayment(receiptAmount))}</span>
                      </div>
                    </div>
                  )}

                  {receiptPaymentError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                      {receiptPaymentError}
                    </div>
                  )}

                  <button
                    onClick={handleRecordPaymentFromReceipt}
                    disabled={actionLoading || !receiptAmount}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {actionLoading ? 'Recording...' : 'Record Payment'}
                  </button>
                </div>
              </div>
            )}
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
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddChargeModal(false);
                  setChargeDescription('');
                  setChargeAmount('');
                  setMedicineName('');
                  setMedicineQuantity('');
                  setMedicineUnitPrice('');
                  setChargeType('ADDITIONAL');
                  setChargeFormError(null);
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
      )}

      {/* Delete Charge Confirmation Dialog */}
      {showDeleteChargeDialog && chargeToDelete && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Charge</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete the charge "{chargeToDelete.description}" ({formatAmount(chargeToDelete.amount)})?
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

      {/* Record Payment Modal */}
      {showRecordPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Record Payment</h3>
            <div className="space-y-4">
              {/* Outstanding Balance Display */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Total Amount:</span>
                  <span className="font-semibold text-slate-900">
                    {formatAmount(
                      (typeof selectedPayment.consultation_amount === 'string' ? parseFloat(selectedPayment.consultation_amount) : (selectedPayment.consultation_amount || 0)) +
                      (selectedPayment.charges?.reduce((sum, charge) => {
                        const amount = typeof charge.amount === 'string' ? parseFloat(charge.amount) : charge.amount;
                        return sum + (amount || 0);
                      }, 0) || 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-600">Amount Paid:</span>
                  <span className="font-semibold text-slate-900">{formatAmount(selectedPayment.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1 pt-2 border-t border-slate-200">
                  <span className="text-slate-700 font-medium">Outstanding Balance:</span>
                  <span className="font-bold text-slate-900">{formatAmount(selectedPayment.balance)}</span>
                </div>
              </div>

              {/* Amount Received Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-slate-700">Amount Received (₱)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setAmountReceived(selectedPayment.balance);
                      setRecordPaymentError(null);
                    }}
                    disabled={actionLoading}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                  >
                    Use outstanding balance
                  </button>
                </div>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => {
                    setAmountReceived(e.target.value);
                    setRecordPaymentError(null);
                  }}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-900 ${
                    amountReceived && parseFloat(amountReceived) > parseFloat(selectedPayment.balance)
                      ? 'border-amber-300 focus:ring-amber-500'
                      : 'border-slate-300'
                  }`}
                  disabled={actionLoading}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Outstanding balance: {formatAmount(selectedPayment.balance)}
                </p>
              </div>

              {/* Warning when amount exceeds balance */}
              {amountReceived && parseFloat(amountReceived) > parseFloat(selectedPayment.balance) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">warning</span>
                    <div className="text-sm">
                      <p className="text-amber-800 font-medium">Amount exceeds outstanding balance</p>
                      <p className="text-amber-700 mt-1">
                        The entered amount ({formatAmount(amountReceived)}) is greater than the outstanding balance ({formatAmount(selectedPayment.balance)}).
                        This may be due to additional charges added after the initial payment.
                      </p>
                      <p className="text-amber-700 mt-1">
                        Please adjust the amount or click "Use outstanding balance" to record the correct payment.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method Display */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Payment Method:</span>
                  <span className="font-semibold text-slate-900">{selectedPayment.payment_method}</span>
                </div>
              </div>

              {recordPaymentError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {recordPaymentError}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowRecordPaymentModal(false);
                  setAmountReceived('');
                  setRecordPaymentError(null);
                }}
                disabled={actionLoading}
                className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                disabled={actionLoading || !amountReceived}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {actionLoading ? 'Recording...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
          duration={3000}
        />
      )}
    </div>
  );
}