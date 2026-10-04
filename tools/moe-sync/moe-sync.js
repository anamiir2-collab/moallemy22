#!/usr/bin/env node
/* ============================================
   مُعلّمي | tools/moe-sync/moe-sync.js
   أداة المزامنة مع بوابة الكتب الرسمية
   وزارة التربية والتعليم والتعليم الفني — مصر
   https://studentbooks.moe.gov.eg/Books/
   --------------------------------------------
   البنية المعمارية:
     بوابة الوزارة ← هذه الأداة ← Supabase ← تطبيق مُعلّمي
   التطبيق لا يتصل بموقع الوزارة إطلاقًا.

   ⚠️ ملاحظة مهمة: موقع الوزارة محمي بحاجز جغرافي (WAF)
   وقد يرفض الطلبات من خارج مصر. شغّل وضع --fetch من شبكة
   مصرية (أو عبر VPN). أما وضعا --verify و --push فيعملان
   من أي مكان (خوادم الملفات وSupabase متاحتان عالميًا).

   الاستخدام:
     node moe-sync.js --fetch            # قراءة الكتالوج الرسمي وتوليد data/moe-catalog.js
     node moe-sync.js --fetch --push     # قراءة ثم رفع مباشر إلى Supabase
     node moe-sync.js --push             # رفع data/moe-catalog.json الحالي إلى Supabase
     node moe-sync.js --verify           # فحص عينة من روابط PDF الرسمية
     node moe-sync.js --import FILE.json # معالجة كتالوج محفوظ مسبقًا (بدون اتصال بالوزارة)

   متغيرات البيئة المطلوبة لوضع --push:
     SUPABASE_URL=https://<project>.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=<service role key — سري جدًا، لا تضعه في الواجهة>

   سياسة الاحترام:
   - طلب واحد فقط لملف بيانات البوابة في وضع --fetch
   - فحص عينة محدودة مع مهلة 1.2 ثانية بين الطلبات في وضع --verify
   - لا يتم تنزيل ملفات PDF — روابط رسمية فقط
   - لا تُحذف الكتب القديمة أبدًا — تحديث/إضافة فقط (upsert)
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const PORTAL_BOOKS_URL = 'https://studentbooks.moe.gov.eg/books/scripts.js';
const PORTAL_SOURCE_URL = 'https://studentbooks.moe.gov.eg/Books/';
const BLOB_HOST = 'https://elearnningcontent.blob.core.windows.net/';

// ===== أدوات =====
function stableId(...parts) {
  const crypto = require('crypto');
  return 'cb_' + crypto.createHash('md5').update(parts.join('|')).digest('hex').slice(0, 16);
}

function log(msg) { console.log('[moe-sync] ' + msg); }
function die(msg) { console.error('[moe-sync] خطأ: ' + msg); process.exit(1); }

function requireFetch() {
  if (typeof fetch !== 'function') {
    die('هذه الأداة تحتاج Node.js 18+ (لدعم fetch المدمج)');
  }
}

// ===== 1) قراءة وتحليل بيانات البوابة الرسمية =====
// ملف scripts.js يحتوي مصفوفة const books = [{stage, grade, term, type, subject, link}, ...]
function parseBooksFromScript(src) {
  const pattern = /\{stage:"([^"]*)",grade:"([^"]*)",term:"([^"]*)",type:"([^"]*)",subject:"([^"]*)",link:"([^"]*)"\}/g;
  const books = [];
  let m;
  while ((m = pattern.exec(src)) !== null) {
    let link = m[6].trim();
    // إزالة أي بادئة أرشيف لو وجدت
    link = link.replace(/^https?:\/\/web\.archive\.org\/web\/\d+(?:[a-z_]+)?\//, '');
    books.push({
      stage: m[1].trim(), grade: m[2].trim(), term: m[3].trim(),
      type: m[4].trim(), subject: m[5].trim(), link
    });
  }
  return books;
}

function buildCatalog(rawBooks, academicYear) {
  const stageOrder = ['رياض الاطفال', 'الإبتدائية', 'الإعدادي', 'ثانوي', 'تعليم مجتمعي'];
  const seenStages = [];
  rawBooks.forEach(b => { if (!seenStages.includes(b.stage)) seenStages.push(b.stage); });
  const stages = seenStages
    .sort((a, b) => {
      const ia = stageOrder.indexOf(a), ib = stageOrder.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map((title, i) => ({ id: 'st_' + stableId(title).slice(3), title, order_index: i }));

  const gradeSet = [];
  rawBooks.forEach(b => { if (!gradeSet.includes(b.grade)) gradeSet.push(b.grade); });
  const grades = [];
  stages.forEach(st => {
    const stGrades = gradeSet.filter(g => rawBooks.some(b => b.stage === st.title && b.grade === g));
    stGrades.forEach((title, j) => {
      grades.push({ id: 'gr_' + stableId(st.title, title).slice(3), stage_id: st.id, title, order_index: j });
    });
  });

  const subjectSet = [];
  rawBooks.forEach(b => { if (!subjectSet.includes(b.subject)) subjectSet.push(b.subject); });
  subjectSet.sort((a, b) => a.localeCompare(b, 'ar'));
  const subjects = subjectSet.map((title, i) => ({ id: 'su_' + stableId(title).slice(3), title, order_index: i }));

  const stageMap = Object.fromEntries(stages.map(s => [s.title, s.id]));
  const gradeMap = Object.fromEntries(grades.map(g => [g.title, g.id]));
  const subjectMap = Object.fromEntries(subjects.map(s => [s.title, s.id]));

  const books = rawBooks.map(b => {
    const pdfUrl = b.link;
    if (!pdfUrl.startsWith(BLOB_HOST)) {
      log(`تحذير: رابط غير رسمي تم تجاهله (${pdfUrl.slice(0, 60)}...)`);
      return null;
    }
    return {
      id: stableId(b.stage, b.grade, b.term, b.type, b.subject, pdfUrl),
      stageId: stageMap[b.stage], gradeId: gradeMap[b.grade], subjectId: subjectMap[b.subject],
      stage: b.stage, grade: b.grade, term: b.term, subject: b.subject, type: b.type,
      title: `${b.subject} — ${b.grade}`,
      academicYear: academicYear || '',
      officialUrl: PORTAL_SOURCE_URL,
      pdfUrl,
      coverUrl: null,
      source: 'وزارة التربية والتعليم',
      sourceUrl: PORTAL_SOURCE_URL
    };
  }).filter(Boolean);

  return {
    version: 1,
    academicYear: academicYear || '',
    source: 'وزارة التربية والتعليم والتعليم الفني — جمهورية مصر العربية',
    sourceUrl: PORTAL_SOURCE_URL,
    host: BLOB_HOST,
    lastSyncedAt: new Date().toISOString(),
    stages, grades, subjects, books
  };
}

async function fetchCatalog() {
  requireFetch();
  log('جاري قراءة بيانات البوابة الرسمية: ' + PORTAL_BOOKS_URL);
  log('طلب واحد فقط — بدون أي ضغط على موقع الوزارة');

  const res = await fetch(PORTAL_BOOKS_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 moallemy-sync/1.0',
      'Accept': '*/*',
      'Accept-Language': 'ar,en;q=0.8'
    }
  });

  if (res.status === 403) {
    die('بوابة الوزارة محجوبة من شبكتك الحالية (حاجز جغرافي). ' +
        'شغّل هذه الأداة من شبكة مصرية أو استخدم --import مع كتالوج محفوظ. ' +
        'يمكنك أيضًا استخدام وضعي --push و --verify فهما يعملان من أي مكان.');
  }
  if (!res.ok) die(`فشل الطلب: HTTP ${res.status}`);

  const src = await res.text();
  const rawBooks = parseBooksFromScript(src);
  if (!rawBooks.length) die('لم يتم العثور على كتب في بيانات البوابة — قد تكون تغيرت بنية الملف، راجع parseBooksFromScript');

  // استنتاج العام الدراسي من مسار الروابط (مثال: /2026/ → 2025-2026)
  let academicYear = '';
  const ym = src.match(/elearnningcontent\/(\d{4})\//);
  if (ym) academicYear = `${parseInt(ym[1], 10) - 1}-${ym[1]}`;

  log(`تم العثور على ${rawBooks.length} كتابًا رسميًا`);
  return buildCatalog(rawBooks, academicYear);
}

