// ===== MAIN JS — بوست وظيفتك =====

// عرض فوري عند تحميل الصفحة — بدون انتظار Supabase
document.addEventListener('DOMContentLoaded', () => {
  recordVisit();
  initHeader();
  if (document.getElementById('currentYear')) {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
  }
  // عرض فوري من البيانات المتاحة (ولو كانت الاحتياطية)
  renderCurrentPage();
});

// تحديث تلقائي عند وصول بيانات Supabase — فقط إذا جاءت بيانات جديدة
document.addEventListener('jobsDataReady', () => {
  renderCurrentPage();
});

// عرض محتوى الصفحة الحالية
function renderCurrentPage() {
  if (document.getElementById('categoriesGrid')) initHomePage();
  if (document.getElementById('jobsListGrid'))   initJobsPage();
  if (document.getElementById('jobDetailContainer')) initJobDetail();
}

// ===== LOADING SPINNER =====
function showLoadingSpinner() {
  const target = document.getElementById('jobsGrid') || document.getElementById('jobsListGrid');
  if (!target) return;
  target.innerHTML = `
    <div class="spinner-container" style="grid-column:1/-1">
      <div class="spinner-ring"></div>
      <div class="spinner-text">جارٍ تحميل الوظائف...</div>
    </div>`;
}

function hideLoadingSpinner() {
  // سيتم استبداله بالمحتوى الحقيقي عند استدعاء renderHomeJobs / renderJobsList
}

// ===== HEADER =====
function initHeader() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mobileNav');
  const close = document.getElementById('closeNav');
  if (toggle && nav) toggle.addEventListener('click', () => nav.classList.add('open'));
  if (close && nav) close.addEventListener('click', () => nav.classList.remove('open'));
  if (nav) nav.addEventListener('click', (e) => { if (e.target === nav) nav.classList.remove('open'); });
  window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ===== HOME PAGE =====
function initHomePage() {
  renderCategories();
  renderRegions();
  renderHomeJobs();
  animateCounters();
}

function animateCounters() {
  const jobs = getJobs();
  const companies = [...new Set(jobs.map(j => j.company))].length;
  animateNum('totalJobsCount', jobs.length);
  animateNum('companiesCount', companies);
}

function animateNum(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.ceil(target / 40);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString('ar');
    if (current >= target) clearInterval(timer);
  }, 40);
}

function renderCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(cat => {
    const count = getJobCountByCategory(cat.id);
    return `<div class="cat-card" onclick="window.location='jobs.html?cat=${cat.id}'">
      <div class="cat-icon" style="background:${cat.color}; color:${cat.iconColor}">${cat.icon}</div>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-count">${count} وظيفة</div>
    </div>`;
  }).join('');
}

function renderRegions() {
  const grid = document.getElementById('regionsGrid');
  if (!grid) return;
  grid.innerHTML = REGIONS.map(r => {
    const count = getJobCountByCity(r.city);
    return `<div class="region-card" onclick="window.location='jobs.html?city=${r.city}'">
      <div>
        <div class="region-name">${r.icon} ${r.name}</div>
        <div class="region-count">${count} وظيفة</div>
      </div>
      <i class="fas fa-arrow-left region-arrow"></i>
    </div>`;
  }).join('');
}

let homeJobsPage = 1;
const HOME_PAGE_SIZE = 9;

function renderHomeJobs(filter = 'all') {
  const grid = document.getElementById('jobsGrid');
  if (!grid) return;
  let jobs = getJobs();
  if (filter !== 'all') jobs = jobs.filter(j => j.category === filter || j.type === filter);
  homeJobsPage = 1;
  const toShow = jobs.slice(0, HOME_PAGE_SIZE);
  grid.innerHTML = toShow.length ? buildArticleList(toShow) : emptyState();
  const btn = document.getElementById('loadMoreBtn');
  if (btn) btn.style.display = jobs.length > HOME_PAGE_SIZE ? 'inline-flex' : 'none';
  window._filteredHomeJobs = jobs;
}

