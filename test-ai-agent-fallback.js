// test-ai-agent-fallback.js — TC 60: AI Agent Logic (Fallback Rule-based on AI Failure)
// Kiểm tra khi AI Model (Gemini) bị crash hoặc timeout, hệ thống có tự động chuyển sang Fallback Rule-based không.

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
    console.log("TC 60 - LEVEL 6 AI AGENT LOGIC (RULE-BASED FALLBACK ON AI CRASH)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Giả lập LLM (Gemini) bị lỗi/timeout không phản hồi.");
    console.log("Kỳ vọng: Hệ thống không bị sập, tự động chạy Rule-based Fallback, vẫn trả về kết quả tài xế hợp lý.\n");

    const payload = {
        rider: { lat: 10.00, lng: 106.00 },
        preference: "nearest",
        simulate_llm_crash: true, // Biến này sẽ trigger lỗi giả lập trong block try-catch của AI Model
        drivers: [
            { id: "Driver_Far", name: "Driver Far", status: "ONLINE", lat: 10.10, lng: 106.00, eta: 15, price: 100 },
            { id: "Driver_Near", name: "Driver Near", status: "ONLINE", lat: 10.01, lng: 106.00, eta: 2, price: 20 }
        ]
    };

    console.log("Sending Context to Agent (Simulating LLM Crash)...");
    console.log("- Preference: nearest");
    console.log("- Expected Fallback: Driver_Near\n");

    const { status, data, elapsed, error } = await post("/agent/dispatch", payload);

    if (error || status !== 200) {
        console.log(`❌ Lỗi gọi API: HTTP ${status} | Error: ${error || JSON.stringify(data)}`);
        return;
    }

    const isFallback = data.model === "fallback";
    const selectedId = data.selected_driver?.id;
    const isCorrectDriver = selectedId === "Driver_Near";

    const icon = (isFallback && isCorrectDriver) ? "✅ PASS" : "❌ FAIL";
    console.log(`[KẾT QUẢ] ${icon} | HTTP 200 | Latency: ${elapsed}ms | Engine: ${data.model}\n`);
    
    console.log("--- Quyết Định Cuối Cùng ---");
    console.log(`Driver được chọn: ${selectedId} (${isCorrectDriver ? "Đúng theo Rule-based Nearest" : "Sai logic fallback"})`);
    console.log(`Trace ID: ${data.trace_id}`);
    
    console.log("\n--- Decision Log ---");
    data.decision_log.forEach(log => console.log(`> ${log}`));
    
    console.log("\n" + "=".repeat(80));
    if (isFallback && isCorrectDriver) {
        console.log("Thành công: Agent đã chuyển sang Rule-based khi LLM Crash và hệ thống vẫn hoạt động trơn tru.");
    } else {
        console.log("Thất bại: Hệ thống crash hoặc Fallback chọn sai tài xế.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
