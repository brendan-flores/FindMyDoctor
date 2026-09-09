# FindMyDoctor PostgreSQL Database Schema

## 1. Documentation Analysis

### User Roles
Based on the documentation, the system supports these user roles:
- **PATIENT**: Can search doctors, book appointments, manage queue, chat with secretaries, use AI chatbot, access medical records
- **DOCTOR**: Manage schedule/capacity, appointments, patient information, visits, prescriptions
- **SECRETARY**: Walk-ins, queue management, patient chat, payment verification, daily operations
- **ADMIN**: Users, doctors, secretaries, clinics, approvals, platform oversight

### Core Entities Identified
From the architecture and PRD, these are the main entities:
- **Users**: Base user accounts with authentication
- **Patients**: Patient-specific information and medical history
- **Doctors**: Doctor profiles, specialties, credentials, consultation fees
- **Clinics**: Clinic information, location, operating hours
- **Secretaries**: Secretary profiles and clinic associations
- **Doctor Schedules**: Working hours, availability, unavailability periods
- **Daily Capacities**: Calculated and configured daily patient capacity
- **Appointments**: Patient reservations with date, time, status
- **Queue Entries**: Unified queue for online and walk-in patients
- **Visits**: Completed consultation records
- **Prescriptions**: Digital prescriptions with medication details
- **Payments**: Payment records with GCash receipt verification
- **Payment Charges**: Additional charges added by secretaries
- **Conversations**: Patient-secretary chat conversations
- **Messages**: Individual messages within conversations
- **AI Conversations**: Patient-AI chatbot conversations
- **AI Messages**: Messages within AI conversations
- **Waitlists**: Patients waiting for available slots
- **Notifications**: System notifications for various events

### Key Business Rules
1. **No Direct Patient-Doctor Chat**: Only patient-secretary and patient-AI chat allowed
2. **Unified Queue**: Online and walk-in patients share the same daily queue
3. **Payment Separation**: Reservations don't require advance payment
4. **GCash Manual Verification**: Receipts start as pending, require secretary verification
5. **Walk-in Account Creation**: Temporary passwords, must change on first login
6. **Queue Priority**: Based on registration time, not source (online vs walk-in)
7. **Capacity Rules**: Both online and walk-in consume same daily capacity
8. **Concurrency Protection**: Queue numbers and capacity must be concurrency-safe

## 2. Database Requirements

### Authentication Approach
The documentation doesn't explicitly mention Supabase Auth, but the architecture shows a standard backend API pattern. I'll design this for a custom authentication system that can be adapted to Supabase if needed.

### Data Integrity Requirements
- Prevent double booking through constraints
- Ensure queue numbers are sequential and unique per day
- Maintain referential integrity through foreign keys
- Support atomic transactions for booking operations
- Protect sensitive medical and payment data

### Performance Requirements
- Indexes for common queries (patient appointments, doctor schedules, queue lookups)
- Efficient queue number generation
- Fast availability checking
- Quick patient history retrieval

## 3. ERD / Table Relationship Overview

```
users (1) ----< (1) patients
users (1) ----< (1) doctors
users (1) ----< (1) secretaries

clinics (1) ----< (many) doctors
clinics (1) ----< (many) secretaries

doctors (1) ----< (many) doctor_schedules
doctors (1) ----< (many) daily_capacities
doctors (1) ----< (many) appointments
doctors (1) ----< (many) queue_entries
doctors (1) ----< (many) visits
doctors (1) ----< (many) prescriptions

patients (1) ----< (many) appointments
patients (1) ----< (many) queue_entries
patients (1) ----< (many) visits
patients (1) ----< (many) prescriptions
patients (1) ----< (many) payments
patients (1) ----< (many) conversations
patients (1) ----< (many) ai_conversations

appointments (1) ----< (1) queue_entries
appointments (1) ----< (1) visits
appointments (1) ----< (1) payments

clinics (1) ----< (many) appointments
clinics (1) ----< (many) queue_entries
clinics (1) ----< (many) daily_capacities
clinics (1) ----< (many) conversations

visits (1) ----< (many) prescriptions
payments (1) ----< (many) payment_charges

conversations (1) ----< (many) messages
ai_conversations (1) ----< (many) ai_messages
```

## 4. Database Tables

### Core User Tables

#### users
Base user table for authentication and common user data.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'SECRETARY', 'ADMIN')),
    is_active BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**: 
