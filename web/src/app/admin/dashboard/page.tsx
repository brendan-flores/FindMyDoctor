'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, DashboardStats } from '@/lib/api/adminApi';

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboardData(controller.signal);
    return () => controller.abort();
  }, []);

  const loadDashboardData = async (signal?: AbortSignal) => {
    try {
      const [statsResponse, auditResponse] = await Promise.all([
        adminApi.getDashboardStats({ signal }),
        adminApi.getAuditLog({ page: 1, limit: 5 }, { signal })
      ]);

      if (signal?.aborted) return;

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (auditResponse.success && auditResponse.data) {
        setRecentActivity(auditResponse.data.entries);
      }
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Failed to load dashboard data:', error);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  const formatTimeWaiting = (submittedAt: string | null) => {
    if (!submittedAt) return '—';
    const submitted = new Date(submittedAt);
    const now = new Date();
    const diffMs = now.getTime() - submitted.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day';
    return `${diffDays} days`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila'
    });
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'APPROVE_DOCTOR': 'Approved Doctor',
      'REJECT_DOCTOR': 'Rejected Doctor',
      'CREATE_ADMIN': 'Created Admin',
      'CREATE_SECRETARY': 'Created Secretary',
      'DEACTIVATE_DOCTOR': 'Deactivated Doctor',
      'REACTIVATE_DOCTOR': 'Reactivated Doctor',
      'DEACTIVATE_SECRETARY': 'Deactivated Secretary',
      'REACTIVATE_SECRETARY': 'Reactivated Secretary',
      'DEACTIVATE_ADMIN': 'Deactivated Admin',
      'REACTIVATE_ADMIN': 'Reactivated Admin',
      'RESET_SECRETARY_PASSWORD': 'Reset Secretary Password'
    };
    return labels[action] || action;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-neutral-600">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-neutral-600">Failed to load dashboard data</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Pending Doctor Approvals */}
        <div
          className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4 cursor-pointer"
          onClick={() => router.push('/admin/doctors')}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-warning-500 to-warning-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">schedule</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Pending Approvals</span>
            <span className="text-2xl font-bold text-neutral-800">{stats.doctors.pending}</span>
            <span className="text-xs text-neutral-400">{stats.doctors.pending > 0 ? 'Action needed' : 'Awaiting review'}</span>
          </div>
        </div>

        {/* Doctors by Status */}
        <div
          className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4 cursor-pointer"
          onClick={() => router.push('/admin/doctors')}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">stethoscope</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Doctors by Status</span>
            <span className="text-2xl font-bold text-neutral-800">{stats.doctors.total}</span>
            <span className="text-xs text-neutral-400">{stats.doctors.active} active • {stats.doctors.rejected} rejected</span>
          </div>
        </div>

        {/* Accounts by Role */}
        <div
          className="bg-white rounded-2xl p-5 shadow-md border border-neutral-100 hover:shadow-lg transition-shadow flex items-center gap-4 cursor-pointer"
          onClick={() => router.push('/admin/users')}
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="material-symbols-outlined text-[28px]">group</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Accounts by Role</span>
            <span className="text-2xl font-bold text-neutral-800">
              {(stats.users.patient || 0) + (stats.users.doctor || 0) + (stats.users.secretary || 0) + (stats.users.admin || 0)}
            </span>
            <span className="text-xs text-neutral-400">{stats.users.patient || 0} patients • {stats.users.doctor || 0} doctors</span>
          </div>
        </div>

        {/* Secretaries Without Doctor */}
        <div
          className={`bg-white rounded-2xl p-5 shadow-md border hover:shadow-lg transition-shadow flex items-center gap-4 cursor-pointer ${
            stats.unassignedSecretaries > 0
              ? 'border-warning-300'
              : 'border-neutral-100'
          }`}
          onClick={() => router.push('/admin/secretaries')}
        >
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center flex-shrink-0 shadow-md ${
            stats.unassignedSecretaries > 0
              ? 'from-warning-500 to-warning-600'
              : 'from-primary-500 to-primary-600'
          }`}>
            <span className="material-symbols-outlined text-[28px]">badge</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Unassigned Secretaries</span>
            <span className="text-2xl font-bold text-neutral-800">{stats.unassignedSecretaries}</span>
            <span className="text-xs text-neutral-400">{stats.unassignedSecretaries > 0 ? 'Warning' : 'All assigned'}</span>
          </div>
        </div>
      </div>

      {/* Pending Approvals List */}
      {stats.pendingApprovals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-md border border-neutral-100">
          <div className="p-5 border-b border-neutral-100">
            <h3 className="text-xl font-bold text-neutral-800">Pending Doctor Approvals</h3>
            <p className="text-xs text-neutral-500 mt-1">Oldest submissions first</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Doctor</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Specialty</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Submitted</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Waiting</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Status</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendingApprovals.map((doctor) => (
                  <tr key={doctor.id} className="border-b border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-neutral-900">
                        {doctor.firstName} {doctor.lastName}
                      </div>
                      <div className="text-xs text-neutral-500">{doctor.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-700">{doctor.specialty}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-600">
                        {doctor.profileSubmittedAt ? new Date(doctor.profileSubmittedAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-neutral-600">{formatTimeWaiting(doctor.profileSubmittedAt)}</span>
                    </td>
                    <td className="px-5 py-4">
                      {doctor.profileCompletionStatus === 'SUBMITTED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-600 border border-primary-100">
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-50 text-warning-700 border border-warning-200">
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => router.push(`/admin/doctors`)}
                        className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Admin Activity */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-md">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-neutral-800">Recent Admin Activity</h3>
            <p className="text-xs text-neutral-500 mt-1">Latest administrative actions</p>
          </div>
          <button
            onClick={() => router.push('/admin/audit-log')}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
          >
            View All
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            No recent activity to display.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {recentActivity.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-neutral-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-neutral-900">
                        {getActionLabel(entry.action)}
                      </span>
                      {entry.targetType && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 text-neutral-600">
                          {entry.targetType}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">
                      <span className="font-medium text-neutral-700">{entry.actorEmail}</span>
                      {entry.targetEmail && (
                        <>
                          {' '}→{' '}
                          <span className="font-medium text-neutral-700">{entry.targetEmail}</span>
                        </>
                      )}
                    </div>
                    {entry.reason && (
                      <div className="text-xs text-neutral-600 mt-1 italic">{entry.reason}</div>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 whitespace-nowrap">
                    {formatTimestamp(entry.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
