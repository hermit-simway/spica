import type { ReactNode } from "react";

/**
 * Lightweight JSON syntax highlighter. Tokenizes a JSON string and returns
 * colorized <span> fragments. No external dependency.
 *
 * Color palette (aligned with index.css accents):
 *  - keys      → blue
 *  - strings   → green
 *  - numbers   → orange
 *  - bool/null → purple
 *  - punct     → muted
 */

const TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;

type TokenKind = "key" | "string" | "number" | "keyword" | "punct";

const COLORS: Record<TokenKind, string> = {
  key: "var(--accent-blue)",
  string: "var(--accent-green)",
  number: "var(--accent-orange)",
  keyword: "var(--accent-purple)",
  punct: "var(--text-muted)"
};

export function highlightJson(json: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of json.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    // Emit any plain whitespace / text between tokens.
    if (index > lastIndex) {
      nodes.push(json.slice(lastIndex, index));
    }
    lastIndex = index + match[0].length;

    let kind: TokenKind = "punct";
    if (match[1] !== undefined) {
      // match[2] present → key; otherwise string value.
      kind = match[2] !== undefined ? "key" : "string";
    } else if (match[3] !== undefined) {
      kind = "keyword";
    } else if (match[4] !== undefined) {
      kind = "number";
    }

    nodes.push(
      <span key={key++} style={{ color: COLORS[kind] }}>
        {match[0]}
      </span>
    );
  }

  if (lastIndex < json.length) {
    nodes.push(json.slice(lastIndex));
  }

  return nodes;
}
