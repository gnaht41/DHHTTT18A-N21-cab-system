// test-ai-drift.js — TC 48: Model Drift Detection
// Kiểm tra: hệ thống phát hiện drift khi phân phối dữ liệu thay đổi

const BASE_URL = "http://localhost:3011/api/ai";

async function callDriftDetect(payload) {
    const res = await fetch(`${BASE_URL}/drift-detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return { status: res.status, data: await res.json() };
}

// ============================================================
// Các kịch bản drift từ thực tế
// ============================================================
const TEST_CASES = [
    {
        name: "No Drift — Model stable",
        desc: "Dữ liệu production giống training data, không cần retrain",
        payload: {
            distribution_shift_metric: 0.05,
            feature: "traffic_level",
            baseline_mean: 0.5,
            current_mean: 0.52,
            baseline_std: 0.1,
            current_std: 0.11
        },
        expect: { drift_detected: false, severity: "LOW" }
    },
    {
        name: "Medium Drift — Review needed",
        desc: "Giờ cao điểm thay đổi → ETA model bắt đầu sai lệch nhẹ",
        payload: {
            distribution_shift_metric: 0.45,
            feature: "hour_of_day",
            baseline_mean: 12,
            current_mean: 8,
            baseline_std: 3.5,
            current_std: 2.1
        },
        expect: { drift_detected: true, severity: "MEDIUM" }
    },
    {
        name: "High Drift — Retrain required",
        desc: "Mưa lớn kéo dài → traffic_level luôn = 0.9, model cũ không nhận ra",
        payload: {
            distribution_shift_metric: 0.75,
            feature: "traffic_level",
            baseline_mean: 0.5,
            current_mean: 0.88,
            baseline_std: 0.1,
            current_std: 0.05
        },
        expect: { drift_detected: true, severity: "HIGH" }
    },
    {
        name: "Extreme Drift — Emergency alert",
        desc: "Sự kiện đột xuất (concert/bão) → toàn bộ demand pattern thay đổi",
        payload: {
            distribution_shift_metric: 0.95,
            feature: "demand",
            baseline_mean: 45,
            current_mean: 180,
            baseline_std: 12,
            current_std: 45
        },
        expect: { drift_detected: true, severity: "HIGH" }
    },
    {
        name: "Just Below Threshold",
        desc: "Ngưỡng biên: 0.29 < 0.3 → không trigger alert",
        payload: {
            distribution_shift_metric: 0.29,
            feature: "distance_km",
            baseline_mean: 8,
            current_mean: 9.5,
            baseline_std: 4,
            current_std: 4.2
        },
        expect: { drift_detected: false, severity: "LOW" }
    }
];

function check(actual, expected, caseName) {
    const driftOk = actual.drift_detected === expected.drift_detected;
    const severityOk = actual.severity === expected.severity;
    const hasRecommendation = typeof actual.recommendation === "string" && actual.recommendation.length > 0;

    if (driftOk && severityOk && hasRecommendation) {
        console.log(`  ✅ [PASS] ${caseName}`);
        console.log(`         drift_detected=${actual.drift_detected} | severity=${actual.severity}`);
        console.log(`         recommendation: "${actual.recommendation}"`);
        return true;
    } else {
        console.log(`  ❌ [FAIL] ${caseName}`);
        if (!driftOk) console.log(`         drift_detected: expected=${expected.drift_detected}, got=${actual.drift_detected}`);
        if (!severityOk) console.log(`         severity: expected=${expected.severity}, got=${actual.severity}`);
        if (!hasRecommendation) console.log(`         recommendation: missing or empty`);
        return false;
    }
}

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 48 - MODEL DRIFT DETECTION VALIDATION");
    console.log("=".repeat(80));
    console.log("Mô phỏng các kịch bản phân phối dữ liệu thay đổi theo thời gian...\n");

    const results = [];

    for (const tc of TEST_CASES) {
        console.log(`\n📊 Scenario: ${tc.name}`);
        console.log(`   Context: ${tc.desc}`);
        console.log(`   Input: shift_metric=${tc.payload.distribution_shift_metric}, feature="${tc.payload.feature}"`);

        try {
            const { status, data } = await callDriftDetect(tc.payload);
            const pass = check(data, tc.expect, tc.name);
            results.push({
                "Scenario": tc.name,
                "Shift Metric": tc.payload.distribution_shift_metric,
                "Expected Drift": tc.expect.drift_detected,
                "Got Drift": data.drift_detected,
                "Severity": data.severity,
                "HTTP": status,
                "Status": pass ? "✅ PASS" : "❌ FAIL"
            });
        } catch (e) {
            console.log(`  ❌ [ERROR] ${tc.name}: ${e.message}`);
            results.push({
                "Scenario": tc.name,
                "Shift Metric": tc.payload.distribution_shift_metric,
                "Expected Drift": tc.expect.drift_detected,
                "Got Drift": "ERROR",
                "Severity": "ERROR",
                "HTTP": "N/A",
                "Status": "❌ ERROR"
            });
        }
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("SUMMARY TABLE");
    console.log("=".repeat(80));
    console.table(results);

    const passed = results.filter(r => r.Status === "✅ PASS").length;
    const total = results.length;
    const allPass = passed === total;

    console.log(`\n[FINAL RESULT] ${allPass ? "✅ PASS" : "❌ FAIL"}: ${passed}/${total} kịch bản drift được phát hiện đúng.`);
    if (!allPass) {
        console.log("→ Kiểm tra endpoint /drift-detect trong ai-service/server.js");
    }
    console.log("=".repeat(80) + "\n");
}

run();
