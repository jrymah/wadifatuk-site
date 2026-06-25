// ===== ADMIN JS — Supabase Edition =====
// NOTE: Credentials are stored client-side for demo purposes only.
const ADMIN_CREDENTIALS = { username: 'jrymah', password: 'Aajrymah@4431' };

// ── Supabase Admin Helpers ─────────────────────────────────
// يعتمد على supabase-config.js المُحمَّل قبله في الـ HTML

async function reloadAdminJobs() {
  try {
    await loadJobsFromSupabase();
  } catch(e) {
    console.warn('[Admin] تعذّر إعادة تحميل الوظائف:', e.message);
  }
}

/* ── Compute admin token (للإشعارات Push فقط) ── */
async function getAdminToken() {
  const raw = 'Aajrymah@4431_BAbfIgT3scWQH_IEbwfpbI36F3hABqKzc-3MkdihomtgfSUF7-5qSNHfedXTrdIh2wJgFUliozHPsoX8lcy30Vs';
  const enc = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  return 'wdf_adm_' + hex;
}
let _adminToken = null;
async function adminToken() {
  if (!_adminToken) _adminToken = await getAdminToken();
  return _adminToken;
}

// Auth
function isLoggedIn() { return sessionStorage.getItem('admin_logged_in') === 'true'; }
function login(u, p) {
  if (u === ADMIN_CREDENTIALS.username && p === ADMIN_CREDENTIALS.password) {
    sessionStorage.setItem('admin_logged_in', 'true');
    return true;
  }
  return false;
}
function logout() { sessionStorage.removeItem('admin_logged_in'); window.location.href = 'index.html'; }

