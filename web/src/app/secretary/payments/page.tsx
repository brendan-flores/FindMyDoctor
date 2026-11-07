'use client';

import { useState, useEffect, useMemo } from 'react';
import { secretaryApi, Payment, BillingStatus } from '@/lib/api/secretaryApi';
import Toast from '@/components/ui/Toast';
import BillingPanel from '@/components/BillingPanel';

type TabType = 'review' | 'collect' | 'paid' | 'attention';

// payments.status stores the derived billing status (recalculateBill keeps it in sync).
// FOR_REVIEW is persisted as PENDING_VERIFICATION for backward compatibility.
function deriveBillingStatus(payment: Payment): BillingStatus {
  switch (payment.status) {
    case 'PENDING_VERIFICATION':
      return 'FOR_REVIEW';
    case 'PARTIAL':
    case 'OVERPAID':
    case 'PAID':
    case 'UNPAID':
      return payment.status;
    default:
      return 'UNPAID';
  }
}

function patientDisplayName(p: Payment): string {
  const name = `${p.patient_first_name || ''} ${p.patient_last_name || ''}`.trim();
  return name || 'Unknown Patient';
}

export default function SecretaryPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('collect');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showBillingPanel, setShowBillingPanel] = useState(false);
  const [daySummary, setDaySummary] = useState({ cashTotal: 0, gcashTotal: 0, grandTotal: 0 });

  useEffect(() => {
    fetchPayments();
  }, []);

  useEffect(() => {
    if (activeTab === 'paid') {
      fetchDaySummary();
    }
  }, [activeTab]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await secretaryApi.getPayments();
      if (response.success && response.data) {
        setPayments(response.data);
      } else {
        setToast({ message: response.error || 'Failed to load payments', type: 'error' });
      }
    } catch {
      setToast({ message: 'Failed to load payments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDaySummary = async () => {
    try {
      const response = await secretaryApi.getPaymentHistory();
      if (response.success && response.data?.summary) {
        setDaySummary(response.data.summary);
      }
    } catch {
      // summary is best-effort
    }
  };

  const handleOpenBillingPanel = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowBillingPanel(true);
  };

  const handleCloseBillingPanel = () => {
    setShowBillingPanel(false);
    setSelectedPayment(null);
    fetchPayments();
  };

  const filteredPayments = useMemo(() => {
    let data = payments;

    // Tab filter based on derived billing status
    data = data.filter((p) => {
      const status = deriveBillingStatus(p);
      switch (activeTab) {
        case 'review':
          return status === 'FOR_REVIEW';
        case 'collect':
          return status === 'UNPAID' || status === 'PARTIAL';
        case 'paid':
          return status === 'PAID';
        case 'attention':
          return status === 'OVERPAID';
        default:
          return true;
      }
    });

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter((p) =>
        patientDisplayName(p).toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }

    if (dateFrom || dateTo) {
      data = data.filter((p) => {
        const d = p.created_at ? new Date(p.created_at) : null;
        if (!d) return false;
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      });
    }

    // To collect: oldest first
    if (activeTab === 'collect') {
      data = [...data].sort((a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
    }

    return data;
  }, [payments, activeTab, searchQuery, dateFrom, dateTo]);

  const tabCounts = useMemo(() => {
    const counts: Record<TabType, number> = { review: 0, collect: 0, paid: 0, attention: 0 };
    payments.forEach((p) => {
      const status = deriveBillingStatus(p);
      if (status === 'FOR_REVIEW') counts.review++;
      else if (status === 'UNPAID' || status === 'PARTIAL') counts.collect++;
      else if (status === 'PAID') counts.paid++;
      else if (status === 'OVERPAID') counts.attention++;
    });
    return counts;
  }, [payments]);

  const getBillingStatusBadge = (status?: BillingStatus) => {
    const badges: Record<BillingStatus, { label: string; className: string }> = {
      UNPAID: { label: 'Unpaid', className: 'bg-gray-100 text-gray-800' },
      FOR_REVIEW: { label: 'For Review', className: 'bg-yellow-100 text-yellow-800' },
      PARTIAL: { label: 'Partial', className: 'bg-blue-100 text-blue-800' },
      PAID: { label: 'Paid', className: 'bg-green-100 text-green-800' },
      OVERPAID: { label: 'Overpaid', className: 'bg-purple-100 text-purple-800' },
    };
    const badge = badges[status || 'UNPAID'];
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${badge.className}`}>{badge.label}</span>
    );
  };

  const getPatientAgeDisplay = (payment: Payment) => {
    if (payment.patient_age !== undefined && payment.patient_age !== null) {
      return payment.patient_age;
    }
    // Fallback: calculate from date_of_birth if age not provided
    if (payment.patient_date_of_birth) {
      const dob = new Date(payment.patient_date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      return age;
    }
    return 'N/A';
  };

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'review', label: 'To Review', count: tabCounts.review },
    { id: 'collect', label: 'To Collect', count: tabCounts.collect },
    { id: 'paid', label: 'Paid', count: tabCounts.paid },
    { id: 'attention', label: 'Needs Attention', count: tabCounts.attention },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600 mt-2">Manage patient payments and billing</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by patient name or payment ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-label="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                aria-label="To date"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Day Summary (for Paid tab) */}
        {activeTab === 'paid' && (
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Today&apos;s Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Cash Total</p>
                <p className="text-lg font-bold text-gray-900">₱{daySummary.cashTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">GCash Total</p>
                <p className="text-lg font-bold text-gray-900">₱{daySummary.gcashTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Grand Total</p>
                <p className="text-lg font-bold text-green-600">₱{daySummary.grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payments List */}
        <div className="bg-white rounded-lg shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No payments found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredPayments.map((payment) => {
                const status = deriveBillingStatus(payment);
                const balance = parseFloat(payment.balance || '0');
                const billTotal = parseFloat(String(payment.total_amount || 0));
                const netPaid = parseFloat(String(payment.amount_paid || 0));
                return (
                  <div key={payment.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{patientDisplayName(payment)}</h3>
                          {getBillingStatusBadge(status)}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Total</p>
                            <p className="font-medium">₱{billTotal.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Paid</p>
                            <p className="font-medium text-green-600">₱{netPaid.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Balance</p>
                            <p className="font-medium text-red-600">₱{balance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Age</p>
                            <p className="font-medium">{getPatientAgeDisplay(payment)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {status === 'FOR_REVIEW' && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                          >
                            Review
                          </button>
                        )}
                        {(status === 'UNPAID' || status === 'PARTIAL') && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                          >
                            Bill
                          </button>
                        )}
                        {status === 'PAID' && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            View Invoice
                          </button>
                        )}
                        {status === 'OVERPAID' && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Billing Panel */}
      {selectedPayment && (
        <BillingPanel
          isOpen={showBillingPanel}
          onClose={handleCloseBillingPanel}
          paymentId={selectedPayment.id}
          appointmentId={selectedPayment.appointment_id}
          onPaymentComplete={fetchPayments}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
