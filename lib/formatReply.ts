export type Token =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string };

const PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s<>)\]]+)/g;
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
      if (SAFE_HREF.test(m[2])) tokens.push({ type: "link", text: m[1], href: m[2] });
      else pushText(m[0]);
    } else if (m[3] !== undefined) {
      tokens.push({ type: "bold", text: m[3] });
    } else {
      tokens.push({ type: "link", text: m[4], href: m[4] });
    }
  }
  pushText(line.slice(last));
  return tokens;
}
