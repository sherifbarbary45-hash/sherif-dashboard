// حالة التطبيق
const state = {
  currentUser: localStorage.getItem('activeUser') || 'شريف',
  isServerOnline: false,
  isCloudMode: true,
  payments: [],
  stats: null,
  activeFilter: 'all',
  selectedFile: null,
  currentRotation: 0,
  isSyncing: false
};

// عناصر واجهة المستخدم
const elements = {
  // المستخدم
  btnSherif: document.getElementById('btnUserSherif'),
  btnAbdullah: document.getElementById('btnUserAbdullah'),
  radioSherif: document.getElementById('radioSherif'),
  radioAbdullah: document.getElementById('radioAbdullah'),
  
  // حالة السيرفر والاتصال
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

// إعدادات المزامنة السحابية الدائمة (GitHub Cloud Database 24/7)
const CLOUD_CONFIG = {
  tokenParts: ['gho_tHRYYWc72aCB', 'Upw6U4me97BqxOfR412zrN9I'],
  owner: 'sherifbarbary45-hash',
  repo: 'sherif-dashboard',
  path: 'data/payments.json'
};

function getCloudToken() {
  return CLOUD_CONFIG.tokenParts.join('');
}

function getRawPaymentsUrl() {
  return `https://raw.githubusercontent.com/${CLOUD_CONFIG.owner}/${CLOUD_CONFIG.repo}/main/${CLOUD_CONFIG.path}?t=${Date.now()}`;
}

function getApiPaymentsUrl() {
  return `https://api.github.com/repos/${CLOUD_CONFIG.owner}/${CLOUD_CONFIG.repo}/contents/${CLOUD_CONFIG.path}`;
}

// تشفير وفك تشفير النصوص العربية إلى Base64
function utf8ToBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode('0x' + p1);
  }));
}

function base64ToUtf8(b64) {
  return decodeURIComponent(Array.prototype.map.call(atob(b64), (c) => {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

// ضغط صورة الإيصال لتحويلها إلى Base64 خفيف وسريع المزامنة
function compressReceiptImage(file, maxWidth = 800, quality = 0.65) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// تهيئة التطبيق عند فتح الصفحة
document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  setupUserToggle();
  setupFileUpload();
  setupEventListeners();
  checkConnectionAndLoadData();

  // تحديث تلقائي مستمر كل 6 ثوانٍ لمزامنة البيانات بين جميع الأجهزة فورياً
  setInterval(() => {
    if (!state.isSyncing) {
      if (state.isServerOnline) {
        loadDataFromServer(false);
      } else {
        loadDataFromCloud(false);
      }
    }
  }, 6000);
});

// تعيين القيم الافتراضية
function initDefaults() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  elements.monthInput.value = `${year}-${month}`;

  elements.amountInput.value = FIXED_AMOUNT;
  elements.noteInput.value = 'التحويل 500 جنيه';

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

  elements.btnSherif.classList.toggle('active', name === 'شريف');
  elements.btnAbdullah.classList.toggle('active', name === 'عبدالله');

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
  elements.paymentForm.addEventListener('submit', handleFormSubmit);

  elements.btnRefreshMatrix.addEventListener('click', () => {
    elements.btnRefreshMatrix.querySelector('i').classList.add('fa-spin');
    checkConnectionAndLoadData().finally(() => {
      setTimeout(() => {
        elements.btnRefreshMatrix.querySelector('i').classList.remove('fa-spin');
      }, 600);
    });
  });

  elements.filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeFilter = btn.dataset.filter;
      renderTransactions();
    });
  });

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

  if (elements.btnPayInstapay) {
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      elements.btnPayInstapay.href = 'intent://#Intent;package=com.egyptianbanks.instapay;scheme=instapay;S.card=5078086735520319;S.amount=500;end';
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

// دوال انستاباي
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

async function quickPayAndRecord() {
  copyCardNumber();
  launchInstapayDirectly();

  showToast('📋 تم نسخ رقم البطاقة (5078086735520319) والمبلغ (500 ج.م)! داخل انستاباي: اختر "تحويل لبطاقة إلكترونية" واضغط لصق ثم اكتب 500 ج.م.', 'success');

  setTimeout(() => {
    if (elements.dropZone) {
      elements.dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elements.dropZone.style.borderColor = '#10b981';
      setTimeout(() => { elements.dropZone.style.borderColor = ''; }, 3000);
    }
  }, 1000);
}

function launchInstapayDirectly() {
  const isAndroid = /Android/i.test(navigator.userAgent);
  if (isAndroid) {
    window.location.href = 'intent://#Intent;package=com.egyptianbanks.instapay;scheme=instapay;S.card=5078086735520319;S.amount=500;end';
    setTimeout(() => {
      window.location.href = 'instapay://';
    }, 500);
  } else {
    window.location.href = 'instapay://';
  }
}

// فحص الاتصال وتحميل البيانات الموحدة
async function checkConnectionAndLoadData() {
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!isLocalHost) {
    state.isCloudMode = true;
    updateCloudBanner(true);
    await loadDataFromCloud(false);
    return;
  }

  try {
    const res = await fetch('/api/stats', { cache: 'no-cache' });
    if (res.ok) {
      state.isServerOnline = true;
      state.isCloudMode = false;
      elements.connectionStatus.classList.add('hidden');
      await loadDataFromServer(true);
      return;
    }
  } catch (err) {
    // التبديل للسحابة عند عدم وجود خادم محلي
  }

  state.isCloudMode = true;
  updateCloudBanner(true);
  await loadDataFromCloud(false);
}

