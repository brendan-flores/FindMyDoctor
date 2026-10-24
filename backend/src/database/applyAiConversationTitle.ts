import { pool } from '../database/connection';

async function applyAiConversationTitle() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE ai_conversations 
      ADD COLUMN IF NOT EXISTS title VARCHAR(255)
    `);
    
    await client.query('COMMIT');
    console.log('✅ Added title column to ai_conversations table');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to add title column:', error);
    throw error;
  } finally {
    client.release();
  }
}

applyAiConversationTitle()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
