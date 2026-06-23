// ===== SUBSCRIPTION SYSTEM v2 – Double Opt-In + EmailJS =====
const SUBSCRIBERS_KEY  = 'wadifatuk_subscribers';
const EMAIL_LOGS_KEY   = 'wadifatuk_email_logs';
const EMAIL_QUEUE_KEY  = 'wadifatuk_email_queue';
const EMAIL_CFG_KEY    = 'wadifatuk_email_config';
const POPUP_SHOWN_KEY  = 'wadifatuk_popup_shown';
const POPUP_DELAY_MS   = 10000;

// ✅ رابط الموقع الفعلي – يُستخدم في روابط الإيميل
const SITE_URL = 'https://wadifatuk.com';


// ── Storage Helpers ──
function getSubscribers() {
  try { return JSON.parse(localStorage.getItem(SUBSCRIBERS_KEY) || '[]'); } catch { return []; }
}
function saveSubscribers(list) { localStorage.setItem(SUBSCRIBERS_KEY, JSON.stringify(list)); }

function getEmailLogs() {
  try { return JSON.parse(localStorage.getItem(EMAIL_LOGS_KEY) || '[]'); } catch { return []; }
}
function addEmailLog(log) {
  const logs = getEmailLogs();
  logs.unshift({ id: Date.now() + Math.random(), ...log, createdAt: new Date().toISOString() });
  if (logs.length > 500) logs.splice(500);
  localStorage.setItem(EMAIL_LOGS_KEY, JSON.stringify(logs));
}

function getEmailQueue() {
  try { return JSON.parse(localStorage.getItem(EMAIL_QUEUE_KEY) || '[]'); } catch { return []; }
}
function saveEmailQueue(q) {
  if (q.length > 1000) q.splice(1000);
  localStorage.setItem(EMAIL_QUEUE_KEY, JSON.stringify(q));
}

function getEmailConfig() {
  try { return JSON.parse(localStorage.getItem(EMAIL_CFG_KEY) || '{}'); } catch { return {}; }
}
window.saveEmailConfig = function(cfg) { localStorage.setItem(EMAIL_CFG_KEY, JSON.stringify(cfg)); };

// ── Token ──
function generateToken() {
  const arr = new Uint8Array(18);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// ── Validation ──
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()); }
function isBot(f) { const h = f.querySelector('[name="website"]'); return h && h.value.length > 0; }

// ── Subscriber Queries ──
function findSubscriber(email) {
  return getSubscribers().find(s => s.email.toLowerCase() === email.toLowerCase());
}
function isVerified(email) { const s = findSubscriber(email); return s && s.status === 'active'; }
function isPending(email)  { const s = findSubscriber(email); return s && s.status === 'pending'; }

// ── Add Subscriber (pending until email verified) ──
function addSubscriberPending(email) {
  const subscribers = getSubscribers();
  const existing = subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    if (existing.status === 'active')  return { success: false, duplicate: true };
    // pending or unsubscribed → refresh token and resend
    existing.status = 'pending';
    existing.active = false;
    existing.verifyToken  = generateToken();
    existing.unsubToken   = existing.unsubToken || generateToken();
    existing.pendingSince = new Date().toISOString();
    saveSubscribers(subscribers);
    return { success: true, resent: true, subscriber: existing };
  }
  const sub = {
    email: email.toLowerCase(),
    status: 'pending',
    active: false,
    verifyToken:  generateToken(),
    unsubToken:   generateToken(),
    subscribedAt: null,
    verifiedAt:   null,
    pendingSince: new Date().toISOString(),
    unsubscribedAt: null
  };
  subscribers.push(sub);
  saveSubscribers(subscribers);
  return { success: true, resent: false, subscriber: sub };
}

// ── Verify ──
function verifySubscription(token) {
  const subscribers = getSubscribers();
  const sub = subscribers.find(s => s.verifyToken === token);
  if (!sub) return { success: false, invalid: true };
  if (sub.status === 'active') return { success: true, alreadyVerified: true, subscriber: sub };
  sub.status = 'active';
  sub.active = true;
  sub.verifyToken  = null;
  sub.verifiedAt   = new Date().toISOString();
  sub.subscribedAt = sub.subscribedAt || sub.verifiedAt;
  saveSubscribers(subscribers);
  addEmailLog({ type: 'verify_confirmed', email: sub.email, status: 'success', subject: 'تأكيد الاشتراك' });

  // ✅ مزامنة مع Supabase (لا تنتظر — في الخلفية)
  if (typeof sbAddEmailSubscriber === 'function') {
    sbAddEmailSubscriber(sub.email, sub.name || '').catch(() => {});
  }

  return { success: true, subscriber: sub };
}


