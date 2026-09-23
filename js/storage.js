/* ============================================
   مُعلّمي | storage.js
   طبقة التخزين - قابلة للاستبدال بقاعدة بيانات سحابية
   تعتمد حالياً على LocalStorage مع واجهة Promise-based
   ============================================ */

const Storage = (function () {
  const PREFIX = 'moallemy_';
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
      // إبلاغ طبقة المزامنة السحابية بأي تغيير محلي (طابور أوفلاين)
      if (window.Cloud && typeof Cloud.markDirty === 'function') {
        try { Cloud.markDirty(name); } catch (e) { /* لا تعطل التخزين المحلي */ }
      }
      return true;
    } catch (e) {
      console.error('[Storage] write error:', name, e);
      if (e.name === 'QuotaExceededError') {
        // Try to free some space
        console.warn('[Storage] Quota exceeded, trying to clean old notifications');
        const notifs = read(KEYS.notifications, []);
        if (notifs.length > 50) {
          write(KEYS.notifications, notifs.slice(0, 50));
          localStorage.setItem(key(name), JSON.stringify(value));
          return true;
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

  // ===== Public API =====
  return {
    KEYS,
    uid,

    // Generic CRUD
    get(name, fallback) { return read(name, fallback); },
    set(name, value) { return write(name, value); },
    remove(name) { remove(name); if (window.Cloud) Cloud.markDirty(name); },

    // ===== Collection operations =====
    list(collection, filterFn = null) {
      const items = read(collection, []);
      return filterFn ? items.filter(filterFn) : items;
    },

    find(collection, id) {
      const items = read(collection, []);
      return items.find(i => i.id === id) || null;
    },

    insert(collection, item) {
      const items = read(collection, []);
      const newItem = { ...item, id: item.id || uid(collection.slice(0, 3) + '_'), createdAt: Date.now(), updatedAt: Date.now() };
      items.push(newItem);
      write(collection, items);
      return newItem;
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
      // relations: [{collection, field}] - delete records where field === id
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
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        data
      };
    },

    importAll(json, mode = 'replace') {
      try {
        const parsed = typeof json === 'string' ? JSON.parse(json) : json;
        if (!parsed.data) throw new Error('Invalid backup file');
        Object.entries(parsed.data).forEach(([k, v]) => {
          if (v === null) return;
          if (mode === 'merge') {
            const existing = read(k, Array.isArray(v) ? [] : null);
            if (Array.isArray(v) && Array.isArray(existing)) {
              const merged = [...existing];
              const existingIds = new Set(existing.map(i => i.id));
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
        return true;
      } catch (e) {
        console.error('[Storage] import error:', e);
        return false;
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

  ensureSeeds() {
    if (!Storage.get(Storage.KEYS.subjects)) {
      Storage.set(Storage.KEYS.subjects, Seeds.subjects.map((name, i) => ({ id: 'sub_' + i, name, isDefault: true })));
    }
    if (!Storage.get(Storage.KEYS.stages)) {
      Storage.set(Storage.KEYS.stages, Seeds.stages);
    }
    if (!Storage.get(Storage.KEYS.settings)) {
      Storage.set(Storage.KEYS.settings, {
        theme: 'light',
        font: 'cairo',
        absenceAlertThreshold: 3,
        paymentReminderDay: 1,
        currency: 'ج.م',
        sendReportsByWhatsapp: true,
        autoGenerateLessons: true
      });
    }
  }
};

// Expose globally
window.Storage = Storage;
window.Seeds = Seeds;
