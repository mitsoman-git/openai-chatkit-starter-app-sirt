#!/usr/bin/env python3
"""Build lib/agents/kb/hotels_distances_2026.md from the website's own hotel data.

Sources (English pages only, no new* copies):
  - data/where-from.json: distance, walking time, walking directions, route labels
  - location/<hotel>-analipsi.html: where the hotel is, adults-only flag, the page URL

Run from the repo root:  python3 scripts/build_hotels_kb.py [path/to/site]
"""
import glob
import json
import os
import re
import sys
from urllib.parse import quote

SITE = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", ".."))
BASE = "https://www.sirtaki-tavern.gr/"
OUT = os.path.join(os.path.dirname(__file__), "..", "lib", "agents", "kb", "hotels_distances_2026.md")
DEST = "Sirtaki Restaurant Greek Tavern, Analipsi, Crete"

ALIASES = """Hotels guests may name that are the same as the ones above:
- "Stella Island" or "Stella Island Luxury Resort" = Stella Island Resort
- "Atlantica Caldera Palace" or "Caldera Palace" = Caldera Palace Hotel
- "TUI Blue Insula Alba" or "Insula Alba" = Insula Alba
- "Paralos Venus" = Paralos Venus Suites
- "Aspri Petra" = Aspri Petra Apts
"""


def pages():
    """hotel id -> page text, from the live (non-new) English hotel pages."""
    found = {}
    for path in sorted(glob.glob(os.path.join(SITE, "location", "*-analipsi.html"))):
        if os.path.basename(path).startswith("new"):
            continue
        s = open(path, encoding="utf8", errors="ignore").read()
        m = re.search(r"\['id'\]\?\?''\)==='([a-z0-9-]+)'", s)
        if m:
            found[m.group(1)] = (os.path.basename(path), s)
    return found


def main():
    data = json.load(open(os.path.join(SITE, "data", "where-from.json"), encoding="utf8"))
    by_page = pages()
    lines = [
        "# Hotels near Sirtaki: distance, walking time and the walk itself",
        "",
        "This is the only source for hotel distances and routes. Distance and walking time are on foot, from the hotel to Sirtaki Tavern in the centre of Analipsi village.",
        "For a hotel listed here, give its distance, its walking time, a short picture of the walk (the 'The walk' lines), and the link to its page on our website. The Google Maps link is the secondary link. For a hotel that is not listed here, say you do not have its distance (see the location instructions) and never estimate one.",
        "Sirtaki has free parking, and a local taxi is an easy way back (both are stated on every hotel page of the website).",
        "",
    ]
    count = 0
    for h in data["hotels"]:
        if h["id"] not in by_page:
            continue
        fname, s = by_page[h["id"]]
        where = re.search(r"\$hotel_where='([^']*)'(?:\.\$hotel\['dist'\]\.'([^']*)')?", s)
        place = "in Analipsi"
        if where:
            place = where.group(1) + (h["dist"] + where.group(2) if where.group(2) is not None else "")
            place = place.rstrip()
        adults = "$hotel_adults=true" in s
        maps = ("https://www.google.com/maps/dir/?api=1&origin=" + quote(h["name"] + ", Analipsi, Crete", safe="")
                + "&destination=" + quote(DEST, safe="") + "&travelmode=walking")
        lines.append("## " + h["name"])
        lines.append("- Distance: %s" % h["dist"])
        lines.append("- Walking time: %d min" % h["minutes"])
        lines.append("- Where: %s" % place)
        if adults:
            lines.append("- Adults-only hotel")
        if h.get("walk_intro"):
            lines.append("- The walk: " + h["walk_intro"])
        for i, step in enumerate(h.get("walk_steps") or [], 1):
            lines.append("  %d. %s" % (i, step))
        labels = [r["label"] for r in h.get("routes", []) if r.get("label")]
        if labels:
            lines.append("- Route variants on the page: " + "; ".join(labels))
        lines.append("- Page on our website (map of the route, more details): " + BASE + "location/" + fname)
        lines.append("- Google Maps walking directions: " + maps)
        lines.append("")
        count += 1
    taxi = [h for h in data["hotels"] if h["id"] not in by_page and h.get("mode") == "taxi"]
    if taxi:
        lines += [
            "## Hotels further away: by taxi",
            "These hotels have no walking route on our website. Give the distance and the taxi time, and the Google Maps link; there is no page on our website for them.",
            "",
            "| Hotel | Distance | Taxi time | Google Maps directions |",
            "|---|---|---|---|",
        ]
        for h in taxi:
            maps = ("https://www.google.com/maps/dir/?api=1&origin=" + quote(h["name"] + ", Crete", safe="")
                    + "&destination=" + quote(DEST, safe="") + "&travelmode=driving")
            lines.append("| %s | %s | %d min | %s |" % (h["name"], h["dist"], h["minutes"], maps))
        lines.append("")
    lines.append(ALIASES)
    open(OUT, "w", encoding="utf8").write("\n".join(lines))
    print("hotels written:", count, "of", len(data["hotels"]))


main()
