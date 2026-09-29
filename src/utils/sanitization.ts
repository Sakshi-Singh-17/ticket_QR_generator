/**
 * Strips script tags, HTML tags, inline event handlers, and normalizes input text.
 * @param input Raw user string
 * @param trim Whether to trim leading/trailing whitespace (default: true)
 */
export function sanitizeInput(input: string, trim = true): string {
  if (typeof input !== 'string') {
    return '';
  }

  // 1. Strip script tags and their inner content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Strip any other HTML/XML tags
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // 3. Strip dangerous inline JS event handlers or javascript: protocols if any remain
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');

  // 4. Optionally trim surrounding whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }

  return sanitized;
}
