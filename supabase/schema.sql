-- ============================================================
-- مُعلّمي | Supabase Schema (v1.1.0)
-- ------------------------------------------------------------
-- هذا الملف توثيق كامل للمخطط المُطبَّق فعليًا على مشروع
-- secejwjzxfjgjozpteld.supabase.co — استخدمه لإعادة إنشاء
-- نفس الإعداد على مشروع Supabase آخر أو للاستعادة.
--
-- نمط التصميم: JSONB موحّد
--   id          نص (يولّده التطبيق) — PK
--   teacher_id  uuid = auth.uid() — مالك السجل
--   data        jsonb — كائن السجل الكامل كما في التطبيق
--   created_at / updated_at
--
-- الأمان: RLS مفعّل على كل الجداول
--   كل معلم يرى/يعدّل/يحذف بياناته فقط (teacher_id = auth.uid())
--
-- teacher_profiles: صف لكل مستخدم يُنشأ تلقائيًا بـ trigger
--   عند التسجيل في auth.users.
-- ============================================================

-- ============ 1) جدول حساب المعلم ============
create table if not exists public.teacher_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text default '',
  phone       text,
  email       text,
  subject     text,
  stage       text,
  governorate text,
  logo        text,
  bio         text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============ 2) جداول البيانات (JSONB) ============
create table if not exists public.students      (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.groups        (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.lessons       (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.attendance    (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.assignments   (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.submissions   (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.exams         (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.grades        (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.payments      (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.reports       (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.notifications (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.settings      (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.evaluations   (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.announcements (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.receipts      (id text primary key, teacher_id uuid not null references auth.users(id) on delete cascade, data jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now());

-- فهارس الأداء
create index if not exists idx_students_teacher      on public.students      (teacher_id);
create index if not exists idx_groups_teacher        on public.groups        (teacher_id);
create index if not exists idx_lessons_teacher       on public.lessons       (teacher_id);
create index if not exists idx_attendance_teacher    on public.attendance    (teacher_id);
create index if not exists idx_assignments_teacher   on public.assignments   (teacher_id);
create index if not exists idx_submissions_teacher   on public.submissions   (teacher_id);
create index if not exists idx_exams_teacher         on public.exams         (teacher_id);
create index if not exists idx_grades_teacher        on public.grades        (teacher_id);
create index if not exists idx_payments_teacher      on public.payments      (teacher_id);
create index if not exists idx_reports_teacher       on public.reports       (teacher_id);
create index if not exists idx_notifications_teacher on public.notifications (teacher_id);
create index if not exists idx_settings_teacher      on public.settings      (teacher_id);
create index if not exists idx_evaluations_teacher   on public.evaluations   (teacher_id);
create index if not exists idx_announcements_teacher on public.announcements (teacher_id);
create index if not exists idx_receipts_teacher      on public.receipts      (teacher_id);

-- ============ 3) RLS: كل معلم يرى بياناته فقط ============
alter table public.teacher_profiles enable row level security;
alter table public.students      enable row level security;
alter table public.groups        enable row level security;
alter table public.lessons       enable row level security;
alter table public.attendance    enable row level security;
alter table public.assignments   enable row level security;
alter table public.submissions   enable row level security;
alter table public.exams         enable row level security;
alter table public.grades        enable row level security;
alter table public.payments      enable row level security;
alter table public.reports       enable row level security;
alter table public.notifications enable row level security;
alter table public.settings      enable row level security;
alter table public.evaluations   enable row level security;
alter table public.announcements enable row level security;
alter table public.receipts      enable row level security;

-- teacher_profiles
drop policy if exists "profile_select_own" on public.teacher_profiles;
create policy "profile_select_own" on public.teacher_profiles
  for select using (auth.uid() = id);
drop policy if exists "profile_upsert_own" on public.teacher_profiles;
create policy "profile_upsert_own" on public.teacher_profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profile_update_own" on public.teacher_profiles;
create policy "profile_update_own" on public.teacher_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profile_delete_own" on public.teacher_profiles;
create policy "profile_delete_own" on public.teacher_profiles
  for delete using (auth.uid() = id);

-- سياسة موحدة لكل جدول بيانات (مُولَّدة تلقائيًا أدناه)
do $$
declare t text;
begin
  foreach t in array array[
    'students','groups','lessons','attendance','assignments','submissions',
    'exams','grades','payments','reports','notifications','settings',
    'evaluations','announcements','receipts'
  ] loop
    execute format('drop policy if exists "teacher_all_own" on public.%I', t);
    execute format(
      'create policy "teacher_all_own" on public.%I for all
         using (auth.uid() = teacher_id)
         with check (auth.uid() = teacher_id)', t);
  end loop;
end $$;

-- ============ 4) Trigger: إنشاء صف المعلم تلقائيًا عند التسجيل ============
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.teacher_profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- (نفّذ هذا السطر فقط إذا كان التريغر غير موجود على مشروعك)
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function public.handle_new_user();

-- ============ 5) إعدادات المصادقة (من لوحة Supabase) ============
-- Authentication > Providers > Email:
--   [ ] Confirm email  ← يجب أن يكون معطّلًا لأن الدخول يتم برقم
--       الهاتف + PIN (النظام يحوّلهما داخليًا لبريد صناعي + كلمة مرور)