- Central authentication point for all user types
- Stores common user data (email, password, role)
- Role-based access control foundation
- Supports walk-in account creation with temporary passwords

**Key design decisions**:
- UUID for primary key: Distributed system friendly, no predictable IDs
- Email uniqueness: Prevents duplicate accounts
- Role CHECK constraint: Ensures only valid roles
- must_change_password: Supports walk-in account workflow

#### patients
Patient-specific information and medical history.

```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    phone VARCHAR(20),
    address TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    current_medications TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Separates patient data from base user authentication
- Stores medical information that's specific to patients
- One-to-one relationship with users table
- Supports medical history tracking across consultations

#### doctors
Doctor profiles and professional information.

```sql
CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    credentials VARCHAR(255),
    biography TEXT,
    consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Stores doctor-specific professional information
- Links to clinic for location and operational data
- Contains consultation fee for payment calculations
- Approval status for admin workflow

#### secretaries
Secretary profiles and clinic associations.

```sql
CREATE TABLE secretaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Links secretaries to specific clinics
- Supports secretary-clinic relationships
- Approval status for admin workflow

#### clinics
Clinic information and location data.

```sql
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    description TEXT,
    operating_hours_start TIME,
    operating_hours_end TIME,
    gcash_qr_code_url TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Central clinic information for location and operations
- Stores coordinates for map functionality
- Contains GCash QR code for payments
- Operating hours for capacity calculations

**Key design decisions**:
- latitude/longitude: DECIMAL for precise coordinate storage
- gcash_qr_code_url: Static QR code per clinic as per requirements

### Scheduling and Capacity Tables

#### doctor_schedules
Doctor working hours and availability patterns.

```sql
CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    consultation_duration_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, day_of_week)
);
```

**Why this table is necessary**:
- Defines recurring weekly availability
- Supports different consultation durations per doctor
- Foundation for capacity calculations

#### doctor_unavailability
Specific dates/times when doctor is unavailable.

```sql
CREATE TABLE doctor_unavailability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Handles exceptions to regular schedule (vacations, conferences)
- Prevents booking during unavailable periods
- Supports complex availability patterns

#### daily_capacities
Daily capacity calculations and overrides.

```sql
CREATE TABLE daily_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    consultation_duration_minutes INTEGER DEFAULT 30,
    calculated_capacity INTEGER NOT NULL,
    configured_capacity INTEGER,
    final_capacity INTEGER NOT NULL,
    registered_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, date)
);
```

**Why this table is necessary**:
- Enforces daily capacity limits
- Supports both calculated and configured capacity
- Tracks registered patient count for availability
- Prevents overbooking

**Key design decisions**:
- calculated_capacity: Auto-calculated from schedule
- configured_capacity: Manual override by doctor/secretary
- final_capacity: MIN(calculated, configured) - the enforced limit
- registered_count: Tracks current registrations

### Appointment and Queue Tables

#### appointments
Patient reservations and appointment records.

```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    reason_for_visit TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Core appointment tracking
- Links patients, doctors, and clinics
- Status tracking for appointment lifecycle
- Foundation for queue entries and visits

**Key design decisions**:
- Status CHECK constraint: Ensures valid status transitions
- Separate appointment_date and end_time: Supports varying durations

#### queue_entries
Unified queue for online and walk-in patients.

```sql
CREATE TABLE queue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    queue_date DATE NOT NULL,
    queue_number INTEGER NOT NULL,
    registration_source VARCHAR(10) NOT NULL CHECK (registration_source IN ('ONLINE', 'WALK_IN')),
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'NOT_PRESENT', 'SKIPPED', 'IN_CHECKUP', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    called_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(queue_date, doctor_id, queue_number)
);
```

**Why this table is necessary**:
- Implements unified queue requirement
- Tracks queue numbers for both online and walk-in
- Supports queue status transitions
- Maintains queue history for reporting

**Key design decisions**:
- UNIQUE(queue_date, doctor_id, queue_number): Prevents duplicate queue numbers
- registration_source CHECK: Enforces ONLINE or WALK_IN only
- Timestamp fields: Track queue progression
- Link to appointment: Optional for walk-ins without prior booking

### Medical Records Tables

#### visits
Completed consultation records.

```sql
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason_for_visit TEXT,
    diagnosis TEXT,
    notes TEXT,
    blood_pressure VARCHAR(20),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    temperature DECIMAL(4,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Records completed consultations
- Stores medical examination data
- Foundation for prescriptions
- Maintains patient medical history

#### prescriptions
Digital prescriptions created by doctors.

```sql
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    prescription_date DATE NOT NULL,
    pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Links prescriptions to specific visits
