// test-performance-pricing.js — TC 63: LEVEL 7 - PERFORMANCE & LOAD TEST (PRICING SERVICE)
// Hệ thống chịu tải khi có lượng truy cập đột biến (spike) vào giờ cao điểm
// 1000 request/sec Pricing -> Không crash, giá hợp lệ, không trả giá sai.

const http = require('http');

const URL_OPTIONS = {
    hostname: '127.0.0.1',
    port: 3008,
    path: '/api/pricing/estimate',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    agent: new http.Agent({ keepAlive: true, maxSockets: 2000 })
};

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 63 - LEVEL 7 PERFORMANCE & LOAD TEST (PRICING SERVICE - SPIKE)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Giả lập 1000 users đồng loạt yêu cầu xem giá (Estimate Pricing).");
    console.log("Kỳ vọng: Pricing Service KHÔNG CRASH, KHÔNG TRẢ LỖI DB.");
    console.log("         Giá trả về hợp lệ (thay đổi theo demand/surge) và không bao giờ bị NaN/null.\n");

    const NUM_REQUESTS = 1000;
    const requests = [];
    const stats = { 
        success: 0, 
        failed: 0, 
        start: Date.now(), 
        latencies: [], 
        hasInvalidPrice: false 
    };

    console.log(`Bắt đầu gửi ${NUM_REQUESTS} request song song...`);

    // Bắn thẳng toàn bộ trong 1 cục cực nhanh (Spike Test) thay vì dàn trải đều
    for (let i = 0; i < NUM_REQUESTS; i++) {
        const reqStart = Date.now();
        // Giả lập giờ cao điểm với demand_index cực cao
        const payload = JSON.stringify({
            pickup: { lat: 10.762622, lng: 106.660172 },
            destination: { lat: 10.776889, lng: 106.700806 },
            distance: 5000 + (i % 10) * 100, // 5km - 6km
            demand_index: 2.5 + (i % 5) * 0.1, // Surge từ 2.5 tới 2.9
            supply_index: 1.0
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
                        if (res.statusCode === 200 && data && data.estimates && data.estimates.length > 0) {
                            let isValid = true;
                            // Check nếu giá bị sai, null, NaN
                            for (let est of data.estimates) {
                                if (typeof est.price !== 'number' || isNaN(est.price) || est.price <= 0) {
                                    isValid = false;
                                }
                            }
                            if (isValid) {
                                stats.success++;
                            } else {
                                stats.hasInvalidPrice = true;
                                stats.failed++;
                            }
                        } else {
                            stats.failed++;
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
        
        // Sleep cực ngắn 1ms để duy trì nhịp độ nhưng vẫn ép tải rất lớn
        await new Promise(r => setTimeout(r, 1));
    }

    await Promise.all(requests);
    
    const duration = Date.now() - stats.start;
    const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / (stats.latencies.length || 1);
    const sortedLatencies = [...stats.latencies].sort((a,b)=>a-b);
    const p95Latency = sortedLatencies[Math.floor(NUM_REQUESTS * 0.95)] || 0;
    
    console.log("\n--- Báo Cáo Tải (Spike Report) ---");
    console.log(`Tổng thời gian thực thi: ${duration}ms cho ${NUM_REQUESTS} requests.`);
    console.log(`Số request THÀNH CÔNG:   ${stats.success} (${((stats.success / NUM_REQUESTS) * 100).toFixed(2)}%)`);
    console.log(`Số request THẤT BẠI:     ${stats.failed}`);
    console.log(`Có bị Giá Sai/Null/NaN?: ${stats.hasInvalidPrice ? 'CÓ (❌)' : 'KHÔNG (✅)'}`);
    console.log(`Latency Trung Bình:      ${Math.round(avgLatency)}ms`);
    console.log(`Latency P95:             ${p95Latency}ms`);
    
    console.log("\n" + "=".repeat(80));
    if (stats.success === NUM_REQUESTS && !stats.hasInvalidPrice) {
        console.log("✅ KẾT QUẢ: ĐẠT (PASS) - Pricing Service không crash, giá trả về chính xác 100%.");
    } else {
        console.log("❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Service quá tải, bị crash hoặc giá trả về lỗi.");
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