// ── Unsubscribe ──
function unsubscribeByToken(token) {
  const subscribers = getSubscribers();
  const sub = subscribers.find(s => s.unsubToken === token);
  if (!sub) return { success: false, invalid: true };
  if (sub.status === 'unsubscribed') return { success: true, already: true, subscriber: sub };
  sub.status = 'unsubscribed';
  sub.active = false;
  sub.unsubscribedAt = new Date().toISOString();
  saveSubscribers(subscribers);
  addEmailLog({ type: 'unsubscribe', email: sub.email, status: 'success', subject: 'إلغاء الاشتراك' });
  return { success: true, subscriber: sub };
}

function resubscribeByEmail(email) {
  const subscribers = getSubscribers();
  const sub = subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (!sub) return { success: false };
  sub.status = 'pending';
  sub.active = false;
  sub.verifyToken  = generateToken();
  sub.pendingSince = new Date().toISOString();
  saveSubscribers(subscribers);
  return { success: true, subscriber: sub };
}

// ── EmailJS Sending ──
async function loadEmailJS(publicKey) {
  if (typeof emailjs !== 'undefined') return true;
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => { try { emailjs.init({ publicKey }); res(true); } catch(e){ rej(e); } };
    s.onerror = () => rej(new Error('EmailJS load failed'));
    document.head.appendChild(s);
  });
}

async function sendVerificationEmail(subscriber) {
  const cfg = getEmailConfig();
  const verifyUrl = `${SITE_URL}/verify.html?token=${subscriber.verifyToken}`;
  const unsubUrl  = `${SITE_URL}/unsubscribe.html?token=${subscriber.unsubToken}`;

  if (!cfg.enabled || !cfg.serviceId || !cfg.publicKey) {
    addEmailLog({ type: 'verification', email: subscriber.email, status: 'demo',
      subject: 'تأكيد الاشتراك', note: 'EmailJS غير مهيأ – وضع العرض', verifyUrl });
    return { sent: false, verifyUrl };
  }
  try {
    await loadEmailJS(cfg.publicKey);
    await emailjs.send(cfg.serviceId, cfg.verifyTemplateId || 'template_verify', {
      to_email:   subscriber.email,
      site_name:  'وظيفتك.com',
      verify_url: verifyUrl,
      unsub_url:  unsubUrl,
      site_url:   SITE_URL
    });
    addEmailLog({ type: 'verification', email: subscriber.email, status: 'sent', subject: 'تأكيد الاشتراك' });
    return { sent: true };
  } catch(err) {
    const msg = err.text || err.message || String(err);
    addEmailLog({ type: 'verification', email: subscriber.email, status: 'failed', subject: 'تأكيد الاشتراك', error: msg, verifyUrl });
    return { sent: false, verifyUrl };
  }
}

