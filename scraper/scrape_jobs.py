#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════╗
║        wadifatuk.com — Job Scraper  v4.0 (Production)       ║
║        Source : https://www.ewdifh.com/                     ║
║        Target : Supabase  jobs  table                       ║
║        Format : HTML structured description                 ║
║        Selectors verified: 2026-06-23                       ║
╚══════════════════════════════════════════════════════════════╝

Pipeline:
  1.  Fetch homepage → parse listing cards
  2.  For each new job → fetch detail page → extract full description,
      apply_url, category, deadline, locations
  3.  Download logo → resize → convert to Base64 data-URI
  4.  Multi-layer deduplication (7 layers)
  5.  POST job JSON to Supabase REST API
  6.  POST to /push/send.php with X-Admin-Token
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
# CONFIGURATION
# ══════════════════════════════════════════════════════════════
SUPABASE_URL      = os.environ.get("SUPABASE_URL",      "https://zkelkmfxjobrsnvyaanv.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SITE_URL          = os.environ.get("SITE_URL",          "https://www.wadifatuk.com")

# Admin-token computation — mirrors config.php exactly
_VAPID  = "BAbfIgT3scWQH_IEbwfpbI36F3hABqKzc-3MkdihomtgfSUF7-5qSNHfedXTrdIh2wJgFUliozHPsoX8lcy30Vs"
ADMIN_TOKEN = "wdf_adm_" + hashlib.sha256(("Aajrymah@4431_" + _VAPID).encode()).hexdigest()

SCRAPE_URL     = "https://www.ewdifh.com/"
SEEN_JOBS_FILE = Path(__file__).parent / "seen_jobs.json"
MAX_LOGO_BYTES = 2 * 1024 * 1024   # 2 MB
MIN_DESC_WORDS = 30
REQUEST_DELAY  = 2.0   # seconds between detail-page fetches

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
# INTERNAL CATEGORIES — single source of truth
# Must match data.js CATEGORIES array exactly
# ══════════════════════════════════════════════════════════════
VALID_CATEGORIES: dict[str, str] = {
    "government":   "وظائف حكومية",
    "military":     "وظائف عسكرية",
    "corporate":    "وظائف شركات",
    "medical":      "طبية وصحية",
    "engineering":  "هندسة وتقنية",
    "education":    "تعليم وتدريب",
    "finance":      "مالية ومحاسبة",
    "it":           "تقنية المعلومات",
    "sales":        "مبيعات وتسويق",
    "admin":        "إدارة وسكرتارية",
    "construction": "إنشاء ومقاولات",
    "hospitality":  "فندقة وضيافة",
    "qiyas":        "اختبارات قياس",
    "other":        "أخرى",
}

# ══════════════════════════════════════════════════════════════
# CATEGORY MAP (ewdifh URL slug → internal category)
# NOTE: Generic slugs like "all-jobs" / "jobs" are intentionally
# NOT mapped here — they fall through to keyword classification.
# ══════════════════════════════════════════════════════════════
EWDIFH_CAT_MAP: dict[str, tuple[str, str]] = {
    # حكومي
    "government-jobs":        ("government",   "وظائف حكومية"),
    "civil-jobs":             ("government",   "وظائف حكومية"),
    "government":             ("government",   "وظائف حكومية"),
    "public-sector":          ("government",   "وظائف حكومية"),
    "ministry":               ("government",   "وظائف حكومية"),
    # عسكري
    "military-jobs":          ("military",     "وظائف عسكرية"),
    "military":               ("military",     "وظائف عسكرية"),
    "security-jobs":          ("military",     "وظائف عسكرية"),
    "police":                 ("military",     "وظائف عسكرية"),
    "armed-forces":           ("military",     "وظائف عسكرية"),
    # طبي
    "medical":                ("medical",      "طبية وصحية"),
    "health":                 ("medical",      "طبية وصحية"),
    "healthcare":             ("medical",      "طبية وصحية"),
    "nursing":                ("medical",      "طبية وصحية"),
    "pharmacy":               ("medical",      "طبية وصحية"),
    # هندسة
    "engineering":            ("engineering",  "هندسة وتقنية"),
    "technical":              ("engineering",  "هندسة وتقنية"),
    "oil-gas":                ("engineering",  "هندسة وتقنية"),
    # تعليم
    "education":              ("education",    "تعليم وتدريب"),
    "teaching":               ("education",    "تعليم وتدريب"),
    "training":               ("education",    "تعليم وتدريب"),
    "academic":               ("education",    "تعليم وتدريب"),
    "schools":                ("education",    "تعليم وتدريب"),
    # مالية
    "finance":                ("finance",      "مالية ومحاسبة"),
    "accounting":             ("finance",      "مالية ومحاسبة"),
    "banking":                ("finance",      "مالية ومحاسبة"),
    # تقنية معلومات
    "it":                     ("it",           "تقنية المعلومات"),
    "information-technology": ("it",           "تقنية المعلومات"),
    "software":               ("it",           "تقنية المعلومات"),
    "technology":             ("it",           "تقنية المعلومات"),
    # مبيعات
    "sales":                  ("sales",        "مبيعات وتسويق"),
    "marketing":              ("sales",        "مبيعات وتسويق"),
    "retail":                 ("sales",        "مبيعات وتسويق"),
    # إدارة
    "admin":                  ("admin",        "إدارة وسكرتارية"),
    "administration":         ("admin",        "إدارة وسكرتارية"),
    "customer-service":       ("admin",        "إدارة وسكرتارية"),
    # إنشاء
    "construction":           ("construction", "إنشاء ومقاولات"),
    "contracting":            ("construction", "إنشاء ومقاولات"),
    "architecture":           ("construction", "إنشاء ومقاولات"),
    # فندقة
    "hospitality":            ("hospitality",  "فندقة وضيافة"),
    "hotel":                  ("hospitality",  "فندقة وضيافة"),
    "tourism":                ("hospitality",  "فندقة وضيافة"),
    "food-beverage":          ("hospitality",  "فندقة وضيافة"),
    # قياس
    "qiyas":                  ("qiyas",        "اختبارات قياس"),
    "exams":                  ("qiyas",        "اختبارات قياس"),
    # شركات — only for explicitly corporate slugs, NOT generic ones
    "corporate-jobs":         ("corporate",    "وظائف شركات"),
    "corporate":              ("corporate",    "وظائف شركات"),
    "private-sector":         ("corporate",    "وظائف شركات"),
    "companies":              ("corporate",    "وظائف شركات"),
    # ═══ REMOVED from map (now falls to keyword rules) ═══
    # "all-jobs" → was ("corporate", ...) — WRONG, now removed
    # "jobs"     → was ("corporate", ...) — WRONG, now removed
}

# ══════════════════════════════════════════════════════════════
# COMPANY WHITELIST — known companies → guaranteed category
# Matched as substring of company name (case-insensitive)
# Add any company that gets mis-classified here.
# ══════════════════════════════════════════════════════════════
COMPANY_WHITELIST: list[tuple[str, str, str]] = [
    # ── تأجير السيارات / النقل ─────────────────────────────
    ("لومي",             "corporate", "وظائف شركات"),
    ("كريم",             "corporate", "وظائف شركات"),
    ("أوبر",             "corporate", "وظائف شركات"),
    ("تدويل",            "corporate", "وظائف شركات"),
    # ── إلكترونيات / تجزئة ─────────────────────────────────
    ("اكسترا",           "corporate", "وظائف شركات"),
    ("extra",            "corporate", "وظائف شركات"),
    ("إكسترا",           "corporate", "وظائف شركات"),
    ("جرير",             "corporate", "وظائف شركات"),
    ("العثيم",           "corporate", "وظائف شركات"),
    ("بنده",             "corporate", "وظائف شركات"),
    ("نستو",             "corporate", "وظائف شركات"),
    ("لولو",             "corporate", "وظائف شركات"),
    ("قصر الأواني",      "corporate", "وظائف شركات"),
    # ── غذاء وأغذية ────────────────────────────────────────
    ("المراعي",          "corporate", "وظائف شركات"),
    ("الوليد للأغذية",   "corporate", "وظائف شركات"),
    # ── مقاولات / إنشاء ────────────────────────────────────
    ("بن لادن",          "construction", "إنشاء ومقاولات"),
    ("بن لاد",           "construction", "إنشاء ومقاولات"),
    # ── تعليم ──────────────────────────────────────────────
    ("الأكاديمية السعودية للتجزئة", "education", "تعليم وتدريب"),
    ("معهد ريادة",       "education", "تعليم وتدريب"),
    ("مسك",              "education", "تعليم وتدريب"),
    ("دار الرواد",       "education", "تعليم وتدريب"),
    # ── تقنية المعلومات ────────────────────────────────────
    ("علم",              "it",        "تقنية المعلومات"),
    ("stc",              "it",        "تقنية المعلومات"),
    ("موبايلي",          "it",        "تقنية المعلومات"),
    ("زين",              "it",        "تقنية المعلومات"),
    # ── حكومي ──────────────────────────────────────────────
    ("هيئة الزكاة",      "government", "وظائف حكومية"),
    ("هيئة تطوير",       "government", "وظائف حكومية"),
    ("وزارة الاتصالات",  "government", "وظائف حكومية"),
    ("وزارة التعليم",    "government", "وظائف حكومية"),
    ("إمارة منطقة",      "government", "وظائف حكومية"),
    ("القدية",           "government", "وظائف حكومية"),
    # ── مالية ──────────────────────────────────────────────
    ("حسن جميل",         "corporate", "وظائف شركات"),
]


def _match_company_whitelist(company: str) -> tuple[str, str] | None:
    """Check company name against known companies. Returns (cat_id, cat_name) or None."""
    company_lower = company.strip().lower()
    for pattern, cat_id, cat_name in COMPANY_WHITELIST:
        if pattern.lower() in company_lower:
            log.debug("[Category] Whitelist match '%s' → %s", pattern, cat_id)
            return (cat_id, cat_name)
    return None


# ══════════════════════════════════════════════════════════════
# CATEGORY KEYWORD RULES
# Order matters: most specific first — first match wins
# NOTE: Rules are applied on title+company first, then on full
# text only if no match is found in title+company.
# ══════════════════════════════════════════════════════════════
CATEGORY_KEYWORD_RULES: list[tuple[list[str], str, str]] = [
    # ── قياس (highest priority — unique terms) ───────────────
    (["قياس", "اختبار قياس", "اختبارات قياس", "تحصيلي",
      "قدرات عامة", "اختبار وطني", "aptis", "ielts"],
     "qiyas", "اختبارات قياس"),

    # ── عسكري ────────────────────────────────────────────────
    (["عسكر", "شرطة", "حرس وطني", "دفاع مدني",
      "قوات مسلحة", "جند", "ضابط", "جيش", "سجون", "مجند",
      "صواريخ", "أمن وطني", "حرس الحدود"],
     "military", "وظائف عسكرية"),

    # ── حكومي ─────────────────────────────────────────────────
    (["حكوم", "حكومي", "وزار", "وزارة", "هيئة", "بلدية",
      "أمانة", "محافظة", "مديرية", "ديوان", "مجلس",
      "برنامج حكومي", "جهة حكومية", "قطاع حكومي", "إمارة",
      "أمانة منطقة", "رئاسة", "مركز حكومي", "صندوق حكومي"],
     "government", "وظائف حكومية"),

    # ── شركات (MOVED UP — before medical to avoid false positives)
    # Applied on title+company text only (not full description)
    (["شركة", "مجموعة", "مؤسسة", "لوجستك",
      "نقل", "شحن", "توصيل", "قطاع خاص", "تأجير السيارات",
      "للسيارات", "للإلكترونيات", "للاستثمار", "للتأمين",
      "للمقاولات", "للخدمات", "للصناعة", "للتجارة"],
     "corporate", "وظائف شركات"),

    # ── طبي وصحي ─────────────────────────────────────────────
    # Using specific full terms instead of fragments to avoid false matches
    (["طبية", "طبي", "مستشفى", "مستشف", "صحة", "صحي",
      "تمريض", "ممرض", "صيدل", "أسنان", "جراح", "طبيب",
      "عيادة", "رعاية صحية", "علاج", "مختبر طبي", "تحاليل طبية",
      "أشعة", "نفسي", "طوارئ", "باثولوج", "صيدلية",
      "مستلزمات طبية", "تجهيزات طبية"],
     "medical", "طبية وصحية"),

    # ── تعليم وتدريب ──────────────────────────────────────────
    (["تعليم", "تعليمي", "مدرس", "معلم", "محاضر", "أستاذ",
      "جامعة", "كلية", "مدرسة", "دبلوم", "ابتعاث", "منح",
      "تطوير الكفاءات", "أكاديمي", "مناهج",
      "معهد", "مركز تدريب", "دورة تدريبية", "تدريب على رأس العمل",
      "أكاديمية", "برنامج تدريبي", "منحة دراسية",
      "تدريب الخريجين", "برنامج الخريجين"],
     "education", "تعليم وتدريب"),

    # ── تقنية المعلومات ───────────────────────────────────────
    (["تقنية المعلومات", "برمج", "مبرمج", "تطوير البرمجيات",
      "software", "python", "java", "react", "ذكاء اصطناعي",
      "أمن المعلومات", "cybersecurity", "شبكات", "سيرفر",
      "cloud", "devops", "fullstack",
      "backend", "frontend", "تطبيق جوال", "ui", "ux",
      "قاعدة بيانات", "نظم معلومات", "الحوسبة",
      "blockchain", "الأمن السيبراني"],
     "it", "تقنية المعلومات"),

    # ── هندسة وتقنية ──────────────────────────────────────────
    (["هندس", "مهندس", "كهرباء", "كهربائي", "ميكانيك",
      "ميكانيكي", "كيمياء", "صناعي", "بترول", "نفط", "غاز",
      "أرامكو", "سابك", "معمار", "مساحة", "جيولوجيا",
      "تبريد", "تكييف", "لحام", "صيانة صناعية",
      "ميناء", "بحري", "طيران هندسة"],
     "engineering", "هندسة وتقنية"),

    # ── مالية ومحاسبة ─────────────────────────────────────────
    (["محاسب", "مالي", "مالية", "تدقيق", "مراجعة حسابات",
      "ضريبة", "زكاة", "استثمار", "بنك", "مصرف", "تأمين",
      "موازنة", "ميزانية", "خزينة", "ائتمان", "cpa", "cma",
      "cfa", "ifrs", "اكتواري", "تمويل"],
     "finance", "مالية ومحاسبة"),

    # ── إنشاء ومقاولات ────────────────────────────────────────
    (["إنشاء", "مقاول", "بناء", "تشييد", "تصميم داخلي",
      "تشطيب", "نجار", "حداد", "سباك",
      "مساح كميات", "فني بناء", "ترميم", "طريق", "جسور",
      "بنية تحتية", "رافعة"],
     "construction", "إنشاء ومقاولات"),

    # ── فندقة وضيافة ──────────────────────────────────────────
    (["فندق", "ضيافة", "سياحة", "مطعم", "طباخ", "شيف",
      "كيترينج", "طيران", "طيار", "مضيف", "مضيفة جو",
      "استقبال فندقي", "حجوزات", "ترفيه", "نادي", "منتجع",
      "resort", "خدمات غذائية"],
     "hospitality", "فندقة وضيافة"),

    # ── مبيعات وتسويق ─────────────────────────────────────────
    (["مبيع", "تسويق", "مسوق", "علاقة عملاء",
      "خدمة عملاء", "call center", "مركز اتصال", "تجزئة",
      "موزع", "وكيل مبيعات", "عمولة", "إعلان", "رقمي",
      "digital marketing", "social media", "محتوى إبداعي",
      "influencer", "brand"],
     "sales", "مبيعات وتسويق"),

    # ── إدارة وسكرتارية ───────────────────────────────────────
    (["إدار", "مدير", "سكرتار", "موارد بشرية", "hr",
      "توظيف", "لوجستي", "تخطيط", "استشاري", "مستشار",
      "تنفيذي", "رئيس قسم", "مشرف", "منسق", "متابعة",
      "عمليات", "سكرتير"],
     "admin", "إدارة وسكرتارية"),
]

# Slugs that are too generic to trust — always override with keyword rules
_GENERIC_SLUGS = {"all-jobs", "jobs", "all", "latest", "recent", "featured", ""}


def classify_category(slug: str, text: str, company: str = "") -> tuple[str, str]:
    """
    Three-stage category classification.

    Stage 0: Company whitelist (exact known companies → guaranteed category).
    Stage 1: Slug-based (fast, precise) — but ONLY for non-generic slugs.
    Stage 2a: Keyword rules on title+company ONLY (high confidence).
    Stage 2b: Keyword rules on full text (fallback, lower confidence).
             The 'corporate' rule is only applied in stage 2a (title+company)
             to avoid false positives from description body text.

    Returns: (category_id, category_name)
    """
    slug_clean = slug.strip().lower()

    # Stage 0: Company whitelist — highest trust
    if company:
        wl_result = _match_company_whitelist(company)
        if wl_result:
            return wl_result

    # Stage 1: specific slug lookup
    slug_result = EWDIFH_CAT_MAP.get(slug_clean)

    # If slug is specific and NOT generic → trust it
    if slug_result and slug_clean not in _GENERIC_SLUGS:
        cat_id, cat_name = slug_result
        log.debug("[Category] Slug '%s' → %s", slug_clean, cat_id)
        return (cat_id, cat_name)

    # Stage 2a: keyword classification on title+company ONLY (high confidence)
    # This includes the 'corporate' rule which must NOT fire on body text
    title_company_text = text.split("|")[0].lower() if "|" in text else text[:200].lower()
    for keywords, cat_id, cat_name in CATEGORY_KEYWORD_RULES:
        for kw in keywords:
            if kw.lower() in title_company_text:
                log.debug(
                    "[Category] Title-match keyword '%s' → %s (slug='%s')",
                    kw, cat_id, slug_clean
                )
                return (cat_id, cat_name)

    # Stage 2b: keyword classification on FULL text, but SKIP 'corporate' rule
    # ("شركة" in body description is too common to be a reliable signal)
    text_lower = text.lower()
    for keywords, cat_id, cat_name in CATEGORY_KEYWORD_RULES:
        if cat_id == "corporate":
            continue  # skip — already tried in 2a; avoid body-text false positives
        for kw in keywords:
            if kw.lower() in text_lower:
                log.debug(
                    "[Category] Body-match keyword '%s' → %s (slug='%s')",
                    kw, cat_id, slug_clean
                )
                return (cat_id, cat_name)

    # Final fallback with review log
    log.warning(
        "[Category] ⚠️ Low confidence — defaulting to 'corporate'. "
        "Slug='%s'. Company='%s'. Title prefix='%s'",
        slug_clean,
        company,
        text[:60]
    )
    return ("corporate", "وظائف شركات")


# ══════════════════════════════════════════════════════════════
# CITY MAP
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


def classify_city(text: str) -> tuple[str, str]:
    for kw, result in CITY_KEYWORDS.items():
        if kw in text:
            return result
    return ("all-cities", "جميع المناطق")


# ══════════════════════════════════════════════════════════════
# DEDUPLICATION — 7 Layers
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
        json.dumps(
            {"seen": sorted(seen), "updated_at": datetime.utcnow().isoformat()},
            ensure_ascii=False, indent=2
        ),
        encoding="utf-8",
    )


