// حالة التطبيق
const state = {
  currentUser: localStorage.getItem('activeUser') || 'شريف',
  isServerOnline: false,
  payments: [],
  stats: null,
  activeFilter: 'all',
  selectedFile: null,
  currentRotation: 0
};

// عناصر واجهة المستخدم
const elements = {
  // المستخدم
  btnSherif: document.getElementById('btnUserSherif'),
  btnAbdullah: document.getElementById('btnUserAbdullah'),
  radioSherif: document.getElementById('radioSherif'),
  radioAbdullah: document.getElementById('radioAbdullah'),
  
  // حالة السيرفر
  connectionStatus: document.getElementById('connectionStatus'),
  connectionText: document.getElementById('connectionText'),

  // الإحصائيات
  statTotalPaid: document.getElementById('statTotalPaid'),
  statTotalCount: document.getElementById('statTotalCount'),
  statSherifTotal: document.getElementById('statSherifTotal'),
  statSherifCount: document.getElementById('statSherifCount'),
  statAbdullahTotal: document.getElementById('statAbdullahTotal'),
  statAbdullahCount: document.getElementById('statAbdullahCount'),
  statBalanceStatus: document.getElementById('statBalanceStatus'),
  statBalanceDiff: document.getElementById('statBalanceDiff'),

  // النموذج
  paymentForm: document.getElementById('paymentForm'),
  monthInput: document.getElementById('monthInput'),
  amountInput: document.getElementById('amountInput'),
  methodSelect: document.getElementById('methodSelect'),
  noteInput: document.getElementById('noteInput'),
  receiptFileInput: document.getElementById('receiptFileInput'),
  dropZone: document.getElementById('dropZone'),
  dropPrompt: document.getElementById('dropPrompt'),
  previewContainer: document.getElementById('previewContainer'),
  imagePreview: document.getElementById('imagePreview'),
  btnRemoveImage: document.getElementById('btnRemoveImage'),
  submitBtn: document.getElementById('submitBtn'),

  // جدول الشهور وسجل التحويلات
  matrixTableBody: document.getElementById('matrixTableBody'),
  btnRefreshMatrix: document.getElementById('btnRefreshMatrix'),
  transactionsGrid: document.getElementById('transactionsGrid'),
  transactionsCountBadge: document.getElementById('transactionsCountBadge'),
  filterButtons: document.querySelectorAll('.filter-btn'),

  // المعاينة المنبثقة (Modal)
  imageModal: document.getElementById('imageModal'),
  modalFullImage: document.getElementById('modalFullImage'),
  modalPersonName: document.getElementById('modalPersonName'),
  modalPaymentDetails: document.getElementById('modalPaymentDetails'),
  modalDownloadBtn: document.getElementById('modalDownloadBtn'),
  modalRotateBtn: document.getElementById('modalRotateBtn'),
  closeModalBtn: document.getElementById('closeModalBtn'),

  // عناصر الدفع المباشر عبر انستاباي
  btnPayInstapay: document.getElementById('btnPayInstapay'),
  btnCopyCard: document.getElementById('btnCopyCard'),
  btnCopyCardModal: document.getElementById('btnCopyCardModal'),
  instapayModal: document.getElementById('instapayModal'),
  closeInstapayModalBtn: document.getElementById('closeInstapayModalBtn'),
  btnLaunchApp: document.getElementById('btnLaunchApp'),

  // التنبيهات
  toastContainer: document.getElementById('toastContainer')
};

// ثوابت الدفع لشريف ابراهيم
const INSTAPAY_CARD_NUMBER = '5078086735520319';
const BENEFICIARY_NAME = 'شريف ابراهيم';
const FIXED_AMOUNT = '500';

// تهيئة التطبيق عند فتح الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  setupUserToggle();
  setupFileUpload();
  setupEventListeners();
  checkConnectionAndLoadData();

  // تحديث تلقائي كل 10 ثوانٍ للبيانات الحية المشتركة
  setInterval(() => {
    if (state.isServerOnline) {
      loadDataFromServer(false);
    }
  }, 10000);
});

