// ============================================================
// SUPABASE CONFIG — بوست وظيفتك
// ✅ يستخدم PHP Proxy لتجاوز CORS تماماً
// ✅ Supabase Realtime — تحديث فوري بدون تحديث الصفحة
// ============================================================

// ── إعداد نقطة الاتصال ──
const _IS_LOCAL = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const _PROXY_URL  = '/api/sb-proxy.php?path=jobs';
const _DIRECT_URL = 'https://zkelkmfxjobrsnvyaanv.supabase.co/rest/v1/jobs';
const _BASE_URL   = _IS_LOCAL ? _DIRECT_URL : _PROXY_URL;

const SUPABASE_URL      = 'https://zkelkmfxjobrsnvyaanv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZWxrbWZ4am9icnNudnlhYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjEyMDMsImV4cCI6MjA5NzI5NzIwM30.4DlZhfnxOKeitCqjt9_1Anw00XkDhKxcZnOQTj5EYck';

// ── Headers (للـ Direct فقط — الـ Proxy يضيفها تلقائياً) ──
const _SB_HEADERS = {
  'apikey':        SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type':  'application/json'
};

// ── متغيرات التوافق مع الكود القديم ──
let supabaseClient = true;
let _initPromise   = Promise.resolve(true);
function initSupabase()      { return true; }
function waitForSupabase()   { return Promise.resolve(true); }
function resetSupabaseInit() { /* no-op */ }

// ── دالة مساعدة: بناء رابط الطلب ──
function _buildUrl(extraQuery) {
  if (_IS_LOCAL) {
    return _DIRECT_URL + (extraQuery ? '&' + extraQuery : '');
  }
  return _PROXY_URL + (extraQuery ? '&' + extraQuery : '');
}

// ── دالة مساعدة: Headers حسب البيئة ──
function _getHeaders(extra) {
  if (_IS_LOCAL) {
    return Object.assign({}, _SB_HEADERS, extra || {});
  }
  return Object.assign({ 'Content-Type': 'application/json' }, extra || {});
}

// ── دالة مساعدة: تحقق من الاستجابة ──
async function _sbCheck(res) {
  if (res.ok) return res;
  let msg = 'HTTP ' + res.status;
  try {
    const j = await res.clone().json();
    msg = j.message || j.error || msg;
  } catch (_) {}
  throw new Error(msg);
}

// ── جلب جميع الوظائف ──
async function sbFetchJobs() {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12000);
  try {
    // ✅ إزالة t=timestamp من الـ URL — يُمرَّر لـ Supabase ويسبب مشاكل
    // منع الكاش يتم عبر cache: 'no-store' في الـ fetch headers فقط
    const url = _buildUrl('select=*&order=created_at.desc');
    const res = await fetch(url, {
      headers: _getHeaders(),
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(tid);
    await _sbCheck(res);
    return await res.json();
  } catch (e) {
    clearTimeout(tid);
    if (e.name === 'AbortError') throw new Error('انتهت مهلة الاتصال (12 ثانية)');
    throw e;
  }
}

// ── إضافة وظيفة جديدة ──
async function sbAddJob(jobData) {
  const url = _IS_LOCAL ? _DIRECT_URL : _PROXY_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: _getHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(jobData)
  });
  await _sbCheck(res);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

// ── تحديث وظيفة موجودة ──
async function sbUpdateJob(id, jobData) {
  const url = _IS_LOCAL
    ? _DIRECT_URL + '?id=eq.' + id
    : _PROXY_URL  + '&id=eq.' + id;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: _getHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(jobData)
  });
  await _sbCheck(res);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

// ── حذف وظيفة ──
async function sbDeleteJob(id) {
  const url = _IS_LOCAL
    ? _DIRECT_URL + '?id=eq.' + id
    : _PROXY_URL  + '&id=eq.' + id;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: _getHeaders()
  });
  await _sbCheck(res);
  return true;
}

// ── تحديث عداد المشاهدات ──
async function sbIncrementViews(id) {
  try {
    const getUrl = _IS_LOCAL
      ? _DIRECT_URL + '?id=eq.' + id + '&select=views'
      : _PROXY_URL  + '&id=eq.' + id + '&select=views';

    const getRes = await fetch(getUrl, { headers: _getHeaders() });
    if (!getRes.ok) return;
    const rows = await getRes.json();
    const currentViews = (rows[0] && rows[0].views) || 0;

    const patchUrl = _IS_LOCAL
      ? _DIRECT_URL + '?id=eq.' + id
      : _PROXY_URL  + '&id=eq.' + id;

    await fetch(patchUrl, {
      method: 'PATCH',
      headers: _getHeaders({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ views: currentViews + 1 })
    });
  } catch (e) {
    // تجاهل أخطاء المشاهدات بصمت
  }
}

