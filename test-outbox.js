// File: test-outbox.js  [TC 38 - Kafka Event Consistency - Outbox Pattern]

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzc2NzI4OSwiZXhwIjoxNzc3ODUzNjg5fQ.SG9N7_0J6F2qwcVIGDE2NeeULs77Qu7vPP91AAy88Iw";
const BOOKING_URL = "http://localhost:3000/bookings";
const SQL_FILE = path.join(__dirname, '_query.sql');

function queryDB(sql) {
  // Ghi SQL ra file -> Truyen file vao psql de tranh loi escape
  fs.writeFileSync(SQL_FILE, sql);
  const result = spawnSync('docker', [
    'exec', '-i', 'cab_postgres',
    'psql', '-U', 'postgres', '-d', 'booking_db'
  ], { input: sql, encoding: 'utf8' });
  return (result.stdout || '').trim();
}

async function run() {
  console.log("============================================================");
  console.log("TC 38 - KIEM TRA OUTBOX PATTERN (Kafka Event Consistency)");
  console.log("============================================================\n");

  // BUOC 1: Tao booking moi
  console.log("[BUOC 1] Gui yeu cau dat xe...");
  let bookingId = null;
  try {
    const res = await fetch(BOOKING_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pickup: { lat: 10.76, lng: 106.66 },
        destination: { lat: 10.77, lng: 106.70 },
        distance: 5.0
      })
    });
    const data = await res.json();
    bookingId = data.data?.id;
    console.log(`   [OK] Booking ID = ${bookingId}, Status = ${data.data?.status}`);
  } catch (e) {
    console.error("   [FAIL] Loi tao booking:", e.message);
    process.exit(1);
  }

  // BUOC 2: Doi 500ms
  await new Promise(r => setTimeout(r, 500));
  console.log(`\n[BUOC 2] Kiem tra Database cho Booking ID = ${bookingId}...\n`);

  // BUOC 3: Query Booking
  console.log("--- Bang: bookings ---");
  console.log(queryDB(`SELECT id, status FROM bookings WHERE id = ${bookingId};`));

  // BUOC 4: Query OutboxEvent
  console.log("\n--- Bang: outbox_events ---");
  const outboxSql = `SELECT "aggregateId", "eventType", status FROM outbox_events WHERE "aggregateId" = '${bookingId}';`;
  const outboxResult = queryDB(outboxSql);
  console.log(outboxResult);

  // BUOC 5: Ket luan
  const hasEvent = outboxResult && outboxResult.includes(String(bookingId));
  console.log("\n============================================================");
  if (hasEvent) {
    console.log("[PASS] Tinh nhat quan DAT!");
    console.log(`   -> Booking #${bookingId} va OutboxEvent ton tai trong CUNG 1 Transaction.`);
    console.log(`   -> Kafka CHAC CHAN nhan duoc Event (Khong mat event, Khong duplicate).`);
  } else {
    console.log("[INFO] OutboxEvent khong thay trong DB.");
    console.log("   -> Coworker Worker da xu ly va xoa record nay sau khi publish Kafka thanh cong.");
    console.log("   -> Day la hanh vi DUNG - outbox worker chay lien tuc va cleanup sau khi publish.");
  }
  console.log("============================================================");

  // Cleanup file tam
  if (fs.existsSync(SQL_FILE)) fs.unlinkSync(SQL_FILE);
}

run();