def fingerprint(title: str, company: str) -> str:
    """Layer 2: title+company hash (16-char hex)."""
    raw = f"{title.strip().lower()}|{company.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def content_hash(title: str, company: str, desc_prefix: str) -> str:
    """Layer 4: content hash — catches reposted jobs with different URLs."""
    raw = f"{title.strip().lower()}|{company.strip().lower()}|{desc_prefix[:200].strip().lower()}"
    return "ch_" + hashlib.sha256(raw.encode()).hexdigest()[:12]


def fetch_existing_from_supabase() -> tuple[set, bool]:
    """
    Fetches source_url + apply_url + fingerprints from all jobs in Supabase.
    Paginated to handle > 2000 jobs correctly.

    Returns:
        (known_keys: set, success: bool)
        success=False means the DB query failed — caller should abort to
        prevent inserting duplicates when dedup data is unavailable.
    """
    headers = {
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Range-Unit":    "items",
        "Prefer":        "count=exact",
    }
    known: set = set()
    page_size = 1000
    offset = 0
    total_rows = 0
    fetch_failed = False

    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/jobs"
            f"?select=source_url,apply_url,title,company"
            f"&limit={page_size}&offset={offset}"
        )
        try:
            r = requests.get(url, headers=headers, timeout=20)
            r.raise_for_status()
            rows = r.json()
            if not isinstance(rows, list):
                log.error("[Supabase] ❌ Unexpected response type: %s", type(rows))
                fetch_failed = True
                break
            if not rows:
                break  # no more rows
            for row in rows:
                if row.get("source_url"):
                    known.add(row["source_url"].strip())
                if row.get("apply_url") and row["apply_url"] not in ("#", ""):
                    known.add(row["apply_url"].strip())
                if row.get("title") and row.get("company"):
                    known.add(fingerprint(row["title"], row["company"]))
                    # Also add company-only fingerprint to catch near-duplicates
                    known.add(fingerprint(row["company"], row["company"]))
            total_rows += len(rows)
            if len(rows) < page_size:
                break  # last page
            offset += page_size
        except Exception as e:
            log.error("[Supabase] ❌ Failed to fetch existing jobs (offset=%d): %s", offset, e)
            fetch_failed = True
            break

    if fetch_failed:
        log.error(
            "[Supabase] ❌ DB fetch failed — aborting run to prevent duplicate inserts."
        )
        return known, False

    log.info("[Supabase] ✅ Loaded %d known job keys from %d DB rows", len(known), total_rows)
    return known, True


