# وظيفتك.com — بوابة الوظائف السعودية

[![Production Ready](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)](https://wadifatuk.com)
[![PWA](https://img.shields.io/badge/PWA-Enabled-blue)](https://wadifatuk.com)
[![SEO](https://img.shields.io/badge/SEO-Optimized-orange)](https://wadifatuk.com)

> أكبر بوابة وظائف في المملكة العربية السعودية — وظائف حكومية، عسكرية، شركات، وعن بُعد

🌐 **الموقع:** [www.wadifatuk.com](https://www.wadifatuk.com)

---

## 🗂️ هيكل المشروع

```
wadifatuk.com/
├── index.html              # الصفحة الرئيسية
├── jobs.html               # صفحة جميع الوظائف
├── job-detail.html         # تفاصيل الوظيفة
├── about.html              # من نحن
├── contact.html            # اتصل بنا
├── privacy.html            # سياسة الخصوصية
├── terms.html              # شروط الاستخدام
├── disclaimer.html         # إخلاء المسؤولية
├── cookie-policy.html      # سياسة ملفات الارتباط
├── dmca.html               # سياسة DMCA
├── 404.html                # صفحة الخطأ
├── verify.html             # التحقق من البريد
├── unsubscribe.html        # إلغاء الاشتراك
│
├── admin/                  # لوحة الإدارة
│   ├── index.html          # صفحة تسجيل الدخول
│   ├── panel.html          # لوحة التحكم الرئيسية
│   ├── css/admin.css
│   └── js/admin.js
│
├── css/
│   ├── style.css           # CSS الرئيسي
│   ├── subscribe.css       # نماذج الاشتراك
│   ├── cookie-consent.css  # موافقة الكوكيز
│   └── pwa-install.css     # نافذة تثبيت PWA
│
├── js/
│   ├── data.js             # بيانات الوظائف (localStorage)
│   ├── main.js             # المنطق الرئيسي
│   ├── subscribe.js        # نظام الاشتراك بالبريد
│   ├── cookie-consent.js   # نظام الكوكيز
│   ├── push-notifications.js  # إشعارات الجوال
│   └── pwa-install.js      # نظام تثبيت PWA
│
├── push/                   # نظام Push Notifications (PHP)
│   ├── config.php          # إعداد VAPID Keys
│   ├── subscribe.php       # حفظ/حذف الاشتراكات
│   ├── send.php            # إرسال الإشعارات
│   ├── stats.php           # إحصائيات الاشتراكات
│   ├── setup.php           # توليد VAPID Keys (يُحذف بعد الإعداد)
│   ├── latest.json         # آخر وظيفة (للـ Service Worker)
│   └── .htaccess           # حماية المجلد
│
├── images/
│   ├── logo-master.svg
│   ├── og-image.svg        # صورة Open Graph
│   └── maskable-icon.svg   # أيقونة PWA
│
├── favicon.svg             # Favicon
├── site.webmanifest        # PWA Manifest
├── sw.js                   # Service Worker
├── robots.txt              # إرشادات محركات البحث
├── sitemap.xml             # خريطة الموقع
├── ads.txt                 # Google AdSense
├── browserconfig.xml       # Windows Live Tiles
└── .htaccess               # إعدادات Apache
```

---

## ✨ المميزات

- 🔍 **بحث متقدم** حسب المدينة، التصنيف، نوع الدوام، الجنس
- 📱 **PWA كامل** — تثبيت على الجوال + وضع Offline
- 🔔 **Push Notifications** — إشعارات فورية عند نشر وظائف جديدة
- 📧 **نظام بريد** — تحقق بالبريد + إشعارات وظائف عبر EmailJS
- 🌐 **RTL كامل** — دعم العربية الكامل
- 🍪 **Cookie Consent** — موافقة مع دعم Google Consent Mode v2
- 🔒 **آمن** — HTTPS، HSTS، CSP، XSS Protection
- 🚀 **سريع** — GZIP، Browser Caching، DNS Prefetch
- 📊 **SEO محسّن** — Schema.org، Sitemap، Open Graph، Twitter Cards
- 💼 **لوحة إدارة كاملة** — إضافة/تعديل/حذف الوظائف، إحصائيات، مشتركون

---

## 🚀 الإطلاق السريع (محلياً)

```bash
# لا يلزم تثبيت أي شيء — فقح افتح index.html في المتصفح
# أو استخدم خادم محلي:
npx serve .
# أو
python -m http.server 8080
```

---

## 🌐 النشر على Hostinger

راجع ملف **[HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md)** للخطوات الكاملة.

---

## ⚙️ الإعدادات المطلوبة للإطلاق

| الإعداد | الملف | الحالة |
|---------|-------|--------|
| VAPID Keys | `push/config.php` + `js/push-notifications.js` | ⚠️ يتطلب تهيئة |
| Google Analytics ID | `index.html` (جميع الصفحات) | ⚠️ يتطلب تهيئة |
| Google AdSense Publisher ID | `ads.txt` | ⚠️ يتطلب تهيئة |
| EmailJS Settings | من لوحة الإدارة | اختياري |
| Google Search Console Verification | ملف HTML | بعد النشر |

---

## 📈 التقنيات المستخدمة

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend (Push):** PHP 8.0+
- **Storage:** localStorage (Front), JSON files (Push)
- **PWA:** Service Worker, Web App Manifest
- **Push:** Web Push Protocol + VAPID
- **Hosting:** Hostinger Shared/Cloud Hosting

---

## 📞 التواصل

- 🌐 [wadifatuk.com](https://wadifatuk.com)
- 🐦 [x.com/wadifatuk_](https://x.com/wadifatuk_)
- 📧 [admin@wadifatuk.com](mailto:admin@wadifatuk.com)

---

*© 2026 وظيفتك.com — جميع الحقوق محفوظة*
