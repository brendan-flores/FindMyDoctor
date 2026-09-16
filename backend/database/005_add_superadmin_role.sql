-- Add SUPERADMIN role to users table
-- This migration updates the role constraint to include SUPERADMIN

-- First, update the constraint to include SUPERADMIN
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('PATIENT', 'DOCTOR', 'SECRETARY', 'ADMIN', 'SUPERADMIN'));