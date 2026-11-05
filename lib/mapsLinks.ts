// Google Maps links in a reply must be exactly the ones in our own knowledge base (the same links the website uses).
// A model can re-type or damage a long link (spaces, "&amp;", a missing part), and then Google shows an error page.
// Here every Maps link that is not one of ours is repaired from the hotel name it mentions, or turned into plain text.

const MAPS_URL = /https:\/\/(?:www\.google\.com\/maps|maps\.app\.goo\.gl)\/[^)\s"'<>\]]+/g;
const MAPS_LINK = /\[([^\]]+)\]\(\s*(https:\/\/(?:www\.google\.com\/maps|maps\.app\.goo\.gl)\/[^)]*)\)/g;

export type MapsAllowList = { urls: Set<string>; hotels: { name: string; url: string }[] };

export function buildMapsAllowList(...texts: string[]): MapsAllowList {
  const urls = new Set<string>();
  const hotels: { name: string; url: string }[] = [];
  for (const t of texts) {
    for (const u of t.match(MAPS_URL) ?? []) {
      urls.add(u);
      const origin = /[?&]origin=([^&]+)/.exec(u);
      if (origin) {
        try {
          const name = decodeURIComponent(origin[1]).split(",")[0].trim().toLowerCase();
          if (name) hotels.push({ name, url: u });
        } catch {
          /* ignore a link that cannot be decoded */
        }
      }
    }
  }
  return { urls, hotels };
}

function decoded(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, " ")).toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

const GENERIC = new Set(["hotel", "resort", "apts", "apartments", "beach", "village", "suites", "the", "and", "grecotel", "design", "mare"]);

function words(s: string): string[] {
  return s.split(/[^a-z0-9\u0370-\u03ff]+/).filter(Boolean);
}

/** The hotel from our list whose distinctive words (ignoring Hotel, Resort, Apts...) all appear in the text. */
function findHotel(hay: string, hotels: MapsAllowList["hotels"]): { name: string; url: string } | undefined {
  const have = new Set(words(hay));
  let best: { name: string; url: string } | undefined;
  let bestScore = 0;
  for (const h of hotels) {
    const key = words(h.name).filter((w) => !GENERIC.has(w));
    const all = words(h.name);
    const need = key.length ? key : all;
    if (need.length && need.every((w) => have.has(w))) {
      const score = all.filter((w) => have.has(w)).length;
      if (score > bestScore) { best = h; bestScore = score; }
    }
  }
  return best;
}

export function fixMapsLinks(reply: string, allow: MapsAllowList): string {
  return reply.replace(MAPS_LINK, (whole, text: string, rawUrl: string) => {
    const url = rawUrl.trim().replace(/&amp;/g, "&");
    if (allow.urls.has(url)) return `[${text}](${url})`;
    const hit = findHotel(`${decoded(url)} ${text.toLowerCase()}`, allow.hotels);
    return hit ? `[${text}](${hit.url})` : text;
  });
}
