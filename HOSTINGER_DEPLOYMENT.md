# 🚀 دليل النشر على Hostinger — وظيفتك.com

## نوع الاستضافة المطلوبة

يعمل هذا المشروع كموقع **Static HTML + PHP** على Hostinger **Shared Hosting** أو **Cloud Hosting**.

---

## 📋 متطلبات الاستضافة

| المتطلب | القيمة |
|---------|--------|
| PHP | 8.0 أو أعلى |
| Extensions | `curl`, `openssl`, `json` |
| SSL | مطلوب (Let's Encrypt مجاني) |
| .htaccess | مدعوم (Apache mod_rewrite) |
| Storage | 500MB+ موصى به |

---

## 🔧 خطوات النشر الكاملة

### الخطوة 1: رفع الملفات

1. سجّل الدخول إلى **Hostinger hPanel**
2. انتقل إلى **File Manager** أو استخدم **FTP** (بيانات FTP في cPanel)
3. ارفع جميع ملفات المشروع إلى مجلد `public_html/`
4. تأكد من رفع ملف `.htaccess` (يكون مخفياً في بعض الأحيان)

### الخطوة 2: تهيئة النطاق

1. في **hPanel → Domains** → أضف النطاق `wadifatuk.com`
2. في مسجّل النطاق، وجّه DNS إلى Hostinger:
   ```
   Nameserver 1: ns1.dns-parking.com
   Nameserver 2: ns2.dns-parking.com
   ```
   > (أو استخدم A Record يشير إلى IP الاستضافة)

### الخطوة 3: تفعيل SSL

1. في **hPanel → SSL** → فعّل **Let's Encrypt SSL** مجاناً
2. تأكد من تفعيل **Force HTTPS Redirect**
3. تحقق من أن `.htaccess` يحتوي على إعادة التوجيه التلقائية ✅

### الخطوة 4: تهيئة Push Notifications

1. افتح المتصفح وانتقل إلى: `https://www.wadifatuk.com/push/setup.php`
2. انسخ **VAPID_PUBLIC_KEY** و**VAPID_PRIVATE_KEY_PEM**
3. افتح الملف `/push/config.php` وأضف المفاتيح:
   ```php
   define('VAPID_PUBLIC_KEY',      'YOUR_PUBLIC_KEY_HERE');
   define('VAPID_PRIVATE_KEY_PEM', '-----BEGIN EC PRIVATE KEY-----
   YOUR_PRIVATE_KEY_HERE
   -----END EC PRIVATE KEY-----');
   ```
4. افتح `/js/push-notifications.js` وضع المفتاح العام في:
   ```js
   var VAPID_PUBLIC_KEY = 'YOUR_PUBLIC_KEY_HERE';
   ```
5. **احذف** ملف `setup.php` بعد الانتهاء لأسباب أمنية!

### الخطوة 5: صلاحيات الملفات

```bash
# المجلد الرئيسي
chmod 755 public_html/
chmod 644 public_html/.htaccess

# مجلد push (يحتاج كتابة لـ subscriptions.json)
chmod 755 public_html/push/
chmod 666 public_html/push/subscriptions.json  # (إذا وُجد)
chmod 666 public_html/push/latest.json
```

---

## ⚙️ الإعدادات المطلوبة بعد النشر

### Google Analytics 4
1. أنشئ Property جديدة على [Google Analytics](https://analytics.google.com)
2. احصل على **Measurement ID** (يبدأ بـ `G-`)
3. في `index.html` وباقي الصفحات، ألغِ التعليق عن كود GA:
   ```html
   <!-- استبدل G-XXXXXXXXXX بـ Measurement ID الخاص بك -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
   ```

### Google Search Console
1. افتح [Google Search Console](https://search.google.com/search-console)
2. أضف النطاق `wadifatuk.com`
3. **طريقة التحقق المُوصى بها:** HTML file upload
4. ارفع ملف التحقق إلى `public_html/`
5. أضف Sitemap: `https://www.wadifatuk.com/sitemap.xml`

### Google AdSense
1. سجّل على [Google AdSense](https://www.google.com/adsense)
2. أضف موقعك: `wadifatuk.com`
3. انتظر الموافقة (عادةً 1-14 يوم)
4. بعد الموافقة، احصل على **Publisher ID** وحدّث `ads.txt`:
   ```
   google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0
   ```
5. في الصفحات، ألغِ التعليق عن وحدات AdSense وأضف كودك

### EmailJS (للبريد الإلكتروني)
1. أنشئ حساباً على [EmailJS](https://emailjs.com) (مجاني 200 رسالة/شهر)
2. أضف Email Service (Gmail/Outlook)
3. أنشئ قالبَين: `template_verify` و `template_job`
4. من لوحة إدارة الموقع `/admin/panel.html` → إعدادات البريد → أدخل البيانات

---

## 🔒 قائمة فحص الأمان قبل الإطلاق

- [ ] تم تفعيل SSL ✅
- [ ] `.htaccess` يعيد توجيه HTTP → HTTPS ✅
- [ ] ملف `push/setup.php` محذوف بعد الإعداد
- [ ] مفاتيح VAPID مخزنة بشكل آمن
- [ ] قاعدة بيانات `subscriptions.json` بصلاحيات محدودة
- [ ] ملفات `.env` و `.log` محجوبة بـ `.htaccess` ✅
- [ ] صفحة الإدارة محمية بكلمة مرور
- [ ] تم اختبار جميع نماذج الاتصال

---

## 📊 DNS Records المطلوبة

| النوع | الاسم | القيمة | TTL |
|-------|-------|--------|-----|
| A | @ | IP الاستضافة | 3600 |
| A | www | IP الاستضافة | 3600 |
| CNAME | mail | smtp.hostinger.com | 3600 |
| MX | @ | mx1.hostinger.com | 3600 |
| TXT | @ | v=spf1 include:_spf.hostinger.com ~all | 3600 |

---

## 🌐 اختبار النشر

بعد الرفع، تحقق من:

```
✅ https://www.wadifatuk.com/           → الصفحة الرئيسية
✅ https://www.wadifatuk.com/jobs.html  → صفحة الوظائف
✅ https://www.wadifatuk.com/sitemap.xml → Sitemap
✅ https://www.wadifatuk.com/robots.txt  → Robots
✅ https://www.wadifatuk.com/ads.txt     → AdSense
✅ https://www.wadifatuk.com/sw.js       → Service Worker
✅ https://www.wadifatuk.com/site.webmanifest → PWA Manifest
✅ https://wadifatuk.com/               → يُعيد التوجيه إلى www ✅
✅ http://wadifatuk.com/               → يُعيد التوجيه إلى https ✅
```

---

## 🆘 حل المشكلات الشائعة

| المشكلة | الحل |
|---------|------|
| `.htaccess` لا يعمل | تأكد من تفعيل `mod_rewrite` في cPanel |
| PHP لا يعمل | تأكد من إضافة `.php` handler |
| Push لا يعمل | تحقق من مفاتيح VAPID وصلاحيات الملفات |
| SSL لا يعمل | انتظر 24 ساعة بعد التفعيل |
| الصور لا تظهر | تحقق من صلاحيات `chmod 644` |

---

*وثيقة أُعدّت لإطلاق وظيفتك.com | آخر تحديث: مايو 2026*
