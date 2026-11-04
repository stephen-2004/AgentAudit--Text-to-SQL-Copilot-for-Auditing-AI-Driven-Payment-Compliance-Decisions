import { test } from 'node:test';
import assert from 'node:assert';
import { add } from '../src/math.js';

test('add(2, 3) should equal 5', () => {
  assert.strictEqual(add(2, 3), 5);
});

test('add(0, 0) should equal 0', () => {
  assert.strictEqual(add(0, 0), 0);
});
