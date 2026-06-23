/**
 * push-notifications.js — وظيفتك.com  v3
 * Handles: SW registration, push subscription, permission prompt
 * Works on: Android Chrome, Samsung Internet, Desktop Chrome/Edge
 * Note: iOS Safari < 16.4 does NOT support web push (no fix possible).
 */
(function () {
  'use strict';

  /* ── Config ──────────────────────────────────── */
  var VAPID_PUBLIC_KEY = 'BAbfIgT3scWQH_IEbwfpbI36F3hABqKzc-3MkdihomtgfSUF7-5qSNHfedXTrdIh2wJgFUliozHPsoX8lcy30Vs';

  var SW_URL        = '/sw.js';
  var SUBSCRIBE_URL = '/push/subscribe.php';
  var STORAGE_KEY   = 'wdf_push_subscribed';
  var DISMISS_KEY   = 'wdf_push_dismissed';
  var COOLDOWN_MS   = 7 * 24 * 3600 * 1000; // 7 days

  /* ── Support Detection ───────────────────────── */
  function isSupported() {
    if (!('serviceWorker' in navigator)) return false;
    if (!('PushManager' in window))      return false;
    if (!('Notification' in window))     return false;
    return true;
  }

  function isMobileOrPWA() {
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;
    var isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return isMobile || isStandalone;
  }

  /* ── base64url → Uint8Array ──────────────────── */
  function urlBase64ToUint8Array(b64) {
    var padding = '='.repeat((4 - (b64.length % 4)) % 4);
    var base64  = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw     = window.atob(base64);
    var arr     = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  /* ── Storage helpers ─────────────────────────── */
  function storageGet(k)    { try { return localStorage.getItem(k); }    catch (e) { return null; } }
  function storageSet(k, v) { try { localStorage.setItem(k, v);    }    catch (e) {} }
  function storageRemove(k) { try { localStorage.removeItem(k);    }    catch (e) {} }

  /* ── Register Service Worker ─────────────────── */
  function registerSW() {
    return navigator.serviceWorker.register(SW_URL, { scope: '/', updateViaCache: 'none' })
      .then(function (reg) {
        console.log('[Push] SW registered, scope:', reg.scope);
        // Force update check
        reg.update().catch(function () {});
        return reg;
      });
  }

  /* ── Get SW Registration ─────────────────────── */
  function getRegistration() {
    // Use scope '/' not SW script URL — getRegistration() matches by scope
    return navigator.serviceWorker.getRegistration('/')
      .then(function (reg) {
        if (reg) return reg;
        return registerSW();
      });
  }

  /* ── Subscribe to Push ───────────────────────── */
  function subscribeToPush(registration) {
    if (!('PushManager' in window)) return Promise.reject(new Error('PushManager not available'));
    if (!VAPID_PUBLIC_KEY)          return Promise.reject(new Error('VAPID public key not set'));

    var appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    }).then(function (sub) {
      console.log('[Push] Subscribed:', sub.endpoint.substring(0, 60) + '...');
      return sub;
    });
  }

  /* ── Send subscription to server ─────────────── */
  function saveSubscription(sub) {
    var json = sub.toJSON();
    console.log('[Push] Saving subscription to server...', {
      endpoint : json.endpoint.substring(0, 60) + '...',
      hasP256dh: !!(json.keys && json.keys.p256dh),
      hasAuth  : !!(json.keys && json.keys.auth),
    });

    return fetch(SUBSCRIBE_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(json),
    })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (resp) {
      console.log('[Push] Server response:', resp);
      if (resp.ok) {
        storageSet(STORAGE_KEY, '1');
      }
      return resp;
    })
    .catch(function (err) {
      console.error('[Push] Failed to save subscription:', err);
    });
  }

  /* ── Remove subscription from server ─────────── */
  function removeSubscription(sub) {
    return fetch(SUBSCRIBE_URL, {
      method : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ endpoint: sub.endpoint }),
    })
    .then(function (r) { return r.json(); })
    .catch(function () {});
  }

  /* ── Do actual subscription flow ─────────────── */
  function doSubscribe(reg) {
    return subscribeToPush(reg)
      .then(function (sub) {
        storageSet(STORAGE_KEY, '1');
        return saveSubscription(sub);
      })
      .catch(function (err) {
        console.warn('[Push] Subscription failed:', err.message || err);
        if (err && err.name === 'NotAllowedError') {
          storageSet(DISMISS_KEY, Date.now());
        }
      });
  }

  /* ── Ask for notification permission ──────────── */
  function askPermission(reg) {
    var perm = Notification.permission;
    console.log('[Push] Notification permission:', perm);

    if (perm === 'granted') {
      doSubscribe(reg);
      return;
    }
    if (perm === 'denied') {
      console.log('[Push] Permission denied by user');
      return;
    }

    // Show custom banner first
    showPushBanner(function (agreed) {
      if (!agreed) {
        storageSet(DISMISS_KEY, Date.now());
        return;
      }
      Notification.requestPermission().then(function (newPerm) {
        console.log('[Push] Permission result:', newPerm);
        if (newPerm === 'granted') {
          doSubscribe(reg);
        } else {
          storageSet(DISMISS_KEY, Date.now());
        }
      });
    });
  }

  /* ── Main Init ───────────────────────────────── */
  function init() {
    if (!isSupported()) {
      console.log('[Push] Web Push not supported in this browser');
      return;
    }
    if (!isMobileOrPWA()) return;
    if (!VAPID_PUBLIC_KEY) {
      console.warn('[Push] VAPID public key not configured');
      return;
    }

    getRegistration()
      .then(function (reg) {
        // Check for existing subscription
        return reg.pushManager.getSubscription().then(function (existingSub) {
          if (existingSub) {
            console.log('[Push] Already subscribed, re-syncing with server...');
            storageSet(STORAGE_KEY, '1');
            // ALWAYS re-send to server — fixes case where subscriptions.json
            // was cleared or subscription expired and was re-created by browser
            var lastSync = storageGet('wdf_push_sync_ts');
            var syncAge  = lastSync ? (Date.now() - parseInt(lastSync, 10)) : Infinity;
            var ONE_DAY  = 24 * 3600 * 1000;
            if (syncAge > ONE_DAY) {
              saveSubscription(existingSub).then(function (resp) {
                if (resp && resp.ok) {
                  storageSet('wdf_push_sync_ts', String(Date.now()));
                  console.log('[Push] Server sync OK:', resp.msg);
                }
              });
            }
            return;
          }

          // Check cooldown
          var dismissed = storageGet(DISMISS_KEY);
          if (dismissed) {
            var diff = Date.now() - parseInt(dismissed, 10);
            if (diff < COOLDOWN_MS) {
              console.log('[Push] In cooldown, wait', Math.round((COOLDOWN_MS - diff)/3600000), 'hrs');
              return;
            }
          }

          // Shorter delay for better UX — 4 seconds
          setTimeout(function () {
            askPermission(reg);
          }, 4000);
        });
      })
      .catch(function (err) {
        console.warn('[Push] Init error:', err);
      });
  }

  /* ── Push Permission Banner ──────────────────── */
  function showPushBanner(callback) {
    if (document.getElementById('wdfPushBanner')) return;

    var style = document.createElement('style');
    style.textContent = [
      '#wdfPushBanner{position:fixed;bottom:0;left:0;right:0;z-index:99998;padding:12px 16px;',
        'background:#0f172a;color:#fff;font-family:"Tajawal",sans-serif;',
        'box-shadow:0 -4px 24px rgba(0,0,0,0.3);animation:wdfSlideUp 0.4s ease;}',
      '@keyframes wdfSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}',
      '.wdf-push-inner{display:flex;align-items:center;gap:12px;max-width:560px;margin:0 auto;}',
      '.wdf-push-icon{font-size:26px;flex-shrink:0;}',
      '.wdf-push-text{flex:1;display:flex;flex-direction:column;gap:2px;}',
      '.wdf-push-text strong{font-size:14px;font-weight:700;}',
      '.wdf-push-text span{font-size:12px;color:#94a3b8;}',
      '.wdf-push-actions{display:flex;gap:8px;flex-shrink:0;}',
      '#wdfPushAllow{background:#16a34a;color:#fff;border:none;padding:9px 16px;border-radius:10px;',
        'font-family:"Tajawal",sans-serif;font-size:13px;font-weight:700;cursor:pointer;}',
      '#wdfPushDeny{background:rgba(255,255,255,0.1);color:#94a3b8;border:none;padding:9px 12px;',
        'border-radius:10px;font-family:"Tajawal",sans-serif;font-size:13px;cursor:pointer;}',
    ].join('');

    var banner = document.createElement('div');
    banner.id  = 'wdfPushBanner';
    banner.setAttribute('dir', 'rtl');
    banner.innerHTML = [
      '<div class="wdf-push-inner">',
        '<div class="wdf-push-icon">🔔</div>',
        '<div class="wdf-push-text">',
          '<strong>فعّل الإشعارات</strong>',
          '<span>واحصل على أحدث الوظائف فور نشرها</span>',
        '</div>',
        '<div class="wdf-push-actions">',
          '<button id="wdfPushAllow">تفعيل</button>',
          '<button id="wdfPushDeny">لاحقاً</button>',
        '</div>',
      '</div>',
    ].join('');

    document.head.appendChild(style);
    document.body.appendChild(banner);

    document.getElementById('wdfPushAllow').onclick = function () {
      banner.remove();
      callback(true);
    };
    document.getElementById('wdfPushDeny').onclick = function () {
      banner.remove();
      callback(false);
    };
  }

  /* ── Public API ──────────────────────────────── */
  window.WdfPush = {
    init: init,

    isSupported: isSupported,

    isSubscribed: function () {
      return storageGet(STORAGE_KEY) === '1';
    },

    getSubscription: function () {
      if (!isSupported()) return Promise.resolve(null);
      return navigator.serviceWorker.ready
        .then(function (reg) { return reg.pushManager.getSubscription(); })
        .catch(function () { return null; });
    },

    subscribe: function () {
      if (!isSupported()) return Promise.reject(new Error('Not supported'));
      return getRegistration().then(function (reg) {
        return Notification.requestPermission().then(function (perm) {
          if (perm !== 'granted') throw new Error('Permission denied');
          return doSubscribe(reg);
        });
      });
    },

    unsubscribe: function () {
      if (!isSupported()) return Promise.resolve();
      return navigator.serviceWorker.ready
        .then(function (reg) { return reg.pushManager.getSubscription(); })
        .then(function (sub) {
          if (!sub) return;
          return sub.unsubscribe().then(function (ok) {
            if (ok) {
              removeSubscription(sub);
              storageRemove(STORAGE_KEY);
              storageRemove('wdf_push_sync_ts');
            }
          });
        });
    },

    diagnose: function () {
      var info = {
        supported           : isSupported(),
        serviceWorker       : 'serviceWorker' in navigator,
        pushManager         : 'PushManager' in window,
        notification        : 'Notification' in window,
        permission          : 'Notification' in window ? Notification.permission : 'N/A',
        isMobileOrPWA       : isMobileOrPWA(),
        vapidKeyConfigured  : !!VAPID_PUBLIC_KEY,
        storedSubscribed    : storageGet(STORAGE_KEY) === '1',
        userAgent           : navigator.userAgent,
      };
      console.table(info);
      return info;
    },
  };

  /* ── Boot ────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
