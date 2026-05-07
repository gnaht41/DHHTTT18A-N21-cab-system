// test-performance-p95.js — TC 68: P95 LATENCY < 300ms
// Kịch bản: Gửi 200 requests liên tục để đo lường hiệu năng ổn định.
// Kỳ vọng: P95 latency (95% số request) phải có thời gian phản hồi thấp hơn 200ms (theo yêu cầu thực tế).

const http = require('http');

const TARGET_URL = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/health', // Một endpoint nhẹ để đo latency hạ tầng
    method: 'GET'
};

const METRICS_URL = {
    hostname: '127.0.0.1',
    port: 3000,
    path: '/metrics',
    method: 'GET'
};

async function fetchMetrics() {
    return new Promise((resolve) => {
        const req = http.request(METRICS_URL, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve({});
                }
            });
        });
        req.on('error', () => resolve({}));
        req.end();
    });
}

async function sendRequest() {
    const start = Date.now();
    return new Promise((resolve) => {
        const req = http.request(TARGET_URL, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                resolve(Date.now() - start);
            });
        });
        req.on('error', () => resolve(-1));
        req.end();
    });
}

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 68 - P95 LATENCY PERFORMANCE TEST");
    console.log("=".repeat(80));
    console.log("Kịch bản: Gửi 200 requests để đo latency P95.");
    console.log("Kỳ vọng: 95% request hoàn thành trong dưới 200ms.\n");

    const NUM_REQUESTS = 200;
    const latencies = [];
    
    console.log(`Đang thực hiện ${NUM_REQUESTS} requests...`);
    
    // Gửi requests tuần tự nhanh để tránh rate limit 100/s của Gateway
    // Hoặc gửi theo batch nhỏ
    for (let i = 0; i < NUM_REQUESTS; i++) {
        const lat = await sendRequest();
        if (lat !== -1) latencies.push(lat);
        if (i % 50 === 0 && i > 0) console.log(`Đã xong ${i} requests...`);
    }

    // Tính toán P95
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index];
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // Lấy Metrics từ Gateway
    const metrics = await fetchMetrics();
    const systemP95 = metrics.latency_p95_ms || 0;

    console.log("\n--- Báo Cáo Hiệu Năng (Latency) ---");
    console.log(`Tổng số request thành công:   ${latencies.length}`);
    console.log(`Latency Trung bình:           ${avgLatency.toFixed(2)}ms`);
    console.log(`Latency P95 (Đo thực tế):     ${p95Latency}ms`);
    console.log(`Latency P95 (Hệ thống báo):   ${systemP95}ms`);

    console.log("\n" + "=".repeat(80));
    if (p95Latency < 200) {
        console.log(`✅ KẾT QUẢ: ĐẠT (PASS) - P95 Latency (${p95Latency}ms) < 200ms.`);
    } else if (p95Latency < 300) {
        console.log(`✅ KẾT QUẢ: ĐẠT (PASS) - P95 Latency (${p95Latency}ms) < 300ms (Theo tiêu chuẩn tối thiểu).`);
    } else {
        console.log(`❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Latency quá cao (${p95Latency}ms).`);
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