// تعيين القيم الافتراضية
function initDefaults() {
  // تحديد الشهر الحالي بصيغة YYYY-MM
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  elements.monthInput.value = `${year}-${month}`;

  // تعيين بند التحويل 500 جنيه والمبلغ تلقائياً
  elements.amountInput.value = FIXED_AMOUNT;
  elements.noteInput.value = 'التحويل 500 جنيه';

  // تفعيل المستخدم المخزن
  setActiveUser(state.currentUser);
}

// تبديل المستخدم الحالي
function setupUserToggle() {
  elements.btnSherif.addEventListener('click', () => setActiveUser('شريف'));
  elements.btnAbdullah.addEventListener('click', () => setActiveUser('عبدالله'));

  document.querySelectorAll('input[name="person"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      setActiveUser(e.target.value);
    });
  });
}

function setActiveUser(name) {
  state.currentUser = name;
  localStorage.setItem('activeUser', name);

  // تحديث أزرار الهيدر
  elements.btnSherif.classList.toggle('active', name === 'شريف');
  elements.btnAbdullah.classList.toggle('active', name === 'عبدالله');

  // تحديث الراديو في النموذج
  if (name === 'شريف') {
    elements.radioSherif.checked = true;
  } else {
    elements.radioAbdullah.checked = true;
  }
}

// إعداد سحب وإفلات واختيار الصور
function setupFileUpload() {
  const dropZone = elements.dropZone;
  const fileInput = elements.receiptFileInput;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelected(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  elements.btnRemoveImage.addEventListener('click', (e) => {
    e.stopPropagation();
    clearSelectedFile();
  });
}

function handleFileSelected(file) {
  if (!file.type.startsWith('image/')) {
    showToast('الملف المختار ليس صورة. يرجى اختيار صورة إيصال صحيحة.', 'error');
    return;
  }

  state.selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    elements.imagePreview.src = e.target.result;
    elements.dropPrompt.classList.add('hidden');
    elements.previewContainer.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearSelectedFile() {
  state.selectedFile = null;
  elements.receiptFileInput.value = '';
  elements.imagePreview.src = '';
  elements.previewContainer.classList.add('hidden');
  elements.dropPrompt.classList.remove('hidden');
}

// إعداد باقي الأحداث
function setupEventListeners() {
  // إرسال النموذج
  elements.paymentForm.addEventListener('submit', handleFormSubmit);

  // تحديث الجدول
  elements.btnRefreshMatrix.addEventListener('click', () => {
    elements.btnRefreshMatrix.querySelector('i').classList.add('fa-spin');
    checkConnectionAndLoadData().finally(() => {
      setTimeout(() => {
        elements.btnRefreshMatrix.querySelector('i').classList.remove('fa-spin');
      }, 500);
    });
  });

  // فلاتر التحويلات
  elements.filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      renderTransactions();
    });
  });

  // التحكم في النافذة المنبثقة للصور
  elements.closeModalBtn.addEventListener('click', closeModal);
  elements.imageModal.addEventListener('click', (e) => {
    if (e.target === elements.imageModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  elements.modalRotateBtn.addEventListener('click', () => {
    state.currentRotation = (state.currentRotation + 90) % 360;
    elements.modalFullImage.style.transform = `rotate(${state.currentRotation}deg)`;
  });

  // أحداث الدفع المباشر عبر انستاباي
  if (elements.btnPayInstapay) {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      elements.btnPayInstapay.href = 'intent://#Intent;package=com.emeint.android.mysrv;scheme=instapay;end';
    } else {
      elements.btnPayInstapay.href = 'instapay://';
    }
    elements.btnPayInstapay.addEventListener('click', (e) => {
      quickPayAndRecord();
    });
  }
  if (elements.btnCopyCard) {
    elements.btnCopyCard.addEventListener('click', copyCardNumber);
  }
}

// دوال الدفع المباشر عبر انستاباي وتسجيل التحويل الفوري
function copyCardNumber() {
  const card = INSTAPAY_CARD_NUMBER;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(card).then(() => {
      showToast('📋 تم نسخ رقم بطاقة شريف ابراهيم: 5078086735520319', 'success');
    }).catch(() => fallbackCopy(card));
  } else {
    fallbackCopy(card);
  }
}

