import { query } from '../database/connection';

export type AuditAction =
  | 'APPROVE_DOCTOR'
  | 'REJECT_DOCTOR'
  | 'CREATE_ADMIN'
  | 'CREATE_SECRETARY'
  | 'DEACTIVATE_DOCTOR'
  | 'REACTIVATE_DOCTOR'
  | 'DEACTIVATE_SECRETARY'
  | 'REACTIVATE_SECRETARY'
  | 'DEACTIVATE_ADMIN'
  | 'REACTIVATE_ADMIN'
  | 'RESET_SECRETARY_PASSWORD'
  | 'RESEND_SECRETARY_INVITE';

export type AuditTargetType = 'DOCTOR' | 'SECRETARY' | 'ADMIN' | 'PATIENT' | 'USER';

export interface AuditLogEntry {
  actorUserId: string;
  action: AuditAction;
  targetUserId?: string;
  targetType?: AuditTargetType;
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * Logs an admin action to the admin_audit_log table.
 * This is an append-only log that records all administrative actions.
 *
 * @param entry - The audit log entry to record
 * @returns Promise<void>
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    const { actorUserId, action, targetUserId, targetType, reason, metadata } = entry;

    await query(
      `INSERT INTO admin_audit_log (actor_user_id, action, target_user_id, target_type, reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [actorUserId, action, targetUserId || null, targetType || null, reason || null, metadata || {}]
    );

    console.log(`Audit log entry created: ${action} by ${actorUserId}`);
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Do not throw - audit logging should not break the main operation
  }
}

/**
 * Logs a doctor approval action
 */
export async function logDoctorApproval(
  actorUserId: string,
  targetUserId: string,
  doctorName: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'APPROVE_DOCTOR',
    targetUserId,
    targetType: 'DOCTOR',
    reason: `Approved doctor application for ${doctorName}`,
    metadata: { doctorName }
  });
}

/**
 * Logs a doctor rejection action
 */
export async function logDoctorRejection(
  actorUserId: string,
  targetUserId: string,
  doctorName: string,
  rejectionReason: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'REJECT_DOCTOR',
    targetUserId,
    targetType: 'DOCTOR',
    reason: rejectionReason,
    metadata: { doctorName }
  });
}

/**
 * Logs an admin creation action
 */
export async function logAdminCreation(
  actorUserId: string,
  targetUserId: string,
  targetEmail: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'CREATE_ADMIN',
    targetUserId,
    targetType: 'ADMIN',
    reason: `Created admin account for ${targetEmail}`,
    metadata: { targetEmail }
  });
}

/**
 * Logs a secretary creation action
 */
export async function logSecretaryCreation(
  actorUserId: string,
  targetUserId: string,
  targetEmail: string,
  doctorId: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'CREATE_SECRETARY',
    targetUserId,
    targetType: 'SECRETARY',
    reason: `Created secretary account for ${targetEmail}`,
    metadata: { targetEmail, doctorId }
  });
}

/**
 * Logs a doctor deactivation action
 */
export async function logDoctorDeactivation(
  actorUserId: string,
  targetUserId: string,
  doctorName: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'DEACTIVATE_DOCTOR',
    targetUserId,
    targetType: 'DOCTOR',
    reason: `Deactivated doctor account for ${doctorName}`,
    metadata: { doctorName }
  });
}

/**
 * Logs a doctor reactivation action
 */
export async function logDoctorReactivation(
  actorUserId: string,
  targetUserId: string,
  doctorName: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'REACTIVATE_DOCTOR',
    targetUserId,
    targetType: 'DOCTOR',
    reason: `Reactivated doctor account for ${doctorName}`,
    metadata: { doctorName }
  });
}

/**
 * Logs a secretary deactivation action
 */
export async function logSecretaryDeactivation(
  actorUserId: string,
  targetUserId: string,
  secretaryName: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'DEACTIVATE_SECRETARY',
    targetUserId,
    targetType: 'SECRETARY',
    reason: `Deactivated secretary account for ${secretaryName}`,
    metadata: { secretaryName }
  });
}

/**
 * Logs a secretary reactivation action
 */
export async function logSecretaryReactivation(
  actorUserId: string,
  targetUserId: string,
  secretaryName: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'REACTIVATE_SECRETARY',
    targetUserId,
    targetType: 'SECRETARY',
    reason: `Reactivated secretary account for ${secretaryName}`,
    metadata: { secretaryName }
  });
}

/**
 * Logs an admin deactivation action
 */
export async function logAdminDeactivation(
  actorUserId: string,
  targetUserId: string,
  targetEmail: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'DEACTIVATE_ADMIN',
    targetUserId,
    targetType: 'ADMIN',
    reason: `Deactivated admin account for ${targetEmail}`,
    metadata: { targetEmail }
  });
}

/**
 * Logs an admin reactivation action
 */
export async function logAdminReactivation(
  actorUserId: string,
  targetUserId: string,
  targetEmail: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'REACTIVATE_ADMIN',
    targetUserId,
    targetType: 'ADMIN',
    reason: `Reactivated admin account for ${targetEmail}`,
    metadata: { targetEmail }
  });
}

/**
 * Logs a secretary password reset action
 */
export async function logSecretaryPasswordReset(
  actorUserId: string,
  targetUserId: string,
  targetEmail: string
): Promise<void> {
  await logAuditEntry({
    actorUserId,
    action: 'RESET_SECRETARY_PASSWORD',
    targetUserId,
    targetType: 'SECRETARY',
    reason: `Reset password for secretary account ${targetEmail}`,
    metadata: { targetEmail }
  });
}
