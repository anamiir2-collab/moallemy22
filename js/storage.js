/* ============================================
   مُعلّمي | storage.js
   Local Cache + Supabase Cloud Sync
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
    notes: 'notes',
    goals: 'goals',
    reports: 'reports',
    settings: 'settings',
    meta: 'meta',
    installDismissed: 'install_dismissed'
  };

  /* ============================================
     Supabase Cloud Tables
     ============================================ */

  const CLOUD_TABLES = {
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
    notifications: 'notifications',
    announcements: 'announcements',
    notes: 'notes',
    goals: 'goals',
    reports: 'reports'
  };

  let cloudUserId = null;
  let cloudReady = false;
  let syncTimers = {};

  /* ============================================
     Local Storage Helpers
     ============================================ */

  function key(name) {
    return PREFIX + name;
  }

  function read(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));

      if (raw === null) {
        return fallback;
      }

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
        try {
          const notifications = read(KEYS.notifications, []);

          if (
            Array.isArray(notifications) &&
            notifications.length > 50
          ) {
            write(
              KEYS.notifications,
              notifications.slice(0, 50)
            );

            localStorage.setItem(
              key(name),
              JSON.stringify(value)
            );

            return true;
          }
        } catch (e2) {
          console.error(
            '[Storage] cleanup failed:',
            e2
          );
        }
      }

      return false;
    }
  }

  function remove(name) {
    localStorage.removeItem(key(name));
  }

  /* ============================================
     ID Generator
     ============================================ */

  function uid(prefix = '') {
    const ts = Date.now().toString(36);
    const rand = Math.random()
      .toString(36)
      .slice(2, 8);

    return `${prefix}${ts}${rand}`;
  }

  /* ============================================
     Migrations
     ============================================ */

  const MIGRATIONS = {

    2: function () {

      // توحيد حالات الحضور
      const attMap = {
        present: 'حاضر',
        absent: 'غائب',
        late: 'متأخر',
        excused: 'غياب بعذر'
      };

      const attendance = read(
        KEYS.attendance,
        []
      );

      let attChanged = false;

      if (Array.isArray(attendance)) {
        attendance.forEach(a => {
          if (a && attMap[a.status]) {
            a.status = attMap[a.status];
            attChanged = true;
          }
        });
      }

      if (attChanged) {
        write(
          KEYS.attendance,
          attendance
        );
      }

      // توحيد حالات الحصص
      const lessonMap = {
        completed: 'تمت',
        scheduled: 'مجدولة',
        cancelled: 'ملغاة',
        postponed: 'مؤجلة'
      };

      const lessons = read(
        KEYS.lessons,
        []
      );

      let lessonChanged = false;

      if (Array.isArray(lessons)) {
        lessons.forEach(l => {
          if (l && lessonMap[l.status]) {
            l.status = lessonMap[l.status];
            lessonChanged = true;
          }
        });
      }

      if (lessonChanged) {
        write(
          KEYS.lessons,
          lessons
        );
      }

      // إثراء الدرجات
      const exams = read(
        KEYS.exams,
        []
      );

      const grades = read(
        KEYS.grades,
        []
      );

      let gradesChanged = false;

      if (Array.isArray(grades)) {
        grades.forEach(g => {

          if (!g.type) {
            g.type = 'اختبار';
            gradesChanged = true;
          }

          if (!g.title) {
            const exam = Array.isArray(exams)
              ? exams.find(e => e.id === g.examId)
              : null;

            g.title = exam
              ? exam.name
              : 'درجة';

            gradesChanged = true;
          }

          if (!g.date) {
            const exam = Array.isArray(exams)
              ? exams.find(e => e.id === g.examId)
              : null;

            g.date = exam
              ? exam.date
              : new Date()
                  .toISOString()
                  .slice(0, 10);

            gradesChanged = true;
          }

        });
      }

      if (gradesChanged) {
        write(
          KEYS.grades,
          grades
        );
      }
    }
  };

  function runMigrations() {

    const meta = read(
      KEYS.meta,
      {}
    );

    let current =
      meta.dataVersion || 1;

    if (current >= DATA_VERSION) {
      return;
    }

    for (
      let v = current + 1;
      v <= DATA_VERSION;
      v++
    ) {

      try {

        if (MIGRATIONS[v]) {
          MIGRATIONS[v]();
        }

        meta.dataVersion = v;

        write(
          KEYS.meta,
          meta
        );

        console.info(
          '[Storage] migrated data to version ' + v
        );

      } catch (e) {

        console.error(
          '[Storage] migration ' + v + ' failed:',
          e
        );

        break;
      }
    }
  }

  /* ============================================
     Supabase Helpers
     ============================================ */

  function getSupabase() {
    if (
      !window.supabaseClient ||
      !cloudUserId
    ) {
      return null;
    }

    return window.supabaseClient;
  }

  function scheduleSync(collection) {

    if (
      !cloudReady ||
      !cloudUserId
    ) {
      return;
    }

    clearTimeout(
      syncTimers[collection]
    );

    syncTimers[collection] =
      setTimeout(() => {

        syncCollection(collection);

      }, 500);
  }

  /* ============================================
     Sync Collection To Supabase
     ============================================ */

  async function syncCollection(collection) {

    const supabase = getSupabase();
    const table = CLOUD_TABLES[collection];

    if (
      !supabase ||
      !table ||
      !cloudUserId
    ) {
      return;
    }

    try {

      const items = read(
        collection,
        []
      );

      const safeItems =
        Array.isArray(items)
          ? items
          : [];

      // حذف النسخة الحالية الخاصة بالمدرس
      const { error: deleteError } =
        await supabase
          .from(table)
          .delete()
          .eq(
            'teacher_id',
            cloudUserId
          );

      if (deleteError) {
        console.error(
          '[Cloud] delete error:',
          collection,
          deleteError
        );
        return;
      }

      if (!safeItems.length) {
        return;
      }

      const rows =
        safeItems.map(item => ({
          id: String(
            item.id || uid(
              collection.slice(0, 3) + '_'
            )
          ),

          teacher_id:
            cloudUserId,

          data: item
        }));

      const {
        error: insertError
      } = await supabase
        .from(table)
        .insert(rows);

      if (insertError) {

        console.error(
          '[Cloud] insert error:',
          collection,
          insertError
        );

        return;
      }

      console.info(
        '[Cloud] synced:',
        collection,
        safeItems.length
      );

    } catch (error) {

      console.error(
        '[Cloud] sync exception:',
        collection,
        error
      );
    }
  }

  /* ============================================
     Sync Settings
     ============================================ */

  async function syncSettings() {

    const supabase = getSupabase();

    if (!supabase) {
      return;
    }

    try {

      const settings =
        read(
          KEYS.settings,
          {}
        );

      const {
        error
      } = await supabase
        .from('settings')
        .upsert(
          {
            id: 'settings',
            teacher_id:
              cloudUserId,
            data: settings
          },
          {
            onConflict: 'id'
          }
        );

      if (error) {
        console.error(
          '[Cloud] settings error:',
          error
        );
      }

    } catch (error) {

      console.error(
        '[Cloud] settings exception:',
        error
      );
    }
  }

  /* ============================================
     Sync Teacher Profile
     ============================================ */

  async function syncTeacher() {

    const supabase = getSupabase();

    if (!supabase) {
      return;
    }

    try {

      const teacher =
        read(
          KEYS.teacher,
          null
        );

      if (!teacher) {
        return;
      }

      const profile = {
        id: cloudUserId,
        name: teacher.name || '',
        phone: teacher.phone || '',
        email: teacher.email || null,
        subject: teacher.subject || '',
        stage: teacher.stage || '',
        governorate:
          teacher.governorate || '',
        logo: teacher.logo || '',
        bio: teacher.bio || ''
      };

      const {
        error
      } = await supabase
        .from('teacher_profiles')
        .upsert(
          profile,
          {
            onConflict: 'id'
          }
        );

      if (error) {

        console.error(
          '[Cloud] teacher profile error:',
          error
        );

        return;
      }

      console.info(
        '[Cloud] teacher profile synced'
      );

    } catch (error) {

      console.error(
        '[Cloud] teacher sync exception:',
        error
      );
    }
  }

  /* ============================================
     Load Teacher From Supabase
     ============================================ */

  async function loadTeacher() {

    const supabase = getSupabase();

    if (!supabase) {
      return false;
    }

    try {

      const {
        data,
        error
      } = await supabase
        .from('teacher_profiles')
        .select('*')
        .eq('id', cloudUserId)
        .maybeSingle();

      if (error) {

        console.error(
          '[Cloud] load teacher error:',
          error
        );

        return false;
      }

      if (!data) {
        return false;
      }

      const teacher = {
        id: data.id,
        name: data.name || '',
        phone: data.phone || '',
        email: data.email || '',
        subject: data.subject || '',
        stage: data.stage || '',
        governorate:
          data.governorate || '',
        logo: data.logo || '',
        bio: data.bio || '',
        createdAt:
          data.created_at
            ? new Date(
                data.created_at
              ).getTime()
            : Date.now(),
        updatedAt:
          data.updated_at
            ? new Date(
                data.updated_at
              ).getTime()
            : Date.now()
      };

      write(
        KEYS.teacher,
        teacher
      );

      return true;

    } catch (error) {

      console.error(
        '[Cloud] load teacher exception:',
        error
      );

      return false;
    }
  }

  /* ============================================
     Load Collection From Supabase
     ============================================ */

  async function loadCollection(
    collection
  ) {

    const supabase = getSupabase();
    const table =
      CLOUD_TABLES[collection];

    if (
      !supabase ||
      !table
    ) {
      return {
        success: false,
        hasRemoteData: false
      };
    }

    try {

      const {
        data,
        error
      } = await supabase
        .from(table)
        .select(
          'id,data,created_at,updated_at'
        )
        .eq(
          'teacher_id',
          cloudUserId
        );

      if (error) {

        console.error(
          '[Cloud] load error:',
          collection,
          error
        );

        return {
          success: false,
          hasRemoteData: false
        };
      }

      const rows =
        Array.isArray(data)
          ? data
          : [];

      /*
       * لو فيه بيانات أونلاين:
       * نخلي السحابة هي المصدر الأساسي.
       *
       * لو مفيش بيانات أونلاين:
       * نسيب البيانات المحلية كما هي
       * علشان نقدر نرحّل بيانات المدرس القديمة.
       */

      if (rows.length > 0) {

        const items =
          rows.map(row => ({
            ...(row.data || {}),
            id: row.id,
            createdAt:
              row.data &&
              row.data.createdAt
                ? row.data.createdAt
                : (
                    row.created_at
                      ? new Date(
                          row.created_at
                        ).getTime()
                      : Date.now()
                  ),
            updatedAt:
              row.data &&
              row.data.updatedAt
                ? row.data.updatedAt
                : (
                    row.updated_at
                      ? new Date(
                          row.updated_at
                        ).getTime()
                      : Date.now()
                  )
          }));

        write(
          collection,
          items
        );

      }

      return {
        success: true,
        hasRemoteData:
          rows.length > 0
      };

    } catch (error) {

      console.error(
        '[Cloud] collection exception:',
        collection,
        error
      );

      return {
        success: false,
        hasRemoteData: false
      };
    }
  }

  /* ============================================
     Load Settings
     ============================================ */

  async function loadSettings() {

    const supabase = getSupabase();

    if (!supabase) {
      return false;
    }

    try {

      const {
        data,
        error
      } = await supabase
        .from('settings')
        .select('id,data')
        .eq(
          'teacher_id',
          cloudUserId
        )
        .eq(
          'id',
          'settings'
        )
        .maybeSingle();

      if (error) {

        console.error(
          '[Cloud] load settings error:',
          error
        );

        return false;
      }

      if (data && data.data) {

        write(
          KEYS.settings,
          data.data
        );

        return true;
      }

      return false;

    } catch (error) {

      console.error(
        '[Cloud] settings exception:',
        error
      );

      return false;
    }
  }

  /* ============================================
     Initialize Cloud
     ============================================ */

  async function initCloud(userId) {

    if (!userId) {
      return false;
    }

    cloudUserId = userId;
    cloudReady = false;

    console.info(
      '[Cloud] initializing for user:',
      userId
    );

    try {

      await loadTeacher();

      await loadSettings();

      for (
        const collection
        of Object.keys(CLOUD_TABLES)
      ) {

        await loadCollection(
          collection
        );
      }

      cloudReady = true;

      /*
       * مزامنة البيانات المحلية القديمة
       * لو الحساب السحابي جديد ومفيش بيانات عليه.
       */

      await migrateLocalDataToCloud();

      console.info(
        '[Cloud] initialization complete'
      );

      return true;

    } catch (error) {

      console.error(
        '[Cloud] initialization failed:',
        error
      );

      cloudReady = false;

      return false;
    }
  }

  /* ============================================
     Migrate Existing Local Data
     ============================================ */

  async function migrateLocalDataToCloud() {

    if (
      !cloudReady ||
      !cloudUserId
    ) {
      return;
    }

    try {

      for (
        const collection
        of Object.keys(CLOUD_TABLES)
      ) {

        const result =
          await loadCollection(
            collection
          );

        /*
         * لو مفيش بيانات على Supabase
         * لكن فيه بيانات محلية،
         * نرفع البيانات المحلية.
         */

        if (
          result.success &&
          !result.hasRemoteData
        ) {

          const localItems =
            read(
              collection,
              []
            );

          if (
            Array.isArray(localItems) &&
            localItems.length > 0
          ) {

            await syncCollection(
              collection
            );
          }
        }
      }

      const remoteSettings =
        await loadSettings();

      if (!remoteSettings) {
        await syncSettings();
      }

      const remoteTeacher =
        await loadTeacher();

      if (!remoteTeacher) {
        await syncTeacher();
      }

    } catch (error) {

      console.error(
        '[Cloud] migration error:',
        error
      );
    }
  }

  /* ============================================
     Sync Everything
     ============================================ */

  async function syncAll() {

    if (
      !cloudReady ||
      !cloudUserId
    ) {
      return false;
    }

    try {

      await syncTeacher();
      await syncSettings();

      for (
        const collection
        of Object.keys(CLOUD_TABLES)
      ) {
        await syncCollection(
          collection
        );
      }

      return true;

    } catch (error) {

      console.error(
        '[Cloud] sync all error:',
        error
      );

      return false;
    }
  }

  /* ============================================
     Clear Current User Cache
     ============================================ */

  function clearUserCache() {

    const cloudKeys = [
      KEYS.teacher,
      KEYS.students,
      KEYS.groups,
      KEYS.lessons,
      KEYS.attendance,
      KEYS.assignments,
      KEYS.submissions,
      KEYS.exams,
      KEYS.grades,
      KEYS.evaluations,
      KEYS.payments,
      KEYS.receipts,
      KEYS.notifications,
      KEYS.announcements,
      KEYS.notes,
      KEYS.goals,
      KEYS.reports,
      KEYS.settings
    ];

    cloudKeys.forEach(
      k => remove(k)
    );

    cloudUserId = null;
    cloudReady = false;
  }

  /* ============================================
     Public API
     ============================================ */

  return {

    KEYS,
    DATA_VERSION,
    uid,
    runMigrations,

    /* Cloud */

    initCloud,
    syncAll,
    clearUserCache,

    isCloudReady() {
      return cloudReady;
    },

    getCloudUserId() {
      return cloudUserId;
    },

    /* Generic CRUD */

    get(name, fallback) {
      return read(
        name,
        fallback
      );
    },

    set(name, value) {

      const result =
        write(name, value);

      if (!result) {
        return false;
      }

      // مزامنة المدرس
      if (
        name === KEYS.teacher
      ) {
        if (cloudReady) {
          syncTeacher();
        }

        return true;
      }

      // مزامنة الإعدادات
      if (
        name === KEYS.settings
      ) {
        if (cloudReady) {
          clearTimeout(
            syncTimers.settings
          );

          syncTimers.settings =
            setTimeout(
              syncSettings,
              500
            );
        }

        return true;
      }

      // الجداول السحابية
      if (
        CLOUD_TABLES[name]
      ) {
        scheduleSync(name);
      }

      return true;
    },

    remove(name) {

      remove(name);

      if (
        CLOUD_TABLES[name] &&
        cloudReady
      ) {
        scheduleSync(name);
      }
    },

    /* Collections */

    list(
      collection,
      filterFn = null
    ) {

      const items =
        read(
          collection,
          []
        );

      if (
        !Array.isArray(items)
      ) {
        return [];
      }

      return filterFn
        ? items.filter(filterFn)
        : items;
    },

    find(
      collection,
      id
    ) {

      const items =
        read(
          collection,
          []
        );

      if (
        !Array.isArray(items)
      ) {
        return null;
      }

      return (
        items.find(
          i => i.id === id
        ) || null
      );
    },

    insert(
      collection,
      item
    ) {

      const items =
        read(
          collection,
          []
        );

      if (
        !Array.isArray(items)
      ) {
        throw new Error(
          '[Storage] collection is not an array: ' +
          collection
        );
      }

      const newItem = {
        ...item,

        id:
          item.id ||
          uid(
            collection.slice(0, 3) +
            '_'
          ),

        createdAt:
          item.createdAt ||
          Date.now(),

        updatedAt:
          Date.now()
      };

      items.push(newItem);

      write(
        collection,
        items
      );

      if (
        CLOUD_TABLES[collection]
      ) {
        scheduleSync(
          collection
        );
      }

      return newItem;
    },

    update(
      collection,
      id,
      updates
    ) {

      const items =
        read(
          collection,
          []
        );

      if (
        !Array.isArray(items)
      ) {
        return null;
      }

      const idx =
        items.findIndex(
          i => i.id === id
        );

      if (idx === -1) {
        return null;
      }

      items[idx] = {
        ...items[idx],
        ...updates,
        updatedAt:
          Date.now()
      };

      write(
        collection,
        items
      );

      if (
        CLOUD_TABLES[collection]
      ) {
        scheduleSync(
          collection
        );
      }

      return items[idx];
    },

    removeById(
      collection,
      id
    ) {

      const items =
        read(
          collection,
          []
        );

      if (
        !Array.isArray(items)
      ) {
        return false;
      }

      const filtered =
        items.filter(
          i => i.id !== id
        );

      const changed =
        filtered.length !==
        items.length;

      write(
        collection,
        filtered
      );

      if (
        changed &&
        CLOUD_TABLES[collection]
      ) {
        scheduleSync(
          collection
        );
      }

      return changed;
    },

    /* Cascading Delete */

    cascadeDelete(
      collection,
      id,
      relations = []
    ) {

      relations.forEach(
        rel => {

          const items =
            read(
              rel.collection,
              []
            );

          if (
            !Array.isArray(items)
          ) {
            return;
          }

          const filtered =
            items.filter(
              i =>
                i[rel.field] !== id
            );

          write(
            rel.collection,
            filtered
          );

          if (
            CLOUD_TABLES[
              rel.collection
            ]
          ) {
            scheduleSync(
              rel.collection
            );
          }
        }
      );

      return this.removeById(
        collection,
        id
      );
    },

    /* Backup */

    exportAll() {

      const data = {};

      Object.values(KEYS)
        .forEach(k => {
          data[k] =
            read(k, null);
        });

      return {
        app: 'moallemy',
        version:
          String(DATA_VERSION),
        exportedAt:
          new Date().toISOString(),
        data
      };
    },

    importAll(
      json,
      mode = 'replace'
    ) {

      try {

        const parsed =
          typeof json === 'string'
            ? JSON.parse(json)
            : json;

        if (
          !parsed ||
          !parsed.data
        ) {
          throw new Error(
            'Invalid backup file'
          );
        }

        if (
          parsed.app &&
          parsed.app !== 'moallemy'
        ) {
          throw new Error(
            'Not a Moallemy backup'
          );
        }

        Object.entries(
          parsed.data
        ).forEach(
          ([k, v]) => {

            if (v === null) {
              return;
            }

            if (
              mode === 'merge'
            ) {

              const existing =
                read(
                  k,
                  Array.isArray(v)
                    ? []
                    : null
                );

              if (
                Array.isArray(v) &&
                Array.isArray(existing)
              ) {

                const merged =
                  [...existing];

                const existingIds =
                  new Set(
                    existing
                      .map(
                        i =>
                          i &&
                          i.id
                      )
                      .filter(Boolean)
                  );

                v.forEach(
                  item => {

                    if (
                      item &&
                      item.id &&
                      !existingIds.has(
                        item.id
                      )
                    ) {
                      merged.push(item);
                    }

                  }
                );

                write(
                  k,
                  merged
                );

              } else {

                write(k, v);
              }

            } else {

              write(k, v);
            }

            if (
              CLOUD_TABLES[k]
            ) {
              scheduleSync(k);
            }

          }
        );

        const meta =
          read(
            KEYS.meta,
            {}
          );

        if (
          (meta.dataVersion || 1) <
          DATA_VERSION
        ) {
          runMigrations();
        }

        if (cloudReady) {
          syncAll();
        }

        return true;

      } catch (e) {

        console.error(
          '[Storage] import error:',
          e
        );

        return false;
      }
    },

    validateBackup(json) {

      try {

        const parsed =
          typeof json === 'string'
            ? JSON.parse(json)
            : json;

        if (
          !parsed ||
          !parsed.data ||
          typeof parsed.data !== 'object'
        ) {

          return {
            valid: false,
            error:
              'ملف نسخة احتياطية غير صحيح'
          };
        }

        const counts = {};

        Object.entries(
          parsed.data
        ).forEach(
          ([k, v]) => {

            if (
              Array.isArray(v)
            ) {
              counts[k] =
                v.length;
            }

          }
        );

        return {
          valid: true,
          app:
            parsed.app ||
            'moallemy',
          version:
            parsed.version ||
            '1',
          exportedAt:
            parsed.exportedAt ||
            null,
          counts
        };

      } catch (e) {

        return {
          valid: false,
          error:
            'تعذر قراءة الملف (JSON غير صالح)'
        };
      }
    },

    clearAll() {

      Object.values(KEYS)
        .forEach(
          k => remove(k)
        );

      cloudUserId = null;
      cloudReady = false;
    },

    /* Demo Mode */

    isDemoMode() {

      const meta =
        read(
          KEYS.meta,
          {}
        );

      return (
        meta.demoMode === true
      );
    },

    setDemoMode(val) {

      const meta =
        read(
          KEYS.meta,
          {}
        );

      meta.demoMode = val;

      write(
        KEYS.meta,
        meta
      );
    },

    /* Audit Log */

    audit(
      action,
      details = ''
    ) {

      const meta =
        read(
          KEYS.meta,
          {}
        );

      if (
        !Array.isArray(
          meta.auditLog
        )
      ) {
        meta.auditLog = [];
      }

      meta.auditLog.unshift({
        action,
        details,
        at: Date.now()
      });

      meta.auditLog =
        meta.auditLog.slice(
          0,
          50
        );

      write(
        KEYS.meta,
        meta
      );
    },

    getAuditLog() {

      const meta =
        read(
          KEYS.meta,
          {}
        );

      return (
        meta.auditLog || []
      );
    },

    /* Meta */

    getMeta() {

      return read(
        KEYS.meta,
        {}
      );
    },

    setMeta(updates) {

      const meta =
        read(
          KEYS.meta,
          {}
        );

      const newMeta = {
        ...meta,
        ...updates
      };

      write(
        KEYS.meta,
        newMeta
      );

      return newMeta;
    }
  };
})();


