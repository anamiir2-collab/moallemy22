/* ============================================
   مُعلّمي | js/curriculum-api.js
   نظام المناهج — طبقة المزامنة السحابية (Supabase)
   --------------------------------------------
   البنية المعمارية (كما هو محدد في متطلبات المشروع):
     وزارة التعليم → أداة مزامنة (tools/moe-sync) → Supabase → مُعلّمي
   التطبيق لا يتصل بموقع الوزارة إطلاقًا — يقرأ من Supabase فقط.

   المسؤوليات:
   1) سحب الكتالوج الرسمي (curriculum_stages/grades/subjects/books)
   2) مزامنة بيانات المدرس الخاصة (units/lessons/favorites/progress)
      — محلي أولًا، والسحابة نسخة مطابقة (Last-Write-Wins بـ updatedAt)
   3) التعامل مع فشل الشبكة بأمان — لا يتوقف التطبيق أبدًا
   ============================================ */

const CurriculumAPI = (function () {
  'use strict';

  const TABLES = {
    stages: 'curriculum_stages',
    grades: 'curriculum_grades',
    subjects: 'curriculum_subjects',
    books: 'curriculum_books',
    units: 'curriculum_units',
    lessons: 'curriculum_lessons',
    favorites: 'curriculum_favorites',
    progress: 'curriculum_teacher_progress',
    syncState: 'curriculum_sync_state'
  };

  function client() {
    return window.SupabaseConfig && SupabaseConfig.isReady() ? SupabaseConfig.client : null;
  }

  function isReady() {
    const c = client();
    return !!(c && window.SupabaseReady);
  }

  function teacherId() {
    try { return (window.Auth && Auth.getUserId && Auth.getUserId()) || null; }
    catch (e) { return null; }
  }

  function online() { return navigator.onLine; }

  // رسالة خطأ عربية موحدة
  function errMsg(e) {
    const m = (e && (e.message || e.error_description || e.msg)) || '';
    if (/Failed to fetch|NetworkError|load failed/i.test(m)) return 'لا يوجد اتصال بالإنترنت — سيتم استخدام البيانات المحفوظة محليًا';
    if (/relation .* does not exist|schema cache/i.test(m)) return 'جداول المناهج غير مهيأة بعد في Supabase — نفّذ supabase/curriculum-schema.sql ثم أداة المزامنة';
    return m || 'تعذر تنفيذ العملية';
  }

  // ============ 1) سحب الكتالوج الرسمي ============
  async function pullCatalog() {
    const c = client();
    if (!c) throw new Error('Supabase غير متاح');

    const [stagesRes, gradesRes, subjectsRes, booksRes, syncRes] = await Promise.all([
      c.from(TABLES.stages).select('*').order('order_index', { ascending: true }),
      c.from(TABLES.grades).select('*').order('order_index', { ascending: true }),
      c.from(TABLES.subjects).select('*').order('title', { ascending: true }),
      c.from(TABLES.books).select('*').order('title', { ascending: true }),
      c.from(TABLES.syncState).select('*').eq('id', 'global').maybeSingle()
    ]);

    const err = stagesRes.error || gradesRes.error || subjectsRes.error || booksRes.error;
    if (err) throw err;

    const mapStage = {};
    (stagesRes.data || []).forEach(s => { mapStage[s.id] = s.title; });
    const mapGrade = {};
    (gradesRes.data || []).forEach(g => { mapGrade[g.id] = g.title; });
    const mapSubject = {};
    (subjectsRes.data || []).forEach(s => { mapSubject[s.id] = s.title; });

    return {
      version: (syncRes && syncRes.data ? syncRes.data.book_count : 0) || (booksRes.data || []).length,
      academicYear: (syncRes && syncRes.data ? syncRes.data.academic_year : '') || '',
      source: 'وزارة التربية والتعليم والتعليم الفني — جمهورية مصر العربية',
      sourceUrl: 'https://studentbooks.moe.gov.eg/Books/',
      lastSyncedAt: (syncRes && syncRes.data ? syncRes.data.last_synced_at : null) || null,
      stages: (stagesRes.data || []).map(s => ({
        id: s.id, title: s.title, order_index: s.order_index || 0
      })),
      grades: (gradesRes.data || []).map(g => ({
        id: g.id, stage_id: g.stage_id, title: g.title, order_index: g.order_index || 0
      })),
      subjects: (subjectsRes.data || []).map(s => ({
        id: s.id, title: s.title, order_index: s.order_index || 0
      })),
      books: (booksRes.data || []).map(b => ({
        id: b.id,
        stageId: b.stage_id, gradeId: b.grade_id, subjectId: b.subject_id,
        stage: mapStage[b.stage_id] || b.stage || '',
        grade: mapGrade[b.grade_id] || b.grade || '',
        term: b.term || '', subject: mapSubject[b.subject_id] || b.subject || '',
        type: b.book_type || 'كتاب الطالب',
        title: b.title || '', academicYear: b.academic_year || '',
        officialUrl: b.official_url || '', pdfUrl: b.pdf_url || '',
        coverUrl: b.cover_url || null,
        source: b.source || 'وزارة التربية والتعليم',
        sourceUrl: b.source_url || ''
      }))
    };
  }

  // ============ 2) مزامنة بيانات المدرس ============

  // رفع/تحديث سجل في جدول المدرس
  async function upsertTeacherRow(table, row) {
    const c = client();
    if (!c || !teacherId()) return false;
    const payload = Object.assign({}, row, { teacher_id: teacherId(), updated_at: new Date().toISOString() });
    const { error } = await c.from(table).upsert(payload, { onConflict: 'id' });
    if (error) { console.warn(`[CurriculumAPI] upsert ${table}:`, error.message); return false; }
    return true;
  }

  async function deleteTeacherRow(table, id) {
    const c = client();
    if (!c || !teacherId()) return false;
    const { error } = await c.from(table).delete().eq('id', id).eq('teacher_id', teacherId());
    if (error) { console.warn(`[CurriculumAPI] delete ${table}:`, error.message); return false; }
    return true;
  }

  // ----- الوحدات والدروس -----
  async function pushUnits() {
    if (!isReady() || !online() || !teacherId()) return;
    const units = CurriculumData.unitsAll();
    const lessons = CurriculumData.lessonsAll();
    const c = client();

    // ارفع ما تغير فقط (حسب updatedAt مقارنة بآخر مزامنة)
    const lastPush = (CurriculumData.syncInfo().lastUnitsPush || 0);
    const changedUnits = units.filter(u => new Date(u.updatedAt || u.createdAt || 0).getTime() > lastPush);
    const changedLessons = lessons.filter(l => new Date(l.updatedAt || l.createdAt || 0).getTime() > lastPush);

    // محولات الحذف تُدار عبر removedUnits/removedLessons
    const sync = CurriculumData.syncInfo();
    const removedUnits = sync.removedUnits || [];
    const removedLessons = sync.removedLessons || [];

    let ok = true;
    for (const id of removedUnits) ok = await deleteTeacherRow(TABLES.units, id) && ok;
    for (const id of removedLessons) ok = await deleteTeacherRow(TABLES.lessons, id) && ok;

    for (const u of changedUnits) {
      ok = await upsertTeacherRow(TABLES.units, {
        id: u.id, book_id: u.bookId, title: u.title, order_index: u.orderIndex || 0, data: u
      }) && ok;
    }
    for (const l of changedLessons) {
      ok = await upsertTeacherRow(TABLES.lessons, {
        id: l.id, unit_id: l.unitId, book_id: l.bookId, title: l.title,
        description: l.description || '', order_index: l.orderIndex || 0, data: l
      }) && ok;
    }

    if (ok) {
      CurriculumData.setSyncInfo(Object.assign({}, sync, {
        lastUnitsPush: Date.now(),
        removedUnits: [], removedLessons: []
      }));
    }
  }

  // ----- المفضلة -----
  async function pushFavorites() {
    if (!isReady() || !online() || !teacherId()) return;
    const sync = CurriculumData.syncInfo();
    const removed = sync.removedFavorites || [];
    let ok = true;
    for (const id of removed) ok = await deleteTeacherRow(TABLES.favorites, id) && ok;

    const list = CurriculumData.favorites();
    const lastPush = (sync.lastFavoritesPush || 0);
    const changed = list.filter(f => new Date(f.addedAt || 0).getTime() > lastPush || f._dirty);
    for (const f of changed) {
      const row = Object.assign({}, f, { _dirty: undefined });
      ok = await upsertTeacherRow(TABLES.favorites, {
        id: f.id, item_type: f.itemType, item_id: f.itemId, data: row
      }) && ok;
    }
    if (ok) {
      CurriculumData.setSyncInfo(Object.assign({}, sync, { lastFavoritesPush: Date.now(), removedFavorites: [] }));
    }
  }

  // ----- التقدم -----
  async function pushProgress() {
    if (!isReady() || !online() || !teacherId()) return;
    const sync = CurriculumData.syncInfo();
    const removed = sync.removedProgress || [];
    let ok = true;
    for (const id of removed) ok = await deleteTeacherRow(TABLES.progress, id) && ok;

    const list = CurriculumData.progress();
    const lastPush = (sync.lastProgressPush || 0);
    const changed = list.filter(p => new Date(p.createdAt || 0).getTime() > lastPush || p._dirty);
    for (const p of changed) {
      const row = Object.assign({}, p, { _dirty: undefined });
      ok = await upsertTeacherRow(TABLES.progress, {
        id: p.id, group_id: p.groupId || null, book_id: p.bookId || '',
        unit_id: p.unitId || '', lesson_id: p.lessonId,
        taught_date: p.taughtDate || null, status: p.status || 'تم التدريس', data: row
      }) && ok;
    }
    if (ok) {
      CurriculumData.setSyncInfo(Object.assign({}, sync, { lastProgressPush: Date.now(), removedProgress: [] }));
    }
  }

  // ----- سحب بيانات المدرس من السحابة ودمجها محليًا -----
  async function pullTeacherData() {
    const c = client();
    if (!c || !teacherId()) return { ok: false };

    const [unitsRes, lessonsRes, favRes, progRes] = await Promise.all([
      c.from(TABLES.units).select('*').eq('teacher_id', teacherId()),
      c.from(TABLES.lessons).select('*').eq('teacher_id', teacherId()),
      c.from(TABLES.favorites).select('*').eq('teacher_id', teacherId()),
      c.from(TABLES.progress).select('*').eq('teacher_id', teacherId())
    ]);
    if (unitsRes.error || lessonsRes.error || favRes.error || progRes.error) {
      throw (unitsRes.error || lessonsRes.error || favRes.error || progRes.error);
    }

    // دمج Last-Write-Wins بحسب updatedAt
    const merge = (localKey, remoteRows, mapFn) => {
      const local = JSON.parse(localStorage.getItem('moallemy_' + localKey) || '[]');
      const localMap = new Map(local.map(x => [x.id, x]));
      (remoteRows || []).forEach(r => {
        const item = mapFn(r);
        const ex = localMap.get(item.id);
        if (!ex || new Date(item.updatedAt || 0) >= new Date(ex.updatedAt || 0)) {
          localMap.set(item.id, item);
        }
      });
      localStorage.setItem('moallemy_' + localKey, JSON.stringify(Array.from(localMap.values())));
    };

    try {
      merge(CurriculumData.KEYS.units, unitsRes.data, r => r.data || {
        id: r.id, bookId: r.book_id, title: r.title, orderIndex: r.order_index,
        updatedAt: r.updated_at
      });
      merge(CurriculumData.KEYS.lessons, lessonsRes.data, r => r.data || {
        id: r.id, unitId: r.unit_id, bookId: r.book_id, title: r.title,
        description: r.description || '', orderIndex: r.order_index, updatedAt: r.updated_at
      });
      merge(CurriculumData.KEYS.favorites, favRes.data, r => r.data || {
        id: r.id, itemType: r.item_type, itemId: r.item_id, addedAt: r.created_at
      });
      merge(CurriculumData.KEYS.progress, progRes.data, r => r.data || {
        id: r.id, groupId: r.group_id, bookId: r.book_id, unitId: r.unit_id,
        lessonId: r.lesson_id, taughtDate: r.taught_date, status: r.status,
        createdAt: r.created_at
      });
    } catch (e) {
      console.warn('[CurriculumAPI] merge error:', e);
    }

    return { ok: true };
  }

  // ============ 3) التهيئة عند تسجيل الدخول ============
  let initialized = false;
  async function init() {
    if (initialized) return;
    initialized = true;
    // سحب خلفي صامت: الكتالوج + بيانات المدرس
    CurriculumData.refreshFromCloud({ silent: true }).catch(() => {});
    pullTeacherData().catch(() => {});
  }

  // تسجيل سجلات محذوفة (قبل الحذف الفعلي) — ليتولى الدفع حذفها سحابيًا
  function trackRemoval(kind, id) {
    const sync = CurriculumData.syncInfo();
    const key = 'removed' + kind.charAt(0).toUpperCase() + kind.slice(1);
    const list = sync[key] || [];
    if (!list.includes(id)) list.push(id);
    sync[key] = list;
    CurriculumData.setSyncInfo(sync);
  }

  return {
    isReady, init, pullCatalog, pullTeacherData,
    pushUnits, pushFavorites, pushProgress, trackRemoval,
    TABLES, errMsg
  };
})();

window.CurriculumAPI = CurriculumAPI;

// ملاحظة: تتبع الحذف (المفضلة/الوحدات/الدروس) يُسجَّل داخل CurriculumData نفسها
// في syncInfo.removed* — لضمان عدم فقدان الحذف قبل نجاح المزامنة.
