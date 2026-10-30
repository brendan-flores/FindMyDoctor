'use client';

import { useState, useEffect } from 'react';
import { secretaryApi, Invoice } from '@/lib/api/secretaryApi';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId: string;
}

export default function InvoiceModal({ isOpen, onClose, paymentId }: InvoiceModalProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchInvoice();
    }
  }, [isOpen, paymentId]);

  const fetchInvoice = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await secretaryApi.getInvoiceByPayment(paymentId);
      if (response.success && response.data) {
        setInvoice(response.data);
      } else {
        setError('Invoice not found. Please complete the checkup first.');
      }
    } catch (err: any) {
      setError('Failed to load invoice');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!invoice) return;

    setIsDownloading(true);
    setError(null);

    try {
      const response = await secretaryApi.downloadInvoicePdf(invoice.id);
      if (response.success && response.data) {
        // Create download link
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoice.invoice_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError(response.error || 'Failed to download invoice');
      }
    } catch (err) {
      setError('Failed to download invoice');
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `₱${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  if (isLoading || isGenerating) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="text-slate-600 mt-3">
            {isGenerating ? 'Generating invoice...' : 'Loading invoice...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Error</h3>
          <p className="text-sm text-slate-600 mb-4">{error || 'Failed to load invoice'}</p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const data = invoice.invoice_data;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-slate-900">Invoice Preview</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-[24px] text-slate-500">close</span>
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-6 bg-slate-50">
          <div className="bg-white rounded-lg shadow-sm p-8 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-start gap-4">
                <img
                  src="/logo/cross.png"
                  alt="Find My Doctor Logo"
                  className="w-16 h-16 object-contain"
                />
                <div>
                  <h1 className="text-2xl font-bold text-[#1b5eb8] mb-2">Find My Doctor</h1>
                  {data.clinic.name && <p className="text-sm text-slate-600">{data.clinic.name}</p>}
                  {data.clinic.address && <p className="text-sm text-slate-600">{data.clinic.address}</p>}
                  {data.clinic.contact_number && <p className="text-sm text-slate-600">Contact: {data.clinic.contact_number}</p>}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-slate-900 mb-1">INVOICE</h2>
                <p className="text-sm text-slate-600">Invoice #: {invoice.invoice_number}</p>
                <p className="text-sm text-slate-600">Date: {formatDate(invoice.invoice_date)}</p>
              </div>
            </div>

            {/* Bill To */}
            <div className="mb-8">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Bill To:</h3>
              <p className="text-sm text-slate-600">
                {data.patient.first_name} {data.patient.last_name}
              </p>
              {data.patient.email && <p className="text-sm text-slate-600">Email: {data.patient.email}</p>}
              {data.patient.phone && <p className="text-sm text-slate-600">Phone: {data.patient.phone}</p>}
              {data.patient.address && <p className="text-sm text-slate-600">Address: {data.patient.address}</p>}
            </div>

            {/* Line separator */}
            <div className="border-t border-slate-200 mb-4"></div>

            {/* Charges Table */}
            <div className="mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 font-semibold text-slate-900">Description</th>
                    <th className="text-center py-2 font-semibold text-slate-900 w-20">Qty</th>
                    <th className="text-right py-2 font-semibold text-slate-900 w-24">Rate</th>
                    <th className="text-right py-2 font-semibold text-slate-900 w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 text-slate-700">Consultation Fee</td>
                    <td className="py-2 text-center text-slate-700">1</td>
                    <td className="py-2 text-right text-slate-700">{formatCurrency(data.payment.consultation_amount)}</td>
                    <td className="py-2 text-right text-slate-700">{formatCurrency(data.payment.consultation_amount)}</td>
                  </tr>
                  {data.charges.map((charge, index) => (
                    <tr key={index} className="border-b border-slate-100">
                      <td className="py-2 text-slate-700">{charge.description}</td>
                      <td className="py-2 text-center text-slate-700">
                        {charge.charge_type === 'MEDICINE' ? (charge.quantity || 1) : '-'}
                      </td>
                      <td className="py-2 text-right text-slate-700">
                        {charge.charge_type === 'MEDICINE' ? formatCurrency(charge.unit_price || charge.amount) : '-'}
                      </td>
                      <td className="py-2 text-right text-slate-700">{formatCurrency(charge.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-slate-600 mb-1">
                <span>Subtotal:</span>
                <span>{formatCurrency(data.payment.subtotal)}</span>
              </div>

              <div className="border-t border-slate-200 my-2"></div>

              {/* Payment Breakdown Section */}
              <div className="mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment Breakdown</p>

                {data.payment.advance_payment > 0 && (
                  <div className="border border-slate-200 rounded-lg p-3 mb-2 bg-slate-50">
                    <div className="flex justify-between text-sm font-semibold text-slate-800 mb-1">
                      <span>GCash Advance Payment</span>
                      <span>{formatCurrency(data.payment.advance_payment)}</span>
                    </div>
                    {data.payment.amount_applied > 0 && (
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Amount applied to balance</span>
                        <span>{formatCurrency(data.payment.amount_applied)}</span>
                      </div>
                    )}
                  </div>
                )}

                {data.payment.cash_tendered > 0 && (
                  <div className="border border-slate-200 rounded-lg p-3 mb-2 bg-slate-50">
                    <div className="flex justify-between text-sm font-semibold text-slate-800">
                      <span>Cash Payment at Clinic</span>
                      <span>{formatCurrency(data.payment.cash_tendered)}</span>
                    </div>
                  </div>
                )}
              </div>

              {data.payment.change_amount > 0 && (
                <>
                  <div className="border-t border-emerald-200 my-2"></div>
                  <div className="flex justify-between text-lg font-bold text-emerald-600 mb-1 bg-emerald-50 px-3 py-2 rounded-lg">
                    <span>Change Returned</span>
                    <span>{formatCurrency(data.payment.change_amount)}</span>
                  </div>
                </>
              )}

              <div className="border-t border-slate-300 my-2"></div>

              <div className="flex justify-between text-base font-bold text-slate-900 mb-1">
                <span>TOTAL PAID:</span>
                <span>{formatCurrency(data.payment.advance_payment + data.payment.cash_tendered)}</span>
              </div>

              {data.payment.final_balance > 0 && (
                <div className="flex justify-between text-sm text-red-600 font-medium mt-1">
                  <span>Remaining Balance:</span>
                  <span>{formatCurrency(data.payment.final_balance)}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 pt-4 mt-6 text-center">
              {data.clinic.footer_line && (
                <p className="text-sm text-slate-500 mb-1">{data.clinic.footer_line}</p>
              )}
              <p className="text-xs text-slate-400">This is a computer-generated invoice.</p>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Done
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-2"
          >
            {isDownloading ? (
              <>
                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Downloading...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