// Toast
function adminToast(msg, type = '') {
  let t = document.getElementById('adminToast');
  if (!t) { t = document.createElement('div'); t.id = 'adminToast'; t.className = 'admin-toast'; document.body.appendChild(t); }
  t.className = `admin-toast ${type}`;
  t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i> ${msg}`;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Modal
function openModal(id) { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('open');
});

// Sidebar nav
function setActivePage(page) {
  document.querySelectorAll('.sidebar-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

function initSidebarNav() {
  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      showPage(page);
      setActivePage(page);
      if (window.innerWidth < 768) document.getElementById('adminSidebar').classList.remove('open');
    });
  });
  const toggle = document.getElementById('sidebarToggle');
  if (toggle) toggle.addEventListener('click', () => document.getElementById('adminSidebar').classList.toggle('open'));
}

function showPage(page) {
  document.querySelectorAll('.admin-page').forEach(p => p.style.display = 'none');
  const target = document.getElementById(`page-${page}`);
  if (target) target.style.display = 'block';
  document.getElementById('adminPageTitle').textContent = getPageTitle(page);
  if (page === 'dashboard') renderDashboard();
  else if (page === 'jobs') renderJobsTable();
  else if (page === 'add-job') renderAddJobForm();
  else if (page === 'categories') renderCategoriesPage();
  else if (page === 'stats') renderStatsPage();
  else if (page === 'subscribers') renderSubscribersPage();
  else if (page === 'email-logs') renderEmailLogsPage();
  else if (page === 'push') renderPushPage();
  else if (page === 'email-settings') renderEmailSettingsPage();
  else if (page === 'settings') renderSettingsPage();
}

function getPageTitle(page) {
  const titles = { dashboard: 'لوحة التحكم الرئيسية', jobs: 'إدارة الوظائف', 'add-job': 'إضافة وظيفة جديدة', categories: 'التصنيفات', stats: 'الإحصائيات والتقارير', subscribers: 'إدارة المشتركين', 'email-logs': 'سجل البريد الإلكتروني', 'email-settings': 'إعدادات البريد', settings: 'الإعدادات', push: 'إشعارات الجوال (PWA Push)' };
  return titles[page] || 'لوحة التحكم';
}

// ===== DASHBOARD =====
async function renderDashboard() {
  // تحميل من Supabase أولاً
  try { await loadJobsFromSupabase(); } catch(e) {}

  const jobs = getJobs();
  const stats = getStats();
  const totalViews = jobs.reduce((s, j) => s + (j.views || 0), 0);
  const featured = jobs.filter(j => j.featured).length;

  document.getElementById('dashTotalJobs').textContent = jobs.length;
  document.getElementById('dashTotalViews').textContent = totalViews.toLocaleString('ar');
  document.getElementById('dashTotalVisits').textContent = (stats.totalVisits || 0).toLocaleString('ar');
  document.getElementById('dashTodayVisits').textContent = (stats.todayVisits || 0).toLocaleString('ar');
  const featuredEl = document.getElementById('dashFeatured');
  if (featuredEl) featuredEl.textContent = featured;

  // Subscribers count
  if (typeof getSubscribers === 'function') {
    const subs = getSubscribers();
    const activeSubs = subs.filter(s => s.active).length;
    const subEl = document.getElementById('dashTotalSubscribers');
    if (subEl) subEl.textContent = activeSubs;
    const badge = document.getElementById('subscribersBadge');
    if (badge) { badge.textContent = activeSubs; badge.style.display = activeSubs > 0 ? 'inline' : 'none'; }
  }

  renderVisitChart(stats);
  renderCategoryChart(jobs);
  renderRecentJobsTable(jobs);
  renderTopJobsTable(jobs);
}

function renderVisitChart(stats) {
  const container = document.getElementById('visitChartBars');
  if (!container) return;
  const daily = stats.dailyVisits || {};
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  const max = Math.max(...days.map(d => daily[d] || 0), 1);
  container.innerHTML = days.map(d => {
    const val = daily[d] || 0;
    const h = Math.max(Math.round((val / max) * 140), 4);
    const label = new Date(d).toLocaleDateString('ar-SA', { weekday: 'short' });
    return `<div class="visit-bar-wrap">
      <div class="visit-bar-num">${val}</div>
      <div class="visit-bar" style="height:${h}px"></div>
      <div class="visit-bar-label">${label}</div>
    </div>`;
  }).join('');
}

function renderCategoryChart(jobs) {
  const container = document.getElementById('categoryChartBars');
  if (!container) return;
  const counts = {};
  jobs.forEach(j => { counts[j.categoryName] = (counts[j.categoryName] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...sorted.map(s => s[1]), 1);
  const colors = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  container.innerHTML = sorted.map(([name, count], i) => {
    const h = Math.max(Math.round((count / max) * 160), 4);
    return `<div class="bar-wrap">
      <div class="bar-val">${count}</div>
      <div class="bar" style="height:${h}px;background:${colors[i]}" title="${name}: ${count}"></div>
      <div class="bar-label">${name.split(' ')[0]}</div>
    </div>`;
  }).join('');
}

function renderRecentJobsTable(jobs) {
  const tbody = document.getElementById('recentJobsTbody');
  if (!tbody) return;
  const recent = [...jobs].sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate)).slice(0, 5);
  tbody.innerHTML = recent.map(j => `
    <tr>
      <td><strong>${j.company}</strong><br><small style="color:var(--gray)"><i class="fas fa-map-marker-alt" style="font-size:11px"></i> ${j.cityName}</small></td>
      <td>${j.categoryName}</td>
      <td><span class="job-status status-active">نشط</span></td>
      <td>${j.views?.toLocaleString('ar') || 0}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon btn-view" onclick="window.open('../job-detail.html?id=${j.id}','_blank')" title="عرض"><i class="fas fa-eye"></i></button>
          <button class="btn-icon btn-edit" onclick="editJob(${j.id})" title="تعديل"><i class="fas fa-edit"></i></button>
          <button class="btn-icon btn-delete" onclick="confirmDeleteJob(${j.id})" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function renderTopJobsTable(jobs) {
  const tbody = document.getElementById('topJobsTbody');
  if (!tbody) return;
  const top = [...jobs].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  tbody.innerHTML = top.map((j, i) => `
    <tr>
      <td><span style="font-size:18px">${['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span></td>
      <td><strong>${j.company}</strong></td>
      <td><strong style="color:var(--primary)">${(j.views || 0).toLocaleString('ar')}</strong></td>
    </tr>`).join('');
}

// ===== JOBS TABLE =====
async function renderJobsTable() {
  const tbody = document.getElementById('adminJobsTbody');
  if (!tbody) return;

  // عرض spinner أثناء التحميل
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray)">
    <i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:8px;display:block"></i>
    جاري تحميل الوظائف من Supabase...
  </td></tr>`;

  // إعادة تحميل من Supabase دائماً عند فتح الصفحة
  try {
    await loadJobsFromSupabase();
  } catch(e) {
    console.warn('[Admin] تعذّر تحميل الوظائف:', e.message);
  }

  const jobs = getJobs();
  document.getElementById('adminJobsCount').textContent = `${jobs.length} وظيفة`;
  if (!jobs.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--gray)">
      <i class="fas fa-briefcase" style="font-size:36px;margin-bottom:12px;display:block;opacity:.3"></i>
      لا توجد وظائف — أضف أولى وظيفة!
    </td></tr>`;
    return;
  }
  const genderBadge = (gender) => {
    if (gender === 'إناث') return `<span style="background:#fce7f3;color:#db2777;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">👩 للنساء</span>`;
    if (gender === 'ذكور') return `<span style="background:#eff6ff;color:#2563eb;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">👨 للرجال</span>`;
    return `<span style="background:#f1f5f9;color:#64748b;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">للجنسين</span>`;
  };
  const statusBadge = (job) => {
    const isClosed = job.status === 'closed' ||
      (job.deadline && job.deadline !== 'حتى الاكتفاء' && new Date(job.deadline) < new Date());
    return isClosed
      ? `<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">✖ منتهي</span>`
      : `<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">✔ متاح</span>`;
  };
  tbody.innerHTML = jobs.map(j => `
    <tr>
      <td><div style="font-weight:700">${j.logo} ${j.company}</div><small style="color:var(--gray)"><i class="fas fa-map-marker-alt" style="font-size:11px"></i> ${j.cityName}</small></td>
      <td><span style="background:#eef2ff;color:#4f46e5;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">${j.categoryName}</span></td>
      <td>${j.typeName}</td>
      <td>${j.salary}</td>
      <td>${genderBadge(j.gender)}</td>
      <td>${statusBadge(j)}</td>
      <td>${(j.views || 0).toLocaleString('ar')}</td>
      <td>
        <div class="table-actions">
          <button class="btn-icon btn-view" onclick="window.open('../job-detail.html?id=${j.id}','_blank')" title="عرض"><i class="fas fa-eye"></i></button>
          <button class="btn-icon btn-edit" onclick="editJob('${j.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
          <button class="btn-icon btn-delete" onclick="confirmDeleteJob('${j.id}')" title="حذف"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

// ===== ADD/EDIT JOB =====
let editingJobId = null;

function renderAddJobForm(jobData = null) {
  editingJobId = jobData ? jobData.id : null;
  const isEdit = !!jobData;
  const f = jobData || {};
  document.getElementById('jobFormTitle').textContent = isEdit ? 'تعديل الإعلان' : 'إضافة إعلان جديد';
  document.getElementById('fCompany').value = f.company || '';
  document.getElementById('fLogo').value = f.logo || '';
  // Update logo preview
  const preview = document.getElementById('logoPreview');
  if (preview) {
    if (f.logo && (f.logo.startsWith('data:') || f.logo.startsWith('http'))) {
      preview.innerHTML = `<img src="${f.logo}" alt="logo">`;
    } else {
      preview.innerHTML = '<i class="fas fa-building"></i>';
    }
  }
  document.getElementById('fCity').value = f.city || '';
  document.getElementById('fCityName').value = f.cityName || '';
  document.getElementById('fCategory').value = f.category || '';
  document.getElementById('fType').value = f.type || 'fulltime';
  document.getElementById('fSalary').value = f.salary || '';
  document.getElementById('fExperience').value = f.experience || '';
  document.getElementById('fGender').value = f.gender || 'للجنسين';
  document.getElementById('fStatus').value = f.status || 'active';
  document.getElementById('fEducation').value = f.education || '';
  document.getElementById('fDescription').value = f.description || '';

  document.getElementById('fApplyUrl').value = f.applyUrl || '#';
  document.getElementById('fBadge').value = f.badge || '';
  // Deadline: show blank if it's 'حتى الاكتفاء'
  const dl = f.deadline === 'حتى الاكتفاء' ? '' : (f.deadline || '');
  document.getElementById('fDeadline').value = dl;
  document.getElementById('fFeatured').checked = f.featured || false;
}

async function saveJobForm() {
  const company  = document.getElementById('fCompany').value.trim();
  const city     = document.getElementById('fCity').value;
  const category = document.getElementById('fCategory').value;

  if (!company || !city || !category) {
    adminToast('يرجى ملء الحقول المطلوبة: الشركة، المنطقة، التصنيف', 'error');
    return;
  }

  // ✅ فحص الحد الأدنى للوصف (AdSense)
  const description = document.getElementById('fDescription').value.trim();
  const wordCount = description.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    adminToast(`⚠️ الوصف قصير جداً (${wordCount} كلمة). يجب 30 كلمة على الأقل لضمان قبول AdSense`, 'error');
    return;
  }

  const saveBtn = document.getElementById('saveJobBtn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ في Supabase...'; saveBtn.style.opacity = '0.8'; }

  const catObj  = CATEGORIES.find(c => c.id === category);
  const cityName = document.getElementById('fCityName').value || getCityDisplayName(city);
  const jobs     = getJobs();
  const typeVal  = document.getElementById('fType').value;

  // تحويل البيانات لتنسيق Supabase (snake_case)
  const jobData = {
    company,
    logo:          document.getElementById('fLogo').value || '🏢',
    city,
    city_name:     cityName,
    category,
    category_name: catObj ? catObj.name : category,
    type:          typeVal,
    type_name:     getTypeName(typeVal),
    salary:        document.getElementById('fSalary').value,
    experience:    document.getElementById('fExperience').value,
    gender:        document.getElementById('fGender').value,
    status:        document.getElementById('fStatus').value || 'active',
    education:     document.getElementById('fEducation').value,
    description,

    apply_url:     document.getElementById('fApplyUrl').value || '#',
    badge:         document.getElementById('fBadge').value || null,
    deadline:      document.getElementById('fDeadline').value || null,
    featured:      document.getElementById('fFeatured').checked,
  };

  try {
    if (editingJobId) {
      // ── تعديل وظيفة موجودة ──
      await sbUpdateJob(editingJobId, jobData);
      adminToast('✅ تم تعديل الوظيفة بنجاح — ظهرت للجميع فوراً', 'success');
    } else {
      // ── إضافة وظيفة جديدة ──
      const savedJob = await sbAddJob(jobData);
      adminToast('✅ تمت إضافة الوظيفة في Supabase — ظهرت للزوار فوراً 🎉', 'success');

      // ── إشعارات البريد الإلكتروني ──
      if (typeof sendJobNotificationToSubscribers === 'function') {
        sendJobNotificationToSubscribers(savedJob || jobData).then(r => {
          if (r && r.total > 0) {
            if (r.sent > 0) {
              adminToast(`📧 أُرسل إشعار البريد لـ ${r.sent} مشترك بنجاح`, 'success');
            } else if (r.demo > 0) {
              adminToast(`📧 ${r.demo} مشترك (وضع التجربة — أعدّ EmailJS أولاً)`, '');
            }
          } else {
            console.log('[Admin] لا يوجد مشتركون بريد بعد');
          }
        }).catch(() => {});
      }

      // ── إشعارات Push (جوال/متصفح) ──
      sendPushNotification(savedJob || jobData).then(res => {
        if (res && res.ok && res.total === 0) {
          console.log('[Push] لا يوجد مشتركون Push بعد');
        }
      }).catch(e => {
        console.warn('[Push] Auto-send failed silently:', e);
      });
    }

    // تحديث الـ cache من Supabase
    await reloadAdminJobs();

    editingJobId = null;
    showPage('jobs');
    setActivePage('jobs');

  } catch (err) {
    const errMsg = err.message || 'خطأ غير معروف';
    adminToast(`❌ فشل الحفظ: ${errMsg}`, 'error');
    console.error('[Supabase Admin Error]', err);

    // رسالة خطأ واضحة مع زر إعادة المحاولة
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fee2e2;border:2px solid #dc2626;border-radius:16px;padding:24px;z-index:9999;max-width:480px;font-size:15px;direction:rtl;text-align:right;box-shadow:0 8px 32px rgba(0,0,0,.2)';
    errDiv.innerHTML = `<div style="font-weight:800;color:#dc2626;margin-bottom:12px">❌ فشل حفظ الوظيفة</div>
      <div><strong>التفاصيل:</strong> ${errMsg}</div>
      <div style="margin-top:12px;background:#fef3c7;padding:10px;border-radius:8px;font-size:13px">
        💡 <strong>خطوات التحقق:</strong><br>
        1. تأكد من اتصالك بالإنترنت.<br>
        2. تأكد من إعدادات Supabase (الجدول: jobs، الصلاحيات: INSERT/UPDATE).<br>
        3. تأكد من اكتمال كافة البيانات المطلوبة.
      </div>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button id="retryJobSave" style="background:#4f46e5;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🔄 حاول مجدداً</button>
        <button onclick="this.parentElement.parentElement.remove()" style="background:#dc2626;color:#fff;border:none;padding:8px 18px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">إغلاق</button>
      </div>`;
    document.body.appendChild(errDiv);
    // زر إعادة المحاولة
    errDiv.querySelector('#retryJobSave')?.addEventListener('click', () => {
      errDiv.remove();
      if (typeof resetSupabaseInit === 'function') resetSupabaseInit();
      saveJobForm();
    });
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '';
      saveBtn.innerHTML = '<i class="fas fa-paper-plane"></i> حفظ ونشر وإرسال الإشعارات';
    }
  }
}

async function editJob(id) {
  let job = getJobById(id);
  if (!job) {
    // لم يُوجد في الـ cache — أعد التحميل من Supabase
    try { await loadJobsFromSupabase(); } catch(e) {}
    job = getJobById(id);
  }
  if (!job) { adminToast('⚠️ لم يُعثر على الوظيفة', 'error'); return; }
  showPage('add-job');
  setActivePage('add-job');
  renderAddJobForm(job);
}

function confirmDeleteJob(id) {
  window._deleteJobId = id;
  openModal('deleteModal');
}

async function deleteJobConfirmed() {
  const id  = window._deleteJobId;
  const btn = document.getElementById('confirmDeleteBtn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحذف...'; }

  try {
    await sbDeleteJob(id);
    closeModal('deleteModal');
    adminToast('✅ تم حذف الوظيفة من Supabase', 'success');
    await reloadAdminJobs();
    renderJobsTable();
    renderDashboard();
  } catch (err) {
    adminToast('❌ فشل الحذف: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> نعم، احذف'; }
  }
}

function getTypeName(type) {
  const map = { fulltime: 'دوام كامل', parttime: 'دوام جزئي', remote: 'عن بُعد' };
  return map[type] || type;
}

function getCityDisplayName(city) {
  const map = {
    // المناطق الإدارية الـ13
    'all-cities':'جميع المناطق',
    'region-riyadh':'منطقة الرياض',
    'region-makkah':'منطقة مكة المكرمة',
    'region-eastern':'المنطقة الشرقية',
    'region-madinah':'منطقة المدينة المنورة',
    'region-qassim':'منطقة القصيم',
    'region-asir':'منطقة عسير',
    'region-tabuk':'منطقة تبوك',
    'region-hail':'منطقة حائل',
    'region-northern':'منطقة الحدود الشمالية',
    'region-jizan':'منطقة جازان',
    'region-najran':'منطقة نجران',
    'region-bahah':'منطقة الباحة',
    'region-jawf':'منطقة الجوف',
    // المدن القديمة (للتوافق مع البيانات الموجودة)
    riyadh:'الرياض', kharj:'الخرج', dawadmi:'الدوادمي', majmaah:'المجمعة', shaqra:'شقراء',
    zulfi:'الزلفي', afif:'عفيف', 'wadi-dawasir':'وادي الدواسر', hawtah:'الحوطة',
    thadiq:'ثادق', rumah:'رماح', huraymila:'حريملاء', muzahimiyah:'المزاحمية',
    diriyah:'الدرعية', dilam:'الدلم', sulayyil:'السليل', 'al-quway':'القويعية',
    makkah:'مكة المكرمة', jeddah:'جدة', taif:'الطائف', rabigh:'رابغ',
    qunfudah:'القنفذة', lith:'الليث', khulays:'خليص', kamil:'الكامل',
    adham:'أضم', jomoom:'الجموم', turbah:'تربة', ranyah:'رنية', muwayh:'المويه',
    dammam:'الدمام', khobar:'الخبر', dhahran:'الظهران', ahsa:'الأحساء',
    qatif:'القطيف', jubail:'الجبيل', 'hafr-batin':'حفر الباطن', khafji:'الخفجي',
    nuayriyah:'النعيرية', buqayq:'بقيق', 'ras-tanura':'رأس تنورة', saihat:'سيهات',
    safwa:'صفوى', abqaiq:'أبقيق',
    madinah:'المدينة المنورة', yanbu:'ينبع', ula:'العُلا', khaybar:'خيبر',
    'mahd-dahab':'مهد الذهب', badr:'بدر', 'wadi-alfara':'وادي الفرع', hanakiyah:'الحناكية',
    buraydah:'بريدة', unayzah:'عنيزة', rass:'الرس', midhnab:'المذنب',
    bukayriyah:'البكيرية', nabhaniyah:'النبهانية', khubra:'الخبراء',
    dariyah:'ضرية', uyun:'عيون الجواء', 'riyadh-khabra':'رياض الخبراء',
    abha:'أبها', 'khamis-mushait':'خميس مشيط', bishah:'بيشة', 'sarat-abida':'سراة عبيدة',
    mahail:'محايل عسير', namas:'النماص', tanuma:'تنومة', 'rijal-alma':'رجال ألمع',
    balqarn:'بلقرن', tathlith:'تثليث', 'ahad-rufaidah':'أحد رفيدة',
    tabuk:'تبوك', alwajh:'الوجه', duba:'ضباء', haql:'حقل', tayma:'تيماء',
    amlaj:'أملج', qyal:'قيال', bad:'البدع', sharma:'شرما',
    hail:'حائل', baqaa:'البقعاء', ghazalah:'الغزالة', shinan:'الشنان',
    mawqaq:'موقق', smira:'سميراء',
    arar:'عرعر', rafha:'رفحاء', turaif:'طريف', uwayqilah:'العويقيلة',
    jizan:'جازان', 'abu-arish':'أبو عريش', sabya:'صبيا', samtah:'صامطة',
    darb:'الدرب', harth:'الحرث', arida:'العارضة', baysh:'بيش',
    farasan:'فرسان', 'ahad-masarihah':'أحد المسارحة',
    najran:'نجران', sharurah:'شرورة', habunah:'حبونا', yadmah:'يدمة',
    thar:'ثار', 'badr-najran':'بدر الجنوب',
    bahah:'الباحة', baljurashi:'بلجرشي', mukhwah:'المخواة', aqiq:'العقيق',
    hajarah:'الحجرة', qilwah:'قلوة', mandak:'المندق',
    jawf:'الجوف', sakaka:'سكاكا', qurayyat:'القريات',
    'dawmat-jandal':'دومة الجندل', tabarjal:'طبرجل'
  };
  return map[city] || city;
}

// Auto-fill city name
document.addEventListener('change', (e) => {
  if (e.target.id === 'fCity') {
    document.getElementById('fCityName').value = getCityDisplayName(e.target.value);
  }
});

// ===== CATEGORIES PAGE =====
function renderCategoriesPage() {
  const jobs = getJobs();
  const container = document.getElementById('categoriesTableBody');
  if (!container) return;
  container.innerHTML = CATEGORIES.map(cat => {
    const count = jobs.filter(j => j.category === cat.id).length;
    return `<tr>
      <td><span style="font-size:24px">${cat.icon}</span></td>
      <td><strong>${cat.name}</strong></td>
      <td>${cat.id}</td>
      <td><strong style="color:var(--primary)">${count}</strong></td>
      <td><span class="job-status status-active">نشط</span></td>
      <td><a href="../jobs.html?cat=${cat.id}" target="_blank" class="btn-icon btn-view" style="display:inline-flex"><i class="fas fa-eye"></i></a></td>
    </tr>`;
  }).join('');
}

// ===== STATS PAGE =====
function renderStatsPage() {
  const jobs = getJobs();
  const stats = getStats();
  const totalViews = jobs.reduce((s, j) => s + (j.views || 0), 0);

  document.getElementById('statsTotalVisits').textContent = (stats.totalVisits || 0).toLocaleString('ar');
  document.getElementById('statsTodayVisits').textContent = (stats.todayVisits || 0).toLocaleString('ar');
  document.getElementById('statsTotalJobs').textContent = jobs.length;
  document.getElementById('statsTotalViews').textContent = totalViews.toLocaleString('ar');

  // Top cities
  const cityCounts = {};
  jobs.forEach(j => { cityCounts[j.cityName] = (cityCounts[j.cityName] || 0) + (j.views || 0); });
  const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCity = Math.max(...topCities.map(c => c[1]), 1);
  const cityContainer = document.getElementById('cityStatsBar');
  if (cityContainer) {
    cityContainer.innerHTML = topCities.map(([name, val]) => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="font-weight:700">${name}</span>
          <span style="color:var(--primary);font-weight:700">${val}</span>
        </div>
        <div style="height:8px;background:var(--gray-light);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.round((val/maxCity)*100)}%;background:linear-gradient(90deg,#4f46e5,#818cf8);border-radius:4px;transition:width 0.8s"></div>
        </div>
      </div>`).join('');
  }

  // Top categories
  const catCounts = {};
  jobs.forEach(j => { catCounts[j.categoryName] = (catCounts[j.categoryName] || 0) + 1; });
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxCat = Math.max(...topCats.map(c => c[1]), 1);
  const catContainer = document.getElementById('catStatsBar');
  if (catContainer) {
    catContainer.innerHTML = topCats.map(([name, val]) => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
          <span style="font-weight:700">${name}</span>
          <span style="color:var(--accent);font-weight:700">${val} وظيفة</span>
        </div>
        <div style="height:8px;background:var(--gray-light);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.round((val/maxCat)*100)}%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:4px;transition:width 0.8s"></div>
        </div>
      </div>`).join('');
  }

  // Daily visits chart
  renderVisitChart(stats);
}

// ===== SETTINGS PAGE =====
function renderSettingsPage() {
  document.getElementById('settingSiteName').value = localStorage.getItem('site_name') || 'وظيفتك';
  document.getElementById('settingSiteEmail').value = localStorage.getItem('site_email') || '';
  document.getElementById('settingSitePhone').value = localStorage.getItem('site_phone') || '';
}

function saveSettings() {
  localStorage.setItem('site_name', document.getElementById('settingSiteName').value);
  localStorage.setItem('site_email', document.getElementById('settingSiteEmail').value);
  localStorage.setItem('site_phone', document.getElementById('settingSitePhone').value);
  adminToast('تم حفظ الإعدادات بنجاح', 'success');
}

function resetAllData() {
  if (confirm('هل أنت متأكد من إعادة ضبط الإحصائيات؟ (الوظائف المحفوظة على السيرفر لن تُحذف)')) {
    localStorage.removeItem('wadifatuk_stats');
    adminToast('تم إعادة ضبط الإحصائيات', 'warning');
    renderDashboard();
  }
}

// ===== EMAIL LOGS PAGE =====
function renderEmailLogsPage() {
  const logs = typeof getEmailLogs === 'function' ? getEmailLogs() : [];
  const filter = document.getElementById('logFilterType');
  const filterVal = filter ? filter.value : 'all';
  const filtered = filterVal === 'all' ? logs : logs.filter(l => l.type && l.type.includes(filterVal === 'verification' ? 'verify' : 'job'));

  const sent   = logs.filter(l => l.status === 'sent').length;
  const failed = logs.filter(l => l.status === 'failed').length;
  const demo   = logs.filter(l => l.status === 'demo').length;
  const setStat = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setStat('logStatSent', sent); setStat('logStatFailed', failed);
  setStat('logStatDemo', demo); setStat('logStatTotal', logs.length);

  const tbody = document.getElementById('emailLogsTbody');
  const table = document.getElementById('emailLogsTable');
  const empty = document.getElementById('logsEmptyState');
  if (!filtered.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (empty) empty.style.display = 'block';
  } else {
    if (table) table.style.display = '';
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = filtered.map((log, i) => {
      const statusMap = { sent: '✅ مرسل', failed: '❌ فشل', demo: '🧪 تجربة', success: '✅ نجاح', verify_confirmed: '✅ مؤكد', unsubscribe: '🔕 ملغى' };
      const typeMap = { verification: 'تحقق', job_notification: 'إشعار وظيفة', verify_confirmed: 'تأكيد', unsubscribe: 'إلغاء' };
      const date = new Date(log.createdAt).toLocaleString('ar-SA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
      const statusText = statusMap[log.status] || log.status;
      const statusColor = log.status === 'sent' || log.status === 'success' ? '#dcfce7' : log.status === 'failed' ? '#fee2e2' : '#fef3c7';
      const statusTxtColor = log.status === 'sent' || log.status === 'success' ? '#15803d' : log.status === 'failed' ? '#dc2626' : '#92400e';
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${log.email || ''}</strong></td>
        <td>${typeMap[log.type] || log.type || ''}</td>
        <td style="font-size:13px">${log.subject || ''}</td>
        <td><span style="background:${statusColor};color:${statusTxtColor};padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">${statusText}</span></td>
        <td style="font-size:12px">${date}</td>
      </tr>`;
    }).join('');
  }

  if (filter) filter.onchange = () => renderEmailLogsPage();
  const clearBtn = document.getElementById('clearLogsBtn');
  if (clearBtn) clearBtn.onclick = () => {
    if (!confirm('حذف جميع سجلات البريد؟')) return;
    localStorage.removeItem('wadifatuk_email_logs');
    adminToast('تم حذف السجل', 'success');
    renderEmailLogsPage();
  };
}

