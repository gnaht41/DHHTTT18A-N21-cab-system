// test-ai-agent.js — TC 51: AI Agent Logic Validation
// Kiểm tra khả năng suy luận (reasoning) và ra quyết định của Agent Dispatch

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
    console.log("TC 51 - LEVEL 6 AI AGENT LOGIC VALIDATION");
    console.log("=".repeat(80));
    console.log("Kịch bản: Agent Dispatch phải tự suy luận dựa trên context và chọn tài xế gần nhất.\n");

    const payload = {
        rider: { lat: 10.00, lng: 106.00 },
        preference: "nearest",
        drivers: [
            { id: "D1", name: "Driver 1", status: "ONLINE", lat: 10.05, lng: 106.00 }, // ~5km
            { id: "D2", name: "Driver 2", status: "ONLINE", lat: 10.02, lng: 106.00 }, // ~2km (GẦN NHẤT)
            { id: "D3", name: "Driver 3", status: "ONLINE", lat: 10.03, lng: 106.00 }  // ~3km
        ]
    };

    console.log("Sending Context to Agent:");
    console.log("- Rider: [10.00, 106.00]");
    console.log("- Preference: nearest");
    console.log("- Drivers:");
    console.log("  * D1: [10.05, 106.00] (Khoảng cách ~ 0.05 deg)");
    console.log("  * D2: [10.02, 106.00] (Khoảng cách ~ 0.02 deg) <--- KỲ VỌNG");
    console.log("  * D3: [10.03, 106.00] (Khoảng cách ~ 0.03 deg)");
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
    console.log(`Driver được chọn: ${selectedId || "None"} (${isD2 ? "Đúng tài xế gần nhất" : "Sai tài xế"})`);
    
    console.log("\n--- Reasoning Log (Chuỗi Suy Luận của Agent) ---");
    decisionLog.forEach(log => console.log(`> ${log}`));
    
    console.log("\n" + "=".repeat(80));
    if (isD2) {
        console.log("Thành công: Agent đã phân tích đúng context tọa độ để đưa ra quyết định tối ưu.");
    } else {
        console.log("Thất bại: Agent chưa chọn đúng tài xế gần nhất theo thuật toán khoảng cách.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
