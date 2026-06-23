# ✅ Pre-Submission Checklist — وظيفتك Google Play

## قبل الضغط على "Submit for Review"

---

## 🔧 التقني

### التطبيق والبناء
- [ ] ملف `app-release-bundle.aab` مبني بنجاح
- [ ] `versionCode` = 1 (يزيد مع كل إصدار)
- [ ] `versionName` = "1.0.0"
- [ ] `minSdkVersion` = 21 (Android 5.0+)
- [ ] `targetSdkVersion` = 34 (Android 14)
- [ ] التطبيق موقّع بـ keystore صحيح
- [ ] APK يُنصّب بدون أخطاء على جهاز حقيقي

### Digital Asset Links
- [ ] ملف `/.well-known/assetlinks.json` موجود على السيرفر
- [ ] SHA-256 fingerprint صحيح في assetlinks.json
- [ ] أداة Google تتحقق: https://developers.google.com/digital-asset-links/tools/generator
- [ ] الرد HTTP 200 مع Content-Type: application/json

### PWA على الموقع
- [ ] `https://www.wadifatuk.com/site.webmanifest` يعمل
- [ ] `https://www.wadifatuk.com/sw.js` يعمل (Service Worker)
- [ ] أيقونة 512×512 موجودة: `/images/icon-512x512.png`
- [ ] أيقونة maskable موجودة
- [ ] HTTPS مفعّل بالكامل

---

## 📱 متجر التطبيقات

### بيانات التطبيق الأساسية
- [ ] **اسم التطبيق:** وظيفتك — Wadifatuk (أو ما يناسب حد 30 حرف)
- [ ] **وصف قصير** مكتوب (80 حرف)
- [ ] **وصف كامل** مكتوب (4000 حرف)
- [ ] **رابط سياسة الخصوصية:** `https://www.wadifatuk.com/privacy.html`
- [ ] **بريد الدعم:** wadifatuk@gmail.com
- [ ] **رابط الموقع:** https://www.wadifatuk.com

### الأصول المرئية
- [ ] **App Icon** 512×512 PNG مرفوع ✅ (موجود في المشروع)
- [ ] **Feature Graphic** 1024×500 PNG مرفوع ⚠️ (يحتاج إنشاء)
- [ ] **Phone Screenshots** 2-8 صور (نسبة 9:16 أو 9:19.5) ⚠️
- [ ] الصور واضحة وتعكس محتوى التطبيق الفعلي

---

## 📋 النماذج الإلزامية

### Data Safety ✅
- [ ] قسم Data Safety مكتمل
- [ ] البريد الإلكتروني محدد كـ Optional
- [ ] Google Analytics محددة
- [ ] رابط حذف البيانات: `/unsubscribe.html`

### Content Rating ✅
- [ ] الاستبيان مكتمل
- [ ] التصنيف: Everyone (PEGI 3)
- [ ] لا يوجد محتوى عنيف أو للبالغين

### App Access ✅
- [ ] محدد: "All functionality is available without restrictions"
- [ ] (الموقع العام لا يحتاج تسجيل دخول)

### Ads Declaration ✅
- [ ] محدد: "Yes, my app contains ads" (Google AdSense)
- [ ] نوع الإعلانات: Banner

### Target Audience ✅
- [ ] الفئة العمرية: 18+
- [ ] لا يستهدف الأطفال: ✅ مؤكد

---

## 🔒 الأمان والامتثال

- [ ] لا يوجد كود malware أو مشبوه
- [ ] لا يوجد طلب صلاحيات غير ضرورية
- [ ] لا يوجد محتوى يخالف سياسات Google Play
- [ ] سياسة الخصوصية متوفرة ومحدّثة (مايو 2026)
- [ ] المحتوى مناسب للجميع

---

## 🎯 الفحص النهائي

- [ ] اختبرت التطبيق على جهاز حقيقي (Android 10+)
- [ ] الوظائف تظهر بشكل صحيح
- [ ] الإشعارات تعمل (Push Notifications)
- [ ] اللغة العربية RTL تعمل
- [ ] التطبيق لا يتعطل (No Crash)
- [ ] التطبيق لا يتجمد (No ANR)

---

## 🚀 الإرسال

- [ ] جميع البنود أعلاه محققة
- [ ] اضغط **"Send for review"**
- [ ] المراجعة: 3-7 أيام عمل

---

*وظيفتك.com | مايو 2026*
