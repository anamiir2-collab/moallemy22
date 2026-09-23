/* ============================================
   مُعلّمي | storage.js
   Local Cache + Supabase Cloud Sync
   Multi-Teacher Safe
   ============================================ */

const Storage = (function () {
  'use strict';

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

  function read(name, fallback = null) {
    try {
      const raw = localStorage.getItem(key(name));

      if (raw === null) {
        return fallback;
      }

      return JSON.parse(raw);

    } catch (error) {

      console.error(
        '[Storage] read error:',
        name,
        error
      );

      return fallback;
    }
  }

  function write(name, value) {
    try {

      localStorage.setItem(
        key(name),
        JSON.stringify(value)
      );

      return true;

    } catch (error) {

      console.error(
        '[Storage] write error:',
        name,
        error
      );

      if (
        error.name === 'QuotaExceededError'
      ) {

        try {

          const notifications =
            read(
              KEYS.notifications,
              []
            );

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

        } catch (cleanupError) {

          console.error(
            '[Storage] cleanup failed:',
            cleanupError
          );
        }
      }

      return false;
    }
  }

  function remove(name) {
    try {
      localStorage.removeItem(key(name));
    } catch (error) {
      console.error(
        '[Storage] remove error:',
        name,
        error
      );
    }
  }

  /* ============================================
     ID Generator
     ============================================ */

  function uid(prefix = '') {

    const ts =
      Date.now().toString(36);

    const rand =
      Math.random()
        .toString(36)
        .slice(2, 10);

    return `${prefix}${ts}${rand}`;
  }

  /* ============================================
     Cloud ID
     ============================================ */

  function getSettingsCloudId() {

    if (!cloudUserId) {
      return null;
    }

    return `settings_${cloudUserId}`;
  }

  /* ============================================
     Migrations
     ============================================ */

  const MIGRATIONS = {

    2: function () {

      /* ---------- Attendance ---------- */

      const attMap = {
        present: 'حاضر',
        absent: 'غائب',
        late: 'متأخر',
        excused: 'غياب بعذر'
      };

      const attendance =
        read(
          KEYS.attendance,
          []
        );

      let attChanged = false;

      if (Array.isArray(attendance)) {

        attendance.forEach(item => {

          if (
            item &&
            attMap[item.status]
          ) {

            item.status =
              attMap[item.status];

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

      /* ---------- Lessons ---------- */

      const lessonMap = {
        completed: 'تمت',
        scheduled: 'مجدولة',
        cancelled: 'ملغاة',
        postponed: 'مؤجلة'
      };

      const lessons =
        read(
          KEYS.lessons,
          []
        );

      let lessonChanged = false;

      if (Array.isArray(lessons)) {

        lessons.forEach(item => {

          if (
            item &&
            lessonMap[item.status]
          ) {

            item.status =
              lessonMap[item.status];

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

      /* ---------- Grades ---------- */

      const exams =
        read(
          KEYS.exams,
          []
        );

      const grades =
        read(
          KEYS.grades,
          []
        );

      let gradesChanged = false;

      if (Array.isArray(grades)) {

        grades.forEach(grade => {

          if (!grade.type) {

            grade.type =
              'اختبار';

            gradesChanged = true;
          }

          if (!grade.title) {

            const exam =
              Array.isArray(exams)
                ? exams.find(
                    e =>
                      e.id ===
                      grade.examId
                  )
                : null;

            grade.title =
              exam
                ? exam.name
                : 'درجة';

            gradesChanged = true;
          }

          if (!grade.date) {

            const exam =
              Array.isArray(exams)
                ? exams.find(
                    e =>
                      e.id ===
                      grade.examId
                  )
                : null;

            grade.date =
              exam
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

    const meta =
      read(
        KEYS.meta,
        {}
      );

    let current =
      meta.dataVersion || 1;

    if (
      current >= DATA_VERSION
    ) {
      return;
    }

    for (
      let version = current + 1;
      version <= DATA_VERSION;
      version++
    ) {

      try {

        if (
          MIGRATIONS[version]
        ) {

          MIGRATIONS[version]();
        }

        meta.dataVersion =
          version;

        write(
          KEYS.meta,
          meta
        );

        console.info(
          '[Storage] migrated data to version ' +
          version
        );

      } catch (error) {

        console.error(
          '[Storage] migration failed:',
          version,
          error
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
      setTimeout(
        () => {

          syncCollection(
            collection
          );

        },
        700
      );
  }

  /* ============================================
     Sync Collection
     ============================================ */

  async function syncCollection(
    collection
  ) {

    const supabase =
      getSupabase();

    const table =
      CLOUD_TABLES[collection];

    if (
      !supabase ||
      !table ||
      !cloudUserId
    ) {

      return false;
    }

    try {

      const items =
        read(
          collection,
          []
        );

      const safeItems =
        Array.isArray(items)
          ? items
          : [];

      /*
       * نحذف فقط بيانات المعلم الحالي.
       * بسبب RLS لن يستطيع المعلم الوصول
       * لبيانات أي معلم آخر.
       */

      const {
        error: deleteError
      } =
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

        return false;
      }

      if (!safeItems.length) {
        return true;
      }

      const rows =
        safeItems.map(item => {

          const id =
            String(
              item.id ||
              uid(
                collection.slice(0, 3) +
                '_'
              )
            );

          return {
            id,
            teacher_id:
              cloudUserId,
            data: {
              ...item,
              id
            }
          };
        });

      const {
        error: insertError
      } =
        await supabase
          .from(table)
          .insert(rows);

      if (insertError) {

        console.error(
          '[Cloud] insert error:',
          collection,
          insertError
        );

        return false;
      }

      console.info(
        '[Cloud] synced:',
        collection,
        safeItems.length
      );

      return true;

    } catch (error) {

      console.error(
        '[Cloud] sync exception:',
        collection,
        error
      );

      return false;
    }
  }

  /* ============================================
     Sync Settings
     ============================================ */

  async function syncSettings() {

    const supabase =
      getSupabase();

    if (
      !supabase ||
      !cloudUserId
    ) {

      return false;
    }

    try {

      const settings =
        read(
          KEYS.settings,
          {}
        );

      const settingsId =
        getSettingsCloudId();

      const {
        error
      } =
        await supabase
          .from('settings')
          .upsert(
            {
              id: settingsId,
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

        return false;
      }

      return true;

    } catch (error) {

      console.error(
        '[Cloud] settings exception:',
        error
      );

      return false;
    }
  }

  /* ============================================
     Sync Teacher Profile
     ============================================ */

  async function syncTeacher() {

    const supabase =
      getSupabase();

    if (
      !supabase ||
      !cloudUserId
    ) {

      return false;
    }

    try {

      const teacher =
        read(
          KEYS.teacher,
          null
        );

      if (!teacher) {
        return false;
      }

      const profile = {

        id:
          cloudUserId,

        name:
          teacher.name || '',

        phone:
          teacher.phone || '',

        email:
          teacher.email || null,

        subject:
          teacher.subject || '',

        stage:
          teacher.stage || '',

        governorate:
          teacher.governorate || '',

        logo:
          teacher.logo || '',

        bio:
          teacher.bio || ''
      };

      const {
        error
      } =
        await supabase
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

        return false;
      }

      return true;

    } catch (error) {

      console.error(
        '[Cloud] teacher sync exception:',
        error
      );

      return false;
    }
  }

  /* ============================================
     Load Teacher
     ============================================ */

  async function loadTeacher() {

    const supabase =
      getSupabase();

    if (
      !supabase ||
      !cloudUserId
    ) {

      return false;
    }

    try {

      const {
        data,
        error
      } =
        await supabase
          .from('teacher_profiles')
          .select('*')
          .eq(
            'id',
            cloudUserId
          )
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

        id:
          data.id,

        name:
          data.name || '',

        phone:
          data.phone || '',

        email:
          data.email || '',

        subject:
          data.subject || '',

        stage:
          data.stage || '',

        governorate:
          data.governorate || '',

        logo:
          data.logo || '',

        bio:
          data.bio || '',

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
     Load Collection
     ============================================ */

  async function loadCollection(
    collection
  ) {

    const supabase =
      getSupabase();

    const table =
      CLOUD_TABLES[collection];

    if (
      !supabase ||
      !table ||
      !cloudUserId
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
      } =
        await supabase
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
       * السحابة هي المصدر الأساسي
       * إذا كان لديها بيانات.
       */

      if (rows.length > 0) {

        const items =
          rows.map(row => {

            const original =
              row.data &&
              typeof row.data === 'object'
                ? row.data
                : {};

            return {
              ...original,

              id:
                row.id,

              createdAt:
                original.createdAt ||
                (
                  row.created_at
                    ? new Date(
                        row.created_at
                      ).getTime()
                    : Date.now()
                ),

              updatedAt:
                original.updatedAt ||
                (
                  row.updated_at
                    ? new Date(
                        row.updated_at
                      ).getTime()
                    : Date.now()
                )
            };
          });

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

    const supabase =
      getSupabase();

    if (
      !supabase ||
      !cloudUserId
    ) {

      return false;
    }

    try {

      /*
       * لا نعتمد على id = settings
       * لأن كل معلم له ID مختلف.
       */

      const {
        data,
        error
      } =
        await supabase
          .from('settings')
          .select(
            'id,data,created_at,updated_at'
          )
          .eq(
            'teacher_id',
            cloudUserId
          )
          .limit(1)
          .maybeSingle();

      if (error) {

        console.error(
          '[Cloud] load settings error:',
          error
        );

        return false;
      }

      if (
        data &&
        data.data
      ) {

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

    cloudUserId =
      userId;

    cloudReady =
      false;

    console.info(
      '[Cloud] initializing for user:',
      userId
    );

    try {

      /*
       * 1. تحميل بيانات المعلم
       */

      await loadTeacher();

      /*
       * 2. تحميل الإعدادات
       */

      await loadSettings();

      /*
       * 3. تحميل جميع البيانات
       */

      for (
        const collection
        of Object.keys(
          CLOUD_TABLES
        )
      ) {

        await loadCollection(
          collection
        );
      }

      /*
       * نعلن أن الاتصال أصبح جاهزًا
       */

      cloudReady =
        true;

      /*
       * 4. ترحيل البيانات المحلية
       * للحساب الجديد فقط.
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

      cloudReady =
        false;

      return false;
    }
  }

  /* ============================================
     Migrate Local Data
     ============================================ */

  async function migrateLocalDataToCloud() {

    if (
      !cloudReady ||
      !cloudUserId
    ) {

      return;
    }

    try {

      /*
       * لا نرفع بيانات subjects/stages
       * لأنها ليست ضمن جداول Supabase الحالية.
       */

      for (
        const collection
        of Object.keys(
          CLOUD_TABLES
        )
      ) {

        const result =
          await loadCollection(
            collection
          );

        if (
          !result.success ||
          result.hasRemoteData
        ) {
          continue;
        }

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

      /*
       * Settings
       */

      const remoteSettings =
        await loadSettings();

      if (!remoteSettings) {

        await syncSettings();
      }

      /*
       * Teacher
       */

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
        of Object.keys(
          CLOUD_TABLES
        )
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
     Clear Cloud Data
     ============================================ */

  async function clearCloudData() {

    const supabase =
      getSupabase();

    if (
      !supabase ||
      !cloudUserId
    ) {

      return false;
    }

    try {

      /*
       * حذف بيانات الجداول المرتبطة بالمعلم.
       * RLS يضمن حذف بيانات هذا المعلم فقط.
       */

      for (
        const table
        of Object.values(
          CLOUD_TABLES
        )
      ) {

        const {
          error
        } =
          await supabase
            .from(table)
            .delete()
            .eq(
              'teacher_id',
              cloudUserId
            );

        if (error) {

          console.error(
            '[Cloud] clear error:',
            table,
            error
          );

          return false;
        }
      }

      /*
       * حذف الإعدادات.
       */

      const {
        error: settingsError
      } =
        await supabase
          .from('settings')
          .delete()
          .eq(
            'teacher_id',
            cloudUserId
          );

      if (settingsError) {

        console.error(
          '[Cloud] clear settings error:',
          settingsError
        );

        return false;
      }

      return true;

    } catch (error) {

      console.error(
        '[Cloud] clear cloud exception:',
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
      remove
    );

    cloudUserId =
      null;

    cloudReady =
      false;

    syncTimers = {};
  }

  /* ============================================
     Public API
     ============================================ */

  return {

    KEYS,

    DATA_VERSION,

    uid,

    runMigrations,

    /* ---------- Cloud ---------- */

    initCloud,

    syncAll,

    clearCloudData,

    clearUserCache,

    isCloudReady() {
      return cloudReady;
    },

    getCloudUserId() {
      return cloudUserId;
    },

    /* ---------- Generic CRUD ---------- */

    get(
      name,
      fallback = null
    ) {

      return read(
        name,
        fallback
      );
    },

    set(
      name,
      value
    ) {

      const result =
        write(
          name,
          value
        );

      if (!result) {
        return false;
      }

      /*
       * Teacher
       */

      if (
        name === KEYS.teacher
      ) {

        if (cloudReady) {
          syncTeacher();
        }

        return true;
      }

      /*
       * Settings
       */

      if (
        name === KEYS.settings
      ) {

        if (cloudReady) {

          clearTimeout(
            syncTimers.settings
          );

          syncTimers.settings =
            setTimeout(
              () => {
                syncSettings();
              },
              700
            );
        }

        return true;
      }

      /*
       * Cloud collections
       */

      if (
        CLOUD_TABLES[name]
      ) {

        scheduleSync(
          name
        );
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

    /* ---------- Collections ---------- */

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
          item =>
            item &&
            item.id === id
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

      items.push(
        newItem
      );

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

      const index =
        items.findIndex(
          item =>
            item &&
            item.id === id
        );

      if (index === -1) {
        return null;
      }

      items[index] = {

        ...items[index],

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

      return items[index];
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
          item =>
            item.id !== id
        );

      const changed =
        filtered.length !==
        items.length;

      if (!changed) {
        return false;
      }

      write(
        collection,
        filtered
      );

      if (
        CLOUD_TABLES[collection]
      ) {

        scheduleSync(
          collection
        );
      }

      return true;
    },

    /* ---------- Cascading Delete ---------- */

    cascadeDelete(
      collection,
      id,
      relations = []
    ) {

      relations.forEach(
        relation => {

          const items =
            read(
              relation.collection,
              []
            );

          if (
            !Array.isArray(items)
          ) {

            return;
          }

          const filtered =
            items.filter(
              item =>
                item[
                  relation.field
                ] !== id
            );

          write(
            relation.collection,
            filtered
          );

          if (
            CLOUD_TABLES[
              relation.collection
            ]
          ) {

            scheduleSync(
              relation.collection
            );
          }
        }
      );

      return this.removeById(
        collection,
        id
      );
    },

    /* ==========================================
       Backup
       ========================================== */

    exportAll() {

      const data = {};

      Object.values(KEYS)
        .forEach(name => {

          data[name] =
            read(
              name,
              null
            );
        });

      return {

        app:
          'moallemy',

        version:
          String(DATA_VERSION),

        exportedAt:
          new Date()
            .toISOString(),

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
          ([name, value]) => {

            if (
              value === null
            ) {

              return;
            }

            if (
              mode === 'merge'
            ) {

              const existing =
                read(
                  name,
                  Array.isArray(value)
                    ? []
                    : null
                );

              if (
                Array.isArray(value) &&
                Array.isArray(existing)
              ) {

                const merged =
                  [...existing];

                const existingIds =
                  new Set(
                    existing
                      .map(
                        item =>
                          item &&
                          item.id
                      )
                      .filter(Boolean)
                  );

                value.forEach(
                  item => {

                    if (
                      item &&
                      item.id &&
                      !existingIds.has(
                        item.id
                      )
                    ) {

                      merged.push(
                        item
                      );
                    }
                  }
                );

                write(
                  name,
                  merged
                );

              } else {

                write(
                  name,
                  value
                );
              }

            } else {

              write(
                name,
                value
              );
            }

            if (
              CLOUD_TABLES[name]
            ) {

              scheduleSync(
                name
              );
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

      } catch (error) {

        console.error(
          '[Storage] import error:',
          error
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
          ([name, value]) => {

            if (
              Array.isArray(value)
            ) {

              counts[name] =
                value.length;
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

      } catch (error) {

        return {

          valid: false,

          error:
            'تعذر قراءة الملف (JSON غير صالح)'
        };
      }
    },

    /* ==========================================
       Clear All
       ========================================== */

    async clearAll() {

      /*
       * نحذف من Supabase أولاً.
       */

      if (
        cloudReady &&
        cloudUserId
      ) {

        await clearCloudData();
      }

      /*
       * ثم نمسح الكاش المحلي.
       */

      Object.values(KEYS)
        .forEach(
          remove
        );

      cloudUserId =
        null;

      cloudReady =
        false;

      syncTimers = {};
    },

    /* ==========================================
       Demo Mode
       ========================================== */

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

    setDemoMode(value) {

      const meta =
        read(
          KEYS.meta,
          {}
        );

      meta.demoMode =
        value === true;

      write(
        KEYS.meta,
        meta
      );
    },

    /* ==========================================
       Audit Log
       ========================================== */

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

        at:
          Date.now()
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
        meta.auditLog ||
        []
      );
    },

    /* ==========================================
       Meta
       ========================================== */

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

    theme:
      'light',

    font:
      'cairo',

    absenceAlertThreshold:
      3,

    paymentReminderDay:
      1,

    currency:
      'ج.م',

    sendReportsByWhatsapp:
      true,

    autoGenerateLessons:
      true,

    reportCenter:
      '',

    reportPhone:
      '',

    reportEmail:
      '',

    reportSignature:
      'مع خالص التحية والتقدير',

    reportColor:
      '#8B5E34',

    aiEnabled:
      true,

    reportStyle:
      'متوسط',

    weights: {

      exams:
        50,

      assignments:
        20,

      attendance:
        10,

      continuous:
        20
    }
  },

  ensureSeeds() {

    /* ---------- Subjects ---------- */

    const existingSubjects =
      Storage.get(
        Storage.KEYS.subjects,
        null
      );

    if (
      existingSubjects === null ||
      existingSubjects === undefined
    ) {

      Storage.set(
        Storage.KEYS.subjects,

        Seeds.subjects.map(
          (name, index) => ({

            id:
              'sub_' +
              index,

            name,

            isDefault:
              true
          })
        )
      );
    }

    /* ---------- Stages ---------- */

    const existingStages =
      Storage.get(
        Storage.KEYS.stages,
        null
      );

    if (
      existingStages === null ||
      existingStages === undefined
    ) {

      Storage.set(
        Storage.KEYS.stages,
        Seeds.stages
      );
    }

    /* ---------- Settings ---------- */

    const existingSettings =
      Storage.get(
        Storage.KEYS.settings,
        null
      );

    if (
      existingSettings === null ||
      existingSettings === undefined
    ) {

      Storage.set(
        Storage.KEYS.settings,
        {
          ...Seeds.defaultSettings,

          weights: {
            ...Seeds.defaultSettings.weights
          }
        }
      );

    } else {

      const merged = {

        ...Seeds.defaultSettings,

        ...existingSettings
      };

      merged.weights = {

        ...Seeds.defaultSettings.weights,

        ...(existingSettings.weights || {})
      };

      Storage.set(
        Storage.KEYS.settings,
        merged
      );
    }

    /* ---------- Local collections ---------- */

    [
      'notes',
      'goals',
      'reports'
    ].forEach(
      name => {

        const value =
          Storage.get(
            name,
            null
          );

        if (
          value === null ||
          value === undefined
        ) {

          Storage.set(
            name,
            []
          );
        }
      }
    );
  }
};


/* ============================================
   Expose Globally
   ============================================ */

window.Storage =
  Storage;

window.Seeds =
  Seeds;