// File: test-network-failure.js  [TC 39 - Partial Failure / Network Timeout]
// Kich ban: Goi Payment voi timeout cuc ngan (5ms) -> He thong phai xu ly khong bi "ket"

const { spawnSync } = require('child_process');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzc2NzI4OSwiZXhwIjoxNzc3ODUzNjg5fQ.SG9N7_0J6F2qwcVIGDE2NeeULs77Qu7vPP91AAy88Iw";
const BOOKING_URL = "http://localhost:3000/bookings";
const PAYMENT_URL = "http://localhost:3000/payments";

function queryDB(sql) {
  const result = spawnSync('docker', [
    'exec', '-i', 'cab_postgres',
    'psql', '-U', 'postgres', '-d', 'booking_db'
  ], { input: sql, encoding: 'utf8' });
  return (result.stdout || '').trim();
}

async function run() {
  console.log("============================================================");
  console.log("TC 39 - PARTIAL FAILURE (Network Timeout Simulation)");
  console.log("============================================================\n");

  // BUOC 1: Tao booking moi
  console.log("[BUOC 1] Tao booking moi...");
  let bookingId = null;
  const res1 = await fetch(BOOKING_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pickup: { lat: 10.76, lng: 106.66 }, destination: { lat: 10.77, lng: 106.70 }, distance: 5.0 })
  });
  const b = await res1.json();
  bookingId = b.data?.id;
  console.log(`   [OK] Booking ID = ${bookingId}, Status = ${b.data?.status}`);

  // BUOC 2: Kiem tra trang thai truoc khi thanh toan
  await new Promise(r => setTimeout(r, 300));
  const beforeResult = queryDB(`SELECT id, status FROM bookings WHERE id = ${bookingId};`);
  console.log("\n[BUOC 2] Trang thai TRUOC khi goi Payment:");
  console.log(beforeResult);

  // BUOC 3: Gia lap Network Timeout - Dung AbortController voi timeout 5ms
  console.log("\n[BUOC 3] Gia lap loi mang (Timeout 5ms) khi goi Payment...");
  let networkError = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5); // Abort sau 5ms

  try {
    await fetch(PAYMENT_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, rideId: 999, amount: 20.0, payment_method: 'card' }),
      signal: controller.signal
    });
  } catch (e) {
    networkError = e.name; // Se la "AbortError"
    console.log(`   [OK] Loi mang da xay ra: ${e.name} - "${e.message}"`);
  } finally {
    clearTimeout(timer);
  }

  // BUOC 4: Doi 1 giay roi kiem tra trang thai - He thong khong duoc bi "ket"
  await new Promise(r => setTimeout(r, 1000));
  console.log("\n[BUOC 4] Kiem tra trang thai SAU khi xay ra loi mang (sau 1 giay):");
  const afterResult = queryDB(`SELECT id, status FROM bookings WHERE id = ${bookingId};`);
  console.log(afterResult);

  // BUOC 5: Ket luan
  console.log("\n============================================================");
  const isAborted = networkError === 'AbortError';
  const stillConsistent = afterResult.includes('REQUESTED') || afterResult.includes('CANCELLED') || afterResult.includes('PAID');

  if (isAborted) {
    console.log("[PASS] Loi mang da duoc mo phong thanh cong (AbortError).");
  }
  if (stillConsistent) {
    console.log("[PASS] He thong KHONG bi ket! Booking van o trang thai ro rang.");
    console.log("   -> Khong co 'inconsistent state'.");
    console.log("   -> Transaction khong bi treo.");
  } else {
    console.log("[WARN] Kiem tra lai trang thai Booking trong DB.");
  }
  console.log("============================================================");
}

run();
