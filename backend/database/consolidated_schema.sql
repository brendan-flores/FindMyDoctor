-- ============================================================================
-- FindMyDoctor consolidated schema
-- Run on a fresh, empty database for a full deployment.
-- Includes all migrations through: 046_add_service_other_charge_types.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_expired_login_otp_challenges()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    DELETE FROM login_otp_challenges WHERE expires_at < CURRENT_TIMESTAMP;
END;
$function$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION update_waitlists_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    actor_user_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    target_user_id uuid,
    target_type character varying(20),
    timestamp timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    title character varying(255)
);

CREATE TABLE IF NOT EXISTS ai_daily_limits (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    message_date date NOT NULL,
    message_count integer NOT NULL DEFAULT 0,
    last_request_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    appointment_date timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    status character varying(20) NOT NULL DEFAULT 'SCHEDULED'::character varying,
    reason_for_visit text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    secretary_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'OPEN'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_capacities (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL,
    date date NOT NULL,
    consultation_duration_minutes integer DEFAULT 30,
    calculated_capacity integer NOT NULL,
    configured_capacity integer,
    final_capacity integer NOT NULL,
    registered_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_tokens (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token text NOT NULL,
    provider character varying(20) NOT NULL DEFAULT 'FCM'::character varying,
    platform character varying(20) NOT NULL DEFAULT 'ANDROID'::character varying,
    device_info character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_break_periods (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL,
    break_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    reason text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_schedules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    consultation_duration_minutes integer DEFAULT 30,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_unavailability (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    doctor_id uuid NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    specialty character varying(100),
    credentials character varying(255),
    biography text,
    consultation_fee numeric(10,2) NOT NULL DEFAULT 0.00,
    practice_name character varying(255),
    practice_address text NOT NULL DEFAULT ''::text,
    practice_latitude numeric(10,8) NOT NULL DEFAULT 0,
    practice_longitude numeric(11,8) NOT NULL DEFAULT 0,
    practice_phone character varying(20),
    practice_email character varying(255),
    practice_description text,
    operating_hours_start time without time zone,
    operating_hours_end time without time zone,
    gcash_qr_code_url text,
    is_approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    prc_license_number character varying(20),
    contact_number character varying(20),
    professional_photo_url text,
    years_of_experience integer,
    areas_of_expertise text,
    languages_spoken text,
    profile_completion_status character varying(20),
    profile_submitted_at timestamp with time zone,
    gcash_qr_url character varying(500),
    approval_status character varying(20),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    rejection_reason text,
    room_number character varying(50),
    middle_name character varying(100),
    two_factor_enabled boolean DEFAULT false,
    gcash_qr_updated_at timestamp with time zone,
    gcash_account_name character varying(100),
    gcash_account_number character varying(20)
);

CREATE TABLE IF NOT EXISTS invoice_settings (
    doctor_id uuid NOT NULL,
    clinic_name text NOT NULL DEFAULT ''::text,
    address text NOT NULL DEFAULT ''::text,
    contact_number text NOT NULL DEFAULT ''::text,
    footer_line text NOT NULL DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    replaces_invoice_id uuid,
    replaced_by_invoice_id uuid,
    voided_by uuid,
    voided_at timestamp with time zone,
    void_reason text,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    invoice_number text NOT NULL,
    payment_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    invoice_date timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    total_amount numeric(10,2) NOT NULL DEFAULT 0,
    advance_payment numeric(10,2) NOT NULL DEFAULT 0,
    remaining_balance_before_payment numeric(10,2) NOT NULL DEFAULT 0,
    payment_method text NOT NULL,
    cash_tendered numeric(10,2) NOT NULL DEFAULT 0,
    amount_applied numeric(10,2) NOT NULL DEFAULT 0,
    change_amount numeric(10,2) NOT NULL DEFAULT 0,
    final_balance numeric(10,2) NOT NULL DEFAULT 0,
    invoice_data jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status text NOT NULL DEFAULT 'ACTIVE'::text
);

CREATE TABLE IF NOT EXISTS billing_audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_id uuid,
    actor_user_id uuid,
    action character varying(50) NOT NULL,
    entity_type character varying(30),
    entity_id uuid,
    state_before jsonb DEFAULT '{}'::jsonb,
    state_after jsonb DEFAULT '{}'::jsonb,
    reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL,
    kind character varying(10) NOT NULL DEFAULT 'PAYMENT'::character varying,
    method character varying(10) NOT NULL,
    amount numeric(10,2) NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'PENDING'::character varying,
    receipt_url text,
    reference_no character varying(100),
    patient_declared_amount numeric(10,2),
    source character varying(20) NOT NULL DEFAULT 'SECRETARY'::character varying,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    reject_reason text,
    reject_note text,
    voided_by uuid,
    voided_at timestamp with time zone,
    void_reason text,
    void_note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_otp_challenges (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    challenge_token_hash text NOT NULL,
    user_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    attempt_count integer DEFAULT 0,
    last_otp_sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    remember_me boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    sender_user_id uuid NOT NULL,
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp with time zone,
    message_type character varying(20) NOT NULL DEFAULT 'TEXT'::character varying,
    invoice_id uuid
);

CREATE TABLE IF NOT EXISTS notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    related_entity_type character varying(50),
    related_entity_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patient_doctor_associations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    first_details_submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    details_completion_status character varying(20) NOT NULL DEFAULT 'PENDING'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date,
    address text,
    emergency_contact_name character varying(100),
    emergency_contact_phone character varying(20),
    medical_history text,
    allergies text,
    current_medications text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    phone character varying(20),
    middle_name character varying(100),
    sex character varying(20) NOT NULL DEFAULT 'NOT_SPECIFIED'::character varying
);

CREATE TABLE IF NOT EXISTS payment_charges (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    payment_id uuid NOT NULL,
    description character varying(255) NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone,
    charge_type character varying(20) NOT NULL DEFAULT 'ADDITIONAL'::character varying,
    prescription_item_id uuid,
    quantity integer,
    unit_price numeric(10,2)
);

CREATE TABLE IF NOT EXISTS payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    appointment_id uuid,
    payment_method character varying(20) NOT NULL DEFAULT 'CASH'::character varying,
    consultation_amount numeric(10,2) NOT NULL,
    total_additional_charges numeric(10,2) DEFAULT 0.00,
    total_amount numeric(10,2) NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'UNPAID'::character varying,
    receipt_url text,
    verified_by uuid,
    verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    amount_paid numeric(10,2) NOT NULL DEFAULT 0.00,
    gcash_advance_amount numeric(10,2) DEFAULT 0.00,
    cash_tendered_amount numeric(10,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS pending_doctor_signups (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    specialty character varying(100),
    credentials character varying(255),
    prc_license_number character varying(20),
    practice_name character varying(255),
    practice_phone character varying(20),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    contact_number character varying(20),
    room_number character varying(50),
    middle_name character varying(100)
);

CREATE TABLE IF NOT EXISTS pending_patient_signups (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    username character varying(50) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    middle_name character varying(100),
    date_of_birth date,
    sex character varying(20) NOT NULL DEFAULT 'NOT_SPECIFIED'::character varying,
    address text,
    phone character varying(20)
);

CREATE TABLE IF NOT EXISTS prescription_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    prescription_id uuid NOT NULL,
    medication_name character varying(255) NOT NULL,
    dosage character varying(100),
    frequency character varying(100),
    duration character varying(100),
    instructions text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    visit_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    prescription_date date NOT NULL,
    pdf_url text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    appointment_id uuid,
    queue_date date NOT NULL,
    queue_number integer NOT NULL,
    registration_source character varying(10) NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'WAITING'::character varying,
    called_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secretaries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    is_approved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    middle_name character varying(100),
    contact_number character varying(20),
    two_factor_enabled boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS trusted_browsers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    device_info text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamp with time zone,
    last_used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    is_active boolean DEFAULT true,
    must_change_password boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    email_verified boolean NOT NULL DEFAULT false,
    email_verified_at timestamp with time zone,
    username character varying(50),
    session_version integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS visits (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    appointment_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    visit_date timestamp with time zone NOT NULL,
    reason_for_visit text,
    diagnosis text,
    notes text,
    blood_pressure character varying(20),
    weight numeric(5,2),
    height numeric(5,2),
    temperature numeric(4,1),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS waitlists (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL,
    doctor_id uuid NOT NULL,
    waitlist_date date NOT NULL,
    status character varying(20) NOT NULL DEFAULT 'WAITING'::character varying,
    position integer NOT NULL DEFAULT 1,
    offered_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Add columns that may be missing on a partially migrated database
-- ---------------------------------------------------------------------------
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS actor_user_id uuid NOT NULL;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS action character varying(50) NOT NULL;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS target_user_id uuid;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS target_type character varying(20);
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE admin_audit_log ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS title character varying(255);
ALTER TABLE ai_daily_limits ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE ai_daily_limits ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE ai_daily_limits ADD COLUMN IF NOT EXISTS message_date date NOT NULL;
ALTER TABLE ai_daily_limits ADD COLUMN IF NOT EXISTS message_count integer DEFAULT 0 NOT NULL;
ALTER TABLE ai_daily_limits ADD COLUMN IF NOT EXISTS last_request_timestamp timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_daily_limits ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_daily_limits ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS conversation_id uuid NOT NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS role character varying(20) NOT NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS content text NOT NULL;
ALTER TABLE ai_messages ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appointment_date timestamp with time zone NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time timestamp with time zone;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'SCHEDULED'::character varying NOT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reason_for_visit text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS secretary_id uuid NOT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS date date NOT NULL;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS consultation_duration_minutes integer DEFAULT 30;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS calculated_capacity integer NOT NULL;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS configured_capacity integer;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS final_capacity integer NOT NULL;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS registered_count integer DEFAULT 0;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE daily_capacities ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS token text NOT NULL;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS provider character varying(20) DEFAULT 'FCM'::character varying NOT NULL;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS platform character varying(20) DEFAULT 'ANDROID'::character varying NOT NULL;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS device_info character varying(255);
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS break_date date NOT NULL;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS start_time time without time zone NOT NULL;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS end_time time without time zone NOT NULL;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctor_break_periods ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS day_of_week integer NOT NULL;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS start_time time without time zone NOT NULL;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS end_time time without time zone NOT NULL;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS consultation_duration_minutes integer DEFAULT 30;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctor_schedules ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS start_date timestamp with time zone NOT NULL;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS end_date timestamp with time zone NOT NULL;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE doctor_unavailability ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS first_name character varying(100) NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS last_name character varying(100) NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS specialty character varying(100);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS credentials character varying(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS biography text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_fee numeric(10,2) DEFAULT 0.00 NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_name character varying(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_address text DEFAULT ''::text NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_latitude numeric(10,8) DEFAULT 0 NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_longitude numeric(11,8) DEFAULT 0 NOT NULL;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_phone character varying(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_email character varying(255);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS practice_description text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS operating_hours_start time without time zone;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS operating_hours_end time without time zone;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gcash_qr_code_url text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS prc_license_number character varying(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS contact_number character varying(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS professional_photo_url text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS years_of_experience integer;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS areas_of_expertise text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS languages_spoken text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_completion_status character varying(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_submitted_at timestamp with time zone;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gcash_qr_url character varying(500);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS approval_status character varying(20);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS room_number character varying(50);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS middle_name character varying(100);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gcash_qr_updated_at timestamp with time zone;
-- Migration: 042_add_gcash_account_details.sql
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gcash_account_name character varying(100);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gcash_account_number character varying(20);
COMMENT ON COLUMN doctors.gcash_account_name IS 'GCash account name (e.g., "Maria Santos") displayed to patients for payment';
COMMENT ON COLUMN doctors.gcash_account_number IS 'GCash account number (Philippian mobile format: 09XXXXXXXXX) displayed to patients for payment';
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS clinic_name text DEFAULT ''::text NOT NULL;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS address text DEFAULT ''::text NOT NULL;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS contact_number text DEFAULT ''::text NOT NULL;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS footer_line text DEFAULT ''::text NOT NULL;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoice_settings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number text NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_id uuid NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_date timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS advance_payment numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS remaining_balance_before_payment numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_method text NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cash_tendered numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_applied numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS change_amount numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS final_balance numeric(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_data jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE'::text NOT NULL;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS challenge_token_hash text NOT NULL;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS email character varying(255) NOT NULL;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone NOT NULL;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS used_at timestamp with time zone;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS attempt_count integer DEFAULT 0;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS last_otp_sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE login_otp_challenges ADD COLUMN IF NOT EXISTS remember_me boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id uuid NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_user_id uuid NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message text NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type character varying(20) DEFAULT 'TEXT'::character varying NOT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS invoice_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type character varying(50) NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title character varying(255) NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message text NOT NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_entity_type character varying(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_entity_id uuid;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS first_details_submitted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS details_completion_status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL;
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name character varying(100) NOT NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name character varying(100) NOT NULL;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_name character varying(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact_phone character varying(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS current_medications text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone character varying(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name character varying(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex character varying(20) DEFAULT 'NOT_SPECIFIED'::character varying NOT NULL;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS payment_id uuid NOT NULL;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS description character varying(255) NOT NULL;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS amount numeric(10,2) NOT NULL;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS charge_type character varying(20) DEFAULT 'ADDITIONAL'::character varying NOT NULL;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS prescription_item_id uuid;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS quantity integer;
ALTER TABLE payment_charges ADD COLUMN IF NOT EXISTS unit_price numeric(10,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_method character varying(20) DEFAULT 'CASH'::character varying NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS consultation_amount numeric(10,2) NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_additional_charges numeric(10,2) DEFAULT 0.00;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS total_amount numeric(10,2) NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'UNPAID'::character varying NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by uuid;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at timestamp with time zone;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) DEFAULT 0.00 NOT NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gcash_advance_amount numeric(10,2) DEFAULT 0.00;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cash_tendered_amount numeric(10,2) DEFAULT 0.00;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS email character varying(255) NOT NULL;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS password_hash character varying(255) NOT NULL;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS first_name character varying(100) NOT NULL;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS last_name character varying(100) NOT NULL;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS specialty character varying(100);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS credentials character varying(255);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS prc_license_number character varying(20);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS practice_name character varying(255);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS practice_phone character varying(20);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone NOT NULL;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS contact_number character varying(20);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS room_number character varying(50);
ALTER TABLE pending_doctor_signups ADD COLUMN IF NOT EXISTS middle_name character varying(100);
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS email character varying(255) NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS password_hash character varying(255) NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS first_name character varying(100) NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS last_name character varying(100) NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS username character varying(50) NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS middle_name character varying(100);
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS sex character varying(20) DEFAULT 'NOT_SPECIFIED'::character varying NOT NULL;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE pending_patient_signups ADD COLUMN IF NOT EXISTS phone character varying(20);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS prescription_id uuid NOT NULL;
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS medication_name character varying(255) NOT NULL;
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS dosage character varying(100);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS frequency character varying(100);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS duration character varying(100);
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS instructions text;
ALTER TABLE prescription_items ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS visit_id uuid NOT NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS prescription_date date NOT NULL;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS queue_date date NOT NULL;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS queue_number integer NOT NULL;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS registration_source character varying(10) NOT NULL;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'WAITING'::character varying NOT NULL;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS called_at timestamp with time zone;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL;
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS first_name character varying(100);
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS last_name character varying(100);
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS middle_name character varying(100);
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS contact_number character varying(20);
ALTER TABLE secretaries ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS user_id uuid NOT NULL;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS token_hash character varying(64) NOT NULL;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS device_info text;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone NOT NULL;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone;
ALTER TABLE trusted_browsers ADD COLUMN IF NOT EXISTS last_used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email character varying(255) NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash character varying(255) NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role character varying(20) NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamp with time zone;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username character varying(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer DEFAULT 0 NOT NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS appointment_id uuid NOT NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS visit_date timestamp with time zone NOT NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS reason_for_visit text;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS blood_pressure character varying(20);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS weight numeric(5,2);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS height numeric(5,2);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS temperature numeric(4,1);
ALTER TABLE visits ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS patient_id uuid NOT NULL;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS doctor_id uuid NOT NULL;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS waitlist_date date NOT NULL;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'WAITING'::character varying NOT NULL;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS position integer DEFAULT 1 NOT NULL;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS offered_at timestamp with time zone;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE waitlists ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='admin_audit_log'::regclass AND contype='p') THEN
    ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ai_conversations'::regclass AND contype='p') THEN
    ALTER TABLE ai_conversations ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ai_daily_limits'::regclass AND contype='p') THEN
    ALTER TABLE ai_daily_limits ADD CONSTRAINT ai_daily_limits_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ai_messages'::regclass AND contype='p') THEN
    ALTER TABLE ai_messages ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='appointments'::regclass AND contype='p') THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);
  END IF;
END $$;
-- Source migration: 043_add_billing_redesign.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='billing_audit_log'::regclass AND contype='p') THEN
    ALTER TABLE billing_audit_log ADD CONSTRAINT billing_audit_log_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='conversations'::regclass AND contype='p') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='daily_capacities'::regclass AND contype='p') THEN
    ALTER TABLE daily_capacities ADD CONSTRAINT daily_capacities_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='device_tokens'::regclass AND contype='p') THEN
    ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctor_break_periods'::regclass AND contype='p') THEN
    ALTER TABLE doctor_break_periods ADD CONSTRAINT doctor_break_periods_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctor_schedules'::regclass AND contype='p') THEN
    ALTER TABLE doctor_schedules ADD CONSTRAINT doctor_schedules_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctor_unavailability'::regclass AND contype='p') THEN
    ALTER TABLE doctor_unavailability ADD CONSTRAINT doctor_unavailability_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctors'::regclass AND contype='p') THEN
    ALTER TABLE doctors ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoice_settings'::regclass AND contype='p') THEN
    ALTER TABLE invoice_settings ADD CONSTRAINT invoice_settings_pkey PRIMARY KEY (doctor_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND contype='p') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='login_otp_challenges'::regclass AND contype='p') THEN
    ALTER TABLE login_otp_challenges ADD CONSTRAINT login_otp_challenges_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='messages'::regclass AND contype='p') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='notifications'::regclass AND contype='p') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='patient_doctor_associations'::regclass AND contype='p') THEN
    ALTER TABLE patient_doctor_associations ADD CONSTRAINT patient_doctor_associations_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='patients'::regclass AND contype='p') THEN
    ALTER TABLE patients ADD CONSTRAINT patients_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_charges'::regclass AND contype='p') THEN
    ALTER TABLE payment_charges ADD CONSTRAINT payment_charges_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payments'::regclass AND contype='p') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
  END IF;
END $$;
-- Source migration: 043_add_billing_redesign.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND contype='p') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pending_doctor_signups'::regclass AND contype='p') THEN
    ALTER TABLE pending_doctor_signups ADD CONSTRAINT pending_doctor_signups_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pending_patient_signups'::regclass AND contype='p') THEN
    ALTER TABLE pending_patient_signups ADD CONSTRAINT pending_patient_signups_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='prescription_items'::regclass AND contype='p') THEN
    ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='prescriptions'::regclass AND contype='p') THEN
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='queue_entries'::regclass AND contype='p') THEN
    ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='secretaries'::regclass AND contype='p') THEN
    ALTER TABLE secretaries ADD CONSTRAINT secretaries_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='trusted_browsers'::regclass AND contype='p') THEN
    ALTER TABLE trusted_browsers ADD CONSTRAINT trusted_browsers_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass AND contype='p') THEN
    ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='visits'::regclass AND contype='p') THEN
    ALTER TABLE visits ADD CONSTRAINT visits_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='waitlists'::regclass AND contype='p') THEN
    ALTER TABLE waitlists ADD CONSTRAINT waitlists_pkey PRIMARY KEY (id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ai_daily_limits'::regclass AND conname='ai_daily_limits_patient_id_message_date_key') THEN
    ALTER TABLE ai_daily_limits ADD CONSTRAINT ai_daily_limits_patient_id_message_date_key UNIQUE (patient_id, message_date);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='conversations'::regclass AND conname='conversations_patient_id_secretary_id_doctor_id_key') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_patient_id_secretary_id_doctor_id_key UNIQUE (patient_id, secretary_id, doctor_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='daily_capacities'::regclass AND conname='daily_capacities_doctor_id_date_key') THEN
    ALTER TABLE daily_capacities ADD CONSTRAINT daily_capacities_doctor_id_date_key UNIQUE (doctor_id, date);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='device_tokens'::regclass AND conname='device_tokens_provider_token_key') THEN
    ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_provider_token_key UNIQUE (provider, token);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctor_break_periods'::regclass AND conname='unique_break_per_doctor_date_time') THEN
    ALTER TABLE doctor_break_periods ADD CONSTRAINT unique_break_per_doctor_date_time UNIQUE (doctor_id, break_date, start_time, end_time);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctors'::regclass AND conname='doctors_user_id_key') THEN
    ALTER TABLE doctors ADD CONSTRAINT doctors_user_id_key UNIQUE (user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND conname='invoices_doctor_id_invoice_number_key') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_doctor_id_invoice_number_key UNIQUE (doctor_id, invoice_number);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='login_otp_challenges'::regclass AND conname='login_otp_challenges_challenge_token_hash_key') THEN
    ALTER TABLE login_otp_challenges ADD CONSTRAINT login_otp_challenges_challenge_token_hash_key UNIQUE (challenge_token_hash);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='patient_doctor_associations'::regclass AND conname='patient_doctor_associations_patient_id_doctor_id_key') THEN
    ALTER TABLE patient_doctor_associations ADD CONSTRAINT patient_doctor_associations_patient_id_doctor_id_key UNIQUE (patient_id, doctor_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='patients'::regclass AND conname='patients_user_id_key') THEN
    ALTER TABLE patients ADD CONSTRAINT patients_user_id_key UNIQUE (user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payments'::regclass AND conname='payments_appointment_id_key') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_appointment_id_key UNIQUE (appointment_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pending_doctor_signups'::regclass AND conname='pending_doctor_signups_email_key') THEN
    ALTER TABLE pending_doctor_signups ADD CONSTRAINT pending_doctor_signups_email_key UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pending_patient_signups'::regclass AND conname='pending_patient_signups_email_key') THEN
    ALTER TABLE pending_patient_signups ADD CONSTRAINT pending_patient_signups_email_key UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='queue_entries'::regclass AND conname='queue_entries_appointment_id_key') THEN
    ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_appointment_id_key UNIQUE (appointment_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='queue_entries'::regclass AND conname='queue_entries_queue_date_doctor_id_queue_number_key') THEN
    ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_queue_date_doctor_id_queue_number_key UNIQUE (queue_date, doctor_id, queue_number);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='secretaries'::regclass AND conname='secretaries_user_id_key') THEN
    ALTER TABLE secretaries ADD CONSTRAINT secretaries_user_id_key UNIQUE (user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='trusted_browsers'::regclass AND conname='trusted_browsers_token_hash_key') THEN
    ALTER TABLE trusted_browsers ADD CONSTRAINT trusted_browsers_token_hash_key UNIQUE (token_hash);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass AND conname='users_email_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='users'::regclass AND conname='users_username_key') THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='visits'::regclass AND conname='visits_appointment_id_key') THEN
    ALTER TABLE visits ADD CONSTRAINT visits_appointment_id_key UNIQUE (appointment_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='waitlists'::regclass AND conname='waitlists_patient_id_doctor_id_waitlist_date_key') THEN
    ALTER TABLE waitlists ADD CONSTRAINT waitlists_patient_id_doctor_id_waitlist_date_key UNIQUE (patient_id, doctor_id, waitlist_date);
  END IF;
