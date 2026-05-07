// test-ai-agent-balanced.js — TC 53: AI Agent Logic Validation (Balanced / Multi-objective)
// Kiểm tra Agent cân bằng giữa ETA (thời gian đến) và Price (giá cước)

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
    console.log("TC 53 - LEVEL 6 AI AGENT LOGIC (BALANCED ETA VS PRICE)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Agent cân bằng giữa thời gian chờ và giá cước để chọn lựa chọn tối ưu.\n");

    const payload = {
        rider: { lat: 10.00, lng: 106.00 },
        preference: "balanced",
        drivers: [
            { id: "Driver_A", name: "Driver A", status: "ONLINE", lat: 10.05, lng: 106.00, eta: 5, price: 50 }, // ETA 5min, 50k -> Score = 5*3 + 50 = 65
            { id: "Driver_B", name: "Driver B", status: "ONLINE", lat: 10.08, lng: 106.00, eta: 8, price: 40 }  // ETA 8min, 40k -> Score = 8*3 + 40 = 64 <--- KỲ VỌNG TỐI ƯU HƠN
        ]
    };

    console.log("Sending Context to Agent:");
    console.log("- Preference: balanced (Cân bằng, tối ưu chi phí & thời gian)");
    console.log("- Drivers:");
    console.log("  * Driver A: ETA = 5min, Price = 50k");
    console.log("  * Driver B: ETA = 8min, Price = 40k <--- KỲ VỌNG (Đợi thêm 3 phút nhưng rẻ hơn 10k là trade-off tốt)");
    console.log("\nWaiting for Agent's decision...\n");

    const { status, data, elapsed, error } = await post("/agent/dispatch", payload);

    if (error || status !== 200) {
        console.log(`❌ Lỗi gọi API: HTTP ${status} | Error: ${error || JSON.stringify(data)}`);
        return;
    }

    const decisionLog = data.decision_log || [];
    const selectedId = data.selected_driver?.id;
    const isB = selectedId === "Driver_B";

    const icon = isB ? "✅ PASS" : "❌ FAIL";
    console.log(`[KẾT QUẢ] ${icon} | HTTP 200 | Latency: ${elapsed}ms | Engine: ${data.model}\n`);
    
    console.log("--- Quyết Định Cuối Cùng ---");
    console.log(`Driver được chọn: ${selectedId || "None"} (${isB ? "Đúng tài xế có đánh đổi tốt nhất" : "Chưa tối ưu trade-off"})`);
    
    console.log("\n--- Reasoning Log (Chuỗi Suy Luận của Agent) ---");
    decisionLog.forEach(log => console.log(`> ${log}`));
    
    console.log("\n" + "=".repeat(80));
    if (isB) {
        console.log("Thành công: Agent đã phân tích và cân bằng đúng giữa ETA và Price.");
    } else {
        console.log("Thất bại: Agent chưa chọn đúng tài xế có mức giá và thời gian đánh đổi tốt nhất.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
