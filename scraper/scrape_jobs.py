#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════╗
║        wadifatuk.com — Job Scraper  v2.0 (Production)       ║
║        Source : https://www.ewdifh.com/                     ║
║        Target : Supabase  jobs  table                       ║
║        Selectors verified: 2026-06-23                       ║
╚══════════════════════════════════════════════════════════════╝

Pipeline (exact mirror of manual admin panel flow):
  1.  Fetch homepage → parse listing cards (confirmed selectors)
  2.  For each new job → fetch detail page → extract full description,
      apply_url, category, deadline, locations
  3.  Download logo → resize → convert to Base64 data-URI (stored as TEXT)
  4.  Check deduplication log (seen_jobs.json) — skip duplicates
  5.  POST job JSON to Supabase REST API  (same as sbAddJob in JS)
  6.  POST to /push/send.php with X-Admin-Token  (same as sendPushNotification in JS)
  7.  Commit seen_jobs.json back to Git via GitHub Actions

Requirements:
  pip install cloudscraper requests beautifulsoup4 Pillow lxml
"""

import os
import json
import hashlib
import base64
import logging
import time
import re
from datetime import date, datetime
from pathlib import Path
from io import BytesIO
from typing import Optional

import cloudscraper
import requests

# ══════════════════════════════════════════════════════════════
# CONFIGURATION  —  All secrets via environment / GitHub Secrets
# ══════════════════════════════════════════════════════════════
SUPABASE_URL      = os.environ.get("SUPABASE_URL",      "https://zkelkmfxjobrsnvyaanv.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SITE_URL          = os.environ.get("SITE_URL",          "https://www.wadifatuk.com")

# Admin-token computation  — mirrors config.php exactly:
# define('ADMIN_TOKEN', 'wdf_adm_' . hash('sha256', 'Aajrymah@4431_' . VAPID_PUBLIC_KEY));
_VAPID  = "BAbfIgT3scWQH_IEbwfpbI36F3hABqKzc-3MkdihomtgfSUF7-5qSNHfedXTrdIh2wJgFUliozHPsoX8lcy30Vs"
ADMIN_TOKEN = "wdf_adm_" + hashlib.sha256(("Aajrymah@4431_" + _VAPID).encode()).hexdigest()

SCRAPE_URL     = "https://www.ewdifh.com/"
SEEN_JOBS_FILE = Path(__file__).parent / "seen_jobs.json"
MAX_LOGO_BYTES = 2 * 1024 * 1024   # 2 MB
MIN_DESC_WORDS = 30
REQUEST_DELAY  = 2.0   # seconds between detail-page fetches (be polite)

# ══════════════════════════════════════════════════════════════
# LOGGING
# ══════════════════════════════════════════════════════════════
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-7s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).parent / "scraper.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("wadifatuk")

# ══════════════════════════════════════════════════════════════
# CATEGORY MAP  (ewdifh category slug → wadifatuk category)
# ══════════════════════════════════════════════════════════════
# Maps the URL slug from  href="/category/XYZ"  on the detail page
EWDIFH_CAT_MAP: dict[str, tuple[str, str]] = {
    "government-jobs":  ("government",   "وظائف حكومية"),
    "civil-jobs":       ("government",   "وظائف حكومية"),
    "military-jobs":    ("military",     "وظائف عسكرية"),
    "corporate-jobs":   ("corporate",    "وظائف شركات"),
    "medical":          ("medical",      "طبية وصحية"),
    "engineering":      ("engineering",  "هندسة وتقنية"),
    "education":        ("education",    "تعليم وتدريب"),
    "finance":          ("finance",      "مالية ومحاسبة"),
    "it":               ("it",           "تقنية المعلومات"),
    "sales":            ("sales",        "مبيعات وتسويق"),
    "admin":            ("admin",        "إدارة وسكرتارية"),
    "construction":     ("construction", "إنشاء ومقاولات"),
    "hospitality":      ("hospitality",  "فندقة وضيافة"),
    "all-jobs":         ("other",        "أخرى"),
}

# Keyword fallback (scans full text)
CATEGORY_KEYWORDS: dict[str, tuple[str, str]] = {
    "حكوم":   ("government",   "وظائف حكومية"),
    "عسكر":   ("military",     "وظائف عسكرية"),
    "مدني":   ("government",   "وظائف حكومية"),
    "طب":     ("medical",      "طبية وصحية"),
    "صح":     ("medical",      "طبية وصحية"),
    "هندس":   ("engineering",  "هندسة وتقنية"),
    "تقني":   ("engineering",  "هندسة وتقنية"),
    "تعليم":  ("education",    "تعليم وتدريب"),
    "تدريب":  ("education",    "تعليم وتدريب"),
    "مال":    ("finance",      "مالية ومحاسبة"),
    "محاسب":  ("finance",      "مالية ومحاسبة"),
    "برمج":   ("it",           "تقنية المعلومات"),
    "مبيع":   ("sales",        "مبيعات وتسويق"),
    "تسويق":  ("sales",        "مبيعات وتسويق"),
    "إدار":   ("admin",        "إدارة وسكرتارية"),
    "سكرتار": ("admin",        "إدارة وسكرتارية"),
    "إنشاء":  ("construction", "إنشاء ومقاولات"),
    "مقاول":  ("construction", "إنشاء ومقاولات"),
    "فندق":   ("hospitality",  "فندقة وضيافة"),
    "شركة":   ("corporate",    "وظائف شركات"),
}

# ══════════════════════════════════════════════════════════════
# CITY MAP  (keyword in text → wadifatuk city slug)
# ══════════════════════════════════════════════════════════════
CITY_KEYWORDS: dict[str, tuple[str, str]] = {
    "رياض":    ("region-riyadh",   "منطقة الرياض"),
    "مكة":     ("region-makkah",   "منطقة مكة المكرمة"),
    "جدة":     ("region-makkah",   "منطقة مكة المكرمة"),
    "طائف":    ("region-makkah",   "منطقة مكة المكرمة"),
    "شرقي":    ("region-eastern",  "المنطقة الشرقية"),
    "دمام":    ("region-eastern",  "المنطقة الشرقية"),
    "الخبر":   ("region-eastern",  "المنطقة الشرقية"),
    "ظهران":   ("region-eastern",  "المنطقة الشرقية"),
    "مدين":    ("region-madinah",  "منطقة المدينة المنورة"),
    "قصيم":    ("region-qassim",   "منطقة القصيم"),
    "بريدة":   ("region-qassim",   "منطقة القصيم"),
    "عسير":    ("region-asir",     "منطقة عسير"),
    "أبها":    ("region-asir",     "منطقة عسير"),
    "خميس":    ("region-asir",     "منطقة عسير"),
    "تبوك":    ("region-tabuk",    "منطقة تبوك"),
    "حائل":    ("region-hail",     "منطقة حائل"),
    "جازان":   ("region-jizan",    "منطقة جازان"),
    "نجران":   ("region-najran",   "منطقة نجران"),
    "باحة":    ("region-bahah",    "منطقة الباحة"),
    "جوف":     ("region-jawf",     "منطقة الجوف"),
    "المملكة": ("all-cities",      "جميع المناطق"),
    "بالمملكة":("all-cities",      "جميع المناطق"),
    "مدن":     ("all-cities",      "جميع المناطق"),
}

def classify_category_from_slug(slug: str) -> tuple[str, str]:
    return EWDIFH_CAT_MAP.get(slug, ("other", "أخرى"))

def classify_category_from_text(text: str) -> tuple[str, str]:
    for kw, result in CATEGORY_KEYWORDS.items():
        if kw in text:
            return result
    return ("other", "أخرى")

def classify_city(text: str) -> tuple[str, str]:
    for kw, result in CITY_KEYWORDS.items():
        if kw in text:
            return result
    return ("all-cities", "جميع المناطق")

# ══════════════════════════════════════════════════════════════
# DEDUPLICATION
# ══════════════════════════════════════════════════════════════
def load_seen() -> set:
    if not SEEN_JOBS_FILE.exists():
        return set()
    try:
        data = json.loads(SEEN_JOBS_FILE.read_text(encoding="utf-8"))
        return set(data.get("seen", []))
    except Exception:
        return set()

def save_seen(seen: set) -> None:
    SEEN_JOBS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SEEN_JOBS_FILE.write_text(
        json.dumps({"seen": sorted(seen), "updated_at": datetime.utcnow().isoformat()},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

def fingerprint(title: str, company: str) -> str:
    raw = f"{title.strip().lower()}|{company.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]

# ══════════════════════════════════════════════════════════════
# LOGO — download & convert to Base64 data-URI
# ══════════════════════════════════════════════════════════════
def logo_to_base64(logo_url: str, session) -> str:
    """
    Mirrors the admin panel's FileReader.readAsDataURL() behaviour.
    The `logo` column in Supabase stores the full  data:image/png;base64,...  string.
    Falls back to '🏢' emoji on any error.
    """
    if not logo_url or not logo_url.startswith("http"):
        return "🏢"
    try:
        r = session.get(logo_url, timeout=10, stream=True)
        r.raise_for_status()
        mime = r.headers.get("Content-Type", "image/png").split(";")[0].strip()
        if not mime.startswith("image/"):
            return "🏢"

        raw = b""
        for chunk in r.iter_content(8192):
            raw += chunk
            if len(raw) > MAX_LOGO_BYTES:
                log.warning("Logo too large (>2 MB) — using 🏢 fallback")
                return "🏢"

        # Resize to max 256×256 via Pillow (keeps base64 small in DB)
        try:
            from PIL import Image
            img = Image.open(BytesIO(raw))
            img.thumbnail((256, 256))
            buf = BytesIO()
            fmt = (img.format or "PNG").upper()
            img.save(buf, format=fmt)
            raw  = buf.getvalue()
            mime = f"image/{fmt.lower()}"
        except ImportError:
            pass
        except Exception as e:
            log.debug("Pillow resize skipped: %s", e)

        return f"data:{mime};base64,{base64.b64encode(raw).decode()}"

    except Exception as e:
        log.warning("Logo download failed (%s): %s", logo_url, e)
        return "🏢"

# ══════════════════════════════════════════════════════════════
# SCRAPING — homepage listing
# ══════════════════════════════════════════════════════════════
def build_scraper() -> cloudscraper.CloudScraper:
    s = cloudscraper.create_scraper(browser={"browser": "chrome", "platform": "windows", "desktop": True})
    s.headers.update({
        "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://www.google.com/",
    })
    return s

def fetch_listing(scraper) -> list[dict]:
    """
    Fetch ewdifh.com homepage and parse all job cards.

    Verified DOM structure (2026-06-23):
      <div class="bg-white rounded-md shadow p-3 w-full">
        <img class="logo-org ..."  src="https://www.ewdifh.com/uploads/...">
        <a href="https://www.ewdifh.com/jobs/NNNNN">Job title</a>
        <a href="https://www.ewdifh.com/job/org/NNN">Company name</a>
      </div>
    """
    from bs4 import BeautifulSoup

    log.info("Fetching homepage: %s", SCRAPE_URL)
    r = scraper.get(SCRAPE_URL, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    cards = soup.select("div.bg-white.rounded-md.shadow.p-3.w-full")
    if not cards:
        # fallback: any div containing an img.logo-org
        cards = list({img.find_parent("div") for img in soup.select("img.logo-org") if img.find_parent("div")})
    log.info("Found %d job cards on homepage", len(cards))

    results = []
    for card in cards:
        # Logo
        logo_el  = card.select_one("img.logo-org")
        logo_url = logo_el.get("src", "") if logo_el else ""
        if logo_url and not logo_url.startswith("http"):
            logo_url = "https://www.ewdifh.com" + logo_url

        # Title & source URL
        title_el   = card.select_one("a[href*='/jobs/']")
        title      = title_el.get_text(strip=True) if title_el else ""
        source_url = ""
        if title_el:
            href = title_el.get("href", "")
            source_url = href if href.startswith("http") else "https://www.ewdifh.com" + href

        # Company
        org_el  = card.select_one("a[href*='/job/org/']")
        company = org_el.get_text(strip=True) if org_el else ""
        if not company and logo_el:
            company = logo_el.get("alt", "").strip()
        if not company and title:
            parts = title.split(" تعلن")
            company = parts[0].strip() if len(parts) > 1 else title

        if not source_url:
            continue

        results.append({
            "title":      title,
            "company":    company or title,
            "logo_url":   logo_url,
            "source_url": source_url,
        })

    return results

# ══════════════════════════════════════════════════════════════
# SCRAPING — job detail page
# ══════════════════════════════════════════════════════════════
def fetch_detail(url: str, scraper) -> dict:
    """
    Fetch /jobs/NNNNN and extract:
      - description   (div.card-body > div > p tags → joined)
      - apply_url     (last <a> in card-body that is an external link)
      - category_slug (from  a[href*='/category/']  in the badge bar)
      - deadline      (from  meta property="article:published_time"  + validThrough in JSON-LD)
      - city_text     (all location keywords found in description)

    Verified against live page /jobs/85473 on 2026-06-23.
    """
    detail: dict = {
        "description":    "",
        "apply_url":      "#",
        "category_slug":  "",
        "deadline":       None,
        "city_text":      "",
    }
    try:
        from bs4 import BeautifulSoup
        time.sleep(REQUEST_DELAY)
        r = scraper.get(url, timeout=25)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        # ── Description ──────────────────────────────────────
        # Verified selector: div.card-body > div > p elements
        body_div = soup.select_one("div.card-body")
        if body_div:
            paragraphs = body_div.select("p")
            # Strip ad-injected <ins> content
            for ad in body_div.select("ins, script, .adsbygoogle"):
                ad.decompose()
            desc_parts = [p.get_text(" ", strip=True) for p in paragraphs if p.get_text(strip=True)]
            detail["description"] = "\n\n".join(desc_parts)

            # ── Apply URL ──────────────────────────────────────
            # Last external <a> in card-body (e.g. LinkedIn / Jadara link)
            external_links = [
                a.get("href", "")
                for a in body_div.select("a[href]")
                if a.get("href", "").startswith("http")
                   and "ewdifh.com" not in a.get("href", "")
                   and "whatsapp" not in a.get("href", "")
                   and "telegram" not in a.get("href", "")
                   and "twitter" not in a.get("href", "")
                   and "snapchat" not in a.get("href", "")
            ]
            if external_links:
                detail["apply_url"] = external_links[-1]

        # ── Category slug ──────────────────────────────────────
        # Verified selector: small colored bar contains  a[href*='/category/']
        cat_el = soup.select_one("a[href*='/category/']")
        if cat_el:
            href = cat_el.get("href", "")
            slug = href.rstrip("/").split("/")[-1]
            detail["category_slug"] = slug

        # ── Deadline ───────────────────────────────────────────
        # JSON-LD contains  "validThrough": "YYYY-MM-DD"
        ld_tag = soup.find("script", type="application/ld+json")
        if ld_tag:
            try:
                ld = json.loads(ld_tag.string)
                vt = ld.get("validThrough", "")
                if vt and len(vt) >= 10:
                    detail["deadline"] = vt[:10]
            except Exception:
                pass

        # ── City text (from full description) ─────────────────
        detail["city_text"] = detail["description"] + " " + (soup.find("h1") or soup.new_tag("h1")).get_text()

    except Exception as e:
        log.warning("Detail fetch failed for %s: %s", url, e)

    return detail

# ══════════════════════════════════════════════════════════════
# BUILD SUPABASE JOB PAYLOAD
# ══════════════════════════════════════════════════════════════
def build_payload(listing: dict, detail: dict, logo_b64: str) -> dict:
    """
    Constructs the exact JSON body expected by Supabase /rest/v1/jobs.
    Field names are snake_case as per the DB schema.
    Mirrors saveJobForm() → jobData object in admin.js  L331-L353.
    """
    title   = listing["title"].strip()
    company = listing["company"].strip()

    # Category: prefer explicit slug from detail page, fallback to keyword scan
    if detail["category_slug"]:
        cat_id, cat_name = classify_category_from_slug(detail["category_slug"])
    else:
        cat_id, cat_name = classify_category_from_text(title + " " + detail["description"])

    # City
    city_id, city_name = classify_city(detail["city_text"] or title)

    # Description — ensure ≥30 words (AdSense policy)
    desc = detail["description"].strip()
    if not desc:
        desc = title
    if len(desc.split()) < MIN_DESC_WORDS:
        desc += (
            f"\n\nللاطلاع على تفاصيل هذه الوظيفة كاملةً والتقديم عليها، "
            f"يُرجى زيارة الرابط الأصلي للإعلان. "
            f"تُعدّ هذه الفرصة في مجال {cat_name} بـ{city_name} من الفرص المميزة "
            f"التي يُنصح بالإسراع في التقديم عليها قبل انتهاء الموعد المحدد. "
            f"نتمنى لجميع المتقدمين التوفيق والنجاح في مسيرتهم المهنية."
        )

    # Deadline — use from detail; if in the past, set None
    deadline = detail.get("deadline")
    if deadline:
        try:
            if date.fromisoformat(deadline) < date.today():
                deadline = None
        except ValueError:
            deadline = None

    return {
        "title":         title,
        "company":       company,
        "logo":          logo_b64,
        "city":          city_id,
        "city_name":     city_name,
        "category":      cat_id,
        "category_name": cat_name,
        "type":          "fulltime",
        "type_name":     "دوام كامل",
        "salary":        "",
        "experience":    "",
        "gender":        "للجنسين",
        "status":        "active",
        "education":     "",
        "description":   desc,
        "requirements":  [],
        "benefits":      [],
        "tags":          [cat_name],
        "apply_url":     detail.get("apply_url") or listing.get("source_url") or "#",
        "badge":         "new",
        "featured":      False,
        "deadline":      deadline,
        "posted_date":   date.today().isoformat(),
    }

# ══════════════════════════════════════════════════════════════
# SUPABASE INSERT
# ══════════════════════════════════════════════════════════════
def insert_job(payload: dict) -> Optional[dict]:
    """
    POST to Supabase REST API — exact replica of sbAddJob() in supabase-config.js.
    Returns the inserted row (with DB-assigned id) or None on failure.
    """
    url = f"{SUPABASE_URL}/rest/v1/jobs"
    headers = {
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation",
    }
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=20)
        r.raise_for_status()
        data = r.json()
        row  = data[0] if isinstance(data, list) else data
        log.info("✅ Inserted → id=%s  company=%s", row.get("id"), payload["company"])
        return row
    except requests.HTTPError as e:
        log.error("❌ Supabase insert failed (HTTP %s): %s", e.response.status_code, e.response.text[:300])
    except Exception as e:
        log.error("❌ Supabase insert error: %s", e)
    return None

# ══════════════════════════════════════════════════════════════
# PUSH NOTIFICATION
# ══════════════════════════════════════════════════════════════
def fire_push(row: dict) -> None:
    """
    POST to /push/send.php — exact replica of sendPushNotification() in admin.js  L927-L954.
    Uses the same ADMIN_TOKEN computed from SHA-256 of the raw secret string.
    """
    push_url = f"{SITE_URL}/push/send.php"
    body = row.get("company", "")
    if row.get("category_name"):
        body += f" — {row['category_name']}"
    if row.get("city_name"):
        body += f" — {row['city_name']}"

    payload = {
        "title": "وظيفتك 💼 — وظيفة جديدة",
        "body":  body,
        "url":   "/jobs.html",
        "tag":   f"wadifatuk-job-{row.get('id', int(time.time()))}",
    }
    try:
        r = requests.post(
            push_url,
            headers={"Content-Type": "application/json", "X-Admin-Token": ADMIN_TOKEN},
            json=payload,
            timeout=20,
        )
        r.raise_for_status()
        # strip UTF-8 BOM that send.php may prepend before JSON
        raw_text = r.content.decode("utf-8-sig").strip()
        res = json.loads(raw_text) if raw_text else {}
        sent  = res.get("sent", 0)
        total = res.get("total", 0)
        if res.get("ok") and sent > 0:
            log.info("📲 Push sent → %d/%d subscribers", sent, total)
        elif res.get("ok") and total == 0:
            log.info("📲 Push triggered — no subscribers yet")
        else:
            log.warning("⚠️ Push response: %s", res)
    except requests.HTTPError as e:
        log.error("❌ Push HTTP %s: %s", e.response.status_code, e.response.text[:200])
    except Exception as e:
        log.error("❌ Push error (non-fatal): %s", e)

# ══════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════
def main():
    log.info("━" * 60)
    log.info("wadifatuk Scraper  v2.0  —  %s UTC", datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
    log.info("━" * 60)

    if not SUPABASE_ANON_KEY:
        log.error("SUPABASE_ANON_KEY is not set — aborting.")
        raise SystemExit(1)

    seen    = load_seen()
    scraper = build_scraper()

    # ── 1. Fetch listing ──────────────────────────────────────
    try:
        listings = fetch_listing(scraper)
    except Exception as e:
        log.error("Failed to fetch listing page: %s", e)
        raise SystemExit(1)

    if not listings:
        log.warning("No listings found — nothing to do.")
        return

    # ── 2. Process each listing ───────────────────────────────
    new_count = skipped = errors = 0

    for i, item in enumerate(listings, 1):
        src_url = item["source_url"]
        fp      = fingerprint(item["title"], item["company"])
        dedup   = src_url or fp

        if dedup in seen or fp in seen:
            log.info("[%d/%d] SKIP  %s", i, len(listings), item["company"])
            skipped += 1
            continue

        log.info("[%d/%d] NEW   %s | %s", i, len(listings), item["company"], item["title"][:50])

        # ── 2a. Fetch detail page ─────────────────────────────
        detail = fetch_detail(src_url, scraper)

        # ── 2b. Download & base64 logo ────────────────────────
        logo_b64 = logo_to_base64(item["logo_url"], scraper)

        # ── 2c. Build Supabase payload ────────────────────────
        payload = build_payload(item, detail, logo_b64)

        # ── 2d. Insert into Supabase ──────────────────────────
        row = insert_job(payload)
        if row is None:
            errors += 1
            continue

        # ── 2e. Mark seen immediately (before push) ───────────
        seen.add(dedup)
        seen.add(fp)
        save_seen(seen)

        # ── 2f. Fire push notification ────────────────────────
        fire_push(row)
        new_count += 1

        # Small delay — respect the server
        time.sleep(1.0)

    # ── 3. Summary ────────────────────────────────────────────
    log.info("━" * 60)
    log.info("Done ✓  new=%d  skipped=%d  errors=%d", new_count, skipped, errors)
    log.info("━" * 60)


# ══════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys
    if "--debug-html" in sys.argv:
        # Dump homepage HTML for selector debugging
        s = build_scraper()
        html = s.get(SCRAPE_URL, timeout=30).text
        out  = Path(__file__).parent / "debug_ewdifh.html"
        out.write_text(html, encoding="utf-8")
        print(f"[debug] HTML saved -> {out}  ({len(html):,} bytes)")
    else:
        main()