END $$;
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS check_admin_audit_log_action;
ALTER TABLE admin_audit_log ADD CONSTRAINT check_admin_audit_log_action CHECK (((action)::text = ANY (ARRAY[('APPROVE_DOCTOR'::character varying)::text, ('REJECT_DOCTOR'::character varying)::text, ('CREATE_ADMIN'::character varying)::text, ('CREATE_SECRETARY'::character varying)::text, ('DEACTIVATE_DOCTOR'::character varying)::text, ('REACTIVATE_DOCTOR'::character varying)::text, ('DEACTIVATE_SECRETARY'::character varying)::text, ('REACTIVATE_SECRETARY'::character varying)::text, ('DEACTIVATE_ADMIN'::character varying)::text, ('REACTIVATE_ADMIN'::character varying)::text, ('RESET_SECRETARY_PASSWORD'::character varying)::text])));
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS check_admin_audit_log_target_type;
ALTER TABLE admin_audit_log ADD CONSTRAINT check_admin_audit_log_target_type CHECK (((target_type)::text = ANY (ARRAY[('DOCTOR'::character varying)::text, ('SECRETARY'::character varying)::text, ('ADMIN'::character varying)::text, ('PATIENT'::character varying)::text, ('USER'::character varying)::text])));
ALTER TABLE ai_messages DROP CONSTRAINT IF EXISTS ai_messages_role_check;
ALTER TABLE ai_messages ADD CONSTRAINT ai_messages_role_check CHECK (((role)::text = ANY (ARRAY[('USER'::character varying)::text, ('ASSISTANT'::character varying)::text, ('SYSTEM'::character varying)::text])));
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (((status)::text = ANY (ARRAY[('SCHEDULED'::character varying)::text, ('CONFIRMED'::character varying)::text, ('IN_PROGRESS'::character varying)::text, ('COMPLETED'::character varying)::text, ('CANCELLED'::character varying)::text, ('NO_SHOW'::character varying)::text])));
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check CHECK (((status)::text = ANY (ARRAY[('OPEN'::character varying)::text, ('CLOSED'::character varying)::text, ('ARCHIVED'::character varying)::text])));
ALTER TABLE device_tokens DROP CONSTRAINT IF EXISTS device_tokens_platform_check;
ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_platform_check CHECK (((platform)::text = ANY (ARRAY[('IOS'::character varying)::text, ('ANDROID'::character varying)::text, ('WEB'::character varying)::text])));
ALTER TABLE device_tokens DROP CONSTRAINT IF EXISTS device_tokens_provider_check;
ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_provider_check CHECK (((provider)::text = ANY (ARRAY[('FCM'::character varying)::text, ('APNS'::character varying)::text])));
ALTER TABLE doctor_break_periods DROP CONSTRAINT IF EXISTS valid_break_time;
ALTER TABLE doctor_break_periods ADD CONSTRAINT valid_break_time CHECK ((start_time < end_time));
ALTER TABLE doctor_schedules DROP CONSTRAINT IF EXISTS doctor_schedules_day_of_week_check;
ALTER TABLE doctor_schedules ADD CONSTRAINT doctor_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)));
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS check_approval_status;
ALTER TABLE doctors ADD CONSTRAINT check_approval_status CHECK (((approval_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('ACTIVE'::character varying)::text, ('REJECTED'::character varying)::text])));
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS check_doctors_profile_completion_status;
ALTER TABLE doctors ADD CONSTRAINT check_doctors_profile_completion_status CHECK (((profile_completion_status)::text = ANY (ARRAY[('INCOMPLETE'::character varying)::text, ('COMPLETE'::character varying)::text, ('SUBMITTED'::character varying)::text])));
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_status;
ALTER TABLE invoices ADD CONSTRAINT chk_invoice_status CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'VOID'::text])));
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check CHECK (((message_type)::text = ANY (ARRAY[('TEXT'::character varying)::text, ('INVOICE'::character varying)::text])));
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_sex_check;
ALTER TABLE patients ADD CONSTRAINT patients_sex_check CHECK (((sex)::text = ANY ((ARRAY['MALE'::character varying, 'FEMALE'::character varying, 'OTHER'::character varying, 'NOT_SPECIFIED'::character varying])::text[])));
-- Source migration: 046_add_service_other_charge_types.sql
ALTER TABLE payment_charges DROP CONSTRAINT IF EXISTS payment_charges_charge_type_check;
ALTER TABLE payment_charges ADD CONSTRAINT payment_charges_charge_type_check CHECK (((charge_type)::text = ANY (ARRAY[('ADDITIONAL'::character varying)::text, ('MEDICINE'::character varying)::text, ('SERVICE'::character varying)::text, ('OTHER'::character varying)::text])));
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check CHECK (((payment_method)::text = ANY (ARRAY[('CASH'::character varying)::text, ('GCASH'::character varying)::text])));
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check CHECK (((status)::text = ANY (ARRAY['UNPAID'::text, 'PENDING_VERIFICATION'::text, 'PARTIAL'::text, 'PAID'::text, 'OVERPAID'::text, 'REJECTED'::text, 'CANCELLED'::text])));

