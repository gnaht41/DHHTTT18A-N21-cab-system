// test-performance-booking.js — TC 61: LEVEL 7 - PERFORMANCE & LOAD TEST
// 1000 requests/second vào /booking -> Không crash, Response success cao (>95%), Latency ổn định

const URL = "http://127.0.0.1:3002/api/bookings"; // Gọi trực tiếp vào Booking Service

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 61 - LEVEL 7 PERFORMANCE & LOAD TEST (1000 requests/sec)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Bắn 1000 request POST /booking đồng thời.");
    console.log("Kỳ vọng: Không crash hệ thống, tỉ lệ thành công > 95%, độ trễ (latency) ổn định.\n");

    const NUM_REQUESTS = 1000;
    const requests = [];
    const stats = { success: 0, failed: 0, start: Date.now(), latencies: [] };

    console.log(`Bắt đầu gửi ${NUM_REQUESTS} request song song...`);

    for (let i = 0; i < NUM_REQUESTS; i++) {
        const reqStart = Date.now();
        requests.push(
            fetch(URL, {
                method: 'POST',
                headers: {
                    'x-user-id': '999', // User test
                    'x-idempotency-key': 'loadtest-' + Date.now() + '-' + i,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pickup: { lat: 10.76, lng: 106.66 },
                    destination: { lat: 10.77, lng: 106.70 },
                    distance: 5.0,
                    price: 50000
                })
            })
            .then(res => {
                // Read text to avoid parsing error if 500 HTML
                return res.text().then(text => {
                    let data = null;
                    try { data = JSON.parse(text); } catch(e) {}
                    return { status: res.status, data: data || text };
                });
            })
            .then(res => {
                stats.latencies.push(Date.now() - reqStart);
                if (res.status === 201 || res.status === 200) {
                    stats.success++;
                } else {
                    stats.failed++;
                }
            })
            .catch(err => {
                stats.latencies.push(Date.now() - reqStart);
                stats.failed++;
            })
        );
    }

    // Đợi tất cả request hoàn thành
    await Promise.all(requests);
    
    const duration = Date.now() - stats.start;
    const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / (stats.latencies.length || 1);
    const p95Latency = [...stats.latencies].sort((a,b)=>a-b)[Math.floor(NUM_REQUESTS * 0.95)];
    const maxLatency = Math.max(...stats.latencies);
    const successRate = ((stats.success / NUM_REQUESTS) * 100).toFixed(2);
    
    console.log("\n--- Báo Cáo Tải (Load Report) ---");
    console.log(`Tổng thời gian thực thi: ${duration}ms cho ${NUM_REQUESTS} requests.`);
    console.log(`Số request THÀNH CÔNG:   ${stats.success} (${successRate}%)`);
    console.log(`Số request THẤT BẠI:     ${stats.failed}`);
    console.log(`Latency Trung Bình:      ${Math.round(avgLatency)}ms`);
    console.log(`Latency P95:             ${p95Latency}ms`);
    console.log(`Latency Tối Đa (Max):    ${maxLatency}ms`);
    
    console.log("\n" + "=".repeat(80));
    if (successRate >= 95) {
        console.log("✅ KẾT QUẢ: ĐẠT (PASS) - Hệ thống chịu tải tốt, không crash, success > 95%.");
    } else {
        console.log("❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Tỉ lệ thành công dưới 95% hoặc hệ thống bị thắt cổ chai.");
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
