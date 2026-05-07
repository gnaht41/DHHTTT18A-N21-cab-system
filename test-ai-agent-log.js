// test-ai-agent-log.js — TC 58: AI Agent Logic (Log Decision & Trace ID)
// Kiểm tra Agent có trả về decision_log chi tiết (lý do chọn driver) và trace_id (để tracking) hay không.

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

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 58 - LEVEL 6 AI AGENT LOGIC (DECISION LOG & TRACE ID)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Thực hiện Dispatch thông thường.");
    console.log("Kỳ vọng: Agent trả về `decision_log` giải thích lý do chọn driver và có `trace_id`.\n");

    const payload = {
        rider: { lat: 10.00, lng: 106.00 },
        preference: "nearest",
        drivers: [
            { id: "Driver_1", name: "Driver 1", status: "ONLINE", lat: 10.01, lng: 106.00, eta: 2, price: 20 },
            { id: "Driver_2", name: "Driver 2", status: "ONLINE", lat: 10.05, lng: 106.00, eta: 10, price: 50 }
        ]
    };

    console.log("Sending Context to Agent Dispatch (Preference: nearest)...\n");

    const { status, data, elapsed, error } = await post("/agent/dispatch", payload);

    if (error || status !== 200) {
        console.log(`❌ Lỗi gọi API: HTTP ${status} | Error: ${error || JSON.stringify(data)}`);
        return;
    }

    const hasLog = Array.isArray(data.decision_log) && data.decision_log.length > 0;
    const hasTraceId = typeof data.trace_id === "string" && data.trace_id.length > 0;

    const icon = (hasLog && hasTraceId) ? "✅ PASS" : "❌ FAIL";
    console.log(`[KẾT QUẢ] ${icon} | HTTP 200 | Latency: ${elapsed}ms | Engine: ${data.model}\n`);
    
    console.log("--- Phản hồi từ Agent ---");
    console.log(`Trace ID: ${data.trace_id || "MISSING"}`);
    console.log(`Driver được chọn: ${data.selected_driver?.id}`);
    
    console.log("\n--- Decision Log (Lý do chọn) ---");
    if (hasLog) {
        data.decision_log.forEach(log => console.log(`> ${log}`));
    } else {
        console.log("Không có log hoặc log trống!");
    }
    
    console.log("\n" + "=".repeat(80));
    if (hasLog && hasTraceId) {
        console.log("Thành công: Agent đã trả về đầy đủ Decision Log và Trace ID.");
    } else {
        console.log("Thất bại: Thiếu Decision Log hoặc Trace ID trong response.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