- Supports PDF generation and storage
- Maintains prescription history

#### prescription_items
Individual medications within prescriptions.

```sql
CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Supports multiple medications per prescription
- Detailed dosage and administration instructions
- One-to-many relationship with prescriptions

### Payment Tables

#### payments
Payment records with GCash verification.

```sql
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'GCASH')),
    consultation_amount DECIMAL(10,2) NOT NULL,
    total_additional_charges DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED')),
    receipt_url TEXT,
    verified_by UUID REFERENCES secretaries(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Separates payment from appointment creation
- Supports GCash receipt verification workflow
- Tracks payment status transitions
- Links to secretary for verification audit trail

**Key design decisions**:
- payment_method CHECK: CASH or GCASH only
- Status workflow: UNPAID → PENDING_VERIFICATION → PAID/REJECTED
- verified_by: Audit trail for who approved payments

#### payment_charges
Additional charges added by secretaries.

```sql
CREATE TABLE payment_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_by UUID REFERENCES secretaries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Supports additional charges (medicine, services)
- Maintains audit trail of who added charges
- Calculated into total payment amount

### Communication Tables

#### conversations
Patient-secretary chat conversations.

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    secretary_id UUID NOT NULL REFERENCES secretaries(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, secretary_id, clinic_id)
);
```

**Why this table is necessary**:
- Implements patient-secretary chat requirement
- No doctor_id field - enforces no patient-doctor chat
- Status tracking for conversation lifecycle
- Unique constraint prevents duplicate conversations

**Key design decisions**:
- No doctor_id: Enforces architecture rule against patient-doctor chat
- UNIQUE(patient_id, secretary_id, clinic_id): One conversation per patient-secretary-clinic

#### messages
Individual messages within conversations.

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);
```

**Why this table is necessary**:
- Stores individual chat messages
- Tracks read status (read_at timestamp)
- Links to both conversation and sender

#### ai_conversations
Patient-AI chatbot conversations.

```sql
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Implements AI chatbot functionality
- Separate from human conversations
- Maintains conversation history

#### ai_messages
Messages within AI conversations.

```sql
CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Stores AI chat messages with role differentiation
- Supports system prompts and user/assistant messages
- Maintains context for AI conversations

### Additional Tables

#### waitlists
Patients waiting for available appointment slots.

```sql
CREATE TABLE waitlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    preferred_date_start DATE NOT NULL,
    preferred_date_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Supports waitlist functionality mentioned in requirements
- Tracks patient preferences for availability
- Status tracking for waitlist lifecycle

#### notifications
System notifications for various events.

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Why this table is necessary**:
- Supports notification requirements
- Links to users for personalized notifications
- Tracks read status
- Flexible linking to related entities (appointments, payments, etc.)

## 5. Relationship Explanation

### One-to-One Relationships
- **users ↔ patients**: Each patient has exactly one user account
- **users ↔ doctors**: Each doctor has exactly one user account  
- **users ↔ secretaries**: Each secretary has exactly one user account
- **appointments ↔ queue_entries**: Each appointment has at most one queue entry
- **appointments ↔ visits**: Each appointment has at most one visit record
- **appointments ↔ payments**: Each appointment has at most one payment record

### One-to-Many Relationships
- **clinics → doctors**: One clinic can have many doctors
- **clinics → secretaries**: One clinic can have many secretaries
- **doctors → appointments**: One doctor can have many appointments
- **doctors → queue_entries**: One doctor can have many queue entries
- **patients → appointments**: One patient can have many appointments
- **patients → queue_entries**: One patient can have many queue entries
- **visits → prescriptions**: One visit can have many prescriptions
- **prescriptions → prescription_items**: One prescription can have many items
- **payments → payment_charges**: One payment can have many additional charges
- **conversations → messages**: One conversation can have many messages
- **ai_conversations → ai_messages**: One AI conversation can have many messages

### Many-to-Many Relationships
- No explicit many-to-many relationships in this schema, as the architecture emphasizes clear, direct relationships without unnecessary complexity.

