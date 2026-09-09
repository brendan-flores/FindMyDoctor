-- FindMyDoctor Sample Data
-- This file contains sample data for testing and development
-- Execute this after the initial schema to populate with test data

-- ============================================
-- SAMPLE CLINICS
-- ============================================

INSERT INTO clinics (name, address, latitude, longitude, phone, email, description, operating_hours_start, operating_hours_end, is_approved) VALUES
('St. Luke''s Medical Center - BGC', 'Medical Arts Bldg, BGC, Taguig', 14.5498, 121.0489, '828-7000', 'info@stlukes.com.ph', 'Premier medical facility with comprehensive healthcare services', '08:00:00', '17:00:00', true),
('The Medical City', 'Ortigas Avenue, Pasig City', 14.5764, 121.0583, '871-7000', 'info@themedicalcity.com', 'World-class healthcare with advanced technology', '07:00:00', '19:00:00', true),
('Asian Hospital and Medical Center', 'Festival Supermall, Alabang, Muntinlupa', 14.4195, 121.0408, '771-9000', 'info@asianhospital.com', 'Specialized healthcare with international standards', '08:00:00', '17:00:00', true),
('Makati Medical Center', 'Makati Avenue, Makati City', 14.5627, 121.0176, '888-8999', 'info@makatimed.com.ph', 'Leading healthcare institution in Makati', '08:00:00', '17:00:00', true);

-- ============================================
-- SAMPLE USERS
-- ============================================

-- Insert users with different roles
INSERT INTO users (email, password_hash, role, is_active, must_change_password) VALUES
('doctor.santos@stlukes.com', '$2b$10$hashedpassword1', 'DOCTOR', true, false),
('doctor.cruz@tmc.com', '$2b$10$hashedpassword2', 'DOCTOR', true, false),
('doctor.lim@asian.com', '$2b$10$hashedpassword3', 'DOCTOR', true, false),
('secretary.lim@stlukes.com', '$2b$10$hashedpassword4', 'SECRETARY', true, false),
('secretary.reyes@tmc.com', '$2b$10$hashedpassword5', 'SECRETARY', true, false),
('patient.reyes@gmail.com', '$2b$10$hashedpassword6', 'PATIENT', true, false),
('patient.santos@yahoo.com', '$2b$10$hashedpassword7', 'PATIENT', true, false),
('patient.cruz@hotmail.com', '$2b$10$hashedpassword8', 'PATIENT', true, false),
('admin@findmydoctor.com', '$2b$10$hashedpassword9', 'ADMIN', true, false);

-- ============================================
-- SAMPLE DOCTORS
-- ============================================

