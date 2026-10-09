/**
 * Convert HTML to plain text by stripping tags.
 * 
 * This is a minimal, dependency-free implementation for cases where
 * Microsoft Graph returns HTML content despite requesting plain text.
 * 
 * Linear-time algorithm using indexOf scans (no quadratic regexes).
 */

// Named HTML entities (limited set for email content)
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  rsquo: '\u2019',
  lsquo: '\u2018',
  ldquo: '\u201C',
  rdquo: '\u201D',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  copy: '\u00A9',
  reg: '\u00AE',
  trade: '\u2122',
};

/**
 * Decode a single HTML entity.
 * Skips: NUL (0), surrogates (0xD800-0xDFFF), and values > 0x10FFFF.
 */
function decodeEntity(match: string, inner: string): string {
  // Numeric entity: &#123; or &#xABC;
  if (inner[0] === '#') {
    const isHex = inner[1] === 'x' || inner[1] === 'X';
    const numStr = isHex ? inner.slice(2) : inner.slice(1);
    const code = parseInt(numStr, isHex ? 16 : 10);
    
    // Validate: skip NUL, surrogates, and out-of-range
    if (
      code === 0 ||
      (code >= 0xD800 && code <= 0xDFFF) ||
      code > 0x10FFFF ||
      isNaN(code)
    ) {
      return match; // Leave as-is
    }
    
    return String.fromCodePoint(code);
  }
  
  // Named entity
  const lowerName = inner.toLowerCase();
  return NAMED_ENTITIES[lowerName] || match; // Leave unknown entities as-is
}

/**
 * Decode HTML entities in a single pass.
 * Pattern: &(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});
 */
function decodeEntities(html: string): string {
  return html.replace(
    /&(#\d{1,7}|#x[0-9a-fA-F]{1,6}|[a-z]{2,8});/gi,
    decodeEntity
  );
}

/**
 * Linear-time HTML tag/content stripper using indexOf scans.
 */
export function htmlToText(html: string): string {
  let result = '';
  let pos = 0;
  
  while (pos < html.length) {
    const ltPos = html.indexOf('<', pos);
    
    if (ltPos === -1) {
      // No more tags
      result += html.slice(pos);
      break;
    }
    
    // Add text before the tag
    result += html.slice(pos, ltPos);
    
    // Find the closing '>'
    const gtPos = html.indexOf('>', ltPos);
    if (gtPos === -1) {
      // No closing '>', drop the rest
      break;
    }
    
    // Check for special tags and comments
    const tagStart = html.slice(ltPos, ltPos + 9).toLowerCase();
    
    // HTML comments: <!--...-->
    if (tagStart.startsWith('<!--')) {
      const commentEnd = html.indexOf('-->', ltPos + 4);
      if (commentEnd === -1) {
        break; // Unclosed comment, drop rest
      }
      pos = commentEnd + 3;
      continue;
    }
    
    // <style>, <script>, <head>: remove content entirely
    if (
      tagStart.startsWith('<style') ||
      tagStart.startsWith('<script') ||
      tagStart.startsWith('<head')
    ) {
      const tagName = tagStart.startsWith('<style') ? 'style'
                    : tagStart.startsWith('<script') ? 'script'
                    : 'head';
      
      const closeTag = `</${tagName}`;
      const closePos = html.toLowerCase().indexOf(closeTag, gtPos + 1);
      
      if (closePos === -1) {
        // No closing tag, drop rest
        break;
      }
      
      // Find the '>' after the closing tag
      const closeGtPos = html.indexOf('>', closePos);
      if (closeGtPos === -1) {
        break;
      }
      
      pos = closeGtPos + 1;
      continue;
    }
    
    // Check if it's a closing tag for block elements
    const tagContent = html.slice(ltPos + 1, gtPos).toLowerCase();
    if (
      tagContent.startsWith('/div') ||
      tagContent.startsWith('/p') ||
      tagContent.startsWith('/h1') ||
      tagContent.startsWith('/h2') ||
      tagContent.startsWith('/h3') ||
      tagContent.startsWith('/h4') ||
      tagContent.startsWith('/h5') ||
      tagContent.startsWith('/h6') ||
      tagContent.startsWith('/blockquote') ||
      tagContent.startsWith('/tr') ||
      tagContent === '/table' ||
      tagContent === '/thead' ||
      tagContent === '/tbody'
    ) {
      result += '\n';
    }
    // <br> tags
    else if (tagContent.startsWith('br')) {
      result += '\n';
    }
    // <li> tags
    else if (tagContent.startsWith('li') && !tagContent.startsWith('/li')) {
      result += '\n• ';
    }
    
    pos = gtPos + 1;
  }
  
  // Decode entities
  result = decodeEntities(result);
  
  // Normalize whitespace
  result = result
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\r/g, '\n')             // Handle old Mac line endings
    .replace(/ {2,}/g, ' ')           // Collapse runs of spaces
    .replace(/\n{3,}/g, '\n\n')       // Collapse multiple newlines
    .trim();
  
  return result;
}