window.loadMoreJobs = function() {
  const jobs = window._filteredHomeJobs || getJobs();
  homeJobsPage++;
  const grid = document.getElementById('jobsGrid');
  const more = jobs.slice(0, homeJobsPage * HOME_PAGE_SIZE);
  grid.innerHTML = buildArticleList(more);
  if (more.length >= jobs.length) {
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.style.display = 'none';
  }
};

// Filter tabs
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('filter-tab') && e.target.dataset.filter) {
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    renderHomeJobs(e.target.dataset.filter);
  }
});

// ===== ARTICLE LAYOUT BUILDER =====
/**
 * يبني قائمة من المقالات/المنشورات مع مساحات إعلانية بعد كل 3 وظائف
 */
function buildArticleList(jobs) {
  let html = '';
  jobs.forEach((job, index) => {
    html += renderJobArticle(job);
    // إعلان AdSense بعد كل 3 وظائف (ليس في الأخيرة)
    if ((index + 1) % 3 === 0 && index + 1 < jobs.length) {
      html += renderAdZone(index);
    }
  });
  return html;
}

/**
 * منشور الوظيفة الكامل — Article Layout
 */
function renderJobArticle(job) {
  const badge = job.badge
    ? `<span class="job-badge badge-${job.badge}">${job.badge === 'new' ? 'جديد' : job.badge === 'urgent' ? 'عاجل' : 'مميز'}</span>`
    : '';

  const cat = getCategoryById(job.category);
  const tagsBg    = cat ? cat.color    : '#f1f5f9';
  const tagsColor = cat ? cat.iconColor : '#475569';

  const logoHtml = job.logo && (job.logo.startsWith('data:') || job.logo.startsWith('http'))
    ? `<img src="${job.logo}" alt="${job.company}" loading="lazy">`
    : `<span class="article-logo-emoji">${job.logo || '🏢'}</span>`;

  const isClosed = job.status === 'closed' ||
    (job.deadline && job.deadline !== 'حتى الاكتفاء' && new Date(job.deadline) < new Date());

  const statusBadge = isClosed
    ? `<span class="job-status-badge status-closed">✖ منتهي</span>`
    : `<span class="job-status-badge status-open">✔ متاح التقديم</span>`;

  const deadlineText = job.deadline ? job.deadline : 'حتى الاكتفاء';

  // وصف مختصر للـ card (أول 200 حرف)
  const shortDesc = (job.description || '').length > 200
    ? job.description.substring(0, 200) + '...'
    : (job.description || '');

  // أول 3 متطلبات
  const reqList = (job.requirements || []).slice(0, 3).map(r => `<li><i class="fas fa-check-circle"></i> ${r}</li>`).join('');

  // تسمية الجنس بأيقونة
  const genderIcon = job.gender === 'إناث' ? '👩' : job.gender === 'ذكور' ? '👨' : '👥';

  const shareUrl = encodeURIComponent(window.location.origin + '/job-detail.html?id=' + job.id);
  const shareText = encodeURIComponent(`وظيفة: ${job.company} في ${job.cityName} | بوست وظيفتك`);
  const waShareUrl = `https://api.whatsapp.com/send?text=${shareText}%20${shareUrl}`;
  const twShareUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;

  return `
<article class="job-article" id="job-${job.id}" itemscope itemtype="https://schema.org/JobPosting">
  ${badge}

  <header class="job-article-header">
    <div class="job-article-logo">${logoHtml}</div>
    <div class="job-article-meta">
      <h2 class="job-article-title" itemprop="title">${job.company}</h2>
      <div class="job-article-location">
        <span><i class="fas fa-map-marker-alt"></i> <span itemprop="jobLocation">${job.cityName}</span></span>
        <span><i class="fas fa-th-large"></i> ${job.categoryName || cat?.name || ''}</span>
        <span><i class="fas fa-clock"></i> ${job.typeName}</span>
      </div>
    </div>
    <div class="job-article-status-wrap">
      ${statusBadge}
      <div class="job-article-date"><i class="fas fa-calendar-alt"></i> ${formatDate(job.postedDate)}</div>
    </div>
  </header>

  <div class="job-article-body">
    <div class="job-article-details-row">
      <div class="job-detail-chip"><i class="fas fa-money-bill-wave"></i> ${job.salary}</div>
      <div class="job-detail-chip"><i class="fas fa-user-graduate"></i> ${job.education}</div>
      <div class="job-detail-chip"><i class="fas fa-briefcase"></i> ${job.experience}</div>
      <div class="job-detail-chip">${genderIcon} ${job.gender}</div>
      <div class="job-detail-chip deadline-chip"><i class="fas fa-hourglass-end"></i> آخر موعد: ${deadlineText}</div>
    </div>

    <div class="job-article-description" itemprop="description">
      <p>${shortDesc}</p>
    </div>

    ${reqList ? `
    <div class="job-article-requirements">
      <div class="job-article-req-title"><i class="fas fa-list-check"></i> أبرز المتطلبات</div>
      <ul class="job-req-list">${reqList}</ul>
    </div>` : ''}

    <div class="job-article-tags">
      ${(job.tags || []).map(t => `<span class="job-tag" style="background:${tagsBg};color:${tagsColor}">${t}</span>`).join('')}
    </div>
  </div>

  <footer class="job-article-footer">
    <div class="job-article-actions">
      <button class="btn-apply-now" id="apply-btn-${job.id}" onclick="goApply('${job.applyUrl}', '${job.company}')">
        <i class="fas fa-paper-plane"></i> التقديم على الوظيفة
      </button>
      <button class="btn-job-details" onclick="window.location='job-detail.html?id=${job.id}'">
        <i class="fas fa-eye"></i> عرض التفاصيل الكاملة
      </button>
    </div>
    <div class="job-article-share">
      <span class="share-label"><i class="fas fa-share-alt"></i> شارك:</span>
      <a href="${waShareUrl}" target="_blank" rel="noopener" class="share-btn share-wa" title="مشاركة عبر واتساب" id="share-wa-${job.id}">
        <i class="fab fa-whatsapp"></i>
      </a>
      <a href="${twShareUrl}" target="_blank" rel="noopener" class="share-btn share-tw" title="مشاركة عبر تويتر" id="share-tw-${job.id}">
        <i class="fab fa-x-twitter"></i>
      </a>
      <button class="share-btn share-copy" title="نسخ الرابط" id="share-copy-${job.id}" onclick="copyJobLink('${job.id}')">
        <i class="fas fa-link"></i>
      </button>
    </div>
  </footer>
</article>`;
}