INSERT INTO doctors (user_id, clinic_id, first_name, last_name, specialty, credentials, biography, consultation_fee, is_approved) VALUES
((SELECT id FROM users WHERE email = 'doctor.santos@stlukes.com'), 
 (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'),
 'Maria Angela', 'Santos', 'Adult Cardiology', 'MD, FACC', 'Board-certified cardiologist with 15 years of experience in cardiovascular medicine', 1000.00, true),

((SELECT id FROM users WHERE email = 'doctor.cruz@tmc.com'),
 (SELECT id FROM clinics WHERE name = 'The Medical City'),
 'Rafael', 'Cruz', 'Pediatrics', 'MD, FAAP', 'Specialized in pediatric care and child development', 700.00, true),

((SELECT id FROM users WHERE email = 'doctor.lim@asian.com'),
 (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'),
 'Kristine', 'Lim', 'Dermatology', 'DPDS', 'Expert in skin health and aesthetic dermatology', 800.00, true);

-- ============================================
-- SAMPLE SECRETARIES
-- ============================================

INSERT INTO secretaries (user_id, clinic_id, first_name, last_name, is_approved) VALUES
((SELECT id FROM users WHERE email = 'secretary.lim@stlukes.com'),
 (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'),
 'Grace', 'Lim', true),

((SELECT id FROM users WHERE email = 'secretary.reyes@tmc.com'),
 (SELECT id FROM clinics WHERE name = 'The Medical City'),
 'Anna', 'Reyes', true);

-- ============================================
-- SAMPLE PATIENTS
-- ============================================

INSERT INTO patients (user_id, first_name, last_name, date_of_birth, phone, address, emergency_contact_name, emergency_contact_phone, medical_history, allergies, current_medications) VALUES
((SELECT id FROM users WHERE email = 'patient.reyes@gmail.com'),
 'Juan Michael', 'Reyes', '1990-05-15', '09171234567', '123 Main Street, BGC, Taguig', 'Maria Reyes', '09187654321', 'Hypertension (controlled)', 'Penicillin', 'Amlodipine 5mg daily'),

((SELECT id FROM users WHERE email = 'patient.santos@yahoo.com'),
 'Maria', 'Santos', '1985-08-22', '09182345678', '456 Oak Avenue, Pasig City', 'Jose Santos', '09198765432', 'None', 'None', 'None'),

((SELECT id FROM users WHERE email = 'patient.cruz@hotmail.com'),
 'Pedro', 'Cruz', '1992-12-10', '09193456789', '789 Pine Road, Makati City', 'Elena Cruz', '09209876543', 'Type 2 Diabetes', 'Sulfa drugs', 'Metformin 500mg twice daily');

-- ============================================
-- SAMPLE DOCTOR SCHEDULES
-- ============================================

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, consultation_duration_minutes, is_active) VALUES
-- Dr. Santos schedule
((SELECT id FROM doctors WHERE last_name = 'Santos'), 1, '09:00:00', '17:00:00', 30, true), -- Monday
((SELECT id FROM doctors WHERE last_name = 'Santos'), 2, '09:00:00', '17:00:00', 30, true), -- Tuesday
((SELECT id FROM doctors WHERE last_name = 'Santos'), 3, '09:00:00', '17:00:00', 30, true), -- Wednesday
((SELECT id FROM doctors WHERE last_name = 'Santos'), 4, '09:00:00', '17:00:00', 30, true), -- Thursday
((SELECT id FROM doctors WHERE last_name = 'Santos'), 5, '09:00:00', '15:00:00', 30, true), -- Friday

-- Dr. Cruz schedule
((SELECT id FROM doctors WHERE last_name = 'Cruz'), 1, '08:00:00', '17:00:00', 30, true), -- Monday
((SELECT id FROM doctors WHERE last_name = 'Cruz'), 2, '08:00:00', '17:00:00', 30, true), -- Tuesday
((SELECT id FROM doctors WHERE last_name = 'Cruz'), 3, '08:00:00', '17:00:00', 30, true), -- Wednesday
((SELECT id FROM doctors WHERE last_name = 'Cruz'), 4, '08:00:00', '17:00:00', 30, true), -- Thursday
((SELECT id FROM doctors WHERE last_name = 'Cruz'), 5, '08:00:00', '17:00:00', 30, true), -- Friday

-- Dr. Lim schedule
((SELECT id FROM doctors WHERE last_name = 'Lim'), 1, '10:00:00', '18:00:00', 30, true), -- Monday
((SELECT id FROM doctors WHERE last_name = 'Lim'), 2, '10:00:00', '18:00:00', 30, true), -- Tuesday
((SELECT id FROM doctors WHERE last_name = 'Lim'), 3, '10:00:00', '18:00:00', 30, true), -- Wednesday
((SELECT id FROM doctors WHERE last_name = 'Lim'), 4, '10:00:00', '18:00:00', 30, true), -- Thursday
((SELECT id FROM doctors WHERE last_name = 'Lim'), 5, '10:00:00', '15:00:00', 30, true); -- Friday

-- ============================================
-- SAMPLE DAILY CAPACITIES
-- ============================================

INSERT INTO daily_capacities (doctor_id, clinic_id, date, consultation_duration_minutes, calculated_capacity, configured_capacity, final_capacity, registered_count) VALUES
-- Dr. Santos capacities for next week
((SELECT id FROM doctors WHERE last_name = 'Santos'), (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'), '2025-10-21', 30, 16, 16, 16, 4),
((SELECT id FROM doctors WHERE last_name = 'Santos'), (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'), '2025-10-22', 30, 16, 16, 16, 0),
((SELECT id FROM doctors WHERE last_name = 'Santos'), (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'), '2025-10-23', 30, 16, 16, 16, 0),
((SELECT id FROM doctors WHERE last_name = 'Santos'), (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'), '2025-10-24', 30, 16, 16, 16, 0),
((SELECT id FROM doctors WHERE last_name = 'Santos'), (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'), '2025-10-25', 30, 12, 12, 12, 0),

-- Dr. Cruz capacities for next week
((SELECT id FROM doctors WHERE last_name = 'Cruz'), (SELECT id FROM clinics WHERE name = 'The Medical City'), '2025-10-21', 30, 18, 18, 18, 6),
((SELECT id FROM doctors WHERE last_name = 'Cruz'), (SELECT id FROM clinics WHERE name = 'The Medical City'), '2025-10-22', 30, 18, 18, 18, 0),
((SELECT id FROM doctors WHERE last_name = 'Cruz'), (SELECT id FROM clinics WHERE name = 'The Medical City'), '2025-10-23', 30, 18, 18, 18, 0),
((SELECT id FROM doctors WHERE last_name = 'Cruz'), (SELECT id FROM clinics WHERE name = 'The Medical City'), '2025-10-24', 30, 18, 18, 18, 0),
((SELECT id FROM doctors WHERE last_name = 'Cruz'), (SELECT id FROM clinics WHERE name = 'The Medical City'), '2025-10-25', 30, 18, 18, 18, 0),

-- Dr. Lim capacities for next week
((SELECT id FROM doctors WHERE last_name = 'Lim'), (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'), '2025-10-21', 30, 16, 16, 16, 2),
((SELECT id FROM doctors WHERE last_name = 'Lim'), (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'), '2025-10-22', 30, 16, 16, 16, 0),
((SELECT id FROM doctors WHERE last_name = 'Lim'), (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'), '2025-10-23', 30, 16, 16, 16, 0),
((SELECT id FROM doctors WHERE last_name = 'Lim'), (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'), '2025-10-24', 30, 16, 16, 16, 0),
((SELECT id FROM doctors WHERE last_name = 'Lim'), (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'), '2025-10-25', 30, 12, 12, 12, 0);

-- ============================================
-- SAMPLE APPOINTMENTS
-- ============================================

INSERT INTO appointments (patient_id, doctor_id, clinic_id, appointment_date, end_time, status, reason_for_visit, notes) VALUES
-- Juan Reyes appointments
((SELECT id FROM patients WHERE last_name = 'Reyes'), 
 (SELECT id FROM doctors WHERE last_name = 'Santos'),
 (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'),
 '2025-10-21 09:45:00+08', '2025-10-21 10:15:00+08', 'CONFIRMED', 'Follow-up for hypertension management', 'Regular checkup'),

((SELECT id FROM patients WHERE last_name = 'Reyes'),
 (SELECT id FROM doctors WHERE last_name = 'Cruz'),
 (SELECT id FROM clinics WHERE name = 'The Medical City'),
 '2025-10-24 14:00:00+08', '2025-10-24 14:30:00+08', 'SCHEDULED', 'Annual physical examination', 'Complete checkup'),

-- Maria Santos appointments
((SELECT id FROM patients WHERE last_name = 'Santos'),
 (SELECT id FROM doctors WHERE last_name = 'Lim'),
 (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'),
 '2025-10-05 10:30:00+08', '2025-10-05 11:00:00+08', 'COMPLETED', 'Skin consultation for rash', 'Contact dermatitis treatment'),

-- Pedro Cruz appointments
((SELECT id FROM patients WHERE last_name = 'Cruz'),
 (SELECT id FROM doctors WHERE last_name = 'Santos'),
 (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'),
 '2025-09-18 11:00:00+08', '2025-09-18 11:30:00+08', 'CANCELLED', 'Cardiac consultation', 'Cancelled by patient - schedule conflict');

-- ============================================
-- SAMPLE QUEUE ENTRIES
-- ============================================

INSERT INTO queue_entries (patient_id, doctor_id, clinic_id, appointment_id, queue_date, queue_number, registration_source, status, called_at, started_at, completed_at) VALUES
-- For Dr. Santos on Oct 21
((SELECT id FROM patients WHERE last_name = 'Reyes'),
 (SELECT id FROM doctors WHERE last_name = 'Santos'),
 (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'),
 (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes') AND doctor_id = (SELECT id FROM doctors WHERE last_name = 'Santos') AND appointment_date = '2025-10-21 09:45:00+08'),
 '2025-10-21', 4, 'ONLINE', 'WAITING', NULL, NULL, NULL),

-- For Dr. Cruz on Oct 21
((SELECT id FROM patients WHERE last_name = 'Santos'),
 (SELECT id FROM doctors WHERE last_name = 'Cruz'),
 (SELECT id FROM clinics WHERE name = 'The Medical City'),
 NULL,
 '2025-10-21', 1, 'WALK_IN', 'WAITING', NULL, NULL, NULL),

((SELECT id FROM patients WHERE last_name = 'Cruz'),
 (SELECT id FROM doctors WHERE last_name = 'Cruz'),
 (SELECT id FROM clinics WHERE name = 'The Medical City'),
 NULL,
 '2025-10-21', 2, 'WALK_IN', 'CALLED', '2025-10-21 08:30:00+08', NULL, NULL),

-- For Dr. Lim on Oct 5 (completed)
((SELECT id FROM patients WHERE last_name = 'Santos'),
 (SELECT id FROM doctors WHERE last_name = 'Lim'),
 (SELECT id FROM clinics WHERE name = 'Asian Hospital and Medical Center'),
 (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Santos') AND doctor_id = (SELECT id FROM doctors WHERE last_name = 'Lim') AND appointment_date = '2025-10-05 10:30:00+08'),
 '2025-10-05', 1, 'ONLINE', 'COMPLETED', '2025-10-05 10:25:00+08', '2025-10-05 10:30:00+08', '2025-10-05 11:00:00+08');

-- ============================================
-- SAMPLE VISITS
-- ============================================

INSERT INTO visits (appointment_id, patient_id, doctor_id, visit_date, reason_for_visit, diagnosis, notes, blood_pressure, weight, height, temperature) VALUES
((SELECT id FROM appointments WHERE status = 'COMPLETED'),
 (SELECT id FROM patients WHERE last_name = 'Santos'),
 (SELECT id FROM doctors WHERE last_name = 'Lim'),
 '2025-10-05 10:30:00+08',
 'Skin consultation for rash',
 'Contact Dermatitis (Resolved)',
 'Patient presented with allergic reaction. Prescribed topical corticosteroid and antihistamine. Follow up in 2 weeks.',
 '120/80',
 65.5,
 162.0,
 36.8);

-- ============================================
-- SAMPLE PRESCRIPTIONS
-- ============================================

INSERT INTO prescriptions (visit_id, patient_id, doctor_id, prescription_date, pdf_url, notes) VALUES
((SELECT id FROM visits WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Santos')),
 (SELECT id FROM patients WHERE last_name = 'Santos'),
 (SELECT id FROM doctors WHERE last_name = 'Lim'),
 '2025-10-05',
 'https://storage.example.com/prescriptions/prescription_001.pdf',
 'Take medications as prescribed. Avoid allergens that caused the reaction.');

INSERT INTO prescription_items (prescription_id, medication_name, dosage, frequency, duration, instructions) VALUES
((SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Santos')),
 'Hydrocortisone Cream 1%',
 'Apply thin layer',
 'Twice daily',
 '7 days',
 'Apply to affected area only, avoid face unless directed'),

((SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Santos')),
 'Cetirizine 10mg',
 '1 tablet',
 'Once daily',
 '14 days',
 'Take at bedtime, may cause drowsiness');

-- ============================================
-- SAMPLE PAYMENTS
-- ============================================

INSERT INTO payments (patient_id, appointment_id, payment_method, consultation_amount, total_additional_charges, total_amount, status, receipt_url, verified_by, verified_at) VALUES
-- Payment for completed visit
((SELECT id FROM patients WHERE last_name = 'Santos'),
 (SELECT id FROM appointments WHERE status = 'COMPLETED'),
 'GCASH',
 800.00,
 0.00,
 800.00,
 'PAID',
 'https://storage.example.com/receipts/receipt_001.jpg',
 (SELECT id FROM secretaries WHERE last_name = 'Lim'),
 '2025-10-05 11:30:00+08'),

-- Pending payment for upcoming appointment
((SELECT id FROM patients WHERE last_name = 'Reyes'),
 (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes') AND doctor_id = (SELECT id FROM doctors WHERE last_name = 'Santos') AND appointment_date = '2025-10-21 09:45:00+08'),
 'GCASH',
 1000.00,
 0.00,
 1000.00,
 'PENDING_VERIFICATION',
 'https://storage.example.com/receipts/receipt_002.jpg',
 NULL,
 NULL);

-- ============================================
-- SAMPLE CONVERSATIONS
-- ============================================

INSERT INTO conversations (patient_id, secretary_id, clinic_id, status) VALUES
((SELECT id FROM patients WHERE last_name = 'Reyes'),
 (SELECT id FROM secretaries WHERE last_name = 'Lim'),
 (SELECT id FROM clinics WHERE name = 'St. Luke''s Medical Center - BGC'),
 'OPEN'),

((SELECT id FROM patients WHERE last_name = 'Santos'),
 (SELECT id FROM secretaries WHERE last_name = 'Reyes'),
 (SELECT id FROM clinics WHERE name = 'The Medical City'),
 'OPEN');

-- ============================================
-- SAMPLE MESSAGES
-- ============================================

INSERT INTO messages (conversation_id, sender_user_id, message, sent_at, read_at) VALUES
-- Messages in Juan Reyes - Grace Lim conversation
((SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes')),
 (SELECT id FROM users WHERE email = 'patient.reyes@gmail.com'),
 'Hello Secretary Grace, I have a question about my appointment on October 21st.',
 '2025-10-18 10:30:00+08',
 '2025-10-18 10:35:00+08'),

((SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes')),
 (SELECT id FROM users WHERE email = 'secretary.lim@stlukes.com'),
 'Hello Juan! I''d be happy to help. What would you like to know about your appointment?',
 '2025-10-18 10:32:00+08',
 NULL),

((SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes')),
 (SELECT id FROM users WHERE email = 'patient.reyes@gmail.com'),
 'What time should I arrive? And do I need to bring anything?',
 '2025-10-18 10:36:00+08',
 NULL),

((SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes')),
 (SELECT id FROM users WHERE email = 'secretary.lim@stlukes.com'),
 'Please arrive 15 minutes before your 9:45 AM appointment. Bring your ID and any previous medical records. Thank you!',
 '2025-10-18 10:38:00+08',
 NULL);

-- ============================================
-- SAMPLE AI CONVERSATIONS
-- ============================================

INSERT INTO ai_conversations (patient_id) VALUES
((SELECT id FROM patients WHERE last_name = 'Reyes')),
((SELECT id FROM patients WHERE last_name = 'Santos'));

-- ============================================
-- SAMPLE AI MESSAGES
-- ============================================

INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES
-- AI conversation for Juan Reyes
((SELECT id FROM ai_conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes')),
 'SYSTEM',
 'You are a helpful AI medical assistant for FindMyDoctor. Provide general medical information but always encourage users to consult with healthcare professionals for specific medical concerns.',
 '2025-10-18 09:00:00+08'),

((SELECT id FROM ai_conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes')),
 'USER',
 'I have been experiencing frequent headaches lately. What could be the cause?',
 '2025-10-18 09:05:00+08'),

((SELECT id FROM ai_conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes')),
 'ASSISTANT',
 'Frequent headaches can have many causes including stress, dehydration, lack of sleep, eye strain, or more serious conditions. Common types include tension headaches, migraines, and cluster headaches. However, I cannot provide a diagnosis. It would be best to consult with a healthcare professional, especially if the headaches are severe, persistent, or accompanied by other symptoms. Would you like me to help you find a doctor?',
 '2025-10-18 09:06:00+08');

-- ============================================
-- SAMPLE NOTIFICATIONS
-- ============================================

INSERT INTO notifications (user_id, type, title, message, is_read, related_entity_type, related_entity_id) VALUES
-- Notifications for Juan Reyes
((SELECT id FROM users WHERE email = 'patient.reyes@gmail.com'),
 'APPOINTMENT_CONFIRMED',
 'Appointment Confirmed',
 'Your appointment with Dr. Maria Angela Santos on October 21, 2025 at 9:45 AM has been confirmed. Queue #4.',
 false,
 'appointment',
 (SELECT id FROM appointments WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes') AND appointment_date = '2025-10-21 09:45:00+08')),

((SELECT id FROM users WHERE email = 'patient.reyes@gmail.com'),
 'NEW_MESSAGE',
 'New Message from Secretary',
 'You have a new message from Secretary Grace Lim regarding your appointment.',
 false,
 'conversation',
 (SELECT id FROM conversations WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Reyes'))),

-- Notifications for Maria Santos
((SELECT id FROM users WHERE email = 'patient.santos@yahoo.com'),
 'PRESCRIPTION_AVAILABLE',
 'Prescription Available',
 'Your prescription from your visit on October 5, 2025 is now available.',
 false,
 'prescription',
 (SELECT id FROM prescriptions WHERE patient_id = (SELECT id FROM patients WHERE last_name = 'Santos')));

-- ============================================
-- UPDATE DAILY CAPACITIES REGISTERED COUNT
-- ============================================

-- Update registered counts based on appointments and queue entries
UPDATE daily_capacities 
SET registered_count = (
    SELECT COUNT(*) 
    FROM queue_entries 
    WHERE queue_entries.doctor_id = daily_capacities.doctor_id 
    AND queue_entries.queue_date = daily_capacities.date
)
WHERE date IN ('2025-10-21', '2025-10-22', '2025-10-23', '2025-10-24', '2025-10-25');

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

-- Sample data insertion complete
-- You can verify the data by running queries like:
-- SELECT * FROM clinics;
-- SELECT * FROM doctors;
-- SELECT * FROM appointments;
-- SELECT * FROM queue_entries;