# قائمة فحص SEO الشاملة — وظيفتك.com

## ✅ المُنجز (Production Ready)

### Meta Tags الأساسية
- [x] `<title>` فريد ووصفي لكل صفحة
- [x] `<meta name="description">` لكل صفحة (120-160 حرف)
- [x] `<meta name="keywords">` لكل صفحة
- [x] `<meta name="robots" content="index, follow">` للصفحات العامة
- [x] `<meta name="robots" content="noindex, nofollow">` للوحة الإدارة
- [x] `<link rel="canonical">` لكل صفحة
- [x] `lang="ar" dir="rtl"` على `<html>`

### Open Graph (Facebook/LinkedIn/WhatsApp)
- [x] `og:title`
- [x] `og:description`
- [x] `og:image` (1200×630px)
- [x] `og:image:width` + `og:image:height`
- [x] `og:url`
- [x] `og:type`
- [x] `og:locale` = `ar_SA`
- [x] `og:site_name`

### Twitter Cards
- [x] `twitter:card` = `summary_large_image`
- [x] `twitter:site` = `@wadifatuk_`
- [x] `twitter:title`
- [x] `twitter:description`
- [x] `twitter:image`

### Schema.org (Structured Data)
- [x] `WebSite` schema على الرئيسية
- [x] `SearchAction` (Sitelinks Searchbox)
- [x] `Organization` schema
- [x] `BreadcrumbList` على jobs.html
- [x] `WebPage` schema على jobs.html

### Technical SEO
- [x] `robots.txt` - محكم ويحجب `/admin/`
- [x] `sitemap.xml` - شامل لجميع الصفحات المهمة
- [x] HTTPS مفعّل + HTTP→HTTPS redirect
- [x] www → non-www redirect (أو العكس - ثابت)
- [x] 404 مخصص
- [x] GZIP compression مفعّل
- [x] Browser caching مفعّل

### PWA & Mobile
- [x] `site.webmanifest` شامل
- [x] `<link rel="manifest">` في جميع الصفحات
- [x] `<link rel="apple-touch-icon">`
- [x] `theme-color` meta tag
- [x] Service Worker يعمل
- [x] Responsive design كامل
- [x] RTL كامل

### Performance
- [x] DNS Prefetch للموارد الخارجية
- [x] Font preconnect
- [x] الصور SVG (قابلة للتحجيم)
- [x] CSS و JS منظّمان ومجمّعان

---

## ⚠️ يتطلب إجراء (Post-Launch)

### Google Integration
- [ ] **Google Search Console** - إضافة النطاق وإرسال Sitemap
  - رابط: https://search.google.com/search-console
  - أرسل: `https://www.wadifatuk.com/sitemap.xml`
- [ ] **Google Analytics 4** - تفعيل وإضافة Measurement ID
  - استبدل `G-XXXXXXXXXX` في الصفحات
  - فعّل Consent Mode v2 ✅ (الكود موجود معلّقاً)
- [ ] **Google AdSense** - الحصول على Publisher ID الحقيقي
  - حدّث `ads.txt` بالـ ID الحقيقي
  - أضف وحدات الإعلانات في الصفحات
- [ ] **Google Tag Manager** (اختياري) - لإدارة أفضل للعلامات

### Schema.org المتقدم (اختياري لكن مفيد)
- [ ] `JobPosting` schema لكل وظيفة فعلية
- [ ] `FAQPage` schema لصفحة من نحن
- [ ] `ContactPage` schema لصفحة الاتصال
- [ ] `Organization` sameAs للشبكات الاجتماعية

### صور SEO
- [ ] إنشاء صور PNG فعلية للـ PWA icons (icon-72x72 حتى 512x512)
- [ ] إنشاء `og-image.png` بحجم 1200×630
- [ ] إنشاء `twitter-card.png` بحجم 1200×600
- [ ] إنشاء `mstile-150x150.png`

### محتوى SEO
- [ ] إضافة صفحات وظائف منفصلة لكل تصنيف رئيسي (URL فريد لكل منها)
- [ ] إضافة مقالات وتوجيهات مهنية (لزيادة الـ organic traffic)
- [ ] إضافة صفحات للمدن الرئيسية (riyadh, jeddah, dammam)
- [ ] Hreflang (للنسخة الإنجليزية مستقبلاً)

### Backlinks & Authority
- [ ] إضافة الموقع لـ Google My Business
- [ ] تسجيل في دلائل المواقع العربية
- [ ] نشر روابط على منصات التواصل الاجتماعي المرتبطة بالموقع

---

## 📊 أهداف Core Web Vitals

| المقياس | الهدف | الوضع الحالي |
|---------|-------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | ✅ جيد (HTML/SVG فقط) |
| FID/INP (Interaction to Next Paint) | < 200ms | ✅ جيد |
| CLS (Cumulative Layout Shift) | < 0.1 | ✅ جيد |
| FCP (First Contentful Paint) | < 1.8s | ✅ جيد |
| TTFB (Time to First Byte) | < 800ms | ✅ جيد (Static) |

---

## 🔗 أدوات التحقق

| الأداة | الرابط |
|--------|--------|
| Google Search Console | https://search.google.com/search-console |
| Google PageSpeed Insights | https://pagespeed.web.dev |
| Google Rich Results Test | https://search.google.com/test/rich-results |
| Schema Markup Validator | https://validator.schema.org |
| Open Graph Debugger | https://developers.facebook.com/tools/debug/ |
| Twitter Card Validator | https://cards-dev.twitter.com/validator |
| Mobile-Friendly Test | https://search.google.com/test/mobile-friendly |
| SSL Test | https://www.ssllabs.com/ssltest |
| Security Headers | https://securityheaders.com |

---

*آخر مراجعة: 10 مايو 2026 | وظيفتك.com*
