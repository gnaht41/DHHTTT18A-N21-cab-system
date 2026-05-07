// test-ai-latency.js — TC 47: AI Service Latency < 200ms SLA
// Kiểm tra: response time < 200ms với nhiều request đồng thời

const BASE_URL = "http://localhost:3011/api/ai";
const SLA_MS = 200; // Service Level Agreement
const CONCURRENT = 5; // Số request đồng thời mỗi endpoint

const ENDPOINTS = [
    {
        name: "ETA Service",
        path: "/eta",
        body: { distance_km: 5, traffic_level: 0.5 }
    },
    {
        name: "Fraud Detection",
        path: "/fraud",
        body: { user_history_score: 0.8, transaction_amount: 50, ip_country: "VN", device_fingerprint_match: true, booking_frequency_1h: 2 }
    },
    {
        name: "Driver Recommend",
        path: "/recommend-drivers",
        body: { drivers: [{ id: "D1", distance: 1.2, rating: 4.8 }, { id: "D2", distance: 2.5, rating: 4.5 }], preference: "balanced" }
    },
    {
        name: "Forecast Service",
        path: "/forecast",
        body: { history: [{ hour: "08:00", demand: 45 }, { hour: "09:00", demand: 72 }] }
    }
];

async function measureLatency(name, path, body) {
    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const elapsed = performance.now() - start;
        const ok = res.status === 200;
        return { name, latency: Math.round(elapsed), status: ok ? res.status : res.status, pass: ok && elapsed < SLA_MS };
    } catch (e) {
        const elapsed = performance.now() - start;
        return { name, latency: Math.round(elapsed), status: "ERROR", pass: false, error: e.message };
    }
}

async function runBatch(endpoint) {
    // Chạy CONCURRENT request đồng thời
    const promises = Array.from({ length: CONCURRENT }, () =>
        measureLatency(endpoint.name, endpoint.path, endpoint.body)
    );
    return await Promise.all(promises);
}

function stats(latencies) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1];
    const max = sorted[sorted.length - 1];
    const min = sorted[0];
    return { min, avg, p95, p99, max };
}

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 47 - AI SERVICE LATENCY SLA VALIDATION (< 200ms)");
    console.log("=".repeat(80));
    console.log(`Sending ${CONCURRENT} concurrent requests per endpoint...\n`);

    const summary = [];
    let totalPass = 0;
    let totalFail = 0;

    for (const ep of ENDPOINTS) {
        const results = await runBatch(ep);
        const latencies = results.map(r => r.latency);
        const passCount = results.filter(r => r.pass).length;
        const s = stats(latencies);

        const allPass = passCount === CONCURRENT;
        if (allPass) totalPass++; else totalFail++;

        summary.push({
            "Endpoint": ep.name,
            "Requests": CONCURRENT,
            "Avg (ms)": s.avg,
            "P95 (ms)": s.p95,
            "Max (ms)": s.max,
            "SLA < 200ms": `${passCount}/${CONCURRENT}`,
            "Status": allPass ? "✅ PASS" : "⚠️  PARTIAL"
        });

        // Per-request detail
        results.forEach((r, i) => {
            const icon = r.pass ? "  ✅" : "  ⚠️ ";
            console.log(`${icon} [${ep.name}] Request #${i + 1}: ${r.latency}ms (${r.latency < SLA_MS ? "within SLA" : "OVER SLA"})`);
        });
        console.log(`     Stats → min=${s.min}ms | avg=${s.avg}ms | p95=${s.p95}ms | max=${s.max}ms\n`);
    }

    console.log("=".repeat(80));
    console.log("SUMMARY TABLE");
    console.log("=".repeat(80));
    console.table(summary);

    const overall = totalFail === 0;
    console.log(`\n[FINAL RESULT] ${overall ? "✅ PASS" : "⚠️  PARTIAL PASS"}: ${totalPass}/${ENDPOINTS.length} endpoints đạt SLA < ${SLA_MS}ms trên toàn bộ ${CONCURRENT} request đồng thời.`);
    console.log("=".repeat(80) + "\n");
}

run();
