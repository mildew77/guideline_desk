#!/usr/bin/env python3
"""Write text from an official Freddie Mac Guide PDF as JSON lines, one record per page."""

import json
import re
import sys

from pypdf import PdfReader


def flatten(items):
    result = []
    for item in items:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


if len(sys.argv) != 3:
    raise SystemExit('Usage: extract-full-freddie.py guide.pdf output.jsonl')

reader = PdfReader(sys.argv[1])
sections = []
pattern = re.compile(r'^(\d{4}\.\d+(?:\.\d+)?):\s*(.*)$')
for item in flatten(reader.outline):
    title = str(item.get('/Title', ''))
    match = pattern.match(title)
    if match:
        try:
            page_number = reader.get_destination_page_number(item)
        except (KeyError, TypeError):
            continue
        if page_number is not None:
            sections.append((page_number, match.group(1), title))
sections.sort()

with open(sys.argv[2], 'w', encoding='utf-8') as output:
    current = None
    index = 0
    for page_number, page in enumerate(reader.pages):
        while index < len(sections) and sections[index][0] <= page_number:
            current = sections[index]
            index += 1
        if current is None:
            continue
        text = re.sub(r'\s+', ' ', page.extract_text() or '').strip()
        if len(text) < 250:
            continue
        output.write(json.dumps({
            'section_id': current[1], 'section_title': current[2],
            'page': page_number + 1, 'content': text
        }) + '\n')
        if page_number % 100 == 0:
            print(f'Extracted page {page_number + 1}/{len(reader.pages)}', flush=True)
