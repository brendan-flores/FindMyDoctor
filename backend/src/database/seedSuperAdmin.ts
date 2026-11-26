import bcrypt from 'bcryptjs';
import readline from 'readline';
import { query } from './connection';
import { ErrorCodes } from '../utils/response';

/**
 * Terminal-only SuperAdmin seed script.
 *
 * Creates the initial SUPERADMIN account interactively. This is the ONLY way a
 * SUPERADMIN account is provisioned: it is never exposed through public
 * registration or any API endpoint, and it refuses to run when a SUPERADMIN
 * already exists so it can never overwrite credentials or create duplicates.
 *
 * Usage: npm run seed:superadmin   (from the backend/ directory)
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHAR_PATTERN = /[!@#$%^&*(),.?":{}|<>]/;

// Control characters used by the hidden password prompt (kept as
// String.fromCharCode so the source stays plain printable ASCII).
const ENTER = String.fromCharCode(4); // Ctrl+D / EOT
const CTRL_C = String.fromCharCode(3); // Ctrl+C
const BACKSPACE = String.fromCharCode(127); // DEL

type AskFn = (question: string) => Promise<string>;

export interface SuperAdminSeedInput {
  email: string;
  password: string;
}

export interface SuperAdminSeedResult {
  id: string;
  email: string;
  role: string;
}

function validateSuperAdminInput(email: string, password: string): string {
  const normalizedEmail = (email || '').trim().toLowerCase();

  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'A valid email address is required' };
  }

  if (!password || password.length < 8) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one number' };
  }
  if (!SPECIAL_CHAR_PATTERN.test(password)) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Password must contain at least one special character' };
  }

  return normalizedEmail;
}

/**
 * Core seeding logic, separated from the interactive prompts so it can be
 * exercised by tests. Creates exactly one SUPERADMIN user and nothing else.
 */
export async function createSuperAdminAccount(
  input: SuperAdminSeedInput
): Promise<SuperAdminSeedResult> {
  const email = validateSuperAdminInput(input.email, input.password);
  const { password } = input;

  // A SUPERADMIN may only ever be initialized once. Any existing SUPERADMIN
  // account - active or not - means initialization already happened, so stop
  // rather than overwrite credentials or create a second privileged account.
  const existingSuperAdmin = await query(
    `SELECT id, email FROM users WHERE role = 'SUPERADMIN' LIMIT 1`
  );

  if (existingSuperAdmin.rows.length > 0) {
    throw {
      code: ErrorCodes.CONFLICT,
      message:
        'A Super Admin account already exists. Super Admin initialization is only allowed once; ' +
        'the existing account was left unchanged.',
    };
  }

  const existingEmail = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existingEmail.rows.length > 0) {
    throw { code: ErrorCodes.EMAIL_ALREADY_EXISTS, message: 'Email already registered' };
  }

  // Same hashing mechanism as the regular registration/login flow.
  const passwordHash = await bcrypt.hash(password, 10);

  // Generate username from email (part before @), matching all other roles.
  const username = email.split('@')[0];

  const userResult = await query(
    `INSERT INTO users (email, password_hash, role, is_active, must_change_password, username)
     VALUES ($1, $2, 'SUPERADMIN', true, false, $3)
     RETURNING id, email, role`,
    [email, passwordHash, username]
  );

  const user = userResult.rows[0];

  return { id: user.id, email: user.email, role: user.role };
}

/**
 * Reads a password without echoing it to the terminal. Only used on a TTY;
 * readline must be closed first so it cannot echo the keystrokes.
 */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);

    const stdin = process.stdin;
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();

    let password = '';

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r' || char === ENTER) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        if (char === CTRL_C) {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (char === BACKSPACE || char === '\b') {
          password = password.slice(0, -1);
          continue;
        }
        if (char >= ' ') {
          password += char;
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function runInteractive() {
  const isTTY = process.stdin.isTTY === true;

  // One shared readline interface fed by 'line' events: rl.question() drops
  // piped input lines that arrive before the next question is registered, so
  // every line is buffered explicitly and handed to waiters in order.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: isTTY,
  });

  const bufferedLines: string[] = [];
  const waiters: Array<(line: string) => void> = [];
  rl.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) {
      waiter(line);
    } else {
      bufferedLines.push(line);
    }
  });

  // If input ends while a prompt is still pending (e.g. truncated pipe),
  // resolve with an empty string so validation fails with a clear error
  // instead of the process hanging.
  rl.on('close', () => {
    while (waiters.length > 0) {
      waiters.shift()!('');
    }
  });

  const ask: AskFn = (question) => {
    process.stdout.write(question);
    return new Promise((resolve) => {
      const buffered = bufferedLines.shift();
      if (buffered !== undefined) {
        resolve(buffered);
      } else {
        waiters.push(resolve);
      }
    });
  };

  let rlOpen = true;
  const closeRl = () => {
    if (rlOpen) {
      rlOpen = false;
      rl.close();
    }
  };

  let email: string;
  let password: string;
  let confirmPassword: string;

  try {
    console.log('');
    console.log('Super Admin account initialization');
    console.log('------------------------------------');
    console.log('This creates the single SUPERADMIN account. It cannot be undone');
    console.log('through this script and cannot be run twice.');
    console.log('');

    email = await ask('Super Admin email: ');

    if (isTTY) {
      // Close readline before the raw-mode hidden prompts so it cannot echo
      // the password keystrokes. There are no further readline prompts after
      // this point.
      closeRl();
      password = await promptHidden('Super Admin password (hidden): ');
      confirmPassword = await promptHidden('Confirm password (hidden): ');
    } else {
      // Piped input: no way to hide echo, but the stream is the operator's own.
      password = await ask('Super Admin password: ');
      confirmPassword = await ask('Confirm password: ');
      closeRl();
    }
  } finally {
    closeRl();
  }

  if (password !== confirmPassword) {
    throw { code: ErrorCodes.VALIDATION_ERROR, message: 'Passwords do not match' };
  }

  const account = await createSuperAdminAccount({ email, password });

  console.log('');
  console.log('Super Admin account created successfully.');
  console.log(`   Email: ${account.email}`);
  console.log(`   Role:  ${account.role}`);
  console.log(`   ID:    ${account.id}`);
  console.log('');
  console.log('Sign in through the Admin portal login (/admin/login) with these');
  console.log('credentials. Super Admins authenticate directly without OTP.');
}

// Run only when executed directly (npm run seed:superadmin), never on import.
// argv[1]-based check works under tsx/ESM and under ts-jest, unlike
// require.main which is undefined in ES module scope.
const invokedAsScript =
  typeof process.argv[1] === 'string' &&
  /seedSuperAdmin\.ts$/.test(process.argv[1].replace(/\\/g, '/'));

if (invokedAsScript) {
  runInteractive()
    .then(() => {
      process.exit(0);
    })
    .catch((err: any) => {
      console.error('');
      console.error(`Super Admin seed failed: ${err?.message || err}`);
      process.exit(1);
    })
    .finally(async () => {
      // Close the pool so the process can exit cleanly.
      const { pool } = await import('./connection');
      await pool.end();
    });
}
