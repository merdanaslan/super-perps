import { expect, it } from 'vitest';
import { normalizeDecimalInput } from './decimal-input';
import { toLots } from '../trading/math';

it.each([
  ['0,01', '0.01'],
  ['0,000000001', '0.000000001'],
  ['12345678901234567890,123456789', '12345678901234567890.123456789'],
  ['0.0100', '0.0100'],
  [',5', '0.5'],
  ['.5', '0.5'],
  ['0,', '0.'],
  ['', ''],
  ['123', '123'],
])('normalizes %s as a decimal string without rounding', (input, expected) => {
  expect(normalizeDecimalInput(input)).toBe(expected);
});

it.each(['1.234,56', '1,234.56', '1,2,3', '1 234,56', '1e3', '-0,01', '0,0000000001'])(
  'does not turn malformed or overprecise input %s into a valid SOL transfer',
  (input) => {
    expect(() => toLots(normalizeDecimalInput(input), 9)).toThrow();
  },
);
