/** Clamps a number to [min, max] */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Checks if a string contains another string, case-insensitively.
 */
export function containsCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Normalizes whitespace: collapses multiple spaces/newlines into a single space.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extracts the first N words from a string.
 */
export function firstNWords(text: string, n: number): string {
  return text.split(/\s+/).slice(0, n).join(' ');
}

/**
 * Truncates a string to maxLength, appending '...' if truncated.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Returns the unique values from an array, preserving order of first occurrence.
 */
export function unique<T>(arr: T[]): T[] {
  const seen = new Set<T>();
  return arr.filter((item) => {
    if (seen.has(item)) return false;
    seen.add(item);
    return true;
  });
}
