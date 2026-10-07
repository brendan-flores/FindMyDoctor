-- FindMyDoctor Doctor Profile Fields Migration
-- Adds additional doctor profile fields for the new doctor registration/profile flow
-- This migration is idempotent and safe to re-run on existing databases

-- ============================================
-- 1. ADD CONTACT NUMBER FIELD
-- ============================================
-- Doctor's personal contact number (separate from practice_phone)
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);

-- ============================================
-- 2. ADD PROFESSIONAL PHOTO FIELD
-- ============================================
-- URL/path to the doctor's professional photo
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS professional_photo_url TEXT;

-- ============================================
-- 3. ADD YEARS OF EXPERIENCE FIELD
-- ============================================
-- Number of years the doctor has been practicing
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS years_of_experience INTEGER;

-- ============================================
-- 4. ADD AREAS OF EXPERTISE FIELD
-- ============================================
-- Comma-separated text of the doctor's areas of expertise/specializations
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS areas_of_expertise TEXT;

-- ============================================
-- 5. ADD CONSULTATION TYPE FIELD
-- ============================================
-- Type of consultation offered
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_type VARCHAR(50);

-- ============================================
-- 6. ADD LANGUAGES SPOKEN FIELD
-- ============================================
-- Comma-separated text of languages the doctor speaks
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS languages_spoken TEXT;

-- ============================================
-- 7. ADD PROFILE COMPLETION STATUS
-- ============================================
-- Tracks the doctor's profile completion state
-- Values: 'INCOMPLETE', 'COMPLETE', 'SUBMITTED'
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_completion_status VARCHAR(20);

-- Add check constraint for profile completion status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_doctors_profile_completion_status'
  ) THEN
    ALTER TABLE doctors ADD CONSTRAINT check_doctors_profile_completion_status
      CHECK (profile_completion_status IN ('INCOMPLETE', 'COMPLETE', 'SUBMITTED'));
  END IF;
END $$;

-- ============================================
-- 8. ADD PROFILE SUBMISSION DATE
-- ============================================
-- Timestamp when the doctor submitted their profile for review
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS profile_submitted_at TIMESTAMP WITH TIME ZONE;

-- ============================================
-- 9. SET DEFAULT VALUES FOR EXISTING RECORDS
-- ============================================
-- For backward compatibility, preserve existing approved/active doctors as COMPLETE
-- if they have the established professional information (first_name, last_name, specialty,
-- practice_name, practice_address, practice_latitude, practice_longitude, consultation_fee)
-- New fields (contact_number, professional_photo_url, years_of_experience, areas_of_expertise,
-- consultation_type, languages_spoken) are not required for existing doctors to remain COMPLETE
DO $$
BEGIN
  -- Check if approval_status column exists (added in migration 007)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'doctors' AND column_name = 'approval_status'
  ) THEN
    -- Use approval_status for newer systems
    UPDATE doctors
    SET profile_completion_status = 'COMPLETE'
    WHERE profile_completion_status IS NULL
      AND approval_status = 'ACTIVE'
      AND first_name IS NOT NULL
      AND last_name IS NOT NULL
      AND specialty IS NOT NULL
      AND practice_name IS NOT NULL
      AND practice_address IS NOT NULL
      AND practice_latitude IS NOT NULL
      AND practice_longitude IS NOT NULL
      AND consultation_fee IS NOT NULL;
  ELSE
    -- Fall back to is_approved for older systems
    UPDATE doctors
    SET profile_completion_status = 'COMPLETE'
    WHERE profile_completion_status IS NULL
      AND is_approved = true
      AND first_name IS NOT NULL
      AND last_name IS NOT NULL
      AND specialty IS NOT NULL
      AND practice_name IS NOT NULL
      AND practice_address IS NOT NULL
      AND practice_latitude IS NOT NULL
      AND practice_longitude IS NOT NULL
      AND consultation_fee IS NOT NULL;
  END IF;
END $$;

-- Set remaining doctors to INCOMPLETE
UPDATE doctors
SET profile_completion_status = 'INCOMPLETE'
WHERE profile_completion_status IS NULL;

-- ============================================
-- 10. ADD INDEXES FOR PERFORMANCE
-- ============================================
-- Index for profile completion status queries
CREATE INDEX IF NOT EXISTS idx_doctors_profile_completion_status ON doctors(profile_completion_status);

-- Migration complete