/* ============================================
   Data Seeds
   ============================================ */

const Seeds = {

  subjects: [
    'اللغة العربية',
    'اللغة الإنجليزية',
    'اللغة الفرنسية',
    'الرياضيات',
    'العلوم',
    'الدراسات الاجتماعية',
    'التاريخ',
    'الجغرافيا',
    'الفيزياء',
    'الكيمياء',
    'الأحياء',
    'الفلسفة والمنطق',
    'علم النفس والاجتماع',
    'الحاسب الآلي'
  ],

  stages: [
    {
      id: 'kg',
      name: 'رياض الأطفال',
      levels: [
        'KG1',
        'KG2'
      ]
    },

    {
      id: 'primary',
      name: 'الابتدائي',
      levels: [
        'الصف الأول',
        'الصف الثاني',
        'الصف الثالث',
        'الصف الرابع',
        'الصف الخامس',
        'الصف السادس'
      ]
    },

    {
      id: 'preparatory',
      name: 'الإعدادي',
      levels: [
        'الأول الإعدادي',
        'الثاني الإعدادي',
        'الثالث الإعدادي'
      ]
    },

    {
      id: 'secondary',
      name: 'الثانوي',
      levels: [
        'الأول الثانوي',
        'الثاني الثانوي',
        'الثالث الثانوي'
      ]
    }
  ],

  governorates: [
    'القاهرة',
    'الجيزة',
    'الإسكندرية',
    'القليوبية',
    'الشرقية',
    'الدقهلية',
    'البحيرة',
    'الغربية',
    'المنوفية',
    'دمياط',
    'كفر الشيخ',
    'بورسعيد',
    'الإسماعيلية',
    'السويس',
    'شمال سيناء',
    'جنوب سيناء',
    'بني سويف',
    'الفيوم',
    'المنيا',
    'أسيوط',
    'سوهاج',
    'قنا',
    'الأقصر',
    'أسوان',
    'الوادي الجديد',
    'مطروح',
    'البحر الأحمر'
  ],

  paymentMethods: [
    'كاش',
    'تحويل بنكي',
    'محفظة إلكترونية',
    'فوري',
    'أخرى'
  ],

  gradeTypes: [
    'اختبار',
    'واجب',
    'تقييم مستمر',
    'مشاركة',
    'أخرى'
  ],

  defaultSettings: {

    theme: 'light',

    font: 'cairo',

    absenceAlertThreshold: 3,

    paymentReminderDay: 1,

    currency: 'ج.م',

    sendReportsByWhatsapp: true,

    autoGenerateLessons: true,

    reportCenter: '',

    reportPhone: '',

    reportEmail: '',

    reportSignature:
      'مع خالص التحية والتقدير',

    reportColor:
      '#8B5E34',

    aiEnabled: true,

    reportStyle: 'متوسط',

    weights: {
      exams: 50,
      assignments: 20,
      attendance: 10,
      continuous: 20
    }
  },

  ensureSeeds() {

    if (
      !Storage.get(
        Storage.KEYS.subjects
      )
    ) {

      Storage.set(
        Storage.KEYS.subjects,

        Seeds.subjects.map(
          (name, i) => ({
            id: 'sub_' + i,
            name,
            isDefault: true
          })
        )
      );
    }

    if (
      !Storage.get(
        Storage.KEYS.stages
      )
    ) {

      Storage.set(
        Storage.KEYS.stages,
        Seeds.stages
      );
    }

    if (
      !Storage.get(
        Storage.KEYS.settings
      )
    ) {

      Storage.set(
        Storage.KEYS.settings,
        {
          ...Seeds.defaultSettings
        }
      );

    } else {

      const saved =
        Storage.get(
          Storage.KEYS.settings,
          {}
        );

      const merged = {
        ...Seeds.defaultSettings,
        ...saved
      };

      merged.weights = {
        ...Seeds.defaultSettings.weights,
        ...(saved.weights || {})
      };

      Storage.set(
        Storage.KEYS.settings,
        merged
      );
    }

    [
      'notes',
      'goals',
      'reports'
    ].forEach(k => {

      if (
        Storage.get(k) === null ||
        Storage.get(k) === undefined
      ) {

        Storage.set(
          k,
          []
        );
      }

    });
  }
};


/* ============================================
   Expose Globally
   ============================================ */

window.Storage = Storage;
window.Seeds = Seeds;