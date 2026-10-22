#!/usr/bin/env python3
"""
Phase 1 Data Pipeline — IELTS Listening Vocabulary Trainer
Parses `/home/user/uploads/1200_most_commonly_repeated_words_in.pdf`, applies
all deterministic cleaning rules from Section 3 of `IELTS_Vocab_Trainer_Spec.md`,
validates integrity across all 37 categories, and writes `/home/user/words.json`.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
import pymupdf

ROOT = Path("/home/user")
PDF_PATH = ROOT / "uploads" / "1200_most_commonly_repeated_words_in.pdf"
OUTPUT_JSON = ROOT / "words.json"

# Canonical 37 categories in exact source order (Spec Section 3.1)
CANONICAL_CATEGORIES: list[tuple[str, str]] = [
    ("days-of-the-week", "Days of the week"),
    ("months-of-the-year", "Months of the year"),
    ("money-matters", "Money matters"),
    ("subjects", "Subjects"),
    ("studying-at-college-university", "Studying at college/university"),
    ("marketing", "Marketing"),
    ("health", "Health"),
    ("nature", "Nature"),
    ("the-environment", "The environment"),
    ("the-animal-kingdom", "The animal kingdom"),
    ("plants", "Plants"),
    ("continents", "Continents"),
    ("countries", "Countries"),
    ("languages", "Languages"),
    ("architecture-and-buildings", "Architecture and buildings"),
    ("homes", "Homes"),
    ("in-the-city", "In the city"),
    ("workplaces", "Workplaces"),
    ("rating-and-qualities", "Rating and qualities"),
    ("touring", "Touring"),
    ("verbs", "Verbs"),
    ("adjectives", "Adjectives"),
    ("hobbies", "Hobbies"),
    ("sports", "Sports"),
    ("shapes", "Shapes"),
    ("measurement", "Measurement"),
    ("transportations", "Transportations"),
    ("vehicles", "Vehicles"),
    ("weather", "Weather"),
    ("places", "Places"),
    ("equipment-and-tools", "Equipment and tools"),
    ("the-arts-and-media", "The arts and media"),
    ("materials", "Materials"),
    ("works-and-jobs", "Works and jobs"),
    ("color", "Color"),
    ("expressions-and-time", "Expressions and time"),
    ("other", "Other"),
]

# Missing-delimiter splits where two distinct list items were fused in the source PDF
SPLIT_OVERRIDES: dict[tuple[str, str], list[str]] = {
    ("months-of-the-year", "July August"): ["July", "August"],
    ("continents", "Australia and Antarctica"): ["Australia", "Antarctica"],
    ("touring", "tourist guided tour"): ["tourist", "guided tour"],
}

# Explicit typo fixes, ambiguous phrase resolutions, and capitalization normalizations
TEXT_OVERRIDES: dict[tuple[str, str], str] = {
    # Obvious typos (Spec Section 3.3 + forensic audit)
    ("the-environment", "burring fossil"): "burning fossils",
    ("the-environment", "soar power"): "solar power",
    ("vehicles", "stream train"): "steam train",
    ("equipment-and-tools", "breaks"): "brakes",
    # Manual review / slash compound normalizations
    ("touring", "single double bedded room"): "single/double bedded room",
    ("materials", "lumber/wood"): "lumber",
    # Capitalization fixes: lowercase proper nouns/adjectives -> capitalized
    ("countries", "the dominican republic"): "the Dominican Republic",
    ("countries", "the philippines"): "the Philippines",
    ("sports", "american football"): "American football",
    # Capitalization fixes: stray mid-list uppercase -> lowercase
    ("studying-at-college-university", "Proofreading"): "proofreading",
    ("adjectives", "Immense"): "immense",
    ("adjectives", "Western"): "western",
    ("shapes", "Square"): "square",
    ("shapes", "Oval"): "oval",
    ("measurement", "Mass"): "mass",
    ("the-arts-and-media", "Opera"): "opera",
    ("the-arts-and-media", "Orchestra"): "orchestra",
}

# Proper nouns, acronyms, and brand names whose capitalization is intentionally preserved
PRESERVE_CASE_CATEGORIES = {
    "days-of-the-week",
    "months-of-the-year",
    "continents",
    "countries",
    "languages",
}
LOWERCASE_IN_PROPER_CATEGORIES = {
    "weekdays",
    "weekend",
    "linguistics",
    "bilingual",
    "trilingual",
    "polyglot",
}
PRESERVE_EXACT_CASE = {
    "MasterCard",
    "VISA",
    "TV program",
    "American football",
}

# British / American & standard orthographic variants (keyed by canonical `text`)
ALT_VARIANTS: dict[str, list[str]] = {
    "cheque": ["check"],
    "taxpayers' money": ["taxpayers money", "taxpayer's money"],
    "archaeology": ["archeology"],
    "student advisor": ["student adviser"],
    "computer centre": ["computer center"],
    "home stay": ["homestay"],
    "post-secondary": ["postsecondary"],
    "bachelor's degree": ["bachelors degree"],
    "registrar's office": ["registrars office"],
    "catalogue": ["catalog"],
    "TV program": ["TV programme"],
    "yoghurt": ["yogurt", "yoghourt"],
    "blackcurrant": ["black currant"],
    "burning fossils": ["burning fossil"],
    "fertilizer": ["fertiliser"],
    "Turkey": ["Türkiye", "Turkiye"],
    "the Dominican Republic": ["Dominican Republic"],
    "the Philippines": ["Philippines"],
    "Punjabi": ["Panjabi"],
    "town house": ["townhouse"],
    "neighborhood": ["neighbourhood"],
    "storey": ["story"],
    "city centre": ["city center"],
    "technical cooperation": ["technical co-operation"],
    "colored": ["coloured"],
    "single/double bedded room": [
        "single double bedded room",
        "single or double bedded room",
    ],
    "snorkeling": ["snorkelling"],
    "woodcarving": ["wood carving"],
    "the discus": ["discus"],
    "the javelin": ["javelin"],
    "the hammer": ["hammer"],
    "the high jump": ["high jump"],
    "bodyboarding": ["body boarding"],
    "kitesurfing": ["kite surfing"],
    "narrowboat": ["narrow boat"],
    "sailboat": ["sail boat"],
    "rowboat": ["row boat"],
    "seaplane": ["sea plane"],
    "pickup": ["pick-up"],
    "cafe": ["café"],
    "sports centre": ["sports center"],
    "disk": ["disc"],
    "theatre": ["theater"],
    "aluminum": ["aluminium"],
    "lumber": ["lumber/wood"],
    "fiberglass": ["fibreglass"],
    "grey": ["gray"],
    "a gap year": ["gap year"],
    "practice": ["practise"],
    "dialogue": ["dialog"],
    "personal fulfillment": ["personal fulfilment"],
    "driving license": ["driving licence"],
    "man-made": ["manmade"],
    "fund-raising event": ["fundraising event"],
    "encyclopedia": ["encyclopaedia"],
}

# Disambiguating hints for homophones (including non-rhotic British RP homophones) & special items
HINTS: dict[str, str] = {
    "cheque": "written bank payment order",
    "stationery": "writing paper, pens, and office supplies",
    "poll": "voting survey or opinion count",
    "cereals": "grain crops or breakfast foods",
    "meat": "animal flesh eaten as food",
    "dam": "barrier built across a river to hold water",
    "desert": "dry, barren land (single s)",
    "coal": "dark fossil fuel rock",
    "core": "central part of a fruit or stem",
    "flower": "blossom of a plant",
    "fort": "defensive military building",
    "storey": "level or floor of a building",
    "lane": "narrow road or street",
    "guest": "visitor staying at a hotel or home",
    "suite": "set of connected hotel rooms",
    "single/double bedded room": "hotel room capacity option",
    "court": "marked area for playing tennis or squash",
    "brakes": "stopping mechanism on a vehicle or bike",
    "disk": "flat storage plate or medium",
    "steel": "strong iron-carbon metal alloy",
    "wood": "material from trees",
    "waiter": "person who serves food at tables",
    "mail address": "postal address",
    "blue": "color of a clear daytime sky",
    "red": "primary warm color",
    "practice": "repeated exercise or customary action",
    "sewer systems": "underground drainage networks",
    "straight": "direct, without bends or curves",
    "farewell": "expression used when saying goodbye",
}


def slugify(text: str) -> str:
    """Create canonical word ID slug (e.g. 'credit card' -> 'credit-card')."""
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = "".join(c for c in normalized if not unicodedata.combining(c))
    ascii_text = ascii_text.lower().replace("'", "")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return slug


def extract_raw_categories(pdf_path: Path) -> list[tuple[str, list[str]]]:
    doc = pymupdf.open(pdf_path)
    raw_sections: list[tuple[str, list[str]]] = []
    cur_header: str | None = None
    cur_lines: list[str] = []

    for pno, page in enumerate(doc, 1):
        raw = page.get_text("rawdict")
        for block in raw["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                spans = line["spans"]
                full_line = "".join("".join(c["c"] for c in s["chars"]) for s in spans)
                if pno == 1 and "The 1200 most commonly repeated words" in full_line:
                    continue
                if full_line.strip() in {"1", "2", "3", "4"}:
                    continue
                if "Bold" in spans[0]["font"] and spans[0]["size"] > 17:
                    if cur_header is not None:
                        raw_sections.append((cur_header, cur_lines))
                    cur_header = "".join(c["c"] for c in spans[0]["chars"])
                    rest = "".join("".join(c["c"] for c in s["chars"]) for s in spans[1:])
                    cur_lines = [rest]
                else:
                    cur_lines.append(full_line)

    if cur_header is not None:
        raw_sections.append((cur_header, cur_lines))

    return raw_sections


def join_wrapped_lines(lines: list[str]) -> str:
    """Join PDF visual lines cleanly, preserving hyphenated words broken across lines (e.g. 'full-\\ntime')."""
    merged = ""
    for piece in lines:
        if not merged:
            merged = piece
            continue
        if merged.rstrip(" ").endswith("-") and not merged.endswith(" -"):
            merged = merged.rstrip(" ") + piece.lstrip(" ")
        else:
            merged = merged + " " + piece
    return merged


def build_words() -> list[dict]:
    raw_sections = extract_raw_categories(PDF_PATH)
    assert len(raw_sections) == len(CANONICAL_CATEGORIES), (
        f"Expected {len(CANONICAL_CATEGORIES)} categories, got {len(raw_sections)}"
    )

    words: list[dict] = []

    for idx, ((cat_id, cat_name), (raw_header, raw_lines)) in enumerate(
        zip(CANONICAL_CATEGORIES, raw_sections)
    ):
        clean_header_probe = raw_header.strip().rstrip(":").strip().lower()
        assert clean_header_probe == cat_name.lower(), (
            f"Category mismatch at index {idx}: PDF={raw_header!r} vs Spec={cat_name!r}"
        )

        joined = join_wrapped_lines(raw_lines)
        # Normalize Unicode ligatures (e.g. U+FB01 'ﬁ' in 'proﬁciency'), smart apostrophes, Arabic commas
        joined = unicodedata.normalize("NFKC", joined)
        joined = joined.replace("\u2019", "'").replace("\u2018", "'")
        joined = joined.replace("\u060c", ",")

        raw_items = [re.sub(r"\s+", " ", part).strip(" .") for part in joined.split(",")]
        raw_items = [item for item in raw_items if item]

        expanded_items: list[str] = []
        for item in raw_items:
            if (cat_id, item) in SPLIT_OVERRIDES:
                expanded_items.extend(SPLIT_OVERRIDES[(cat_id, item)])
            else:
                expanded_items.append(item)

        seen_in_cat: set[str] = set()
        for item in expanded_items:
            # Apply explicit overrides first
            text = TEXT_OVERRIDES.get((cat_id, item), item)

            # Enforce normalization of casing rules
            if text in PRESERVE_EXACT_CASE:
                pass
            elif cat_id in PRESERVE_CASE_CATEGORIES:
                if text.lower() in LOWERCASE_IN_PROPER_CATEGORIES:
                    text = text.lower()
            else:
                text = text.lower()

            word_id = slugify(text)
            assert word_id, f"Empty word_id generated from {text!r}"

            # Deduplicate within category
            if word_id in seen_in_cat:
                continue
            seen_in_cat.add(word_id)

            entry: dict = {
                "id": word_id,
                "text": text,
                "category": cat_id,
            }
            if text in ALT_VARIANTS:
                entry["alt"] = ALT_VARIANTS[text]
            if text in HINTS:
                entry["hint"] = HINTS[text]

            words.append(entry)

    # Validation checks
    id_to_texts: dict[str, set[str]] = defaultdict(set)
    for w in words:
        # Pure ASCII check on canonical `text` so every character is directly typeable on standard keyboards
        non_ascii = [c for c in w["text"] if ord(c) > 127]
        assert not non_ascii, f"Non-ASCII chars in canonical text {w['text']!r}: {non_ascii}"
        id_to_texts[w["id"]].add(w["text"])

    # Ensure zero accidental ID collisions between two different words
    collisions = {wid: txts for wid, txts in id_to_texts.items() if len(txts) > 1}
    assert not collisions, f"Unintended ID collisions found: {collisions}"

    return words


def main() -> None:
    words = build_words()
    OUTPUT_JSON.write_text(
        json.dumps(words, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    unique_ids = {w["id"] for w in words}
    by_cat = Counter(w["category"] for w in words)
    with_alt = sum(1 for w in words if "alt" in w)
    with_hint = sum(1 for w in words if "hint" in w)
    id_counts = Counter(w["id"] for w in words)
    shared = {wid: cnt for wid, cnt in id_counts.items() if cnt > 1}

    print(f"Wrote {OUTPUT_JSON}")
    print(f"Total category entries : {len(words)}")
    print(f"Unique word IDs        : {len(unique_ids)}")
    print(f"Categories count       : {len(by_cat)}")
    print(f"Entries with `alt`     : {with_alt}")
    print(f"Entries with `hint`    : {with_hint}")
    print(f"Shared cross-category  : {shared}")
    print("\nPer-category counts:")
    for idx, (cat_id, cat_name) in enumerate(CANONICAL_CATEGORIES, 1):
        print(f"  {idx:2d}. {cat_name:34s} ({cat_id}): {by_cat[cat_id]}")


if __name__ == "__main__":
    main()
