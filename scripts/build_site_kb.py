#!/usr/bin/env python3
"""Build the knowledge-base files for specials, story, area and takeaway from the translated English site pages.

Source: docs/translation/αγγλικά (clean Markdown copies of the site pages).
Run from the repo root:  python3 scripts/build_site_kb.py [path/to/site]
drinks_2026.md is written by hand (the drinks PDFs have prices in a separate column) and is not touched here.
"""
import glob
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from mdclean import clean  # noqa: E402

SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(SITE, "docs", "translation", "αγγλικά")
KB = os.path.join(os.path.dirname(__file__), "..", "lib", "agents", "kb")
BASE = "https://www.sirtaki-tavern.gr/"

PAGE_DROP = ("Photo", "Video", "Say WOW", "Try the", "Reviews", "Gallery", "Nutrition per", "Book a table", "Reserve")
REPEATED_FARM = ("The Cretan Black Angus Farm", "25 Days Dry Aged Cretan Black Angus", "Cretan Black Angus Farm")


def read(rel):
    return open(os.path.join(SRC, rel), encoding="utf8").read()


def blog_body(rel):
    t = read(rel)
    t = re.sub(r"\A---.*?---\n", "", t, flags=re.S)
    t = re.sub(r"^\[\[.*?\]\]\s*$", "", t, flags=re.M)
    t = re.sub(r"^\?\? .*$", "", t, flags=re.M)
    t = re.sub(r"^> ?", "", t, flags=re.M)
    return clean(t)


def specials():
    out = [
        "# Specials at Sirtaki",
        "",
        "Facts about each special dish, from the specials pages of our website. Each section names the page where the guest can see photos and details; always give that page link when you talk about the dish. Prices and weights are exactly as written. Do not add facts that are not here.",
        "",
    ]
    out += ["## Specials overview", "Page: " + BASE + "specials/", "", clean(read("specials/specials-index_αγγλικά.md"), PAGE_DROP), ""]
    out += ["## Greek Specialties overview", "Page: " + BASE + "specials/greek/", "", clean(read("specials/specials-greek-index_αγγλικά.md"), PAGE_DROP), ""]
    out += ["## Black Angus Cuts & Steaks overview", "Page: " + BASE + "specials/black-angus-cuts.html", "",
            clean(read("specials/specials-black-angus-cuts_αγγλικά.md"), PAGE_DROP), ""]
    for sub in ("greek", "blackangus"):
        for path in sorted(glob.glob(os.path.join(SRC, "specials", sub, "*.md"))):
            name = os.path.basename(path)
            slug = re.sub(r"_[^_]*\.md$", "", re.sub(r"^specials-%s-" % sub, "", name))
            if slug == "meze":
                continue  # the Meze specialist owns the Meze
            body = clean(open(path, encoding="utf8").read(), PAGE_DROP + REPEATED_FARM)
            title = re.search(r"^# (.+)$", body, re.M)
            out += ["## " + (title.group(1) if title else slug), "Page: %sspecials/%s/%s.html" % (BASE, sub, slug), "",
                    re.sub(r"^## ", "### ", re.sub(r"^# .+\n", "", body, count=1), flags=re.M), ""]
    return "\n".join(out)


def story():
    page = clean(read("σελίδες/story_αγγλικά.md"), ("Photos from the past",))
    name = blog_body("blog/blog-19-why-sirtaki-name-story_αγγλικά.md")
    return "\n".join([
        "# Our story: the family, the name, since 1993",
        "",
        "From the Our Story page of the website (" + BASE + "story.html) and the blog post on the name. Use it for questions about who we are, since when, the family and the name Sirtaki. Link the story page when the guest wants more.",
        "",
        "## Our story page", page, "",
        "## Why is it called Sirtaki? (" + BASE + "blog/why-sirtaki-name-story.html)", name, "",
    ])


def area():
    loc = read("location/location_αγγλικά.md")
    i = loc.index("## Analipsi, Hersonissos")
    j = loc.index("## Greek taverns in Analipsi village")
    village = clean(loc[i:j])
    evening = blog_body("blog/blog-11-evening-in-analipsi_αγγλικά.md")
    return "\n".join([
        "# The area: Analipsi village, beaches and day trips",
        "",
        "From the location page of our website (" + BASE + "location/location-of-analipsi-hersonissos.html). Use it for guests asking what Analipsi is like, what to do in the evening and how the area is placed. Only say what is written here; for anything else about the region say you do not have details and offer the dinner and the walk. Never recommend other restaurants.",
        "",
        village, "",
        "## An evening in Analipsi (" + BASE + "blog/evening-in-analipsi.html)", evening, "",
    ])


def takeaway():
    t = read("σελίδες/takeaway-analipsi_αγγλικά.md")
    dine_only = []
    for m in re.finditer(r"\[ ?([^\]\n]+)\]\([^)\n]*\)(\d+(?:\.\d+)?)€\n\nDine-in only", t):
        dine_only.append("%s (%s€)" % (m.group(1).strip(), m.group(2)))
    assert "Available Daily:** 17:30 - 22:00" in t and "free pita" in t
    lines = [
        "# Takeaway",
        "",
        "From the takeaway page of our website (" + BASE + "takeaway-analipsi.html).",
        "",
        "- Takeaway is ordered online on the takeaway page of our website, on the guest's phone. No app is needed.",
        "- Takeaway orders are taken daily, on the days we are open, from 17:30 to 22:00 (last online orders at 22:00).",
        "- The guest collects the food in front of the restaurant, in the centre of Analipsi. We do not deliver to hotels or apartments.",
        "- The full menu is available for takeaway, with the exceptions below.",
        "- Every takeaway order includes free pita bread.",
        "- Ordering online on our own website saves the fees of delivery apps and supports a local family business.",
        "- Tell us about any allergy when you order. Our kitchen also handles gluten, so traces cannot be excluded.",
        "- Takeaway bottles of wine are 10% off the wine list price; ask our staff when you collect.",
    ]
    if dine_only:
        lines += ["- Dine-in only (not available for takeaway): " + "; ".join(dine_only) + "."]
    lines += ["", "Send the guest to " + BASE + "takeaway-analipsi.html to order. Prices for takeaway are the same as the menu prices in the Menu section."]
    return "\n".join(lines)


for name, fn in (("specials_2026.md", specials), ("story_2026.md", story), ("area_2026.md", area), ("takeaway_2026.md", takeaway)):
    text = fn().strip() + "\n"
    open(os.path.join(KB, name), "w", encoding="utf8").write(text)
    print(name, len(text))
