// File: test-race.js
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzc2NzI4OSwiZXhwIjoxNzc3ODUzNjg5fQ.SG9N7_0J6F2qwcVIGDE2NeeULs77Qu7vPP91AAy88Iw"; // Copy Token từ Postman dán vào đây
const URL = "http://localhost:3000/bookings";
const IDEM_KEY = "PRO_RACE_TEST_" + Date.now();

async function runTest() {
    console.log(`🚀 Đang gửi 10 yêu cầu song song với Key: ${IDEM_KEY}...\n`);

    // Tạo 10 yêu cầu chạy song song
    const requests = Array.from({ length: 10 }).map((_, i) =>
        fetch(URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'x-idempotency-key': IDEM_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pickup: { lat: 10.76, lng: 106.66 },
                destination: { lat: 10.77, lng: 106.70 },
                distance: 5.0
            })
        }).then(async res => {
            const data = await res.json();
            return { status: res.status, data };
        })
    );

    const results = await Promise.all(requests);

    // In bảng kết quả cho đẹp để chụp ảnh
    const summary = results.map((r, i) => ({
        "Request": i + 1,
        "HTTP_Status": r.status,
        "Message": r.data.message || r.data.error,
        "BookingID": r.data.data?.id || "---"
    }));

    console.table(summary);
    console.log("\n✅ KẾT QUẢ KIỂM THỬ: Chỉ được phép có DUY NHẤT 1 yêu cầu thành công (hoặc có ID).");
}

runTest();
