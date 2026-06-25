-- ============================================================
-- SQL SCHEMA — بوست وظيفتك × Supabase
-- نسخ هذا الكود في: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. إنشاء جدول الوظائف ──────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id            BIGSERIAL PRIMARY KEY,
  title         TEXT,
  company       TEXT        NOT NULL,
  logo          TEXT,
  city          TEXT        NOT NULL,
  city_name     TEXT,
  region        TEXT,
  category      TEXT        NOT NULL,
  category_name TEXT,
  type          TEXT        DEFAULT 'fulltime',
  type_name     TEXT,
  salary        TEXT,
  experience    TEXT,
  gender        TEXT        DEFAULT 'للجنسين',
  education     TEXT,
  description   TEXT,
  requirements  TEXT[],
  benefits      TEXT[],
  tags          TEXT[],
  badge         TEXT,
  featured      BOOLEAN     DEFAULT false,
  status        TEXT        DEFAULT 'active',
  apply_url     TEXT,
  source_url    TEXT        UNIQUE,          -- رابط ewdifh الأصلي — مفتاح منع التكرار
  deadline      TEXT,
  posted_date   DATE        DEFAULT CURRENT_DATE,
  views         INTEGER     DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- إضافة حقل title إذا كان الجدول موجوداً مسبقاً
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title TEXT;

-- ✅ إضافة source_url للجداول الموجودة مسبقاً (ترحيل)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_url TEXT;
-- إضافة UNIQUE constraint إن لم يكن موجوداً
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jobs_source_url_key'
  ) THEN
    ALTER TABLE jobs ADD CONSTRAINT jobs_source_url_key UNIQUE (source_url);
  END IF;
END $$;

-- ── 2. تفعيل Row Level Security ────────────────────────────
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- ── 3. سياسات RLS ──────────────────────────────────────────
-- قراءة مفتوحة للجميع (الزوار والمدير)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='jobs' AND policyname='allow_public_read') THEN
    CREATE POLICY "allow_public_read" ON jobs FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='jobs' AND policyname='allow_admin_insert') THEN
    CREATE POLICY "allow_admin_insert" ON jobs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='jobs' AND policyname='allow_admin_update') THEN
    CREATE POLICY "allow_admin_update" ON jobs FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='jobs' AND policyname='allow_admin_delete') THEN
    CREATE POLICY "allow_admin_delete" ON jobs FOR DELETE USING (true);
  END IF;
END $$;

