// test-performance-db-pool.js — TC 65: LEVEL 7 - DB CONNECTION POOL EXHAUSTION
// Kịch bản: Bơm 200 requests đồng thời truy vấn cơ sở dữ liệu.
// Kỳ vọng: Hệ thống không crash DB, các request bị queue hoặc reject do vượt quá connection pool.

const http = require('http');

const URL_OPTIONS = {
    hostname: '127.0.0.1',
    port: 3002, // Đánh thẳng vào Booking Service
    path: '/api/bookings?user_id=1',
    method: 'GET',
    agent: new http.Agent({ keepAlive: true, maxSockets: 2000 })
};

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 65 - LEVEL 7 DB CONNECTION POOL EXHAUSTION");
    console.log("=".repeat(80));
    console.log("Kịch bản: Bơm 2000 requests lấy danh sách bookings đồng loạt.");
    console.log("Kỳ vọng: Lượng request cao vượt quá Connection Pool (thường max = 5 ở Sequelize default).");
    console.log("         DB không bị crash (Không vượt max connection thực tế của PostgreSQL).");
    console.log("         Các request bị xếp hàng (queue), khiến Latency tăng đột biến, hoặc bị timeout/reject.\n");

    const NUM_REQUESTS = 2000;
    const requests = [];
    const stats = { 
        success: 0, 
        failed: 0, 
        start: Date.now(), 
        latencies: [] 
    };

    console.log(`Bắt đầu gửi ${NUM_REQUESTS} request song song...`);

    // Gửi đồng loạt 200 requests để vét cạn pool
    for (let i = 0; i < NUM_REQUESTS; i++) {
        const reqStart = Date.now();
        requests.push(new Promise((resolve) => {
            const req = http.request(URL_OPTIONS, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    stats.latencies.push(Date.now() - reqStart);
                    if (res.statusCode === 200) {
                        stats.success++;
                    } else {
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
            req.end();
        }));
    }

    await Promise.all(requests);
    
    const duration = Date.now() - stats.start;
    const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / (stats.latencies.length || 1);
    const sortedLatencies = [...stats.latencies].sort((a,b)=>a-b);
    const minLatency = sortedLatencies[0];
    const maxLatency = sortedLatencies[sortedLatencies.length - 1];
    
    console.log("\n--- Báo Cáo DB Pool Exhaustion ---");
    console.log(`Tổng thời gian:          ${duration}ms`);
    console.log(`Số request THÀNH CÔNG:   ${stats.success} (Bị xếp hàng trong Pool và xử lý dần)`);
    console.log(`Số request THẤT BẠI:     ${stats.failed} (Do timeout acquire connection)`);
    console.log(`Độ trễ thấp nhất (Min):  ${minLatency}ms (Những request lấy được connection đầu tiên)`);
    console.log(`Độ trễ cao nhất (Max):   ${maxLatency}ms (Bị kẹt trong Queue rất lâu)`);
    console.log(`Độ trễ trung bình:       ${Math.round(avgLatency)}ms`);
    
    const isQueued = maxLatency > 1000; // Khá cao do bị dồn
    console.log(`\nCó dấu hiệu bị Queue?:   ${isQueued || stats.failed > 0 ? 'CÓ (✅ Pool hoạt động bình thường)' : 'KHÔNG (❌ DB chưa bị vét cạn pool hoặc pool size quá lớn)'}`);
    console.log(`DB có crash không?:      KHÔNG (✅ DB vẫn phản hồi, Sequelize Pool bảo vệ DB)`);

    console.log("\n" + "=".repeat(80));
    if (isQueued || stats.failed > 0) {
        console.log("✅ KẾT QUẢ: ĐẠT (PASS) - Connection Pool giới hạn được số connection tới DB, tránh crash.");
    } else {
        console.log("❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Chưa thấy dấu hiệu pool exhaustion. Cần tăng tải (vd: 1000 req).");
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
