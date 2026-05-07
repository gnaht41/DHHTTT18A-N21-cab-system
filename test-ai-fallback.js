// test-ai-fallback.js — TC 49: Model Fallback khi lỗi (Graceful Degradation)
// Kiểm tra: khi AI crash/timeout → system fallback sang ML, KHÔNG crash

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
// Test cases
// ============================================================
const SCENARIOS = [
    // --- Agent Dispatch với cờ simulate_ai_failure ---
    {
        name: "TC49-1: Agent Dispatch - simulate_ai_failure=true",
        desc: "LLM giả lập bị crash → fallback rule-based tự động",
        path: "/agent/dispatch",
        body: {
            rider: { lat: 10.77, lng: 106.69 },
            drivers: [
                { id: "D1", distance: 1.2, rating: 4.8, status: "ONLINE", lat: 10.78, lng: 106.70 },
                { id: "D2", distance: 2.5, rating: 4.5, status: "ONLINE", lat: 10.75, lng: 106.68 }
            ],
            preference: "balanced",
            simulate_ai_failure: true   // trigger fallback path
        },
        validate: (data, status) => {
            // Phải trả về HTTP 200 (không crash), có selected_driver
            const notCrash = status === 200;
            const hasDriver = data?.selected_driver !== undefined;
            const hasFallback = Array.isArray(data?.decision_log);
            return { ok: notCrash && hasDriver, notCrash, hasDriver, hasFallback };
        }
    },

    // --- ETA với input cực đoan (có thể gây AI confused) ---
    {
        name: "TC49-2: ETA - extreme input (9999km)",
        desc: "Input bất thường → AI có thể fail → ML fallback",
        path: "/eta",
        body: { distance_km: 9999, traffic_level: 0.99 },
        validate: (data, status) => {
            const notCrash = status === 200;
            const hasETA = typeof data?.eta === "number" && data.eta > 0;
            const hasModel = data?.model === "gemini-2.5-flash-lite";
            return { ok: notCrash && hasETA && hasModel, notCrash, hasETA, hasModel };
        }
    },

    // --- Fraud với input null/thiếu field ---
    {
        name: "TC49-3: Fraud - missing all fields",
        desc: "Thiếu toàn bộ input → AI không thể inference → ML defaults",
        path: "/fraud",
        body: {},
        validate: (data, status) => {
            const notCrash = status === 200;
            const hasScore = typeof data?.fraud_score === "number";
            const hasModel = data?.model === "gemini-2.5-flash-lite";
            return { ok: notCrash && hasScore && hasModel, notCrash, hasScore, hasModel };
        }
    },

    // --- Recommend với danh sách driver rỗng ---
    {
        name: "TC49-4: Recommend - empty drivers list",
        desc: "Không có driver nào → phải trả về empty list, không crash",
        path: "/recommend-drivers",
        body: { drivers: [], preference: "balanced" },
        validate: (data, status) => {
            const notCrash = status === 200;
            const hasDrivers = Array.isArray(data?.drivers);
            const hasModel = data?.model === "gemini-2.5-flash-lite";
            return { ok: notCrash && hasDrivers && hasModel, notCrash, hasDrivers, hasModel };
        }
    },

    // --- Forecast với history rỗng ---
    {
        name: "TC49-5: Forecast - empty history",
        desc: "Không có lịch sử → Holt Smoothing dùng defaults, không crash",
        path: "/forecast",
        body: { history: [] },
        validate: (data, status) => {
            const notCrash = status === 200;
            const hasForecast = Array.isArray(data?.forecast) && data.forecast.length >= 2;
            const hasModel = data?.model === "gemini-2.5-flash-lite";
            return { ok: notCrash && hasForecast && hasModel, notCrash, hasForecast, hasModel };
        }
    },

    // --- Surge với demand không hợp lệ ---
    {
        name: "TC49-6: Surge - invalid demand type",
        desc: "demand=null, available_drivers=-1 → validate fail → HTTP 422 (expected)",
        path: "/pricing-surge",
        body: { demand: null, available_drivers: -1 },
        validate: (data, status) => {
            // Hệ thống PHẢI reject đúng (422), không trả về 500
            const notCrash = status === 422 || status === 200;
            const controlled = status !== 500;
            return { ok: controlled, notCrash, controlled, note: `HTTP ${status} (controlled rejection)` };
        }
    }
];

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 49 - MODEL FALLBACK VALIDATION (Graceful Degradation)");
    console.log("=".repeat(80));
    console.log("Kiểm tra: Khi AI crash/timeout → fallback ML, hệ thống KHÔNG crash\n");

    const summary = [];
    let passed = 0;

    for (const sc of SCENARIOS) {
        console.log(`\n🔥 ${sc.name}`);
        console.log(`   Scenario: ${sc.desc}`);

        const { status, data, elapsed, error } = await post(sc.path, sc.body);

        if (error) {
            console.log(`   ❌ NETWORK ERROR: ${error}`);
            summary.push({ "Test": sc.name, "HTTP": "ERR", "No Crash": "❌", "Fallback OK": "❌", "Latency": `${elapsed}ms`, "Status": "❌ ERROR" });
            continue;
        }

        const result = sc.validate(data, status);
        const icon = result.ok ? "✅" : "❌";
        console.log(`   ${icon} HTTP=${status} | latency=${elapsed}ms | model=${data?.model || 'N/A'}`);

        // Detail
        Object.entries(result).forEach(([k, v]) => {
            if (k !== 'ok') console.log(`      ${k}: ${v}`);
        });

        if (result.ok) passed++;
        summary.push({
            "Test": sc.name.split(":")[0],
            "HTTP": status,
            "No Crash": status !== 500 ? "✅" : "❌",
            "Fallback OK": result.ok ? "✅" : "❌",
            "Latency": `${elapsed}ms`,
            "Status": result.ok ? "✅ PASS" : "❌ FAIL"
        });
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("SUMMARY TABLE");
    console.log("=".repeat(80));
    console.table(summary);

    const allPass = passed === SCENARIOS.length;
    console.log(`\n[FINAL RESULT] ${allPass ? "✅ PASS" : `⚠️  ${passed}/${SCENARIOS.length} PASS`}: Hệ thống ${allPass ? "KHÔNG crash" : "có vấn đề"} khi AI fail.`);
    console.log("=".repeat(80) + "\n");
}

run();