# ══════════════════════════════════════════════════════════════
# LOGO — download & convert to Base64 data-URI
# ══════════════════════════════════════════════════════════════
def logo_to_base64(logo_url: str, session) -> str:
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
    from bs4 import BeautifulSoup
    log.info("Fetching homepage: %s", SCRAPE_URL)
    r = scraper.get(SCRAPE_URL, timeout=30)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")

    # ── Try selectors in order of specificity — stop at first non-empty result ──
    # Each selector must return full job cards (containing title link + company)
    CARD_SELECTORS = [
        "div.bg-white.rounded-md.shadow.p-3.w-full",   # primary (verified 2026-06-23)
        "div.job-card",                                  # common alternative class
        "article.job-item",                              # article-based layout
    ]

    cards = []
    for sel in CARD_SELECTORS:
        candidates = soup.select(sel)
        # Validate: each card must have a /jobs/ link (otherwise it's a partial div)
        valid = [c for c in candidates if c.select_one("a[href*='/jobs/']")]
        if valid:
            log.info("Card selector '%s' → %d valid cards", sel, len(valid))
            cards = valid
            break

    if not cards:
        log.warning("No valid job cards found with any known selector — page structure may have changed")

    log.info("Found %d job cards on homepage", len(cards))

    results = []
    for card in cards:
        logo_el  = card.select_one("img.logo-org")
        logo_url = logo_el.get("src", "") if logo_el else ""
        if logo_url and not logo_url.startswith("http"):
            logo_url = "https://www.ewdifh.com" + logo_url

        title_el   = card.select_one("a[href*='/jobs/']")
        title      = title_el.get_text(strip=True) if title_el else ""
        source_url = ""
        if title_el:
            href = title_el.get("href", "")
            source_url = href if href.startswith("http") else "https://www.ewdifh.com" + href

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
# SECTION KEYWORDS — map Arabic headers → structured slot
# ══════════════════════════════════════════════════════════════
_SECTION_MAP = [
    ("details",      ["تفاصيل المسارات", "تفاصيل البرنامج", "تفاصيل الوظيفة",
                      "تفاصيل", "عن البرنامج", "نبذة", "الوصف"]),
    ("positions",    ["مسارات البرنامج", "مسار البرنامج", "المسارات",
                      "المسمى الوظيفي", "المسميات", "الوظائف المتاحة",
                      "الوظيفة", "التخصصات", "المجالات"]),
    ("requirements", ["الشروط", "المتطلبات", "شروط التقديم", "متطلبات", "المؤهلات", "يشترط", "يُشترط"]),
    ("benefits",     ["مزايا البرنامج", "مزايا", "التعويضات", "المكافآت", "المميزات",
                      "ما يميز", "ما تقدمه", "يوفر البرنامج",
                      "الراتب", "الحوافز", "الفوائد"]),
    ("steps",        ["خطوات التقديم", "خطوات الاشتراك",
                      "آلية التقديم", "كيفية التقديم"]),
    ("deadline_text",["موعد التقديم", "تاريخ التقديم", "آخر موعد", "مدة التقديم", "بدء التقديم"]),
    ("deadline_text",["طريقة التقديم", "طريقة الاشتراك"]),
]


