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
      <div className="min-h-screen bg-[#F3F5F9] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A62CD] mx-auto"></div>
          <p className="mt-4 text-[#64748B]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F3F5F9] flex items-center justify-center">
        <div className="text-center max-w-md">
          <span className="material-symbols-outlined text-5xl text-red-400 mb-3">error</span>
          <p className="text-lg font-semibold text-slate-800 mb-2">Failed to load dashboard</p>
          <p className="text-sm text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => loadDashboardData()}
            className="px-4 py-2 bg-[#1A62CD] text-white rounded-lg hover:bg-[#1555b8] transition-colors"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Queue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Today&apos;s Queue</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">people</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{dashboardData?.queueCounts.waiting || 0}</span>
            <span className="text-xs text-slate-400">waiting</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-purple-600 font-medium text-xs">
              {dashboardData?.queueCounts.inConsultation || 0} in consultation • {dashboardData?.queueCounts.done || 0} done
            </span>
          </div>
        </div>

        {/* Remaining Capacity */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Remaining Capacity</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{dashboardData?.capacity.remaining || 0}</span>
            <span className="text-xs text-slate-400">of {dashboardData?.capacity.total || 0}</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-emerald-600 font-medium text-xs">Slots available</span>
          </div>
        </div>

        {/* Pending Verification Payments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Verification</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{dashboardData?.pendingVerificationPayments || 0}</span>
            <span className="text-xs text-slate-400">payments</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-amber-600 font-medium text-xs">Action needed</span>
          </div>
        </div>

        {/* Unread Messages */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unread Messages</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{dashboardData?.unreadMessages || 0}</span>
            <span className="text-xs text-slate-400">messages</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100">
            <span className="text-[#1b5eb8] font-medium text-xs">Respond soon</span>
          </div>
        </div>
      </div>

      {/* Today's Queue */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900">Today&apos;s Queue</h3>
          <button
            onClick={() => router.push('/secretary/queue')}
            className="text-xs text-[#1b5eb8] font-medium hover:underline"
          >
            View Full Queue →
          </button>
        </div>
        {dashboardData?.todayQueue && dashboardData.todayQueue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Queue #</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reason</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.todayQueue.map((queueItem, index) => (
                  <tr key={index} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 text-sm font-medium text-slate-900">#{queueItem.queueNumber}</td>
                    <td className="py-2 px-3 text-sm text-slate-700">{queueItem.patientName}</td>
                    <td className="py-2 px-3 text-sm text-slate-600 truncate max-w-xs">{queueItem.reason || '-'}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        queueItem.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        queueItem.status === 'IN_CHECKUP' ? 'bg-blue-100 text-blue-700' :
                        queueItem.status === 'WAITING' ? 'bg-amber-100 text-amber-700' :
                        queueItem.status === 'CALLED' ? 'bg-purple-100 text-purple-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {queueItem.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        queueItem.registrationSource === 'ONLINE' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
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
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">queue</span>
            <p className="text-slate-600 font-medium">No patients in queue today</p>
          </div>
        )}
      </div>

      {/* Payments Needing Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900">Payments Needing Action</h3>
          <button
            onClick={() => router.push('/secretary/payments')}
            className="text-xs text-[#1b5eb8] font-medium hover:underline"
          >
            View All Payments →
          </button>
        </div>
        {dashboardData?.paymentsNeedingAction && dashboardData.paymentsNeedingAction.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.paymentsNeedingAction.map((payment, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">person</span>
                    <span className="text-sm font-semibold text-slate-900">{payment.patientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    <span>{new Date(payment.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span>•</span>
                    <span className="material-symbols-outlined text-[14px]">payments</span>
                    <span>{payment.paymentMethod}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <span className="text-sm font-bold text-slate-900">₱{typeof payment.totalAmount === 'string' ? parseFloat(payment.totalAmount).toFixed(2) : payment.totalAmount.toFixed(2)}</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                    payment.status === 'PENDING_VERIFICATION' ? 'bg-amber-100 text-amber-700' :
                    payment.status === 'UNPAID' ? 'bg-slate-100 text-slate-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {payment.status === 'PENDING_VERIFICATION' ? 'Pending' : payment.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">receipt_long</span>
            <p className="text-slate-600 font-medium">No payments needing action</p>
          </div>
        )}
      </div>

      {/* Schedule Alerts - TODO State */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Schedule Alerts</h3>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-2xl">info</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">Feature Not Yet Implemented</p>
              <p className="text-xs text-amber-700">This section will show alerts for exception or break period changes affecting active appointments once the confirmation workflow is established.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Conversations */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900">Recent Conversations</h3>
          <button
            onClick={() => router.push('/secretary/conversations')}
            className="text-xs text-[#1b5eb8] font-medium hover:underline"
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
                className="w-full flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{conversation.patientName}</p>
                    {conversation.updatedAt && (
                      <p className="text-xs text-slate-500">{new Date(conversation.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    )}
                  </div>
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-[20px] px-2 flex items-center justify-center">
                    {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">chat</span>
            <p className="text-slate-600 font-medium">No recent conversations</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={() => router.push('/secretary/queue')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-purple-600">people</span>
            <span className="text-sm font-medium text-slate-700">Manage Queue</span>
          </button>
          <button
            onClick={() => router.push('/secretary/walk-ins')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-emerald-600">person_add</span>
            <span className="text-sm font-medium text-slate-700">Register Walk-in</span>
          </button>
          <button
            onClick={() => router.push('/secretary/payments')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-amber-600">payments</span>
            <span className="text-sm font-medium text-slate-700">Verify Payments</span>
          </button>
          <button
            onClick={() => router.push('/secretary/conversations')}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
          >
            <span className="material-symbols-outlined text-[20px] text-blue-600">chat</span>
            <span className="text-sm font-medium text-slate-700">View Messages</span>
          </button>
        </div>
      </div>
    </div>
  );
}
