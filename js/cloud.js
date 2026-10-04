/* ============================================
   مُعلّمي | cloud.js
   محرك المزامنة السحابية (Supabase + LocalStorage Cache)
   --------------------------------------------
   الاستراتيجية: محلي أولًا (Local-first)
   - كل عمليات التطبيق تكتب في LocalStorage فورًا (سرعة + أوفلاين)
   - Storage يُعلِم Cloud عند كل تغيير (وسم Dirty)
   - Cloud يرفع الفروقات إلى Supabase (upsert/delete) ويجذب الجديد
   - حل التعارضات: آخر كتابة تفوز (Last-Write-Wins) بحسب updatedAt
   - الأوفلاين: يبقى الطابور ممتلئًا ويُرفع تلقائيًا عند عودة الاتصال
   ============================================ */

const Cloud = (function () {
  'use strict';

  // ===== الحالة الداخلية =====
  const state = {
    userId: null,
    dirty: new Set(),          // مجموعات محلية تغيّرت ولم تُرفع
    teacherDirty: false,       // تغيّرت بيانات حساب المعلم
    shadow: {},                // آخر حالة سحابية معروفة لكل مجموعة {collection: {id: json}}
    flushing: false,
    suspended: false,          // إيقاف مؤقت (تسجيل خروج / مسح شامل)
    pullTimer: null,
    flushTimer: null,
    retryTimer: null,
    lastSync: null,
    listenersBound: false
  };

  const SHADOW_KEY = 'moallemy_cloud_shadow';

  // مجموعات التخزين المحلي ← جداول Supabase
  // (subjects/stages تُدمج داخل صف settings لعدم وجود جدولين لها)
  // ⚠️ القيم هنا هي **قيم** مفاتيح Storage وليست أسماء خصائصها
  // ai_exams: الامتحانات المولدة بالذكاء الاصطناعي — محلية فقط (لا جدول سحابي لها)
  const LOCAL_ONLY = ['meta', 'install_dismissed', 'curriculum', 'ai_exams'];

  // ===== أدوات =====
  function client() {
    return window.SupabaseConfig && SupabaseConfig.isReady() ? SupabaseConfig.client : null;
  }

  function authed() {
    return !!(client() && state.userId && !state.suspended && !Storage.isDemoMode());
  }

  function loadShadow() {
    if (Object.keys(state.shadow).length) return;
    state.shadow = Storage.get(SHADOW_KEY, {});
  }

  function saveShadow() {
    Storage.set(SHADOW_KEY, state.shadow);
  }

  function snapshotOf(name) {
    const val = Storage.get(name, null);
    const map = {};
    if (Array.isArray(val)) {
      val.forEach(item => { if (item && item.id) map[item.id] = JSON.stringify(item); });
    } else if (val && typeof val === 'object') {
      // كائنات مفردة (settings) تُخزَّن بمفتاح ثابت
      map['__single__'] = JSON.stringify(val);
    }
    return map;
  }

  // ===== الوسم عند أي تغيير محلي (يستدعيه storage.js) =====
  function markDirty(name) {
    if (state.suspended) return;
    if (!state.userId) return;               // قبل الدخول لا توجد مزامنة
    loadShadow();
    if (name === Storage.KEYS.teacher) {
      state.teacherDirty = true;
      scheduleFlush(2500);
      return;
    }
    if (LOCAL_ONLY.includes(name)) return;
    if (name === Storage.KEYS.subjects || name === Storage.KEYS.stages) {
      // تُحمل مع صف settings
      state.dirty.add(Storage.KEYS.settings);
    } else if (Object.values(Storage.KEYS).includes(name)) {
      state.dirty.add(name);
    }
    scheduleFlush(2500);
  }

  function scheduleFlush(delay) {
    if (state.flushTimer) clearTimeout(state.flushTimer);
    state.flushTimer = setTimeout(() => flush(), delay == null ? 0 : delay);
  }

  // ============ الرفع (Push) ============
  async function flush() {
    if (!authed() || state.flushing) return;
    if (!navigator.onLine) return;           // أوفلاين: يُعاد المحاولة عند online
    state.flushing = true;
    if (state.retryTimer) { clearTimeout(state.retryTimer); state.retryTimer = null; }
    try {
      if (state.teacherDirty) {
        const ok = await pushTeacherProfile();
        if (ok) state.teacherDirty = false;
        else throw new Error('teacher push failed');
      }
      for (const name of Array.from(state.dirty)) {
        const ok = await pushCollection(name);
        if (ok) state.dirty.delete(name);
        else throw new Error('push failed: ' + name);
      }
      state.lastSync = Date.now();
      saveShadow();
    } catch (err) {
      // فشل شبكة/سيرفر: أبقِ الوسوم وأعد المحاولة لاحقًا بصمت
      console.warn('[Cloud] تأجيل المزامنة:', err && err.message);
      state.retryTimer = setTimeout(() => flush(), 15000);
    } finally {
      state.flushing = false;
    }
  }

  async function pushCollection(name) {
    const c = client();
    const table = name === Storage.KEYS.settings ? 'settings' : name;
    loadShadow();

    const localMap = snapshotOf(name);
    const shadowMap = state.shadow[name] || {};

    // فروقات: جديد/مغير/محذوف — صف settings يُرفع دائمًا عند الوسم (لأن المخصصات تُطوى داخله)
    const upserts = [];
    Object.keys(localMap).forEach(id => {
      const force = (name === Storage.KEYS.settings && id === '__single__');
      if (force || localMap[id] !== shadowMap[id]) {
        let data;
        try { data = JSON.parse(localMap[id]); } catch (_) { data = null; }
        if (!data) return;
        if (id === '__single__') {
          // صف المجموعة الوحيد (settings): أرفق المخصصات
          if (name === Storage.KEYS.settings) {
            data = Object.assign({}, data, {
              __subjects: Storage.get(Storage.KEYS.subjects, []),
              __stages: Storage.get(Storage.KEYS.stages, []),
              __syncedAt: Date.now()
            });
          }
          upserts.push({ id: state.userId, teacher_id: state.userId, data, updated_at: new Date().toISOString() });
        } else {
          upserts.push({ id, teacher_id: state.userId, data, updated_at: new Date().toISOString() });
        }
      }
    });
    const deletes = Object.keys(shadowMap).filter(id => !(id in localMap));

    // تنفيذ الدفعات
    for (let i = 0; i < upserts.length; i += 500) {
      const batch = upserts.slice(i, i + 500);
      const { error } = await c.from(table).upsert(batch, { onConflict: 'id' });
      if (error) { console.warn('[Cloud] upsert', table, error.message); return false; }
    }
    for (let i = 0; i < deletes.length; i += 50) {
      const batch = deletes.slice(i, i + 50);
      const { error } = await c.from(table).delete().in('id', batch);
      if (error) { console.warn('[Cloud] delete', table, error.message); return false; }
    }

    // تحديث الظل بعد نجاح الرفع
    state.shadow[name] = localMap;
    return true;
  }

  async function pushTeacherProfile() {
    const c = client();
    const t = Storage.get(Storage.KEYS.teacher, null);
    if (!t) return true;
    const row = {
      id: state.userId,
      name: t.name || '',
      phone: t.phone || null,
      email: t.email || null,
      subject: t.subject || null,
      stage: t.stage || null,
      governorate: t.governorate || null,
      logo: t.logo || null,
      bio: t.bio || null,
      updated_at: new Date().toISOString()
    };
    const { error } = await c.from('teacher_profiles').upsert(row, { onConflict: 'id' });
    if (error) { console.warn('[Cloud] profile push:', error.message); return false; }
    state.shadow.teacher_profile = {
      name: row.name, phone: row.phone, email: row.email, subject: row.subject,
      stage: row.stage, governorate: row.governorate, logo: row.logo, bio: row.bio
    };
    return true;
  }

  // ============ الجذب (Pull) ============
  async function pull(silent) {
    if (!authed() || !navigator.onLine) return { ok: false, offline: !navigator.onLine };
    const c = client();
    let changed = false;

    try {
      // 1) بيانات الحساب
      const prof = await pullTeacherProfile();
      if (prof) changed = true;

      // 2) الجداول
      for (const table of SupabaseConfig.tables) {
        const name = table === 'settings' ? Storage.KEYS.settings : table;
        const rows = await fetchAllRows(c, table);
        const merged = await mergeServerRows(name, table, rows);
        if (merged) changed = true;
      }
      saveShadow();
      if (changed) state.lastSync = Date.now();
      return { ok: true, changed };
    } catch (err) {
      console.warn('[Cloud] pull failed:', err && err.message);
      if (!silent) UI.toast('تعذر تحميل البيانات من السحابة — ستعمل بالبيانات المحلية', 'warning');
      return { ok: false };
    }
  }

  async function fetchAllRows(c, table) {
    const PAGE = 1000;
    let from = 0, all = [];
    for (;;) {
      const { data, error } = await c.from(table).select('id,data').range(from, from + PAGE - 1);
      if (error) throw new Error(table + ': ' + error.message);
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  async function pullTeacherProfile() {
    const c = client();
    const { data, error } = await c.from('teacher_profiles')
      .select('name,phone,email,subject,stage,governorate,logo,bio,updated_at')
      .eq('id', state.userId).maybeSingle();
    if (error) throw new Error('profile: ' + error.message);
    if (!data) return false;

    const teacher = Storage.get(Storage.KEYS.teacher, null);
    if (!teacher) return false;

    const serverMs = data.updated_at ? new Date(data.updated_at).getTime() : 0;
    const localMs = teacher.updatedAt || teacher.createdAt || 0;
    if (serverMs <= localMs) return false;

    // السحابة أحدث: تبنَّ حقول الحساب (بدون لمس id/pin)
    const next = Object.assign({}, teacher, {
      name: data.name || teacher.name,
      phone: data.phone || teacher.phone,
      email: data.email || null,
      subject: data.subject || teacher.subject,
      stage: data.stage || null,
      governorate: data.governorate || null,
      logo: data.logo || null,
      bio: data.bio || '',
      updatedAt: serverMs
    });
    state.suspended = true;               // منع حلقة رفع فورية لنفس القيمة
    Storage.set(Storage.KEYS.teacher, next);
    state.suspended = false;
    state.shadow.teacher_profile = {
      name: next.name, phone: next.phone, email: next.email, subject: next.subject,
      stage: next.stage, governorate: next.governorate, logo: next.logo, bio: next.bio
    };
    return true;
  }

  async function mergeServerRows(name, table, rows) {
    loadShadow();
    const isSettings = name === Storage.KEYS.settings;
    let local = Storage.get(name, isSettings ? {} : []);
    if (isSettings && !local) local = {};
    const shadowMap = state.shadow[name] || {};
    let changed = false;

    if (isSettings) {
      // صف مفرد + مخصصات subjects/stages داخل نفس الصف
      // معرّف الصف = uuid المعلم (عزل كامل بين المعلمين — المعرّف الثابت القديم 'settings'
      // كان يسبب تعارض مفتاح أساسي ورفض RLS عند تعدد الحسابات)
      const row = rows.find(r => r.id === state.userId) || rows.find(r => r.id === 'settings');
      if (row && row.data) {
        const { __subjects, __stages, __syncedAt, ...settingsData } = row.data;
        const serverSync = __syncedAt || 0;
        const knownSync = (state.shadow.__settings_meta__ || {}).syncedAt || 0;
        const localJson = JSON.stringify(local);
        const serverJson = JSON.stringify(settingsData);

        if (serverSync > knownSync && serverJson !== localJson) {
          // السحابة أحدث: تبنَّ الإعدادات والمخصصات
          state.suspended = true;
          Storage.set(name, settingsData);
          if (Array.isArray(__subjects)) Storage.set(Storage.KEYS.subjects, __subjects);
          if (Array.isArray(__stages)) Storage.set(Storage.KEYS.stages, __stages);
          state.suspended = false;
          changed = true;
        } else if (serverJson !== localJson) {
          // المحلي أحدث: سجّله للرفع في flush التالي
          state.dirty.add(name);
        }
        state.shadow.__settings_meta__ = { syncedAt: Math.max(serverSync, knownSync) };
        // الظل بصيغة محلية (بدون حقول الطي) لمطابقة مقارنة الرفع
        state.shadow[name] = { '__single__': JSON.stringify(settingsData) };
      }
      return changed;
    }

    // مجموعات: مصفوفات — دمج LWW بالسجل
    const localById = {};
    (Array.isArray(local) ? local : []).forEach(it => { if (it && it.id) localById[it.id] = it; });

    rows.forEach(row => {
      if (!row || !row.id || row.id === '__single__') return;
      const srv = row.data;
      if (!srv || typeof srv !== 'object') return;
      const loc = localById[row.id];
      if (!loc) {
        localById[row.id] = srv;
        changed = true;
      } else {
        const lMs = loc.updatedAt || loc.createdAt || 0;
        const sMs = srv.updatedAt || srv.createdAt || 0;
        if (sMs > lMs) { localById[row.id] = srv; changed = true; }
      }
    });

    if (changed) {
      const mergedList = Object.values(localById);
      state.suspended = true;
      Storage.set(name, mergedList);
      state.suspended = false;
    }
    // الظل = الحالة السحابية كما جُلبت (ليس المحلي) — حتى تُرفع التعديلات المحلية الأحدث
    const srvShadow = {};
    rows.forEach(row => { if (row && row.id && row.data) srvShadow[row.id] = JSON.stringify(row.data); });
    state.shadow[name] = srvShadow;
    return changed;
  }

  // ============ واجهات التشغيل ============
  async function init(userId, opts = {}) {
    if (!client()) return;
    state.userId = userId;
    state.suspended = false;
    loadShadow();

    // سحب أولي ثم رفع المعلق
    await pull(opts.silent !== false);
    await flush();

    if (!state.listenersBound) {
      bindListeners();
      state.listenersBound = true;
    }
  }

  function bindListeners() {
    window.addEventListener('online', () => {
      if (authed()) { pull(true).then(() => flush()); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && authed()) flush();
    });
    state.pullTimer = setInterval(() => {
      if (authed() && navigator.onLine) pull(true);
    }, 5 * 60 * 1000);
    state.flushTimer2 = setInterval(() => {
      if (authed() && (state.dirty.size || state.teacherDirty)) flush();
    }, 45 * 1000);
  }

  function suspend() {
    state.suspended = true;
    if (state.flushTimer) clearTimeout(state.flushTimer);
    if (state.retryTimer) clearTimeout(state.retryTimer);
    state.dirty.clear();
    state.teacherDirty = false;
  }

  function resume(userId) {
    state.suspended = false;
    state.userId = userId || state.userId;
  }

  // مسح كل البيانات السحابية للمعلم (يستدعى من "مسح جميع البيانات")
  async function wipeCloudData() {
    if (!authed()) return false;
    state.suspended = true;
    try {
      const c = client();
      for (const table of SupabaseConfig.tables) {
        // RLS يقيّد الحذف على بيانات هذا المعلم فقط
        await c.from(table).delete().not('id', 'is', null);
      }
      state.shadow = {};
      saveShadow();
      return true;
    } catch (err) {
      console.warn('[Cloud] wipe failed:', err && err.message);
      return false;
    } finally {
      state.suspended = false;
    }
  }

  // استيراد نسخة احتياطية: ارفع كل شيء بعد الاستيراد
  function syncEverything() {
    if (!authed()) return;
    Object.values(Storage.KEYS).forEach(name => markDirty(name));
    state.teacherDirty = true;
    scheduleFlush(800);
  }

  function status() {
    return {
      ready: SupabaseConfig.isReady(),
      authed: !!state.userId,
      online: navigator.onLine,
      demo: Storage.isDemoMode(),
      pending: state.dirty.size + (state.teacherDirty ? 1 : 0),
      lastSync: state.lastSync
    };
  }

  // ===== الواجهة العامة =====
  return {
    init, markDirty, flush, pull, suspend, resume,
    wipeCloudData, syncEverything, status,
    isAuthed: () => authed()
  };
})();

window.Cloud = Cloud;
