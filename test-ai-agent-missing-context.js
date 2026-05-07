// test-ai-agent-missing-context.js — TC 55: AI Agent Logic (Missing Context & Graceful Degradation)
// Kiểm tra khả năng xử lý của Agent khi nhận request thiếu dữ liệu quan trọng (ví dụ: mất danh sách driver)

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
    console.log("TC 55 - LEVEL 6 AI AGENT LOGIC (MISSING CONTEXT & GRACEFUL DEGRADATION)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Request gửi đến Dispatch Agent nhưng thiếu dữ liệu 'drivers'.");
    console.log("Kỳ vọng: Agent không crash, trả về lỗi rõ ràng (request thêm data) hoặc fallback an toàn.\n");

    const payloadMissingDrivers = {
        rider: { lat: 10.00, lng: 106.00 },
        preference: "nearest"
        // THIẾU DRIVERS
    };

    console.log("Sending INCOMPLETE Context to Agent:");
    console.log("- Rider: " + JSON.stringify(payloadMissingDrivers.rider));
    console.log("- Preference: " + payloadMissingDrivers.preference);
    console.log("- Drivers: UNDEFINED (Mất kết nối DB hoặc Service lỗi)\n");

    console.log("Waiting for Agent's decision...\n");

    const { status, data, elapsed, error } = await post("/agent/dispatch", payloadMissingDrivers);

    if (error) {
        console.log(`[KẾT QUẢ] ❌ CRASH/FAIL | Lỗi Exception: ${error}`);
        return;
    }

    if (status === 400 && data && data.error && data.error.includes("Missing context data")) {
        console.log(`[KẾT QUẢ] ✅ PASS | HTTP ${status} | Latency: ${elapsed}ms`);
        console.log(`Agent Response:`, data);
        console.log("\n" + "=".repeat(80));
        console.log("Thành công: Agent không bị crash khi mất dữ liệu. Đã validate và trả về yêu cầu bổ sung context.");
        console.log("=".repeat(80) + "\n");
    } else {
        console.log(`[KẾT QUẢ] ❌ FAIL | HTTP ${status} | Latency: ${elapsed}ms`);
        console.log(`Phản hồi không như kỳ vọng:`, data);
        console.log("\n" + "=".repeat(80));
        console.log("Thất bại: Agent không trả về mã lỗi 400 rõ ràng khi thiếu dữ liệu.");
        console.log("=".repeat(80) + "\n");
    }
}

run();
