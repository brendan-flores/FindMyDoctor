-- FindMyDoctor Clear All Data
-- This file removes all data from all tables while preserving the table structure
-- Execute this when you want to start fresh with an empty database
-- WARNING: This will delete ALL data - use with caution!

-- ============================================
-- DISABLE FOREIGN KEY CONSTRAINTS TEMPORARILY
-- ============================================

SET CONSTRAINTS ALL DEFERRED;

-- ============================================
-- CLEAR DATA FROM TABLES (Child tables first)
-- ============================================

-- Clear AI messages (depends on ai_conversations)
TRUNCATE TABLE ai_messages CASCADE;

-- Clear AI conversations
TRUNCATE TABLE ai_conversations CASCADE;

-- Clear notification (depends on users)
TRUNCATE TABLE notifications CASCADE;

-- Clear waitlist entries
TRUNCATE TABLE waitlists CASCADE;

-- Clear payment charges (depends on payments)
TRUNCATE TABLE payment_charges CASCADE;

-- Clear payments (depends on appointments, patients, secretaries)
TRUNCATE TABLE payments CASCADE;

-- Clear prescription items (depends on prescriptions)
TRUNCATE TABLE prescription_items CASCADE;

-- Clear prescriptions (depends on visits)
TRUNCATE TABLE prescriptions CASCADE;

-- Clear visits (depends on appointments)
TRUNCATE TABLE visits CASCADE;

-- Clear messages (depends on conversations)
TRUNCATE TABLE messages CASCADE;

-- Clear conversations (depends on patients, secretaries, doctors)
TRUNCATE TABLE conversations CASCADE;

-- Clear queue entries (depends on patients, doctors, appointments)
TRUNCATE TABLE queue_entries CASCADE;

-- Clear appointments (depends on patients, doctors)
TRUNCATE TABLE appointments CASCADE;

-- Clear daily capacities (depends on doctors)
TRUNCATE TABLE daily_capacities CASCADE;

-- Clear doctor unavailability (depends on doctors)
TRUNCATE TABLE doctor_unavailability CASCADE;

-- Clear doctor schedules (depends on doctors)
TRUNCATE TABLE doctor_schedules CASCADE;

-- Clear secretaries (depends on doctors, users)
TRUNCATE TABLE secretaries CASCADE;

-- Clear patients (depends on users)
TRUNCATE TABLE patients CASCADE;

-- Clear doctors (depends on users)
TRUNCATE TABLE doctors CASCADE;

-- Clear users (base table)
TRUNCATE TABLE users CASCADE;

-- ============================================
-- RESET SEQUENCE IDs (Optional)
-- ============================================

-- Reset UUID sequences if you're using them
-- Note: PostgreSQL UUID functions don't use sequences like SERIAL columns
-- If you want to reset auto-increment IDs, you would do:
-- ALTER SEQUENCE table_name_id_seq RESTART WITH 1;

-- ============================================
-- RE-ENABLE CONSTRAINTS
-- ============================================

SET CONSTRAINTS ALL IMMEDIATE;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify all tables are empty
DO $$
DECLARE
    table_record RECORD;
    row_count INTEGER;
BEGIN
    RAISE NOTICE '=== Data Clear Verification ===';
    
    FOR table_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', table_record.table_name) INTO row_count;
        
        IF row_count = 0 THEN
            RAISE NOTICE '✅ % is empty', table_record.table_name;
        ELSE
            RAISE NOTICE '⚠️  % still has % rows', table_record.table_name, row_count;
        END IF;
    END LOOP;
    
    RAISE NOTICE '=== Data Clear Complete ===';
END $$;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

-- All data has been cleared from the database
-- Table structure remains intact
-- You can now insert fresh data or run sample data scripts