// ── Job Notification (called from admin) ──
window.sendJobNotificationToSubscribers = async function(job) {
  const cfg = getEmailConfig();
  const activeSubs = getSubscribers().filter(s => s.status === 'active');
  if (!activeSubs.length) return { sent: 0, failed: 0, demo: 0, total: 0 };

  const jobUrl = `${SITE_URL}/job-detail.html?id=${job.id}`;
  let sent = 0, failed = 0, demo = 0;

  // Add queue entries
  const newItems = activeSubs.map(s => ({
    qId: `${Date.now()}_${Math.random().toString(36).substr(2,5)}`,
    jobId: job.id, email: s.email, status: 'queued', addedAt: new Date().toISOString()
  }));
  saveEmailQueue([...getEmailQueue(), ...newItems]);

  if (!cfg.enabled || !cfg.serviceId || !cfg.publicKey) {
    activeSubs.forEach(sub => {
      addEmailLog({ type: 'job_notification', email: sub.email, jobId: job.id,
        jobTitle: job.company, status: 'demo',
        subject: `وظيفة جديدة: ${job.company}`, note: 'وضع العرض' });
      demo++;
    });
    return { sent, failed, demo, total: activeSubs.length };
  }

  try { await loadEmailJS(cfg.publicKey); } catch(e) {
    activeSubs.forEach(sub => addEmailLog({ type: 'job_notification', email: sub.email,
      jobId: job.id, status: 'failed', error: 'EmailJS load failed' }));
    return { sent, failed: activeSubs.length, demo, total: activeSubs.length };
  }

  const BATCH = 5, DELAY = 1200;
  for (let i = 0; i < activeSubs.length; i += BATCH) {
    const batch = activeSubs.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(async sub => {
      try {
        await emailjs.send(cfg.serviceId, cfg.jobTemplateId || 'template_job', {
          to_email:        sub.email,
          job_company:     job.company,
          job_city:        job.cityName || '',
          job_salary:      job.salary || 'غير محدد',
          job_type:        job.typeName || '',
          job_description: (job.description || '').substring(0, 200),
          job_url:         jobUrl,
          unsub_url:       `${SITE_URL}/unsubscribe.html?token=${sub.unsubToken}`,
          site_name:       'وظيفتك.com',
          site_url:        SITE_URL
        });
        addEmailLog({ type: 'job_notification', email: sub.email, jobId: job.id,
          jobTitle: job.company, status: 'sent', subject: `وظيفة جديدة: ${job.company}` });
        sent++;
      } catch(err) {
        addEmailLog({ type: 'job_notification', email: sub.email, jobId: job.id,
          jobTitle: job.company, status: 'failed', error: err.text || String(err) });
        failed++;
      }
    }));
    if (i + BATCH < activeSubs.length) await new Promise(r => setTimeout(r, DELAY));
  }
  return { sent, failed, demo, total: activeSubs.length };
};

// ── Core Subscribe Handler ──
window.handleSubscribe = async function(formEl, successCallback) {
  const emailInput = formEl.querySelector('[data-sub-email]');
  const email = emailInput ? emailInput.value.trim() : '';
  if (isBot(formEl)) { if (successCallback) successCallback(); return; }
  if (!email) { shakeInput(emailInput); showSubError(formEl, 'الرجاء إدخال البريد الإلكتروني'); return; }
  if (!isValidEmail(email)) { shakeInput(emailInput); showSubError(formEl, 'البريد الإلكتروني غير صحيح'); return; }
  if (isVerified(email)) { showSubError(formEl, 'هذا البريد مشترك ومفعّل بالفعل 📧'); return; }

  const btn = formEl.querySelector('.sub-btn');
  const orig = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ...'; }

  const result = addSubscriberPending(email);
  if (!result.success) {
    if (btn) { btn.disabled = false; btn.innerHTML = orig; }
    showSubError(formEl, 'هذا البريد مشترك بالفعل 📧');
    return;
  }

  const emailResult = await sendVerificationEmail(result.subscriber);
  if (btn) { btn.disabled = false; btn.innerHTML = orig; }
  emailInput.value = '';
  clearSubError(formEl);

  if (emailResult.sent) {
    showSubSuccess(formEl, '📨 تم إرسال رسالة تحقق إلى بريدك. يرجى تأكيد الاشتراك من خلال الرابط المرسل.');
  } else {
    // Demo mode – show clickable verify link
    const verifyLink = `${SITE_URL}/verify.html?token=${result.subscriber.verifyToken}`;
    showSubSuccessWithLink(formEl,
      '📨 تم التسجيل! في وضع التجربة، اضغط على الرابط أدناه لتأكيد الاشتراك:',
      verifyLink
    );
  }
  if (successCallback) successCallback(email);
  if (typeof showToast === 'function') showToast('تحقق من بريدك لتفعيل الاشتراك 📧', 'success');
};

// ── UI Helpers ──
function showSubError(f, msg) {
  clearSubMessages(f);
  const el = document.createElement('div');
  el.className = 'sub-message sub-error';
  el.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
  f.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}
