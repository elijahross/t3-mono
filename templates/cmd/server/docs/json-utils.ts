/**
 * Resilient JSON parsing for LLM responses.
 *
 * LLMs occasionally return:
 *   - Markdown code fences around the JSON
 *   - Trailing commentary after the closing brace/bracket
 *   - Unescaped control characters (literal newlines/tabs) inside string values
 *
 * This helper handles all three cases with a two-pass strategy:
 *   1. Try parsing after stripping fences + trailing text.
 *   2. On failure, escape control characters inside JSON string values and retry.
 */
export function sanitizeAndParseJSON(raw: string): unknown {
  let text = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  // Strip trailing non-JSON text after the last closing brace/bracket
  const lastBrace = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (lastBrace !== -1 && lastBrace < text.length - 1) {
    text = text.slice(0, lastBrace + 1);
  }

  try {
    return JSON.parse(text);
  } catch {
    // Escape unescaped control chars inside JSON string values and retry
    const sanitized = text.replace(
      /"(?:[^"\\]|\\.)*"/g,
      (match) =>
        match.replace(/[\x00-\x1F\x7F]/g, (ch) => {
          switch (ch) {
            case "\n":
              return "\\n";
            case "\r":
              return "\\r";
            case "\t":
              return "\\t";
            default:
              return "";
          }
        }),
    );
    return JSON.parse(sanitized); // Let this throw if still invalid
  }
}
