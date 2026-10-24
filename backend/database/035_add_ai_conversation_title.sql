-- Add title column to ai_conversations table for rename functionality
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS title VARCHAR(255);