// ===== EMAIL SETTINGS PAGE =====
function renderEmailSettingsPage() {
  const cfg = typeof getEmailConfig === 'function' ? getEmailConfig() : {};
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = !!v; else el.value = v || ''; } };
  setVal('emailEnabled', cfg.enabled);
  setVal('emailServiceId', cfg.serviceId);
  setVal('emailPublicKey', cfg.publicKey);
  setVal('emailVerifyTemplate', cfg.verifyTemplateId || 'template_verify');
  setVal('emailJobTemplate', cfg.jobTemplateId || 'template_job');

  const saveBtn = document.getElementById('saveEmailCfgBtn');
  if (saveBtn) saveBtn.onclick = () => {
    const newCfg = {
      enabled:          document.getElementById('emailEnabled').checked,
      serviceId:        document.getElementById('emailServiceId').value.trim(),
      publicKey:        document.getElementById('emailPublicKey').value.trim(),
      verifyTemplateId: document.getElementById('emailVerifyTemplate').value.trim() || 'template_verify',
      jobTemplateId:    document.getElementById('emailJobTemplate').value.trim() || 'template_job'
    };
    if (typeof saveEmailConfig === 'function') saveEmailConfig(newCfg);
    adminToast('تم حفظ إعدادات البريد بنجاح', 'success');
  };

  const testBtn = document.getElementById('testEmailBtn');
  if (testBtn) testBtn.onclick = async () => {
    const email = prompt('أدخل بريدك الإلكتروني لارسال بريد تجريبي:');
    if (!email) return;
    const fakeSub = { email, verifyToken: 'test_token', unsubToken: 'test_unsub' };
    const r = await sendVerificationEmail(fakeSub);
    adminToast(r.sent ? 'تم إرسال بريد الاختبار بنجاح ✅' : 'فشل الإرسال - تحقق من الإعدادات ❌', r.sent ? 'success' : 'error');
  };
}