function saveCatalog(catalog) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const dataDir = path.join(repoRoot, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(path.join(dataDir, 'moe-catalog.json'), JSON.stringify(catalog, null, 1), 'utf-8');

  const jsContent = '/* مولَّد تلقائيًا بواسطة tools/moe-sync — المصدر: وزارة التربية والتعليم ' +
    'https://studentbooks.moe.gov.eg/Books/ — لا تعدّل يدويًا */\n' +
    'window.MOE_CATALOG = ' + JSON.stringify(catalog) + ';\n';
  fs.writeFileSync(path.join(dataDir, 'moe-catalog.js'), jsContent, 'utf-8');

  log(`تم الحفظ: data/moe-catalog.json + data/moe-catalog.js (${catalog.books.length} كتابًا، العام ${catalog.academicYear || 'غير محدد'})`);
}

// ===== 2) الرفع إلى Supabase =====
async function pushToSupabase(catalog) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    die('حدد متغيري البيئة SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY ثم أعد المحاولة\n' +
        'مثال: SUPABASE_URL=https://xx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node moe-sync.js --push');
  }

  const base = url.replace(/\/$/, '');
  const headers = {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };

  async function upsert(table, rows) {
    if (!rows.length) return;
    const res = await fetch(`${base}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      die(`فشل رفع ${table}: HTTP ${res.status} — ${t.slice(0, 200)}`);
    }
    log(`  ${table}: ${rows.length} صف`);
  }

  log('الرفع إلى Supabase (upsert فقط — لا حذف لأي كتاب قديم)...');
  await upsert('curriculum_stages', catalog.stages.map(s => ({
    id: s.id, title: s.title, order_index: s.order_index,
    source_url: PORTAL_SOURCE_URL, data: s
  })));
  await upsert('curriculum_grades', catalog.grades.map(g => ({
    id: g.id, stage_id: g.stage_id, title: g.title, order_index: g.order_index, data: g
  })));
  await upsert('curriculum_subjects', catalog.subjects.map(s => ({
    id: s.id, title: s.title, order_index: s.order_index, data: s
  })));
  await upsert('curriculum_books', catalog.books.map(b => ({
    id: b.id,
    stage_id: b.stageId, grade_id: b.gradeId, subject_id: b.subjectId,
    stage: b.stage, grade: b.grade, term: b.term, subject: b.subject,
    book_type: b.type, title: b.title, academic_year: b.academicYear,
    cover_url: b.coverUrl, official_url: b.officialUrl, pdf_url: b.pdfUrl,
    source: b.source, source_url: b.sourceUrl,
    last_synced_at: new Date().toISOString(), data: b
  })));

  // حالة المزامنة العامة
  await fetch(`${base}/rest/v1/curriculum_sync_state?on_conflict=id`, {
    method: 'POST',
    headers,
    body: JSON.stringify([{
      id: 'global',
      last_synced_at: new Date().toISOString(),
      book_count: catalog.books.length,
      academic_year: catalog.academicYear || '',
      source_url: PORTAL_SOURCE_URL,
      data: { version: catalog.version }
    }])
  }).then(async r => {
    if (!r.ok) die('فشل تحديث curriculum_sync_state: HTTP ' + r.status);
    log('  curriculum_sync_state: محدث');
  });

  log('اكتمل الرفع بنجاح ✓ — التطبيق سيلتقط الكتالوج الجديد عند أول تحديث');
}

// ===== 3) فحص عينة من الروابط الرسمية =====
async function verifyLinks(catalog) {
  requireFetch();
  const books = catalog.books;
  const SAMPLE = Math.min(10, books.length);
  const step = Math.max(1, Math.floor(books.length / SAMPLE));
  const sample = books.filter((_, i) => i % step === 0).slice(0, SAMPLE);

  log(`فحص ${sample.length} رابطًا من أصل ${books.length} (مهلة 1.2 ثانية بين الطلبات — احترامًا للخادم الرسمي)...`);
  let ok = 0, fail = 0;
  for (const b of sample) {
    try {
      const res = await fetch(b.pdfUrl, { method: 'HEAD' });
      if (res.ok) { ok++; log(`  ✓ [${res.status}] ${b.subject} — ${b.grade}`); }
      else { fail++; log(`  ✗ [${res.status}] ${b.subject} — ${b.grade}`); }
    } catch (e) {
      fail++;
      log(`  ✗ [شبكة] ${b.subject} — ${b.grade}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  log(`النتيجة: ${ok} سليم / ${fail} فاشل من ${sample.length}`);
  if (fail > 0) process.exitCode = 2;
}

// ===== 4) الاستيراد من ملف (بدون اتصال بالوزارة) =====
function importFromFile(file) {
  if (!fs.existsSync(file)) die('الملف غير موجود: ' + file);
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!Array.isArray(raw.books) || !raw.books.length) die('الملف لا يحتوي كتبًا صالحة');
  log(`تم تحميل ${raw.books.length} كتابًا من ${file}`);
  return raw;
}

