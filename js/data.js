// ========== JOB DATA — بوست وظيفتك ==========
// نسخة Supabase — تقرأ البيانات من قاعدة البيانات السحابية
// الوظائف الثابتة تبقى كـ fallback احتياطي فقط عند انقطاع الاتصال

const JOBS_DATA = [];

const CATEGORIES = [
  { id: "government", name: "وظائف حكومية", icon: "🏛️", color: "#dbeafe", iconColor: "#1d4ed8" },
  { id: "military", name: "وظائف عسكرية", icon: "⚔️", color: "#fee2e2", iconColor: "#dc2626" },
  { id: "corporate", name: "وظائف شركات", icon: "🏢", color: "#f0fdf4", iconColor: "#16a34a" },
  { id: "medical", name: "طبية وصحية", icon: "⚕️", color: "#fce7f3", iconColor: "#db2777" },
  { id: "engineering", name: "هندسة وتقنية", icon: "⚙️", color: "#fff7ed", iconColor: "#ea580c" },
  { id: "education", name: "تعليم وتدريب", icon: "📚", color: "#f5f3ff", iconColor: "#7c3aed" },
  { id: "finance", name: "مالية ومحاسبة", icon: "💰", color: "#fefce8", iconColor: "#ca8a04" },
  { id: "it", name: "تقنية المعلومات", icon: "💻", color: "#ecfdf5", iconColor: "#059669" },
  { id: "sales", name: "مبيعات وتسويق", icon: "📈", color: "#fff1f2", iconColor: "#e11d48" },
  { id: "admin", name: "إدارة وسكرتارية", icon: "🗂️", color: "#f0f9ff", iconColor: "#0284c7" },
  { id: "construction", name: "إنشاء ومقاولات", icon: "🏗️", color: "#fafaf9", iconColor: "#57534e" },
  { id: "hospitality", name: "فندقة وضيافة", icon: "🏨", color: "#fff7ed", iconColor: "#c2410c" },
  { id: "remote", name: "عن بُعد", icon: "🌐", color: "#f0fdf4", iconColor: "#15803d" },
  { id: "parttime", name: "دوام جزئي", icon: "⏰", color: "#faf5ff", iconColor: "#9333ea" },
  { id: "qiyas", name: "اختبارات قياس", icon: "📝", color: "#f0f9ff", iconColor: "#0369a1" }
];

const REGIONS = [
  { name: "منطقة الرياض", city: "region-riyadh", icon: "🏙️" },
  { name: "منطقة مكة المكرمة", city: "region-makkah", icon: "🕌" },
  { name: "المنطقة الشرقية", city: "region-eastern", icon: "🛢️" },
  { name: "منطقة المدينة المنورة", city: "region-madinah", icon: "🌙" },
  { name: "منطقة القصيم", city: "region-qassim", icon: "🌾" },
  { name: "منطقة عسير", city: "region-asir", icon: "⛰️" },
  { name: "منطقة تبوك", city: "region-tabuk", icon: "🏜️" },
  { name: "منطقة حائل", city: "region-hail", icon: "🌿" },
  { name: "منطقة الحدود الشمالية", city: "region-northern", icon: "🗺️" },
  { name: "منطقة جازان", city: "region-jizan", icon: "🌊" },
  { name: "منطقة نجران", city: "region-najran", icon: "🌴" },
  { name: "منطقة الباحة", city: "region-bahah", icon: "🌲" },
  { name: "منطقة الجوف", city: "region-jawf", icon: "⭐" }
];

// ========== SUPABASE DATA LAYER ==========
// Cache الوظائف في الذاكرة
let _jobsCache = null;

/**
 * تحويل سجل Supabase إلى تنسيق الموقع
 */