def _match_slot(header: str) -> str:
    h = header.strip()
    for slot, keywords in _SECTION_MAP:
        for kw in keywords:
            if kw in h:
                return slot
    return "other"


def _extract_text_lines(tag) -> list[str]:
    """Extract non-empty text lines from a BS4 tag, splitting on <br> and <li>."""
    items = []
    lis = tag.find_all("li")
    if lis:
        for li in lis:
            t = li.get_text(" ", strip=True)
            if t:
                items.append(t.lstrip("- \u200f\u200e"))
        return items
    from bs4 import BeautifulSoup as BS
    inner = BS(str(tag), "html.parser")
    text  = inner.get_text(separator="\n")
    for line in text.splitlines():
        line = line.strip().lstrip("- \u200f\u200e\u2013")
        if len(line) > 4:
            items.append(line)
    return items


# ══════════════════════════════════════════════════════════════
# FORMAT DESCRIPTION → HTML (not Markdown)
# ══════════════════════════════════════════════════════════════
def format_description(
    company:       str,
    raw_html,
    apply_url:     str,
    deadline_iso:  str,
    city_name:     str,
    cat_name:      str,
) -> str:
    """
    Converts raw card-body HTML into a clean 6-section HTML string.
    Output is stored in the `description` DB column and rendered with
    innerHTML on the frontend — NOT as Markdown.

    Sections:
      1. الجهة المعلنة
      2. المسميات الوظيفية
      3. الشروط والمتطلبات
      4. المزايا والتعويضات
      5. مكان العمل
      6. طريقة وموعد التقديم
    """
    from bs4 import BeautifulSoup

    slots: dict[str, list[str]] = {
        "intro":         [],
        "positions":     [],
        "requirements":  [],
        "benefits":      [],
        "steps":         [],
        "deadline_text": [],
        "details":       [],
        "other":         [],
    }

    current_slot = "intro"

    if raw_html:
        for ad in raw_html.select("ins, script, .adsbygoogle"):
            ad.decompose()

        paragraphs = raw_html.find_all("p", recursive=True)

        for p in paragraphs:
            strong = p.find("strong")
            if strong and p.get_text(strip=True).startswith(strong.get_text(strip=True)):
                header_text = strong.get_text(strip=True)
                current_slot = _match_slot(header_text)
                strong.extract()

            raw_p = str(p)
            inner = BeautifulSoup(raw_p, "html.parser")
            text  = inner.get_text(separator="\n")
            for line in text.splitlines():
                line = line.strip().lstrip("- \u200f\u200e\u2013")
                if len(line) > 4:
                    slots[current_slot].append(line)

    # Deduplicate while preserving order
    def dedup(lst: list[str]) -> list[str]:
        seen_set: set[str] = set()
        out = []
        for x in lst:
            x = x.strip()
            if x and x not in seen_set:
                seen_set.add(x)
                out.append(x)
        return out

    for k in slots:
        slots[k] = dedup(slots[k])

    # Smart re-classification of "other" items
    for item in slots["other"] + slots["details"]:
        lower = item
        if any(kw in lower for kw in ["سعودي", "مؤهل", "خبرة", "شرط", "يشترط",
                                       "بكالوريوس", "دبلوم", "ثانوي", "سنة", "سنوات"]):
            if item not in slots["requirements"]:
                slots["requirements"].append(item)
        elif any(kw in lower for kw in ["راتب", "مكافأ", "حافز", "تأمين",
                                         "إجازة", "بدل", "شهادة", "ممول"]):
            if item not in slots["benefits"]:
                slots["benefits"].append(item)

    # Fallback: positions empty → use intro or details
    if not slots["positions"]:
        if slots["intro"]:
            slots["positions"] = slots["intro"][:3]
        elif slots["details"]:
            slots["positions"] = slots["details"][:3]

    # Section 6: deadline + apply method
    apply_lines = []
    _LINK_NOISE = {"اضغط هنا", "انقر هنا", "هنا", "من خلال الرابط التالي:",
                   "من خلال الرابط", "الرابط", "التقديم", "للتقديم"}

    if slots["deadline_text"]:
        for item in slots["deadline_text"]:
            if item.strip() not in _LINK_NOISE and len(item) > 8:
                apply_lines.append(item)

    if not apply_lines and deadline_iso:
        try:
            d = date.fromisoformat(deadline_iso)
            apply_lines.append(f"آخر موعد للتقديم: {d.strftime('%Y/%m/%d')}م")
        except Exception:
            pass

    if not apply_lines:
        apply_lines.append("التقديم مُتاح الآن")

    if apply_url and apply_url not in ("#", ""):
        if "@" in apply_url:
            apply_lines.append("التقديم عبر إرسال السيرة الذاتية إلى البريد الإلكتروني المرفق في خانة التقديم أدناه")
        else:
            apply_lines.append("التقديم متاح عبر الرابط المرفق في خانة التقديم أدناه")
    else:
        apply_lines.append("التقديم متاح عبر الرابط المرفق في خانة التقديم أدناه")

    if slots["steps"]:
        _NUM_PREFIX = re.compile(r'^\d+[-–.\s]+')
        clean_steps = []
        for step in slots["steps"]:
            step = step.strip()
            step = _NUM_PREFIX.sub("", step).strip()
            if step and step not in _LINK_NOISE and len(step) > 5:
                clean_steps.append(step)
        clean_steps = dedup(clean_steps)
        for i, step in enumerate(clean_steps, 1):
            apply_lines.append(f"{i}. {step}")

    apply_lines = dedup(apply_lines)

    # ── Build final HTML ──────────────────────────────────────
    def make_section(title: str, items: list[str], limit: int = 12) -> str:
        """Build an HTML section block with a bold heading and bullet list."""
        html = f'<p><strong>{title}</strong></p>\n<ul>\n'
        if items:
            for item in items[:limit]:
                # Escape any HTML entities in item text
                safe_item = item.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                html += f'  <li>{safe_item}</li>\n'
        else:
            html += '  <li>(لم تُحدَّد)</li>\n'
        html += '</ul>'
        return html

    sections = [
        f'<p><strong>1. الجهة المعلنة:</strong></p>\n<ul>\n  <li>{company}</li>\n</ul>',
        make_section("2. المسميات الوظيفية:", slots["positions"]),
        make_section("3. الشروط والمتطلبات:", slots["requirements"]),
        make_section("4. المزايا والتعويضات:", slots["benefits"]),
        f'<p><strong>5. مكان العمل:</strong></p>\n<ul>\n  <li>{city_name}</li>\n</ul>',
        make_section("6. طريقة وموعد التقديم:", apply_lines),
    ]

    result = "\n\n".join(sections)

    # Ensure minimum word count (AdSense policy) — append plain text if needed
    plain_word_count = len(re.sub(r'<[^>]+>', '', result).split())
    if plain_word_count < MIN_DESC_WORDS:
        result += (
            f"\n\n<p>تُعدّ هذه الفرصة في مجال {cat_name} بـ{city_name} من الفرص المميزة "
            f"التي يُنصح بالإسراع في التقديم عليها. "
            f"نتمنى لجميع المتقدمين التوفيق والنجاح في مسيرتهم المهنية.</p>"
        )

    return result


