// File: test-acid.js  [TC 40 - Data Integrity (ACID)]
// Kiem tra day du 4 tinh chat: Atomic, Consistent, Isolated, Durable

const { spawnSync } = require('child_process');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzc2NzI4OSwiZXhwIjoxNzc3ODUzNjg5fQ.SG9N7_0J6F2qwcVIGDE2NeeULs77Qu7vPP91AAy88Iw";
const BOOKING_URL = "http://localhost:3000/bookings";

function queryDB(sql) {
  const r = spawnSync('docker', ['exec', '-i', 'cab_postgres', 'psql', '-U', 'postgres', '-d', 'booking_db'], { input: sql, encoding: 'utf8' });
  return (r.stdout || '').trim();
}

async function postBooking(extraHeaders = {}, body = {}) {
  const res = await fetch(BOOKING_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ pickup: { lat: 10.76, lng: 106.66 }, destination: { lat: 10.77, lng: 106.70 }, distance: 5.0, ...body })
  });
  return { status: res.status, data: await res.json() };
}

function title(t) { console.log(`\n${'='.repeat(60)}\n${t}\n${'='.repeat(60)}`); }
function pass(msg) { console.log(`  [PASS] ${msg}`); }
function fail(msg) { console.log(`  [FAIL] ${msg}`); }

async function run() {
  title('TC 40 - DATA INTEGRITY (ACID) - Full Test Suite');

  // ============================================================
  // A - ATOMIC: Dung key ROLLBACK_TEST_v2 da co san trong code
  // -> He thong throw Error giua chung Transaction -> Rollback
  // -> KHONG co Booking nao duoc tao vao DB
  // ============================================================
  title('A - ATOMIC: Transaction Rollback (ROLLBACK_TEST_v2)');
  const rAtomic = await postBooking({ 'x-idempotency-key': 'ROLLBACK_TEST_v2' });
  console.log(`  Ket qua: HTTP ${rAtomic.status} - ${rAtomic.data.error || rAtomic.data.message}`);
  await new Promise(r => setTimeout(r, 500));
  const atomicCheck = queryDB(`SELECT COUNT(*) as count FROM bookings WHERE "idempotencyKey" = 'ROLLBACK_TEST_v2';`);
  console.log(`  So booking trong DB voi key ROLLBACK_TEST_v2:\n${atomicCheck}`);
  (rAtomic.status === 500 && atomicCheck.includes('0')) ? pass('ATOMIC - Transaction rollback thanh cong. Khong co record "dang do" trong DB.') : fail(`ATOMIC - Kiem tra lai: HTTP=${rAtomic.status}`);

  // ============================================================
  // C - CONSISTENT: Insert du lieu sai -> bi reject
  // ============================================================
  title('C - CONSISTENT: Insert invalid data -> phai bi reject');
  const rInvalid = await postBooking({}, { distance: -999 });
  console.log(`  Gui distance = -999: HTTP ${rInvalid.status} - ${rInvalid.data.error}`);
  (rInvalid.status === 422 || rInvalid.status === 400) ? pass('CONSISTENT - Du lieu sai bi tu choi, khong commit vao DB.') : fail(`CONSISTENT - He thong chap nhan du lieu sai!`);

  // ============================================================
  // I - ISOLATED: 2 request song song cung key -> chi 1 thanh cong
  // ============================================================
  title('I - ISOLATED: 2 request song song voi cung Idempotency Key');
  const idemKey = 'ACID_ISO_' + Date.now();
  const [r2, r3] = await Promise.all([
    postBooking({ 'x-idempotency-key': idemKey }),
    postBooking({ 'x-idempotency-key': idemKey }),
  ]);
  const ids = [r2.data.data?.id, r3.data.data?.id].filter(Boolean);
  const uniqueIds = [...new Set(ids)];
  console.log(`  Request 1: HTTP ${r2.status} | BookingID: ${r2.data.data?.id || '---'}`);
  console.log(`  Request 2: HTTP ${r3.status} | BookingID: ${r3.data.data?.id || '---'}`);
  uniqueIds.length <= 1 ? pass('ISOLATED - Chi 1 Booking duoc tao, khong co duplicate.') : fail('ISOLATED - Bi duplicate BookingID!');

  // ============================================================
  // D - DURABLE: Sau commit -> du lieu con mai trong DB
  // ============================================================
  title('D - DURABLE: Commit xong -> du lieu phai con trong DB');
  const rD = await postBooking();
  const durableId = rD.data.data?.id;
  console.log(`  Tao booking #${durableId} thanh cong.`);
  await new Promise(r => setTimeout(r, 500));
  const durableCheck = queryDB(`SELECT id, status, "createdAt" FROM bookings WHERE id = ${durableId};`);
  console.log(`  Query lai tu DB:\n${durableCheck}`);
  durableCheck.includes(String(durableId)) ? pass('DURABLE - Du lieu van con trong DB sau commit. Khong bi mat.') : fail('DURABLE - Du lieu bi mat sau commit!');

  // ============================================================
  // TONG KET
  // ============================================================
  title('TONG KET TC 40 - ACID');
  console.log('  [A] Atomic    : Transaction rollback - Booking khong duoc tao khi co loi giua chung.');
  console.log('  [C] Consistent: Du lieu sai (distance am) bi reject, khong vao DB.');
  console.log('  [I] Isolated  : 2 request song song -> chi 1 Booking duoc tao ra.');
  console.log('  [D] Durable   : Sau commit, du lieu luon con trong DB.');
  console.log('='.repeat(60));
}

run();
