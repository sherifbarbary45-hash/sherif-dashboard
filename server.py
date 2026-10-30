import os
import json
import time
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='public', static_url_path='')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
PAYMENTS_FILE = os.path.join(DATA_DIR, 'payments.json')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
if not os.path.exists(PAYMENTS_FILE):
    with open(PAYMENTS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f, ensure_ascii=False, indent=2)

def get_payments():
    try:
        with open(PAYMENTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("Error reading payments:", e)
        return []

def save_payments(payments):
    try:
        with open(PAYMENTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(payments, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving payments:", e)

# تقديم الملفات الثابتة
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('public', path)

@app.route('/uploads/<path:filename>')
def uploaded_files(filename):
    return send_from_directory('uploads', filename)

# 1. قائمة التحويلات
@app.route('/api/payments', methods=['GET'])
def list_payments():
    payments = get_payments()
    payments.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
    return jsonify({'success': True, 'payments': payments})

# 2. تسجيل تحويل جديد
@app.route('/api/payments', methods=['POST'])
def add_payment():
    try:
        person = request.form.get('person', '').strip()
        month = request.form.get('month', '').strip()
        amount_raw = request.form.get('amount', '500')
        method = request.form.get('method', 'انستاباي').strip()
        note = request.form.get('note', '').strip()
        if not note:
            note = 'التحويل 500 جنيه'

        if person not in ['شريف', 'عبدالله']:
            return jsonify({'success': False, 'message': 'يجب اختيار شخص صحيح (شريف أو عبدالله)'}), 400

        # التحقق الإجباري من وجود صورة إيصال التحويل
        if 'receipt' not in request.files or not request.files['receipt'].filename:
            return jsonify({'success': False, 'message': '⚠️ صورة إيصال التحويل مطلوبة إجبارياً قبل تسجيل الدفعة'}), 400

        receipt_file = request.files['receipt']
        original_ext = os.path.splitext(receipt_file.filename)[1].lower() or '.jpg'
        unique_filename = f"receipt-{int(time.time() * 1000)}{original_ext}"
        filepath = os.path.join(UPLOADS_DIR, unique_filename)
        receipt_file.save(filepath)
        receipt_url = f"/uploads/{unique_filename}"

        try:
            amount = float(amount_raw)
        except ValueError:
            amount = 500.0

        payment_id = f"pay_{int(time.time() * 1000)}"
        new_payment = {
            'id': payment_id,
            'person': person,
            'month': month or datetime.now().strftime('%Y-%m'),
            'amount': amount,
            'method': method,
            'note': note,
            'receiptUrl': receipt_url,
            'receiptFilename': unique_filename,
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }

        payments = get_payments()
        payments.append(new_payment)
        save_payments(payments)

        return jsonify({'success': True, 'message': 'تم تسجيل التحويل بنجاح', 'payment': new_payment}), 201

    except Exception as e:
        print("Error adding payment:", e)
        return jsonify({'success': False, 'message': 'حدث خطأ أثناء حفظ التحويل'}), 500

# 3. حذف تحويل
@app.route('/api/payments/<payment_id>', methods=['DELETE'])
def delete_payment(payment_id):
    try:
        payments = get_payments()
        target = next((p for p in payments if p['id'] == payment_id), None)
        if not target:
            return jsonify({'success': False, 'message': 'التحويل غير موجود'}), 404

        if target.get('receiptFilename'):
            fpath = os.path.join(UPLOADS_DIR, target['receiptFilename'])
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass

        payments = [p for p in payments if p['id'] != payment_id]
        save_payments(payments)
        return jsonify({'success': True, 'message': 'تم حذف التحويل بنجاح'})

    except Exception as e:
        print("Error deleting payment:", e)
        return jsonify({'success': False, 'message': 'خطأ أثناء الحذف'}), 500

# 4. الإحصائيات
@app.route('/api/stats', methods=['GET'])
def get_stats():
    payments = get_payments()
    sherif_total = 0.0
    abdullah_total = 0.0
    sherif_count = 0
    abdullah_count = 0
    months_map = {}

    for p in payments:
        amt = float(p.get('amount', 0))
        person = p.get('person')
        if person == 'شريف':
            sherif_total += amt
            sherif_count += 1
        elif person == 'عبدالله':
            abdullah_total += amt
            abdullah_count += 1

        m = p.get('month', 'غير محدد')
        if m not in months_map:
            months_map[m] = {
                'month': m,
                'sherif': {'paid': False, 'amount': 0.0, 'count': 0},
                'abdullah': {'paid': False, 'amount': 0.0, 'count': 0},
                'total': 0.0
            }

        if person == 'شريف':
            months_map[m]['sherif']['paid'] = True
            months_map[m]['sherif']['amount'] += amt
            months_map[m]['sherif']['count'] += 1
        elif person == 'عبدالله':
            months_map[m]['abdullah']['paid'] = True
            months_map[m]['abdullah']['amount'] += amt
            months_map[m]['abdullah']['count'] += 1

        months_map[m]['total'] += amt

    monthly_breakdown = sorted(months_map.values(), key=lambda x: x['month'], reverse=True)

    return jsonify({
        'success': True,
        'stats': {
            'totalPaid': sherif_total + abdullah_total,
            'sherifTotal': sherif_total,
            'abdullahTotal': abdullah_total,
            'sherifCount': sherif_count,
            'abdullahCount': abdullah_count,
            'totalPaymentsCount': len(payments),
            'monthlyBreakdown': monthly_breakdown
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
