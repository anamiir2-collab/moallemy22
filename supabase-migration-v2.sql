-- ============================================================
-- مُعلّمي | Moallemy - Supabase Schema Migration (v2.0.0)
-- ============================================================
-- هذا الملف يوفّر schema اختياري لمن يريد الترقية لـ Supabase.
-- التطبيق الحالي يعمل بالكامل على LocalStorage، ويمكن استبدال
-- طبقة Storage بهذا الـ schema عند الحاجة دون إعادة بناء الواجهة.
--
-- هذا الملف آمن للبيانات الموجودة:
-- - لا يحذف أي جدول
-- - يستخدم IF NOT EXISTS لكل العناصر
-- - يضيف RLS Policies لكل جدول لعزل بيانات كل مدرس
-- ============================================================

-- ===== 1. Teachers =====
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT,
  stage TEXT,
  governorate TEXT,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  pin TEXT NOT NULL,  -- hashed in production
  logo TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;

-- Teachers can read/update only their own row (matched by phone)
CREATE POLICY IF NOT EXISTS "teachers_self_read" ON teachers
  FOR SELECT USING (auth.jwt() ->> 'phone' = phone);

CREATE POLICY IF NOT EXISTS "teachers_self_update" ON teachers
  FOR UPDATE USING (auth.jwt() ->> 'phone' = phone);

-- ===== 2. Subjects =====
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "subjects_owner_all" ON subjects
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 3. Groups =====
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  stage_id TEXT,
  class_name TEXT,
  section TEXT,
  subject TEXT,
  days TEXT[],         -- array of day IDs: ['saturday','sunday',...]
  time TEXT,
  duration INTEGER DEFAULT 90,
  location TEXT,
  price NUMERIC(10,2) DEFAULT 0,
  max_students INTEGER DEFAULT 15,
  level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "groups_owner_all" ON groups
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 4. Students =====
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  stage_id TEXT,
  class_name TEXT,
  section TEXT,
  subject TEXT,
  school TEXT,
  governorate TEXT,
  student_phone TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  subscription_date DATE,
  subscription_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'نشط',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "students_owner_all" ON students
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 5. Lessons =====
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  duration INTEGER DEFAULT 90,
  location TEXT,
  topic TEXT,
  notes TEXT,
  status TEXT DEFAULT 'مجدولة',  -- مجدولة / تمت / ملغاة / مؤجلة / تعويض
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_teacher_date ON lessons(teacher_id, date);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "lessons_owner_all" ON lessons
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 6. Attendance =====
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL,  -- حاضر / غائب / متأخر / غياب بعذر
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, student_id)  -- prevent duplicate attendance for same lesson+student
);

CREATE INDEX IF NOT EXISTS idx_attendance_lesson ON attendance(lesson_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "attendance_owner_all" ON attendance
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 7. Exams =====
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  subject TEXT,
  date DATE,
  topic TEXT,
  max_grade NUMERIC(10,2) DEFAULT 20,
  duration INTEGER DEFAULT 30,
  difficulty TEXT DEFAULT 'medium',
  question_set_id UUID,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "exams_owner_all" ON exams
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 8. Grades =====
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  score NUMERIC(10,2) NOT NULL,
  max_grade NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_exam ON grades(exam_id);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "grades_owner_all" ON grades
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 9. Assignments =====
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  topic TEXT,
  assigned_date DATE,
  due_date DATE,
  max_grade NUMERIC(10,2) DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "assignments_owner_all" ON assignments
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 10. Submissions =====
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_submitted',  -- submitted / not_submitted / late / reviewed
  score NUMERIC(10,2),
  submitted_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "submissions_owner_all" ON submissions
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 11. Payments =====
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  month TEXT,                       -- YYYY-MM format
  required NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  method TEXT,
  date DATE,
  due_date DATE,
  schedule TEXT DEFAULT 'monthly',  -- monthly / per_lesson / weekly / custom
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_due ON payments(due_date);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "payments_owner_all" ON payments
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 12. Transactions (audit log for payment events) =====
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT,
  date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "transactions_owner_all" ON transactions
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 13. Question sets (for AI exam generator) =====
CREATE TABLE IF NOT EXISTS exam_question_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  questions JSONB NOT NULL,  -- array of question objects
  difficulty TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exam_question_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "exam_question_sets_owner_all" ON exam_question_sets
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 14. Exam scans (camera OCR records) =====
-- Note: image_data is stored as base64 TEXT. For large-scale use, consider
-- Supabase Storage buckets instead. Image data is NEVER uploaded to external AI providers.
CREATE TABLE IF NOT EXISTS exam_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  grade_id UUID REFERENCES grades(id) ON DELETE SET NULL,
  ocr_text TEXT,
  image_data TEXT,             -- base64-encoded locally; never uploaded externally
  question_results JSONB,
  teacher_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exam_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "exam_scans_owner_all" ON exam_scans
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 15. Notifications =====
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  related_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_teacher_unread ON notifications(teacher_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "notifications_owner_all" ON notifications
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== 16. Settings =====
CREATE TABLE IF NOT EXISTS teacher_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE UNIQUE NOT NULL,
  theme TEXT DEFAULT 'light',
  font TEXT DEFAULT 'cairo',
  absence_alert_threshold INTEGER DEFAULT 3,
  payment_reminder_day INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'ج.م',
  send_reports_by_whatsapp BOOLEAN DEFAULT TRUE,
  auto_generate_lessons BOOLEAN DEFAULT TRUE,
  absent_template TEXT,
  overdue_template TEXT,
  report_template TEXT,
  ai_provider TEXT DEFAULT 'none',
  ai_api_key TEXT,    -- stored encrypted in production
  ai_endpoint TEXT,
  ai_model TEXT,
  notif_lessons BOOLEAN DEFAULT TRUE,
  notif_attendance BOOLEAN DEFAULT TRUE,
  notif_absence BOOLEAN DEFAULT TRUE,
  notif_payment_due BOOLEAN DEFAULT TRUE,
  notif_overdue BOOLEAN DEFAULT TRUE,
  notif_homework BOOLEAN DEFAULT TRUE,
  notif_exams BOOLEAN DEFAULT TRUE,
  notif_performance BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "settings_owner_all" ON teacher_settings
  FOR ALL USING (teacher_id::text = auth.jwt() ->> 'sub');

-- ===== Updated_at trigger =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['teachers','groups','students','lessons','attendance','exams','grades','assignments','submissions','payments','exam_question_sets','notifications','teacher_settings'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at()', t);
  END LOOP;
END $$;

-- ===== End of migration =====
-- To apply: run this in Supabase SQL Editor.
-- The migration is idempotent (safe to re-run).
-- ============================================================
