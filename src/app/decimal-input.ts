/** Decimal keyboards follow the device locale, even when the page is English. */
export function normalizeDecimalInput(value: string): string {
  // Normalize one decimal separator before the draft reaches sizing/validation.
  // Never strip grouping separators or parse through Number: ambiguous pasted
  // values stay invalid, and all SOL/USDC digits remain exact strings.
  const decimal = /^(\d*)[.,](\d*)$/.exec(value);
  return decimal ? `${decimal[1] || '0'}.${decimal[2]}` : value;
}
