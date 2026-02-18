const TOKEN_REGEX =
  /\[\[\[(DOCUMENT|CHUNK|IMAGE|TABLE|FINDING|ATTACHMENT|REGULATION)_([a-zA-Z0-9_-]+)\]\]\]/g;

export type TokenType = "DOCUMENT" | "CHUNK" | "IMAGE" | "TABLE" | "FINDING" | "ATTACHMENT" | "REGULATION";

export interface ChatToken {
  type: TokenType;
  id: string;
  raw: string;
}

export interface ContentSegment {
  kind: "text" | "token";
  value: string;
  token?: ChatToken;
}

export function parseContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(TOKEN_REGEX)) {
    const matchIndex = match.index!;
    if (matchIndex > lastIndex) {
      segments.push({ kind: "text", value: content.slice(lastIndex, matchIndex) });
    }

    const token: ChatToken = {
      type: match[1] as TokenType,
      id: match[2]!,
      raw: match[0],
    };
    segments.push({ kind: "token", value: match[0], token });
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push({ kind: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
