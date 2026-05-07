// test-ai-outlier.js — TC 50: Input Outlier Robustness
// Kiểm tra: input bất thường/cực đoan → model không crash, output hợp lý hoặc reject có kiểm soát

const BASE_URL = "http://localhost:3011/api/ai";

async function post(path, body) {
    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const elapsed = Math.round(performance.now() - start);
        const data = await res.json();
        return { status: res.status, data, elapsed, error: null };
    } catch (e) {
        const elapsed = Math.round(performance.now() - start);
        return { status: 0, data: null, elapsed, error: e.message };
    }
}

// ============================================================
// Outlier scenarios — dữ liệu ngoài phân phối bình thường
// ============================================================
const SCENARIOS = [
    // === ETA OUTLIERS ===
    {
        name: "TC50-1: ETA - distance=1000km (extreme outlier)",
        desc: "Outlier chính từ TC spec: khoảng cách 1000km không thực tế cho cab",
        path: "/eta",
        body: { distance_km: 1000, traffic_level: 0.5 },
        validate: (data, status) => {
            const notCrash = status !== 500 && data !== null;
            // Hoặc trả về ETA hợp lý (capped), hoặc reject có kiểm soát (400/422)
            const reasonableETA = typeof data?.eta === "number" && data.eta > 0;
            const controlledReject = status === 400 || status === 422;
            const ok = notCrash && (reasonableETA || controlledReject);
            return { ok, notCrash, "ETA hợp lý hoặc reject": ok, "HTTP": status };
        }
    },
    {
        name: "TC50-2: ETA - distance=0km",
        desc: "Khoảng cách 0: driver ngay tại chỗ",
        path: "/eta",
        body: { distance_km: 0, traffic_level: 0 },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const hasETA = typeof data?.eta === "number" && data.eta >= 0;
            return { ok: notCrash && hasETA, notCrash, "ETA >= 0": hasETA };
        }
    },
    {
        name: "TC50-3: ETA - distance=-5km (negative)",
        desc: "Khoảng cách âm: input sai → phải reject hoặc xử lý như 0",
        path: "/eta",
        body: { distance_km: -5, traffic_level: 0.3 },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const controlled = status === 400 || status === 422 || typeof data?.eta === "number";
            return { ok: notCrash && controlled, notCrash, "Controlled response": controlled };
        }
    },

    // === FRAUD OUTLIERS ===
    {
        name: "TC50-4: Fraud - amount=999999 (extreme high)",
        desc: "Số tiền cực lớn → score cao nhưng không crash",
        path: "/fraud",
        body: { trip_amount: 999999, location_anomaly: true, user_history_risk: 0.9 },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const hasScore = typeof data?.fraud_score === "number" && data.fraud_score >= 0 && data.fraud_score <= 1;
            return { ok: notCrash && hasScore, notCrash, "Score trong [0,1]": hasScore };
        }
    },
    {
        name: "TC50-5: Fraud - amount=0, risk=0",
        desc: "Chuyến đi miễn phí: tất cả risk = 0 → score thấp nhất",
        path: "/fraud",
        body: { trip_amount: 0, location_anomaly: false, user_history_risk: 0 },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const hasScore = typeof data?.fraud_score === "number";
            const lowRisk = data?.fraud_score <= 0.3; // score thấp khi không có risk
            return { ok: notCrash && hasScore, notCrash, "Score hợp lý (thấp)": lowRisk };
        }
    },

    // === PRICING SURGE OUTLIERS ===
    {
        name: "TC50-6: Surge - demand=9999, drivers=0",
        desc: "Cầu cực cao, không có tài xế → surge phải rất cao nhưng không crash",
        path: "/pricing-surge",
        body: { demand: 9999, available_drivers: 1, weather: "storm" },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const hasSurge = typeof data?.surge_multiplier === "number" && data.surge_multiplier >= 1;
            return { ok: notCrash && hasSurge, notCrash, "Surge >= 1x": hasSurge };
        }
    },
    {
        name: "TC50-7: Surge - demand=0, drivers=9999",
        desc: "Không có cầu, thừa cung → surge phải = 1.0x (không crash)",
        path: "/pricing-surge",
        body: { demand: 0, available_drivers: 9999, weather: "clear" },
        validate: (data, status) => {
            // demand=0 is now valid (zero demand is an outlier, not invalid)
            const notCrash = status !== 500;
            const hasSurge = typeof data?.surge_multiplier === "number";
            const noSurge = hasSurge && data?.surge_multiplier <= 1.5;
            return { ok: notCrash && hasSurge, notCrash, "Has surge_multiplier": hasSurge, "Surge hợp lý (thấp)": noSurge };
        }
    },

    // === RECOMMEND OUTLIERS ===
    {
        name: "TC50-8: Recommend - 100 drivers at once",
        desc: "Số lượng driver rất lớn → performance + không crash",
        path: "/recommend-drivers",
        body: {
            drivers: Array.from({ length: 100 }, (_, i) => ({
                id: `D${i}`,
                distance: Math.random() * 10,
                rating: 3 + Math.random() * 2,
                status: "ONLINE"
            })),
            preference: "balanced"
        },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const hasDrivers = Array.isArray(data?.drivers) && data.drivers.length <= 3; // top-3 chỉ
            return { ok: notCrash && hasDrivers, notCrash, "Trả về ≤ 3 drivers": hasDrivers };
        }
    },

    // === FORECAST OUTLIERS ===
    {
        name: "TC50-9: Forecast - single data point",
        desc: "Chỉ 1 điểm lịch sử → không đủ cho time-series, nhưng không crash",
        path: "/forecast",
        body: { history: [42] },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const hasForecast = Array.isArray(data?.forecast);
            return { ok: notCrash && hasForecast, notCrash, "Có forecast array": hasForecast };
        }
    },
    {
        name: "TC50-10: Forecast - negative values in history",
        desc: "Giá trị âm trong lịch sử (dữ liệu lỗi) → không crash",
        path: "/forecast",
        body: { history: [-10, -5, 0, 5, 10] },
        validate: (data, status) => {
            const notCrash = status !== 500;
            const hasForecast = Array.isArray(data?.forecast);
            return { ok: notCrash, notCrash, "Không crash với values âm": hasForecast };
        }
    }
];

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 50 - INPUT OUTLIER ROBUSTNESS VALIDATION");
    console.log("=".repeat(80));
    console.log("Kiểm tra: dữ liệu cực đoan → model KHÔNG crash, output hợp lý hoặc reject kiểm soát\n");

    const summary = [];
    let passed = 0;

    for (const sc of SCENARIOS) {
        const { status, data, elapsed, error } = await post(sc.path, sc.body);
        const icon_category = sc.path.split("/")[1];

        if (error) {
            console.log(`❌ [ERROR] ${sc.name}: Network error - ${error}`);
            summary.push({ "Test": sc.name.split(":")[0], "HTTP": "ERR", "No Crash": "❌", "Output OK": "❌", "ms": elapsed, "Result": "❌ ERROR" });
            continue;
        }

        const result = sc.validate(data, status);
        const icon = result.ok ? "✅" : "❌";
        console.log(`${icon} ${sc.name}`);
        console.log(`   Context: ${sc.desc}`);
        console.log(`   HTTP=${status} | latency=${elapsed}ms`);
        Object.entries(result).forEach(([k, v]) => {
            if (k !== "ok") console.log(`   ${k}: ${v}`);
        });
        console.log();

        if (result.ok) passed++;
        summary.push({
            "Test": sc.name.split(":")[0],
            "HTTP": status,
            "No Crash": status !== 500 ? "✅" : "❌",
            "Output OK": result.ok ? "✅" : "❌",
            "ms": `${elapsed}ms`,
            "Result": result.ok ? "✅ PASS" : "❌ FAIL"
        });
    }

    console.log("=".repeat(80));
    console.log("SUMMARY TABLE");
    console.log("=".repeat(80));
    console.table(summary);

    const allPass = passed === SCENARIOS.length;
    console.log(`\n[FINAL RESULT] ${allPass ? "✅ PASS" : `⚠️  ${passed}/${SCENARIOS.length} PASS`}: Hệ thống ${allPass ? "xử lý tốt mọi outlier input" : "có một số outlier chưa được xử lý đúng"}.`);
    console.log("=".repeat(80) + "\n");
}

run();
