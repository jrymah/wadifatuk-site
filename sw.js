/* =========================================================
   Service Worker — وظيفتك.com  v6  (realtime-badge)
   Handles: Push Notifications + Badge Counter + PWA offline
   ========================================================= */
'use strict';

const SW_VERSION   = 'wadifatuk-sw-v6';
const ICON_URL     = '/images/icon-192x192.png';
const BADGE_URL    = '/images/icon-72x72.png';
const LATEST_URL   = '/push/latest.json';

/* ── Install ─────────────────────────────────────── */
self.addEventListener('install', (e) => {
  console.log('[SW] Install', SW_VERSION);
  e.waitUntil(self.skipWaiting());
});

/* ── Activate ────────────────────────────────────── */
self.addEventListener('activate', (e) => {
  console.log('[SW] Activate', SW_VERSION);
  e.waitUntil(clients.claim());
});

/* ══════════════════════════════════════════════════
   Push Notification Handler
   ══════════════════════════════════════════════════ */
self.addEventListener('push', (e) => {
  console.log('[SW] Push event received', e);

  e.waitUntil((async () => {
    // Default values
    let title   = 'وظيفتك 💼';
    let body    = 'وظيفة جديدة متاحة الآن! انقر للتفاصيل.';
    let url     = '/';
    let tag     = 'wadifatuk-job-' + Date.now();
    let icon    = ICON_URL;
    let badge   = BADGE_URL;

    /* ── Step 1: Try inline JSON payload (encrypted delivery) ── */
    if (e.data) {
      try {
        const d = e.data.json();
        if (d.title)  title  = String(d.title);
        if (d.body)   body   = String(d.body);
        if (d.url)    url    = String(d.url);
        if (d.tag)    tag    = String(d.tag);
        if (d.icon)   icon   = String(d.icon);
        if (d.badge)  badge  = String(d.badge);
        console.log('[SW] Payload from push data:', d);
      } catch (_) {
        try {
          const text = e.data.text();
          if (text) { body = text; console.log('[SW] Payload as text:', text); }
        } catch (_2) { /* ignore */ }
      }
    }

    /* ── Step 2: Fallback — fetch latest.json from server ── */
    const isDefault = body === 'وظيفة جديدة متاحة الآن! انقر للتفاصيل.';
    if (isDefault || !e.data) {
      try {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const r = await fetch(LATEST_URL + '?v=' + Date.now(), {
          cache : 'no-store',
          signal: controller.signal,
        });
        clearTimeout(tid);
        if (r.ok) {
          const d = await r.json();
          if (d.title) title = String(d.title);
          if (d.body)  body  = String(d.body);
          if (d.url)   url   = String(d.url);
          if (d.tag)   tag   = String(d.tag);
          if (d.icon)  icon  = String(d.icon);
          if (d.badge) badge = String(d.badge);
          console.log('[SW] Payload from latest.json:', d);
        }
      } catch (fetchErr) {
        console.warn('[SW] Could not fetch latest.json:', fetchErr.message);
      }
    }

    /* ── Normalize URL ──────────────────────────────────── */
    if (url && !url.startsWith('http')) {
      const base = self.registration.scope.replace(/\/$/, '');
      url = base + (url.startsWith('/') ? url : '/' + url);
    }

    console.log('[SW] Showing notification:', { title, body, url, tag });

    /* ── Show notification — always show even if payload missing ── */
    try {
      return await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        dir              : 'rtl',
        lang             : 'ar',
        tag,
        renotify         : true,
        requireInteraction: false,
        vibrate          : [200, 100, 200, 100, 200],
        data             : { url, tag },
        actions          : [
          { action: 'view',  title: '📋 عرض الوظيفة' },
          { action: 'close', title: '✖ إغلاق'        },
        ],
      });
    } catch (notifErr) {
      console.error('[SW] showNotification with actions failed:', notifErr.message);
      // Fallback: basic notification without actions (iOS compatibility)
      return self.registration.showNotification(title, {
        body,
        icon,
        dir  : 'rtl',
        lang : 'ar',
        tag,
        data : { url, tag },
      });
    }
    /* ── تحديث Badge التطبيق (عداد الإشعارات غير المقروءة) ── */
    try {
      if ('setAppBadge' in navigator) {
        // جلب عدد الإشعارات الحالية من السجل
        const notifications = await self.registration.getNotifications();
        await navigator.setAppBadge(notifications.length + 1);
      }
    } catch (_) { /* Badge API غير مدعومة في بعض المتصفحات */ }

  })());
});

/* ── Notification Click ──────────────────────────── */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  if (e.action === 'close') return;

  const notifUrl = e.notification.data?.url || '/';
  console.log('[SW] Notification clicked, opening:', notifUrl);

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // تصفير App Badge عند النقر
      if ('clearAppBadge' in navigator) { navigator.clearAppBadge().catch(() => {}); }

      // Focus existing window if open
      for (const win of wins) {
        if (win.url === notifUrl && 'focus' in win) {
          return win.focus();
        }
      }
      // Or focus any window on the same origin and navigate
      for (const win of wins) {
        if (win.url.startsWith(self.registration.scope) && 'focus' in win) {
          win.focus();
          return win.navigate(notifUrl);
        }
      }
      // Otherwise open a new window
      return clients.openWindow(notifUrl);
    })
  );
});

/* ── Notification Close ──────────────────────────── */
self.addEventListener('notificationclose', (e) => {
  console.log('[SW] Notification closed:', e.notification.tag);
});

/* ── Fetch (basic cache-first for shell) ─────────── */
self.addEventListener('fetch', (e) => {
  // Let push/subscribe through without caching
  if (e.request.url.includes('/push/')) return;
  // Default: network-first, no special caching
});