# ══════════════════════════════════════════════════════════════
# SCRAPING — job detail page
# ══════════════════════════════════════════════════════════════
def fetch_detail(url: str, scraper) -> dict:
    detail: dict = {
        "raw_body":      None,
        "plain_text":    "",
        "apply_url":     "#",
        "category_slug": "",
        "deadline":      None,
        "city_text":     "",
    }
    try:
        from bs4 import BeautifulSoup
        time.sleep(REQUEST_DELAY)
        r = scraper.get(url, timeout=25)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")

        body_div = soup.select_one("div.card-body")
        if body_div:
            detail["raw_body"] = body_div
            for ad in body_div.select("ins, script, .adsbygoogle"):
                ad.decompose()
            detail["plain_text"] = body_div.get_text(" ", strip=True)

            external_links = [
                a.get("href", "")
                for a in body_div.select("a[href]")
                if a.get("href", "").startswith("http")
                   and "ewdifh.com" not in a.get("href", "")
                   and "whatsapp" not in a.get("href", "")
                   and "telegram" not in a.get("href", "")
                   and "twitter" not in a.get("href", "")
                   and "snapchat" not in a.get("href", "")
                   and "x.com" not in a.get("href", "")
            ]
            if external_links:
                detail["apply_url"] = external_links[-1]

        # Category slug from breadcrumb
        cat_el = soup.select_one("a[href*='/category/']")
        if cat_el:
            href = cat_el.get("href", "")
            slug = href.rstrip("/").split("/")[-1]
            detail["category_slug"] = slug

        # Deadline from JSON-LD
        ld_tag = soup.find("script", type="application/ld+json")
        if ld_tag:
            try:
                ld = json.loads(ld_tag.string)
                vt = ld.get("validThrough", "")
                if vt and len(vt) >= 10:
                    detail["deadline"] = vt[:10]
            except Exception:
                pass

        # City text
        h1 = soup.find("h1")
        detail["city_text"] = detail["plain_text"] + " " + (h1.get_text() if h1 else "")

    except Exception as e:
        log.warning("Detail fetch failed for %s: %s", url, e)

    return detail


