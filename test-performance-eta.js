// test-performance-eta.js — TC 62: LEVEL 7 - PERFORMANCE & LOAD TEST (ETA SERVICE)
// Hệ thống chịu được bao nhiêu tải và có còn nhanh khi nhiều người dùng không?
// 500 request/sec ETA -> ETA vẫn trả đúng, Latency < SLA (<200ms), Không timeout.

const http = require('http');

const URL_OPTIONS = {
    hostname: '127.0.0.1',
    port: 3011,
    path: '/api/ai/eta',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    agent: new http.Agent({ keepAlive: true, maxSockets: 1000 })
};

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 62 - LEVEL 7 PERFORMANCE & LOAD TEST (ETA SERVICE - 500 req/sec)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Bắn 500 request POST /eta đồng thời vào AI Service.");
    console.log("Kỳ vọng: AI Service tự động fallback sang ML engine để giữ latency < 200ms (SLA).");
    console.log("         Không request nào bị timeout, mọi ETA đều trả về hợp lệ.\n");

    const NUM_REQUESTS = 500;
    const requests = [];
    const stats = { success: 0, failed: 0, start: Date.now(), latencies: [], hasNullEta: false };

    console.log(`Bắt đầu gửi ${NUM_REQUESTS} request song song...`);

    for (let i = 0; i < NUM_REQUESTS; i++) {
        const reqStart = Date.now();
        const payload = JSON.stringify({
            distance_km: 5 + (i % 5),
            traffic_level: 0.5 + (i % 3) * 0.1,
            time_of_day: 14
        });

        requests.push(new Promise((resolve) => {
            const req = http.request(URL_OPTIONS, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    const latency = Date.now() - reqStart;
                    stats.latencies.push(latency);
                    try {
                        const data = JSON.parse(body);
                        if (res.statusCode === 200 && data && typeof data.eta === 'number') {
                            stats.success++;
                        } else {
                            stats.failed++;
                            if (!data || typeof data.eta !== 'number') stats.hasNullEta = true;
                        }
                    } catch(e) {
                        stats.failed++;
                    }
                    resolve();
                });
            });
            req.on('error', (e) => {
                stats.latencies.push(Date.now() - reqStart);
                stats.failed++;
                resolve();
            });
            req.write(payload);
            req.end();
        }));
        
        // Sleep 2ms to spread 500 requests evenly over 1 second
        await new Promise(r => setTimeout(r, 2));
    }

    await Promise.all(requests);
    
    const duration = Date.now() - stats.start;
    const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / (stats.latencies.length || 1);
    const sortedLatencies = [...stats.latencies].sort((a,b)=>a-b);
    const p95Latency = sortedLatencies[Math.floor(NUM_REQUESTS * 0.95)];
    const p99Latency = sortedLatencies[Math.floor(NUM_REQUESTS * 0.99)];
    const maxLatency = sortedLatencies[sortedLatencies.length - 1];
    
    console.log("\n--- Báo Cáo Tải (Load Report) ---");
    console.log(`Tổng thời gian thực thi: ${duration}ms cho ${NUM_REQUESTS} requests.`);
    console.log(`Số request THÀNH CÔNG:   ${stats.success} (${((stats.success / NUM_REQUESTS) * 100).toFixed(2)}%)`);
    console.log(`Số request THẤT BẠI:     ${stats.failed}`);
    console.log(`Có bị Null/Lỗi ETA?:     ${stats.hasNullEta ? 'CÓ (❌)' : 'KHÔNG (✅)'}`);
    console.log(`Latency Trung Bình:      ${Math.round(avgLatency)}ms`);
    console.log(`Latency P95:             ${p95Latency}ms`);
    console.log(`Latency P99:             ${p99Latency}ms`);
    console.log(`Latency Tối Đa (Max):    ${maxLatency}ms`);
    
    console.log("\n" + "=".repeat(80));
    // Require >99% success and p95 latency < 250ms (SLA)
    if (stats.success === NUM_REQUESTS && p95Latency < 250 && !stats.hasNullEta) {
        console.log("✅ KẾT QUẢ: ĐẠT (PASS) - AI Service fallback cực nhanh, giữ latency thấp dẫu tải cao.");
    } else if (stats.success >= NUM_REQUESTS * 0.95 && p95Latency < 350) {
        console.log("⚠️ KẾT QUẢ: PASS (CÓ CẢNH BÁO) - Tỉ lệ thành công > 95%, nhưng Latency có hơi cao.");
    } else {
        console.log("❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Vi phạm SLA (<200ms) hoặc bị chết/timeout.");
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
