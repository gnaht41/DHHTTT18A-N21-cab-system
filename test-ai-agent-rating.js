// test-ai-agent-rating.js — TC 52: AI Agent Logic Validation (Rating vs Distance)
// Kiểm tra Agent cân nhắc giữa khoảng cách và đánh giá (rating)

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
    console.log("TC 52 - LEVEL 6 AI AGENT LOGIC (RATING VS DISTANCE)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Agent cân nhắc chọn driver có rating cao hơn dù ở xa hơn một chút.\n");

    const payload = {
        rider: { lat: 10.00, lng: 106.00 },
        preference: "rating",
        drivers: [
            { id: "D1", name: "Driver 1", status: "ONLINE", lat: 10.02, lng: 106.00, rating: 4.0 }, // ~2km, rating 4.0
            { id: "D2", name: "Driver 2", status: "ONLINE", lat: 10.03, lng: 106.00, rating: 4.9 }  // ~3km, rating 4.9 <--- KỲ VỌNG
        ]
    };

    console.log("Sending Context to Agent:");
    console.log("- Rider: [10.00, 106.00]");
    console.log("- Preference: rating (Ưu tiên chất lượng)");
    console.log("- Drivers:");
    console.log("  * D1: Cách ~2km, Rating: 4.0");
    console.log("  * D2: Cách ~3km, Rating: 4.9 <--- KỲ VỌNG (Vì rating vượt trội)");
    console.log("\nWaiting for Agent's decision...\n");

    const { status, data, elapsed, error } = await post("/agent/dispatch", payload);

    if (error || status !== 200) {
        console.log(`❌ Lỗi gọi API: HTTP ${status} | Error: ${error || JSON.stringify(data)}`);
        return;
    }

    const decisionLog = data.decision_log || [];
    const selectedId = data.selected_driver?.id;
    const isD2 = selectedId === "D2";

    const icon = isD2 ? "✅ PASS" : "❌ FAIL";
    console.log(`[KẾT QUẢ] ${icon} | HTTP 200 | Latency: ${elapsed}ms | Engine: ${data.model}\n`);
    
    console.log("--- Quyết Định Cuối Cùng ---");
    console.log(`Driver được chọn: ${selectedId || "None"} (${isD2 ? "Đúng tài xế chất lượng cao" : "Sai tài xế"})`);
    
    console.log("\n--- Reasoning Log (Chuỗi Suy Luận của Agent) ---");
    decisionLog.forEach(log => console.log(`> ${log}`));
    
    console.log("\n" + "=".repeat(80));
    if (isD2) {
        console.log("Thành công: Agent đã ưu tiên chọn D2 dựa trên tiêu chí 'rating' đúng như yêu cầu.");
    } else {
        console.log("Thất bại: Agent chưa cân nhắc đúng tiêu chí rating.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
