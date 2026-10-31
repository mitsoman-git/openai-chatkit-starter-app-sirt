"""Shared cleaner: turn a translated site page (Markdown export) into plain text for the knowledge base."""
import re

DROP_LINE = re.compile(
    r"^(META |\[\+30|\s*[-*] \[|\[\]\(|\[ +\]|\[ *!\[|\[(Reserve|View|Discover|Explore|Photo|Plan|Read|Browse|Find|Get directions|Call|Build|Ask|WhatsApp|See)|"
    r"SIRTAKI TAVERN ·|\s*\]\(|\s*-\s*$|\s*\[\]\()"
)


def clean(text, drop_sections=()):
    """Remove navigation, images, buttons and the sections named in drop_sections (by heading text)."""
    out, skip_level = [], None
    for raw in text.split("\n"):
        line = raw.rstrip()
        m = re.match(r"^(#{1,6}) +(.*)$", line)
        if m:
            level = len(m.group(1))
            if skip_level is not None and level <= skip_level:
                skip_level = None
            if skip_level is None and any(d.lower() in m.group(2).lower() for d in drop_sections):
                skip_level = level
        if skip_level is not None:
            continue
        if DROP_LINE.match(line):
            continue
        line = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", line)
        line = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", line)
        line = re.sub(r"\s+$", "", line)
        out.append(line)
    s = "\n".join(out)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()