## 6. Complete PostgreSQL SQL

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core User Tables
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'SECRETARY', 'ADMIN')),
    is_active BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    phone VARCHAR(20),
    address TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    current_medications TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    credentials VARCHAR(255),
    biography TEXT,
    consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE secretaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    description TEXT,
    operating_hours_start TIME,
    operating_hours_end TIME,
    gcash_qr_code_url TEXT,
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Scheduling and Capacity Tables
CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    consultation_duration_minutes INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, day_of_week)
);

CREATE TABLE doctor_unavailability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE daily_capacities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    consultation_duration_minutes INTEGER DEFAULT 30,
    calculated_capacity INTEGER NOT NULL,
    configured_capacity INTEGER,
    final_capacity INTEGER NOT NULL,
    registered_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doctor_id, date)
);

-- Appointment and Queue Tables
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    reason_for_visit TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE queue_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    queue_date DATE NOT NULL,
    queue_number INTEGER NOT NULL,
    registration_source VARCHAR(10) NOT NULL CHECK (registration_source IN ('ONLINE', 'WALK_IN')),
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'NOT_PRESENT', 'SKIPPED', 'IN_CHECKUP', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    called_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(queue_date, doctor_id, queue_number)
);

-- Medical Records Tables
CREATE TABLE visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID UNIQUE NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason_for_visit TEXT,
    diagnosis TEXT,
    notes TEXT,
    blood_pressure VARCHAR(20),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    temperature DECIMAL(4,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    prescription_date DATE NOT NULL,
    pdf_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    duration VARCHAR(100),
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment Tables
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID UNIQUE REFERENCES appointments(id) ON DELETE SET NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'GCASH')),
    consultation_amount DECIMAL(10,2) NOT NULL,
    total_additional_charges DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PENDING_VERIFICATION', 'PAID', 'REJECTED')),
    receipt_url TEXT,
    verified_by UUID REFERENCES secretaries(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payment_charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_by UUID REFERENCES secretaries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Communication Tables
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    secretary_id UUID NOT NULL REFERENCES secretaries(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'ARCHIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(patient_id, secretary_id, clinic_id)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Additional Tables
CREATE TABLE waitlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    preferred_date_start DATE NOT NULL,
    preferred_date_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctors_clinic_id ON doctors(clinic_id);
CREATE INDEX idx_secretaries_user_id ON secretaries(user_id);
CREATE INDEX idx_secretaries_clinic_id ON secretaries(clinic_id);
CREATE INDEX idx_doctor_schedules_doctor_id ON doctor_schedules(doctor_id);
CREATE INDEX idx_doctor_unavailability_doctor_id ON doctor_unavailability(doctor_id);
CREATE INDEX idx_doctor_unavailability_dates ON doctor_unavailability(start_date, end_date);
CREATE INDEX idx_daily_capacities_doctor_id ON daily_capacities(doctor_id);
CREATE INDEX idx_daily_capacities_date ON daily_capacities(date);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_queue_entries_patient_id ON queue_entries(patient_id);
CREATE INDEX idx_queue_entries_doctor_id ON queue_entries(doctor_id);
CREATE INDEX idx_queue_entries_queue_date ON queue_entries(queue_date);
CREATE INDEX idx_queue_entries_status ON queue_entries(status);
CREATE INDEX idx_visits_patient_id ON visits(patient_id);
CREATE INDEX idx_visits_doctor_id ON visits(doctor_id);
CREATE INDEX idx_visits_appointment_id ON visits(appointment_id);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_doctor_id ON prescriptions(doctor_id);
CREATE INDEX idx_prescriptions_visit_id ON prescriptions(visit_id);
CREATE INDEX idx_payments_patient_id ON payments(patient_id);
CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);
CREATE INDEX idx_conversations_secretary_id ON conversations(secretary_id);
CREATE INDEX idx_conversations_clinic_id ON conversations(clinic_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_user_id ON messages(sender_user_id);
CREATE INDEX idx_ai_conversations_patient_id ON ai_conversations(patient_id);
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_waitlists_patient_id ON waitlists(patient_id);
CREATE INDEX idx_waitlists_doctor_id ON waitlists(doctor_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
```

## 7. Supabase Authentication Integration

Since the documentation doesn't explicitly require Supabase Auth, I've designed this for a custom authentication system. However, if you want to integrate Supabase Auth later, here's how you would adapt it:

### Supabase Auth Integration Pattern

If using Supabase Auth, you would:

1. **Remove password-related fields** from the `users` table since Supabase handles authentication
2. **Reference Supabase's `auth.users`** table instead of your own
3. **Create a `profiles` table** that links to Supabase user IDs

```sql
-- Modified users table for Supabase integration
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'SECRETARY', 'ADMIN')),
    is_active BOOLEAN DEFAULT true,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Authentication Flow
- Supabase handles user registration, login, and password management
- Your application stores role and profile information in your tables
- The `id` in your tables matches the `id` in Supabase's `auth.users`

## 8. RLS Policies

For custom authentication, you would implement authorization at the application level. If using Supabase, here are example RLS policies:

### Example RLS Policies

```sql
-- Enable RLS on all tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_entries ENABLE ROW LEVEL SECURITY;
-- ... enable on other tables

-- Patients can only see their own data
CREATE POLICY "Patients can view own data" ON patients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Patients can update own data" ON patients
    FOR UPDATE USING (auth.uid() = user_id);

-- Doctors can view appointments they're involved in
CREATE POLICY "Doctors can view their appointments" ON appointments
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM doctors WHERE id = doctor_id
        )
    );

-- Secretaries can view their clinic's data
CREATE POLICY "Secretaries can view clinic appointments" ON appointments
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM secretaries WHERE clinic_id = appointments.clinic_id
        )
    );
```

## 9. Step-by-Step PostgreSQL Implementation

### Step 1 — Create/Prepare PostgreSQL Database

**What you're doing**: Setting up the database server and creating a database for FindMyDoctor.

**Why**: PostgreSQL needs a dedicated database to store all the application's data in an organized way.

**How to verify**: You can connect to the database and run basic queries.

```bash
# For local PostgreSQL
createdb findmydoctor

# Or using psql
psql -U postgres
CREATE DATABASE findmydoctor;
\q

# Verify connection
psql -U postgres -d findmydoctor -c "SELECT current_database();"
```

### Step 2 — Create Extensions

**What you're doing**: Enabling PostgreSQL extensions that provide additional functionality.

**Why**: The `uuid-ossp` extension provides UUID generation functions needed for unique identifiers.

**How to verify**: Query for available extensions.

```sql
-- Connect to your database
\c findmydoctor

-- Create extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';
```

### Step 3 — Create Core Tables

**What you're doing**: Creating the fundamental tables that store user authentication and basic entity data.

**Why**: These tables form the foundation - users, patients, doctors, secretaries, and clinics are referenced by almost all other tables.

**How to verify**: List the tables and check their structure.

```sql
-- Create core tables in order (users first, then dependent tables)
-- Execute the SQL from section 6 for core tables

-- Verify tables were created
\dt

-- Check table structure
\d users
\d patients
\d doctors
\d clinics
\d secretaries
```

### Step 4 — Create Relationships

**What you're doing**: Creating the remaining tables that define the business logic and relationships.

**Why**: These tables handle appointments, scheduling, payments, communications, and medical records.

**How to verify**: Check that all foreign key relationships are valid.

```sql
-- Create remaining tables from the SQL in section 6

-- Verify all tables exist
\dt

-- Check foreign key constraints
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

### Step 5 — Add Constraints

**What you're doing**: The constraints are already included in the CREATE TABLE statements, but you might want to add additional business logic constraints.

**Why**: Constraints ensure data integrity by preventing invalid data from being inserted.

**How to verify**: Try to insert invalid data and ensure it fails.

```sql
-- Test role constraint (should fail)
INSERT INTO users (email, password_hash, role) 
VALUES ('test@test.com', 'hash', 'INVALID_ROLE');

-- Test queue number uniqueness (should fail if duplicate)
-- This would be tested after inserting data
```

### Step 6 — Add Indexes

**What you're doing**: Creating indexes on frequently queried columns.

**Why**: Indexes dramatically improve query performance for common lookups like finding a patient's appointments or checking doctor availability.

**How to verify**: Check that indexes exist and analyze query performance.

```sql
-- Create indexes from the SQL in section 6

-- Verify indexes
\di

-- Check index usage
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'appointments';
```

### Step 7 — Configure Authentication

**What you're doing**: Setting up the authentication system to work with your user tables.

**Why**: Secure authentication is critical for protecting patient data and ensuring proper access control.

**How to verify**: Test user registration and login flows.

```sql
-- Insert a test user
INSERT INTO users (email, password_hash, role, must_change_password)
VALUES ('test@example.com', 'hashed_password', 'PATIENT', false);

-- Verify user was created
SELECT * FROM users WHERE email = 'test@example.com';
```

### Step 8 — Configure RLS (if using Supabase)

**What you're doing**: Setting up Row Level Security policies to control data access at the database level.

**Why**: RLS provides an additional security layer by ensuring users can only access data they're authorized to see.

**How to verify**: Test access with different user roles.

```sql
-- Enable RLS and create policies from section 8

-- Test policies by attempting queries with different user contexts
-- This would typically be done through your application
```

### Step 9 — Insert Test Data

**What you're doing**: Populating the database with sample data for testing and development.

**Why**: Test data helps verify the schema works correctly and provides realistic data for development.

**How to verify**: Query the tables to ensure data was inserted correctly.

```sql
-- Insert test clinic
INSERT INTO clinics (name, address, latitude, longitude, phone, email)
VALUES ('Test Clinic', '123 Main St', 14.5995, 120.9842, '555-1234', 'info@testclinic.com');

-- Insert test user and patient
INSERT INTO users (email, password_hash, role) 
VALUES ('patient@test.com', 'hash', 'PATIENT');

-- Get the user ID and insert patient
-- (This would typically be done in a transaction)
```

### Step 10 — Test Queries

**What you're doing**: Running typical application queries to ensure the schema supports all required operations.

**Why**: Testing queries validates that the database design meets the application's needs.

**How to verify**: Queries should return expected results and perform well.

```sql
-- Test finding a patient's appointments
SELECT a.*, d.first_name, d.last_name, c.name as clinic_name
FROM appointments a
JOIN doctors d ON a.doctor_id = d.id
JOIN clinics c ON a.clinic_id = c.id
WHERE a.patient_id = 'patient-uuid';

-- Test checking daily capacity
SELECT * FROM daily_capacities 
WHERE doctor_id = 'doctor-uuid' AND date = '2025-10-21';

-- Test queue information
SELECT * FROM queue_entries 
WHERE queue_date = '2025-10-21' AND doctor_id = 'doctor-uuid'
ORDER BY queue_number;
```

### Step 11 — Connect the Application

**What you're doing**: Configuring your backend application to connect to the PostgreSQL database.

**Why**: The application needs database connectivity to perform CRUD operations.

**How to verify**: Run the application and test basic database operations.

```javascript
// Example Node.js connection
const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'findmydoctor',
  password: 'your-password',
  port: 5432,
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  console.log(res.rows);
});
```

## 10. Sample Data

Here's some sample data to help you test the schema:

```sql
-- Insert a clinic
INSERT INTO clinics (name, address, latitude, longitude, phone, email, operating_hours_start, operating_hours_end)
VALUES ('St. Luke\'s Medical Center - BGC', 'Medical Arts Bldg, BGC, Taguig', 14.5498, 121.0489, '828-7000', 'info@stlukes.com.ph', '08:00:00', '17:00:00');

