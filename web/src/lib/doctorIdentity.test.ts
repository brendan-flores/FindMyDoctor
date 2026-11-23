import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCTOR_NAME_FALLBACK,
  doctorEmailLocalPart,
  doctorInitials,
  resolveDoctorDisplayName,
  resolveDoctorEmail,
  resolveDoctorIdentity,
} from './doctorIdentity.ts';

test('builds a complete First Middle Last display name', () => {
  assert.equal(
    resolveDoctorDisplayName(
      { first_name: 'Maria', middle_name: 'Santos', last_name: 'Cruz' },
      'maria.cruz@example.com'
    ),
    'Maria Santos Cruz'
  );
});

test('omits the middle name when it is absent', () => {
  assert.equal(
    resolveDoctorDisplayName({ first_name: 'Maria', last_name: 'Cruz' }, 'maria@example.com'),
    'Maria Cruz'
  );
  assert.equal(
    resolveDoctorDisplayName(
      { first_name: 'Maria', middle_name: '', last_name: 'Cruz' },
      'maria@example.com'
    ),
    'Maria Cruz'
  );
  assert.equal(
    resolveDoctorDisplayName(
      { first_name: 'Maria', middle_name: null, last_name: 'Cruz' },
      'maria@example.com'
    ),
    'Maria Cruz'
  );
});

test('trims whitespace around every name part', () => {
  assert.equal(
    resolveDoctorDisplayName(
      { first_name: '  Maria ', middle_name: '  Santos  ', last_name: ' Cruz  ' },
      'maria@example.com'
    ),
    'Maria Santos Cruz'
  );
});

test('falls back to the email local part when the first name is missing', () => {
  assert.equal(
    resolveDoctorDisplayName({ first_name: '', last_name: 'Cruz' }, 'dr.cruz@example.com'),
    'dr.cruz'
  );
  assert.equal(
    resolveDoctorDisplayName({ last_name: 'Cruz' }, 'dr.cruz@example.com'),
    'dr.cruz'
  );
});

test('falls back to the email local part when the last name is missing', () => {
  assert.equal(
    resolveDoctorDisplayName({ first_name: 'Maria', last_name: '' }, 'maria@example.com'),
    'maria'
  );
  assert.equal(
    resolveDoctorDisplayName({ first_name: 'Maria' }, 'maria@example.com'),
    'maria'
  );
});

test('treats whitespace-only name fields as incomplete', () => {
  assert.equal(
    resolveDoctorDisplayName(
      { first_name: '   ', middle_name: '  ', last_name: 'Cruz' },
      'whitespace@example.com'
    ),
    'whitespace'
  );
  assert.equal(
    resolveDoctorDisplayName(
      { first_name: 'Maria', middle_name: '   ', last_name: '   ' },
      'whitespace@example.com'
    ),
    'whitespace'
  );
  assert.equal(
    resolveDoctorDisplayName({ first_name: '  ', last_name: '  ' }, 'whitespace@example.com'),
    'whitespace'
  );
});

test('uses the generic label when neither a name nor a usable email exists', () => {
  assert.equal(resolveDoctorDisplayName(null, null), DOCTOR_NAME_FALLBACK);
  assert.equal(resolveDoctorDisplayName(undefined, ''), DOCTOR_NAME_FALLBACK);
  assert.equal(resolveDoctorDisplayName({}, '   '), DOCTOR_NAME_FALLBACK);
  assert.equal(resolveDoctorDisplayName({ first_name: 'Maria' }, 'not-an-email'), DOCTOR_NAME_FALLBACK);
});

test('email local part ignores addresses without a usable local part', () => {
  assert.equal(doctorEmailLocalPart('doctor@example.com'), 'doctor');
  assert.equal(doctorEmailLocalPart('doctor'), '');
  assert.equal(doctorEmailLocalPart('@example.com'), '');
  assert.equal(doctorEmailLocalPart(''), '');
  assert.equal(doctorEmailLocalPart(null), '');
});

test('profile email takes precedence over the session email', () => {
  assert.equal(resolveDoctorEmail('profile@example.com', 'session@example.com'), 'profile@example.com');
  assert.equal(
    resolveDoctorEmail('  profile@example.com  ', 'session@example.com'),
    'profile@example.com'
  );
});

test('falls back to the session email when the profile email is unavailable', () => {
  assert.equal(resolveDoctorEmail(undefined, 'session@example.com'), 'session@example.com');
  assert.equal(resolveDoctorEmail('', 'session@example.com'), 'session@example.com');
  assert.equal(resolveDoctorEmail('   ', 'session@example.com'), 'session@example.com');
  assert.equal(resolveDoctorEmail(null, null), '');
});

test('resolves the full identity with the Doctor role label', () => {
  assert.deepEqual(
    resolveDoctorIdentity(
      {
        first_name: 'Maria',
        middle_name: 'Santos',
        last_name: 'Cruz',
        email: 'maria.cruz@example.com',
      },
      'session@example.com'
    ),
    {
      displayName: 'Maria Santos Cruz',
      email: 'maria.cruz@example.com',
      role: 'Doctor',
      initials: 'MS',
    }
  );
});

test('resolves the identity from the session email when the profile fails', () => {
  assert.deepEqual(resolveDoctorIdentity(null, 'drhouse@example.com'), {
    displayName: 'drhouse',
    email: 'drhouse@example.com',
    role: 'Doctor',
    initials: 'D',
  });
});

test('resolves a safe identity when nothing is available', () => {
  assert.deepEqual(resolveDoctorIdentity(null, null), {
    displayName: 'Doctor',
    email: '',
    role: 'Doctor',
    initials: 'D',
  });
});

test('avatar initials come from the display name with a D fallback', () => {
  assert.equal(doctorInitials('Maria Santos Cruz'), 'MS');
  assert.equal(doctorInitials('Maria Cruz'), 'MC');
  assert.equal(doctorInitials('Doctor'), 'D');
  assert.equal(doctorInitials(''), 'D');
  assert.equal(doctorInitials('   '), 'D');
});
