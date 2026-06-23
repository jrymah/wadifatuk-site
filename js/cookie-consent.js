// ===== COOKIE CONSENT SYSTEM =====
const COOKIE_KEY = 'wadifatuk_cookie_consent';

function getCookieConsent() {
  try { return JSON.parse(localStorage.getItem(COOKIE_KEY) || 'null'); } catch { return null; }
}
function saveCookieConsent(prefs) {
  localStorage.setItem(COOKIE_KEY, JSON.stringify({ ...prefs, savedAt: new Date().toISOString() }));
}
function hasConsent() { return getCookieConsent() !== null; }

function applyConsent(prefs) {
  // Google Consent Mode (if GA is present)
  if (typeof gtag !== 'undefined') {
    gtag('consent', 'update', {
      analytics_storage:    prefs.analytics  ? 'granted' : 'denied',
      ad_storage:           prefs.advertising ? 'granted' : 'denied',
      ad_user_data:         prefs.advertising ? 'granted' : 'denied',
      ad_personalization:   prefs.advertising ? 'granted' : 'denied',
    });
  }
}

function createCookieBanner() {
  if (hasConsent()) { applyConsent(getCookieConsent()); return; }
  if (document.getElementById('cookieBanner')) return;

  // Load CSS if not already loaded
  if (!document.querySelector('link[href*="cookie-consent.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = (window.location.pathname.includes('/admin/') ? '../' : '') + 'css/cookie-consent.css';
    document.head.appendChild(link);
  }

  const banner = document.createElement('div');
  banner.id = 'cookieBanner';
  banner.className = 'cookie-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'إشعار ملفات تعريف الارتباط');
  banner.innerHTML = `
    <div class="cookie-banner-inner">
      <div class="cookie-icon">🍪</div>
      <div class="cookie-text">
        <h3>نستخدم ملفات تعريف الارتباط</h3>
        <p>نستخدم ملفات تعريف الارتباط لتحسين تجربتك وعرض الإعلانات المناسبة.
           <a href="cookie-policy.html">سياسة ملفات الارتباط</a></p>
      </div>
      <div class="cookie-actions">
        <button class="cookie-btn cookie-btn-accept" id="cookieAcceptAll">قبول الكل</button>
        <button class="cookie-btn cookie-btn-reject" id="cookieRejectNonEssential">رفض غير الضروري</button>
        <button class="cookie-btn cookie-btn-custom" id="cookieCustomize">تخصيص</button>
      </div>
    </div>`;

  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));

  document.getElementById('cookieAcceptAll').addEventListener('click', () => {
    const prefs = { necessary: true, analytics: true, advertising: true };
    saveCookieConsent(prefs); applyConsent(prefs); hideBanner();
  });
  document.getElementById('cookieRejectNonEssential').addEventListener('click', () => {
    const prefs = { necessary: true, analytics: false, advertising: false };
    saveCookieConsent(prefs); applyConsent(prefs); hideBanner();
  });
  document.getElementById('cookieCustomize').addEventListener('click', openCookieModal);
}

function hideBanner() {
  const b = document.getElementById('cookieBanner');
  if (b) { b.classList.remove('show'); setTimeout(() => b.remove(), 400); }
  const m = document.getElementById('cookieModalOverlay');
  if (m) { m.classList.remove('open'); setTimeout(() => m.remove(), 300); }
}

function openCookieModal() {
  if (document.getElementById('cookieModalOverlay')) return;
  const current = getCookieConsent() || { necessary: true, analytics: true, advertising: true };
  const overlay = document.createElement('div');
  overlay.id = 'cookieModalOverlay'; overlay.className = 'cookie-modal-overlay';
  overlay.innerHTML = `
    <div class="cookie-modal" role="dialog" aria-modal="true">
      <h2><i class="fas fa-cookie-bite"></i> تخصيص ملفات الارتباط</h2>
      <div class="cookie-toggle-row">
        <div class="cookie-toggle-info">
          <h4>الضرورية <span style="font-size:11px;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px">مطلوبة</span></h4>
          <p>ضرورية لعمل الموقع الأساسي (تسجيل الدخول، الجلسات).</p>
        </div>
        <label class="cookie-switch">
          <input type="checkbox" id="ckNecessary" checked disabled>
          <span class="cookie-switch-slider"></span>
        </label>
      </div>
      <div class="cookie-toggle-row">
        <div class="cookie-toggle-info">
          <h4>التحليلية</h4>
          <p>تساعدنا على فهم كيفية استخدامك للموقع وتحسينه.</p>
        </div>
        <label class="cookie-switch">
          <input type="checkbox" id="ckAnalytics" ${current.analytics ? 'checked' : ''}>
          <span class="cookie-switch-slider"></span>
        </label>
      </div>
      <div class="cookie-toggle-row">
        <div class="cookie-toggle-info">
          <h4>الإعلانية</h4>
          <p>تُستخدم لعرض إعلانات مناسبة لاهتماماتك (Google AdSense).</p>
        </div>
        <label class="cookie-switch">
          <input type="checkbox" id="ckAdvertising" ${current.advertising ? 'checked' : ''}>
          <span class="cookie-switch-slider"></span>
        </label>
      </div>
      <div class="cookie-modal-actions">
        <button class="cookie-btn cookie-btn-reject" id="ckSavePrefs">حفظ التفضيلات</button>
        <button class="cookie-btn cookie-btn-accept" id="ckAcceptAllModal">قبول الكل</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
  overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.classList.remove('open'); setTimeout(() => overlay.remove(), 300); } });
  document.getElementById('ckSavePrefs').addEventListener('click', () => {
    const prefs = {
      necessary:   true,
      analytics:   document.getElementById('ckAnalytics').checked,
      advertising: document.getElementById('ckAdvertising').checked
    };
    saveCookieConsent(prefs); applyConsent(prefs); hideBanner();
  });
  document.getElementById('ckAcceptAllModal').addEventListener('click', () => {
    const prefs = { necessary: true, analytics: true, advertising: true };
    saveCookieConsent(prefs); applyConsent(prefs); hideBanner();
  });
}

// Expose for settings page
window.resetCookieConsent = function() {
  localStorage.removeItem(COOKIE_KEY);
  location.reload();
};

// Auto init
document.addEventListener('DOMContentLoaded', createCookieBanner);
