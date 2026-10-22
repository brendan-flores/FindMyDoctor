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
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsResponse, auditResponse] = await Promise.all([
        adminApi.getDashboardStats(),
        adminApi.getAuditLog({ page: 1, limit: 5 })
      ]);

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      if (auditResponse.success && auditResponse.data) {
        setRecentActivity(auditResponse.data.entries);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
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
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Failed to load dashboard data</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Doctor Approvals */}
        <div
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-amber-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => router.push('/admin/doctors')}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pending Approvals</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.doctors.pending}</span>
            <span className="text-xs text-slate-400">doctors</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-amber-600 font-medium">Awaiting review</span>
            {stats.doctors.pending > 0 && (
              <span className="text-amber-600 font-medium px-1.5 py-0.5 rounded bg-amber-50">Action needed</span>
            )}
          </div>
        </div>

        {/* Doctors by Status */}
        <div
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => router.push('/admin/doctors')}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Doctors by Status</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">stethoscope</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.doctors.total}</span>
            <span className="text-xs text-slate-400">total</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-medium">{stats.doctors.active} active</span>
            <span className="text-slate-400">{stats.doctors.rejected} rejected</span>
          </div>
        </div>

        {/* Accounts by Role */}
        <div
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => router.push('/admin/users')}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Accounts by Role</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1b5eb8] flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">group</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">
              {(stats.users.patient || 0) + (stats.users.doctor || 0) + (stats.users.secretary || 0) + (stats.users.admin || 0)}
            </span>
            <span className="text-xs text-slate-400">total</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-medium">{stats.users.patient || 0} patients</span>
            <span className="text-slate-400">{stats.users.doctor || 0} doctors</span>
          </div>
        </div>

        {/* Secretaries Without Doctor */}
        <div
          className={`bg-white p-5 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer ${
            stats.unassignedSecretaries > 0
              ? 'border-amber-300 hover:border-amber-400'
              : 'border-slate-200 hover:border-blue-300'
          }`}
          onClick={() => router.push('/admin/secretaries')}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Unassigned Secretaries</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              stats.unassignedSecretaries > 0
                ? 'bg-amber-50 text-amber-600'
                : 'bg-blue-50 text-[#1b5eb8]'
            }`}>
              <span className="material-symbols-outlined text-[18px]">badge</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900">{stats.unassignedSecretaries}</span>
            <span className="text-xs text-slate-400">need doctor</span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            {stats.unassignedSecretaries > 0 ? (
              <span className="text-amber-600 font-medium px-1.5 py-0.5 rounded bg-amber-50">Warning</span>
            ) : (
              <span className="text-emerald-600 font-medium">All assigned</span>
            )}
          </div>
        </div>
      </div>

      {/* Pending Approvals List */}
      {stats.pendingApprovals.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Pending Doctor Approvals</h3>
            <p className="text-xs text-slate-500 mt-1">Oldest submissions first</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Doctor</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Specialty</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Submitted</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Waiting</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.pendingApprovals.map((doctor) => (
                  <tr key={doctor.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {doctor.firstName} {doctor.lastName}
                      </div>
                      <div className="text-xs text-slate-500">{doctor.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-700">{doctor.specialty}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">
                        {doctor.profileSubmittedAt ? new Date(doctor.profileSubmittedAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">{formatTimeWaiting(doctor.profileSubmittedAt)}</span>
                    </td>
                    <td className="px-5 py-4">
                      {doctor.profileCompletionStatus === 'SUBMITTED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1b5eb8] border border-blue-100">
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Incomplete
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => router.push(`/admin/doctors`)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
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
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Admin Activity</h3>
            <p className="text-xs text-slate-500 mt-1">Latest administrative actions</p>
          </div>
          <button
            onClick={() => router.push('/admin/audit-log')}
            className="text-xs font-semibold text-[#1b5eb8] hover:text-[#14468f] transition-colors"
          >
            View All
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No recent activity to display.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivity.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-slate-900">
                        {getActionLabel(entry.action)}
                      </span>
                      {entry.targetType && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          {entry.targetType}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">{entry.actorEmail}</span>
                      {entry.targetEmail && (
                        <>
                          {' '}→{' '}
                          <span className="font-medium text-slate-700">{entry.targetEmail}</span>
                        </>
                      )}
                    </div>
                    {entry.reason && (
                      <div className="text-xs text-slate-600 mt-1 italic">{entry.reason}</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">
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
