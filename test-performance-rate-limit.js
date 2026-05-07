// test-performance-rate-limit.js — TC 67: API GATEWAY RATE LIMIT
// Kịch bản: Gửi 120 requests liên tiếp cực nhanh (Burst) để vượt ngưỡng 100 req/s.
// Kỳ vọng: Các request từ 101 trở đi phải nhận mã lỗi HTTP 429.

const http = require('http');

const URL_OPTIONS = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/health', // Một path ngẫu nhiên bị rate limit (không bắt đầu bằng /resilience, /metrics...)
    method: 'GET'
};

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 67 - API GATEWAY RATE LIMITING");
    console.log("=".repeat(80));
    console.log("Kịch bản: Burst 120 requests trong vòng < 1 giây.");
    console.log("Cấu hình Gateway: 100 req / 1000ms.");
    console.log("Kỳ vọng: 100 request đầu OK, các request sau bị chặn với mã lỗi 429.\n");

    const NUM_REQUESTS = 120;
    const stats = { success: 0, rateLimited: 0, other: 0 };
    const requests = [];

    console.log(`Bắt đầu bắn ${NUM_REQUESTS} requests...`);

    for (let i = 0; i < NUM_REQUESTS; i++) {
        requests.push(new Promise((resolve) => {
            const req = http.request(URL_OPTIONS, (res) => {
                if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 401) {
                    // 404/401 vẫn coi là Gateway cho qua (không bị rate limit)
                    stats.success++;
                } else if (res.statusCode === 429) {
                    stats.rateLimited++;
                } else {
                    stats.other++;
                }
                res.resume(); // Consume stream
                resolve();
            });
            req.on('error', () => {
                stats.other++;
                resolve();
            });
            req.end();
        }));
    }

    await Promise.all(requests);

    console.log("\n--- Báo Cáo Rate Limit ---");
    console.log(`Số request được chấp nhận:  ${stats.success}`);
    console.log(`Số request bị CHẶN (429):   ${stats.rateLimited}`);
    console.log(`Lỗi khác:                   ${stats.other}`);

    console.log("\n" + "=".repeat(80));
    if (stats.rateLimited > 0) {
        console.log("✅ KẾT QUẢ: ĐẠT (PASS) - API Gateway đã chặn traffic vượt ngưỡng thành công.");
    } else {
        console.log("❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Chưa kích hoạt được Rate Limit (Thử tăng số lượng request).");
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