let _subFilterQuery = '';
let _subFilterStatus = 'all';

function renderSubscribersPage() {
  if (typeof getSubscribers !== 'function') {
    adminToast('مكتبة الاشتراك غير محملة', 'error');
    return;
  }
  const all = getSubscribers();
  const active = all.filter(s => s.active);
  const inactive = all.filter(s => !s.active);

  // Stats
  const sa = document.getElementById('subStatActive');
  const si = document.getElementById('subStatInactive');
  const st = document.getElementById('subStatTotal');
  if (sa) sa.textContent = active.length;
  if (si) si.textContent = inactive.length;
  if (st) st.textContent = all.length;

  // Badge in sidebar
  const badge = document.getElementById('subscribersBadge');
  if (badge) { badge.textContent = active.length; badge.style.display = active.length > 0 ? 'inline' : 'none'; }

  // Render table
  _renderSubTable();

  // Bind search & filter
  const searchInput = document.getElementById('subSearchInput');
  const filterSel   = document.getElementById('subFilterStatus');
  if (searchInput) { searchInput.value = ''; _subFilterQuery = ''; searchInput.oninput = e => { _subFilterQuery = e.target.value.toLowerCase(); _renderSubTable(); }; }
  if (filterSel)   { filterSel.value  = 'all'; _subFilterStatus = 'all'; filterSel.onchange = e => { _subFilterStatus = e.target.value; _renderSubTable(); }; }

  // Export CSV
  document.getElementById('exportSubsBtn')?.addEventListener('click', exportSubscribersCSV);

  // Clear all
  document.getElementById('clearAllSubsBtn')?.addEventListener('click', () => {
    if (!confirm('هل أنت متأكد من حذف جميع المشتركين؟')) return;
    localStorage.removeItem('wadifatuk_subscribers');
    adminToast('تم حذف جميع المشتركين', 'success');
    renderSubscribersPage();
  });
}

