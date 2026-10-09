/**
 * Tests for HTML-to-text converter.
 */

import { describe, it, expect } from "vitest";
import { htmlToText } from "../html-to-text";

describe("htmlToText", () => {
  it("strips simple HTML tags", () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(htmlToText(html)).toBe('Hello world');
  });

  it("converts block elements to newlines", () => {
    const html = '<div>First</div><div>Second</div><p>Third</p>';
    expect(htmlToText(html)).toBe('First\nSecond\nThird');
  });

  it("converts list items with bullets", () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = htmlToText(html);
    expect(result).toContain('• Item 1');
    expect(result).toContain('• Item 2');
  });

  it("decodes HTML entities", () => {
    const html = 'A &amp; B &lt; C &gt; D &quot;E&quot; &#39;F&#39; &nbsp;G';
    expect(htmlToText(html)).toBe('A & B < C > D "E" \'F\'  G');
  });

  it("collapses multiple newlines", () => {
    const html = '<p>A</p><br><br><br><p>B</p>';
    const result = htmlToText(html);
    expect(result).not.toContain('\n\n\n');
    expect(result).toBe('A\n\nB');
  });

  it("handles complex HTML with quoted reply history", () => {
    const html = `
      <div>This is my reply.</div>
      <div><br></div>
      <div>On Oct 9, 2026, John wrote:</div>
      <blockquote>
        <div>Original message here.</div>
        <div>With multiple lines.</div>
      </blockquote>
    `;
    const result = htmlToText(html);
    expect(result).toContain('This is my reply');
    expect(result).toContain('On Oct 9, 2026, John wrote:');
    expect(result).toContain('Original message here');
    expect(result).toContain('With multiple lines');
  });

  it("trims whitespace", () => {
    const html = '  <p>  Content  </p>  ';
    expect(htmlToText(html)).toBe('Content');
  });

  it("returns empty string for empty HTML", () => {
    expect(htmlToText('')).toBe('');
    expect(htmlToText('   ')).toBe('');
    expect(htmlToText('<div></div>')).toBe('');
  });
});