function fallbackCopy(text) {
  const temp = document.createElement('input');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  showToast('📋 تم نسخ رقم بطاقة شريف ابراهيم: 5078086735520319', 'success');
}

// ضغطة زر واحدة: تسجيل 500 جنيه في الداشبورد + نسخ الكارت + فتح انستاباي فوراً
async function quickPayAndRecord() {
  // 1. نسخ رقم البطاقة فوراً
  copyCardNumber();

  // 2. توجيه الموبايل لفتح تطبيق انستاباي مباشرة وبدون أي نوافذ
  launchInstapayDirectly();

  // 3. تسجيل التحويل تلقائياً في الداشبورد
  const person = state.currentUser;
  const month = elements.monthInput.value || new Date().toISOString().slice(0, 7);
  const amount = 500;
  const method = 'انستاباي (InstaPay)';
  const note = 'التحويل 500 جنيه';

  showToast(`⚡ جاري تأكيد تسجيل 500 ج.م باسم ${person}...`, 'success');

  if (state.isServerOnline) {
    try {
      const formData = new FormData();
      formData.append('person', person);
      formData.append('month', month);
      formData.append('amount', amount);
      formData.append('method', method);
      formData.append('note', note);
      if (state.selectedFile) {
        formData.append('receipt', state.selectedFile);
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showToast(`🎉 تم تسجيل الـ 500 ج.م باسم ${person} في الداشبورد بنجاح!`, 'success');
        resetForm();
        await loadDataFromServer(false);
      }
    } catch (err) {
      console.error(err);
    }
  } else {
    saveLocally(person, month, amount, method, note, '/uploads/sample-receipt.svg');
    showToast(`🎉 تم تسجيل الـ 500 ج.م باسم ${person} في الداشبورد بنجاح!`, 'success');
    resetForm();
  }
}

function launchInstapayDirectly() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    // تشغيل تطبيق انستاباي المباشر على أندرويد
    window.location.href = 'intent://#Intent;package=com.emeint.android.mysrv;scheme=instapay;end';
    setTimeout(() => {
      window.location.href = 'instapay://';
    }, 400);
  } else {
    // آيفون وباقي الأجهزة
    window.location.href = 'instapay://';
  }
}

// فحص الاتصال بالخادم وتحميل البيانات
async function checkConnectionAndLoadData() {
  try {
    const res = await fetch('/api/stats', { cache: 'no-cache' });
    if (res.ok) {
      state.isServerOnline = true;
      elements.connectionStatus.classList.add('hidden');
      await loadDataFromServer(true);
      return;
    }
    throw new Error('Server not responding');
  } catch (err) {
    // السيرفر غير متصل (مثلاً تم فتح الملف مباشرة من المتصفح كـ file:///)
    state.isServerOnline = false;
    elements.connectionStatus.classList.remove('hidden');
    elements.connectionStatus.classList.remove('online');
    elements.connectionText.innerHTML = `⚠️ التطبيق يعمل في <strong>وضع التجربة المحلية</strong> (تم الحفظ على هذا الجهاز). لتشغيل المشاركة الحية بينك وبين عبدالله، قم بتشغيل السيرفر بالخطوات الموجودة في README.`;
    loadDataFromLocalStorage();
  }
}

// جلب البيانات من سيرفر Express
async function loadDataFromServer(showNotification = false) {
  try {
    const [statsRes, paymentsRes] = await Promise.all([
      fetch('/api/stats', { cache: 'no-cache' }),
      fetch('/api/payments', { cache: 'no-cache' })
    ]);

    if (statsRes.ok && paymentsRes.ok) {
      const statsData = await statsRes.json();
      const paymentsData = await paymentsRes.json();

      state.stats = statsData.stats;
      state.payments = paymentsData.payments;

      renderStats();
      renderMonthlyMatrix();
      renderTransactions();

      if (showNotification) {
        showToast('تم تحديث البيانات من الخادم بنجاح', 'success');
      }
    }
  } catch (err) {
    console.error('فشل جلب البيانات من السيرفر:', err);
  }
}