/**
 * مساحة إعلانية بين الوظائف (AdSense Compliant)
 */
function renderAdZone(index) {
  return `
<div class="ad-zone-between-articles" id="ad-zone-${index}" aria-label="إعلان">
  <!-- Google AdSense: ضع كود الإعلان هنا -->
  <!-- <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXX" data-ad-slot="XXXXXXXX" data-ad-format="auto" data-full-width-responsive="true"></ins> -->
  <div class="ad-placeholder">
    <i class="fas fa-ad"></i>
    <span>مساحة إعلانية</span>
  </div>
</div>`;
}

// دالة نسخ الرابط
window.copyJobLink = function(jobId) {
  const url = window.location.origin + '/job-detail.html?id=' + jobId;
  navigator.clipboard.writeText(url).then(() => {
    showToast('تم نسخ رابط الوظيفة ✓', 'success');
  }).catch(() => {
    showToast('تعذّر نسخ الرابط', '');
  });
};

function emptyState() {
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="empty-icon"><i class="fas fa-search"></i></div>
    <div class="empty-title">لا توجد وظائف</div>
    <div class="empty-subtitle">لم يتم العثور على وظائف بهذه المعايير</div>
  </div>`;
}

// دالة renderJobCard تبقى للتوافق مع صفحة التفاصيل والوظائف المشابهة
function renderJobCard(job) {
  return renderJobArticle(job);
}

window.goApply = function(url, company) {
  if (url && url !== 'undefined' && url !== '' && url !== 'null' && url !== '#') {
    showToast('سيتم تحويلك إلى صفحة التقديم...', 'success');
    setTimeout(() => { window.open(url, '_blank'); }, 500);
  } else {
    // فتح واتساب للتقديم عبر الخدمة
    const phone = '966531634431';
    const msg = encodeURIComponent(`مرحباً، أرغب في التقديم على وظيفة: ${company || 'الوظيفة المعلنة'} عبر موقع بوست وظيفتك`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  }
};

// ===== SEARCH =====
window.performSearch = function() {
  const city = document.getElementById('searchCity')?.value;
  const category = document.getElementById('searchCategory')?.value;
  const params = new URLSearchParams();
  if (city) params.set('city', city);
  if (category) params.set('cat', category);
  window.location.href = 'jobs.html?' + params.toString();
};

// ===== JOBS PAGE =====
function initJobsPage() {
  const params = new URLSearchParams(window.location.search);
  applyURLFilters(params);
  renderJobsList();
  setupJobsFilters();
  setupMobileFilterDrawer();
}

function setupMobileFilterDrawer() {
  const toggleBtn = document.getElementById('mobileFilterToggle');
  const sidebar   = document.querySelector('.jobs-sidebar');
  const overlay   = document.getElementById('filterOverlay');
  if (!toggleBtn || !sidebar || !overlay) return;

  function openDrawer()  { sidebar.classList.add('open');    overlay.classList.add('open');    document.body.style.overflow = 'hidden'; }
  function closeDrawer() { sidebar.classList.remove('open'); overlay.classList.remove('open'); document.body.style.overflow = ''; }

  toggleBtn.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  ['filterCity','filterCat','filterType','filterGender','clearFilters'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => { if (window.innerWidth <= 768) closeDrawer(); });
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => { if (window.innerWidth <= 768) closeDrawer(); });
}

let currentFilters = { cat: '', city: '', type: '', gender: '', sort: 'newest', q: '' };

// خريطة الربط بين المناطق الإدارية ومدنها
const REGION_CITIES = {
  'region-riyadh':   ['riyadh','kharj','dawadmi','majmaah','shaqra','zulfi','afif','wadi-dawasir','hawtah','thadiq','rumah','huraymila','muzahimiyah','diriyah','dilam','sulayyil','al-quway','wadi-albir'],
  'region-makkah':   ['makkah','jeddah','taif','rabigh','qunfudah','lith','khulays','kamil','adham','jomoom','turbah','ranyah','muwayh','tarabah'],
  'region-eastern':  ['dammam','khobar','dhahran','ahsa','qatif','jubail','hafr-batin','khafji','nuayriyah','buqayq','ras-tanura','saihat','safwa','abqaiq'],
  'region-madinah':  ['madinah','yanbu','ula','khaybar','mahd-dahab','badr','wadi-alfara','hanakiyah','turbah-madinah'],
  'region-qassim':   ['buraydah','unayzah','rass','midhnab','bukayriyah','nabhaniyah','khubra','dariyah','uyun','riyadh-khabra','asyah'],
  'region-asir':     ['abha','khamis-mushait','bishah','sarat-abida','mahail','namas','tanuma','rijal-alma','balqarn','tathlith','ahad-rufaidah','bisher'],
  'region-tabuk':    ['tabuk','alwajh','duba','haql','tayma','amlaj','qyal','bad','sharma'],
  'region-hail':     ['hail','baqaa','ghazalah','shinan','mawqaq','smira','shulaymi'],
  'region-northern': ['arar','rafha','turaif','uwayqilah'],
  'region-jizan':    ['jizan','abu-arish','sabya','samtah','darb','jizan-lith','harth','arida','baysh','farasan','ahad-masarihah','al-hurrath'],
  'region-najran':   ['najran','sharurah','habunah','yadmah','thar','badr-najran'],
  'region-bahah':    ['bahah','baljurashi','mukhwah','aqiq','hajarah','qilwah','mandak','ghamid'],
  'region-jawf':     ['jawf','sakaka','qurayyat','dawmat-jandal','tabarjal']
};

function applyURLFilters(params) {
  if (params.get('cat'))    currentFilters.cat    = params.get('cat');
  if (params.get('city'))   currentFilters.city   = params.get('city');
  if (params.get('type'))   currentFilters.type   = params.get('type');
  if (params.get('gender')) currentFilters.gender = params.get('gender');
  if (params.get('q'))      currentFilters.q      = params.get('q');
  if (document.getElementById('filterCity')   && currentFilters.city)   document.getElementById('filterCity').value   = currentFilters.city;
  if (document.getElementById('filterCat')    && currentFilters.cat)    document.getElementById('filterCat').value    = currentFilters.cat;
  if (document.getElementById('filterGender') && currentFilters.gender) document.getElementById('filterGender').value = currentFilters.gender;
  if (document.getElementById('filterSearch') && currentFilters.q)      document.getElementById('filterSearch').value = currentFilters.q;
}

function filterJobs() {
  let jobs = getJobs();
  if (currentFilters.q) {
    const q = currentFilters.q.toLowerCase();
    jobs = jobs.filter(j =>
      (j.company || '').toLowerCase().includes(q) ||
      (j.description || '').toLowerCase().includes(q) ||
      (j.categoryName || '').toLowerCase().includes(q) ||
      (j.cityName || '').toLowerCase().includes(q) ||
      (j.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (currentFilters.cat)    jobs = jobs.filter(j => j.category === currentFilters.cat || j.type === currentFilters.cat);
  if (currentFilters.city) {
    const cityFilter = currentFilters.city;
    if (cityFilter.startsWith('region-')) {
      // فلترة حسب المنطقة الإدارية — تشمل جميع مدن المنطقة
      const regionCities = REGION_CITIES[cityFilter] || [];
      jobs = jobs.filter(j => j.city === cityFilter || regionCities.includes(j.city));
    } else {
      jobs = jobs.filter(j => j.city === cityFilter);
    }
  }
  if (currentFilters.type)   jobs = jobs.filter(j => j.type === currentFilters.type);
  if (currentFilters.gender) {
    if (currentFilters.gender === 'إناث') {
      jobs = jobs.filter(j => j.gender === 'إناث' || j.gender === 'للجنسين');
    } else {
      jobs = jobs.filter(j => j.gender === currentFilters.gender);
    }
  }
  if (currentFilters.sort === 'newest') jobs.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));
  else if (currentFilters.sort === 'views') jobs.sort((a, b) => b.views - a.views);
  return jobs;
}

let jobsCurrentPage = 1;
const JOBS_PAGE_SIZE = 10;

function renderJobsList() {
  const grid = document.getElementById('jobsListGrid');
  const countEl = document.getElementById('jobsCount');
  const countMobile = document.getElementById('jobsCountMobile');
  if (!grid) return;
  const jobs = filterJobs();
  const paged = jobs.slice(0, jobsCurrentPage * JOBS_PAGE_SIZE);
  const countText = `تم العثور على <span>${jobs.length}</span> وظيفة`;
  if (countEl) countEl.innerHTML = countText;
  if (countMobile) countMobile.innerHTML = countText;
  grid.innerHTML = paged.length ? buildArticleList(paged) : emptyState();
  const btn = document.getElementById('loadMoreJobsBtn');
  if (btn) btn.style.display = paged.length < jobs.length ? 'inline-flex' : 'none';
}

window.loadMoreJobsList = function() {
  jobsCurrentPage++;
  renderJobsList();
};

function setupJobsFilters() {
  document.getElementById('filterSearch')?.addEventListener('input', (e) => {
    currentFilters.q = e.target.value.trim();
    jobsCurrentPage = 1;
    renderJobsList();
  });
  document.getElementById('filterCity')?.addEventListener('change', (e) => {
    currentFilters.city = e.target.value;
    jobsCurrentPage = 1;
    renderJobsList();
  });
  document.getElementById('filterCat')?.addEventListener('change', (e) => {
    currentFilters.cat = e.target.value;
    jobsCurrentPage = 1;
    renderJobsList();
  });
  document.getElementById('filterType')?.addEventListener('change', (e) => {
    currentFilters.type = e.target.value;
    jobsCurrentPage = 1;
    renderJobsList();
  });
  document.getElementById('filterGender')?.addEventListener('change', (e) => {
    currentFilters.gender = e.target.value;
    jobsCurrentPage = 1;
    renderJobsList();
  });
  document.getElementById('sortJobs')?.addEventListener('change', (e) => {
    currentFilters.sort = e.target.value;
    jobsCurrentPage = 1;
    renderJobsList();
  });
  document.getElementById('clearFilters')?.addEventListener('click', () => {
    currentFilters = { cat: '', city: '', type: '', gender: '', sort: 'newest', q: '' };
    ['filterCity','filterCat','filterType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    if (document.getElementById('filterGender'))  document.getElementById('filterGender').value  = '';
    if (document.getElementById('filterSearch'))  document.getElementById('filterSearch').value  = '';
    jobsCurrentPage = 1;
    renderJobsList();
  });
}

// ===== JOB DETAIL =====
function initJobDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) { window.location.href = 'jobs.html'; return; }
  
  const job = getJobById(id);
  if (!job) { 
    // إذا كانت قاعدة البيانات المحلية فارغة (ما زالت تحمل من Supabase)، لا تقم بالتحويل
    if (getJobs().length === 0) return;
    
    // إذا اكتمل التحميل ولم نجد الوظيفة، حوّل لصفحة الوظائف
    window.location.href = 'jobs.html'; 
    return; 
  }

  recordJobView(id);
  renderJobDetail(job);
  renderRelatedJobs(job);
}

function renderJobDetail(job) {
  const container = document.getElementById('jobDetailContainer');
  if (!container) return;
  document.title = `${job.company} - بوست وظيفتك | موقع بوست وظيفتك للوظائف`;
  
  // Update meta description dynamically for SEO if it exists
  let metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && job.description) {
    metaDesc.setAttribute("content", (job.description.substring(0, 150) + "... | عبر موقع بوست وظيفتك").replace(/\n/g, ' '));
  }
  const cat = getCategoryById(job.category);
  const logoHtml = job.logo && (job.logo.startsWith('data:') || job.logo.startsWith('http'))
    ? `<img src="${job.logo}" alt="${job.company}" style="width:100%;height:100%;object-fit:contain;padding:6px;">`
    : `<span style="font-size:38px">${job.logo || '🏢'}</span>`;
  const deadlineDisplay = job.deadline || 'حتى الاكتفاء';

  const phone = '966531634431';
  const waMsg = encodeURIComponent(`مرحباً، أرغب في التقديم على وظيفة: ${job.company} في ${job.cityName}`);
  const waUrl = `https://wa.me/${phone}?text=${waMsg}`;

  container.innerHTML = `
    <div class="job-detail-main">
      <div class="job-detail-header">
        <div class="job-detail-logo" style="display:flex;align-items:center;justify-content:center;background:#f8fafc;border:2px solid #e2e8f0;border-radius:18px;overflow:hidden">${logoHtml}</div>
        <div>
          <h1 class="job-detail-title">${job.company}</h1>
          <div class="job-detail-meta">
            <span class="job-detail-meta-item"><i class="fas fa-map-marker-alt"></i> ${job.cityName}</span>
            <span class="job-detail-meta-item"><i class="fas fa-clock"></i> ${job.typeName}</span>
            <span class="job-detail-meta-item"><i class="fas fa-money-bill-wave"></i> ${job.salary}</span>
            <span class="job-detail-meta-item"><i class="fas fa-venus-mars"></i> ${job.gender}</span>
          </div>
        </div>
      </div>
      <div class="job-detail-section-title">وصف الوظيفة</div>
      <div class="job-detail-content"><p>${job.description}</p></div>
      <div class="job-detail-section-title">المتطلبات</div>
      <div class="job-detail-content"><ul>${(job.requirements || []).map(r => `<li>${r}</li>`).join('')}</ul></div>
      <div class="job-detail-section-title">المزايا والبدلات</div>
      <div class="job-detail-content"><ul>${(job.benefits || []).map(b => `<li>${b}</li>`).join('')}</ul></div>
      <div class="job-detail-section-title">الكلمات المفتاحية</div>
      <div class="job-tags" style="margin-top:10px">${(job.tags || []).map(t => `<span class="job-tag" style="background:${cat?.color||'#f1f5f9'};color:${cat?.iconColor||'#475569'}">${t}</span>`).join('')}</div>
    </div>
    <div class="job-apply-sidebar">
      <button class="apply-big-btn" onclick="goApply('${job.applyUrl}', '${job.company}')"><i class="fas fa-paper-plane"></i> تقدم الآن</button>
      <a href="${waUrl}" target="_blank" rel="noopener" class="apply-big-btn" style="background:linear-gradient(135deg,#25d366,#128c7e);display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;color:white;border-radius:12px;padding:14px;font-size:16px;font-weight:800;margin-bottom:12px">
        <i class="fab fa-whatsapp"></i> تقديم عبر واتساب
      </a>
      <button class="job-share-btn" onclick="shareJob()"><i class="fas fa-share-alt"></i> مشاركة الإعلان</button>
      <div class="sidebar-details">
        <div class="sidebar-detail-item"><div class="sidebar-detail-icon"><i class="fas fa-map-marker-alt"></i></div><div><div class="sidebar-detail-label">المدينة</div><div class="sidebar-detail-value">${job.cityName}</div></div></div>
        <div class="sidebar-detail-item"><div class="sidebar-detail-icon"><i class="fas fa-briefcase"></i></div><div><div class="sidebar-detail-label">نوع الدوام</div><div class="sidebar-detail-value">${job.typeName}</div></div></div>
        <div class="sidebar-detail-item"><div class="sidebar-detail-icon"><i class="fas fa-money-bill-wave"></i></div><div><div class="sidebar-detail-label">الراتب</div><div class="sidebar-detail-value">${job.salary}</div></div></div>
        <div class="sidebar-detail-item"><div class="sidebar-detail-icon"><i class="fas fa-graduation-cap"></i></div><div><div class="sidebar-detail-label">المؤهل</div><div class="sidebar-detail-value">${job.education}</div></div></div>
        <div class="sidebar-detail-item"><div class="sidebar-detail-icon"><i class="fas fa-star"></i></div><div><div class="sidebar-detail-label">الخبرة</div><div class="sidebar-detail-value">${job.experience}</div></div></div>
        <div class="sidebar-detail-item"><div class="sidebar-detail-icon"><i class="fas fa-calendar-alt"></i></div><div><div class="sidebar-detail-label">آخر موعد</div><div class="sidebar-detail-value">${deadlineDisplay}</div></div></div>
        <div class="sidebar-detail-item"><div class="sidebar-detail-icon"><i class="fas fa-eye"></i></div><div><div class="sidebar-detail-label">المشاهدات</div><div class="sidebar-detail-value">${(job.views || 0).toLocaleString('ar')}</div></div></div>
      </div>
    </div>`;
}

function renderRelatedJobs(job) {
  const grid = document.getElementById('relatedJobsGrid');
  if (!grid) return;
  const related = getJobs().filter(j => String(j.id) !== String(job.id) && (j.category === job.category || j.city === job.city)).slice(0, 3);
  grid.innerHTML = related.map(renderJobArticle).join('');
}

window.shareJob = function() {
  if (navigator.share) {
    navigator.share({ title: document.title, url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href);
    showToast('تم نسخ رابط الوظيفة', 'success');
  }
};

// ===== TOAST =====
function showToast(msg, type = '') {
  let toast = document.getElementById('globalToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'globalToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i> ${msg}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
window.showToast = showToast;
