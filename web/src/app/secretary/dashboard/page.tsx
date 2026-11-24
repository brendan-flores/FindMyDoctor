'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { secretaryApi, type SecretaryDashboard } from '@/lib/api/secretaryApi';
import TwoFactorBanner from '@/components/settings/TwoFactorBanner';

export default function SecretaryDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<SecretaryDashboard | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    loadDashboardData(controller.signal);
    return () => controller.abort();
  }, []);

  const loadDashboardData = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError('');

    try {
      const [dashboardResponse, profileResponse] = await Promise.all([
        secretaryApi.getDashboard(undefined, { signal }),
        secretaryApi.getProfile({ signal }),
      ]);

      if (signal?.aborted) return;

      if (profileResponse.success && profileResponse.data) {
        setTwoFactorEnabled(profileResponse.data.two_factor_enabled ?? false);
      }

      if (dashboardResponse.success && dashboardResponse.data) {
        setDashboardData(dashboardResponse.data);
      } else {
        setError(dashboardResponse.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      if (signal?.aborted) return;
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-neutral-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-error-400 mb-3">error</span>
          <p className="text-lg font-semibold text-neutral-800 mb-2">Failed to load dashboard</p>
          <p className="text-sm text-neutral-600 mb-4">{error}</p>
          <button
            onClick={() => loadDashboardData()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {twoFactorEnabled === false && (
        <TwoFactorBanner settingsHref="/secretary/settings" />
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Today's Queue */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">people</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Today&apos;s Queue</span>
            <span className="text-2xl font-bold text-neutral-800">{dashboardData?.queueCounts.waiting || 0}</span>
            <span className="text-xs text-neutral-400">{dashboardData?.queueCounts.inConsultation || 0} in consultation • {dashboardData?.queueCounts.done || 0} done</span>
          </div>
        </div>

        {/* Remaining Capacity */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success-500 to-success-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">space_dashboard</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Remaining Capacity</span>
            <span className="text-2xl font-bold text-neutral-800">{dashboardData?.capacity.remaining || 0} <span className="text-lg text-neutral-400">of {dashboardData?.capacity.total || 0}</span></span>
            <span className="text-xs text-neutral-400">Slots available</span>
          </div>
        </div>

        {/* Pending Verification Payments */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning-500 to-warning-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">payments</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Pending Verification</span>
            <span className="text-2xl font-bold text-neutral-800">{dashboardData?.pendingVerificationPayments || 0}</span>
            <span className="text-xs text-neutral-400">payments • Action needed</span>
          </div>
        </div>

        {/* Unread Messages */}
        <div className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">chat</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Unread Messages</span>
            <span className="text-2xl font-bold text-neutral-800">{dashboardData?.unreadMessages || 0}</span>
            <span className="text-xs text-neutral-400">messages • Respond soon</span>
          </div>
        </div>
      </div>

      {/* Today's Queue */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-neutral-800">Today&apos;s Queue</h3>
          <button
            onClick={() => router.push('/secretary/queue')}
            className="text-xs text-primary-600 font-medium hover:underline"
          >
            View Full Queue →
          </button>
        </div>
        {dashboardData?.todayQueue && dashboardData.todayQueue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Queue #</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Reason</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Source</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.todayQueue.map((queueItem, index) => (
                  <tr key={index} className="border-b border-neutral-100 last:border-0">
                    <td className="py-3 px-4 text-sm font-medium text-neutral-900">#{queueItem.queueNumber}</td>
                    <td className="py-3 px-4 text-sm text-neutral-700">{queueItem.patientName}</td>
                    <td className="py-3 px-4 text-sm text-neutral-600 truncate max-w-xs">{queueItem.reason || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        queueItem.status === 'COMPLETED' ? 'bg-success-100 text-success-700' :
                        queueItem.status === 'IN_CHECKUP' ? 'bg-primary-100 text-primary-700' :
                        queueItem.status === 'WAITING' ? 'bg-warning-100 text-warning-700' :
                        queueItem.status === 'CALLED' ? 'bg-primary-100 text-primary-700' :
                        'bg-neutral-100 text-neutral-600'
                      }`}>
                        {queueItem.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        queueItem.registrationSource === 'ONLINE' ? 'bg-primary-100 text-primary-700' : 'bg-success-100 text-success-700'
                      }`}>
                        {queueItem.registrationSource}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">queue</span>
            <p className="text-neutral-600 font-medium">No patients in queue today</p>
          </div>
        )}
      </div>

      {/* Payments Needing Action */}
      <div className="bg-white rounded-2xl shadow-md border border-neutral-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-neutral-800">Payments Needing Action</h3>
          <button
            onClick={() => router.push('/secretary/payments')}
            className="text-xs text-primary-600 font-medium hover:underline"
          >
            View All Payments →
          </button>
        </div>
        {dashboardData?.paymentsNeedingAction && dashboardData.paymentsNeedingAction.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.paymentsNeedingAction.map((payment, index) => (
              <div
                key={index}
                onClick={() => router.push(`/secretary/payments?paymentId=${payment.id}`)}
                className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-100 cursor-pointer hover:bg-neutral-100 hover:border-neutral-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-neutral-500">person</span>
                    <span className="text-sm font-semibold text-neutral-900">{payment.patientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    <span>{new Date(payment.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span>•</span>
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    <span>{payment.paymentMethod}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <span className="text-sm font-bold text-neutral-900">₱{typeof payment.totalAmount === 'string' ? parseFloat(payment.totalAmount).toFixed(2) : payment.totalAmount.toFixed(2)}</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    payment.status === 'PENDING_VERIFICATION' ? 'bg-warning-100 text-warning-700' :
                    payment.status === 'UNPAID' ? 'bg-neutral-100 text-neutral-600' :
                    payment.status === 'PAID' && payment.invoiceNotSent ? 'bg-success-100 text-success-700' :
                    'bg-neutral-100 text-neutral-600'
                  }`}>
                    {payment.status === 'PENDING_VERIFICATION' ? 'Pending' :
                     payment.status === 'UNPAID' ? 'Unpaid' :
                     payment.status === 'PAID' && payment.invoiceNotSent ? 'Paid — invoice not sent' :
                     payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">receipt_long</span>
            <p className="text-neutral-600 font-medium">No payments needing action</p>
          </div>
        )}
      </div>

      {/* Recent Conversations */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-neutral-900">Recent Conversations</h3>
          <button
            onClick={() => router.push('/secretary/conversations')}
            className="text-xs text-primary-600 font-medium hover:underline"
          >
            View All Conversations →
          </button>
        </div>
        {dashboardData?.recentConversations && dashboardData.recentConversations.length > 0 ? (
          <div className="space-y-2">
            {dashboardData.recentConversations.map((conversation, index) => (
              <button
                key={index}
                onClick={() => conversation.id && router.push(`/secretary/conversations/${conversation.id}`)}
                className="w-full flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-100 hover:bg-neutral-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{conversation.patientName}</p>
                    {conversation.updatedAt && (
                      <p className="text-xs text-neutral-500">{new Date(conversation.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    )}
                  </div>
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="bg-error-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] px-2 flex items-center justify-center">
                    {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">chat</span>
            <p className="text-neutral-600 font-medium">No recent conversations</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-md">
        <h3 className="text-sm font-bold text-neutral-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => router.push('/secretary/queue')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-primary-600">people</span>
            <span className="text-sm font-medium text-neutral-700">Manage Queue</span>
          </button>
          <button
            onClick={() => router.push('/secretary/walk-ins')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-success-600">person_add</span>
            <span className="text-sm font-medium text-neutral-700">Register Walk-in</span>
          </button>
          <button
            onClick={() => router.push('/secretary/payments')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-warning-600">payments</span>
            <span className="text-sm font-medium text-neutral-700">Verify Payments</span>
          </button>
          <button
            onClick={() => router.push('/secretary/conversations')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-primary-600">chat</span>
            <span className="text-sm font-medium text-neutral-700">View Messages</span>
          </button>
        </div>
      </div>
    </div>
  );
}
