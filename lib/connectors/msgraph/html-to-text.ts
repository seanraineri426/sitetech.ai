/**
 * Convert HTML to plain text by stripping tags.
 * 
 * This is a minimal, dependency-free implementation for cases where
 * Microsoft Graph returns HTML content despite requesting plain text.
 * 
 * Rationale: We avoid external dependencies for this simple task to reduce
 * the attack surface and bundle size. This handles common HTML entities
 * and strips tags while preserving basic structure with line breaks.
 */
export function htmlToText(html: string): string {
  return html
    // Replace closing block elements with newlines
    .replace(/<\/(div|p|h[1-6])>/gi, '\n')
    // Replace self-closing/single block elements
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<\/(tr)>/gi, '\n')
    .replace(/<\/(table|thead|tbody)>/gi, '\n\n')
    // Replace list items with newlines and bullets
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    // Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Collapse multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
}
