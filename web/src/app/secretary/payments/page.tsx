'use client';

import { useState, useEffect, useMemo } from 'react';
import { secretaryApi, Payment, BillingStatus } from '@/lib/api/secretaryApi';
import Toast from '@/components/ui/Toast';
import BillingPanel from '@/components/BillingPanel';
import DatePicker from '@/components/DatePicker';

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
      UNPAID: { label: 'Unpaid', className: 'bg-neutral-100 text-neutral-800' },
      FOR_REVIEW: { label: 'For Review', className: 'bg-warning-100 text-warning-800' },
      PARTIAL: { label: 'Partial', className: 'bg-primary-100 text-primary-800' },
      PAID: { label: 'Paid', className: 'bg-success-100 text-success-800' },
      OVERPAID: { label: 'Overpaid', className: 'bg-primary-100 text-primary-800' },
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
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900">Payments</h1>
          <p className="text-neutral-600 mt-2">Manage patient payments and billing</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by patient name or payment ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
              />
            </div>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-neutral-500 whitespace-nowrap">From</label>
                <DatePicker value={dateFrom} onChange={setDateFrom} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-neutral-500 whitespace-nowrap">To</label>
                <DatePicker value={dateTo} onChange={setDateTo} popupPosition="left" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="flex border-b">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-primary-100 text-primary-800 text-xs px-2 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Day Summary (for Paid tab) */}
        {activeTab === 'paid' && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Today&apos;s Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-neutral-500">Cash Total</p>
                <p className="text-lg font-bold text-neutral-900">₱{daySummary.cashTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">GCash Total</p>
                <p className="text-lg font-bold text-neutral-900">₱{daySummary.gcashTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Grand Total</p>
                <p className="text-lg font-bold text-success-600">₱{daySummary.grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Payments List */}
        <div className="bg-white rounded-lg shadow-md">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-neutral-500">No payments found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredPayments.map((payment) => {
                const status = deriveBillingStatus(payment);
                const balance = parseFloat(payment.balance || '0');
                const billTotal = parseFloat(String(payment.total_amount || 0));
                const netPaid = parseFloat(String(payment.amount_paid || 0));
                return (
                  <div key={payment.id} className="p-4 hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-neutral-900">{patientDisplayName(payment)}</h3>
                          {getBillingStatusBadge(status)}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-neutral-500">Total</p>
                            <p className="font-medium">₱{billTotal.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Paid</p>
                            <p className="font-medium text-success-600">₱{netPaid.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Balance</p>
                            <p className="font-medium text-error-600">₱{balance.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500">Age</p>
                            <p className="font-medium">{getPatientAgeDisplay(payment)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {status === 'FOR_REVIEW' && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-warning-600 text-white rounded-lg hover:bg-warning-700 text-sm"
                          >
                            Review
                          </button>
                        )}
                        {(status === 'UNPAID' || status === 'PARTIAL') && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                          >
                            Bill
                          </button>
                        )}
                        {status === 'PAID' && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 text-sm"
                          >
                            View Invoice
                          </button>
                        )}
                        {status === 'OVERPAID' && (
                          <button
                            onClick={() => handleOpenBillingPanel(payment)}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
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
