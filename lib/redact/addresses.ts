/**
 * Email address redaction utilities.
 * 
 * This module is isomorphic - it can be used in both server and client contexts.
 * No Node-only APIs (crypto, fs, Buffer) are used.
 */

/**
 * Redact email addresses from text.
 * Replaces user@domain.com with [email-domain.com] to preserve domain while ensuring
 * the output doesn't match email regex patterns.
 * 
 * Uses negative lookahead/lookbehind to avoid quadratic behavior on text with no '@'.
 * Supports Unicode local parts and domains. Limits local part to 256 chars (RFC 5321 max).
 * Trailing lookahead allows sentence-ending periods but rejects addresses followed by dot+alnum.
 * 
 * @param text - Text to redact addresses from
 * @returns Text with email addresses replaced by [email-domain] placeholders
 */
export function redactAddresses(text: string): string {
  // Build a 1:1 detection copy where look-alikes map to ASCII equivalents
  // U+FF20 ＠, U+FE6B ﹫ -> '@'
  // U+FF0E ．, U+3002 。, U+FF61 ｡ -> '.'
  // All are single UTF-16 code units, so indices line up
  const detection = text
    .replace(/[\uff20\ufe6b]/gu, '@')
    .replace(/[\uff0e\u3002\uff61]/gu, '.');
  
  // Quick check: if there's no '@', skip entirely for performance
  if (!detection.includes('@')) return text;
  
  // Track redaction spans: [start, end, replacement]
  const redactions: Array<[number, number, string]> = [];
  
  // Primary pattern: well-formed addresses with Unicode support
  // Include \p{Cf} (format/zero-width) and \p{M} (combining marks)
  const localPartChar = String.raw`[A-Z0-9._%+\-\p{L}\p{N}\p{Cf}\p{M}]`;
  const lookbehindChar = String.raw`[A-Z0-9._%+\-@\p{L}\p{N}\p{Cf}\p{M}]`;
  const domainChar = String.raw`[A-Z0-9\-\p{L}\p{N}\p{Cf}\p{M}]`;
  const tldChar = String.raw`[A-Z\p{L}]`;
  const notAfterChar = String.raw`(?![A-Z_%\-\p{L}\p{N}\p{M}]|\.${domainChar})`;
  
  const primaryPattern = new RegExp(
    String.raw`(?<!${lookbehindChar})${localPartChar}{1,256}@(${domainChar}{1,63}(?:\.${domainChar}{1,63})*\.${tldChar}{2,63})${notAfterChar}`,
    'giu'
  );
  
  let match: RegExpExecArray | null;
  primaryPattern.lastIndex = 0;
  while ((match = primaryPattern.exec(detection)) !== null) {
    // Strip \p{Cf} from captured domain when building placeholder
    const domain = match[1].replace(/\p{Cf}/gu, '');
    redactions.push([match.index, match.index + match[0].length, '[email-' + domain + ']']);
  }
  
  // Linear token-based fallback for remaining '@' (truncated, malformed, or adjacent addresses)
  if (detection.includes('@')) {
    // Split on whitespace, keeping separators
    const parts = detection.split(/(\s+)/u);
    let offset = 0;
    
    // Moving pointer for O(1) coverage check (redactions are sorted by start)
    let primaryIndex = 0;
    
    for (let i = 0; i < parts.length; i++) {
      const token = parts[i];
      if (token.trim() && token.includes('@')) {
        // Split token on any character outside [A-Za-z0-9._%+\-@] or Unicode letters/numbers/format/marks, keeping separators
        const piecePattern = /([^A-Za-z0-9._%+\-@\p{L}\p{N}\p{Cf}\p{M}])/u;
        const pieces = token.split(piecePattern);
        let tokenOffset = offset;
        
        for (let j = 0; j < pieces.length; j++) {
          const piece = pieces[j];
          if (piece.includes('@')) {
            // Find first '@' to check for local part
            const firstAtIndex = piece.indexOf('@');
            
            // Don't redact if '@' is at the start (like @channel) or no local part
            if (firstAtIndex > 0) {
              // Find last '@' for the domain
              const lastAtIndex = piece.lastIndexOf('@');
              
              // Extract valid domain characters after '@'
              // Domain chars: letters, numbers, dots, marks, format chars (no hyphen, no underscore)
              // Stops at hyphen so "3m.com-x" extracts "3m.com", but "3m.comPhone" extracts "3m.comPhone"
              const afterAt = piece.slice(lastAtIndex + 1);
              const domainMatch = afterAt.match(/^[A-Z0-9.\p{L}\p{N}\p{Cf}\p{M}]+/iu);
              
              if (domainMatch) {
                const fullDomain = domainMatch[0];
                const domainEnd = lastAtIndex + 1 + fullDomain.length;
                
                // Check if this looks like a domain using Lead's tested logic
                const d = fullDomain.replace(/\.+$/u, '');
                const trailingDots = fullDomain.match(/\.+$/u)?.[0] || '';
                const labels = d.split('.');
                const isAtEnd = (i === parts.length - 1) && (j === pieces.length - 1);
                const dotted = labels.length > 1 && /^\p{Cf}*[\p{L}\p{N}]/u.test(d) &&
                  (/\.\p{L}{2}/u.test(d) || /\p{L}/u.test(labels[labels.length - 1]));
                const dotlessAtEnd = isAtEnd && labels.length === 1 && /^\p{Cf}*\p{L}/u.test(d);
                
                if (dotted || dotlessAtEnd) {
                  // Check if already covered by primary pattern using moving pointer
                  const addrStart = tokenOffset;
                  const addrEnd = tokenOffset + domainEnd;
                  
                  // Advance pointer to first redaction that could cover this address
                  while (primaryIndex < redactions.length && redactions[primaryIndex][1] < addrStart) {
                    primaryIndex++;
                  }
                  
                  // Check if current redaction covers this address
                  const alreadyCovered = primaryIndex < redactions.length &&
                    redactions[primaryIndex][0] <= addrStart &&
                    redactions[primaryIndex][1] >= addrEnd;
                  
                  if (!alreadyCovered) {
                    // Strip \p{Cf} from domain when building placeholder
                    const cleanDomain = d.replace(/\p{Cf}/gu, '');
                    const replacement = '[email-' + cleanDomain + ']' + trailingDots;
                    redactions.push([addrStart, addrEnd, replacement]);
                  }
                }
              }
            }
          }
          tokenOffset += piece.length;
        }
      }
      offset += token.length;
    }
  }
  
  // Sort redactions by start position and merge overlapping spans
  redactions.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number, string]> = [];
  for (const [start, end, replacement] of redactions) {
    if (merged.length === 0 || merged[merged.length - 1][1] < start) {
      merged.push([start, end, replacement]);
    } else {
      // Overlapping: keep the longer span
      const prev = merged[merged.length - 1];
      if (end > prev[1]) {
        prev[1] = end;
        prev[2] = replacement;
      }
    }
  }
  
  // Splice replacements into original text
  if (merged.length === 0) return text;
  
  let result = '';
  let pos = 0;
  for (const [start, end, replacement] of merged) {
    result += text.slice(pos, start) + replacement;
    pos = end;
  }
  result += text.slice(pos);
  
  return result;
}