function showSubSuccess(f, msg) {
  clearSubMessages(f);
  const el = document.createElement('div');
  el.className = 'sub-message sub-success';
  el.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
  f.appendChild(el);
}
function showSubSuccessWithLink(f, msg, url) {
  clearSubMessages(f);
  const el = document.createElement('div');
  el.className = 'sub-message sub-success';
  el.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}<br>
    <a href="${url}" target="_blank" style="color:#86efac;font-weight:700;text-decoration:underline;margin-top:8px;display:inline-block">
      <i class="fas fa-check-double"></i> تأكيد الاشتراك الآن
    </a>`;
  f.appendChild(el);
}
function clearSubMessages(f) { f.querySelectorAll('.sub-message').forEach(m => m.remove()); }
function clearSubError(f)    { f.querySelectorAll('.sub-error').forEach(m => m.remove()); }
function shakeInput(el) {
  if (!el) return;
  el.classList.add('sub-shake');
  setTimeout(() => el.classList.remove('sub-shake'), 600);
}

// ── Page Handlers ──
function handleVerifyFromURL() {
  const token = new URLSearchParams(window.location.search).get('token');
  const container = document.getElementById('verifyMessage');
  if (!container) return;
  if (!token) { container.innerHTML = _card('❌', 'رابط غير صالح', 'لم يتم العثور على رمز التحقق.', 'index.html', 'الرئيسية'); return; }
  const r = verifySubscription(token);
  if (r.success && !r.alreadyVerified) {
    container.innerHTML = _card('🎉', 'تم تأكيد اشتراكك بنجاح!',
      `مرحباً بك! تم تفعيل اشتراك <strong>${r.subscriber.email}</strong>.<br>ستصلك الوظائف الجديدة تلقائياً.`,
      'jobs.html', 'تصفح الوظائف', '#10b981');
  } else if (r.alreadyVerified) {
    container.innerHTML = _card('✅', 'اشتراكك مفعّل مسبقاً',
      `البريد <strong>${r.subscriber.email}</strong> مشترك ومفعّل بالفعل.`, 'jobs.html', 'تصفح الوظائف');
  } else {
    container.innerHTML = _card('❌', 'رابط منتهٍ أو غير صالح',
      'انتهت صلاحية رمز التحقق. يرجى الاشتراك مجدداً.', 'index.html#newsletter', 'اشترك الآن');
  }
}

function handleUnsubscribeFromURL() {
  const token = new URLSearchParams(window.location.search).get('token')
             || new URLSearchParams(window.location.search).get('unsubscribe');
  const container = document.getElementById('unsubscribeMessage');
  if (!container) return;
  if (!token) { container.innerHTML = _card('❌', 'رابط غير صالح', 'لم يتم العثور على رمز إلغاء الاشتراك.', 'index.html', 'الرئيسية'); return; }
  const r = unsubscribeByToken(token);
  if (r.success && !r.already) {
    container.innerHTML = `<div class="unsub-card">
      <div class="unsub-icon">✅</div>
      <h2>تم إلغاء الاشتراك</h2>
      <p>تم إلغاء اشتراك <strong>${r.subscriber.email}</strong> بنجاح.<br>لن يصلك أي إشعارات بالوظائف الجديدة.</p>
      <button onclick="handleResubscribe('${r.subscriber.email}')" class="unsub-resub-btn">اشترك مجدداً</button>
      <a href="index.html" class="unsub-back-btn"><i class="fas fa-home"></i> العودة للرئيسية</a>
    </div>`;
  } else if (r.already) {
    container.innerHTML = `<div class="unsub-card">
      <div class="unsub-icon">ℹ️</div><h2>اشتراكك ملغى مسبقاً</h2>
      <p>البريد <strong>${r.subscriber.email}</strong> غير مشترك حالياً.</p>
      <button onclick="handleResubscribe('${r.subscriber.email}')" class="unsub-resub-btn">اشترك مجدداً</button>
      <a href="index.html" class="unsub-back-btn"><i class="fas fa-home"></i> الرئيسية</a>
    </div>`;
  } else {
    container.innerHTML = _card('❌', 'رابط غير صالح', 'هذا الرابط غير صالح أو منتهي الصلاحية.', 'index.html', 'الرئيسية');
  }
}

window.handleResubscribe = async function(email) {
  const r = resubscribeByEmail(email);
  if (!r.success) return;
  const er = await sendVerificationEmail(r.subscriber);
  const verifyUrl = `${SITE_URL}/verify.html?token=${r.subscriber.verifyToken}`;
  const container = document.getElementById('unsubscribeMessage');
  if (container) {
    container.innerHTML = `<div class="unsub-card">
      <div class="unsub-icon">📨</div><h2>تم إرسال رسالة التحقق</h2>
      <p>تم إرسال رسالة تحقق إلى <strong>${email}</strong>. يرجى التحقق من بريدك.</p>
      ${!er.sent ? `<a href="${verifyUrl}" class="unsub-back-btn" style="background:#10b981"><i class="fas fa-check"></i> تأكيد الاشتراك مباشرة</a>` : ''}
      <a href="index.html" class="unsub-back-btn"><i class="fas fa-home"></i> الرئيسية</a>
    </div>`;
  }
};

function _card(icon, title, body, href, btnText, btnColor = '#1a56db') {
  return `<div class="unsub-card">
    <div class="unsub-icon">${icon}</div>
    <h2>${title}</h2><p>${body}</p>
    <a href="${href}" class="unsub-back-btn" style="background:${btnColor}">${btnText}</a>
    <a href="index.html" class="unsub-back-btn">الرئيسية</a>
  </div>`;
}

// ── Popup ──
function createSubscribePopup() {
  if (document.getElementById('subPopupOverlay')) return;
  if (localStorage.getItem(POPUP_SHOWN_KEY)) return;
  const overlay = document.createElement('div');
  overlay.id = 'subPopupOverlay'; overlay.className = 'sub-popup-overlay';
  overlay.innerHTML = `<div class="sub-popup" role="dialog" aria-modal="true" aria-labelledby="subPopupTitle">
    <button class="sub-popup-close" id="subPopupClose" aria-label="إغلاق"><i class="fas fa-times"></i></button>
    <div class="sub-popup-icon"><i class="fas fa-envelope-open-text"></i></div>
    <h2 class="sub-popup-title" id="subPopupTitle">اشترك ليصلك أحدث الوظائف</h2>
    <p class="sub-popup-desc">أدخل بريدك الإلكتروني لتصلك الوظائف الجديدة تلقائيًا.</p>
    <form class="sub-form sub-form-card" id="popupSubForm" onsubmit="return false;" novalidate>
      <input type="text" name="website" style="display:none;position:absolute;left:-9999px" tabindex="-1" autocomplete="off">
      <input type="email" data-sub-email placeholder="أدخل بريدك الإلكتروني..." class="sub-input" autocomplete="email" id="popupSubEmail">
      <button type="submit" class="sub-btn" id="popupSubBtn"><i class="fas fa-paper-plane"></i> اشترك الآن</button>
    </form>
    <p class="sub-popup-privacy"><i class="fas fa-lock"></i> بريدك آمن معنا. لا إزعاج ولا مشاركة.</p>
    <button class="sub-popup-skip" id="subPopupSkip">لا شكراً، لاحقاً</button>
  </div>`;
  document.body.appendChild(overlay);
  document.getElementById('subPopupClose').addEventListener('click', closePopup);
  document.getElementById('subPopupSkip').addEventListener('click', closePopup);
  overlay.addEventListener('click', e => { if (e.target === overlay) closePopup(); });
  const form = document.getElementById('popupSubForm');
  form.querySelector('.sub-btn').addEventListener('click', () => handleSubscribe(form, () => setTimeout(closePopup, 3000)));
  form.querySelector('[data-sub-email]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleSubscribe(form, () => setTimeout(closePopup, 3000)); } });
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closePopup() {
  const o = document.getElementById('subPopupOverlay');
  if (o) { o.classList.remove('open'); setTimeout(() => o.remove(), 400); }
  localStorage.setItem(POPUP_SHOWN_KEY, '1');
}

// ── Init Forms ──
function initSubscribeForms() {
  document.querySelectorAll('[data-subscribe-form]').forEach(form => {
    const btn = form.querySelector('.sub-btn');
    const inp = form.querySelector('[data-sub-email]');
    if (btn) btn.addEventListener('click', e => { e.preventDefault(); handleSubscribe(form); });
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); handleSubscribe(form); } });
  });
}

// ── Auto Init ──
document.addEventListener('DOMContentLoaded', () => {
  initSubscribeForms();
  if (document.getElementById('verifyMessage'))      { handleVerifyFromURL();      return; }
  if (document.getElementById('unsubscribeMessage')) { handleUnsubscribeFromURL(); return; }
  // if (!localStorage.getItem(POPUP_SHOWN_KEY)) setTimeout(createSubscribePopup, POPUP_DELAY_MS);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopup(); });
});
