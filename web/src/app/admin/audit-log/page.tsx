'use client';

import { useEffect, useState } from 'react';
import { adminApi, AuditLogEntry, AuditLogResponse } from '@/lib/api/adminApi';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/DatePicker';
import { usePresence } from '@/hooks/usePresence';

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
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const detailModalOpen = showDetailModal && !!selectedEntry;
  const detailModalPresent = usePresence(detailModalOpen);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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

  const handleRowClick = (entry: AuditLogEntry) => {
    setSelectedEntry(entry);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedEntry(null);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    // Format date: "Nov 19, 2026"
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    // Format time: "10:55 PM"
    const timePart = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    return { datePart, timePart };
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-md flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Action:</span>
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


          {/* Start Date Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline whitespace-nowrap">From:</span>
            <DatePicker
              value={filters.startDate}
              onChange={(value) => handleFilterChange('startDate', value)}
              maxDate={todayStr}
              placeholder="Start date"
              className="w-40"
            />
          </div>

          {/* End Date Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline whitespace-nowrap">To:</span>
            <DatePicker
              value={filters.endDate}
              onChange={(value) => handleFilterChange('endDate', value)}
              maxDate={todayStr}
              placeholder="End date"
              className="w-40"
            />
          </div>




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
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="min-w-[160px] whitespace-nowrap px-4 py-3 text-left">Timestamp</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap text-center">Actor</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap text-center">Action</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap text-center">Target</th>
                <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap text-center">Reason</th>
              </tr>
            </thead>
            <tbody>
              {!auditLog || auditLog.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500 text-sm">
                    No audit log entries found matching your criteria.
                  </td>
                </tr>
              ) : (
                auditLog.entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => handleRowClick(entry)}
                    className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 cursor-pointer transition-colors"
                  >
                    <td className="min-w-[160px] whitespace-nowrap px-4 py-4">
                      <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                        {formatTimestamp(entry.timestamp).datePart}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTimestamp(entry.timestamp).timePart}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate" title={entry.actorEmail}>
                          {entry.actorEmail}
                        </div>
                        <div className="text-xs text-slate-500">{entry.actorRole}</div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className={`inline-flex items-center px-2.5 py-1 h-7 rounded-full text-xs font-semibold whitespace-nowrap ${getActionColor(entry.action)}`}>
                        {getActionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle">
                      {entry.targetEmail ? (
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate" title={entry.targetEmail}>
                            {entry.targetEmail}
                          </div>
                          {entry.targetType && (
                            <div className="text-xs text-slate-500 truncate" title={entry.targetType}>
                              {entry.targetType}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span className="text-sm text-slate-600 truncate block" title={entry.reason || undefined}>
                        {entry.reason || '—'}
                      </span>
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

      {/* Audit Details Modal */}
      {detailModalPresent && selectedEntry && (
        <div
          className="fmd-modal-overlay fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          data-state={detailModalOpen ? 'open' : 'closed'}
        >
          <div
            className="fmd-modal-panel bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            data-state={detailModalOpen ? 'open' : 'closed'}
          >
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Audit Details</h2>
              <p className="text-sm text-slate-500 mt-1">Complete audit log entry</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Actor Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Actor</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Email:</span>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedEntry.actorEmail}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Role:</span>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedEntry.actorRole}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 font-medium">User ID:</span>
                    <p className="text-sm font-mono text-slate-600 mt-0.5">{selectedEntry.actorUserId}</p>
                  </div>
                </div>
              </div>

              {/* Target Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Target</h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  {selectedEntry.targetEmail ? (
                    <>
                      <div>
                        <span className="text-xs text-slate-500 font-medium">Email:</span>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedEntry.targetEmail}</p>
                      </div>
                      {selectedEntry.targetRole && (
                        <div>
                          <span className="text-xs text-slate-500 font-medium">Role:</span>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedEntry.targetRole}</p>
                        </div>
                      )}
                      {selectedEntry.targetType && (
                        <div>
                          <span className="text-xs text-slate-500 font-medium">Type:</span>
                          <p className="text-sm font-medium text-slate-900 mt-0.5">{selectedEntry.targetType}</p>
                        </div>
                      )}
                      {selectedEntry.targetUserId && (
                        <div>
                          <span className="text-xs text-slate-500 font-medium">User ID:</span>
                          <p className="text-sm font-mono text-slate-600 mt-0.5">{selectedEntry.targetUserId}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              </div>

              {/* Action Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Action</h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  <span className={`inline-flex items-center px-3 py-1.5 h-8 rounded-full text-sm font-semibold whitespace-nowrap ${getActionColor(selectedEntry.action)}`}>
                    {getActionLabel(selectedEntry.action)}
                  </span>
                  <p className="text-xs text-slate-500 font-mono mt-2">{selectedEntry.action}</p>
                </div>
              </div>

              {/* Timestamp Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Timestamp</h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-900">{formatTimestamp(selectedEntry.timestamp).datePart}</p>
                  <p className="text-xs text-slate-500 font-mono mt-1">{selectedEntry.timestamp}</p>
                </div>
              </div>

              {/* Reason Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Reason</h3>
                <div className="bg-slate-50 rounded-lg p-4">
                  {selectedEntry.reason ? (
                    <p className="text-sm text-slate-900 whitespace-pre-wrap">{selectedEntry.reason}</p>
                  ) : (
                    <p className="text-sm text-slate-400">Not provided</p>
                  )}
                </div>
              </div>

              {/* Metadata Section */}
              {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Metadata</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(selectedEntry.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200 flex justify-end">
              <button
                onClick={handleCloseDetailModal}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
