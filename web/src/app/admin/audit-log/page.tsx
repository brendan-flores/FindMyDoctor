'use client';

import { useEffect, useState } from 'react';
import { adminApi, AuditLogEntry, AuditLogResponse } from '@/lib/api/adminApi';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/DatePicker';

export default function AuditLogPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [auditLog, setAuditLog] = useState<AuditLogResponse | null>(null);
  const [filters, setFilters] = useState({
    action: '',
    actorId: '',
    startDate: '',
    endDate: ''
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadAuditLog();
  }, [page, filters]);

  const loadAuditLog = async () => {
    try {
      const response = await adminApi.getAuditLog({
        ...filters,
        action: filters.action || undefined,
        actorId: filters.actorId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        page,
        limit: 50
      });

      if (response.success && response.data) {
        setAuditLog(response.data);
      }
    } catch (error) {
      console.error('Failed to load audit log:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
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

  const getActionColor = (action: string) => {
    if (action.includes('APPROVE') || action.includes('REACTIVATE') || action.includes('CREATE')) {
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    }
    if (action.includes('REJECT') || action.includes('DEACTIVATE')) {
      return 'bg-red-50 text-red-700 border border-red-200';
    }
    return 'bg-blue-50 text-[#1b5eb8] border border-blue-100';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading audit log...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-md flex flex-col lg:flex-row gap-3 items-center">
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <span className="text-xs text-slate-400 font-medium">Action:</span>
          <Select
            className="w-52"
            triggerClassName="h-9 px-3 text-xs"
            value={filters.action}
            onChange={(value) => handleFilterChange('action', value)}
            options={[
              { value: '', label: 'All Actions' },
              { value: 'APPROVE_DOCTOR', label: 'Approve Doctor' },
              { value: 'REJECT_DOCTOR', label: 'Reject Doctor' },
              { value: 'CREATE_ADMIN', label: 'Create Admin' },
              { value: 'CREATE_SECRETARY', label: 'Create Secretary' },
              { value: 'DEACTIVATE_DOCTOR', label: 'Deactivate Doctor' },
              { value: 'REACTIVATE_DOCTOR', label: 'Reactivate Doctor' },
              { value: 'DEACTIVATE_SECRETARY', label: 'Deactivate Secretary' },
              { value: 'REACTIVATE_SECRETARY', label: 'Reactivate Secretary' },
              { value: 'DEACTIVATE_ADMIN', label: 'Deactivate Admin' },
              { value: 'REACTIVATE_ADMIN', label: 'Reactivate Admin' },
              { value: 'RESET_SECRETARY_PASSWORD', label: 'Reset Secretary Password' },
            ]}
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <span className="text-xs text-slate-400 font-medium">From:</span>
          <DatePicker
            value={filters.startDate}
            onChange={(date) => handleFilterChange('startDate', date)}
          />
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <span className="text-xs text-slate-400 font-medium">To:</span>
          <DatePicker
            value={filters.endDate}
            onChange={(date) => handleFilterChange('endDate', date)}
          />
        </div>

        <button
          onClick={() => {
            setFilters({ action: '', actorId: '', startDate: '', endDate: '' });
            setPage(1);
          }}
          className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Timestamp</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Actor</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Action</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Target</th>
                <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Reason</th>
              </tr>
            </thead>
            <tbody>
              {!auditLog || auditLog.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No audit log entries found matching your criteria.
                  </td>
                </tr>
              ) : (
                auditLog.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600">{formatTimestamp(entry.timestamp)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-slate-900">{entry.actorEmail}</div>
                      <div className="text-xs text-slate-500">{entry.actorRole}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getActionColor(entry.action)}`}>
                        {getActionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {entry.targetEmail ? (
                        <div>
                          <div className="text-sm font-medium text-slate-900">{entry.targetEmail}</div>
                          {entry.targetType && (
                            <div className="text-xs text-slate-500">{entry.targetType}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm text-slate-600 max-w-xs truncate block">{entry.reason || '—'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {auditLog && auditLog.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Showing {((auditLog.pagination.page - 1) * auditLog.pagination.limit) + 1} to{' '}
              {Math.min(auditLog.pagination.page * auditLog.pagination.limit, auditLog.pagination.total)} of{' '}
              {auditLog.pagination.total} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={auditLog.pagination.page === 1}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600">
                Page {auditLog.pagination.page} of {auditLog.pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(auditLog.pagination.totalPages, p + 1))}
                disabled={auditLog.pagination.page === auditLog.pagination.totalPages}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
