#!/usr/bin/env python3
"""
Verify Klimarådet status report URL and PDF; download PDF for audit trail.
Updates lastChecked in data/klimaraadet/statusrapport-2026.json (curated; no PDF text parsing).
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
BASE = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
JSON_PATH = os.path.join(BASE, "data", "klimaraadet", "statusrapport-2026.json")
USER_AGENT = "TrepartTracker/1.0 (+https://github.com)"


def _get(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def _http_ok(url: str) -> bool:
    try:
        _get(url)
        return True
    except (urllib.error.HTTPError, urllib.error.URLError, OSError):
        return False


def _looks_like_pdf_url(url: str) -> bool:
    path = urllib.parse.urlparse(url).path.lower()
    return path.endswith(".pdf")


class _PdfLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.pdf_urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        d = {k: (v or "") for k, v in attrs if k in ("href", "download")}
        href = d.get("href", "")
        if not href:
            return
        if re.search(r"\.pdf(\?|$|#)?", href, re.I):
            self.pdf_urls.append(href)
        if d.get("download", "").lower().endswith(".pdf"):
            self.pdf_urls.append(href)


def _resolve_pdf_url(page_url: str) -> str | None:
    try:
        body = _get(page_url)
    except (urllib.error.URLError, OSError) as e:
        print(f"  ⚠ Could not read report page: {e}")
        return None
    p = _PdfLinkParser()
    try:
        p.feed(body.decode("utf-8", errors="replace"))
    except Exception:
        return None
    for href in p.pdf_urls:
        if href.startswith("/"):
            return urllib.parse.urljoin(page_url, href)
        if href.startswith("http"):
            return href
    return None


def _download(pdf_url: str, out_path: str) -> None:
    data = _get(pdf_url)
    if not data.startswith(b"%PDF"):
        raise ValueError(f"URL did not return PDF bytes: {pdf_url}")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(data)


def main() -> None:
    if not os.path.isfile(JSON_PATH):
        print(f"⚠ {JSON_PATH} missing — run manual curation first.")
        return

    with open(JSON_PATH, encoding="utf-8") as f:
        doc = json.load(f)
    meta = doc.get("_meta") or {}
    page_url = meta.get("sourcePageUrl") or doc.get("url", "")
    if not page_url or not _http_ok(page_url):
        print("⚠ Report page not reachable; skipping PDF step.")
    else:
        print(f"  ✓ Page OK: {page_url}")
    source_pdf = meta.get("sourcePdfUrl")
    if source_pdf and not _looks_like_pdf_url(source_pdf):
        print(f"  ⚠ Ignoring non-PDF sourcePdfUrl: {source_pdf}")
        source_pdf = None
    if not source_pdf and page_url:
        source_pdf = _resolve_pdf_url(page_url)
    if not source_pdf:
        print("  (No direct PDF link in JSON; attempt discovery from page HTML…)")
        source_pdf = _resolve_pdf_url(page_url) if page_url else None
    if source_pdf:
        print(f"  → PDF: {source_pdf}")
        if _http_ok(source_pdf):
            out_pdf = os.path.join(
                os.path.dirname(JSON_PATH), "statusrapport-2026.pdf"
            )
            try:
                _download(source_pdf, out_pdf)
                print(f"  ✓ Downloaded: {out_pdf} ({os.path.getsize(out_pdf) // 1024} KB)")
            except ValueError as e:
                print(f"  ⚠ {e}")
                source_pdf = None
        else:
            print("  ⚠ PDF URL not HTTP 200")
    else:
        print("  (No PDF URL found — _meta.sourcePdfUrl can be set manually)")

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    m = doc.get("_meta") or {}
    if page_url:
        m["sourcePageUrl"] = page_url
    m["lastChecked"] = now
    if source_pdf:
        m["sourcePdfUrl"] = source_pdf
    doc["_meta"] = m
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"  ✓ lastChecked in JSON → {now}")


if __name__ == "__main__":
    main()