-- Source migration: 043_add_billing_redesign.sql
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_kind_check CHECK (((kind)::text = ANY (ARRAY[('PAYMENT'::character varying)::text, ('REFUND'::character varying)::text])));
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_method_check CHECK (((method)::text = ANY (ARRAY[('CASH'::character varying)::text, ('GCASH'::character varying)::text])));
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_status_check CHECK (((status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('ACCEPTED'::character varying)::text, ('REJECTED'::character varying)::text, ('VOIDED'::character varying)::text])));
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_source_check CHECK (((source)::text = ANY (ARRAY[('PATIENT_UPLOAD'::character varying)::text, ('SECRETARY'::character varying)::text])));
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE pending_patient_signups DROP CONSTRAINT IF EXISTS pending_patient_signups_sex_check;
ALTER TABLE pending_patient_signups ADD CONSTRAINT pending_patient_signups_sex_check CHECK (((sex)::text = ANY (ARRAY[('MALE'::character varying)::text, ('FEMALE'::character varying)::text, ('OTHER'::character varying)::text, ('NOT_SPECIFIED'::character varying)::text])));
ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_registration_source_check;
ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_registration_source_check CHECK (((registration_source)::text = ANY (ARRAY[('ONLINE'::character varying)::text, ('WALK_IN'::character varying)::text])));
ALTER TABLE queue_entries DROP CONSTRAINT IF EXISTS queue_entries_status_check;
ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_status_check CHECK (((status)::text = ANY (ARRAY[('WAITING'::character varying)::text, ('CALLED'::character varying)::text, ('NOT_PRESENT'::character varying)::text, ('SKIPPED'::character varying)::text, ('IN_CHECKUP'::character varying)::text, ('COMPLETED'::character varying)::text, ('CANCELLED'::character varying)::text, ('NO_SHOW'::character varying)::text])));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('PATIENT'::character varying)::text, ('DOCTOR'::character varying)::text, ('SECRETARY'::character varying)::text, ('ADMIN'::character varying)::text, ('SUPERADMIN'::character varying)::text])));
ALTER TABLE waitlists DROP CONSTRAINT IF EXISTS waitlists_status_check;
ALTER TABLE waitlists ADD CONSTRAINT waitlists_status_check CHECK (((status)::text = ANY (ARRAY[('WAITING'::character varying)::text, ('OFFERED'::character varying)::text, ('CONVERTED'::character varying)::text, ('EXPIRED'::character varying)::text, ('CANCELLED'::character varying)::text])));
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='admin_audit_log'::regclass AND conname='admin_audit_log_actor_user_id_fkey') THEN
    ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='admin_audit_log'::regclass AND conname='admin_audit_log_target_user_id_fkey') THEN
    ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ai_conversations'::regclass AND conname='ai_conversations_patient_id_fkey') THEN
    ALTER TABLE ai_conversations ADD CONSTRAINT ai_conversations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ai_daily_limits'::regclass AND conname='ai_daily_limits_patient_id_fkey') THEN
    ALTER TABLE ai_daily_limits ADD CONSTRAINT ai_daily_limits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='ai_messages'::regclass AND conname='ai_messages_conversation_id_fkey') THEN
    ALTER TABLE ai_messages ADD CONSTRAINT ai_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='appointments'::regclass AND conname='appointments_doctor_id_fkey') THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='appointments'::regclass AND conname='appointments_patient_id_fkey') THEN
    ALTER TABLE appointments ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
