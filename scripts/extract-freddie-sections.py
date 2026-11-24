#!/usr/bin/env python3
"""Extract selected Freddie Mac Guide sections from an official Guide PDF."""

import json
import re
import sys

from pypdf import PdfReader


SECTION_IDS = ("5501.2", "5501.4", "5304.1")


def normalized(text):
    return re.sub(r"\s+", " ", text).strip()


def flattened_outline(items):
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(flattened_outline(item))
        else:
            result.append(item)
    return result


def find_section_starts(reader):
    starts = {}
    for item in flattened_outline(reader.outline):
        title = str(item.get("/Title", ""))
        for section_id in SECTION_IDS:
            if title.startswith(f"{section_id}:"):
                starts[section_id] = reader.get_destination_page_number(item)
    return starts


def section_text(reader, section_id, page_number):
    pages = []
    next_heading = re.compile(r"(?:^|\n)\s*\d{4}\.\d+(?:\.\d+)?\s*:")
    start_heading = re.compile(rf"(?:^|\n)\s*{re.escape(section_id)}\s*:")
    for index in range(page_number, min(page_number + 40, len(reader.pages))):
        text = reader.pages[index].extract_text() or ""
        if index == page_number:
            match = start_heading.search(text)
            if not match:
                raise ValueError(f"Could not find {section_id} at page {page_number + 1}")
            text = text[match.start():]
        elif next_heading.search(text):
            text = text[: next_heading.search(text).start()]
            pages.append(text)
            break
        pages.append(text)
    return normalized("\n".join(pages))


if len(sys.argv) != 2:
    raise SystemExit("Usage: extract-freddie-sections.py /path/to/freddie-guide.pdf")

reader = PdfReader(sys.argv[1])
starts = find_section_starts(reader)
result = {}
for section_id in SECTION_IDS:
    page_number = starts.get(section_id)
    if page_number is None:
        raise ValueError(f"Could not locate the Guide body for {section_id}")
    result[section_id] = {"page": page_number + 1, "text": section_text(reader, section_id, page_number)}

print(json.dumps(result))