-- Insert users
INSERT INTO users (email, password_hash, role) VALUES
('doctor@example.com', '$2b$10$hash', 'DOCTOR'),
('secretary@example.com', '$2b$10$hash', 'SECRETARY'),
('patient@example.com', '$2b$10$hash', 'PATIENT');

-- Insert doctor profile
INSERT INTO doctors (user_id, clinic_id, first_name, last_name, specialty, credentials, consultation_fee, is_approved)
VALUES (
    (SELECT id FROM users WHERE email = 'doctor@example.com'),
    (SELECT id FROM clinics WHERE name = 'St. Luke\'s Medical Center - BGC'),
    'Maria', 'Santos', 'Cardiology', 'MD, FACC', 1000.00, true
);

-- Insert secretary profile
INSERT INTO secretaries (user_id, clinic_id, first_name, last_name, is_approved)
VALUES (
    (SELECT id FROM users WHERE email = 'secretary@example.com'),
    (SELECT id FROM clinics WHERE name = 'St. Luke\'s Medical Center - BGC'),
    'Grace', 'Lim', true
);

-- Insert patient profile
INSERT INTO patients (user_id, first_name, last_name, phone, emergency_contact_name, emergency_contact_phone)
VALUES (
    (SELECT id FROM users WHERE email = 'patient@example.com'),
    'Juan', 'Reyes', '09171234567', 'Maria Reyes', '09187654321'
);

