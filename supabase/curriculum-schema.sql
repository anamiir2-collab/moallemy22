-- ============================================================
-- مُعلّمي | Curriculum Schema (v1.3.0) — نظام المناهج الدراسية
-- ------------------------------------------------------------
-- ⚠️  هذا الملف يضيف جداول جديدة فقط — لا يحذف ولا يعدّل أي جدول موجود.
--  نفّذه في SQL Editor داخل لوحة Supabase لمشروعك الحالي.
--
-- المصدر الرسمي للبيانات:
--   وزارة التربية والتعليم والتعليم الفني — جمهورية مصر العربية
--   https://studentbooks.moe.gov.eg/Books/
--   ملفات الكتب مستضافة رسميًا على:
--   https://elearnningcontent.blob.core.windows.net/
--
-- فلسفة التصميم:
--   1) جداول الكتالوج الرسمي (stages/grades/subjects/books) — مشتركة
--      بين كل المدرسين: قراءة لأي مستخدم مسجّل، والكتابة لأداة
--      المزامنة فقط (service_role — تتجاوز RLS بطبيعتها).
--   2) جداول المدرس (units/lessons/favorites/progress) — خاصة بكل
--      معلم: RLS يسمح له فقط بالقراءة والكتابة (auth.uid()).
--
-- لا يتم تخزين أي PDF داخل قاعدة البيانات — روابط رسمية فقط.
-- ============================================================


-- ============ 1) الكتالوج الرسمي — مشترك (قراءة فقط للتطبيق) ============