function _mapSupabaseJob(row) {
  return {
    id: row.id,
    company: row.company || '',
    logo: row.logo || '',
    city: row.city || '',
    cityName: row.city_name || row.city || '',
    region: row.region || '',
    category: row.category || '',
    categoryName: row.category_name || '',
    type: row.type || 'fulltime',
    typeName: row.type_name || 'دوام كامل',
    salary: row.salary || 'يُحدد لاحقاً',
    experience: row.experience || 'غير محدد',
    gender: row.gender || 'للجنسين',
    education: row.education || 'غير محدد',
    description: row.description || '',
    requirements: Array.isArray(row.requirements) ? row.requirements : (row.requirements ? row.requirements.split('\n').filter(Boolean) : []),
    benefits: Array.isArray(row.benefits) ? row.benefits : (row.benefits ? row.benefits.split('\n').filter(Boolean) : []),
    tags: Array.isArray(row.tags) ? row.tags : (row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
    badge: row.badge || null,
    featured: row.featured || false,
    status: row.status || 'active',
    applyUrl: row.apply_url || '#',
    deadline: row.deadline || '',
    postedDate: row.posted_date || row.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    views: row.views || 0,
    title: row.title || row.company || ''
  };
}

/**
 * جلب الوظائف من Supabase
 */
async function loadJobsFromSupabase() {
  try {
    const rows = await sbFetchJobs();
    if (rows && rows.length > 0) {
      _jobsCache = rows.map(_mapSupabaseJob);
      console.log('[وظيفتك] ✅ تم تحميل', _jobsCache.length, 'وظيفة من Supabase');
    } else {
      console.warn('[وظيفتك] ⚠️ قاعدة البيانات فارغة — يُستخدم الاحتياطي المدمج');
      _jobsCache = [...JOBS_DATA];
    }
    return _jobsCache;
  } catch (e) {
    console.warn('[وظيفتك] ❌ تعذّر الاتصال بـ Supabase، يُستخدم الاحتياطي:', e.message);
    _jobsCache = [...JOBS_DATA];
    return _jobsCache;
  }
}

/**
 * getJobs() — إرجاع الوظائف من الـ cache
 */
function getJobs() {
  return _jobsCache !== null ? _jobsCache : JOBS_DATA;
}

function saveJobs(jobs) {
  _jobsCache = jobs;
}

// ========== STATS (تبقى في localStorage) ==========
function getStats() {
  const stored = localStorage.getItem('wadifatuk_stats');
  if (stored) {
    try { return JSON.parse(stored); } catch(e) {}
  }
  const stats = {
    totalVisits: 0, todayVisits: 0, lastVisitDate: null,
    pageViews: {}, cityStats: {}, categoryStats: {}, dailyVisits: {}
  };
  localStorage.setItem('wadifatuk_stats', JSON.stringify(stats));
  return stats;
}

function saveStats(stats) {
  localStorage.setItem('wadifatuk_stats', JSON.stringify(stats));
}

function recordVisit() {
  const stats = getStats();
  const today = new Date().toISOString().split('T')[0];
  stats.totalVisits = (stats.totalVisits || 0) + 1;
  if (stats.lastVisitDate !== today) {
    stats.todayVisits = 1;
    stats.lastVisitDate = today;
  } else {
    stats.todayVisits = (stats.todayVisits || 0) + 1;
  }
  const page = window.location.pathname.split('/').pop() || 'index.html';
  stats.pageViews = stats.pageViews || {};
  stats.pageViews[page] = (stats.pageViews[page] || 0) + 1;
  if (!stats.dailyVisits) stats.dailyVisits = {};
  stats.dailyVisits[today] = (stats.dailyVisits[today] || 0) + 1;
  saveStats(stats);
}

/**
 * تسجيل مشاهدة وظيفة
 */
function recordJobView(jobId) {
  // تحديث محلي فوري
  const jobs = getJobs();
  const job = jobs.find(j => String(j.id) === String(jobId));
  if (job) job.views = (job.views || 0) + 1;

  // تحديث على Supabase بدون انتظار
  if (typeof sbIncrementViews === 'function') {
    sbIncrementViews(jobId).catch(() => {});
  }

  // إحصائيات محلية
  const stats = getStats();
  stats.categoryStats = stats.categoryStats || {};
  stats.cityStats = stats.cityStats || {};
  if (job) {
    stats.categoryStats[job.category] = (stats.categoryStats[job.category] || 0) + 1;
    stats.cityStats[job.city] = (stats.cityStats[job.city] || 0) + 1;
  }
  saveStats(stats);
}

function getJobById(id) {
  return getJobs().find(j => String(j.id) === String(id));
}

function getCategoryById(id) {
  return CATEGORIES.find(c => c.id === id);
}

function getJobCountByCategory(catId) {
  return getJobs().filter(j => j.category === catId).length;
}

function getJobCountByCity(cityId) {
  return getJobs().filter(j => j.city === cityId).length;
}

function formatDate(dateStr) {
  if (!dateStr) return 'غير محدد';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'أمس';
  if (diff < 7) return `منذ ${diff} أيام`;
  if (diff < 30) return `منذ ${Math.floor(diff / 7)} أسابيع`;
  return `منذ ${Math.floor(diff / 30)} أشهر`;
}


// ========== تهيئة البيانات عند تحميل الصفحة ==========
(function initData() {

  // ✅ الخطوة 1: تعبئة فورية (متزامنة) — الصفحة تعمل على الفور
  _jobsCache = [...JOBS_DATA];
  console.log('[وظيفتك] ✅ بيانات احتياطية جاهزة:', _jobsCache.length, 'وظيفة');

  // ✅ الخطوة 2: محاولة تحديث من Supabase في الخلفية
  loadJobsFromSupabase()
    .then(() => {
      console.log('[وظيفتك] 🔄 تم تحديث البيانات من Supabase:', _jobsCache.length, 'وظيفة');
      document.dispatchEvent(new CustomEvent('jobsDataReady'));

      // ✅ الخطوة 3: تفعيل Realtime للتحديث الفوري
      if (typeof sbStartRealtime === 'function') {
        sbStartRealtime(function(eventType, payload) {
          // عند أي تغيير → أعِد تحميل الوظائف وحدِّث الصفحة
          loadJobsFromSupabase().then(() => {
            document.dispatchEvent(new CustomEvent('jobsDataReady'));

            // ✅ Real-time notifications counter: إظهار عدد الوظائف الجديدة في التبويب
            if (eventType === 'INSERT') {
              _newJobsCount = (_newJobsCount || 0) + 1;
              _updateTabTitle();
            }
          }).catch(() => {});
        });
      }
    })
    .catch((err) => {
      console.warn('[وظيفتك] ⚠️ Supabase غير متاح، يُستخدم الاحتياطي:', err?.message || err);
    });

})();

// ========== عداد الوظائف الجديدة في عنوان التبويب ==========
let _newJobsCount = 0;
const _originalTitle = document.title;

function _updateTabTitle() {
  if (_newJobsCount > 0) {
    document.title = '(' + _newJobsCount + ' جديد) ' + _originalTitle;
  } else {
    document.title = _originalTitle;
  }
}

// إعادة تعيين العداد عند تفاعل المستخدم مع الصفحة
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    _newJobsCount = 0;
    _updateTabTitle();
  }
});



