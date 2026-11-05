export type Token =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "image"; alt: string; src: string };

const PATTERN = /!\[([^\]]*)\]\(([^)\s]+)\)|\*\*((?:[^*]|\*(?!\*))+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>)\]]+)/g;
const SAFE_HREF = /^(https?:|tel:|mailto:)/i;
const SAFE_IMAGE = /^https:\/\/www\.sirtaki-tavern\.gr\//i;

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
    if (m[2] !== undefined) {
      if (SAFE_IMAGE.test(m[2])) tokens.push({ type: "image", alt: m[1], src: m[2] });
      else pushText(m[0]);
    } else if (m[3] !== undefined) {
      const inner = tokenizeLine(m[3]);
      if (inner.every((t) => t.type === "text")) tokens.push({ type: "bold", text: m[3] });
      else tokens.push(...inner.map((t): Token => (t.type === "text" ? { type: "bold", text: t.text } : t)));
    } else if (m[4] !== undefined) {
      if (SAFE_HREF.test(m[5])) tokens.push({ type: "link", text: m[4], href: m[5] });
      else pushText(m[0]);
    } else {
      tokens.push({ type: "link", text: m[6], href: m[6] });
    }
  }
  pushText(line.slice(last));
  return tokens;
}

const CHOICE_LINE = /^\s*\{\{\s*choices\s*:\s*(.+?)\s*\}\}\s*$/i;

/** A line like "{{choices: 1 | 2 | 3}}" becomes tap-to-answer buttons. Returns null for any other line. */
export function parseChoiceLine(line: string): string[] | null {
  const m = CHOICE_LINE.exec(line);
  if (!m) return null;
  const items = m[1]
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= 40);
  return items.length >= 2 ? items.slice(0, 8) : null;
}