// ===== الرئيسية =====
async function main() {
  const args = process.argv.slice(2);
  const doFetch = args.includes('--fetch');
  const doPush = args.includes('--push');
  const doVerify = args.includes('--verify');
  const importIdx = args.indexOf('--import');
  const importFile = importIdx !== -1 ? args[importIdx + 1] : null;

  if (!doFetch && !doPush && !doVerify && !importFile) {
    console.log(`
مُعلّمي | أداة المزامنة مع بوابة الكتب الرسمية — وزارة التربية والتعليم

الاستخدام:
  node moe-sync.js --fetch              قراءة الكتالوج الرسمي وتحديث data/moe-catalog
  node moe-sync.js --fetch --push       قراءة ثم رفع إلى Supabase
  node moe-sync.js --push               رفع data/moe-catalog.json الحالي إلى Supabase
  node moe-sync.js --verify             فحص عينة من روابط PDF الرسمية
  node moe-sync.js --import FILE.json   تحويل كتالوج محفوظ إلى data/moe-catalog

لوضع --push حدد:
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=<مفتاح الخدمة — سري جدًا>

ملاحظة: موقع الوزارة محجوب خارج مصر. استخدم --fetch من شبكة مصرية.
وضعا --push و --verify يعملان من أي مكان في العالم.
`);
    return;
  }

  let catalog = null;
  if (importFile) {
    catalog = importFromFile(importFile);
    saveCatalog(catalog);
  } else if (doFetch) {
    catalog = await fetchCatalog();
    saveCatalog(catalog);
  } else {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const f = path.join(repoRoot, 'data', 'moe-catalog.json');
    if (!fs.existsSync(f)) die('data/moe-catalog.json غير موجود — شغّل --fetch أولًا');
    catalog = JSON.parse(fs.readFileSync(f, 'utf-8'));
    log(`تم تحميل الكتالوج الحالي (${catalog.books.length} كتابًا)`);
  }

  if (doVerify) await verifyLinks(catalog);
  if (doPush) await pushToSupabase(catalog);

  log('انتهى ✓');
}

main().catch(e => die(e.stack || e.message));
