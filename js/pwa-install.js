/**
 * Smart PWA Installation Guide System
 * wadifatuk.com - وظيفتك
 * Version: 1.0.0
 */

(function () {
  'use strict';

  /* ─────────────────────────────────────────
     1. STORAGE HELPERS
  ───────────────────────────────────────── */
  var STORAGE_KEYS = {
    DISMISSED_AT   : 'pwa_install_prompt_dismissed_at',
    INSTALLED      : 'pwa_install_prompt_installed',
    NEVER_SHOW     : 'pwa_install_prompt_never_show',
    LATER_AT       : 'pwa_install_prompt_later_at',
    VISIT_COUNT    : 'pwa_install_visit_count',
  };

  var storage = {
    get: function (key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, val) {
      try { localStorage.setItem(key, val); } catch (e) { /* private mode */ }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };

  /* ─────────────────────────────────────────
     2. DEVICE / BROWSER DETECTION
  ───────────────────────────────────────── */
  var ua        = navigator.userAgent || '';
  var isMobile  = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(ua);
  var isIOS     = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);
  var isSafari  = /Safari/i.test(ua) && !/Chrome|CriOS|OPR|FxiOS/i.test(ua);
  var isChrome  = /Chrome|CriOS/i.test(ua);
  var isStandalone = (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );

  /* ─────────────────────────────────────────
     3. VISIT COUNTER
  ───────────────────────────────────────── */
  function incrementVisits() {
    var v = parseInt(storage.get(STORAGE_KEYS.VISIT_COUNT) || '0', 10);
    storage.set(STORAGE_KEYS.VISIT_COUNT, v + 1);
    return v + 1;
  }

  /* ─────────────────────────────────────────
     4. SHOULD SHOW LOGIC
  ───────────────────────────────────────── */
  function shouldShow() {
    if (!isMobile)        return false;
    if (isStandalone)     return false;
    if (storage.get(STORAGE_KEYS.INSTALLED) === '1')   return false;
    if (storage.get(STORAGE_KEYS.NEVER_SHOW) === '1')  return false;

    var visits = parseInt(storage.get(STORAGE_KEYS.VISIT_COUNT) || '0', 10);
    if (visits < 2) return false;

    var dismissed = storage.get(STORAGE_KEYS.DISMISSED_AT);
    if (dismissed) {
      var diff = Date.now() - parseInt(dismissed, 10);
      if (diff < 30 * 24 * 60 * 60 * 1000) return false; // 30 days
    }

    var later = storage.get(STORAGE_KEYS.LATER_AT);
    if (later) {
      var diffL = Date.now() - parseInt(later, 10);
      if (diffL < 7 * 24 * 60 * 60 * 1000) return false; // 7 days
    }

    return true;
  }

  /* ─────────────────────────────────────────
     5. ANALYTICS
  ───────────────────────────────────────── */
  function track(event, data) {
    try {
      if (typeof gtag === 'function') {
        gtag('event', event, data || {});
      }
      if (window.dataLayer) {
        window.dataLayer.push({ event: event });
      }
    } catch (e) {}
  }

  /* ─────────────────────────────────────────
     6. DEFERRED INSTALL PROMPT (Android)
  ───────────────────────────────────────── */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  /* ─────────────────────────────────────────
     7. BUILD HTML
  ───────────────────────────────────────── */
  function buildModal() {
    var div = document.createElement('div');
    div.id = 'pwaInstallModal';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-labelledby', 'pwaModalTitle');
    div.setAttribute('dir', 'rtl');

    var isIosFlow = isIOS && isSafari;

    /* --- steps HTML --- */
    var stepsHtml = '';
    if (isIosFlow) {
      stepsHtml = [
        '<div class="pwa-step">',
          '<div class="pwa-step-num">١</div>',
          '<div class="pwa-step-text">',
            '<span class="pwa-step-icon">📤</span>',
            ' اضغط زر <strong>المشاركة</strong> في شريط المتصفح',
          '</div>',
        '</div>',
        '<div class="pwa-step">',
          '<div class="pwa-step-num">٢</div>',
          '<div class="pwa-step-text">',
            '<span class="pwa-step-icon">🏠</span>',
            ' اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong>',
          '</div>',
        '</div>',
        '<div class="pwa-step">',
          '<div class="pwa-step-num">٣</div>',
          '<div class="pwa-step-text">',
            '<span class="pwa-step-icon">✅</span>',
            ' اضغط <strong>"إضافة"</strong>',
          '</div>',
        '</div>',
      ].join('');
      track('pwa_ios_instruction_viewed');
    } else if (isAndroid && !deferredPrompt) {
      stepsHtml = [
        '<div class="pwa-step">',
          '<div class="pwa-step-num">١</div>',
          '<div class="pwa-step-text">',
            '<span class="pwa-step-icon">⋮</span>',
            ' اضغط على <strong>قائمة المتصفح</strong> (النقاط الثلاث)',
          '</div>',
        '</div>',
        '<div class="pwa-step">',
          '<div class="pwa-step-num">٢</div>',
          '<div class="pwa-step-text">',
            '<span class="pwa-step-icon">📲</span>',
            ' اختر <strong>"تثبيت التطبيق"</strong> أو <strong>"Add to Home Screen"</strong>',
          '</div>',
        '</div>',
      ].join('');
    }

    var installBtnHtml = (isAndroid && deferredPrompt)
      ? '<button class="pwa-btn pwa-btn-primary" id="pwaInstallBtn"><span>📲</span> ثبّت التطبيق الآن</button>'
      : '';

    div.innerHTML = [
      '<div class="pwa-backdrop" id="pwaBackdrop"></div>',
      '<div class="pwa-sheet" id="pwaSheet" tabindex="-1">',

        /* close */
        '<button class="pwa-close" id="pwaCloseBtn" aria-label="إغلاق">×</button>',

        /* app identity */
        '<div class="pwa-identity">',
          '<div class="pwa-app-icon">💼</div>',
          '<div class="pwa-app-info">',
            '<h2 class="pwa-title" id="pwaModalTitle">ثبّت تطبيق وظيفتك</h2>',
            '<p class="pwa-tagline">احصل على الوظائف أولاً 🚀</p>',
          '</div>',
        '</div>',

        /* description */
        '<p class="pwa-desc">ثبّت التطبيق لتصلك إشعارات الوظائف الجديدة فور نشرها، مع وصول أسرع وتجربة مثالية.</p>',

        /* benefits */
        '<ul class="pwa-benefits">',
          '<li><span class="pwa-benefit-icon">🔔</span> إشعارات فورية للوظائف الجديدة</li>',
          '<li><span class="pwa-benefit-icon">⚡</span> فتح أسرع من المتصفح</li>',
          '<li><span class="pwa-benefit-icon">📱</span> تجربة تشبه التطبيقات الأصلية</li>',
          '<li><span class="pwa-benefit-icon">🏠</span> وصول سريع من الشاشة الرئيسية</li>',
        '</ul>',

        /* steps */
        stepsHtml ? '<div class="pwa-steps">' + stepsHtml + '</div>' : '',

        /* buttons */
        '<div class="pwa-actions">',
          installBtnHtml,
          '<button class="pwa-btn pwa-btn-secondary" id="pwaLaterBtn">لاحقاً</button>',
          '<button class="pwa-btn pwa-btn-ghost" id="pwaNeverBtn">لا تظهر مرة أخرى</button>',
        '</div>',

      '</div>',
    ].join('');

    document.body.appendChild(div);
  }

  /* ─────────────────────────────────────────
     8. SHOW / HIDE
  ───────────────────────────────────────── */
  function showModal() {
    var modal   = document.getElementById('pwaInstallModal');
    var sheet   = document.getElementById('pwaSheet');
    var backdrop = document.getElementById('pwaBackdrop');
    if (!modal) return;

    modal.classList.add('pwa-visible');
    setTimeout(function () {
      if (backdrop) backdrop.classList.add('pwa-fade-in');
      if (sheet)    sheet.classList.add('pwa-slide-up');
      if (sheet)    sheet.focus();
    }, 30);

    track('pwa_prompt_shown');
  }

  function hideModal(reason) {
    var modal   = document.getElementById('pwaInstallModal');
    var sheet   = document.getElementById('pwaSheet');
    var backdrop = document.getElementById('pwaBackdrop');
    if (!modal) return;

    if (sheet)    sheet.classList.remove('pwa-slide-up');
    if (backdrop) backdrop.classList.remove('pwa-fade-in');

    setTimeout(function () {
      modal.classList.remove('pwa-visible');
      if (reason === 'dismiss') {
        storage.set(STORAGE_KEYS.DISMISSED_AT, Date.now());
        track('pwa_prompt_dismissed');
      } else if (reason === 'later') {
        storage.set(STORAGE_KEYS.LATER_AT, Date.now());
        track('pwa_prompt_later');
      } else if (reason === 'never') {
        storage.set(STORAGE_KEYS.NEVER_SHOW, '1');
        track('pwa_prompt_never_show');
      }
    }, 350);
  }

  /* ─────────────────────────────────────────
     9. EVENT LISTENERS
  ───────────────────────────────────────── */
  function bindEvents() {
    /* Close (×) */
    var closeBtn = document.getElementById('pwaCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { hideModal('dismiss'); });
    }

    /* Backdrop click */
    var backdrop = document.getElementById('pwaBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function () { hideModal('dismiss'); });
    }

    /* Later */
    var laterBtn = document.getElementById('pwaLaterBtn');
    if (laterBtn) {
      laterBtn.addEventListener('click', function () { hideModal('later'); });
    }

    /* Never */
    var neverBtn = document.getElementById('pwaNeverBtn');
    if (neverBtn) {
      neverBtn.addEventListener('click', function () { hideModal('never'); });
    }

    /* Install (Android direct) */
    var installBtn = document.getElementById('pwaInstallBtn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        track('pwa_install_clicked');
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(function (choice) {
            if (choice.outcome === 'accepted') {
              storage.set(STORAGE_KEYS.INSTALLED, '1');
              track('pwa_install_success');
              hideModal('install');
            } else {
              hideModal('later');
            }
            deferredPrompt = null;
          }).catch(function () { hideModal('later'); });
        }
      });
    }

    /* ESC key */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('pwaInstallModal');
        if (modal && modal.classList.contains('pwa-visible')) {
          hideModal('dismiss');
        }
      }
    });

    /* Focus trap */
    var sheet = document.getElementById('pwaSheet');
    if (sheet) {
      sheet.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var focusable = sheet.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        var first = focusable[0];
        var last  = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      });
    }

    /* Installed externally */
    window.addEventListener('appinstalled', function () {
      storage.set(STORAGE_KEYS.INSTALLED, '1');
      track('pwa_install_success');
      hideModal('install');
    });
  }

  /* ─────────────────────────────────────────
     10. INIT
  ───────────────────────────────────────── */
  function init() {
    var visits = incrementVisits();

    if (!shouldShow()) return;

    buildModal();
    bindEvents();

    /* Show after 10 seconds */
    setTimeout(function () {
      if (document.getElementById('pwaInstallModal')) {
        showModal();
      }
    }, 10000);
  }

  /* Run after page load */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