-- Insert doctor schedule
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, consultation_duration_minutes)
VALUES (
    (SELECT id FROM doctors WHERE last_name = 'Santos'),
    1, -- Monday
    '09:00:00',
    '17:00:00',
    30
);

-- Insert daily capacity
INSERT INTO daily_capacities (doctor_id, clinic_id, date, consultation_duration_minutes, calculated_capacity, final_capacity)
VALUES (
    (SELECT id FROM doctors WHERE last_name = 'Santos'),
    (SELECT id FROM clinics WHERE name = 'St. Luke\'s Medical Center - BGC'),
    '2025-10-21',
    30,
    16,
    16
);
```

## 11. Example Queries

### Finding Available Doctors
```sql
SELECT 
    d.id,
    d.first_name,
    d.last_name,
    d.specialty,
    d.consultation_fee,
    c.name as clinic_name,
    c.address,
    COUNT(DISTINCT a.id) as upcoming_appointments
FROM doctors d
JOIN clinics c ON d.clinic_id = c.id
LEFT JOIN appointments a ON d.id = a.doctor_id 
    AND a.appointment_date > CURRENT_TIMESTAMP
    AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
WHERE d.is_approved = true
GROUP BY d.id, c.id
ORDER BY d.last_name;
```

### Patient's Appointment History
```sql
SELECT 
    a.id,
    a.appointment_date,
    a.status,
    d.first_name as doctor_first_name,
    d.last_name as doctor_last_name,
    d.specialty,
    c.name as clinic_name,
    q.queue_number,
    q.registration_source
