// test-ai-agent-offline.js — TC 57: AI Agent Logic (Filter Offline Drivers)
// Kiểm tra Agent có khả năng loại bỏ (filter) các driver đang OFFLINE khỏi danh sách lựa chọn hay không.

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
    console.log("TC 57 - LEVEL 6 AI AGENT LOGIC (FILTER OFFLINE DRIVERS)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Có 2 tài xế, tài xế A ở rất gần và rất rẻ nhưng đang OFFLINE, tài xế B ở xa hơn nhưng ONLINE.");
    console.log("Kỳ vọng: Agent loại bỏ tài xế A và bắt buộc chọn tài xế B.\n");

    const payload = {
        rider: { lat: 10.00, lng: 106.00 },
        preference: "nearest",
        drivers: [
            { id: "Driver_A_Offline", name: "Driver A", status: "OFFLINE", lat: 10.01, lng: 106.00, eta: 1, price: 10 }, // Cực gần, cực rẻ nhưng OFFLINE
            { id: "Driver_B_Online", name: "Driver B", status: "ONLINE", lat: 10.10, lng: 106.00, eta: 15, price: 100 }  // Xa hơn nhưng ONLINE <--- KỲ VỌNG CHỌN NGƯỜI NÀY
        ]
    };

    console.log("Sending Context to Agent:");
    console.log("- Preference: nearest");
    console.log("- Drivers:");
    console.log("  * Driver A: Cực gần (ETA=1), Giá cực rẻ (10), Status = OFFLINE");
    console.log("  * Driver B: Ở xa (ETA=15), Giá cao (100), Status = ONLINE <--- KỲ VỌNG");
    console.log("\nWaiting for Agent's decision...\n");

    const { status, data, elapsed, error } = await post("/agent/dispatch", payload);

    if (error || status !== 200) {
        console.log(`❌ Lỗi gọi API: HTTP ${status} | Error: ${error || JSON.stringify(data)}`);
        return;
    }

    const decisionLog = data.decision_log || [];
    const selectedId = data.selected_driver?.id;
    const isB = selectedId === "Driver_B_Online";

    const icon = isB ? "✅ PASS" : "❌ FAIL";
    console.log(`[KẾT QUẢ] ${icon} | HTTP 200 | Latency: ${elapsed}ms | Engine: ${data.model}\n`);
    
    console.log("--- Quyết Định Cuối Cùng ---");
    console.log(`Driver được chọn: ${selectedId || "None"} (${isB ? "Chính xác, không chọn sai người Offline" : "Sai, đã chọn người Offline hoặc bị lỗi"})`);
    
    console.log("\n--- Reasoning Log (Chuỗi Suy Luận của Agent) ---");
    decisionLog.forEach(log => console.log(`> ${log}`));
    
    console.log("\n" + "=".repeat(80));
    if (isB) {
        console.log("Thành công: Agent đã lọc thành công tài xế OFFLINE khỏi Context trước khi đưa ra quyết định.");
    } else {
        console.log("Thất bại: Agent đã assign nhầm tài xế đang offline.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
