#!/usr/bin/env python3
"""Build lib/agents/kb/faq_2026.md from the questions and answers published on the website.

Sources (English pages only):
  - faq.html: the visible accordion, grouped by its category titles
  - every other page: FAQPage JSON-LD (blog posts, contact, what-to-order, ...)

Run from the repo root:  python3 scripts/build_faq_kb.py [path/to/site]
"""
import glob
import html
import json
import os
import re
import subprocess
import sys
from html.parser import HTMLParser
from urllib.parse import urljoin

SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", ".."))
BASE = "https://www.sirtaki-tavern.gr/"
OUT = os.path.join(os.path.dirname(__file__), "..", "lib", "agents", "kb", "faq_2026.md")


def render(path):
    """Page source as visitors get it: pages with PHP (opening hours come from site-settings) are run through php."""
    s = open(path, encoding="utf8", errors="ignore").read()
    if "<?" not in s:
        return s
    r = subprocess.run(["php", "-d", "display_errors=0", path], cwd=SITE, capture_output=True, text=True, timeout=60)
    return r.stdout if r.stdout.strip() else s


def clean(s):
    s = html.unescape(s).replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    return re.sub(r"\n{3,}", "\n\n", s).strip()


class Md(HTMLParser):
    """HTML fragment -> small markdown (bold, links with absolute urls, bullet lists)."""

    def __init__(self, page_url):
        super().__init__(convert_charrefs=True)
        self.page_url, self.out, self.href = page_url, [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ("strong", "b"):
            self.out.append("**")
        elif tag == "a" and a.get("href"):
            href = a["href"]
            if href.startswith(("tel:", "mailto:", "http")):
                self.href = href
            elif not href.startswith("#"):
                self.href = urljoin(self.page_url, href)
            else:
                self.href = None
            if self.href:
                self.out.append("[")
        elif tag == "li":
            self.out.append("\n- ")
        elif tag in ("br", "p", "ul", "ol", "div"):
            self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in ("strong", "b"):
            self.out.append("**")
        elif tag == "a" and self.href:
            self.out.append(f"]({self.href})")
            self.href = None
        elif tag in ("p", "ul", "ol"):
            self.out.append("\n")

    def handle_data(self, data):
        self.out.append(data)

    def text(self):
        t = "".join(self.out)
        t = re.sub(r"\*\*\s*\*\*", "", t)
        t = re.sub(r"\*\*(\s*)\*\*", r"\1", t)
        t = re.sub(r"\n\s*\n(- )", r"\n\1", t)
        return clean(t)


def md(fragment, page_url):
    p = Md(page_url)
    p.feed(fragment)
    return p.text()


def plain(fragment):
    return clean(re.sub(r"<[^>]+>", " ", fragment))


def parse_faq_page(path, page_url):
    s = render(path)
    items, cat = [], "General"
    token = re.compile(
        r'faq-cat-title">(.*?)</h3>'
        r'|<button[^>]*accordion-button[^>]*>(.*?)</button>.*?<div class="accordion-body">(.*?)</div>\s*</div>\s*</div>',
        re.S,
    )
    for m in token.finditer(s):
        if m.group(1) is not None:
            cat = plain(m.group(1))
        else:
            items.append((cat, plain(m.group(2)), md(m.group(3), page_url)))
    return items


def walk(o, out):
    if isinstance(o, dict):
        t = o.get("@type")
        if t == "Question" or (isinstance(t, list) and "Question" in t):
            out.append((o.get("name") or "", (o.get("acceptedAnswer") or {}).get("text") or ""))
        for v in o.values():
            walk(v, out)
    elif isinstance(o, list):
        for v in o:
            walk(v, out)


def title_of(s, path):
    m = re.search(r"<title>(.*?)</title>", s, re.S)
    return clean(re.sub(r"\s+[|–—-]\s+.*$", "", html.unescape(m.group(1)))) if m else os.path.basename(path)


def norm(q):
    return re.sub(r"[^a-z0-9]+", " ", q.lower()).strip()


def main():
    seen, sections = set(), []

    faq_path = os.path.join(SITE, "faq.html")
    by_cat = {}
    for cat, q, a in parse_faq_page(faq_path, BASE + "faq.html"):
        if norm(q) in seen or not a:
            continue
        seen.add(norm(q))
        by_cat.setdefault(cat, []).append((q, a))
    for cat, qa in by_cat.items():
        sections.append((f"FAQ page: {cat}", BASE + "faq.html", qa))

    pages = [p for p in glob.glob(os.path.join(SITE, "*.html")) + glob.glob(os.path.join(SITE, "*.php")) + glob.glob(os.path.join(SITE, "blog", "*.html"))
             if not os.path.basename(p).startswith("new") and os.path.basename(p) != "faq.html" and "sirtaki-desk" not in p]
    for path in sorted(pages):
        s = render(path)
        found = []
        for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', s, re.S):
            try:
                walk(json.loads(m.group(1)), found)
            except ValueError:
                pass
        rel = os.path.relpath(path, SITE).replace(os.sep, "/")
        url = BASE + rel
        qa = []
        for q, a in found:
            q = clean(q)
            # answers filled in by PHP at request time (e.g. opening hours) are not static text: skip them
            if not q or norm(q) in seen or "<?" in a or "<?" in q:
                continue
            seen.add(norm(q))
            qa.append((q, md(a, url)))
        if qa:
            sections.append((f"{title_of(s, path)} ({rel})", url, qa))

    total = sum(len(qa) for _, _, qa in sections)
    out = [
        "# Website FAQ: questions and answers published on sirtaki-tavern.gr",
        "",
        "Use this section to answer guests' questions about reservations, menu and diets, kids, location, hours, takeaway, events, pets and similar topics.",
        "The answers are what the website says; keep their facts, prices, times and links exactly as written. Each section names the page where the guest can read more.",
        f"({total} questions)",
        "",
    ]
    for title, url, qa in sections:
        out += [f"## {title}", f"Page: {url}", ""]
        for q, a in qa:
            out += [f"**Q: {q}**", ("A:\n" if a.startswith("- ") else "A: ") + a, ""]
    open(OUT, "w", encoding="utf8").write("\n".join(out).rstrip() + "\n")
    print(f"{total} questions, {len(sections)} sections -> {os.path.relpath(OUT)}")


if __name__ == "__main__":
    main()