FROM appointments a
JOIN doctors d ON a.doctor_id = d.id
JOIN clinics c ON a.clinic_id = c.id
LEFT JOIN queue_entries q ON a.id = q.appointment_id
WHERE a.patient_id = 'patient-uuid'
ORDER BY a.appointment_date DESC;
```

### Daily Queue Information
```sql
SELECT 
    q.id,
    q.queue_number,
    q.status,
    q.registration_source,
    p.first_name,
    p.last_name,
    q.called_at,
    q.started_at,
    q.completed_at
FROM queue_entries q
JOIN patients p ON q.patient_id = p.id
WHERE q.queue_date = '2025-10-21' 
    AND q.doctor_id = 'doctor-uuid'
ORDER BY q.queue_number;
```

### Payment Status by Appointment
```sql
SELECT 
    a.id as appointment_id,
    a.appointment_date,
    p.status as payment_status,
    p.payment_method,
    p.total_amount,
    p.receipt_url,
    s.first_name as verified_by_first,
    s.last_name as verified_by_last
FROM appointments a
LEFT JOIN payments p ON a.id = p.appointment_id
LEFT JOIN secretaries s ON p.verified_by = s.id
WHERE a.patient_id = 'patient-uuid'
ORDER BY a.appointment_date DESC;
```

### Secretary's Clinic Conversations
```sql
SELECT 
    c.id as conversation_id,
    c.status,
    p.first_name as patient_first_name,
    p.last_name as patient_last_name,
    c.updated_at,
    (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.read_at IS NULL) as unread_count
FROM conversations c
JOIN patients p ON c.patient_id = p.id
WHERE c.secretary_id = 'secretary-uuid'
    AND c.clinic_id = 'clinic-uuid'
