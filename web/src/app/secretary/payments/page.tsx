'use client';

import { useState, useEffect } from 'react';
import { secretaryApi, Payment, PaymentCharge } from '@/lib/api/secretaryApi';

type TabType = 'PENDING_VERIFICATION' | 'PAID' | 'REJECTED';

const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending',
  PAID: 'Verified',
  REJECTED: 'Rejected',
  UNPAID: 'Unpaid',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  UNPAID: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function SecretaryPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('PENDING_VERIFICATION');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptImageLoaded, setReceiptImageLoaded] = useState(false);
  const [receiptImageError, setReceiptImageError] = useState(false);
  const [receiptSignedUrl, setReceiptSignedUrl] = useState<string | null>(null);
  const [isFetchingReceiptUrl, setIsFetchingReceiptUrl] = useState(false);
  const [paymentCounts, setPaymentCounts] = useState({ pending: 0, verified: 0, rejected: 0 });

  useEffect(() => {
    fetchPayments();
    fetchPaymentCounts();
  }, [activeTab]);

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);

    const response = await secretaryApi.getPayments(activeTab);
    if (response.success && response.data) {
      setPayments(response.data);
    } else {
      setError(response.error || 'Failed to fetch payments');
    }
    setLoading(false);
  };

  const fetchPaymentCounts = async () => {
    const statuses: TabType[] = ['PENDING_VERIFICATION', 'PAID', 'REJECTED'];
    const counts = { pending: 0, verified: 0, rejected: 0 };

    for (const status of statuses) {
      const response = await secretaryApi.getPayments(status);
      if (response.success && response.data) {
        if (status === 'PENDING_VERIFICATION') counts.pending = response.data.length;
        if (status === 'PAID') counts.verified = response.data.length;
        if (status === 'REJECTED') counts.rejected = response.data.length;
      }
    }

    setPaymentCounts(counts);
  };

  const handleVerify = async (paymentId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const response = await secretaryApi.verifyPayment(paymentId);

    if (response.success) {
      setSuccess('Payment verified successfully');
      setShowVerifyDialog(false);
      setShowDetailsModal(false);
      fetchPayments();
      fetchPaymentCounts();
    } else {
      setError(response.error || 'Failed to verify payment');
    }
    setActionLoading(false);
  };

  const handleReject = async (paymentId: string) => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);

    const response = await secretaryApi.rejectPayment(paymentId);

    if (response.success) {
      setSuccess('Payment rejected successfully');
      setShowRejectDialog(false);
      setShowDetailsModal(false);
      fetchPayments();
      fetchPaymentCounts();
    } else {
      setError(response.error || 'Failed to reject payment');
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
      setError(response.error || 'Failed to load receipt');
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

  const pendingCount = paymentCounts.pending;
  const verifiedCount = paymentCounts.verified;
  const rejectedCount = paymentCounts.rejected;

  const filteredPayments = payments.filter(p => p.status === activeTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Payments</h1>
        <p className="text-xs text-slate-500 mt-0.5">Verify and manage patient payments</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <nav className="flex overflow-x-auto gap-1 p-2 border-b border-slate-200">
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
            Verified ({verifiedCount})
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
                {activeTab === 'PENDING_VERIFICATION'
                  ? 'Payments awaiting verification will appear here'
                  : activeTab === 'PAID'
                  ? 'Verified payments will appear here'
                  : 'Rejected payments will appear here'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedPayment(payment);
                    setShowDetailsModal(true);
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
                          <span>{payment.payment_method || 'GCash'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-slate-400">schedule</span>
                          <span>Uploaded {formatDate(payment.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${STATUS_COLORS[payment.status]}`}>
                        {STATUS_LABELS[payment.status]}
                      </span>
                      <span className="text-lg font-bold text-slate-900">{formatAmount(payment.total_amount)}</span>
                    </div>
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
                </div>
              </div>

              {/* Receipt */}
              {selectedPayment.receipt_url && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment Receipt</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <button
                      onClick={() => handleViewReceipt(selectedPayment.id)}
                      disabled={isFetchingReceiptUrl}
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                      {isFetchingReceiptUrl ? 'Loading...' : 'View Receipt'}
                    </button>
                  </div>
                </div>
              )}

              {/* Charges Breakdown */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Charges Breakdown</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Consultation Fee:</span>
                    <span className="text-slate-900">{formatAmount(selectedPayment.consultation_amount)}</span>
                  </div>
                  {selectedPayment.charges && selectedPayment.charges.length > 0 && (
                    <>
                      {selectedPayment.charges.map((charge: PaymentCharge) => (
                        <div key={charge.id} className="flex justify-between">
                          <span className="text-slate-600">{charge.description}:</span>
                          <span className="text-slate-900">{formatAmount(charge.amount)}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold">
                    <span className="text-slate-900">Total:</span>
                    <span className="text-slate-900">{formatAmount(selectedPayment.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Verifier Information (for verified payments) */}
              {selectedPayment.status === 'PAID' && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Verification Details</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
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

              {/* Actions for pending payments */}
              {selectedPayment.status === 'PENDING_VERIFICATION' && (
                <div className="flex gap-3 pt-4 border-t border-slate-200">
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
              Are you sure you want to verify this payment of {formatAmount(selectedPayment.total_amount)} from{' '}
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
              Are you sure you want to reject this payment of {formatAmount(selectedPayment.total_amount)} from{' '}
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
      {showReceiptModal && receiptSignedUrl && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Payment Receipt</h3>
              <button
                onClick={() => {
                  setShowReceiptModal(false);
                  setReceiptSignedUrl(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-[24px] text-slate-500">close</span>
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-100 min-h-[400px]">
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
                className={`max-w-full max-h-[80vh] object-contain rounded-lg ${!receiptImageLoaded && !receiptImageError ? 'hidden' : ''}`}
                onLoad={() => setReceiptImageLoaded(true)}
                onError={() => setReceiptImageError(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}