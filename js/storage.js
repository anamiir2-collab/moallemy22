/* ============================================
   مُعلّمي | storage.js
   طبقة التخزين - قابلة للاستبدال بقاعدة بيانات سحابية
   تعتمد حالياً على LocalStorage مع واجهة Promise-ready
   + نظام إصدارات البيانات والترحيل (Data Versioning & Migration)
   ============================================ */

const Storage = (function () {
  const PREFIX = 'moallemy_';
  const DATA_VERSION = 2;

  const KEYS = {
    teacher: 'teacher',
    students: 'students',
    groups: 'groups',
    lessons: 'lessons',
    attendance: 'attendance',
    assignments: 'assignments',
    submissions: 'submissions',
    exams: 'exams',
    grades: 'grades',
    evaluations: 'evaluations',
    payments: 'payments',
    receipts: 'receipts',
    subjects: 'subjects',
    stages: 'stages',
    classes: 'classes',
    curriculum: 'curriculum',
    notifications: 'notifications',
    announcements: 'announcements',
    notes: 'notes',           // جديد: ملاحظات المدرس عن الطلاب
    goals: 'goals',           // جديد: أهداف الطلاب
    reports: 'reports',       // جديد: سجل التقارير المحفوظة
    settings: 'settings',
    meta: 'meta',
    installDismissed: 'install_dismissed'
  };

  // ===== Internal helpers =====
  function key(name) { return PREFIX + name; }

  function read(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[Storage] read error:', name, e);
      return fallback;
    }
  }

  function write(name, value) {
    try {
      localStorage.setItem(key(name), JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[Storage] write error:', name, e);
      if (e.name === 'QuotaExceededError') {
        console.warn('[Storage] Quota exceeded, trying to clean old notifications');
        const notifs = read(KEYS.notifications, []);
        if (notifs.length > 50) {
          write(KEYS.notifications, notifs.slice(0, 50));
          try {
            localStorage.setItem(key(name), JSON.stringify(value));
            return true;
          } catch (e2) { return false; }
        }
      }
      return false;
    }
  }

  function remove(name) {
    localStorage.removeItem(key(name));
  }

  // ===== ID generator =====
  function uid(prefix = '') {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}${ts}${rand}`;
  }

  // ============================================
  // Migrations - تُطبق بالترتيب من الإصدار القديم إلى الجديد
  // ============================================
  const MIGRATIONS = {
    // v1 -> v2: توحيد حالات الحضور والحصص إلى العربية + إثراء الدرجات
    2: function () {
      // 1) توحيد حالات الحضور
      const attMap = { present: 'حاضر', absent: 'غائب', late: 'متأخر', excused: 'غياب بعذر' };
      const attendance = read(KEYS.attendance, []);
      let attChanged = false;
      attendance.forEach(a => {
        if (attMap[a.status]) { a.status = attMap[a.status]; attChanged = true; }
      });
      if (attChanged) write(KEYS.attendance, attendance);

      // 2) توحيد حالات الحصص
      const lessonMap = { completed: 'تمت', scheduled: 'مجدولة', cancelled: 'ملغاة', postponed: 'مؤجلة' };
      const lessons = read(KEYS.lessons, []);
      let lChanged = false;
      lessons.forEach(l => {
        if (lessonMap[l.status]) { l.status = lessonMap[l.status]; lChanged = true; }
      });
      if (lChanged) write(KEYS.lessons, lessons);

      // 3) إثراء سجلات الدرجات بحقول type/title/date عند غيابها
      const exams = read(KEYS.exams, []);
      const grades = read(KEYS.grades, []);
      let gChanged = false;
      grades.forEach(g => {
        if (!g.type) { g.type = 'اختبار'; gChanged = true; }
        if (!g.title) {
          const exam = exams.find(e => e.id === g.examId);
          g.title = exam ? exam.name : 'درجة';
          gChanged = true;
        }
        if (!g.date) {
          const exam = exams.find(e => e.id === g.examId);
          g.date = exam ? exam.date : new Date().toISOString().slice(0, 10);
          gChanged = true;
        }
      });
      if (gChanged) write(KEYS.grades, grades);
    }
  };

  function runMigrations() {
    const meta = read(KEYS.meta, {});
    let current = meta.dataVersion || 1;
    if (current >= DATA_VERSION) return;

    for (let v = current + 1; v <= DATA_VERSION; v++) {
      try {
        if (MIGRATIONS[v]) MIGRATIONS[v]();
        meta.dataVersion = v;
        write(KEYS.meta, meta);
        console.info('[Storage] migrated data to version ' + v);
      } catch (e) {
        console.error('[Storage] migration ' + v + ' failed:', e);
        break; // لا نكمل الترحيل عند الفشل لتفادي تلف البيانات
      }
    }
  }

  // ===== Public API =====
  return {
    KEYS,
    DATA_VERSION,
    uid,
    runMigrations,

    // Generic CRUD
    get(name, fallback) { return read(name, fallback); },
    set(name, value) { return write(name, value); },
    remove(name) { remove(name); },

    // ===== Collection operations =====
    list(collection, filterFn = null) {
      const items = read(collection, []);
      if (!Array.isArray(items)) return [];
      return filterFn ? items.filter(filterFn) : items;
    },

    find(collection, id) {
      const items = read(collection, []);
      return items.find(i => i.id === id) || null;
    },

    insert(collection, item) {
      const items = read(collection, []);
      if (!Array.isArray(items)) throw new Error('[Storage] collection is not an array: ' + collection);
      const newItem = { ...item, id: item.id || uid(collection.slice(0, 3) + '_'), createdAt: item.createdAt || Date.now(), updatedAt: Date.now() };
      items.push(newItem);
      write(collection, items);
      return newItem; // يعيد العنصر بمعرفه النهائي
    },

    update(collection, id, updates) {
      const items = read(collection, []);
      const idx = items.findIndex(i => i.id === id);
      if (idx === -1) return null;
      items[idx] = { ...items[idx], ...updates, updatedAt: Date.now() };
      write(collection, items);
      return items[idx];
    },

    removeById(collection, id) {
      const items = read(collection, []);
      const filtered = items.filter(i => i.id !== id);
      write(collection, filtered);
      return filtered.length !== items.length;
    },

    // ===== Cascading delete =====
    cascadeDelete(collection, id, relations = []) {
      relations.forEach(rel => {
        const items = read(rel.collection, []);
        const filtered = items.filter(i => i[rel.field] !== id);
        write(rel.collection, filtered);
      });
      return this.removeById(collection, id);
    },

    // ===== Backup & Restore =====
    exportAll() {
      const data = {};
      Object.values(KEYS).forEach(k => {
        data[k] = read(k, null);
      });
      return {
        app: 'moallemy',
        version: String(DATA_VERSION),
        exportedAt: new Date().toISOString(),
        data
      };
    },

    importAll(json, mode = 'replace') {
      try {
        const parsed = typeof json === 'string' ? JSON.parse(json) : json;
        if (!parsed || !parsed.data) throw new Error('Invalid backup file');
        if (parsed.app && parsed.app !== 'moallemy') throw new Error('Not a Moallemy backup');

        Object.entries(parsed.data).forEach(([k, v]) => {
          if (v === null) return;
          if (mode === 'merge') {
            const existing = read(k, Array.isArray(v) ? [] : null);
            if (Array.isArray(v) && Array.isArray(existing)) {
              const merged = [...existing];
              const existingIds = new Set(existing.map(i => i && i.id).filter(Boolean));
              v.forEach(item => {
                if (item && item.id && !existingIds.has(item.id)) merged.push(item);
              });
              write(k, merged);
            } else {
              write(k, v);
            }
          } else {
            write(k, v);
          }
        });

        // ترحيل البيانات المستوردة إن كانت من إصدار أقدم
        const meta = read(KEYS.meta, {});
        if ((meta.dataVersion || 1) < DATA_VERSION) runMigrations();
        return true;
      } catch (e) {
        console.error('[Storage] import error:', e);
        return false;
      }
    },

    validateBackup(json) {
      try {
        const parsed = typeof json === 'string' ? JSON.parse(json) : json;
        if (!parsed || !parsed.data || typeof parsed.data !== 'object') {
          return { valid: false, error: 'ملف نسخة احتياطية غير صحيح' };
        }
        const counts = {};
        Object.entries(parsed.data).forEach(([k, v]) => {
          if (Array.isArray(v)) counts[k] = v.length;
        });
        return {
          valid: true,
          app: parsed.app || 'moallemy',
          version: parsed.version || '1',
          exportedAt: parsed.exportedAt || null,
          counts
        };
      } catch (e) {
        return { valid: false, error: 'تعذر قراءة الملف (JSON غير صالح)' };
      }
    },

    clearAll() {
      Object.values(KEYS).forEach(k => remove(k));
    },

    // ===== Demo data flag =====
    isDemoMode() {
      const meta = read(KEYS.meta, {});
      return meta.demoMode === true;
    },

    setDemoMode(val) {
      const meta = read(KEYS.meta, {});
      meta.demoMode = val;
      write(KEYS.meta, meta);
    },

    // ===== Audit log (خفيف - آخر 50 عملية حساسة) =====
    audit(action, details = '') {
      const meta = read(KEYS.meta, {});
      if (!Array.isArray(meta.auditLog)) meta.auditLog = [];
      meta.auditLog.unshift({ action, details, at: Date.now() });
      meta.auditLog = meta.auditLog.slice(0, 50);
      write(KEYS.meta, meta);
    },

    getAuditLog() {
      const meta = read(KEYS.meta, {});
      return meta.auditLog || [];
    },

    // ===== Meta info =====
    getMeta() { return read(KEYS.meta, {}); },
    setMeta(updates) {
      const meta = read(KEYS.meta, {});
      const newMeta = { ...meta, ...updates };
      write(KEYS.meta, newMeta);
      return newMeta;
    }
  };
})();

// ===== Data Seeds =====
const Seeds = {
  subjects: [
    'اللغة العربية', 'اللغة الإنجليزية', 'اللغة الفرنسية',
    'الرياضيات', 'العلوم', 'الدراسات الاجتماعية',
    'التاريخ', 'الجغرافيا', 'الفيزياء', 'الكيمياء',
    'الأحياء', 'الفلسفة والمنطق', 'علم النفس والاجتماع', 'الحاسب الآلي'
  ],

  stages: [
    { id: 'kg', name: 'رياض الأطفال', levels: ['KG1', 'KG2'] },
    { id: 'primary', name: 'الابتدائي', levels: ['الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع', 'الصف الخامس', 'الصف السادس'] },
    { id: 'preparatory', name: 'الإعدادي', levels: ['الأول الإعدادي', 'الثاني الإعدادي', 'الثالث الإعدادي'] },
    { id: 'secondary', name: 'الثانوي', levels: ['الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي'] }
  ],

  governorates: [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية',
    'البحيرة', 'الغربية', 'المنوفية', 'دمياط', 'كفر الشيخ', 'بورسعيد',
    'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'بني سويف',
    'الفيوم', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان',
    'الوادي الجديد', 'مطروح', 'البحر الأحمر'
  ],

  paymentMethods: ['كاش', 'تحويل بنكي', 'محفظة إلكترونية', 'فوري', 'أخرى'],

  gradeTypes: ['اختبار', 'واجب', 'تقييم مستمر', 'مشاركة', 'أخرى'],

  defaultSettings: {
    theme: 'light',
    font: 'cairo',
    absenceAlertThreshold: 3,
    paymentReminderDay: 1,
    currency: 'ج.م',
    sendReportsByWhatsapp: true,
    autoGenerateLessons: true,
    // إعدادات التقارير
    reportCenter: '',
    reportPhone: '',
    reportEmail: '',
    reportSignature: 'مع خالص التحية والتقدير',
    reportColor: '#8B5E34',
    aiEnabled: true,
    reportStyle: 'متوسط',
    // أوزان حساب الأداء (مجموعها 100)
    weights: { exams: 50, assignments: 20, attendance: 10, continuous: 20 }
  },

  ensureSeeds() {
    if (!Storage.get(Storage.KEYS.subjects)) {
      Storage.set(Storage.KEYS.subjects, Seeds.subjects.map((name, i) => ({ id: 'sub_' + i, name, isDefault: true })));
    }
    if (!Storage.get(Storage.KEYS.stages)) {
      Storage.set(Storage.KEYS.stages, Seeds.stages);
    }
    if (!Storage.get(Storage.KEYS.settings)) {
      Storage.set(Storage.KEYS.settings, { ...Seeds.defaultSettings });
    } else {
      // دمج الإعدادات الافتراضية الجديدة مع المحفوظة (بدون فقدان قيم المستخدم)
      const saved = Storage.get(Storage.KEYS.settings, {});
      const merged = { ...Seeds.defaultSettings, ...saved };
      merged.weights = { ...Seeds.defaultSettings.weights, ...(saved.weights || {}) };
      Storage.set(Storage.KEYS.settings, merged);
    }
    // إنشاء سجلات فارغة للكيانات الجديدة إن لم توجد
    ['notes', 'goals', 'reports'].forEach(k => {
      if (Storage.get(k) === null || Storage.get(k) === undefined) Storage.set(k, []);
    });
  }
};

// Expose globally
window.Storage = Storage;
window.Seeds = Seeds;