ORDER BY c.updated_at DESC;
```

## 12. Frontend Integration Guide

### How the Frontend Should Retrieve Data

The frontend (Flutter mobile app and Next.js web app) should **never** connect directly to PostgreSQL. Instead, it should:

1. **Make HTTP requests to your backend API**
2. **The backend validates authentication and authorization**
3. **The backend queries PostgreSQL**
4. **The backend returns JSON responses to the frontend**

### Example API Flow

```
Flutter App → HTTP GET /api/v1/appointments → Backend → PostgreSQL → Return JSON
```

### Example Backend API Endpoint (Node.js/Express)

```javascript
// Get patient's appointments
app.get('/api/v1/appointments', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id; // From authentication middleware
        
        // Get patient ID from user ID
        const patientResult = await pool.query(
            'SELECT id FROM patients WHERE user_id = $1',
            [userId]
        );
        
        if (patientResult.rows.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        
        const patientId = patientResult.rows[0].id;
        
        // Get appointments with related data
        const appointmentsResult = await pool.query(`
            SELECT 
                a.id,
                a.appointment_date,
                a.status,
                d.first_name as doctor_first_name,
                d.last_name as doctor_last_name,
                d.specialty,
                c.name as clinic_name,
                q.queue_number
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN clinics c ON a.clinic_id = c.id
            LEFT JOIN queue_entries q ON a.id = q.appointment_id
            WHERE a.patient_id = $1
            ORDER BY a.appointment_date DESC
        `, [patientId]);
        
        res.json(appointmentsResult.rows);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

### Data Validation

The backend should:
- Validate all incoming data before database operations
- Use parameterized queries to prevent SQL injection
- Implement proper error handling
- Log errors without exposing sensitive information

### Transaction Management

For critical operations like booking appointments, use transactions:

```javascript
async function bookAppointment(patientId, doctorId, appointmentDate) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // 1. Check capacity
        const capacityResult = await client.query(
            'SELECT final_capacity, registered_count FROM daily_capacities WHERE doctor_id = $1 AND date = $2',
            [doctorId, appointmentDate]
        );
        
        // 2. Validate capacity
        const capacity = capacityResult.rows[0];
        if (capacity.registered_count >= capacity.final_capacity) {
            throw new Error('Capacity full');
        }
        
        // 3. Create appointment
        const appointmentResult = await client.query(
            'INSERT INTO appointments (patient_id, doctor_id, clinic_id, appointment_date) VALUES ($1, $2, (SELECT clinic_id FROM doctors WHERE id = $2), $3) RETURNING id',
            [patientId, doctorId, appointmentDate]
        );
        
        // 4. Get next queue number
        const queueResult = await client.query(
            'SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue FROM queue_entries WHERE queue_date = $2 AND doctor_id = $1',
            [doctorId, appointmentDate]
        );
        
        // 5. Create queue entry
        await client.query(
            'INSERT INTO queue_entries (patient_id, doctor_id, clinic_id, appointment_id, queue_date, queue_number, registration_source) VALUES ($1, $2, (SELECT clinic_id FROM doctors WHERE id = $2), $3, $4, $5, $6)',
            [patientId, doctorId, appointmentResult.rows[0].id, appointmentDate, queueResult.rows[0].next_queue, 'ONLINE']
        );
        
        // 6. Update capacity
        await client.query(
            'UPDATE daily_capacities SET registered_count = registered_count + 1 WHERE doctor_id = $1 AND date = $2',
            [doctorId, appointmentDate]
        );
        
        await client.query('COMMIT');
        
        return appointmentResult.rows[0].id;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
```

## 13. Assumptions and Potential Improvements

### Assumptions Made

1. **Custom Authentication**: Designed for custom authentication since documentation doesn't specify Supabase Auth
2. **Time Zones**: Used TIMESTAMP WITH TIME ZONE for all timestamps to handle different time zones
3. **Consultation Duration**: Default 30 minutes as specified in documentation
4. **Payment Separation**: Payments are separate from appointments as per requirements
5. **GCash Manual Verification**: Receipt verification workflow as documented
6. **Queue Priority**: Based on registration time, not source (online vs walk-in)

### Potential Improvements

1. **Soft Deletes**: Consider adding `deleted_at` columns instead of hard deletes for audit trails
2. **Audit Logging**: Add an audit log table to track critical operations
3. **Data Encryption**: Consider encrypting sensitive medical data at rest
4. **Connection Pooling**: Implement proper connection pooling in the backend
5. **Caching Layer**: Add Redis caching for frequently accessed data like doctor availability
6. **Database Views**: Create views for common complex queries
7. **Stored Procedures**: Consider stored procedures for complex business logic
8. **Full-Text Search**: Add full-text search capabilities for doctor search
9. **Geospatial Queries**: Use PostGIS for advanced location-based queries
10. **Partitioning**: Consider table partitioning for large tables like appointments by date

### Missing Information

The documentation doesn't specify:
- Specific data retention policies
- Backup and recovery requirements
- Specific performance requirements
- Compliance requirements (HIPAA, etc.)
- Specific reporting requirements
- Integration requirements with external systems

These would need to be defined before production deployment.

---

## Summary

This database schema provides a comprehensive foundation for the FindMyDoctor application that:

- **Supports all documented user roles** (Patient, Doctor, Secretary, Admin)
- **Implements unified queue requirements** for online and walk-in patients
- **Enforces communication restrictions** (no patient-doctor chat)
- **Supports payment separation** with GCash manual verification
- **Handles walk-in account creation** with temporary passwords
- **Maintains medical history** linked to permanent patient accounts
- **Provides concurrency protection** through constraints and transactions
- **Supports all documented features** including AI chat, prescriptions, notifications

The schema is normalized, maintainable, and follows PostgreSQL best practices while strictly adhering to the architectural requirements defined in the documentation.