-- المراحل التعليمية
create table if not exists public.curriculum_stages (
  id          text primary key,
  title       text not null,
  order_index int  default 0,
  source_url  text default 'https://studentbooks.moe.gov.eg/Books/',
  data        jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- الصفوف الدراسية (تابعة لمرحلة)
create table if not exists public.curriculum_grades (
  id          text primary key,
  stage_id    text not null references public.curriculum_stages(id) on delete cascade,
  title       text not null,
  order_index int  default 0,
  data        jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- المواد (مستخرجة من البيانات الرسمية حسب الصف)
create table if not exists public.curriculum_subjects (
  id          text primary key,
  title       text not null,
  order_index int  default 0,
  data        jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- الكتب الرسمية
create table if not exists public.curriculum_books (
  id             text primary key,
  stage_id       text,
  grade_id       text,
  subject_id     text,
  stage          text not null,
  grade          text not null,
  term           text not null,
  subject        text not null,
  book_type      text default 'كتاب الطالب',
  title          text not null,
  academic_year  text,
  cover_url      text,
  official_url   text,
  pdf_url        text not null,
  source         text default 'وزارة التربية والتعليم',
  source_url     text default 'https://studentbooks.moe.gov.eg/Books/',
  last_synced_at timestamptz,
  data           jsonb default '{}',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- حالة المزامنة العامة (سجل واحد id='global')
create table if not exists public.curriculum_sync_state (
  id             text primary key default 'global',
  last_synced_at timestamptz,
  book_count     int default 0,
  academic_year  text,
  source_url     text default 'https://studentbooks.moe.gov.eg/Books/',
  data           jsonb default '{}',
  updated_at     timestamptz default now()
);

-- فهارس الكتالوج
create index if not exists idx_curriculum_books_stage  on public.curriculum_books (stage_id);
create index if not exists idx_curriculum_books_grade  on public.curriculum_books (grade_id);
create index if not exists idx_curriculum_books_subject on public.curriculum_books (subject_id);
create index if not exists idx_curriculum_books_term   on public.curriculum_books (term);
create index if not exists idx_curriculum_grades_stage on public.curriculum_grades (stage_id);

-- RLS: الكتالوج قراءة لأي مستخدم مسجّل، والكتابة لأداة المزامنة فقط
alter table public.curriculum_stages    enable row level security;
alter table public.curriculum_grades    enable row level security;
alter table public.curriculum_subjects  enable row level security;
alter table public.curriculum_books     enable row level security;
alter table public.curriculum_sync_state enable row level security;

drop policy if exists "curriculum_catalog_read" on public.curriculum_stages;
create policy "curriculum_catalog_read" on public.curriculum_stages
  for select to authenticated using (true);
drop policy if exists "curriculum_catalog_read" on public.curriculum_grades;
create policy "curriculum_catalog_read" on public.curriculum_grades
  for select to authenticated using (true);
drop policy if exists "curriculum_catalog_read" on public.curriculum_subjects;
create policy "curriculum_catalog_read" on public.curriculum_subjects
  for select to authenticated using (true);
drop policy if exists "curriculum_catalog_read" on public.curriculum_books;
create policy "curriculum_catalog_read" on public.curriculum_books
  for select to authenticated using (true);
drop policy if exists "curriculum_sync_read" on public.curriculum_sync_state;
create policy "curriculum_sync_read" on public.curriculum_sync_state
  for select to authenticated using (true);

-- ملاحظة: لا توجد سياسات INSERT/UPDATE/DELETE للكتالوج —
-- أداة المزامنة تستخدم SERVICE_ROLE Key وهي تتجاوز RLS،
-- لذلك لا يستطيع أي مستخدم من المتصفح تعديل الكتالوج الرسمي.


-- ============ 2) بيانات المدرس — خاصة بكل معلم (RLS كامل) ============

-- الوحدات: يبنيها المدرس للكتاب الرسمي (لعدم وجود فهرس قابل للاستخراج)
create table if not exists public.curriculum_units (
  id          text primary key,
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  book_id     text not null,
  title       text not null,
  order_index int default 0,
  data        jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- الدروس: تابعة لوحدة
create table if not exists public.curriculum_lessons (
  id          text primary key,
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  unit_id     text not null,
  book_id     text not null,
  title       text not null,
  description text default '',
  order_index int default 0,
  data        jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- المفضلة: كتب أو دروس محفوظة لكل حساب مدرس
create table if not exists public.curriculum_favorites (
  id         text primary key,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  item_type  text not null default 'book',   -- book | lesson
  item_id    text not null,
  data       jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- متابعة تقدم المنهج: "تم تدريس الدرس" لكل مجموعة
create table if not exists public.curriculum_teacher_progress (
  id          text primary key,
  teacher_id  uuid not null references auth.users(id) on delete cascade,
  group_id    text,
  book_id     text not null,
  unit_id     text,
  lesson_id   text not null,
  taught_date text,
  status      text default 'تم التدريس',
  data        jsonb default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- فهارس جداول المدرس
create index if not exists idx_curriculum_units_teacher      on public.curriculum_units (teacher_id);
create index if not exists idx_curriculum_units_book         on public.curriculum_units (book_id);
create index if not exists idx_curriculum_lessons_teacher    on public.curriculum_lessons (teacher_id);
create index if not exists idx_curriculum_lessons_unit       on public.curriculum_lessons (unit_id);
create index if not exists idx_curriculum_favorites_teacher  on public.curriculum_favorites (teacher_id);
create index if not exists idx_curriculum_progress_teacher   on public.curriculum_teacher_progress (teacher_id);
create index if not exists idx_curriculum_progress_book      on public.curriculum_teacher_progress (book_id);

-- RLS: كل معلم يرى ويعدّل بياناته فقط
alter table public.curriculum_units             enable row level security;
alter table public.curriculum_lessons           enable row level security;
alter table public.curriculum_favorites         enable row level security;
alter table public.curriculum_teacher_progress  enable row level security;

do $$
begin
  -- curriculum_units
  execute 'drop policy if exists "curriculum_units_own" on public.curriculum_units';
  execute 'create policy "curriculum_units_own" on public.curriculum_units for all
             using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id)';
  -- curriculum_lessons
  execute 'drop policy if exists "curriculum_lessons_own" on public.curriculum_lessons';
  execute 'create policy "curriculum_lessons_own" on public.curriculum_lessons for all
             using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id)';
  -- curriculum_favorites
  execute 'drop policy if exists "curriculum_favorites_own" on public.curriculum_favorites';
  execute 'create policy "curriculum_favorites_own" on public.curriculum_favorites for all
             using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id)';
  -- curriculum_teacher_progress
  execute 'drop policy if exists "curriculum_progress_own" on public.curriculum_teacher_progress';
  execute 'create policy "curriculum_progress_own" on public.curriculum_teacher_progress for all
             using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id)';
end $$;