-- Source migration: 043_add_billing_redesign.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='billing_audit_log'::regclass AND conname='billing_audit_log_payment_id_fkey') THEN
    ALTER TABLE billing_audit_log ADD CONSTRAINT billing_audit_log_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='billing_audit_log'::regclass AND conname='billing_audit_log_actor_user_id_fkey') THEN
    ALTER TABLE billing_audit_log ADD CONSTRAINT billing_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='conversations'::regclass AND conname='conversations_doctor_id_fkey') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='conversations'::regclass AND conname='conversations_patient_id_fkey') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='conversations'::regclass AND conname='conversations_secretary_id_fkey') THEN
    ALTER TABLE conversations ADD CONSTRAINT conversations_secretary_id_fkey FOREIGN KEY (secretary_id) REFERENCES secretaries(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='daily_capacities'::regclass AND conname='daily_capacities_doctor_id_fkey') THEN
    ALTER TABLE daily_capacities ADD CONSTRAINT daily_capacities_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='device_tokens'::regclass AND conname='device_tokens_user_id_fkey') THEN
    ALTER TABLE device_tokens ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctor_break_periods'::regclass AND conname='doctor_break_periods_doctor_id_fkey') THEN
    ALTER TABLE doctor_break_periods ADD CONSTRAINT doctor_break_periods_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctor_schedules'::regclass AND conname='doctor_schedules_doctor_id_fkey') THEN
    ALTER TABLE doctor_schedules ADD CONSTRAINT doctor_schedules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctor_unavailability'::regclass AND conname='doctor_unavailability_doctor_id_fkey') THEN
    ALTER TABLE doctor_unavailability ADD CONSTRAINT doctor_unavailability_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctors'::regclass AND conname='doctors_reviewed_by_fkey') THEN
    ALTER TABLE doctors ADD CONSTRAINT doctors_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='doctors'::regclass AND conname='doctors_user_id_fkey') THEN
    ALTER TABLE doctors ADD CONSTRAINT doctors_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoice_settings'::regclass AND conname='invoice_settings_doctor_id_fkey') THEN
    ALTER TABLE invoice_settings ADD CONSTRAINT invoice_settings_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND conname='invoices_doctor_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND conname='invoices_patient_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND conname='invoices_payment_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
  END IF;
