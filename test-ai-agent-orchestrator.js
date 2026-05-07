// test-ai-agent-orchestrator.js — TC 54: AI Agent Logic (Tool Calling / Orchestrator)
// Kiểm tra khả năng Agent gọi đúng tool cho các câu hỏi nghiệp vụ khác nhau

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

async function testPrompt(prompt, expectedTool) {
    console.log(`\nUser Prompt: "${prompt}"`);
    console.log(`Expected Tool: ${expectedTool}`);
    console.log("Waiting for Agent's decision...");

    const { status, data, elapsed, error } = await post("/agent/orchestrator", { prompt });

    if (error || status !== 200) {
        console.log(`❌ Lỗi gọi API: HTTP ${status} | Error: ${error || JSON.stringify(data)}`);
        return false;
    }

    const selectedTool = data.tool;
    const isCorrect = selectedTool === expectedTool;
    const icon = isCorrect ? "✅ PASS" : "❌ FAIL";
    
    console.log(`[KẾT QUẢ] ${icon} | HTTP 200 | Latency: ${elapsed}ms | Engine: ${data.model}`);
    console.log(`Selected Tool: ${selectedTool}`);
    console.log("Reasoning:");
    data.reasoning.forEach(log => console.log(`> ${log}`));
    
    return isCorrect;
}

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 54 - LEVEL 6 AI AGENT LOGIC (ORCHESTRATOR & TOOL CALLING)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Agent nhận câu hỏi tự nhiên và định tuyến gọi đúng service/tool.\n");

    const tests = [
        { prompt: "Giá cước chuyến đi từ Quận 1 đến Quận 7 là bao nhiêu?", expectedTool: "pricing_service" },
        { prompt: "Cho tôi biết ETA là gì và tài xế bao lâu nữa thì tới?", expectedTool: "eta_service" },
        { prompt: "Có vẻ tài xế này đang gian lận, có fraud không?", expectedTool: "fraud_service" }
    ];

    let passedAll = true;
    for (const t of tests) {
        const passed = await testPrompt(t.prompt, t.expectedTool);
        if (!passed) passedAll = false;
    }

    console.log("\n" + "=".repeat(80));
    if (passedAll) {
        console.log("Thành công: Agent đã phân tích câu hỏi và gọi ĐÚNG các tool (ETA, Pricing, Fraud) theo thứ tự và không dư thừa.");
    } else {
        console.log("Thất bại: Có test case agent gọi sai tool.");
    }
    console.log("=".repeat(80) + "\n");
}

run();
