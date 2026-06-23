# wadifatuk.com — Job Scraper 🤖

سكريبت Python احترافي يجلب الوظائف تلقائياً من **ewdifh.com** ويضيفها مباشرةً إلى **قاعدة بيانات Supabase** مع تشغيل إشعارات Push تلقائياً بعد كل إضافة، تماماً كما يفعل المدير يدوياً من لوحة التحكم.

---

## 🗂️ الملفات

```
scraper/
├── scrape_jobs.py     ← السكريبت الرئيسي
├── requirements.txt   ← المكتبات المطلوبة
├── seen_jobs.json     ← سجل الازدواجية (يُنشأ تلقائياً)
└── scraper.log        ← سجل التشغيل (يُنشأ تلقائياً)

.github/workflows/
└── scrape.yml         ← GitHub Actions (كل 3 ساعات)
```

---

## ⚙️ إعداد GitHub Actions (3 خطوات فقط)

### 1. أضف GitHub Secrets
```
Settings → Secrets and variables → Actions → New repository secret
```

| Secret | القيمة |
|--------|--------|
| `SUPABASE_URL` | `https://zkelkmfxjobrsnvyaanv.supabase.co` |
| `SUPABASE_ANON_KEY` | مفتاح anon من Supabase Dashboard |
| `SITE_URL` | `https://www.wadifatuk.com` |

### 2. ارفع المشروع على GitHub
```bash
git add scraper/ .github/
git commit -m "feat: add automated job scraper"
git push
```

### 3. شغّل يدوياً للتجربة
```
Actions → 🕷️ Scrape ewdifh.com → Run workflow → Run workflow
```

---

## 🧪 تشغيل محلي

```bash
pip install -r scraper/requirements.txt

# تعيين متغيرات البيئة
set SUPABASE_URL=https://zkelkmfxjobrsnvyaanv.supabase.co
set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
set SITE_URL=https://www.wadifatuk.com

# تشغيل عادي
python scraper/scrape_jobs.py

# تفريغ HTML للتحقق من المحتوى
python scraper/scrape_jobs.py --debug-html
```

---

## 🔄 آلية العمل

```
ewdifh.com (homepage)
    │
    ▼
Parse job cards (CSS: div.bg-white.rounded-md.shadow)
    │
    ▼
For each new job → fetch /jobs/NNNNN (detail page)
    │  ├─ description    (div.card-body > p)
    │  ├─ apply_url      (external links in card-body)
    │  ├─ category_slug  (a[href*='/category/'])
    │  └─ deadline       (JSON-LD validThrough)
    │
    ▼
Download logo → resize 256×256 → Base64 data-URI
    │
    ▼
Check seen_jobs.json (dedup by URL + title/company hash)
    │
    ▼ (new only)
POST → Supabase /rest/v1/jobs
    │
    ▼
POST → /push/send.php  [X-Admin-Token header]
    │
    ▼
Update seen_jobs.json → commit to Git
```

---

## 🛡️ ضمانات الجودة

| الضمان | كيف يعمل |
|--------|----------|
| **عدم التكرار** | `seen_jobs.json` يُخزّن URL + hash العنوان/الشركة |
| **الوصف الكافي** | يُكمل الوصف تلقائياً إذا كان أقل من 30 كلمة (سياسة AdSense) |
| **الشعار الآمن** | يُنزّل ويُحوّل إلى Base64، أو يستخدم 🏢 عند الفشل |
| **إشعار Push** | يُطلق تلقائياً بعد كل إضافة ناجحة (نفس ADMIN_TOKEN) |
| **حماية من الانهيار** | try/except على كل خطوة + تسجيل مفصّل في scraper.log |
