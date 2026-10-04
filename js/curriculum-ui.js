/* ============================================
   مُعلّمي | js/curriculum-ui.js
   نظام المناهج الدراسية — واجهة المستخدم
   --------------------------------------------
   - صفحة "المناهج": تصفح المراحل ← الصف ← الترم ← المادة ← الكتب
   - صفحة "منهجي": متابعة ما يدرسه المدرس وتقدم المنهج
   - نافذة الكتاب: فتح/تحميل/مفضلة/خطة تدريس/امتحان AI
   - منتقي المنهج (CurriculumUI.pick) المستخدم في:
     الدروس، الواجبات، الامتحانات، الذكاء الاصطناعي
   التصميم متوافق تمامًا مع هوية مُعلّمي (RTL / Cairo / بطاقات)
   ============================================ */

const CurriculumUI = (function () {
  'use strict';

  // حالة التصفح الحالية للصفحة
  const browseState = {
    stageId: '', gradeId: '', term: '', subjectId: '', query: '',
    tab: 'books'   // books | favorites
  };

  const myState = { bookId: '' };

  // شريط الحالة للكتالوج
  function metaBadges() {
    const cat = CurriculumData.catalog();
    const m = cat.meta || {};
    const originLabel = { bundled: 'نسخة رسمية مدمجة', cache: 'نسخة محفوظة', cloud: 'محدثة من السحابة', imported: 'مستوردة', empty: 'لا توجد بيانات' }[m.origin] || 'نسخة محفوظة';
    return `
      <div class="curriculum-sync-bar">
        <span class="curriculum-sync-dot" title="${esc(originLabel)}"></span>
        <span>المصدر: وزارة التربية والتعليم</span>
        ${m.academicYear ? `<span class="badge badge-info">${esc(m.academicYear)}</span>` : ''}
        <span class="badge">${(cat.books || []).length} كتاب</span>
        <span class="curriculum-sync-state">${esc(originLabel)}</span>
      </div>
    `;
  }

  // شعار المادة (أيقونة تقديرية بالحروف الأولى — عرض فقط)
  function subjectInitial(subject) {
    return String(subject || 'ك').trim().charAt(0);
  }

  // غلاف الكتاب (تدرج لوني من هوية التطبيق — الصور غير متاحة من البوابة)
  function coverHTML(b, size) {
    return `
      <div class="cur-book-cover ${size === 'sm' ? 'sm' : ''}">
        <div class="cur-book-cover-spine"></div>
        <div class="cur-book-cover-body">
          <span class="cur-book-cover-letter">${esc(subjectInitial(b.subject))}</span>
          <span class="cur-book-cover-subject">${esc(b.subject)}</span>
          <span class="cur-book-cover-grade">${esc(b.grade)}</span>
        </div>
      </div>
    `;
  }

  // ============ صفحة المناهج ============
  function render() {
    const stages = CurriculumData.stages();
    const grades = browseState.stageId ? CurriculumData.grades(browseState.stageId) : [];
    const subjects = (browseState.stageId && browseState.gradeId) ? CurriculumData.subjectsFor(browseState.stageId, browseState.gradeId) : [];
    const terms = (browseState.gradeId) ? CurriculumData.termsFor(browseState.stageId, browseState.gradeId, browseState.subjectId) : [];

    const favCount = CurriculumData.favorites().filter(f => f.itemType === 'book').length;

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">المناهج</h1>
          <p class="page-subtitle">الكتب المدرسية الرسمية — وزارة التربية والتعليم</p>
        </div>
        <button class="btn btn-secondary btn-sm" data-cur-action="sync" title="تحديث الكتالوج">
          ${Icons.get('refresh', 16)}
        </button>
      </div>

      ${metaBadges()}

      <div class="search-bar curriculum-search">
        ${Icons.get('search', 18)}
        <input type="search" id="cur-search" placeholder="ابحث عن كتاب أو مادة أو درس... مثال: الكسور" value="${esc(browseState.query)}">
      </div>

      <div class="tabs" id="cur-tabs">
        <button class="tab active" data-ctab="books">الكتب</button>
        <button class="tab" data-ctab="favorites">المفضلة (${favCount})</button>
        <button class="tab" data-ctab="plan">خطط التدريس</button>
      </div>

      <div id="cur-tab-content"></div>
    `;
  }

  function bind() {
    // ضمان تحميل الكتالوج قبل العرض (العرض الأول قد يسبق اكتمال التحميل)
    CurriculumData.load().then(() => {
      if (!CurriculumData.stages().length) return;
      const el = document.getElementById('cur-tab-content');
      if (el && !document.querySelector('.cur-stage-card') && browseState.tab === 'books' && browseState.query.length < 2) {
        renderTabContent();
      }
    });

    // البحث
    const searchInput = document.getElementById('cur-search');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        browseState.query = e.target.value;
        if (browseState.query.trim().length >= 2) {
          renderSearchResults(browseState.query.trim());
        } else if (browseState.tab === 'books') {
          renderBrowseSection();
        }
      }, 220));
    }

    // التبويبات
    document.querySelectorAll('#cur-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#cur-tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
        browseState.tab = tab.dataset.ctab;
        renderTabContent();
      });
    });

    // زر التحديث
    document.querySelectorAll('[data-cur-action="sync"]').forEach(btn => {
      btn.addEventListener('click', () => doSync());
    });

    renderTabContent();
  }

  function renderTabContent() {
    const el = document.getElementById('cur-tab-content');
    if (!el) return;
    if (browseState.tab === 'books') {
      el.innerHTML = `<div id="cur-browse"></div>`;
      renderBrowseSection();
    } else if (browseState.tab === 'favorites') {
      renderFavorites(el);
    } else {
      renderPlans(el);
    }
  }

  // ----- تصفح الكتب (فلاتر متسلسلة) -----
  function renderBrowseSection() {
    const el = document.getElementById('cur-browse');
    if (!el) return;

    const stages = CurriculumData.stages();
    const grades = browseState.stageId ? CurriculumData.grades(browseState.stageId) : [];
    const subjects = (browseState.stageId && browseState.gradeId) ? CurriculumData.subjectsFor(browseState.stageId, browseState.gradeId) : [];
    const terms = browseState.gradeId ? CurriculumData.termsFor(browseState.stageId, browseState.gradeId, browseState.subjectId) : [];

    let filtersHTML = `
      <div class="cur-filter-section">
        <p class="cur-filter-label">١ — اختر المرحلة التعليمية</p>
        <div class="cur-stage-grid">
          ${stages.map(s => `
            <button class="cur-stage-card ${browseState.stageId === s.id ? 'active' : ''}" data-cur-stage="${s.id}">
              <span class="cur-stage-icon">${Icons.get('book', 20)}</span>
              <span>${esc(s.title)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    if (browseState.stageId) {
      filtersHTML += `
        <div class="cur-filter-section">
          <p class="cur-filter-label">٢ — اختر الصف الدراسي</p>
          <div class="cur-chips">
            <button class="chip ${!browseState.gradeId ? 'active' : ''}" data-cur-grade="">الكل</button>
            ${grades.map(g => `
              <button class="chip ${browseState.gradeId === g.id ? 'active' : ''}" data-cur-grade="${g.id}">${esc(g.title)}</button>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (browseState.gradeId) {
      filtersHTML += `
        <div class="cur-filter-row">
          <div class="cur-filter-section half">
            <p class="cur-filter-label">٣ — الفصل الدراسي</p>
            <div class="cur-chips">
              <button class="chip ${!browseState.term ? 'active' : ''}" data-cur-term="">الكل</button>
              ${terms.map(t => `
                <button class="chip ${browseState.term === t ? 'active' : ''}" data-cur-term="${esc(t)}">${esc(termLabel(t))}</button>
              `).join('')}
            </div>
          </div>
          <div class="cur-filter-section half">
            <p class="cur-filter-label">٤ — المادة</p>
            <div class="cur-chips">
              <button class="chip ${!browseState.subjectId ? 'active' : ''}" data-cur-subject="">الكل</button>
              ${subjects.map(s => `
                <button class="chip ${browseState.subjectId === s.id ? 'active' : ''}" data-cur-subject="${s.id}">${esc(s.title)}</button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    const books = CurriculumData.booksFor({
      stageId: browseState.stageId || null,
      gradeId: browseState.gradeId || null,
      subjectId: browseState.subjectId || null,
      term: browseState.term || null
    }).sort((a, b) => (a.subject || '').localeCompare(b.subject || '', 'ar'));

    let booksHTML;
    if (!browseState.stageId) {
      booksHTML = UI.emptyState('📚', 'اختر المرحلة التعليمية', 'حدد المرحلة لعرض الصفوف والكتب الرسمية المتاحة');
    } else if (!browseState.gradeId) {
      booksHTML = UI.emptyState('🎒', 'اختر الصف الدراسي', 'حدد الصف لعرض المواد والكتب الخاصة به');
    } else if (!books.length) {
      booksHTML = UI.emptyState('🔍', 'لا توجد كتب مطابقة', 'جرّب توسيع الاختيار: أزل فلتر المادة أو الترم');
    } else {
      booksHTML = `
        <p class="cur-results-count">${books.length} كتاب متاح</p>
        <div class="cur-books-grid">${books.map(b => bookCard(b)).join('')}</div>
      `;
    }

    el.innerHTML = filtersHTML + `<div class="cur-books-area">${booksHTML}</div>`;
    bindBrowseEvents();
  }

  // اسم عرض مختصر للترم
  function termLabel(t) {
    if (/اول|أول/.test(t)) return 'الترم الأول';
    if (/ثان/.test(t)) return 'الترم الثاني';
    return t;
  }

  function bookCard(b) {
    const isFav = CurriculumData.isFavorite('book', b.id);
    const prog = CurriculumData.bookProgress(b.id);
    const hasPlan = prog.total > 0;
    return `
      <div class="cur-book-card ${isFav ? 'fav' : ''}" data-cur-book="${b.id}">
        ${coverHTML(b)}
        <div class="cur-book-info">
          <h3 class="cur-book-title">${esc(b.subject)}</h3>
          <p class="cur-book-meta">${esc(b.grade)}</p>
          <p class="cur-book-meta sub">${esc(termLabel(b.term))} • ${esc(b.type)}</p>
          <div class="cur-book-badges">
            ${b.academicYear ? `<span class="badge badge-info">${esc(b.academicYear)}</span>` : ''}
            ${hasPlan ? `<span class="badge ${prog.pct >= 80 ? 'badge-success' : prog.pct > 0 ? 'badge-warning' : ''}">${prog.pct}% مُنجز</span>` : ''}
            ${isFav ? '<span class="badge badge-gold">مفضلة ★</span>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  function bindBrowseEvents() {
    document.querySelectorAll('[data-cur-stage]').forEach(el => {
      el.addEventListener('click', () => {
        browseState.stageId = el.dataset.curStage;
        browseState.gradeId = ''; browseState.subjectId = ''; browseState.term = '';
        renderBrowseSection();
      });
    });
    document.querySelectorAll('[data-cur-grade]').forEach(el => {
      el.addEventListener('click', () => {
        browseState.gradeId = el.dataset.curGrade;
        browseState.subjectId = ''; browseState.term = '';
        renderBrowseSection();
      });
    });
    document.querySelectorAll('[data-cur-term]').forEach(el => {
      el.addEventListener('click', () => {
        browseState.term = el.dataset.curTerm;
        renderBrowseSection();
      });
    });
    document.querySelectorAll('[data-cur-subject]').forEach(el => {
      el.addEventListener('click', () => {
        browseState.subjectId = el.dataset.curSubject;
        renderBrowseSection();
      });
    });
    document.querySelectorAll('[data-cur-book]').forEach(el => {
      el.addEventListener('click', () => openBook(el.dataset.curBook));
    });
  }

  // ----- نتائج البحث -----
  function renderSearchResults(q) {
    const el = document.getElementById('cur-tab-content');
    if (!el) return;
    const r = CurriculumData.search(q);

    if (!r.books.length && !r.lessons.length) {
      el.innerHTML = UI.emptyState('🔍', 'لا توجد نتائج', `لا توجد كتب أو دروس تطابق "${q}" — جرّب كلمة أخرى`);
      return;
    }

    let html = `
      <div class="cur-search-back"><button class="btn btn-text btn-sm" data-cur-clear="1">← رجوع للتصفح</button></div>
    `;

    if (r.books.length) {
      html += `
        <p class="cur-filter-label">الكتب (${r.books.length})</p>
        <div class="cur-books-grid">${r.books.map(b => bookCard(b)).join('')}</div>
      `;
    }

    if (r.lessons.length) {
      html += `<p class="cur-filter-label" style="margin-top:var(--space-5)">الوحدات والدروس (${r.lessons.length})</p><div class="list">`;
      r.lessons.forEach(hit => {
        if (hit.type === 'lesson') {
          const l = hit.lesson;
          const book = CurriculumData.book(l.bookId);
          const taught = CurriculumData.isLessonTaught(l.id);
          html += `
            <div class="list-item clickable" data-cur-lesson="${l.id}">
              <div class="quick-action-icon ${taught ? 'success' : ''}">${Icons.get('book', 18)}</div>
              <div class="list-item-body">
                <div class="list-item-title">${esc(l.title)}</div>
                <div class="list-item-subtitle">${book ? esc(book.subject + ' — ' + book.grade) : ''} • درس</div>
              </div>
              ${taught ? '<span class="badge badge-success">تم تدريسه</span>' : ''}
            </div>
          `;
        } else {
          const u = hit.unit;
          const book = CurriculumData.book(u.bookId);
          const p = CurriculumData.unitProgress(u.id);
          html += `
            <div class="list-item clickable" data-cur-unit="${u.id}">
              <div class="quick-action-icon">${Icons.get('lessons', 18)}</div>
              <div class="list-item-body">
                <div class="list-item-title">${esc(u.title)}</div>
                <div class="list-item-subtitle">${book ? esc(book.subject + ' — ' + book.grade) : ''} • ${p.done}/${p.total} درس</div>
              </div>
            </div>
          `;
        }
      });
      html += '</div>';
    }

    el.innerHTML = html;
    el.querySelectorAll('[data-cur-clear]').forEach(b => b.addEventListener('click', () => {
      browseState.query = '';
      renderTabContent();
      const si = document.getElementById('cur-search');
      if (si) si.value = '';
    }));
    el.querySelectorAll('[data-cur-book]').forEach(e => e.addEventListener('click', () => openBook(e.dataset.curBook)));
    el.querySelectorAll('[data-cur-lesson]').forEach(e => e.addEventListener('click', () => {
      const l = CurriculumData.lesson(e.dataset.curLesson);
      if (l) openPlanModal(l.bookId);
    }));
    el.querySelectorAll('[data-cur-unit]').forEach(e => e.addEventListener('click', () => {
      const u = CurriculumData.unit(e.dataset.curUnit);
      if (u) openPlanModal(u.bookId);
    }));
  }

  // ----- المفضلة -----
  function renderFavorites(el) {
    const favs = CurriculumData.favorites().filter(f => f.itemType === 'book');
    if (!favs.length) {
      el.innerHTML = UI.emptyState('⭐', 'لا توجد مفضلات بعد', 'أضف الكتب المهمة لك من صفحة الكتاب لتظهر هنا — لكل حساب مدرس على حدة');
      return;
    }
    const books = favs.map(f => CurriculumData.book(f.itemId)).filter(Boolean);
    el.innerHTML = `
      <div class="cur-books-grid">${books.map(b => bookCard(b)).join('')}</div>
    `;
    el.querySelectorAll('[data-cur-book]').forEach(e => e.addEventListener('click', () => openBook(e.dataset.curBook)));
  }

  // ----- خطط التدريس -----
  function renderPlans(el) {
    const booksWithPlan = {};
    CurriculumData.unitsAll().forEach(u => { booksWithPlan[u.bookId] = true; });
    const favs = CurriculumData.favorites().filter(f => f.itemType === 'book');
    favs.forEach(f => { if (CurriculumData.book(f.itemId)) booksWithPlan[f.itemId] = booksWithPlan[f.itemId] || false; });

    const ids = Object.keys(booksWithPlan);
    if (!ids.length) {
      el.innerHTML = UI.emptyState('📖', 'لا توجد خطط تدريس', 'افتح أي كتاب واضغط "إعداد خطة التدريس" لبناء الوحدات والدروس ومتابعة تقدمك');
      return;
    }
    el.innerHTML = `<div class="list stagger">${ids.map(id => {
      const b = CurriculumData.book(id);
      if (!b) return '';
      const p = CurriculumData.bookProgress(id);
      const ln = CurriculumData.bookLastNext(id);
      return `
        <div class="list-item clickable" data-plan-book="${b.id}">
          ${coverHTML(b, 'sm')}
          <div class="list-item-body">
            <div class="list-item-title">${esc(b.subject)} — ${esc(b.grade)}</div>
            <div class="list-item-subtitle">${esc(termLabel(b.term))} • ${p.total ? p.pct + '% مُنجز' : 'لم تبدأ بعد'}</div>
            ${p.total ? `
              <div class="cur-progress-track"><div class="cur-progress-fill" style="width:${p.pct}%"></div></div>
            ` : ''}
            ${ln.last ? `<div class="cur-plan-last">آخر درس: ${esc(ln.last.title)}</div>` : ''}
            ${ln.next ? `<div class="cur-plan-next">الدرس القادم: ${esc(ln.next.title)}</div>` : ''}
          </div>
          ${Icons.get('forward', 18)}
        </div>
      `;
    }).join('')}</div>`;
    el.querySelectorAll('[data-plan-book]').forEach(e => e.addEventListener('click', () => openPlanModal(e.dataset.planBook)));
  }

  // ============ نافذة الكتاب ============
  function openBook(bookId) {
    const b = CurriculumData.book(bookId);
    if (!b) { UI.toast('الكتاب غير موجود', 'error'); return; }

    const isFav = CurriculumData.isFavorite('book', b.id);
    const prog = CurriculumData.bookProgress(b.id);
    const hasPlan = prog.total > 0;
    const stage = CurriculumData.stageById(b.stageId);

    UI.modal({
      title: 'الكتاب الرسمي',
      size: 'large',
      body: `
        <div class="cur-book-detail">
          <div class="cur-book-detail-cover">${coverHTML(b)}</div>
          <div class="cur-book-detail-info">
            <h2 class="cur-book-detail-title">${esc(b.subject)}</h2>
            <div class="cur-book-detail-rows">
              <div><span>المرحلة</span><b>${esc(stage ? stage.title : b.stage)}</b></div>
              <div><span>الصف</span><b>${esc(b.grade)}</b></div>
              <div><span>الفصل الدراسي</span><b>${esc(termLabel(b.term))}</b></div>
              <div><span>نوع الكتاب</span><b>${esc(b.type)}</b></div>
              ${b.academicYear ? `<div><span>العام الدراسي</span><b>${esc(b.academicYear)}</b></div>` : ''}
              <div><span>المصدر</span><b>وزارة التربية والتعليم</b></div>
            </div>
            ${hasPlan ? `
              <div class="cur-progress-block">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                  <span>تقدمك في المنهج</span><b>${prog.pct}% (${prog.done}/${prog.total} درس)</b>
                </div>
                <div class="cur-progress-track"><div class="cur-progress-fill" style="width:${prog.pct}%"></div></div>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="cur-book-actions">
          <a class="btn btn-primary" href="${esc(b.pdfUrl)}" target="_blank" rel="noopener">
            ${Icons.get('eye', 16)} فتح الكتاب
          </a>
          <a class="btn btn-secondary" href="${esc(b.pdfUrl)}" target="_blank" rel="noopener" download>
            ${Icons.get('download', 16)} تحميل الكتاب
          </a>
        </div>
        <p class="cur-book-source-note">
          ${Icons.get('shield', 13)} يُفتح الكتاب من الخادم الرسمي لوزارة التربية والتعليم مباشرة — لا تُخزَّن ملفات PDF داخل التطبيق.
        </p>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn ${isFav ? 'btn-danger' : 'btn-secondary'}" id="cur-fav-btn" style="flex:1">
            ${isFav ? '★ إزالة من المفضلة' : '☆ إضافة للمفضلة'}
          </button>
          <button class="btn btn-primary" id="cur-plan-btn" style="flex:1.4">
            ${Icons.get('lessons', 16)} ${hasPlan ? 'عرض خطة التدريس' : 'إعداد خطة التدريس'}
          </button>
          <button class="btn btn-gold" id="cur-ai-btn" style="flex:1.2">
            ✨ امتحان AI
          </button>
        </div>
      `
    });

    document.getElementById('cur-fav-btn')?.addEventListener('click', () => {
      const added = CurriculumData.toggleFavorite('book', b.id, {
        title: b.title, subject: b.subject, grade: b.grade, term: b.term
      });
      UI.toast(added ? 'أُضيف الكتاب للمفضلة ★' : 'أُزيل الكتاب من المفضلة', 'success');
      setTimeout(() => { UI.closeModal(); openBook(b.id); }, 350);
      if (App.currentPage === 'curriculum') App.navigate('curriculum');
    });

    document.getElementById('cur-plan-btn')?.addEventListener('click', () => openPlanModal(b.id));

    document.getElementById('cur-ai-btn')?.addEventListener('click', () => {
      UI.closeModal();
      setTimeout(() => {
        if (window.AIGenerator) AIGenerator.openGenerator({ curriculumBookId: b.id });
        else UI.toast('وحدة الذكاء الاصطناعي غير محملة', 'warning');
      }, 200);
    });
  }

  // ============ خطة التدريس (الوحدات والدروس + التقدم) ============
  function openPlanModal(bookId) {
    const b = CurriculumData.book(bookId);
    if (!b) return;

    const bookUnits = CurriculumData.units(bookId);
    const groups = Storage.list(Storage.KEYS.groups);
    const prog = CurriculumData.bookProgress(bookId);

    const unitsHTML = bookUnits.length ? bookUnits.map((u, ui) => {
      const up = CurriculumData.unitProgress(u.id);
      const ls = CurriculumData.lessons(u.id);
      return `
        <div class="cur-unit-block" data-unit="${u.id}">
          <div class="cur-unit-header">
            <div class="cur-unit-title">
              <b>${esc(u.title)}</b>
              ${up.total ? `<span class="badge ${up.pct >= 80 ? 'badge-success' : up.pct > 0 ? 'badge-warning' : ''}">${up.pct}%</span>` : '<span class="badge">لا دروس</span>'}
            </div>
            <div class="cur-unit-actions">
              <button class="btn btn-text btn-sm" data-add-lesson="${u.id}">${Icons.get('plus', 14)} درس</button>
              <button class="btn btn-text btn-sm danger" data-del-unit="${u.id}">${Icons.get('trash', 14)}</button>
            </div>
          </div>
          ${up.total ? `<div class="cur-progress-track sm"><div class="cur-progress-fill" style="width:${up.pct}%"></div></div>` : ''}
          ${ls.length ? `<div class="cur-lessons-list">
            ${ls.map((l, li) => {
              const taught = CurriculumData.isLessonTaught(l.id);
              return `
                <div class="cur-lesson-row ${taught ? 'taught' : ''}" data-lesson="${l.id}">
                  <button class="cur-lesson-check ${taught ? 'done' : ''}" data-toggle-lesson="${l.id}" title="تحديد كتم تدريسه">
                    ${taught ? Icons.get('check', 13) : ''}
                  </button>
                  <div class="cur-lesson-title">
                    <span>${esc(l.title)}</span>
                    ${taught ? '<span class="cur-taught-date">✓ تم التدريس</span>' : ''}
                  </div>
                  <div class="cur-lesson-actions">
                    <button class="btn btn-text btn-sm" data-lesson-group="${l.id}" title="تحديد المجموعة">👥</button>
                    <button class="btn btn-text btn-sm danger" data-del-lesson="${l.id}">${Icons.get('trash', 13)}</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>` : '<p class="cur-lessons-empty">لا توجد دروس — أضف دروس هذه الوحدة لتتمكن من متابعة التقدم</p>'}
        </div>
      `;
    }).join('') : UI.emptyState('🗂', 'لا توجد وحدات بعد', 'أضف وحدات الكتاب ودروسه لمتابعة تقدم المنهج — (فهرس الوحدات غير متاح رقميًا من البوابة الرسمية، لذا يبنيه المدرس بنفسه)');

    UI.modal({
      title: `خطة التدريس — ${b.subject} (${b.grade})`,
      size: 'large',
      body: `
        <div class="cur-plan-summary">
          <div class="cur-progress-block">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
              <span>إجمالي تقدم المنهج</span><b>${prog.pct}% (${prog.done}/${prog.total} درس)</b>
            </div>
            <div class="cur-progress-track"><div class="cur-progress-fill" style="width:${prog.pct}%"></div></div>
          </div>
          <button class="btn btn-primary btn-sm" id="cur-add-unit">${Icons.get('plus', 14)} إضافة وحدة</button>
        </div>

        <div class="cur-units-wrap">${unitsHTML}</div>

        <div class="cur-plan-tools">
          <p class="cur-plan-tools-title">إضافات سريعة:</p>
          <div class="cur-chips">
            <button class="chip" data-quick-units="4">الوحدات 1-4</button>
            <button class="chip" data-quick-units="6">الوحدات 1-6</button>
            <button class="chip" data-quick-lessons="3">3 دروس لكل وحدة</button>
          </div>
        </div>
      `
    });

    // ---- ربط الأحداث ----
    document.getElementById('cur-add-unit')?.addEventListener('click', () => addUnitDialog(bookId, () => openPlanModal(bookId)));

    document.querySelectorAll('[data-add-lesson]').forEach(btn => {
      btn.addEventListener('click', () => {
        const unitId = btn.dataset.addLesson;
        addLessonDialog(unitId, bookId, () => openPlanModal(bookId));
      });
    });

    document.querySelectorAll('[data-del-unit]').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.confirm('سيتم حذف الوحدة وكل دروسها. متابعة؟', () => {
          CurriculumData.removeUnit(btn.dataset.delUnit);
          UI.toast('حُذفت الوحدة', 'success');
          openPlanModal(bookId);
        });
      });
    });

    document.querySelectorAll('[data-del-lesson]').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.confirm('حذف هذا الدرس من خطة التدريس؟', () => {
          CurriculumData.removeLesson(btn.dataset.delLesson);
          UI.toast('حُذف الدرس', 'success');
          openPlanModal(bookId);
        });
      });
    });

    // تحديد "تم التدريس" — يطلب اختيار مجموعة (ربط المنهج بالطلاب)
    document.querySelectorAll('[data-toggle-lesson]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lessonId = btn.dataset.toggleLesson;
        const l = CurriculumData.lesson(lessonId);
        if (!l) return;
        if (CurriculumData.isLessonTaught(lessonId)) {
          // إلغاء التدريس (عام — كل المجموعات)
          CurriculumData.toggleLessonTaught(lessonId, null);
          UI.toast('أُلغيت علامة التدريس', 'info');
          openPlanModal(bookId);
        } else {
          if (groups.length) pickGroupForLesson(l, groups, bookId);
          else {
            CurriculumData.toggleLessonTaught(lessonId, null, { bookId: l.bookId, unitId: l.unitId });
            UI.toast('تم تحديد الدرس كمُدَّرس ✓', 'success');
            openPlanModal(bookId);
          }
        }
      });
    });

    document.querySelectorAll('[data-lesson-group]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lessonId = btn.dataset.lessonGroup;
        const l = CurriculumData.lesson(lessonId);
        if (!l) return;
        pickGroupForLesson(l, groups, bookId, true);
      });
    });

    // إضافات سريعة (أدوات مساعدة للإدخال — ليست بيانات منهج)
    document.querySelectorAll('[data-quick-units]').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.quickUnits, 10);
        const ar = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];
        const existing = CurriculumData.units(bookId).length;
        for (let i = 0; i < n; i++) {
          const idx = existing + i;
          if (idx >= ar.length) break;
          CurriculumData.addUnit(bookId, `الوحدة ${ar[idx]}`, idx);
        }
        UI.toast('أُضيفت الوحدات — أضف دروسها الآن', 'success');
        openPlanModal(bookId);
      });
    });
    document.querySelectorAll('[data-quick-lessons]').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.quickLessons, 10);
        const bookUnits = CurriculumData.units(bookId);
        if (!bookUnits.length) { UI.toast('أضف وحدات أولًا', 'warning'); return; }
        bookUnits.forEach(u => {
          const existing = CurriculumData.lessons(u.id).length;
          for (let i = 0; i < n; i++) CurriculumData.addLesson(u.id, bookId, `الدرس ${existing + i + 1}`);
        });
        UI.toast('أُضيفت الدروس', 'success');
        openPlanModal(bookId);
      });
    });
  }

  function pickGroupForLesson(l, groups, bookId, silentToggle) {
    UI.modal({
      title: 'تحديد المجموعة للدرس',
      body: `
        <p style="color:var(--text-secondary); font-size:13px; margin-bottom:var(--space-3);">
          الدرس: <b>${esc(l.title)}</b><br>اختر المجموعة التي دُرِّس لها هذا الدرس ليُسجل التقدم لكل مجموعة.
        </p>
        <div class="list">
          <div class="list-item clickable" data-g="">
            <div class="list-item-body"><div class="list-item-title">بدون مجموعة (عام)</div></div>
          </div>
          ${groups.map(g => `
            <div class="list-item clickable" data-g="${g.id}">
              <div class="quick-action-icon">${Icons.get('groups', 18)}</div>
              <div class="list-item-body"><div class="list-item-title">${esc(g.name)}</div></div>
            </div>
          `).join('')}
        </div>
      `
    });
    document.querySelectorAll('[data-g]').forEach(el => {
      el.addEventListener('click', () => {
        CurriculumData.toggleLessonTaught(l.id, el.dataset.g || null, { bookId: l.bookId, unitId: l.unitId });
        UI.toast('تم التسجيل ✓', 'success');
        UI.closeModal();
        // إعادة فتح خطة التدريس لمتابعة التقدم
        setTimeout(() => openPlanModal(bookId), 250);
      });
    });
  }

  function addUnitDialog(bookId, onDone) {
    UI.modal({
      title: 'إضافة وحدة',
      body: `
        <form id="cur-add-unit-form">
          <div class="field">
            <label>عنوان الوحدة <span class="required">*</span></label>
            <input type="text" name="title" required placeholder="مثال: الوحدة الأولى — الأعداد والعمليات">
          </div>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });
    document.getElementById('cur-add-unit-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = new FormData(e.target).get('title');
      CurriculumData.addUnit(bookId, title);
      UI.toast('أُضيفت الوحدة', 'success');
      UI.closeModal();
      if (onDone) onDone();
    });
  }

  function addLessonDialog(unitId, bookId, onDone) {
    UI.modal({
      title: 'إضافة درس',
      body: `
        <form id="cur-add-lesson-form">
          <div class="field">
            <label>عنوان الدرس <span class="required">*</span></label>
            <input type="text" name="title" required placeholder="مثال: الدرس الأول — جمع الكسور">
          </div>
          <div class="field">
            <label>وصف مختصر (اختياري)</label>
            <textarea name="description" rows="2" placeholder="نقاط الدرس الرئيسية..."></textarea>
          </div>
          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">حفظ</button>
          </div>
        </form>
      `
    });
    document.getElementById('cur-add-lesson-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      CurriculumData.addLesson(unitId, bookId, fd.get('title'), fd.get('description'));
      UI.toast('أُضيف الدرس', 'success');
      UI.closeModal();
      if (onDone) onDone();
    });
  }

  // ============ التحديث من السحابة ============
  async function doSync() {
    if (!(window.SupabaseConfig && SupabaseConfig.isReady())) {
      UI.toast('الكتالوج المحلي محدث — المزامنة السحابية تتطلب تسجيل الدخول', 'info');
      return;
    }
    UI.toast('جاري تحديث المناهج...', 'info', 1600);
    try {
      const r = await CurriculumData.refreshFromCloud({ silent: false });
      if (r.ok) {
        UI.toast(r.updated ? 'تم تحديث المناهج من السحابة ✓' : 'البيانات لديك محدثة بالفعل ✓', 'success');
        if (App.currentPage === 'curriculum') App.navigate('curriculum');
      } else {
        UI.toast(r.msg || 'تعذر تحديث المناهج حاليًا. سيتم استخدام آخر بيانات محفوظة.', 'warning', 3500);
      }
    } catch (e) {
      UI.toast('تعذر تحديث المناهج حاليًا. سيتم استخدام آخر بيانات محفوظة.', 'warning', 3500);
    }
  }

  // ============ منتقي المنهج الموحد (للدروس/الواجبات/الامتحانات/AI) ============
  /**
   * CurriculumUI.pick({ withLessons, multiLessons, title })
   * نافذة متسلسلة: المرحلة ← الصف ← الترم ← المادة ← الكتاب ← الوحدة ← الدرس/الدروس
   * تُعرض في طبقة منفصلة فوق النافذة الحالية حتى لا يفقد المدرس ما كتبه في النموذج.
   * تعيد Promise بالاختيار:
   * { stageId, gradeId, term, subjectId, bookId, unitId, lessonIds[], book }
   * أو null عند الإلغاء.
   */
  function pick(options) {
    const opts = options || {};
    return new Promise((resolve) => {
      const sel = { stageId: '', gradeId: '', term: '', subjectId: '', bookId: '', unitId: '', lessonIds: [] };

      // دفعات اختيار سريعة من كتب المدرس المُعدّة
      const setupBooks = {};
      CurriculumData.unitsAll().forEach(u => { setupBooks[u.bookId] = true; });
      const quickIds = Object.keys(setupBooks);

      // طبقة منفصلة فوق النافذة الحالية (لا تستبدل النموذج المفتوح)
      const layer = document.createElement('div');
      layer.className = 'cur-picker-layer';
      layer.innerHTML = `
        <div class="cur-picker-overlay"></div>
        <div class="modal-content" role="dialog" aria-modal="true">
          <div class="modal-handle"></div>
          <div class="modal-header">
            <h3 class="modal-title">${esc(opts.title || 'ربط بالمنهج الرسمي')}</h3>
            <button class="modal-close" aria-label="إغلاق">×</button>
          </div>
          <div class="modal-body"></div>
        </div>
      `;
      document.body.appendChild(layer);

      const body = layer.querySelector('.modal-body');
      const finish = (result) => {
        layer.remove();
        resolve(result);
      };
      layer.querySelector('.modal-close').addEventListener('click', () => finish(null));
      layer.querySelector('.cur-picker-overlay').addEventListener('click', () => finish(null));

      function stepHTML() {
        const stage = CurriculumData.stageById(sel.stageId);
        const grades = sel.stageId ? CurriculumData.grades(sel.stageId) : [];
        const terms = sel.gradeId ? CurriculumData.termsFor(sel.stageId, sel.gradeId, sel.subjectId) : [];
        const subjects = (sel.stageId && sel.gradeId) ? CurriculumData.subjectsFor(sel.stageId, sel.gradeId) : [];
        const books = (sel.stageId && sel.gradeId) ? CurriculumData.booksFor({
          stageId: sel.stageId, gradeId: sel.gradeId,
          subjectId: sel.subjectId || null, term: sel.term || null
        }) : [];
        const book = sel.bookId ? CurriculumData.book(sel.bookId) : null;
        const units = sel.bookId ? CurriculumData.units(sel.bookId) : [];
        const lessons = sel.unitId ? CurriculumData.lessons(sel.unitId) : [];

        let html = `<div class="cur-picker">

          <div class="cur-picker-crumb">
            ${stage ? `<span class="badge badge-info">${esc(stage.title)}</span>` : ''}
            ${sel.gradeId ? `<span class="badge">${esc((CurriculumData.gradeById(sel.gradeId) || {}).title || '')}</span>` : ''}
            ${sel.term ? `<span class="badge">${esc(termLabel(sel.term))}</span>` : ''}
            ${sel.subjectId ? `<span class="badge">${esc((CurriculumData.subjectById(sel.subjectId) || {}).title || '')}</span>` : ''}
            ${book ? `<span class="badge badge-gold">${esc(book.subject)} — ${esc(book.grade)}</span>` : ''}
            ${sel.unitId ? `<span class="badge">${esc((CurriculumData.unit(sel.unitId) || {}).title || '')}</span>` : ''}
          </div>

          ${quickIds.length && !sel.stageId ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">كتبك المُعدّة (اختيار سريع)</p>
              <div class="cur-chips">
                ${quickIds.slice(0, 6).map(id => {
                  const b = CurriculumData.book(id);
                  return b ? `<button class="chip" data-quick-book="${b.id}">${esc(b.subject)} — ${esc(b.grade)}</button>` : '';
                }).join('')}
              </div>
              <p class="cur-filter-label" style="margin-top:var(--space-3)">أو تصفح الكل</p>
            </div>` : ''}

          ${!sel.stageId ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">المرحلة التعليمية</p>
              <div class="cur-stage-grid">
                ${CurriculumData.stages().map(s => `
                  <button class="cur-stage-card ${sel.stageId === s.id ? 'active' : ''}" data-p-stage="${s.id}">
                    <span class="cur-stage-icon">${Icons.get('book', 18)}</span><span>${esc(s.title)}</span>
                  </button>`).join('')}
              </div>
            </div>` : ''}

          ${sel.stageId && !sel.gradeId ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">الصف الدراسي</p>
              <div class="cur-chips">
                ${grades.map(g => `<button class="chip" data-p-grade="${g.id}">${esc(g.title)}</button>`).join('')}
              </div>
            </div>` : ''}

          ${sel.gradeId && !sel.term ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">الفصل الدراسي</p>
              <div class="cur-chips">
                ${terms.map(t => `<button class="chip" data-p-term="${esc(t)}">${esc(termLabel(t))}</button>`).join('')}
              </div>
            </div>` : ''}

          ${sel.term && !sel.subjectId ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">المادة</p>
              <div class="cur-chips">
                ${subjects.map(s => `<button class="chip" data-p-subject="${s.id}">${esc(s.title)}</button>`).join('')}
              </div>
            </div>` : ''}

          ${sel.subjectId && !sel.bookId ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">الكتاب</p>
              <div class="list">
                ${books.map(b => `
                  <div class="list-item clickable" data-p-book="${b.id}">
                    ${coverHTML(b, 'sm')}
                    <div class="list-item-body">
                      <div class="list-item-title">${esc(b.subject)}</div>
                      <div class="list-item-subtitle">${esc(b.grade)} • ${esc(termLabel(b.term))} • ${esc(b.type)}</div>
                    </div>
                  </div>`).join('')}
              </div>
            </div>` : ''}

          ${opts.withLessons && book && !sel.unitId ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">الوحدة</p>
              ${units.length ? `<div class="cur-chips">
                ${units.map(u => `<button class="chip" data-p-unit="${u.id}">${esc(u.title)}</button>`).join('')}
              </div>` : '<p class="cur-lessons-empty">لا توجد وحدات مُعدّة لهذا الكتاب — سيتم الربط على مستوى الكتاب فقط</p>'}
              <div style="margin-top:var(--space-2)">
                <button class="btn btn-text btn-sm" data-p-skipunit="1">${units.length ? 'ربط بالكتاب كاملًا (بدون وحدة)' : 'متابعة'}</button>
              </div>
            </div>` : ''}

          ${opts.withLessons && sel.unitId && !sel.lessonIds.length ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">${opts.multiLessons ? 'الدروس (اختر واحدًا أو أكثر)' : 'الدرس'}</p>
              <div class="cur-chips">
                ${lessons.map(l => `<button class="chip" data-p-lesson="${l.id}">${esc(l.title)}</button>`).join('')}
              </div>
              <div style="margin-top:var(--space-2)">
                <button class="btn btn-text btn-sm" data-p-skiplesson="1">ربط بالوحدة كاملة (بدون درس محدد)</button>
              </div>
            </div>` : ''}

          ${opts.multiLessons && sel.lessonIds.length ? `
            <div class="cur-filter-section">
              <p class="cur-filter-label">الدروس المختارة (${sel.lessonIds.length})</p>
              <div class="cur-chips">
                ${sel.lessonIds.map(id => {
                  const l = CurriculumData.lesson(id);
                  return l ? `<button class="chip active" data-p-unlesson="${id}">${esc(l.title)} ✕</button>` : '';
                }).join('')}
              </div>
            </div>` : ''}
        </div>`;
        return html;
      }

      function renderStep() {
        if (!document.body.contains(layer)) return;
        body.innerHTML = stepHTML() + `
          <div class="action-row" style="margin-top:var(--space-4)">
            <button class="btn btn-secondary" id="cur-pick-cancel" style="flex:1">إلغاء</button>
            <button class="btn btn-primary" id="cur-pick-ok" style="flex:1.4" ${sel.bookId ? '' : 'disabled'}>
              تأكيد الربط
            </button>
          </div>
        `;

        body.querySelectorAll('[data-quick-book]').forEach(el => el.addEventListener('click', () => {
          const b = CurriculumData.book(el.dataset.quickBook);
          if (!b) return;
          Object.assign(sel, { stageId: b.stageId, gradeId: b.gradeId, term: b.term, subjectId: b.subjectId, bookId: b.id, unitId: '', lessonIds: [] });
          renderStep();
        }));

        body.querySelectorAll('[data-p-stage]').forEach(el => el.addEventListener('click', () => {
          sel.stageId = el.dataset.pStage; sel.gradeId = sel.term = ''; sel.subjectId = ''; sel.bookId = ''; sel.unitId = ''; sel.lessonIds = [];
          renderStep();
        }));
        body.querySelectorAll('[data-p-grade]').forEach(el => el.addEventListener('click', () => {
          sel.gradeId = el.dataset.pGrade; sel.term = ''; sel.subjectId = ''; sel.bookId = ''; sel.unitId = ''; sel.lessonIds = [];
          renderStep();
        }));
        body.querySelectorAll('[data-p-term]').forEach(el => el.addEventListener('click', () => {
          sel.term = el.dataset.pTerm; sel.subjectId = ''; sel.bookId = ''; sel.unitId = ''; sel.lessonIds = [];
          renderStep();
        }));
        body.querySelectorAll('[data-p-subject]').forEach(el => el.addEventListener('click', () => {
          sel.subjectId = el.dataset.pSubject; sel.bookId = ''; sel.unitId = ''; sel.lessonIds = [];
          renderStep();
        }));
        body.querySelectorAll('[data-p-book]').forEach(el => el.addEventListener('click', () => {
          sel.bookId = el.dataset.pBook; sel.unitId = ''; sel.lessonIds = [];
          renderStep();
        }));
        body.querySelectorAll('[data-p-unit]').forEach(el => el.addEventListener('click', () => {
          sel.unitId = el.dataset.pUnit; sel.lessonIds = [];
          renderStep();
        }));
        body.querySelectorAll('[data-p-skipunit]').forEach(el => el.addEventListener('click', () => finish({
          stageId: sel.stageId, gradeId: sel.gradeId, term: sel.term,
          subjectId: sel.subjectId, bookId: sel.bookId, unitId: '',
          lessonIds: [], book: CurriculumData.book(sel.bookId)
        })));
        body.querySelectorAll('[data-p-skiplesson]').forEach(el => el.addEventListener('click', () => finish({
          stageId: sel.stageId, gradeId: sel.gradeId, term: sel.term,
          subjectId: sel.subjectId, bookId: sel.bookId, unitId: sel.unitId,
          lessonIds: [], book: CurriculumData.book(sel.bookId)
        })));
        body.querySelectorAll('[data-p-lesson]').forEach(el => el.addEventListener('click', () => {
          if (opts.multiLessons) {
            const id = el.dataset.pLesson;
            if (!sel.lessonIds.includes(id)) sel.lessonIds.push(id);
            renderStep();
          } else {
            sel.lessonIds = [el.dataset.pLesson];
            body.querySelector('#cur-pick-ok')?.click();
          }
        }));
        body.querySelectorAll('[data-p-unlesson]').forEach(el => el.addEventListener('click', () => {
          sel.lessonIds = sel.lessonIds.filter(x => x !== el.dataset.pUnlesson);
          renderStep();
        }));

        body.querySelector('#cur-pick-cancel').addEventListener('click', () => finish(null));
        body.querySelector('#cur-pick-ok').addEventListener('click', () => {
          if (!sel.bookId) return;
          finish({
            stageId: sel.stageId, gradeId: sel.gradeId, term: sel.term,
            subjectId: sel.subjectId, bookId: sel.bookId, unitId: sel.unitId,
            lessonIds: sel.lessonIds.slice(),
            book: CurriculumData.book(sel.bookId)
          });
        });
      }

      renderStep();
    });
  }

  // عرض مرجع منهج محفوظ كنص مختصر
  function refLabel(ref) {
    if (!ref) return '';
    const parts = [];
    if (ref.bookId) {
      const b = CurriculumData.book(ref.bookId);
      if (b) parts.push(`${b.subject} — ${b.grade}`, termLabel(b.term));
    } else {
      if (ref.grade) parts.push(ref.grade);
      if (ref.subject) parts.push(ref.subject);
      if (ref.term) parts.push(termLabel(ref.term));
    }
    if (ref.unitId) {
      const u = CurriculumData.unit(ref.unitId);
      if (u) parts.push(u.title);
    }
    if (ref.lessonId) {
      const l = CurriculumData.lesson(ref.lessonId);
      if (l) parts.push(l.title);
    }
    return parts.join(' • ');
  }

  // ============ صفحة "منهجي" ============
  function renderMyCurriculum() {
    const unitsAll = CurriculumData.unitsAll();
    const setupBookIds = Array.from(new Set(unitsAll.map(u => u.bookId)));
    const favs = CurriculumData.favorites().filter(f => f.itemType === 'book' && CurriculumData.book(f.itemId));
    const groups = Storage.list(Storage.KEYS.groups);
    const lessonsAll = CurriculumData.lessonsAll();
    const exams = Storage.list(Storage.KEYS.exams);
    const assignments = Storage.list(Storage.KEYS.assignments);

    const progressEntries = CurriculumData.progress();
    const recentTaught = progressEntries
      .filter(p => p.groupId)
      .sort((a, b) => (b.taughtDate || '').localeCompare(a.taughtDate || ''))
      .slice(0, 5);

    return `
      <div class="page-header">
        <div>
          <h1 class="page-title">منهجي</h1>
          <p class="page-subtitle">متابعة ما أدرّسه من المناهج الرسمية</p>
        </div>
      </div>

      ${metaBadges()}

      <div class="stats-grid" style="margin: var(--space-4) 0;">
        <div class="stat-card primary">
          <div class="stat-value">${setupBookIds.length}</div>
          <div class="stat-label">كتاب قيد التدريس</div>
        </div>
        <div class="stat-card success">
          <div class="stat-value">${progressEntries.length}</div>
          <div class="stat-label">درس تم تدريسه</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-value">${favs.length}</div>
          <div class="stat-label">كتاب مفضل</div>
        </div>
      </div>

      ${recentTaught.length ? `
        <div class="section-header" style="margin-bottom: var(--space-3);">
          <h3 class="section-title">آخر ما دُرِّس للمجموعات</h3>
        </div>
        <div class="list">
          ${recentTaught.map(p => {
            const l = CurriculumData.lesson(p.lessonId);
            const b = CurriculumData.book(p.bookId);
            const g = p.groupId ? Storage.find(Storage.KEYS.groups, p.groupId) : null;
            return `
              <div class="list-item">
                <div class="quick-action-icon success">${Icons.get('check', 18)}</div>
                <div class="list-item-body">
                  <div class="list-item-title">${l ? esc(l.title) : 'درس محذوف'}</div>
                  <div class="list-item-subtitle">${b ? esc(b.subject + ' — ' + b.grade) : ''} ${g ? '• ' + esc(g.name) : ''} ${p.taughtDate ? '• ' + UI.formatDate(p.taughtDate) : ''}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}

      <div class="section-header" style="margin: var(--space-5) 0 var(--space-3);">
        <h3 class="section-title">كتاباتي قيد التدريس</h3>
      </div>
      ${setupBookIds.length ? `
        <div class="list stagger">
          ${setupBookIds.map(id => {
            const b = CurriculumData.book(id);
            if (!b) return '';
            const p = CurriculumData.bookProgress(id);
            const ln = CurriculumData.bookLastNext(id);
            const linkedExams = exams.filter(e => e.curriculum && e.curriculum.bookId === id).length;
            const linkedAssignments = assignments.filter(a => a.curriculum && a.curriculum.bookId === id).length;
            return `
              <div class="list-item clickable" data-open-plan="${b.id}">
                ${coverHTML(b, 'sm')}
                <div class="list-item-body">
                  <div class="list-item-title">${esc(b.subject)} — ${esc(b.grade)}</div>
                  <div class="list-item-subtitle">${esc(termLabel(b.term))}</div>
                  <div class="cur-progress-track"><div class="cur-progress-fill" style="width:${p.pct}%"></div></div>
                  <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                    <span class="badge ${p.pct >= 80 ? 'badge-success' : p.pct > 0 ? 'badge-warning' : ''}">${p.pct}% (${p.done}/${p.total})</span>
                    ${linkedExams ? `<span class="badge badge-info">${linkedExams} اختبار</span>` : ''}
                    ${linkedAssignments ? `<span class="badge">${linkedAssignments} واجب</span>` : ''}
                  </div>
                  ${ln.last ? `<div class="cur-plan-last">آخر درس: ${esc(ln.last.title)}</div>` : ''}
                  ${ln.next && ln.next.id !== (ln.last && ln.last.id) ? `<div class="cur-plan-next">الدرس القادم: ${esc(ln.next.title)}</div>` : ''}
                </div>
                ${Icons.get('forward', 18)}
              </div>
            `;
          }).join('')}
        </div>
      ` : UI.emptyState('📖', 'ابدأ بإعداد منهجك', 'افتح قسم المناهج، اختر كتابك، واضغط "إعداد خطة التدريس" لبناء الوحدات والدروس')}

      ${favs.length ? `
        <div class="section-header" style="margin: var(--space-5) 0 var(--space-3);">
          <h3 class="section-title">المفضلة</h3>
        </div>
        <div class="cur-books-grid">
          ${favs.map(f => {
            const b = CurriculumData.book(f.itemId);
            return b ? `
              <div class="cur-book-card" data-open-book="${b.id}">
                ${coverHTML(b)}
                <div class="cur-book-info">
                  <h3 class="cur-book-title">${esc(b.subject)}</h3>
                  <p class="cur-book-meta">${esc(b.grade)} • ${esc(termLabel(b.term))}</p>
                </div>
              </div>
            ` : '';
          }).join('')}
        </div>
      ` : ''}
    `;
  }

  function bindMyCurriculum() {
    document.querySelectorAll('[data-open-plan]').forEach(el => {
      el.addEventListener('click', () => openPlanModal(el.dataset.openPlan));
    });
    document.querySelectorAll('[data-open-book]').forEach(el => {
      el.addEventListener('click', () => openBook(el.dataset.openBook));
    });
  }

  // ============ قسم اختيار مصدر الواجب (مدمج في نموذج الواجبات) ============
  function assignmentSourceSection() {
    return `
      <div class="field">
        <label>مصدر الواجب</label>
        <div class="cur-chips" id="cur-assign-source">
          <button type="button" class="chip active" data-src="custom">درس مخصص / محتوى المدرس</button>
          <button type="button" class="chip" data-src="curriculum">منهج الوزارة</button>
        </div>
      </div>
      <div id="cur-assign-curriculum" class="hidden"></div>
    `;
  }

  function bindAssignmentSource(onPicked) {
    const container = document.getElementById('cur-assign-source');
    const target = document.getElementById('cur-assign-curriculum');
    if (!container || !target) return null;
    let ref = null;

    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        const src = chip.dataset.src;
        if (src === 'curriculum') {
          pick({ withLessons: true, multiLessons: false, title: 'ربط الواجب بالمنهج' }).then(r => {
            if (r) {
              ref = r;
              target.classList.remove('hidden');
              target.innerHTML = `
                <div class="cur-ref-chip">
                  ${Icons.get('book', 14)}
                  <span>${esc(refLabel({ bookId: r.bookId, unitId: r.unitId, lessonId: r.lessonIds[0] }))}</span>
                  <button type="button" class="cur-ref-clear" title="تغيير">✕</button>
                </div>
              `;
              target.querySelector('.cur-ref-clear')?.addEventListener('click', () => {
                ref = null;
                target.classList.add('hidden');
                target.innerHTML = '';
                container.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.src === 'custom'));
              });
            } else {
              container.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.src === 'custom'));
            }
          });
        } else {
          ref = null;
          target.classList.add('hidden');
          target.innerHTML = '';
        }
      });
    });

    return { getRef: () => ref };
  }

  // ============ قسم ربط الدرس بالمنهج (نموذج الحصص) ============
  function lessonLinkSection() {
    return `
      <div class="field">
        <label>ربط بالمنهج (اختياري)</label>
        <button type="button" class="btn btn-secondary btn-sm" id="cur-lesson-link-btn" style="width:100%">
          ${Icons.get('book', 15)} اختر من المناهج الرسمية
        </button>
        <div id="cur-lesson-ref"></div>
      </div>
    `;
  }

  function bindLessonLink() {
    const btn = document.getElementById('cur-lesson-link-btn');
    const target = document.getElementById('cur-lesson-ref');
    if (!btn || !target) return null;
    let ref = null;
    btn.addEventListener('click', () => {
      pick({ withLessons: true, multiLessons: false, title: 'ربط الحصة بالمنهج' }).then(r => {
        if (!r) return;
        ref = r;
        target.innerHTML = `
          <div class="cur-ref-chip">
            ${Icons.get('book', 14)}
            <span>${esc(refLabel({ bookId: r.bookId, unitId: r.unitId, lessonId: r.lessonIds[0] }))}</span>
            <button type="button" class="cur-ref-clear" title="إزالة">✕</button>
          </div>
        `;
        target.querySelector('.cur-ref-clear')?.addEventListener('click', () => { ref = null; target.innerHTML = ''; });
      });
    });
    return { getRef: () => ref };
  }

  // ============ قسم المنهج في نموذج الامتحان ============
  function examCurriculumSection() {
    return `
      <div class="field">
        <label>المنهج (اختياري — يربط الامتحان بالمنهج الرسمي)</label>
        <button type="button" class="btn btn-secondary btn-sm" id="cur-exam-link-btn" style="width:100%">
          ${Icons.get('book', 15)} اختر المرحلة والصف والمادة والدروس
        </button>
        <div id="cur-exam-ref"></div>
      </div>
    `;
  }

  function bindExamCurriculum() {
    const btn = document.getElementById('cur-exam-link-btn');
    const target = document.getElementById('cur-exam-ref');
    if (!btn || !target) return null;
    let ref = null;
    btn.addEventListener('click', () => {
      pick({ withLessons: true, multiLessons: true, title: 'ربط الامتحان بالمنهج' }).then(r => {
        if (!r) return;
        ref = r;
        const lessonsTitles = r.lessonIds.map(id => (CurriculumData.lesson(id) || {}).title).filter(Boolean);
        target.innerHTML = `
          <div class="cur-ref-chip multi">
            ${Icons.get('book', 14)}
            <span>${esc(refLabel({ bookId: r.bookId, unitId: r.unitId }))}${lessonsTitles.length ? '<br>الدروس: ' + esc(lessonsTitles.join('، ')) : ''}</span>
            <button type="button" class="cur-ref-clear" title="إزالة">✕</button>
          </div>
        `;
        target.querySelector('.cur-ref-clear')?.addEventListener('click', () => { ref = null; target.innerHTML = ''; });
      });
    });
    return { getRef: () => ref };
  }

  // ============ قسم مصدر المنهج في مولد AI ============
  function aiSourceSection(defaultBookId) {
    const defaultBook = defaultBookId ? CurriculumData.book(defaultBookId) : null;
    return `
      <div class="field">
        <label>مصدر الأسئلة</label>
        <div class="cur-chips" id="cur-ai-source">
          <button type="button" class="chip ${!defaultBook ? 'active' : ''}" data-src="general">موضوع حر</button>
          <button type="button" class="chip ${defaultBook ? 'active' : ''}" data-src="curriculum">منهج الوزارة الرسمي</button>
        </div>
      </div>
      <div id="cur-ai-curriculum" class="${defaultBook ? '' : 'hidden'}">
        ${defaultBook ? `
          <div class="cur-ref-chip">
            ${Icons.get('book', 14)}
            <span>${esc(defaultBook.subject)} — ${esc(defaultBook.grade)} • ${esc(termLabel(defaultBook.term))}</span>
            <button type="button" class="cur-ref-clear" title="تغيير">✕</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function bindAiSource(defaultBookId) {
    const container = document.getElementById('cur-ai-source');
    const target = document.getElementById('cur-ai-curriculum');
    if (!container || !target) return { getSel: () => null };

    let sel = defaultBookId && CurriculumData.book(defaultBookId) ? {
      bookId: defaultBookId,
      book: CurriculumData.book(defaultBookId),
      unitId: '', lessonIds: []
    } : null;

    if (defaultBookId) {
      // عرض اختيار الوحدة/الدروس مباشرة للكتاب المحدد مسبقًا
      renderAiScope(target, sel, s => { sel = s; });
    }

    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        if (chip.dataset.src === 'curriculum') {
          pick({ withLessons: true, multiLessons: true, title: 'توليد أسئلة من المنهج الرسمي' }).then(r => {
            if (r) {
              sel = r;
              target.classList.remove('hidden');
              renderAiScope(target, sel, s => { sel = s; });
            } else {
              chip.classList.remove('active');
              container.querySelector('[data-src="general"]')?.classList.add('active');
            }
          });
        } else {
          sel = null;
          target.classList.add('hidden');
          target.innerHTML = '';
        }
      });
    });

    return { getSel: () => sel };
  }

  function renderAiScope(target, sel, setSel) {
    if (!sel || !sel.bookId) return;
    const units = CurriculumData.units(sel.bookId);
    const b = CurriculumData.book(sel.bookId);
    target.innerHTML = `
      <div class="cur-ref-chip">
        ${Icons.get('book', 14)}
        <span>${b ? esc(b.subject + ' — ' + b.grade + ' • ' + termLabel(b.term)) : ''}</span>
        <button type="button" class="cur-ref-clear" title="تغيير">✕</button>
      </div>
      ${units.length ? `
        <div class="cur-filter-section" style="margin-top:var(--space-2)">
          <p class="cur-filter-label">حدّد الوحدة والدروس (اختياري — لتركيز التوليد)</p>
          <div class="cur-chips">
            ${units.map(u => `<button class="chip ${sel.unitId === u.id ? 'active' : ''}" data-ai-unit="${u.id}">${esc(u.title)}</button>`).join('')}
          </div>
          ${sel.unitId ? (() => {
            const ls = CurriculumData.lessons(sel.unitId);
            return ls.length ? `
              <div class="cur-chips" style="margin-top:var(--space-2)">
                ${ls.map(l => `
                  <button class="chip ${sel.lessonIds.includes(l.id) ? 'active' : ''}" data-ai-lesson="${l.id}">${esc(l.title)}</button>
                `).join('')}
              </div>
            ` : '';
          })() : ''}
        </div>
      ` : ''}
    `;
    target.querySelector('.cur-ref-clear')?.addEventListener('click', () => {
      setSel(null);
      target.classList.add('hidden');
      target.innerHTML = '';
      document.querySelectorAll('#cur-ai-source .chip').forEach(c => c.classList.toggle('active', c.dataset.src === 'general'));
    });
    target.querySelectorAll('[data-ai-unit]').forEach(el => el.addEventListener('click', () => {
      sel.unitId = sel.unitId === el.dataset.aiUnit ? '' : el.dataset.aiUnit;
      sel.lessonIds = [];
      setSel(Object.assign({}, sel));
      renderAiScope(target, sel, setSel);
    }));
    target.querySelectorAll('[data-ai-lesson]').forEach(el => el.addEventListener('click', () => {
      const id = el.dataset.aiLesson;
      if (sel.lessonIds.includes(id)) sel.lessonIds = sel.lessonIds.filter(x => x !== id);
      else sel.lessonIds.push(id);
      setSel(Object.assign({}, sel));
      renderAiScope(target, sel, setSel);
    }));
  }

  return {
    render, bind, renderMyCurriculum, bindMyCurriculum,
    openBook, openPlanModal, pick, refLabel,
    assignmentSourceSection, bindAssignmentSource,
    lessonLinkSection, bindLessonLink,
    examCurriculumSection, bindExamCurriculum,
    aiSourceSection, bindAiSource,
    doSync, browseState, myState,
    coverHTML, termLabel, subjectInitial, metaBadges
  };
})();

window.CurriculumUI = CurriculumUI;