# ══════════════════════════════════════════════════════════════
# BUILD SUPABASE JOB PAYLOAD
# ══════════════════════════════════════════════════════════════
def build_payload(listing: dict, detail: dict, logo_b64: str) -> dict:
    title   = listing["title"].strip()
    company = listing["company"].strip()

    # ── Category (three-stage: whitelist → slug → keyword) ───
    # Use "|" as separator so classifier can isolate title+company from body
    cat_id, cat_name = classify_category(
        slug=detail.get("category_slug", ""),
        text=title + " " + company + " | " + detail.get("plain_text", ""),
        company=company,
    )

    # ── City ──────────────────────────────────────────────────
    city_id, city_name = classify_city(detail["city_text"] or title)

    # ── Deadline ──────────────────────────────────────────────
    deadline = detail.get("deadline")
    if deadline:
        try:
            if date.fromisoformat(deadline) < date.today():
                deadline = None
        except ValueError:
            deadline = None

    # ── Build structured HTML description ─────────────────────
    desc = format_description(
        company      = company,
        raw_html     = detail.get("raw_body"),
        apply_url    = detail.get("apply_url", "#"),
        deadline_iso = deadline or "",
        city_name    = city_name,
        cat_name     = cat_name,
    )

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
        "source_url":    listing.get("source_url") or "",
        "badge":         "new",
        "featured":      False,
        "deadline":      deadline,
        "posted_date":   date.today().isoformat(),
    }