function _renderSubTable() {
  const all = getSubscribers();
  let filtered = all;
  if (_subFilterStatus === 'active')   filtered = filtered.filter(s => s.active);
  if (_subFilterStatus === 'inactive') filtered = filtered.filter(s => !s.active);
  if (_subFilterQuery) filtered = filtered.filter(s => s.email.toLowerCase().includes(_subFilterQuery));

  const tbody = document.getElementById('subscribersTbody');
  const emptyState = document.getElementById('subEmptyState');
  const table = document.getElementById('subscribersTable');

  if (!filtered.length) {
    if (tbody) tbody.innerHTML = '';
    if (table) table.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (table) table.style.display = '';
  if (emptyState) emptyState.style.display = 'none';

  // Sort: newest first
  const sorted = [...filtered].sort((a, b) => new Date(b.subscribedAt) - new Date(a.subscribedAt));

  tbody.innerHTML = sorted.map((sub, i) => {
    const date = new Date(sub.subscribedAt).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
    const statusBadge = sub.active
      ? `<span style="background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">✔ نشط</span>`
      : `<span style="background:#fee2e2;color:#dc2626;padding:3px 10px;border-radius:6px;font-size:12px;font-weight:700">✖ ملغى</span>`;
    // Build unsubscribe link (relative to root)
    const unsubLink = `../unsubscribe.html?unsubscribe=${sub.token}`;
    const toggleLabel = sub.active ? 'إلغاء الاشتراك' : 'تفعيل مجدداً';
    const toggleIcon = sub.active ? 'fas fa-ban' : 'fas fa-check';

    return `<tr>
      <td>${i + 1}</td>
      <td><strong>${sub.email}</strong></td>
      <td>${date}</td>
      <td>${statusBadge}</td>
      <td><a href="${unsubLink}" target="_blank" style="color:var(--primary);font-size:12px;text-decoration:underline">رابط إلغاء الاشتراك</a></td>
      <td>
        <div class="table-actions">
          <button class="btn-icon ${sub.active ? 'btn-delete' : 'btn-edit'}" onclick="adminToggleSub('${sub.email}')" title="${toggleLabel}">
            <i class="${toggleIcon}"></i>
          </button>
          <button class="btn-icon btn-delete" onclick="adminDeleteSub('${sub.email}')" title="حذف">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.adminToggleSub = function(email) {
  const subscribers = getSubscribers();
  const sub = subscribers.find(s => s.email === email);
  if (!sub) return;
  sub.active = !sub.active;
  sub[sub.active ? 'resubscribedAt' : 'unsubscribedAt'] = new Date().toISOString();
  localStorage.setItem('wadifatuk_subscribers', JSON.stringify(subscribers));
  adminToast(sub.active ? 'تم تفعيل المشترك' : 'تم إلغاء الاشتراك', 'success');
  renderSubscribersPage();
};

window.adminDeleteSub = function(email) {
  if (!confirm(`حذف ${email} نهائياً؟`)) return;
  const subscribers = getSubscribers().filter(s => s.email !== email);
  localStorage.setItem('wadifatuk_subscribers', JSON.stringify(subscribers));
  adminToast('تم حذف المشترك', 'success');
  renderSubscribersPage();
};

function exportSubscribersCSV() {
  const subscribers = getSubscribers();
  if (!subscribers.length) { adminToast('لا يوجد مشتركون لتصديرهم', 'error'); return; }
  const rows = [
    ['البريد الإلكتروني', 'تاريخ الاشتراك', 'الحالة'].join(','),
    ...subscribers.map(s => [
      s.email,
      new Date(s.subscribedAt).toLocaleDateString('ar-SA'),
      s.active ? 'نشط' : 'ملغى'
    ].join(','))
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `subscribers_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  adminToast('تم تصدير قائمة المشتركين بنجاح', 'success');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  const loginPage = document.getElementById('loginPage');
  const adminPanel = document.getElementById('adminPanel');

  if (loginPage) {
    // Login page
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const u = document.getElementById('loginUsername').value;
      const p = document.getElementById('loginPassword').value;
      const errEl = document.getElementById('loginError');
      if (login(u, p)) {
        window.location.href = 'panel.html';
      } else {
        errEl.style.display = 'block';
        errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
      }
    });
  }

  if (adminPanel) {
    if (!isLoggedIn()) { window.location.href = 'index.html'; return; }
    initSidebarNav();
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('addJobTopBtn')?.addEventListener('click', () => { showPage('add-job'); setActivePage('add-job'); renderAddJobForm(); });
    document.getElementById('saveJobBtn')?.addEventListener('click', saveJobForm);
    document.getElementById('cancelJobBtn')?.addEventListener('click', () => { showPage('jobs'); setActivePage('jobs'); });
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deleteJobConfirmed);
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveSettings);
    document.getElementById('resetDataBtn')?.addEventListener('click', resetAllData);

    // ✅ تحميل الوظائف من Supabase عند فتح لوحة التحكم
    loadJobsFromSupabase().then(() => {
      renderDashboard();
      // تحديث badge المشتركين
      if (typeof getSubscribers === 'function') {
        const activeSubs = getSubscribers().filter(s => s.active).length;
        const badge = document.getElementById('subscribersBadge');
        if (badge) { badge.textContent = activeSubs; badge.style.display = activeSubs > 0 ? 'inline' : 'none'; }
      }
    }).catch(e => {
      console.warn('[Admin] تعذّر تحميل الوظائف من Supabase:', e.message);
      renderDashboard();
    });

    // Logo upload handler
    document.getElementById('fLogoFile')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { adminToast('حجم الصورة كبير - يجب أن يكون أقل من 2MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target.result;
        document.getElementById('fLogo').value = base64;
        const preview = document.getElementById('logoPreview');
        if (preview) preview.innerHTML = `<img src="${base64}" alt="logo">`;
        adminToast('تم رفع الصورة بنجاح', 'success');
      };
      reader.readAsDataURL(file);
    });

    // Clear logo button
    document.getElementById('clearLogoBtn')?.addEventListener('click', () => {
      document.getElementById('fLogo').value = '';
      document.getElementById('fLogoFile').value = '';
      const preview = document.getElementById('logoPreview');
      if (preview) preview.innerHTML = '';
      adminToast('تم مسح الشعار', 'success');
    });
  }
});