-- ── 4. فهارس للأداء ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_category   ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_jobs_city       ON jobs(city);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_featured   ON jobs(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_jobs_source_url ON jobs(source_url) WHERE source_url IS NOT NULL;

-- ── 5. ترحيل الوظائف التجريبية ─────────────────────────────
-- يُنفَّذ فقط إذا كان الجدول فارغاً
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM jobs) = 0 THEN
    INSERT INTO jobs (title, company, logo, city, city_name, category, category_name, type, type_name, salary, experience, gender, education, description, requirements, benefits, tags, badge, featured, status, apply_url, deadline, views)
    VALUES
      ('مهندس برمجيات أول', 'شركة أرامكو السعودية', '🛢️', 'dammam', 'الدمام', 'engineering', 'هندسة وتقنية', 'fulltime', 'دوام كامل', '15,000 - 25,000 ريال', '5+ سنوات', 'للجنسين', 'بكالوريوس', 'نبحث عن مهندس برمجيات ذو خبرة واسعة للانضمام إلى فريق تقنية المعلومات في شركة أرامكو السعودية. ستكون مسؤولاً عن تصميم وتطوير وصيانة الأنظمة البرمجية المعقدة التي تدعم عمليات الشركة الحيوية.', ARRAY['خبرة 5 سنوات في تطوير البرمجيات', 'إجادة Python وJava', 'خبرة AWS أو Azure', 'قدرة على العمل ضمن فريق متعدد التخصصات'], ARRAY['تأمين صحي', 'سكن', 'نقل', 'تذاكر سفر سنوية'], ARRAY['برمجة', 'هندسة', 'تقنية'], 'featured', true, 'active', '#', '2026-07-31', 1240),
      ('محاسب قانوني معتمد', 'مجموعة MBC', '📺', 'riyadh', 'الرياض', 'finance', 'مالية ومحاسبة', 'fulltime', 'دوام كامل', '10,000 - 15,000 ريال', '3 سنوات', 'للجنسين', 'بكالوريوس محاسبة', 'مطلوب محاسب قانوني معتمد للعمل في إدارة الشؤون المالية لمجموعة MBC الإعلامية. يشمل الدور إعداد التقارير المالية ومراجعة الحسابات والإشراف على الميزانية السنوية.', ARRAY['شهادة CPA أو CMA معتمدة', 'خبرة 3 سنوات في المحاسبة', 'إجادة برامج المحاسبة SAP أو Oracle', 'مهارات تحليلية عالية'], ARRAY['تأمين صحي شامل', 'بدل سكن', 'حوافز أداء سنوية'], ARRAY['محاسبة', 'مالية', 'CPA'], 'new', false, 'active', '#', '2026-07-15', 850),
      ('ممرض/ة في وحدة العناية المركزة', 'مستشفى الملك فيصل التخصصي', '🏥', 'riyadh', 'الرياض', 'medical', 'طبية وصحية', 'fulltime', 'دوام كامل', '8,000 - 14,000 ريال', 'سنتان', 'للجنسين', 'بكالوريوس تمريض', 'نبحث عن ممرضين ومرضات مؤهلين للعمل في وحدة العناية المركزة بمستشفى الملك فيصل التخصصي. يتطلب المنصب قدرة عالية على التعامل مع الحالات الحرجة وخبرة في استخدام الأجهزة الطبية المتطورة.', ARRAY['بكالوريوس تمريض من جامعة معتمدة', 'رخصة مزاولة المهنة', 'خبرة 2 سنة في ICU', 'إجادة الإنعاش القلبي الرئوي CPR'], ARRAY['سكن مجاني', 'تأمين طبي شامل للأسرة', 'نقل', 'تذاكر سنوية'], ARRAY['تمريض', 'طبي', 'صحة'], 'urgent', false, 'active', '#', '2026-07-20', 2100),
      ('مدير مبيعات إقليمي', 'شركة الاتصالات السعودية STC', '📡', 'jeddah', 'جدة', 'sales', 'مبيعات وتسويق', 'fulltime', 'دوام كامل', '18,000 - 28,000 ريال', '7+ سنوات', 'للجنسين', 'بكالوريوس', 'نبحث عن مدير مبيعات إقليمي لقيادة فريق المبيعات في منطقة جدة والغرب. يشمل الدور تطوير استراتيجيات المبيعات وإدارة علاقات العملاء الكبار وتحقيق الأهداف الربعية.', ARRAY['خبرة 7 سنوات في قطاع الاتصالات أو التقنية', 'مهارات قيادية وإدارية عالية', 'رخصة قيادة سارية', 'إجادة اللغة الإنجليزية'], ARRAY['سيارة شركة', 'عمولات ومكافآت أداء سخية', 'تأمين صحي للأسرة'], ARRAY['مبيعات', 'اتصالات', 'قيادة'], 'featured', true, 'active', '#', '2026-07-25', 670),
      ('موظف خدمة عملاء', 'مجموعة بنك الراجحي', '🏦', 'riyadh', 'الرياض', 'admin', 'إدارة وسكرتارية', 'fulltime', 'دوام كامل', '5,000 - 7,000 ريال', 'بدون خبرة', 'للجنسين', 'ثانوية أو أعلى', 'نبحث عن موظفي خدمة عملاء لفروع بنك الراجحي في الرياض. الوظيفة مناسبة للمبتدئين وحديثي التخرج، وتشمل تدريباً مكثفاً على أنظمة البنك وأساليب التعامل مع العملاء.', ARRAY['مهارات تواصل ممتازة', 'إجادة استخدام الحاسب الآلي', 'مظهر لائق واحترافي', 'قدرة على العمل تحت الضغط'], ARRAY['تأمين صحي', 'بدل غلاء معيشة', 'حوافز أداء شهرية', 'فرص ترقي'], ARRAY['خدمة عملاء', 'بنك', 'مبتدئ'], 'new', false, 'active', '#', '2026-07-30', 3200),
      ('اختبار قياس القدرات العامة – دورة 2026', 'المركز الوطني للتقييم قياس', '📝', 'riyadh', 'الرياض', 'qiyas', 'اختبارات قياس', 'fulltime', 'اختبار إلكتروني', 'مجاني', 'بدون خبرة', 'للجنسين', 'بكالوريوس', 'يعلن المركز الوطني للتقييم (قياس) عن فتح باب التسجيل لاختبار القدرات العامة الإلكتروني لدورة 2026. الاختبار متطلب أساسي للالتحاق بمعظم الجهات الحكومية والخاصة الكبرى في المملكة.', ARRAY['التسجيل عبر منصة قياس الإلكترونية', 'سداد رسوم الاختبار (200 ريال)', 'الحضور في الموعد والمركز المحدد', 'إحضار الهوية الوطنية'], ARRAY['شهادة معتمدة تصلح لمدة 3 سنوات', 'مؤهل للوظائف الحكومية والخاصة', 'يُعتمد في معظم برامج الابتعاث'], ARRAY['قياس', 'حكومي', 'للجنسين'], 'urgent', false, 'active', 'https://www.qiyas.sa', '2026-06-30', 4500);
  END IF;
END $$;

-- ── 6. دالة تحديث views تلقائياً ──────────────────────────
CREATE OR REPLACE FUNCTION increment_job_views(job_id BIGINT)
RETURNS void AS $$
BEGIN
  UPDATE jobs SET views = COALESCE(views, 0) + 1 WHERE id = job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. ✅ تفعيل Supabase Realtime لجدول jobs ─────────────────
-- يُمكِّن التحديث الفوري للموقع بدون تحديث الصفحة
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;

-- ── 8. ✅ جدول مشتركي البريد الإلكتروني ──────────────────────
-- لنقل المشتركين من localStorage إلى Supabase الموحّدة
CREATE TABLE IF NOT EXISTS email_subscribers (
  id             BIGSERIAL PRIMARY KEY,
  email          TEXT        NOT NULL UNIQUE,
  name           TEXT        DEFAULT '',
  active         BOOLEAN     DEFAULT true,
  subscribed_at  TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

-- فهرس البريد الإلكتروني للبحث السريع
CREATE INDEX IF NOT EXISTS idx_email_subscribers_email  ON email_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_active ON email_subscribers(active);

-- سياسات RLS للمشتركين
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_subscribers' AND policyname='allow_public_insert') THEN
    CREATE POLICY "allow_public_insert" ON email_subscribers FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_subscribers' AND policyname='allow_admin_read') THEN
    CREATE POLICY "allow_admin_read" ON email_subscribers FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='email_subscribers' AND policyname='allow_admin_update') THEN
    CREATE POLICY "allow_admin_update" ON email_subscribers FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ✅ انتهى إعداد قاعدة البيانات بنجاح
-- ملاحظة: قد تظهر رسالة "already member of publication" لجدول jobs — هذا طبيعي

