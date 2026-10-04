/* ============================================
   مُعلّمي | js/curriculum-data.js
   نظام المناهج الدراسية — طبقة البيانات
   --------------------------------------------
   المصدر الرسمي: وزارة التربية والتعليم المصرية
   https://studentbooks.moe.gov.eg/Books/

   الاستراتيجية (محلي أولًا — Local-first):
   1) كاش محلي فوري (LocalStorage) — سرعة + أوفلاين
   2) تحديث خلفي من Supabase (جداول curriculum_*) إن توفرت مزامنة
   3) نسخة احتياطية مدمجة (data/moe-catalog.js) من الكتالوج الرسمي
      — لا يعتمد التطبيق على اتصال مباشر بموقع الوزارة إطلاقًا

   ملاحظة معمارية: موقع الوزارة محمي بحاجز جغرافي (WAF)،
   لذلك تتم المزامنة عبر: بوابة الوزارة ← أداة المزامنة
   (tools/moe-sync) ← Supabase ← هذا التطبيق.
   لا يتم تخزين أي PDF محليًا — روابط رسمية فقط.
   ============================================ */

const CurriculumData = (function () {
  'use strict';

  const KEYS = {
    catalog: 'curriculum_catalog',
    favorites: 'curriculum_favorites',
    progress: 'curriculum_progress',
    units: 'curriculum_units',
    lessons: 'curriculum_lessons',
    sync: 'curriculum_sync'
  };

  const state = {
    catalog: null,        // {stages, grades, subjects, books, meta}
    loading: null,        // Promise جارية
    listeners: []         // callbacks عند تحديث الكتالوج
  };

  // ===== أدوات التخزين المحلي (منفصلة عن Storage لضمان عدم التزام مع جداول المعلم) =====
  function lsGet(name, fallback) {
    try {
      const raw = localStorage.getItem('moallemy_' + name);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(name, value) {
    try {
      localStorage.setItem('moallemy_' + name, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[CurriculumData] write error:', name, e);
      return false;
    }
  }

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function esc(s) { return window.Utils ? Utils.escapeHTML(s) : String(s == null ? '' : s); }

  // ============ تحميل الكتالوج ============

  // الكتالوج الاحتياطي المدمج (بيانات رسمية حقيقية)
  function bundledCatalog() {
    if (!window.MOE_CATALOG) return null;
    const c = window.MOE_CATALOG;
    return {
      stages: c.stages || [], grades: c.grades || [],
      subjects: c.subjects || [], books: c.books || [],
      meta: {
        version: c.version || 0,
        academicYear: c.academicYear || '',
        source: c.source || 'وزارة التربية والتعليم',
        sourceUrl: c.sourceUrl || 'https://studentbooks.moe.gov.eg/Books/',
        origin: 'bundled',
        syncedAt: c.extractedAt || null
      }
    };
  }

  // الكاش المحلي
  function cachedCatalog() {
    const c = lsGet(KEYS.catalog, null);
    if (!c || !Array.isArray(c.books)) return null;
    if (!c.meta) c.meta = { origin: 'cache', source: 'وزارة التربية والتعليم' };
    return c;
  }

  // تسوية كتالوج قادم من Supabase أو أداة المزامنة
  function normalizeCatalog(raw) {
    if (!raw || !Array.isArray(raw.books) || !raw.books.length) return null;
    const stages = raw.stages || [];
    const grades = raw.grades || [];
    const subjects = raw.subjects || [];
    const books = raw.books.map(b => ({
      id: String(b.id),
      stageId: b.stageId || b.stage_id || '',
      gradeId: b.gradeId || b.grade_id || '',
      subjectId: b.subjectId || b.subject_id || '',
      stage: b.stage || '', grade: b.grade || '', term: b.term || '',
      subject: b.subject || '', type: b.type || b.book_type || 'كتاب الطالب',
      title: b.title || [b.subject, b.grade].filter(Boolean).join(' — '),
      academicYear: b.academicYear || b.academic_year || raw.academicYear || '',
      officialUrl: b.officialUrl || b.official_url || 'https://studentbooks.moe.gov.eg/Books/',
      pdfUrl: b.pdfUrl || b.pdf_url || '',
      coverUrl: b.coverUrl || b.cover_url || null,
      source: b.source || 'وزارة التربية والتعليم',
      sourceUrl: b.sourceUrl || b.source_url || 'https://studentbooks.moe.gov.eg/Books/'
    })).filter(b => b.pdfUrl);
    if (!books.length) return null;
    return {
      stages, grades, subjects, books,
      meta: {
        version: raw.version || 0,
        academicYear: raw.academicYear || '',
        source: raw.source || 'وزارة التربية والتعليم',
        sourceUrl: raw.sourceUrl || 'https://studentbooks.moe.gov.eg/Books/',
        origin: raw.__origin || 'cloud',
        syncedAt: raw.lastSyncedAt || raw.last_synced_at || null,
        bookCount: books.length
      }
    };
  }

  // التحميل الأساسي: كاش ← احتياطي مدمج
  function load() {
    if (state.catalog) return Promise.resolve(state.catalog);
    if (state.loading) return state.loading;

    state.loading = new Promise((resolve) => {
      let cat = cachedCatalog();
      if (!cat) {
        cat = bundledCatalog();
        if (cat) lsSet(KEYS.catalog, cat); // تخزين أول مرة
      }
      state.catalog = cat || { stages: [], grades: [], subjects: [], books: [], meta: { origin: 'empty', source: 'وزارة التربية والتعليم' } };
      resolve(state.catalog);
    });
    return state.loading;
  }

  // تحديث من Supabase (خلفي، لا يفشل التطبيق أبدًا)
  async function refreshFromCloud({ silent = true } = {}) {
    const bundled = bundledCatalog();
    let fresh = null;
    let cloudFailed = false;

    // 1) محاولة السحب من Supabase (بيانات أحدث إن وجدت)
    if (window.CurriculumAPI && CurriculumAPI.isReady()) {
      try {
        const raw = await CurriculumAPI.pullCatalog();
        fresh = normalizeCatalog(Object.assign({}, raw, { __origin: 'cloud' }));
      } catch (e) {
        cloudFailed = true;
        if (!silent) console.warn('[CurriculumData] cloud pull failed:', e);
      }
    } else {
      cloudFailed = !!(window.SupabaseConfig && SupabaseConfig.isReady());
    }

    // 2) اتجاه المقارنة: نسخة أحدث سنةً دراسية أو عدد كتب أكبر تفوز
    const current = cachedCatalog() || bundled;
    let chosen = fresh;
    if (chosen && current) {
      const curYear = current.meta.academicYear || '';
      const newYear = chosen.meta.academicYear || '';
      const curCount = (current.books || []).length;
      const newCount = (chosen.books || []).length;
      if (newYear && curYear && newYear < curYear) chosen = null;        // أقدم — تجاهل
      else if (newYear === curYear && newCount <= curCount && current.meta.origin === 'cloud') chosen = null;
    }

    if (chosen) {
      lsSet(KEYS.catalog, chosen);
      state.catalog = chosen;
      state.listeners.forEach(fn => { try { fn(chosen); } catch (e) {} });
    }

    // 3) رسالة عند تعذر التحديث (سلوك مطلوب: لا يتوقف التطبيق)
    if (cloudFailed && !silent) {
      return { ok: false, msg: 'تعذر تحديث المناهج حاليًا. سيتم استخدام آخر بيانات محفوظة.' };
    }
    return { ok: true, catalog: state.catalog, updated: !!chosen };
  }

  // استيراد كتالوج من ملف JSON (ناتج أداة المزامنة)
  function importCatalog(raw) {
    const cat = normalizeCatalog(Object.assign({}, raw, { __origin: 'imported' }));
    if (!cat) return { ok: false, msg: 'ملف الكتالوج غير صالح — تأكد أنه ناتج أداة مزامنة مُعلّمي' };
    lsSet(KEYS.catalog, cat);
    state.catalog = cat;
    state.listeners.forEach(fn => { try { fn(cat); } catch (e) {} });
    return { ok: true, count: cat.books.length };
  }

  function onChange(fn) { state.listeners.push(fn); }

  // ============ استعلامات الكتالوج ============

  function catalog() { return state.catalog || { stages: [], grades: [], subjects: [], books: [] }; }
  function stages() { return catalog().stages.slice().sort((a, b) => (a.order_index || 0) - (b.order_index || 0)); }
  function grades(stageId) {
    return catalog().grades.filter(g => g.stage_id === stageId)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }
  function gradeById(id) { return catalog().grades.find(g => g.id === id); }
  function stageById(id) { return catalog().stages.find(s => s.id === id); }
  function subjectById(id) { return catalog().subjects.find(s => s.id === id); }

  function subjectsFor(stageId, gradeId) {
    const books = catalog().books;
    const map = new Map();
    books.forEach(b => {
      if (stageId && b.stageId !== stageId) return;
      if (gradeId && b.gradeId !== gradeId) return;
      if (!map.has(b.subjectId)) map.set(b.subjectId, { id: b.subjectId, title: b.subject });
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, 'ar'));
  }

  function termsFor(stageId, gradeId, subjectId) {
    const set = new Set();
    catalog().books.forEach(b => {
      if (stageId && b.stageId !== stageId) return;
      if (gradeId && b.gradeId !== gradeId) return;
      if (subjectId && b.subjectId !== subjectId) return;
      set.add(b.term);
    });
    return Array.from(set);
  }

  function booksFor(filter) {
    const f = filter || {};
    return catalog().books.filter(b =>
      (!f.stageId || b.stageId === f.stageId) &&
      (!f.gradeId || b.gradeId === f.gradeId) &&
      (!f.subjectId || b.subjectId === f.subjectId) &&
      (!f.term || b.term === f.term) &&
      (!f.type || b.type === f.type) &&
      (!f.id || b.id === f.id)
    );
  }

  function book(id) { return catalog().books.find(b => b.id === id); }

  // ============ البحث الشامل ============
  // يبحث في: الكتب (عنوان/مادة/صف/مرحلة) + الوحدات والدروس (بتعريف المدرس)
  function search(q) {
    const query = String(q || '').trim().toLowerCase();
    if (query.length < 2) return { books: [], lessons: [] };

    const norm = s => String(s || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    const qn = norm(query);

    const books = catalog().books.filter(b =>
      norm(b.title).includes(qn) || norm(b.subject).includes(qn) ||
      norm(b.grade).includes(qn) || norm(b.stage).includes(qn) ||
      norm(b.term).includes(qn) || norm(b.type).includes(qn)
    ).slice(0, 30);

    const lessons = [];
    (lsGet(KEYS.lessons, [])).forEach(l => {
      if (norm(l.title).includes(qn) || norm(l.description).includes(qn)) lessons.push({ type: 'lesson', lesson: l });
    });
    (lsGet(KEYS.units, [])).forEach(u => {
      if (norm(u.title).includes(qn)) lessons.push({ type: 'unit', unit: u });
    });

    return { books, lessons: lessons.slice(0, 20) };
  }

  // ============ المفضلة ============
  function favorites() { return lsGet(KEYS.favorites, []); }
  function isFavorite(itemType, itemId) {
    return favorites().some(f => f.itemType === itemType && f.itemId === itemId);
  }
  function toggleFavorite(itemType, itemId, data) {
    let list = favorites();
    const existing = list.find(f => f.itemType === itemType && f.itemId === itemId);
    let added = false;
    if (existing) {
      list = list.filter(f => f !== existing);
      // تتبع الحذف ليُنفَّذ سحابيًا عبر CurriculumAPI
      const sync = syncInfo();
      const removed = sync.removedFavorites || [];
      if (existing.id && !removed.includes(existing.id)) removed.push(existing.id);
      sync.removedFavorites = removed;
      lsSet(KEYS.sync, sync);
    } else {
      list.push({
        id: uid('cfav_'), itemType, itemId,
        data: data || {}, addedAt: new Date().toISOString(), _dirty: true
      });
      added = true;
    }
    lsSet(KEYS.favorites, list);
    if (window.CurriculumAPI) CurriculumAPI.pushFavorites().catch(() => {});
    return added;
  }

  // ============ الوحدات والدروس (يبنيها المدرس) ============
  function units(bookId) {
    return lsGet(KEYS.units, []).filter(u => u.bookId === bookId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }
  function unitsAll() { return lsGet(KEYS.units, []); }
  function lessons(unitId) {
    return lsGet(KEYS.lessons, []).filter(l => l.unitId === unitId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }
  function lessonsAll() { return lsGet(KEYS.lessons, []); }
  function lessonsByBook(bookId) {
    return lsGet(KEYS.lessons, []).filter(l => l.bookId === bookId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }
  function unit(id) { return lsGet(KEYS.units, []).find(u => u.id === id); }
  function lesson(id) { return lsGet(KEYS.lessons, []).find(l => l.id === id); }

  function addUnit(bookId, title, orderIndex) {
    const list = lsGet(KEYS.units, []);
    const unitObj = {
      id: uid('cu_'), bookId, title: String(title || '').trim() || 'وحدة جديدة',
      orderIndex: orderIndex != null ? orderIndex : list.filter(u => u.bookId === bookId).length,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    list.push(unitObj);
    lsSet(KEYS.units, list);
    if (window.CurriculumAPI) CurriculumAPI.pushUnits().catch(() => {});
    return unitObj;
  }

  function addLesson(unitId, bookId, title, description, orderIndex) {
    const list = lsGet(KEYS.lessons, []);
    const lessonObj = {
      id: uid('cl_'), unitId, bookId,
      title: String(title || '').trim() || 'درس جديد',
      description: String(description || '').trim(),
      orderIndex: orderIndex != null ? orderIndex : list.filter(l => l.unitId === unitId).length,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    list.push(lessonObj);
    lsSet(KEYS.lessons, list);
    if (window.CurriculumAPI) CurriculumAPI.pushUnits().catch(() => {});
    return lessonObj;
  }

  function removeUnit(unitId) {
    const sync1 = syncInfo();
    const ru = sync1.removedUnits || [];
    if (!ru.includes(unitId)) ru.push(unitId);
    sync1.removedUnits = ru;
    lsSet(KEYS.sync, sync1);
    lsGet(KEYS.lessons, []).filter(l => l.unitId === unitId).forEach(l => {
      const s2 = syncInfo();
      const rl = s2.removedLessons || [];
      if (!rl.includes(l.id)) rl.push(l.id);
      s2.removedLessons = rl;
      lsSet(KEYS.sync, s2);
    });
    lsSet(KEYS.units, lsGet(KEYS.units, []).filter(u => u.id !== unitId));
    lsSet(KEYS.lessons, lsGet(KEYS.lessons, []).filter(l => l.unitId !== unitId));
    lsSet(KEYS.progress, lsGet(KEYS.progress, []).filter(p => p.unitId !== unitId));
    if (window.CurriculumAPI) CurriculumAPI.pushUnits().catch(() => {});
  }
  function removeLesson(lessonId) {
    const sync = syncInfo();
    const rl = sync.removedLessons || [];
    if (!rl.includes(lessonId)) rl.push(lessonId);
    sync.removedLessons = rl;
    lsSet(KEYS.sync, sync);
    lsSet(KEYS.lessons, lsGet(KEYS.lessons, []).filter(l => l.id !== lessonId));
    lsSet(KEYS.progress, lsGet(KEYS.progress, []).filter(p => p.lessonId !== lessonId));
    if (window.CurriculumAPI) CurriculumAPI.pushUnits().catch(() => {});
  }

  // ============ متابعة التقدم (تم تدريس الدرس) ============
  function progress() { return lsGet(KEYS.progress, []); }

  function isLessonTaught(lessonId, groupId) {
    return progress().some(p => p.lessonId === lessonId && (!groupId || p.groupId === groupId));
  }

  function toggleLessonTaught(lessonId, groupId, meta) {
    let list = progress();
    const existing = list.find(p => p.lessonId === lessonId && p.groupId === (groupId || null));
    let taught = false;
    if (existing) {
      list = list.filter(p => p !== existing);
    } else {
      list.push({
        id: uid('cp_'), lessonId, groupId: groupId || null,
        bookId: (meta && meta.bookId) || (lesson(lessonId) || {}).bookId || '',
        unitId: (meta && meta.unitId) || (lesson(lessonId) || {}).unitId || '',
        taughtDate: Utils.today(), status: 'تم التدريس',
        createdAt: new Date().toISOString()
      });
      taught = true;
    }
    lsSet(KEYS.progress, list);
    if (window.CurriculumAPI) CurriculumAPI.pushProgress().catch(() => {});
    return taught;
  }

  // نسبة إنجاز وحدة/كتاب = الدروس المدرَّسة / إجمالي الدروس
  function unitProgress(unitId, groupId) {
    const all = lessons(unitId);
    if (!all.length) return { done: 0, total: 0, pct: 0 };
    const done = all.filter(l => isLessonTaught(l.id, groupId)).length;
    return { done, total: all.length, pct: Math.round((done / all.length) * 100) };
  }

  function bookProgress(bookId, groupId) {
    const bookUnits = units(bookId);
    let done = 0, total = 0;
    bookUnits.forEach(u => {
      const p = unitProgress(u.id, groupId);
      done += p.done; total += p.total;
    });
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  // آخر درس تم تدريسه + الدرس القادم لكتاب
  function bookLastNext(bookId) {
    const bookUnits = units(bookId);
    const ordered = [];
    bookUnits.forEach(u => lessons(u.id).forEach(l => ordered.push(l)));
    const taught = ordered.filter(l => isLessonTaught(l.id));
    const last = taught.length ? taught[taught.length - 1] : null;
    const next = last ? (ordered[ordered.indexOf(last) + 1] || null) : (ordered[0] || null);
    return { last, next };
  }

  // ============ كائن مرجع المنهج (يُحفظ مع الدروس/الواجبات/الامتحانات/الأسئلة) ============
  // الشكل الموحد المطلوب:
  // { curriculumId, grade, subject, term, bookId, unitId, lessonId, source }
  function reference(sel) {
    const s = sel || {};
    const b = s.bookId ? book(s.bookId) : null;
    const g = s.gradeId ? gradeById(s.gradeId) : null;
    return {
      curriculumId: s.lessonId || s.unitId || s.bookId || (b ? b.id : ''),
      grade: (g ? g.title : (b ? b.grade : (s.grade || ''))),
      subject: s.subject || (b ? b.subject : ''),
      term: s.term || (b ? b.term : ''),
      bookId: s.bookId || (b ? b.id : ''),
      unitId: s.unitId || '',
      lessonId: s.lessonId || '',
      source: 'وزارة التربية والتعليم'
    };
  }

  // بيانات المزامنة (لعرضها في الواجهة)
  function syncInfo() { return lsGet(KEYS.sync, {}); }
  function setSyncInfo(info) { lsSet(KEYS.sync, info || {}); }

  return {
    load, refreshFromCloud, importCatalog, onChange,
    catalog, stages, grades, gradeById, stageById, subjectById,
    subjectsFor, termsFor, booksFor, book,
    search,
    favorites, isFavorite, toggleFavorite,
    units, unitsAll, lessons, lessonsAll, lessonsByBook, unit, lesson,
    addUnit, addLesson, removeUnit, removeLesson,
    progress, isLessonTaught, toggleLessonTaught,
    unitProgress, bookProgress, bookLastNext,
    reference, syncInfo, setSyncInfo, KEYS
  };
})();

window.CurriculumData = CurriculumData;

// تحميل الكتالوج فورًا عند تحميل الملف (من الكاش المحلي — فوري بدون شبكة)
// والمزامنة الخلفية مع Supabase تحدث لاحقًا عبر CurriculumAPI.init()
CurriculumData.load();