END $$;
-- Source migration: 043_add_billing_redesign.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND conname='invoices_replaces_invoice_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_replaces_invoice_id_fkey FOREIGN KEY (replaces_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND conname='invoices_replaced_by_invoice_id_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_replaced_by_invoice_id_fkey FOREIGN KEY (replaced_by_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='invoices'::regclass AND conname='invoices_voided_by_fkey') THEN
    ALTER TABLE invoices ADD CONSTRAINT invoices_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='login_otp_challenges'::regclass AND conname='login_otp_challenges_user_id_fkey') THEN
    ALTER TABLE login_otp_challenges ADD CONSTRAINT login_otp_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='messages'::regclass AND conname='messages_conversation_id_fkey') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='messages'::regclass AND conname='messages_invoice_id_fkey') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='messages'::regclass AND conname='messages_sender_user_id_fkey') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='notifications'::regclass AND conname='notifications_user_id_fkey') THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='patient_doctor_associations'::regclass AND conname='patient_doctor_associations_doctor_id_fkey') THEN
    ALTER TABLE patient_doctor_associations ADD CONSTRAINT patient_doctor_associations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='patient_doctor_associations'::regclass AND conname='patient_doctor_associations_patient_id_fkey') THEN
    ALTER TABLE patient_doctor_associations ADD CONSTRAINT patient_doctor_associations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='patients'::regclass AND conname='patients_user_id_fkey') THEN
    ALTER TABLE patients ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_charges'::regclass AND conname='payment_charges_created_by_fkey') THEN
    ALTER TABLE payment_charges ADD CONSTRAINT payment_charges_created_by_fkey FOREIGN KEY (created_by) REFERENCES secretaries(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_charges'::regclass AND conname='payment_charges_payment_id_fkey') THEN
    ALTER TABLE payment_charges ADD CONSTRAINT payment_charges_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_charges'::regclass AND conname='payment_charges_prescription_item_id_fkey') THEN
    ALTER TABLE payment_charges ADD CONSTRAINT payment_charges_prescription_item_id_fkey FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id) ON DELETE SET NULL;
  END IF;