// ================================================================
// ✅ Supabase Realtime — تحديث فوري عند أي تغيير في جدول jobs
// يعمل عبر WebSocket مباشرة مع Supabase (لا يحتاج proxy)
// ================================================================
let _realtimeWs = null;
let _realtimeRetryTimer = null;

function sbStartRealtime(onChangeCallback) {
  if (_realtimeWs && _realtimeWs.readyState === WebSocket.OPEN) return;
  if (_realtimeRetryTimer) { clearTimeout(_realtimeRetryTimer); _realtimeRetryTimer = null; }

  try {
    const wsUrl = 'wss://zkelkmfxjobrsnvyaanv.supabase.co/realtime/v1/websocket?apikey=' + SUPABASE_ANON_KEY + '&vsn=1.0.0';
    const ws = new WebSocket(wsUrl);
    _realtimeWs = ws;

    ws.onopen = () => {
      console.log('[Realtime] ✅ متصل بـ Supabase Realtime');
      // الانضمام لقناة جدول jobs
      ws.send(JSON.stringify({
        topic: 'realtime:public:jobs',
        event: 'phx_join',
        payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'jobs' }] } },
        ref: 'join-1'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const ev = msg.payload && msg.payload.data && msg.payload.data.type;
        if (ev === 'INSERT' || ev === 'UPDATE' || ev === 'DELETE') {
          console.log('[Realtime] 🔄 تغيير في jobs:', ev);
          if (typeof onChangeCallback === 'function') onChangeCallback(ev, msg.payload.data);
        }
        // heartbeat reply
        if (msg.event === 'heartbeat') {
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: null }));
        }
      } catch (e) { /* تجاهل */ }
    };

    ws.onerror = () => { /* تجاهل — سيُعاد الاتصال */ };
    ws.onclose = () => {
      _realtimeWs = null;
      console.log('[Realtime] 🔌 انقطع — سيُعاد بعد 8 ثوانٍ');
      _realtimeRetryTimer = setTimeout(() => sbStartRealtime(onChangeCallback), 8000);
    };
  } catch (e) {
    console.warn('[Realtime] ⚠️ غير مدعوم في هذه البيئة:', e.message);
  }
}

// ================================================================
// ✅ إدارة مشتركي البريد الإلكتروني في Supabase
// جدول: email_subscribers (يجب إنشاؤه في Supabase أولاً)
// ================================================================
const _SUBS_PROXY  = '/api/sb-proxy.php?path=email_subscribers';
const _SUBS_DIRECT = 'https://zkelkmfxjobrsnvyaanv.supabase.co/rest/v1/email_subscribers';

async function sbAddEmailSubscriber(email, name) {
  const url = _IS_LOCAL ? _SUBS_DIRECT : _SUBS_PROXY;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: _getHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify({
        email,
        name: name || '',
        active: true,
        subscribed_at: new Date().toISOString()
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.warn('[Supabase] فشل إضافة المشترك:', e.message);
    return null;
  }
}

async function sbGetEmailSubscribers() {
  const url = _IS_LOCAL
    ? _SUBS_DIRECT + '?select=*&order=subscribed_at.desc'
    : _SUBS_PROXY  + '&select=*&order=subscribed_at.desc';
  try {
    const res = await fetch(url, { headers: _getHeaders(), cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

async function sbRemoveEmailSubscriber(email) {
  const url = _IS_LOCAL
    ? _SUBS_DIRECT + '?email=eq.' + encodeURIComponent(email)
    : _SUBS_PROXY  + '&email=eq.' + encodeURIComponent(email);
  try {
    await fetch(url, {
      method: 'PATCH',
      headers: _getHeaders({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ active: false })
    });
    return true;
  } catch (e) {
    return false;
  }
}

// ── جلب عدد مشتركي Push (من الخادم) ──
async function sbGetPushSubscriberCount() {
  try {
    const res = await fetch('/push/subscribe.php', { method: 'GET' });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count || 0;
  } catch (e) {
    return 0;
  }
}

const _mode = _IS_LOCAL ? 'Direct (Local)' : 'PHP Proxy (Hostinger)';
console.log('[Supabase] ✅ جاهز | وضع الاتصال: ' + _mode);