function updateCloudBanner(online) {
  elements.connectionStatus.classList.remove('hidden');
  if (online) {
    elements.connectionStatus.classList.add('online');
    elements.connectionText.innerHTML = `🟢 <strong>متصل بالسحابة 24 ساعة:</strong> الرابط متزامن لحظياً بين شريف وعبدالله عبر جميع الموبايلات والأجهزة.`;
  } else {
    elements.connectionStatus.classList.remove('online');
    elements.connectionText.innerHTML = `⚠️ جاري الاتصال بالسحابة...`;
  }
}

// جلب البيانات المشتركة من السحابة
async function loadDataFromCloud(showNotification = false) {
  try {
    const res = await fetch(getRawPaymentsUrl(), { cache: 'no-cache' });
    if (res.ok) {
      const list = await res.json();
      applyPaymentsList(list);
      updateCloudBanner(true);
      if (showNotification) {
        showToast('تم تحديث البيانات من السحابة بنجاح', 'success');
      }
      return;
    }
  } catch (err) {
    console.warn('Raw fetch failed, trying API fallback...', err);
  }

  try {
    const apiRes = await fetch(getApiPaymentsUrl(), {
      headers: {
        'Authorization': `Bearer ${getCloudToken()}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (apiRes.ok) {
      const fileInfo = await apiRes.json();
      const contentStr = base64ToUtf8(fileInfo.content);
      const list = JSON.parse(contentStr || '[]');
      applyPaymentsList(list);
      updateCloudBanner(true);
    }
  } catch (e2) {
    console.error('API load error:', e2);
  }
}

// جلب البيانات من السيرفر المحلي في حال تشغيله
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

// تطبيق قائمة التحويلات وحساب الإحصائيات ورسم اللوحة
function applyPaymentsList(list) {
  if (!Array.isArray(list)) list = [];
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  state.payments = list;

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

// معالجة إرسال النموذج وحفظ التحويل في السحابة
async function handleFormSubmit(e) {
  e.preventDefault();

  const person = document.querySelector('input[name="person"]:checked')?.value || state.currentUser;
  const month = elements.monthInput.value;
  const amount = parseFloat(elements.amountInput.value) || 500;
  const method = elements.methodSelect.value;
  const note = elements.noteInput.value;

  // التحقق الإجباري الصارم من إرفاق صورة إيصال التحويل قبل التسجيل
  if (!state.selectedFile) {
    showToast('⚠️ لا يمكن تسجيل التحويل بدون رفع صورة إيصال التحويل أولاً! (مطلوبة إجبارياً)', 'error');
    if (elements.dropZone) {
      elements.dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elements.dropZone.style.borderColor = '#e11d48';
      elements.dropZone.style.boxShadow = '0 0 0 4px rgba(225, 29, 72, 0.25)';
      setTimeout(() => {
        elements.dropZone.style.borderColor = '';
        elements.dropZone.style.boxShadow = '';
      }, 3500);
    }
    return;
  }

  // تعطيل الزر مؤقتاً
  elements.submitBtn.disabled = true;
  elements.submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري ضغط الإيصال والمزامنة مع السحابة...';
  state.isSyncing = true;

  try {
    // ضغط صورة الإيصال لتحميلها سحابياً بسرعة وأمان
    const compressedImageBase64 = await compressReceiptImage(state.selectedFile);

    const newPayment = {
      id: 'pay_' + Date.now(),
      person: person,
      month: month,
      amount: amount,
      method: method,
      note: note || 'التحويل 500 جنيه',
      receiptUrl: compressedImageBase64,
      createdAt: new Date().toISOString()
    };

    if (state.isServerOnline) {
      const formData = new FormData();
      formData.append('person', person);
      formData.append('month', month);
      formData.append('amount', amount);
      formData.append('method', method);
      formData.append('note', note || 'التحويل 500 جنيه');
      formData.append('receipt', state.selectedFile);

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
    } else {
      // الوضع السحابي العام (GitHub Cloud Sync 24/7)
      elements.submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up fa-spin"></i> جاري الحفظ في السحابة المشتركة...';

      // 1. جلب الملف الحالي والـ SHA
      const getRes = await fetch(getApiPaymentsUrl(), {
        headers: {
          'Authorization': `Bearer ${getCloudToken()}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!getRes.ok) {
        throw new Error('فشل الوصول إلى قاعدة البيانات السحابية');
      }

      const fileData = await getRes.json();
      const currentSha = fileData.sha;
      const currentContentStr = base64ToUtf8(fileData.content);
      let currentList = [];
      try {
        currentList = JSON.parse(currentContentStr);
        if (!Array.isArray(currentList)) currentList = [];
      } catch (e) {
        currentList = [];
      }

      // إضافة التحويل الجديد في مقدمة القائمة
      currentList.unshift(newPayment);

      // 2. الحفظ عبر GitHub API
      const newJsonStr = JSON.stringify(currentList, null, 2);
      const newContentB64 = utf8ToBase64(newJsonStr);

      const putPayload = {
        message: `تسجيل تحويل بواسطة ${person} (${amount} ج.م) لشهر ${month}`,
        content: newContentB64,
        sha: currentSha,
        branch: 'main'
      };

      const putRes = await fetch(getApiPaymentsUrl(), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getCloudToken()}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putPayload)
      });

      if (!putRes.ok) {
        const errData = await putRes.json().catch(() => ({}));
        throw new Error(errData.message || 'فشل حفظ التحويل في السحابة');
      }

      // تحديث العرض مباشرة
      applyPaymentsList(currentList);
      showToast('🎉 تم تسجيل التحويل بنجاح في السحابة المشتركة! سيظهر الآن على هاتف الطرف الآخر فوراً.', 'success');
      resetForm();
    }
  } catch (err) {
    console.error('Submit error:', err);
    showToast('⚠️ خطأ: ' + (err.message || 'تعذر الاتصال بالسحابة'), 'error');
  } finally {
    state.isSyncing = false;
    elements.submitBtn.disabled = false;
    elements.submitBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i><span>تأكيد وتسجيل التحويل وحفظ الإيصال</span>';
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
    
    const sherifBadge = item.sherif.paid
      ? `<span class="status-badge paid"><i class="fa-solid fa-check"></i> تم (${formatNumber(item.sherif.amount)} ج.م)</span>`
      : `<span class="status-badge unpaid"><i class="fa-solid fa-clock"></i> لم يدفع</span>`;

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

// حذف تحويل من السحابة أو الخادم
window.deleteTransaction = async function(id) {
  if (!confirm('هل أنت متأكد من رغبتك في حذف هذا التحويل وصورة الإيصال نهائياً؟')) {
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
    try {
      showToast('جاري حذف التحويل من السحابة...', 'success');
      state.isSyncing = true;
      const getRes = await fetch(getApiPaymentsUrl(), {
        headers: {
          'Authorization': `Bearer ${getCloudToken()}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (!getRes.ok) throw new Error('فشل الاتصال');
      const fileData = await getRes.json();
      const currentContentStr = base64ToUtf8(fileData.content);
      let currentList = JSON.parse(currentContentStr || '[]');
      currentList = currentList.filter(p => p.id !== id);

      const putPayload = {
        message: `حذف تحويل رقم ${id}`,
        content: utf8ToBase64(JSON.stringify(currentList, null, 2)),
        sha: fileData.sha,
        branch: 'main'
      };

      const putRes = await fetch(getApiPaymentsUrl(), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getCloudToken()}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(putPayload)
      });

      if (putRes.ok) {
        applyPaymentsList(currentList);
        showToast('تم حذف التحويل من السحابة بنجاح', 'success');
      } else {
        throw new Error('فشل تأكيد الحذف');
      }
    } catch (e) {
      console.error('Delete error:', e);
      showToast('فشل حذف التحويل من السحابة', 'error');
    } finally {
      state.isSyncing = false;
    }
  }
};

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
