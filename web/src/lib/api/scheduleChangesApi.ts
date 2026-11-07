import { apiClient } from './apiClient';

// Schedule change requests pending secretary confirmation
// (backend: /api/v1/schedule-changes for secretaries,
//  /api/v1/doctors/me/schedule-change-requests for doctors)

export interface ScheduleChangeRequest {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISMISSED';
  changeType: 'EXCEPTION' | 'BREAK';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  affectedCount: number;
  affectedAppointmentIds: string[];
  targetId: string | null;
  reason: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  doctor: { id: string; name: string };
  requestedBy: { userId: string; role: string | null; name: string | null };
  proposed: {
    startDate?: string | null;
    endDate?: string | null;
    breakDate?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string | null;
  };
  previous: {
    startDate?: string;
    endDate?: string;
    breakDate?: string;
    startTime?: string;
    endTime?: string;
    reason?: string | null;
  } | null;
}

export interface ScheduleChangeSummary {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISMISSED';
  pending: boolean;
  changeType: 'EXCEPTION' | 'BREAK';
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  doctorId: string;
  targetId: string | null;
  affectedCount: number;
  affectedAppointmentIds: string[];
  reason: string | null;
  createdAt: string | null;
}

// Response returned by the schedule write endpoints when a change is held
// for secretary confirmation (HTTP 202) instead of being applied.
export interface PendingResponse {
  success: boolean;
  data?: ScheduleChangeSummary;
  message?: string;
  error?: string;
}

export const scheduleChangesApi = {
  // List PENDING requests for the secretary's assigned doctor (SECRETARY only)
  listPending: async (options?: { signal?: AbortSignal }) => {
    return apiClient.get<ScheduleChangeRequest[]>('/schedule-changes', { signal: options?.signal });
  },

  // Confirm a pending request; applies the change and notifies affected patients
  confirm: async (id: string) => {
    return apiClient.post<ScheduleChangeSummary & { notifiedCount: number }>(`/schedule-changes/${id}/confirm`, {});
  },

  // Dismiss a pending request; the change is not applied
  dismiss: async (id: string) => {
    return apiClient.post<ScheduleChangeSummary>(`/schedule-changes/${id}/dismiss`, {});
  },

  // Read-only list of the doctor's own pending requests (DOCTOR only)
  listMinePending: async (options?: { signal?: AbortSignal }) => {
    return apiClient.get<ScheduleChangeRequest[]>('/doctors/me/schedule-change-requests', { signal: options?.signal });
  },
};

export function isPendingResponse(data: unknown): data is ScheduleChangeSummary {
  return !!data && typeof data === 'object' && (data as ScheduleChangeSummary).status === 'PENDING';
}

export function pendingSummaryText(request: Pick<ScheduleChangeRequest, 'changeType' | 'operation' | 'reason'> | null | undefined): string {
  if (!request) return 'Schedule change';
  const typeLabel = request.changeType === 'EXCEPTION' ? 'Exception' : 'Break period';
  const opLabel =
    request.operation === 'CREATE' ? 'added' :
    request.operation === 'UPDATE' ? 'updated' : 'removed';
  const reason = request.reason?.trim();
  return reason ? `${typeLabel} ${opLabel} — ${reason}` : `${typeLabel} ${opLabel}`;
}

export function pendingRequestDateLabel(request: ScheduleChangeRequest): string {
  const p = request.proposed;
  if (request.changeType === 'EXCEPTION') {
    const fmt = (v?: string | null) => {
      if (!v) return '';
      const d = new Date(v);
      return isNaN(d.getTime())
        ? v
        : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    };
    const s = fmt(p.startDate);
    const e = fmt(p.endDate);
    return s === e ? s : `${s} – ${e}`;
  }
  const d = p.breakDate ? new Date(`${p.breakDate}T00:00:00`) : null;
  const dateLabel = d && !isNaN(d.getTime())
    ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : (p.breakDate ?? '');
  const fmtTime = (v?: string | null) => {
    if (!v) return '';
    const [h, m] = String(v).split(':').map(Number);
    if (Number.isNaN(h)) return String(v);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${suffix}`;
  };
  return `${dateLabel}${p.startTime ? ` · ${fmtTime(p.startTime)} – ${fmtTime(p.endTime)}` : ''}`;
}
