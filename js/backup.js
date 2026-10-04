/* ============================================
   مُعلّمي | backup.js
   النسخ الاحتياطي: تصدير/استيراد مع تحقق وتأكيد وMerge/Replace
   Settings.exportData وSettings.importData يفوضان لهذه الوحدة
   ============================================ */

const Backup = {
  exportJson() {
    const data = Storage.exportAll();
    const counts = {};
    Object.entries(data.data).forEach(([k, v]) => {
      if (Array.isArray(v)) counts[k] = v.length;
    });

    Storage.setMeta({ lastBackupAt: Date.now() });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moallemy-backup-${Utils.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    Storage.audit('تصدير نسخة احتياطية', `${Object.values(counts).reduce((s, n) => s + n, 0)} سجل`);
    UI.toast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
    return counts;
  },

  exportCsv() {
    const students = Storage.list(Storage.KEYS.students);
    const headers = ['الاسم', 'الصف', 'الشعبة', 'المادة', 'المجموعة', 'ولي الأمر', 'رقم ولي الأمر', 'الاشتراك', 'الحالة'];
    const rows = students.map(s => {
      const g = Storage.find(Storage.KEYS.groups, s.groupId);
      return [s.name, s.className, s.section, s.subject, g ? g.name : '', s.parentName, s.parentPhone, s.subscriptionAmount, s.status];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c == null ? '' : c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moallemy-students-${Utils.today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('تم تصدير بيانات الطلاب', 'success');
  },

  /**
   * استيراد: يقرأ الملف ويبحث الملف ويطلب تأكيدًا مزدوجًا حسب الوضع
   */
  importDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const validation = Storage.validateBackup(ev.target.result);
        if (!validation.valid) {
          UI.toast(validation.error, 'error', 4000);
          return;
        }

        const studentCount = validation.counts.students || 0;
        const exported = validation.exportedAt ? new Date(validation.exportedAt).toLocaleDateString('ar-EG') : 'غير معروف';

        // اختيار وضع الاستيراد
        UI.modal({
          title: 'استيراد نسخة احتياطية',
          body: `
            <div class="card" style="margin-bottom: var(--space-3);">
              <div style="font-weight:700; margin-bottom: var(--space-2);">محتوى الملف</div>
              <div style="font-size:var(--font-size-sm); color:var(--text-secondary); line-height:1.8;">
                تاريخ النسخة: ${exported}<br>
                إصدار البيانات: ${Utils.escapeHTML(validation.version)}<br>
                الطلاب: ${studentCount} • المجموعات: ${validation.counts.groups || 0}<br>
                الدرجات: ${validation.counts.grades || 0} • الحضور: ${validation.counts.attendance || 0} • المدفوعات: ${validation.counts.payments || 0}
              </div>
            </div>
            <div class="alert alert-warning" style="margin-bottom: var(--space-3);">
              <div class="alert-icon">${Icons.get('warn', 18)}</div>
              <div class="alert-body" style="font-size:var(--font-size-xs);">وضع "الاستبدال" يمسح كل بياناتك الحالية قبل الاستيراد. وضع "الدمج" يضيف السجلات الجديدة فقط دون مسح الموجود.</div>
            </div>
            <div class="action-row">
              <button class="btn btn-secondary" id="imp-merge" style="flex:1;">${Icons.get('database', 16)} دمج</button>
              <button class="btn btn-danger" id="imp-replace" style="flex:1;">${Icons.get('warn', 16)} استبدال الكل</button>
            </div>
          `
        });

        document.getElementById('imp-merge').addEventListener('click', () => {
          UI.closeModal();
          UI.confirm(
            'سيتم دمج سجلات الملف مع بياناتك الحالية (لا يوجد حذف). متابعة؟',
            () => this.doImport(ev.target.result, 'merge'),
            { title: 'تأكيد الدمج', confirmText: 'دمج', danger: false }
          );
        });

        document.getElementById('imp-replace').addEventListener('click', () => {
          UI.closeModal();
          UI.confirm(
            'تحذير نهائي: سيتم مسح جميع بياناتك الحالية واستبدالها بمحتوى الملف. لا يمكن التراجع. ننصح بأخذ نسخة احتياطية أولًا. متابعة؟',
            () => this.doImport(ev.target.result, 'replace'),
            { title: 'تأكيد الاستبدال', confirmText: 'استبدال نهائي' }
          );
        });
      };
      reader.readAsText(file);
    });
    input.click();
  },

  doImport(json, mode) {
    if (Storage.importAll(json, mode)) {
      Storage.audit('استيراد نسخة احتياطية', mode === 'merge' ? 'دمج' : 'استبدال');
      UI.toast('تم استيراد البيانات بنجاح', 'success');
      setTimeout(() => location.reload(), 1200);
    } else {
      UI.toast('فشل الاستيراد - الملف غير صالح', 'error');
    }
  },

  lastBackupText() {
    const meta = Storage.getMeta();
    if (!meta.lastBackupAt) return 'لم يتم إنشاء نسخة احتياطية من هذا الجهاز بعد';
    return `آخر نسخة احتياطية: ${UI.relativeTime(meta.lastBackupAt)}`;
  }
};

window.Backup = Backup;
