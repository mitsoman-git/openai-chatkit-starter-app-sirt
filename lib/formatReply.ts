export type Token =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

const PATTERN = /\*\*((?:[^*]|\*(?!\*))+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>)\]]+)/g;
const SAFE_HREF = /^(https?:|tel:|mailto:)/i;

export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  const pushText = (text: string) => {
    if (text) tokens.push({ type: "text", text });
  };

  for (const m of line.matchAll(PATTERN)) {
    const at = m.index ?? 0;
    pushText(line.slice(last, at));
    last = at + m[0].length;
    if (m[1] !== undefined) {
      const inner = tokenizeLine(m[1]);
      if (inner.every((t) => t.type === "text")) tokens.push({ type: "bold", text: m[1] });
      else tokens.push(...inner.map((t): Token => (t.type === "text" ? { type: "bold", text: t.text } : t)));
    } else if (m[2] !== undefined) {
      if (SAFE_HREF.test(m[3])) tokens.push({ type: "link", text: m[2], href: m[3] });
      else pushText(m[0]);
    } else {
      tokens.push({ type: "link", text: m[4], href: m[4] });
    }
  }
  pushText(line.slice(last));
  return tokens;
}
