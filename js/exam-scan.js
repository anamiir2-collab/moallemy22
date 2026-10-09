/* ============================================
   مُعلّمي | exam-scan.js
   مسح أوراق الاختبارات بالكاميرا + OCR + تقييم بموافقة المدرس
   ============================================

   يستخدم:
   - getUserMedia لالتقاط الصور من الكاميرا
   - Tesseract.js (محمل من CDN) للتعرّف الضوئي على الحروف — يعمل بالكامل في المتصفح
   - لا يتم رفع صور الطلاب لأي خادم خارجي ما لم يفعّل المدرس ذلك صراحةً

   ملاحظات:
   - التعرّف على المعادلات الرياضية اليدوية محدود — يجب مراجعة كل درجة يدويًا.
   - لا يتم منح درجة نهائية تلقائيًا — كل درجة تخضع لموافقة المدرس.
   ============================================ */

const ExamScan = (function () {

  let stream = null;
  let capturedImage = null;

  // ===== Open scan workflow =====
  function openScanner(prefillExamId = '') {
    const exams = Storage.list(Storage.KEYS.exams);
    if (exams.length === 0) {
      UI.toast('أنشئ اختبارًا أولًا قبل المسح', 'warning');
      return;
    }
    const students = Storage.list(Storage.KEYS.students, s => s.status === 'نشط');
    if (students.length === 0) {
      UI.toast('لا يوجد طلاب نشطون', 'warning');
      return;
    }

    UI.modal({
      title: 'مسح ورقة اختبار',
      size: 'large',
      body: `
        <form id="scan-setup-form">
          <div class="field">
            <label>الاختبار <span class="required">*</span></label>
            <select name="examId" required>
              ${exams.map(e => {
                const g = Storage.find(Storage.KEYS.groups, e.groupId);
                return `<option value="${e.id}" ${e.id === prefillExamId ? 'selected' : ''}>${e.name}${g ? ' — ' + g.name : ''}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="field">
            <label>الطالب <span class="required">*</span></label>
            <select name="studentId" required>
              ${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>

          <div class="alert alert-info" style="margin: var(--space-3) 0;">
            <div class="alert-icon">ℹ️</div>
            <div class="alert-body" style="font-size: var(--font-size-sm);">
              سنستخدم كاميرا الجهاز لالتقاط صورة ورقة الاختبار، ثم نطبّق التعرّف الضوئي على الحروف (OCR)
              محليًا في المتصفح — صورة الطالب لا تُرفع لأي خادم خارجي.
              <br>
              <strong>ملاحظة:</strong> التعرّف على الكتابة اليدوية الرياضية محدود، ويجب مراجعة كل درجة يدويًا قبل الحفظ.
            </div>
          </div>

          <div class="action-row">
            <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
            <button type="submit" class="btn btn-primary" style="flex:1">التالي ← الكاميرا</button>
          </div>
        </form>
      `
    });

    document.getElementById('scan-setup-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const examId = fd.get('examId');
      const studentId = fd.get('studentId');
      UI.closeModal();
      setTimeout(() => openCameraCapture(examId, studentId), 200);
    });
  }

  // ===== Camera capture step =====
  function openCameraCapture(examId, studentId) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      UI.toast('المتصفح لا يدعم الكاميرا — يمكنك رفع صورة بدلاً من ذلك', 'warning');
      openUploadFallback(examId, studentId);
      return;
    }

    UI.modal({
      title: 'التقاط صورة لورقة الاختبار',
      size: 'large',
      body: `
        <div class="alert alert-warning" style="margin-bottom: var(--space-3);">
          <div class="alert-icon">📷</div>
          <div class="alert-body" style="font-size: var(--font-size-sm);">
            سيتطلب المتصفح إذنًا للوصول إلى الكاميرا. الصورة تُلتقط محليًا ولا تُرفع لأي خادم.
          </div>
        </div>

        <div style="background: #000; border-radius: var(--radius-md); overflow: hidden; aspect-ratio: 3/4; max-width: 100%; display:flex; align-items:center; justify-content:center;">
          <video id="camera-video" autoplay playsinline style="width:100%; height:100%; object-fit: cover;"></video>
          <canvas id="capture-canvas" style="display:none;"></canvas>
        </div>

        <div id="captured-preview" style="margin-top: var(--space-3); display:none;">
          <img id="captured-image" style="width:100%; border-radius: var(--radius-md);" alt="captured">
        </div>

        <div class="action-row" style="margin-top: var(--space-3);">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
          <button type="button" class="btn btn-outline" id="upload-instead-btn" style="flex:1;">رفع صورة</button>
          <button type="button" class="btn btn-primary" id="capture-btn" style="flex:1;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            التقاط
          </button>
        </div>

        <div id="capture-actions" style="display:none; margin-top: var(--space-3);">
          <div class="action-row">
            <button type="button" class="btn btn-secondary" id="retake-btn" style="flex:1;">إعادة الالتقاط</button>
            <button type="button" class="btn btn-outline" id="rotate-btn" style="flex:1;">تدوير</button>
            <button type="button" class="btn btn-primary" id="use-photo-btn" style="flex:1;">استخدام ← OCR</button>
          </div>
        </div>
      `
    });

    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('capture-canvas');
    const capturedImg = document.getElementById('captured-image');
    const capturedPreview = document.getElementById('captured-preview');
    const captureActions = document.getElementById('capture-actions');
    const captureBtn = document.getElementById('capture-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const rotateBtn = document.getElementById('rotate-btn');
    const usePhotoBtn = document.getElementById('use-photo-btn');
    const uploadInsteadBtn = document.getElementById('upload-instead-btn');

    let rotation = 0;
    capturedImage = null;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
      audio: false
    }).then(s => {
      stream = s;
      video.srcObject = s;
    }).catch(err => {
      UI.toast('تعذّر الوصول للكاميرا: ' + (err.message || 'مرفوض'), 'error', 4000);
      setTimeout(() => {
        UI.closeModal();
        openUploadFallback(examId, studentId);
      }, 500);
    });

    captureBtn.addEventListener('click', () => {
      if (!video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);
      applyRotation();
      capturedImage = canvas.toDataURL('image/jpeg', 0.85);
      capturedImg.src = capturedImage;
      capturedPreview.style.display = 'block';
      captureActions.style.display = 'flex';
      captureBtn.style.display = 'none';
      // Stop the camera stream
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      video.style.display = 'none';
    });

    function applyRotation() {
      if (rotation === 0) return;
      const ctx = canvas.getContext('2d');
      const newCanvas = document.createElement('canvas');
      const newCtx = newCanvas.getContext('2d');
      newCanvas.width = canvas.height;
      newCanvas.height = canvas.width;
      newCtx.translate(newCanvas.width / 2, newCanvas.height / 2);
      newCtx.rotate(rotation * Math.PI / 180);
      newCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      canvas.width = newCanvas.width;
      canvas.height = newCanvas.height;
      ctx.drawImage(newCanvas, 0, 0);
    }

    retakeBtn.addEventListener('click', () => {
      capturedImage = null;
      capturedPreview.style.display = 'none';
      captureActions.style.display = 'none';
      captureBtn.style.display = '';
      rotation = 0;
      // Restart camera
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(s => { stream = s; video.srcObject = s; video.style.display = ''; })
        .catch(err => UI.toast('تعذّر إعادة تشغيل الكاميرا', 'error'));
    });

    rotateBtn.addEventListener('click', () => {
      rotation = (rotation + 90) % 360;
      if (capturedImage) {
        // Re-rotate original capture
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          applyRotation();
          capturedImage = canvas.toDataURL('image/jpeg', 0.85);
          capturedImg.src = capturedImage;
        };
        img.src = capturedImage;
      }
    });

    usePhotoBtn.addEventListener('click', async () => {
      if (!capturedImage) return;
      UI.closeModal();
      // Stop stream just in case
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      setTimeout(() => runOCR(examId, studentId, capturedImage), 250);
    });

    uploadInsteadBtn.addEventListener('click', () => {
      UI.closeModal();
      if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      setTimeout(() => openUploadFallback(examId, studentId), 200);
    });
  }

  // ===== Upload fallback (no camera) =====
  function openUploadFallback(examId, studentId) {
    UI.modal({
      title: 'رفع صورة ورقة الاختبار',
      body: `
        <div class="alert alert-info" style="margin-bottom: var(--space-3);">
          <div class="alert-icon">📁</div>
          <div class="alert-body" style="font-size: var(--font-size-sm);">
            ارفع صورة لورقة الاختبار. الصورة تُعالج محليًا في متصفحك — لا تُرفع لأي خادم.
          </div>
        </div>

        <label class="btn btn-primary btn-block" for="upload-input">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          اختر صورة من جهازك
        </label>
        <input type="file" id="upload-input" accept="image/*" style="display:none;">

        <div id="upload-preview" style="margin-top: var(--space-3); display:none;">
          <img id="upload-image" style="width:100%; border-radius: var(--radius-md);" alt="preview">
          <button class="btn btn-primary btn-block" id="use-uploaded-btn" style="margin-top: var(--space-2);">استخدام ← OCR</button>
        </div>

        <button class="btn btn-text btn-block" onclick="UI.closeModal()" style="margin-top: var(--space-3);">إلغاء</button>
      `
    });

    const input = document.getElementById('upload-input');
    const preview = document.getElementById('upload-preview');
    const img = document.getElementById('upload-image');
    const useBtn = document.getElementById('use-uploaded-btn');

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        capturedImage = ev.target.result;
        img.src = capturedImage;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });

    useBtn.addEventListener('click', () => {
      if (!capturedImage) return;
      UI.closeModal();
      setTimeout(() => runOCR(examId, studentId, capturedImage), 200);
    });
  }

  // ===== Run OCR with Tesseract.js =====
  async function runOCR(examId, studentId, imageDataUrl) {
    UI.modal({
      title: 'جارٍ التعرّف على النص...',
      body: `
        <div style="text-align:center; padding: var(--space-5) 0;">
          <div class="spinner-lg"></div>
          <p style="margin-top: var(--space-3); color: var(--text-secondary);">يجري تحليل الصورة محليًا في متصفحك...</p>
          <p style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: var(--space-2);">قد يستغرق ذلك 10-30 ثانية حسب حجم الصورة.</p>
          <div id="ocr-progress" style="margin-top: var(--space-3); background: var(--color-surface-2); border-radius: var(--radius-full); height: 8px; overflow: hidden;">
            <div id="ocr-progress-bar" style="background: var(--color-primary); height: 100%; width: 0; transition: width 0.3s;"></div>
          </div>
          <p id="ocr-status" style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: var(--space-2);">جارٍ تحميل مكوّن التعرّف الضوئي...</p>
        </div>
      `
    });

    try {
      // Lazy-load Tesseract.js from CDN
      if (typeof Tesseract === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js');
      }

      const statusEl = document.getElementById('ocr-status');
      const barEl = document.getElementById('ocr-progress-bar');

      const result = await Tesseract.recognize(
        imageDataUrl,
        'ara+eng',
        {
          logger: m => {
            if (m.status && statusEl) {
              statusEl.textContent = ({
                'loading tesseract core': 'تحميل نواة التعرّف...',
                'initializing tesseract': 'تهيئة...',
                'loading language traineddata': 'تحميل بيانات اللغة العربية...',
                'initializing api': 'تهيئة المحرك...',
                'recognizing text': 'جارٍ التعرّف على النص...'
              })[m.status] || m.status;
            }
            if (m.progress && barEl) {
              barEl.style.width = Math.round(m.progress * 100) + '%';
            }
          }
        }
      );

      const extractedText = (result?.data?.text || '').trim();
      UI.closeModal();
      setTimeout(() => openGradingReview(examId, studentId, extractedText, imageDataUrl), 200);
    } catch (err) {
      UI.closeModal();
      setTimeout(() => {
        UI.modal({
          title: 'تعذّر إجراء التعرّف الضوئي',
          body: `
            <div class="alert alert-warning" style="margin-bottom: var(--space-3);">
              <div class="alert-icon">⚠️</div>
              <div class="alert-body" style="font-size: var(--font-size-sm);">
                تعذّر التعرّف الضوئي على النص (${err.message || 'خطأ غير معروف'}).
                يمكنك إدخال إجابات الطالب يدويًا أو تسجيل الدرجة مباشرة.
              </div>
            </div>
            <div class="action-row">
              <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
              <button class="btn btn-primary" onclick="ExamScan.openManualGrading('${examId}', '${studentId}')" style="flex:1">تسجيل يدوي للدرجة</button>
            </div>
          `
        });
      }, 200);
    }
  }

  // ===== Load script helper =====
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(s);
    });
  }

  // ===== Open grading review (after OCR) =====
  function openGradingReview(examId, studentId, extractedText, imageDataUrl) {
    const exam = Storage.find(Storage.KEYS.exams, examId);
    const student = Storage.find(Storage.KEYS.students, studentId);
    if (!exam || !student) return;

    // Load questions if available
    const questionSet = exam.questionSetId ? AIExam.findQuestionSet(exam.questionSetId) : null;
    const questions = questionSet?.questions || [];

    UI.modal({
      title: 'مراجعة الإجابات وتسجيل الدرجة',
      size: 'large',
      body: `
        <div class="alert alert-info" style="margin-bottom: var(--space-3);">
          <div class="alert-icon">ℹ️</div>
          <div class="alert-body" style="font-size: var(--font-size-sm);">
            راجع النص المستخرج بدقة. التعرّف الضوئي قد يخطئ في الكتابة اليدوية أو الرموز الرياضية.
            <strong>لا يتم حفظ أي درجة تلقائيًا</strong> — يجب عليك تأكيد كل درجة قبل الحفظ.
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3);">
          <div>
            <img src="${imageDataUrl}" style="width:100%; border-radius: var(--radius-md); border: 1px solid var(--color-surface-3);" alt="exam">
          </div>
          <div>
            <div style="font-weight: 700; margin-bottom: var(--space-2);">النص المُستخرَج (OCR):</div>
            <textarea id="ocr-text" rows="10" style="width:100%; font-size: var(--font-size-sm); padding: var(--space-2); background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-sm); direction: rtl;">${(extractedText || '').replace(/</g, '&lt;')}</textarea>
            <p style="font-size: var(--font-size-xs); color: var(--text-tertiary); margin-top: 4px;">يمكنك تعديل النص يدويًا إذا كان به أخطاء.</p>
          </div>
        </div>

        ${questions.length > 0 ? `
          <div style="margin-top: var(--space-4);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-3);">
              <div>
                <div style="font-weight: 700;">الأسئلة والإجابات النموذجية</div>
                <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">قارن إجابة الطالب بكل إجابة نموذجية، ثم اضبط الدرجة.</div>
              </div>
              <span class="badge badge-info">${questions.length} سؤال</span>
            </div>
            <div id="questions-grade-list" style="display:flex; flex-direction:column; gap: var(--space-2);">
              ${questions.map((q, i) => `
                <div class="card" style="padding: var(--space-3); border: 1.5px solid var(--color-surface-3);">
                  <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 8px; margin-bottom: 6px;">
                    <div style="flex:1;">
                      <div style="font-weight:700; font-size: var(--font-size-sm);">سؤال ${i + 1}: ${q.text}</div>
                      <div style="margin-top: 4px; font-size: var(--font-size-xs); color: var(--color-success);">الإجابة النموذجية: ${q.correctAnswer || '— (سؤال مقالي)'}</div>
                      ${q.explanation ? `<div style="margin-top: 4px; font-size: var(--font-size-xs); color: var(--text-tertiary);">معايير: ${q.explanation}</div>` : ''}
                    </div>
                    <span class="badge badge-info">/${q.mark}</span>
                  </div>
                  <div style="display:flex; gap: 4px; align-items:center; margin-top: var(--space-2);">
                    <label style="font-size: var(--font-size-xs); color: var(--text-tertiary); white-space: nowrap;">درجة الطالب:</label>
                    <input type="number" min="0" max="${q.mark}" step="0.5" data-question-grade="${q.id}" value="" placeholder="—" style="width: 70px; padding: 6px; background: var(--color-surface-2); border: 1.5px solid var(--color-surface-3); border-radius: var(--radius-sm); text-align: center; font-weight: 700;">
                    <span style="font-size: var(--font-size-xs); color: var(--text-tertiary);">/ ${q.mark}</span>
                    <button class="btn btn-text btn-sm" data-mark-full="${q.id}" data-max="${q.mark}" style="margin-inline-start: auto;">درجة كاملة</button>
                    <button class="btn btn-text btn-sm" data-mark-zero="${q.id}" style="color: var(--color-danger);">صفر</button>
                    <button class="btn btn-text btn-sm" data-mark-review="${q.id}" style="color: var(--color-warning);">مراجعة</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="card" style="padding: var(--space-3); margin-top: var(--space-4); background: var(--color-surface-2);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--space-2);">
            <div style="font-weight: 700;">الدرجة النهائية</div>
            <div style="font-size: var(--font-size-md); font-weight: 800;">
              <span id="final-score">0</span> / <span id="final-max">${exam.maxGrade}</span>
            </div>
          </div>
          <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">
            النسبة المئوية: <span id="final-percent" style="font-weight:700;">0%</span>
          </div>
        </div>

        <div class="field" style="margin-top: var(--space-3);">
          <label>ملاحظات المدرس</label>
          <textarea id="teacher-notes" rows="2" placeholder="ملاحظات على أداء الطالب..."></textarea>
        </div>

        <div class="alert alert-warning" style="margin-top: var(--space-3);">
          <div class="alert-icon">⚠️</div>
          <div class="alert-body" style="font-size: var(--font-size-sm);">
            بتأكيد الدرجة، يتم حفظها كدرجة للطالب ${student.name} في الاختبار ${exam.name}. لا يمكن منح درجة تلقائيًا بدون موافقتك.
          </div>
        </div>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إلغاء</button>
          <button class="btn btn-primary" id="confirm-grade-btn" style="flex:1">تأكيد وحفظ الدرجة</button>
        </div>
      `
    });

    // Bind grade inputs
    const gradeInputs = document.querySelectorAll('[data-question-grade]');
    const updateTotal = () => {
      let total = 0;
      gradeInputs.forEach(inp => {
        const v = parseFloat(inp.value);
        if (!isNaN(v)) total += v;
      });
      const max = parseFloat(exam.maxGrade) || 0;
      document.getElementById('final-score').textContent = total;
      document.getElementById('final-max').textContent = max;
      const pct = max > 0 ? Math.round((total / max) * 100) : 0;
      document.getElementById('final-percent').textContent = pct + '%';
    };
    gradeInputs.forEach(inp => inp.addEventListener('input', updateTotal));

    // Mark full / zero / review
    document.querySelectorAll('[data-mark-full]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.markFull;
        const max = btn.dataset.max;
        const inp = document.querySelector(`[data-question-grade="${qid}"]`);
        if (inp) { inp.value = max; updateTotal(); }
      });
    });
    document.querySelectorAll('[data-mark-zero]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.markZero;
        const inp = document.querySelector(`[data-question-grade="${qid}"]`);
        if (inp) { inp.value = 0; updateTotal(); }
      });
    });
    document.querySelectorAll('[data-mark-review]').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.markReview;
        const inp = document.querySelector(`[data-question-grade="${qid}"]`);
        if (inp) {
          inp.value = '';
          inp.placeholder = 'يحتاج مراجعة';
          inp.style.borderColor = 'var(--color-warning)';
          updateTotal();
        }
      });
    });

    // Confirm save
    document.getElementById('confirm-grade-btn').addEventListener('click', () => {
      let totalScore = 0;
      let needsReview = false;
      const questionResults = [];
      gradeInputs.forEach(inp => {
        const qid = inp.dataset.questionGrade;
        const q = questions.find(qq => qq.id === qid);
        const v = inp.value.trim();
        if (v === '') {
          needsReview = true;
          questionResults.push({ qid, score: null, status: 'review' });
        } else {
          const score = parseFloat(v);
          if (isNaN(score) || score < 0) {
            needsReview = true;
            questionResults.push({ qid, score: null, status: 'invalid' });
          } else {
            const max = q ? parseFloat(q.mark) : 0;
            const clampedScore = Math.min(score, max);
            totalScore += clampedScore;
            questionResults.push({ qid, score: clampedScore, max, status: clampedScore < max ? 'partial' : 'full' });
          }
        }
      });

      const notes = document.getElementById('teacher-notes').value.trim();
      const doSave = () => {
        // Save grade (compatible with existing grades collection)
        const existing = Storage.list(Storage.KEYS.grades, g => g.examId === examId && g.studentId === studentId)[0];
        let grade;
        if (existing) {
          grade = Storage.update(Storage.KEYS.grades, existing.id, {
            score: totalScore,
            maxGrade: exam.maxGrade,
            notes: notes + (notes ? ' | ' : '') + 'تم التقييم عبر مسح الكاميرا'
          });
        } else {
          grade = Storage.insert(Storage.KEYS.grades, {
            examId,
            studentId,
            groupId: exam.groupId,
            score: totalScore,
            maxGrade: exam.maxGrade,
            notes: notes + (notes ? ' | ' : '') + 'تم التقييم عبر مسح الكاميرا'
          });
        }
        // Save the OCR scan record (with the captured image stored locally)
        const scans = Storage.get('moallemy_exam_scans', []);
        scans.push({
          id: Storage.uid('sc_'),
          examId,
          studentId,
          gradeId: grade.id,
          ocrText: document.getElementById('ocr-text').value,
          imageData: imageDataUrl, // locally stored; never uploaded
          questionResults,
          teacherNotes: notes,
          createdAt: Date.now()
        });
        Storage.set('moallemy_exam_scans', scans);

        UI.toast(`تم حفظ درجة ${student.name}: ${totalScore}/${exam.maxGrade} ✓`, 'success');
        UI.closeModal();
        setTimeout(() => openAssessmentReport(examId, studentId, totalScore, exam.maxGrade, questionResults, notes), 200);
      };

      if (needsReview) {
        UI.confirm(
          'بعض الأسئلة لا تزال بحاجة إلى مراجعة (لم تُمنح درجة). هل تريد حفظ الدرجة النهائية الجزئية على أي حال؟',
          doSave,
          { title: 'مراجعة غير مكتملة', confirmText: 'حفظ الجزئي', danger: false }
        );
      } else {
        doSave();
      }
    });
  }

  // ===== Assessment report =====
  function openAssessmentReport(examId, studentId, score, maxScore, questionResults, teacherNotes) {
    const exam = Storage.find(Storage.KEYS.exams, examId);
    const student = Storage.find(Storage.KEYS.students, studentId);
    const group = exam ? Storage.find(Storage.KEYS.groups, exam.groupId) : null;
    const questionSet = exam?.questionSetId ? AIExam.findQuestionSet(exam.questionSetId) : null;
    const questions = questionSet?.questions || [];

    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const letter = UI.gradeLetter(pct);

    const correctCount = questionResults.filter(r => r.status === 'full').length;
    const partialCount = questionResults.filter(r => r.status === 'partial').length;
    const reviewCount = questionResults.filter(r => r.status === 'review' || r.status === 'invalid').length;

    UI.modal({
      title: 'تقرير تقييم الطالب',
      size: 'large',
      body: `
        <div class="card" style="background: var(--color-surface-2); padding: var(--space-4); margin-bottom: var(--space-3);">
          <div style="text-align:center;">
            <div class="avatar avatar-lg" style="margin: 0 auto var(--space-2);">${UI.initials(student.name)}</div>
            <h3 style="font-weight: 800;">${student.name}</h3>
            <p style="color: var(--text-tertiary); font-size: var(--font-size-sm);">${exam ? exam.name : ''} • ${group ? group.name : ''}</p>
            <div style="margin-top: var(--space-3); display:flex; justify-content:center; gap: var(--space-4);">
              <div>
                <div style="font-size: 28px; font-weight: 800; color: var(--color-${letter.cls === 'success' ? 'success' : (letter.cls === 'warning' ? 'warning' : 'danger')});">${score} / ${maxScore}</div>
                <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">الدرجة</div>
              </div>
              <div>
                <div style="font-size: 28px; font-weight: 800;">${pct}%</div>
                <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">النسبة</div>
              </div>
              <div>
                <div style="font-size: 28px; font-weight: 800; color: var(--color-${letter.cls === 'success' ? 'success' : (letter.cls === 'warning' ? 'warning' : 'danger')});">${letter.label}</div>
                <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">التقدير</div>
              </div>
            </div>
          </div>
        </div>

        <div class="stats-grid" style="margin-bottom: var(--space-3);">
          <div class="stat-card success"><div class="stat-value">${correctCount}</div><div class="stat-label">إجابة صحيحة</div></div>
          <div class="stat-card warning"><div class="stat-value">${partialCount}</div><div class="stat-label">إجابة جزئية</div></div>
          <div class="stat-card danger"><div class="stat-value">${reviewCount}</div><div class="stat-label">تحت مراجعة</div></div>
          <div class="stat-card info"><div class="stat-value">${questions.length}</div><div class="stat-label">إجمالي الأسئلة</div></div>
        </div>

        ${questions.length > 0 ? `
          <div style="margin-top: var(--space-4);">
            <h4 style="font-weight: 700; margin-bottom: var(--space-2);">تفصيل الأسئلة</h4>
            <div class="list">
              ${questions.map((q, i) => {
                const r = questionResults.find(rr => rr.qid === q.id) || {};
                const statusLabel = {
                  full: { label: 'صحيح', cls: 'success' },
                  partial: { label: 'جزئي', cls: 'warning' },
                  review: { label: 'مراجعة', cls: 'warning' },
                  invalid: { label: 'غير صالح', cls: 'danger' }
                }[r.status] || { label: '—', cls: '' };
                return `
                  <div class="list-item">
                    <div class="list-item-body">
                      <div class="list-item-title">سؤال ${i + 1}: ${q.text}</div>
                      <div class="list-item-subtitle">الإجابة النموذجية: ${q.correctAnswer || '—'}</div>
                    </div>
                    <div style="text-align:center;">
                      <div style="font-weight:700;">${r.score !== null && r.score !== undefined ? r.score : '—'} / ${q.mark}</div>
                      <span class="badge badge-${statusLabel.cls}">${statusLabel.label}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${teacherNotes ? `
          <div class="card" style="margin-top: var(--space-3); background: var(--color-surface-2);">
            <div style="font-size: var(--font-size-xs); color: var(--text-tertiary);">ملاحظات المدرس</div>
            <div style="margin-top: var(--space-1);">${teacherNotes}</div>
          </div>
        ` : ''}

        <div class="alert alert-info" style="margin-top: var(--space-3);">
          <div class="alert-icon">💡</div>
          <div class="alert-body" style="font-size: var(--font-size-sm);">
            <strong>نقاط القوة:</strong> ${correctCount} من ${questions.length} إجابات صحيحة (${Math.round(correctCount / Math.max(1, questions.length) * 100)}%).
            <br>
            <strong>نقاط تحتاج تحسين:</strong> ${partialCount + reviewCount} أسئلة تحتاج إلى مراجعة إضافية.
          </div>
        </div>

        <div class="action-row" style="margin-top: var(--space-4);">
          <button class="btn btn-secondary" onclick="UI.closeModal()" style="flex:1">إغلاق</button>
          <button class="btn btn-outline" onclick="window.print()" style="flex:1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            طباعة
          </button>
          <button class="btn btn-primary" id="view-student-btn" style="flex:1;">ملف الطالب</button>
        </div>
      `
    });

    document.getElementById('view-student-btn').addEventListener('click', () => {
      UI.closeModal();
      setTimeout(() => Students.openProfile(studentId), 200);
    });
  }

  // ===== Manual grading entry (no camera) =====
  function openManualGrading(examId, studentId) {
    UI.closeModal();
    setTimeout(() => {
      Exams.openGradeEntry(examId);
      // Pre-select the student if possible — for now, the user will pick the student
    }, 200);
  }

  return {
    openScanner,
    openManualGrading
  };
})();

window.ExamScan = ExamScan;
