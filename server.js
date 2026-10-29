const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// التأكد من وجود مجلدات البيانات والرفع
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PAYMENTS_FILE)) {
  fs.writeFileSync(PAYMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// الإعدادات العامة
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// إعداد رفع الصور باستخدام Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'receipt-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif|heic|heif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/');
  if (extname || mimetype) {
    return cb(null, true);
  }
  cb(new Error('الملف المرفوع يجب أن يكون صورة فقط (JPG, PNG, WEBP, etc.)'));
};

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // حتى 15 ميجابايت للصور عالية الدقة
  fileFilter
});

// دوال مساعدة لقراءة وكتابة البيانات
function getPayments() {
  try {
    const data = fs.readFileSync(PAYMENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('خطأ في قراءة ملف المدفوعات:', err);
    return [];
  }
}

function savePayments(payments) {
  try {
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2), 'utf-8');
  } catch (err) {
    console.error('خطأ في حفظ ملف المدفوعات:', err);
  }
}

// 1. استرجاع جميع التحويلات
app.get('/api/payments', (req, res) => {
  const payments = getPayments();
  // فرز تنازلي حسب التاريخ (الأحدث أولاً)
  payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ success: true, payments });
});

// 2. تسجيل تحويل جديد مع رفع صورة الإيصال
app.post('/api/payments', upload.single('receipt'), (req, res) => {
  try {
    const { person, month, amount, method, note } = req.body;

    if (!person || (person !== 'شريف' && person !== 'عبدالله')) {
      return res.status(400).json({ success: false, message: 'يجب اختيار شخص صحيح (شريف أو عبدالله)' });
    }

    const receiptUrl = req.file ? `/uploads/${req.file.filename}` : '/uploads/sample-receipt.svg';
    const receiptFilename = req.file ? req.file.filename : null;

    const parsedAmount = parseFloat(amount) || 500;
    const payments = getPayments();

    const newPayment = {
      id: 'pay_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      person: person.trim(),
      month: month || new Date().toISOString().slice(0, 7), // مثال: 2024-10
      amount: parsedAmount,
      method: method || 'انستاباي (InstaPay)',
      note: (note && note.trim()) ? note.trim() : 'التحويل 500 جنيه',
      receiptUrl,
      receiptFilename,
      createdAt: new Date().toISOString()
    };

    payments.push(newPayment);
    savePayments(payments);

    res.status(201).json({
      success: true,
      message: 'تم تسجيل التحويل بنجاح',
      payment: newPayment
    });
  } catch (err) {
    console.error('خطأ في تسجيل التحويل:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء حفظ التحويل' });
  }
});

// 3. حذف تحويل
app.delete('/api/payments/:id', (req, res) => {
  try {
    const { id } = req.params;
    let payments = getPayments();
    const itemToDelete = payments.find(p => p.id === id);

    if (!itemToDelete) {
      return res.status(404).json({ success: false, message: 'التحويل غير موجود' });
    }

    // حذف ملف الصورة من السيرفر إن وجد
    if (itemToDelete.receiptFilename) {
      const filePath = path.join(UPLOADS_DIR, itemToDelete.receiptFilename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    payments = payments.filter(p => p.id !== id);
    savePayments(payments);

    res.json({ success: true, message: 'تم حذف التحويل بنجاح' });
  } catch (err) {
    console.error('خطأ في حذف التحويل:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء الحذف' });
  }
});

// 4. إحصائيات عامة (المجموع الكلي وما دفعه كل شخص)
app.get('/api/stats', (req, res) => {
  const payments = getPayments();

  let sherifTotal = 0;
  let abdullahTotal = 0;
  let sherifCount = 0;
  let abdullahCount = 0;

  // خريطة الشهور لمتابعة الالتزام الشهري
  const monthsMap = {};

  payments.forEach(p => {
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
        sherif: { paid: false, amount: 0, count: 0 },
        abdullah: { paid: false, amount: 0, count: 0 },
        total: 0
      };
    }

    if (p.person === 'شريف') {
      monthsMap[m].sherif.paid = true;
      monthsMap[m].sherif.amount += amt;
      monthsMap[m].sherif.count += 1;
    } else if (p.person === 'عبدالله') {
      monthsMap[m].abdullah.paid = true;
      monthsMap[m].abdullah.amount += amt;
      monthsMap[m].abdullah.count += 1;
    }
    monthsMap[m].total += amt;
  });

  const totalPaid = sherifTotal + abdullahTotal;
  const monthlyBreakdown = Object.values(monthsMap).sort((a, b) => b.month.localeCompare(a.month));

  res.json({
    success: true,
    stats: {
      totalPaid,
      sherifTotal,
      abdullahTotal,
      sherifCount,
      abdullahCount,
      totalPaymentsCount: payments.length,
      monthlyBreakdown
    }
  });
});

// تشغيل السيرفر
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
  console.log(`🌐 يمكنك فتح لوحة التحكم على: http://localhost:${PORT}`);
  console.log(`📱 للمشاركة على نفس شبكة الواي فاي أو عبر الإنترنت راجع README`);
  console.log(`===============================================`);
});
