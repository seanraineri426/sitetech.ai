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

  it("decodes HTML entities with &amp; last", () => {
    const html = 'A &amp; B &lt; C &gt; D &quot;E&quot; &#39;F&#39; &nbsp;G';
    expect(htmlToText(html)).toBe('A & B < C > D "E" \'F\' \u00A0G');
  });

  it("decodes &amp; last so &amp;lt; becomes &lt; not <", () => {
    const html = '&amp;lt; &amp;gt; &amp;amp;';
    expect(htmlToText(html)).toBe('&lt; &gt; &amp;');
  });

  it("decodes numeric entities (decimal)", () => {
    const html = 'Non-breaking space: &#160; Em dash: &#8212;';
    expect(htmlToText(html)).toBe('Non-breaking space: \u00A0 Em dash: \u2014');
  });

  it("decodes numeric entities (hex)", () => {
    const html = 'Right quote: &#x2019; Euro: &#x20AC;';
    expect(htmlToText(html)).toBe('Right quote: \u2019 Euro: \u20AC');
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

  it("removes <style> block contents entirely", () => {
    const html = '<style>body { color: red; }</style><p>Visible text</p>';
    expect(htmlToText(html)).toBe('Visible text');
  });

  it("removes <script> block contents entirely", () => {
    const html = '<script>alert("test");</script><p>Visible text</p>';
    expect(htmlToText(html)).toBe('Visible text');
  });

  it("removes <head> block contents entirely", () => {
    const html = '<head><title>Page Title</title></head><p>Visible text</p>';
    expect(htmlToText(html)).toBe('Visible text');
  });

  it("converts </blockquote> to newline", () => {
    const html = '<blockquote>Quoted text</blockquote>More text';
    const result = htmlToText(html);
    expect(result).toContain('Quoted text\n');
    expect(result).toContain('More text');
  });

  it("handles realistic Outlook HTML with style block and quoted reply", () => {
    const html = `
      <html>
      <head>
        <style>
          .MsoNormal { margin: 0; }
          a { color: blue; }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          <p class="MsoNormal">This is my reply with &#8220;smart quotes&#8221;.</p>
          <p class="MsoNormal">&nbsp;</p>
          <div style="border:none;border-top:solid #E1E1E1 1.0pt;padding:3.0pt 0in 0in 0in">
            <p class="MsoNormal"><b>From:</b> John Doe<br>
            <b>Sent:</b> October 9, 2026</p>
          </div>
          <blockquote style="margin-top:5.0pt;margin-bottom:5.0pt">
            <p class="MsoNormal">Original message with &amp;lt;angle brackets&amp;gt;.</p>
          </blockquote>
        </div>
      </body>
      </html>
    `;
    const result = htmlToText(html);
    
    // Style block should be removed
    expect(result).not.toContain('MsoNormal');
    expect(result).not.toContain('color: blue');
    
    // Smart quotes should be decoded (&#8220; = U+201C, &#8221; = U+201D)
    expect(result).toContain('This is my reply with');
    expect(result).toContain('smart quotes');
    
    // Quoted reply should be preserved with proper structure
    expect(result).toContain('From:');
    expect(result).toContain('John Doe');
    expect(result).toContain('Original message with &lt;angle brackets&gt;');
    
    // Should have line breaks between sections
    expect(result.split('\n').length).toBeGreaterThan(1);
  });
});