END $$;
-- Source migration: 043_add_billing_redesign.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND conname='payment_transactions_payment_id_fkey') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND conname='payment_transactions_reviewed_by_fkey') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND conname='payment_transactions_voided_by_fkey') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_voided_by_fkey FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payment_transactions'::regclass AND conname='payment_transactions_created_by_fkey') THEN
    ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payments'::regclass AND conname='payments_appointment_id_fkey') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payments'::regclass AND conname='payments_patient_id_fkey') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='payments'::regclass AND conname='payments_verified_by_fkey') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES secretaries(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='prescription_items'::regclass AND conname='prescription_items_prescription_id_fkey') THEN
    ALTER TABLE prescription_items ADD CONSTRAINT prescription_items_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='prescriptions'::regclass AND conname='prescriptions_doctor_id_fkey') THEN
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='prescriptions'::regclass AND conname='prescriptions_patient_id_fkey') THEN
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='prescriptions'::regclass AND conname='prescriptions_visit_id_fkey') THEN
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='queue_entries'::regclass AND conname='queue_entries_appointment_id_fkey') THEN
    ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='queue_entries'::regclass AND conname='queue_entries_doctor_id_fkey') THEN
    ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='queue_entries'::regclass AND conname='queue_entries_patient_id_fkey') THEN
    ALTER TABLE queue_entries ADD CONSTRAINT queue_entries_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='secretaries'::regclass AND conname='secretaries_doctor_id_fkey') THEN
    ALTER TABLE secretaries ADD CONSTRAINT secretaries_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='secretaries'::regclass AND conname='secretaries_user_id_fkey') THEN
    ALTER TABLE secretaries ADD CONSTRAINT secretaries_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='visits'::regclass AND conname='visits_appointment_id_fkey') THEN
    ALTER TABLE visits ADD CONSTRAINT visits_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='visits'::regclass AND conname='visits_doctor_id_fkey') THEN
    ALTER TABLE visits ADD CONSTRAINT visits_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='visits'::regclass AND conname='visits_patient_id_fkey') THEN
    ALTER TABLE visits ADD CONSTRAINT visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='waitlists'::regclass AND conname='waitlists_doctor_id_fkey') THEN
    ALTER TABLE waitlists ADD CONSTRAINT waitlists_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='waitlists'::regclass AND conname='waitlists_patient_id_fkey') THEN
    ALTER TABLE waitlists ADD CONSTRAINT waitlists_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log USING btree (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_timestamp ON admin_audit_log USING btree (action, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_user_id ON admin_audit_log USING btree (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON admin_audit_log USING btree (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_timestamp ON admin_audit_log USING btree ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_patient_id ON ai_conversations USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_ai_daily_limits_patient_date ON ai_daily_limits USING btree (patient_id, message_date);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments USING btree (appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments USING btree (status);
-- Source migration: 043_add_billing_redesign.sql
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_payment_id ON billing_audit_log USING btree (payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_audit_log_created_at ON billing_audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_doctor_id ON conversations USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_patient_id ON conversations USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_conversations_secretary_id ON conversations USING btree (secretary_id);
CREATE INDEX IF NOT EXISTS idx_daily_capacities_date ON daily_capacities USING btree (date);
CREATE INDEX IF NOT EXISTS idx_daily_capacities_doctor_id ON daily_capacities USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens USING btree (token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_break_periods_active ON doctor_break_periods USING btree (doctor_id, is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_doctor_break_periods_doctor_date ON doctor_break_periods USING btree (doctor_id, break_date);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor_id ON doctor_schedules USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctor_unavailability_dates ON doctor_unavailability USING btree (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_doctor_unavailability_doctor_id ON doctor_unavailability USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_doctors_approval_status ON doctors USING btree (approval_status);
CREATE INDEX IF NOT EXISTS idx_doctors_gcash_qr_url ON doctors USING btree (gcash_qr_url) WHERE (gcash_qr_url IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_prc_license_number ON doctors USING btree (prc_license_number) WHERE (prc_license_number IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_doctors_profile_completion_status ON doctors USING btree (profile_completion_status);
CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_doctor_id ON invoices USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices USING btree (invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_id ON invoices USING btree (payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices USING btree (status);
-- Source migration: 043_add_billing_redesign.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_one_active_per_payment ON invoices USING btree (payment_id) WHERE (status = 'ACTIVE'::text);
CREATE INDEX IF NOT EXISTS idx_login_otp_challenges_expires_at ON login_otp_challenges USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_login_otp_challenges_hash ON login_otp_challenges USING btree (challenge_token_hash);
CREATE INDEX IF NOT EXISTS idx_login_otp_challenges_user_id ON login_otp_challenges USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_invoice_id ON messages USING btree (invoice_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_user_id ON messages USING btree (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications USING btree (is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_completion_status ON patient_doctor_associations USING btree (details_completion_status);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_doctor_id ON patient_doctor_associations USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_patient_id ON patient_doctor_associations USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_sex ON patients USING btree (sex);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_charges_charge_type ON payment_charges USING btree (charge_type);
CREATE INDEX IF NOT EXISTS idx_payment_charges_deleted_at ON payment_charges USING btree (deleted_at) WHERE (deleted_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_payment_charges_prescription_item_id ON payment_charges USING btree (prescription_item_id) WHERE (prescription_item_id IS NOT NULL);
-- Source migration: 043_add_billing_redesign.sql
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON payment_transactions USING btree (payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_status ON payment_transactions USING btree (payment_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON payments USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments USING btree (status);
CREATE INDEX IF NOT EXISTS idx_pending_doctor_signups_expires_at ON pending_doctor_signups USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_doctor_signups_prc_license_number ON pending_doctor_signups USING btree (prc_license_number);
CREATE INDEX IF NOT EXISTS idx_pending_patient_signups_email ON pending_patient_signups USING btree (email);
CREATE INDEX IF NOT EXISTS idx_pending_patient_signups_expires_at ON pending_patient_signups USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor_id ON prescriptions USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_visit_id ON prescriptions USING btree (visit_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_doctor_id ON queue_entries USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_patient_id ON queue_entries USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_queue_date ON queue_entries USING btree (queue_date);
CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries USING btree (status);
CREATE INDEX IF NOT EXISTS idx_secretaries_doctor_id ON secretaries USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_secretaries_user_id ON secretaries USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_browsers_expires_at ON trusted_browsers USING btree (expires_at);
CREATE INDEX IF NOT EXISTS idx_trusted_browsers_token ON trusted_browsers USING btree (token_hash);
CREATE INDEX IF NOT EXISTS idx_trusted_browsers_user_active ON trusted_browsers USING btree (user_id) WHERE (revoked_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_users_username ON users USING btree (username);
CREATE INDEX IF NOT EXISTS idx_visits_appointment_id ON visits USING btree (appointment_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON visits USING btree (doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON visits USING btree (patient_id);
CREATE INDEX IF NOT EXISTS idx_waitlists_doctor_date_status ON waitlists USING btree (doctor_id, waitlist_date, status);
CREATE INDEX IF NOT EXISTS idx_waitlists_patient_id ON waitlists USING btree (patient_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_ai_daily_limits_updated_at ON ai_daily_limits;
CREATE TRIGGER update_ai_daily_limits_updated_at BEFORE UPDATE ON ai_daily_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_daily_capacities_updated_at ON daily_capacities;
CREATE TRIGGER update_daily_capacities_updated_at BEFORE UPDATE ON daily_capacities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_doctor_schedules_updated_at ON doctor_schedules;
CREATE TRIGGER update_doctor_schedules_updated_at BEFORE UPDATE ON doctor_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_doctors_updated_at ON doctors;
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_patient_doctor_associations_updated_at ON patient_doctor_associations;
CREATE TRIGGER update_patient_doctor_associations_updated_at BEFORE UPDATE ON patient_doctor_associations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_queue_entries_updated_at ON queue_entries;
CREATE TRIGGER update_queue_entries_updated_at BEFORE UPDATE ON queue_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_secretaries_updated_at ON secretaries;
CREATE TRIGGER update_secretaries_updated_at BEFORE UPDATE ON secretaries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_visits_updated_at ON visits;
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS trigger_update_waitlists_updated_at ON waitlists;
CREATE TRIGGER trigger_update_waitlists_updated_at BEFORE UPDATE ON waitlists FOR EACH ROW EXECUTE FUNCTION update_waitlists_updated_at();

-- ---------------------------------------------------------------------------
-- Application-required objects missing from the previous live schema
-- (sourced from migrations 023_add_patient_required_fields.sql and
--  024_add_walk_in_completion_status.sql)
-- ---------------------------------------------------------------------------

ALTER TABLE patients ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS sex VARCHAR(20) NOT NULL DEFAULT 'NOT_SPECIFIED';

ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_sex_check;
ALTER TABLE patients ADD CONSTRAINT patients_sex_check CHECK (sex IN ('MALE', 'FEMALE', 'OTHER', 'NOT_SPECIFIED'));
CREATE INDEX IF NOT EXISTS idx_patients_sex ON patients(sex);

CREATE TABLE IF NOT EXISTS patient_doctor_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    first_details_submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details_completion_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, doctor_id)
);

ALTER TABLE patient_doctor_associations ADD COLUMN IF NOT EXISTS details_completion_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_patient_id ON patient_doctor_associations(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_doctor_id ON patient_doctor_associations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_associations_completion_status ON patient_doctor_associations(details_completion_status);

DROP TRIGGER IF EXISTS update_patient_doctor_associations_updated_at ON patient_doctor_associations;
CREATE TRIGGER update_patient_doctor_associations_updated_at
    BEFORE UPDATE ON patient_doctor_associations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Migration: 042_add_gcash_account_details.sql
-- Added gcash_account_name and gcash_account_number columns to doctors table
-- for displaying GCash account details to patients alongside QR code
-- ---------------------------------------------------------------------------
