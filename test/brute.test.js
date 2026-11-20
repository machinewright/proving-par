import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBig, formatDuration } from '../widgets/brute.js';

test('formatBig uses thousands separators below 1e12', () => {
  assert.equal(formatBig(7), '7');
  assert.equal(formatBig(999), '999');
  assert.equal(formatBig(1024), '1,024');
  assert.equal(formatBig(123456789), '123,456,789');
  assert.equal(formatBig(999999999999), '999,999,999,999');
});

test('formatBig switches to scientific notation at 1e12, 2 significant figures', () => {
  assert.equal(formatBig(1e12), '1 × 10^12');
  assert.equal(formatBig(2 ** 40), '1.1 × 10^12');
  assert.equal(formatBig(2 ** 50), '1.1 × 10^15');
  assert.equal(formatBig(2 ** 60), '1.2 × 10^18');
  assert.equal(formatBig(2 ** 100), '1.3 × 10^30');
  assert.equal(formatBig(9.96e17), '1 × 10^18'); // mantissa rounds up to 10: carry the exponent
});

test('formatDuration covers the small units', () => {
  assert.equal(formatDuration(0), 'under a second');
  assert.equal(formatDuration(0.5), 'under a second');
  assert.equal(formatDuration(1), '1 second');
  assert.equal(formatDuration(45), '45 seconds');
  assert.equal(formatDuration(60), '1 minute');
  assert.equal(formatDuration(90), '2 minutes');
  assert.equal(formatDuration(3600), '1 hour');
  assert.equal(formatDuration(5 * 3600), '5 hours');
  assert.equal(formatDuration(86400), '1 day');
  assert.equal(formatDuration(16 * 86400), '16 days');
});

test('formatDuration covers years and billions of years', () => {
  const y = 365.25 * 86400;
  assert.equal(formatDuration(y), '1 year');
  assert.equal(formatDuration(44 * y), '44 years');
  assert.equal(formatDuration(45600 * y), '46,000 years');
  assert.equal(formatDuration(1e9 * y), '1,000,000,000 years');
  assert.equal(formatDuration(2e9 * y), 'about 2 billion years');
  assert.equal(formatDuration(1.05e9 * y), 'about 1.1 billion years');
  assert.equal(formatDuration(47e9 * y), 'about 47 billion years (the universe is 13.8 billion years old)');
});