// معالجة إرسال النموذج
async function handleFormSubmit(e) {
  e.preventDefault();

  const person = document.querySelector('input[name="person"]:checked')?.value || state.currentUser;
  const month = elements.monthInput.value;
  const amount = parseFloat(elements.amountInput.value) || 500;
  const method = elements.methodSelect.value;
  const note = elements.noteInput.value;

  // تعطيل الزر مؤقتاً
  elements.submitBtn.disabled = true;
  elements.submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري حفظ التحويل...';

  if (state.isServerOnline) {
    // إرسال للسيرفر عبر FormData
    try {
      const formData = new FormData();
      formData.append('person', person);
      formData.append('month', month);
      formData.append('amount', amount);
      formData.append('method', method);
      formData.append('note', note || 'التحويل 500 جنيه');
      if (state.selectedFile) {
        formData.append('receipt', state.selectedFile);
      }

      const res = await fetch('/api/payments', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (res.ok && result.success) {
        showToast('🎉 تم تسجيل التحويل بنجاح في الداشبورد!', 'success');
        resetForm();
        await loadDataFromServer(false);
      } else {
        showToast(result.message || 'حدث خطأ أثناء حفظ التحويل', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('تعذر الاتصال بالسيرفر أثناء الحفظ', 'error');
    } finally {
      elements.submitBtn.disabled = false;
      elements.submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span>تأكيد وتسجيل التحويل في اللوحة</span>';
    }
  } else {
    // حفظ محلي في حالة عدم وجود سيرفر (تجربة)
    saveLocally(person, month, amount, method, note || 'التحويل 500 جنيه', elements.imagePreview.src || '/uploads/sample-receipt.svg');
    elements.submitBtn.disabled = false;
    elements.submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i><span>تأكيد وتسجيل التحويل في اللوحة</span>';
    showToast('🎉 تم تسجيل التحويل في التخزين المحلي بنجاح!', 'success');
    resetForm();
  }
}

function resetForm() {
  clearSelectedFile();
  elements.noteInput.value = 'التحويل 500 جنيه';
  elements.amountInput.value = FIXED_AMOUNT;
}

// عرض الإحصائيات في البطاقات
function renderStats() {
  const stats = state.stats;
  if (!stats) return;

  elements.statTotalPaid.innerHTML = `${formatNumber(stats.totalPaid)} <small>ج.م</small>`;
  elements.statTotalCount.textContent = `${stats.totalPaymentsCount} عملية تحويل مسجلة`;

  elements.statSherifTotal.innerHTML = `${formatNumber(stats.sherifTotal)} <small>ج.م</small>`;
  elements.statSherifCount.textContent = `${stats.sherifCount} عملية تحويل`;

  elements.statAbdullahTotal.innerHTML = `${formatNumber(stats.abdullahTotal)} <small>ج.م</small>`;
  elements.statAbdullahCount.textContent = `${stats.abdullahCount} عملية تحويل`;

  // مقارنة التوازن بين شريف وعبدالله
  const diff = stats.sherifTotal - stats.abdullahTotal;
  if (diff === 0) {
    elements.statBalanceStatus.textContent = 'متساويان تماماً ⚖️';
    elements.statBalanceStatus.style.color = '#059669';
    elements.statBalanceDiff.textContent = 'كل طرف دفع نفس المبلغ بالضبط';
  } else if (diff > 0) {
    elements.statBalanceStatus.textContent = `شريف دافع أكثر بـ ${formatNumber(diff)} ج.م`;
    elements.statBalanceStatus.style.color = 'var(--sherif-color)';
    elements.statBalanceDiff.textContent = `عبدالله يحتاج دفع ${formatNumber(diff)} ج.م للتعادل`;
  } else {
    const absDiff = Math.abs(diff);
    elements.statBalanceStatus.textContent = `عبدالله دافع أكثر بـ ${formatNumber(absDiff)} ج.م`;
    elements.statBalanceStatus.style.color = 'var(--abdullah-color)';
    elements.statBalanceDiff.textContent = `شريف يحتاج دفع ${formatNumber(absDiff)} ج.م للتعادل`;
  }
}

// عرض جدول التزام الشهور
function renderMonthlyMatrix() {
  const breakdown = state.stats?.monthlyBreakdown || [];

  if (breakdown.length === 0) {
    elements.matrixTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center empty-state" style="padding: 2rem; color: #94a3b8;">
          لا توجد شهور مسجلة حتى الآن.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  breakdown.forEach(item => {
    const formattedMonth = formatMonthName(item.month);
    
    // شريف
    const sherifBadge = item.sherif.paid
      ? `<span class="status-badge paid"><i class="fa-solid fa-check"></i> تم (${formatNumber(item.sherif.amount)} ج.م)</span>`
      : `<span class="status-badge unpaid"><i class="fa-solid fa-clock"></i> لم يدفع</span>`;

    // عبدالله
    const abdullahBadge = item.abdullah.paid
      ? `<span class="status-badge paid"><i class="fa-solid fa-check"></i> تم (${formatNumber(item.abdullah.amount)} ج.م)</span>`
      : `<span class="status-badge unpaid"><i class="fa-solid fa-clock"></i> لم يدفع</span>`;

    html += `
      <tr>
        <td><strong>${formattedMonth}</strong></td>
        <td>${sherifBadge}</td>
        <td>${abdullahBadge}</td>
        <td><strong>${formatNumber(item.total)} ج.م</strong></td>
      </tr>
    `;
  });

  elements.matrixTableBody.innerHTML = html;
}

// عرض قائمة التحويلات والإيصالات
function renderTransactions() {
  const grid = elements.transactionsGrid;
  let list = [...state.payments];

  if (state.activeFilter !== 'all') {
    list = list.filter(p => p.person === state.activeFilter);
  }

  elements.transactionsCountBadge.textContent = list.length;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state-card">
        <i class="fa-solid fa-receipt"></i>
        <h4>لا توجد تحويلات مسجلة بهذا الفلتر</h4>
        <p>قم باختيار "الكل" أو تسجيل دفعة جديدة</p>
      </div>
    `;
    return;
  }

  let html = '';
  list.forEach(tx => {
    const isSherif = tx.person === 'شريف';
    const cardClass = isSherif ? 'tx-sherif' : 'tx-abdullah';
    const avatarClass = isSherif ? 'avatar-sherif' : 'avatar-abdullah';
    const initial = isSherif ? 'ش' : 'ع';
    const formattedDate = formatDateTime(tx.createdAt);
    const monthName = formatMonthName(tx.month);

    html += `
      <div class="tx-card ${cardClass}" data-id="${tx.id}">
        <div class="tx-card-top">
          <div class="tx-person-info">
            <span class="avatar ${avatarClass}">${initial}</span>
            <span class="tx-person-name">${escapeHtml(tx.person)}</span>
          </div>
          <span class="tx-amount">${formatNumber(tx.amount)} ج.م</span>
        </div>

        <div class="tx-image-wrapper" onclick="openImageModal('${tx.receiptUrl}', '${escapeHtml(tx.person)}', '${escapeHtml(monthName)} - ${formatNumber(tx.amount)} ج.م')">
          <img src="${tx.receiptUrl}" alt="إيصال ${escapeHtml(tx.person)}" class="tx-receipt-img" loading="lazy">
          <div class="tx-overlay-btn">
            <i class="fa-solid fa-magnifying-glass-plus fa-xl"></i>
            <span>اضغط لفحص الإيصال</span>
          </div>
        </div>

        <div class="tx-card-body">
          <div class="tx-detail-row">
            <span><i class="fa-regular fa-calendar"></i> شهر الاستحقاق:</span>
            <strong>${monthName}</strong>
          </div>
          <div class="tx-detail-row">
            <span><i class="fa-solid fa-wallet"></i> وسيلة التحويل:</span>
            <span>${escapeHtml(tx.method || 'غير محدد')}</span>
          </div>
          ${tx.note ? `<div class="tx-note-box"><i class="fa-regular fa-comment"></i> ${escapeHtml(tx.note)}</div>` : ''}
        </div>

        <div class="tx-card-footer">
          <span class="tx-time"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
          <button type="button" class="btn-delete-tx" onclick="deleteTransaction('${tx.id}')" title="حذف هذا التحويل">
            <i class="fa-solid fa-trash-can"></i> حذف
          </button>
        </div>
      </div>
    `;
  });

  grid.innerHTML = html;
}

// فتح نافذة الصورة المكبرة (Lightbox Modal)
window.openImageModal = function(url, person, details) {
  state.currentRotation = 0;
  elements.modalFullImage.style.transform = 'rotate(0deg)';
  elements.modalFullImage.src = url;
  elements.modalPersonName.textContent = `إيصال تحويل: ${person}`;
  elements.modalPaymentDetails.textContent = details;
  elements.modalDownloadBtn.href = url;
  elements.modalDownloadBtn.setAttribute('download', `receipt-${person}.jpg`);
  elements.imageModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

function closeModal() {
  elements.imageModal.classList.add('hidden');
  document.body.style.overflow = '';
}

// حذف تحويل
window.deleteTransaction = async function(id) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التحويل وصورة الإيصال؟')) {
    return;
  }

  if (state.isServerOnline) {
    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('تم حذف التحويل بنجاح', 'success');
        await loadDataFromServer(false);
      } else {
        showToast(data.message || 'فشل حذف التحويل', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('خطأ في الاتصال بالخادم', 'error');
    }
  } else {
    // حذف محلي
    let localList = JSON.parse(localStorage.getItem('local_payments') || '[]');
    localList = localList.filter(p => p.id !== id);
    localStorage.setItem('local_payments', JSON.stringify(localList));
    loadDataFromLocalStorage();
    showToast('تم حذف التحويل من التخزين المحلي', 'success');
  }
};

// وضع التخزين المحلي (Local Storage Fallback)
function saveLocally(person, month, amount, method, note, imageBase64) {
  const localList = JSON.parse(localStorage.getItem('local_payments') || '[]');
  const newTx = {
    id: 'local_' + Date.now(),
    person,
    month,
    amount,
    method,
    note,
    receiptUrl: imageBase64,
    createdAt: new Date().toISOString()
  };
  localList.push(newTx);
  localStorage.setItem('local_payments', JSON.stringify(localList));
  loadDataFromLocalStorage();
}

function loadDataFromLocalStorage() {
  const list = JSON.parse(localStorage.getItem('local_payments') || '[]');
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  state.payments = list;

  // حساب الإحصائيات محلياً
  let sherifTotal = 0, abdullahTotal = 0, sherifCount = 0, abdullahCount = 0;
  const monthsMap = {};

  list.forEach(p => {
    const amt = Number(p.amount) || 0;
    if (p.person === 'شريف') {
      sherifTotal += amt;
      sherifCount++;
    } else if (p.person === 'عبدالله') {
      abdullahTotal += amt;
      abdullahCount++;
    }

    const m = p.month || 'غير محدد';
    if (!monthsMap[m]) {
      monthsMap[m] = {
        month: m,
        sherif: { paid: false, amount: 0 },
        abdullah: { paid: false, amount: 0 },
        total: 0
      };
    }
    if (p.person === 'شريف') {
      monthsMap[m].sherif.paid = true;
      monthsMap[m].sherif.amount += amt;
    } else if (p.person === 'عبدالله') {
      monthsMap[m].abdullah.paid = true;
      monthsMap[m].abdullah.amount += amt;
    }
    monthsMap[m].total += amt;
  });

  state.stats = {
    totalPaid: sherifTotal + abdullahTotal,
    sherifTotal,
    abdullahTotal,
    sherifCount,
    abdullahCount,
    totalPaymentsCount: list.length,
    monthlyBreakdown: Object.values(monthsMap).sort((a, b) => b.month.localeCompare(a.month))
  };

  renderStats();
  renderMonthlyMatrix();
  renderTransactions();
}

// دوال مساعدة للتنسيق والتنبيهات
function formatNumber(num) {
  return Number(num || 0).toLocaleString('ar-EG');
}

function formatMonthName(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  const [year, month] = monthStr.split('-');
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const idx = parseInt(month, 10) - 1;
  const name = monthNames[idx] || month;
  return `${name} ${year}`;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function showToast(msg, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
    <span>${escapeHtml(msg)}</span>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