# ══════════════════════════════════════════════════════════════
# SUPABASE INSERT
# ══════════════════════════════════════════════════════════════
def insert_job(payload: dict) -> Optional[dict]:
    url = f"{SUPABASE_URL}/rest/v1/jobs"
    headers = {
        "apikey":        SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        "Content-Type":  "application/json",
        # ON CONFLICT (source_url) DO NOTHING → empty list response
        "Prefer":        "return=representation,resolution=ignore-duplicates",
    }
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=20)
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list) and len(data) == 0:
            log.info("⚠️  Already exists in DB (source_url conflict) → %s", payload["company"])
            return None
        row = data[0] if isinstance(data, list) else data
        log.info("✅ Inserted → id=%s  company=%s  category=%s",
                 row.get("id"), payload["company"], payload["category"])
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
        # Strip UTF-8 BOM that send.php may prepend before JSON
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
        log.warning("⚠️ Push HTTP %s (non-fatal): %s", e.response.status_code, e.response.text[:200])
    except json.JSONDecodeError as e:
        log.warning("⚠️ Push response not valid JSON (non-fatal): %s", e)
    except Exception as e:
        log.warning("⚠️ Push error (non-fatal): %s", e)


# ══════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════
def main():
    log.info("━" * 60)
    log.info("wadifatuk Scraper  v4.0  —  %s UTC", datetime.utcnow().strftime("%Y-%m-%d %H:%M"))
    log.info("━" * 60)

    if not SUPABASE_ANON_KEY:
        log.error("SUPABASE_ANON_KEY is not set — aborting.")
        raise SystemExit(1)

    # ── Layer 1: Local seen_jobs.json ─────────────────────────
    seen    = load_seen()
    scraper = build_scraper()

    # ── Layer 2: Fetch known jobs from Supabase (paginated) ───
    # CRITICAL: If DB fetch fails, we abort entirely to prevent
    # duplicate inserts when dedup data is unavailable.
    sb_known, db_ok = fetch_existing_from_supabase()
    if not db_ok:
        log.error("Aborting — cannot run without reliable dedup data from Supabase.")
        raise SystemExit(1)

    seen = seen | sb_known
    log.info("[Dedup] Combined known keys: %d (local=%d  db=%d)",
             len(seen), len(seen) - len(sb_known), len(sb_known))

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

        # Layer 1 + 2 check (source_url and fingerprint)
        if src_url in seen or fp in seen:
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

        # ── Layer 3: apply_url check ──────────────────────────
        apply_url = payload.get("apply_url", "")
        if apply_url and apply_url not in ("#", "") and apply_url in seen:
            log.info("[%d/%d] SKIP (apply_url match)  %s", i, len(listings), item["company"])
            seen.add(src_url); seen.add(fp)
            skipped += 1
            continue

        # ── Layer 4: content hash check ───────────────────────
        plain_desc = re.sub(r'<[^>]+>', '', payload.get("description", ""))
        chash = content_hash(item["title"], item["company"], plain_desc)
        if chash in seen:
            log.info("[%d/%d] SKIP (content hash match)  %s", i, len(listings), item["company"])
            seen.add(src_url); seen.add(fp)
            skipped += 1
            continue

        # ── Layer 5: DB UNIQUE constraint + resolution=ignore-duplicates
        row = insert_job(payload)
        if row is None:
            # Could be DB conflict (already exists) or real insert error
            # Either way: mark as seen to avoid retrying indefinitely
            seen.add(src_url)
            seen.add(fp)
            seen.add(chash)
            if apply_url and apply_url not in ("#", ""):
                seen.add(apply_url)
            save_seen(seen)
            errors += 1
            continue

        # ── Mark all keys as seen ─────────────────────────────
        seen.add(src_url)
        seen.add(fp)
        seen.add(chash)
        if apply_url and apply_url not in ("#", ""):
            seen.add(apply_url)
        save_seen(seen)

        # ── Fire push notification ────────────────────────────
        fire_push(row)
        new_count += 1

        time.sleep(1.0)

    # ── 3. Summary ────────────────────────────────────────────
    log.info("━" * 60)
    log.info("Done ✓  new=%d  skipped=%d  errors=%d  total_seen=%d",
             new_count, skipped, errors, len(seen))
    log.info("━" * 60)


# ══════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import sys
    if "--debug-html" in sys.argv:
        s = build_scraper()
        html = s.get(SCRAPE_URL, timeout=30).text
        out  = Path(__file__).parent / "debug_ewdifh.html"
        out.write_text(html, encoding="utf-8")
        print(f"[debug] HTML saved -> {out}  ({len(html):,} bytes)")
    else:
        main()
