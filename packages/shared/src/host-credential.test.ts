import assert from 'node:assert/strict';
import {
  hashHostSecret,
  hostSecretMatches,
  normalizeHostSecret,
} from './host-credential';

const valid = 'A'.repeat(42) + '_';
const other = 'B'.repeat(42) + '-';
const digest = hashHostSecret(valid);

assert.equal(normalizeHostSecret(valid), valid);
assert.equal(normalizeHostSecret('short'), '');
assert.equal(normalizeHostSecret('A'.repeat(42) + '+'), '');
assert.match(digest, /^[a-f0-9]{64}$/);
assert.equal(hostSecretMatches(valid, digest), true);
assert.equal(hostSecretMatches(other, digest), false);
assert.equal(hostSecretMatches('', digest), false);
assert.equal(hostSecretMatches(valid, 'not-a-digest'), false);
assert.throws(() => hashHostSecret('weak'), /Invalid host credential format/);

console.log('Host credential policy tests passed.');