/* ── sendPushNotification: called automatically when a new job is saved ── */
function sendPushNotification(jobData) {
  var title = 'وظيفتك 💼 — وظيفة جديدة';
  var body  = (jobData.company || '') + (jobData.categoryName ? ' — ' + jobData.categoryName : '') + (jobData.cityName ? ' — ' + jobData.cityName : '');
  var url   = '/jobs.html';
  var tag   = 'wadifatuk-job-' + (jobData.id || Date.now());

  return adminToken().then(function(tok) {
    return fetch('../push/send.php', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': tok },
      body   : JSON.stringify({ title: title, body: body, url: url, tag: tag }),
    })
    .then(function(r) { return r.json(); })
    .then(function(res) {
      if (res.ok && res.sent > 0) {
        adminToast('📲 أُرسل لـ ' + res.sent + ' مستخدم عبر Push', 'success');
      } else if (res.ok && res.total === 0) {
        console.log('[Push] No subscribers yet — nothing sent');
      } else {
        console.warn('[Push] Send result:', res);
      }
      return res;
    })
    .catch(function(err) {
      console.warn('[Push] Auto-send error:', err);
      return { ok: false, error: err.message };
    });
  });
}

function renderPushPage() {
  var page = document.getElementById('page-push');
  if (!page) return;
  page.innerHTML = '<div class="page-header"><h1>📲 إشعارات الجوال (PWA Push)</h1><p>جاري تحميل البيانات...</p></div>';

  adminToken().then(function(tok) {
    Promise.all([
      fetch('../push/stats.php',       { cache:'no-store', headers:{'X-Admin-Token':tok} }).then(function(r){ return r.json(); }).catch(function(e){ return {_err: e.message}; }),
      fetch('../push/diagnostics.php', { cache:'no-store', headers:{'X-Admin-Token':tok} }).then(function(r){ return r.json(); }).catch(function(e){ return {_err: e.message}; }),
    ]).then(function(arr) {
      var data = arr[0], diag = arr[1];

      // Server error check
      if (data._err || diag._err) {
        page.innerHTML = '<div class="page-header"><h1>📲 إشعارات الجوال</h1>'
          + '<p style="color:#ef4444">⚠️ تعذّر تحميل البيانات من السيرفر<br><small>' + (data._err||diag._err) + '</small></p></div>';
        return;
      }

      var configured  = data.configured;
      var total       = data.active   || 0;
      var log         = data.log      || [];
      var devices     = data.devices  || {};
      var privKeyOk   = diag.private_key_loadable !== false;
      var encOk       = String(diag.encryption_test||'').startsWith('OK');
      var jwtOk       = diag.jwt_build === 'OK';
      var writable    = data.fileWritable !== false;
      var allOk       = configured && privKeyOk && jwtOk && writable;

      var okBg  = function(v){ return v ? '#dcfce7' : '#fee2e2'; };
      var okTxt = function(v){ return v ? '#15803d' : '#dc2626'; };
      var lbl   = function(v,y,n){ return v ? y : n; };

      /* ── Diag rows ── */
      var diagRows = [
        ['🔑 VAPID Public Key',   configured, '✅ موجود',              '❌ مفقود — أضف في config.php'],
        ['🔐 VAPID Private Key',  privKeyOk,  '✅ صالح ويعمل',        '❌ ' + (diag.private_key_error||'فشل التحميل')],
        ['📝 JWT Build',          jwtOk,      '✅ يعمل',              '❌ فشل — ' + (diag.jwt_build||'')],
        ['🔒 تشفير الحمولة',      encOk,      '✅ ' + (diag.encryption_test||'يعمل'), '⚠️ ' + (diag.encryption_test||'لا توجد اشتراكات بعد')],
        ['📁 مجلد قابل للكتابة', writable,   '✅ نعم',               '❌ لا — غيّر صلاحيات /push/ إلى 755'],
        ['🐘 PHP ' + (diag.php_version||''),         true, '✅ ' + (diag.php_version||'?'), ''],
        ['🔓 OpenSSL',            diag.openssl_enabled !== false, '✅ ' + (String(diag.openssl_version||'').split(' ').slice(0,2).join(' ')), '❌ غير مُفعَّل'],
        ['📡 cURL',               diag.curl_enabled   !== false, '✅ مُفعَّل', '❌ غير مُفعَّل — مطلوب للإرسال'],
      ].map(function(r){
        return '<tr><td style="font-size:13px">' + r[0] + '</td><td><span style="background:' + okBg(r[1]) + ';color:' + okTxt(r[1]) + ';padding:2px 10px;border-radius:6px;font-size:12px;font-weight:700">' + lbl(r[1],r[2],r[3]) + '</span></td></tr>';
      }).join('');

      /* ── Devices ── */
      var devIcons = { android:'🤖', ios:'🍎', samsung:'📱', desktop:'💻' };
      var devHtml = Object.keys(devices).length
        ? Object.entries(devices).map(function(d){
            return '<span style="background:#ede9fe;color:#7c3aed;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;margin:4px;display:inline-block">'
              + (devIcons[d[0]]||'📱') + ' ' + d[0] + ': ' + d[1]
              + '</span>';
          }).join('')
        : '<span style="color:#94a3b8;font-size:14px">لا توجد اشتراكات حتى الآن</span>';

      /* ── Log rows ── */
      var logHtml = log.length
        ? log.map(function(l,i){
            var d = new Date(l.at).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'});
            var errHtml = (l.errors && l.errors.length) ? '<br><small style="color:#ef4444">' + l.errors[0] + '</small>' : '';
            return '<tr>'
              + '<td>' + (i+1) + '</td>'
              + '<td style="font-size:13px">' + (l.title||'') + errHtml + '</td>'
              + '<td><span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">✅ ' + (l.sent||0) + '</span></td>'
              + '<td style="color:#ef4444;font-size:13px">' + (l.failed||0) + '</td>'
              + '<td style="color:#64748b;font-size:12px">' + (l.expired||0) + '</td>'
              + '<td style="font-size:12px;color:#64748b">' + d + '</td></tr>';
          }).join('')
        : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:30px">لا توجد سجلات بعد</td></tr>';

      /* ── iOS Guide HTML ── */
      var iosGuide = [
        '<div class="data-card" style="margin-bottom:24px;border:2px solid #e0e7ff">',
          '<div class="data-card-header" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:12px 12px 0 0;padding:16px 20px">',
            '<div class="data-card-title" style="color:#fff;font-size:15px">🍎 تفعيل الإشعارات على iPhone / iPad (iOS 16.4+)</div>',
          '</div>',
          '<div style="padding:20px">',
            '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px">',
              ['1️⃣ افتح الموقع في <strong>Safari</strong> فقط<br><small style="color:#64748b">Chrome وغيره لا يدعم الإشعارات على iOS</small>',
               '2️⃣ اضغط زر <strong>Share</strong> ثم <strong>"Add to Home Screen"</strong><br><small style="color:#64748b">أضف التطبيق على شاشة الهوم</small>',
               '3️⃣ افتح التطبيق من <strong>شاشة الهوم</strong><br><small style="color:#64748b">ليس من Safari — يجب وضع standalone</small>',
               '4️⃣ اقبل طلب الإشعارات<br><small style="color:#64748b">سيظهر بعد 4 ثوانٍ من الفتح</small>',
              ].map(function(s){
                return '<div style="background:#f8faff;border:1px solid #e0e7ff;border-radius:10px;padding:14px;font-size:13px;line-height:1.8">' + s + '</div>';
              }).join(''),
            '</div>',
            '<div style="margin-top:12px;padding:10px 14px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">',
              '⚠️ <strong>تنبيه Android:</strong> افتح الموقع في Chrome ← اضغط ⋮ ← "Add to Home Screen" ← ثم افتحه من الهوم واقبل الإشعارات',
            '</div>',
          '</div>',
        '</div>',
      ].join('');

      /* ── Subscribe this device section ── */
      var subscribeBox = [
        '<div class="form-card" style="margin-bottom:24px;border:2px solid #d1fae5">',
          '<div class="data-card-header" style="background:linear-gradient(135deg,#059669,#10b981);border-radius:12px 12px 0 0;padding:16px 20px">',
            '<div class="data-card-title" style="color:#fff;font-size:15px">📲 اشتراك هذا الجهاز — اختبار فوري</div>',
          '</div>',
          '<div style="padding:20px">',
            '<p style="font-size:14px;color:#374151;margin:0 0 14px">اضغط الزر أدناه لاشتراك هذا الجهاز/المتصفح في الإشعارات ثم أرسل اشعاراً تجريبياً للتحقق.</p>',
            '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">',
              '<button class="btn btn-primary" id="subscribeThisDeviceBtn" style="background:#059669;border-color:#059669"><i class="fas fa-bell"></i> اشتراك هذا الجهاز</button>',
              '<button class="btn btn-secondary" id="checkSubStatusBtn"><i class="fas fa-search"></i> تحقق من الحالة</button>',
              '<button class="btn btn-secondary" id="unsubscribeDeviceBtn" style="color:#dc2626;border-color:#dc2626"><i class="fas fa-bell-slash"></i> إلغاء الاشتراك</button>',
            '</div>',
            '<div id="subStatusBox" style="margin-top:14px;font-size:13px;color:#374151"></div>',
          '</div>',
        '</div>',
      ].join('');

      /* ── Full page HTML ── */
      page.innerHTML = [
        '<div class="page-header"><h1>📲 إشعارات الجوال (PWA Push)</h1><p>إرسال إشعارات فورية لمستخدمي وظيفتك</p></div>',

        /* Stats strip */
        '<div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">',
          '<div class="stat-card ' + (allOk ? 'green':'red') + '"><div class="stat-card-icon"><i class="fas fa-' + (allOk?'check':'times') + '-circle"></i></div><div class="stat-card-value">' + (allOk?'✅':'❌') + '</div><div class="stat-card-label">الإعداد</div></div>',
          '<div class="stat-card blue"><div class="stat-card-icon"><i class="fas fa-mobile-alt"></i></div><div class="stat-card-value">' + total + '</div><div class="stat-card-label">مشترك نشط</div></div>',
          '<div class="stat-card purple"><div class="stat-card-icon"><i class="fas fa-history"></i></div><div class="stat-card-value">' + log.length + '</div><div class="stat-card-label">إشعار مُرسَل</div></div>',
          '<div class="stat-card ' + (writable?'green':'red') + '"><div class="stat-card-icon"><i class="fas fa-hdd"></i></div><div class="stat-card-value">' + (writable?'✅':'❌') + '</div><div class="stat-card-label">صلاحيات الملف</div></div>',
        '</div>',

        /* iOS/Android guide */
        iosGuide,

        /* Subscribe this device */
        subscribeBox,

        /* Send manual push */
        '<div class="form-card" style="margin-bottom:24px">',
          '<div class="data-card-header"><div class="data-card-title"><i class="fas fa-paper-plane" style="color:#16a34a"></i> إرسال إشعار يدوي للكل</div></div>',
          '<div class="form-card-body">',
            '<div class="form-row">',
              '<div class="admin-form-group"><label class="admin-label">العنوان *</label><input type="text" id="pushTitle" class="admin-input" value="وظيفتك 💼 — وظيفة جديدة"></div>',
              '<div class="admin-form-group"><label class="admin-label">نص الرسالة *</label><input type="text" id="pushBody" class="admin-input" placeholder="وصف الوظيفة أو الإعلان..."></div>',
            '</div>',
            '<div class="form-row"><div class="admin-form-group"><label class="admin-label">الرابط عند النقر</label><input type="text" id="pushUrl" class="admin-input" value="/jobs.html"></div></div>',
            '<div class="form-actions" style="gap:12px">',
              '<button class="btn btn-primary" id="sendManualPushBtn"><i class="fas fa-paper-plane"></i> إرسال للكل (' + total + ' مشترك)</button>',
              '<a href="../admin/push-diagnostics.html" target="_blank" class="btn btn-secondary"><i class="fas fa-stethoscope"></i> تشخيص متقدم</a>',
            '</div>',
            '<div id="pushResultBox" style="display:none;margin-top:16px;padding:14px;border-radius:10px;font-size:14px;border:1px solid"></div>',
          '</div>',
        '</div>',

        /* Diagnostics */
        '<div class="data-card" style="margin-bottom:24px">',
          '<div class="data-card-header"><div class="data-card-title"><i class="fas fa-stethoscope" style="color:#6366f1"></i> تشخيص النظام</div>',
            '<button class="btn btn-secondary" id="refreshDiagBtn" style="font-size:12px;padding:6px 12px"><i class="fas fa-sync"></i> تحديث</button></div>',
          '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>المكوّن</th><th>الحالة</th></tr></thead><tbody>' + diagRows + '</tbody></table></div>',
          '<div style="padding:16px 20px;border-top:1px solid var(--border)"><div style="font-size:13px;font-weight:700;margin-bottom:10px">📱 الأجهزة المشتركة:</div><div>' + devHtml + '</div></div>',
        '</div>',

        /* Log */
        '<div class="data-card">',
          '<div class="data-card-header"><div class="data-card-title"><i class="fas fa-history" style="color:#6366f1"></i> سجل الإشعارات</div></div>',
          '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>#</th><th>العنوان</th><th>أُرسل</th><th>فشل</th><th>منتهي</th><th>التاريخ</th></tr></thead><tbody>' + logHtml + '</tbody></table></div>',
        '</div>',
      ].join('');

      /* ── Bind refresh ── */
      document.getElementById('refreshDiagBtn')?.addEventListener('click', renderPushPage);

      /* ── Bind manual send ── */
      document.getElementById('sendManualPushBtn')?.addEventListener('click', function() {
        var title = (document.getElementById('pushTitle').value||'').trim();
        var body  = (document.getElementById('pushBody').value||'').trim();
        var url   = (document.getElementById('pushUrl').value||'/').trim();
        if (!title || !body) { adminToast('يرجى ملء العنوان والرسالة', 'error'); return; }
        var btn = document.getElementById('sendManualPushBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...'; }
        adminToken().then(function(tok) {
          fetch('../push/send.php', {
            method:'POST',
            headers:{'Content-Type':'application/json','X-Admin-Token':tok},
            body: JSON.stringify({ title:title, body:body, url:url }),
          }).then(function(r){ return r.json(); }).then(function(res){
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال للكل (' + total + ' مشترك)'; }
            var box = document.getElementById('pushResultBox');
            if (res.ok) {
              var msg = '✅ أُرسل: <strong>' + res.sent + '</strong> | فشل: ' + res.failed + ' | منتهية الصلاحية: ' + res.expired + ' | الإجمالي: ' + res.total;
              if (res.sent === 0 && res.total === 0) msg = '⚠️ لا يوجد مشتركون بعد — اشترك أولاً من جهازك ثم أرسل';
              if (box) { box.style.display='block'; box.style.background=(res.sent>0?'#f0fdf4':'#fef9c3'); box.style.color=(res.sent>0?'#15803d':'#854d0e'); box.style.borderColor=(res.sent>0?'#bbf7d0':'#fde047'); box.innerHTML=msg; }
              adminToast(res.sent > 0 ? '✅ أُرسل لـ ' + res.sent + ' مستخدم' : '⚠️ لا يوجد مشتركون', res.sent>0?'success':'');
              setTimeout(renderPushPage, 3000);
            } else {
              var err = '❌ فشل: ' + (res.error||'خطأ غير معروف');
              if (box) { box.style.display='block'; box.style.background='#fef2f2'; box.style.color='#dc2626'; box.style.borderColor='#fecaca'; box.innerHTML=err; }
              adminToast(err, 'error');
            }
          }).catch(function(e){
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال للكل'; }
            adminToast('❌ تعذّر الاتصال: ' + e.message, 'error');
          });
        });
      });

      /* ── Subscribe this device ── */
      document.getElementById('subscribeThisDeviceBtn')?.addEventListener('click', function() {
        var statusBox = document.getElementById('subStatusBox');
        if (!('serviceWorker' in navigator && 'PushManager' in window)) {
          statusBox.innerHTML = '<span style="color:#dc2626">❌ هذا المتصفح لا يدعم Push Notifications<br>استخدم Chrome على Android أو Safari على iPhone (iOS 16.4+ مع Add to Home Screen)</span>';
          return;
        }
        if (Notification.permission === 'denied') {
          statusBox.innerHTML = '<span style="color:#dc2626">❌ الإذن محجوب — اذهب إلى إعدادات المتصفح وامنح الإذن</span>';
          return;
        }
        statusBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري طلب الإذن...';
        if (window.WdfPush) {
          WdfPush.subscribe().then(function() {
            statusBox.innerHTML = '<span style="color:#059669">✅ تم الاشتراك بنجاح! جرّب الآن إرسال إشعار تجريبي.</span>';
            adminToast('✅ تم اشتراك هذا الجهاز', 'success');
            setTimeout(renderPushPage, 2000);
          }).catch(function(e) {
            statusBox.innerHTML = '<span style="color:#dc2626">❌ فشل: ' + e.message + '</span>';
          });
        } else {
          statusBox.innerHTML = '<span style="color:#dc2626">❌ مكتبة WdfPush غير محملة — افتح الصفحة الرئيسية أولاً</span>';
        }
      });

      /* ── Check subscription status ── */
      document.getElementById('checkSubStatusBtn')?.addEventListener('click', function() {
        var statusBox = document.getElementById('subStatusBox');
        if (!('serviceWorker' in navigator && 'PushManager' in window)) {
          statusBox.innerHTML = '<span style="color:#dc2626">❌ المتصفح لا يدعم Push</span>';
          return;
        }
        navigator.serviceWorker.getRegistration('/').then(function(reg) {
          if (!reg) { statusBox.innerHTML = '<span style="color:#f59e0b">⚠️ Service Worker غير مُسجَّل</span>'; return; }
          return reg.pushManager.getSubscription().then(function(sub) {
            if (sub) {
              statusBox.innerHTML = '<span style="color:#059669">✅ هذا الجهاز مشترك<br><small style="word-break:break-all;color:#374151">' + sub.endpoint.substring(0,80) + '...</small></span>';
            } else {
              statusBox.innerHTML = '<span style="color:#f59e0b">⚠️ هذا الجهاز غير مشترك بعد — اضغط "اشتراك هذا الجهاز"</span>';
            }
          });
        }).catch(function(e) {
          statusBox.innerHTML = '<span style="color:#dc2626">❌ ' + e.message + '</span>';
        });
      });

      /* ── Unsubscribe this device ── */
      document.getElementById('unsubscribeDeviceBtn')?.addEventListener('click', function() {
        var statusBox = document.getElementById('subStatusBox');
        if (window.WdfPush) {
          WdfPush.unsubscribe().then(function() {
            statusBox.innerHTML = '<span style="color:#64748b">🔕 تم إلغاء الاشتراك</span>';
            adminToast('تم إلغاء الاشتراك', '');
            setTimeout(renderPushPage, 1500);
          });
        }
      });

    }).catch(function(e) {
      page.innerHTML = '<div class="page-header"><h1>📲 إشعارات الجوال</h1><p style="color:#ef4444">⚠️ تعذّر تحميل البيانات: ' + e.message + '</p></div>';
    });
  });
}

