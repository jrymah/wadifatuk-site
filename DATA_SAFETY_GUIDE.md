# 🛡️ Data Safety Guide — وظيفتك
# للملء في Google Play Console → Data Safety

## ما يجمعه التطبيق

### 1. هل يجمع التطبيق بيانات المستخدمين؟
✅ **نعم**

### 2. هل يتم مشاركة البيانات مع أطراف ثالثة؟
✅ **نعم** — Google Analytics فقط (بيانات مجهولة الهوية)

---

## جدول البيانات المجمّعة

| نوع البيانات | يُجمع؟ | المطلوب؟ | يُشارك؟ | الغرض | مشفّر؟ | يمكن الحذف؟ |
|-------------|--------|---------|--------|-------|--------|------------|
| البريد الإلكتروني | ✅ اختياري | لا | ❌ | إشعارات الوظائف | ✅ HTTPS | ✅ |
| Push Token | ✅ اختياري | لا | ❌ | إشعارات فورية | ✅ | ✅ |
| بيانات استخدام التطبيق | ✅ مجهول | لا | Google Analytics | تحسين الخدمة | ✅ | لا |
| Cookies الإعلانية | ✅ اختياري | لا | Google AdSense | الإعلانات | ✅ | ✅ |

---

## الإجابات الكاملة في Play Console

### قسم Data collection and security

**Does your app collect or share any of the required user data types?**
→ ✅ Yes

**Is all of the user data collected by your app encrypted in transit?**
→ ✅ Yes

**Do you provide a way for users to request that their data is deleted?**
→ ✅ Yes
→ الرابط: `https://www.wadifatuk.com/unsubscribe.html`

---

### قسم Data types

#### Personal info
- [ ] Name → ❌ لا نجمع
- [ ] Email address → ✅ **نجمع** (اختياري — للإشعارات)
- [ ] Phone number → ❌ لا نجمع
- [ ] Race and ethnicity → ❌
- [ ] Political or religious beliefs → ❌
- [ ] Personal identifiers → ❌

**للبريد الإلكتروني:**
- Collected: ✅
- Shared: ❌
- Purpose: App functionality (push notifications)
- Required: ❌ Optional
- Processed ephemerally: ❌

#### Web browsing
- App activity → ✅ **نجمع** (مجهول — Google Analytics)
  - Purpose: Analytics
  - Shared: ✅ Google Analytics

#### Device or other IDs
- Push Token → ✅ **نجمع** (لتوصيل الإشعارات)
  - Purpose: App functionality
  - Shared: ❌

---

## سياسة الخصوصية المطلوبة

**رابط السياسة:** `https://www.wadifatuk.com/privacy.html`

السياسة الموجودة تغطي:
- ✅ ما نجمعه
- ✅ كيف نستخدمه
- ✅ مشاركة الأطراف الثالثة
- ✅ حقوق المستخدم
- ✅ سياسة Cookies
- ✅ طريقة التواصل

---

## روابط مفيدة

- Data Safety Form: https://play.google.com/console → Policy → App content → Data safety
- Privacy Policy Generator: https://app-privacy-policy-generator.nisrulz.com/
- Data Safety Help: https://support.google.com/googleplay/android-developer/answer/10787469
