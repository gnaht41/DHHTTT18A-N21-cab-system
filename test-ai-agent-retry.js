// test-ai-agent-retry.js — TC 56: Agent Retry khi service lỗi
// Kiểm tra khả năng tự động retry của Agent khi gọi một service (ví dụ: ETA service) bị lỗi tạm thời.

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
    console.log("TC 56 - LEVEL 6 AI AGENT LOGIC (RETRY ON TOOL FAILURE)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Agent gọi ETA service nhưng service bị lỗi 503/Timeout ở lần đầu.");
    console.log("Kỳ vọng: Agent KHÔNG fail ngay lập tức, tự động RETRY và thành công ở lần sau.\n");

    const payload = {
        tool: "eta_service",
        params: { distance: 10 },
        simulate_error: true // Kích hoạt giả lập lỗi ở lần 1
    };

    console.log(`[Agent] Đang thực thi Tool: ${payload.tool}...`);
    console.log(`[Mock] Giả lập ETA service gặp sự cố ở lần gọi đầu tiên (simulate_error=true)\n`);

    const { status, data, elapsed, error } = await post("/agent/execute-tool", payload);

    if (error) {
        console.log(`[KẾT QUẢ] ❌ CRASH/FAIL | Lỗi Exception: ${error}`);
        return;
    }

    if (status === 200 && data.success && data.retried) {
        console.log(`[KẾT QUẢ] ✅ PASS | HTTP ${status} | Latency: ${elapsed}ms`);
        console.log(`Agent Response:`);
        console.log(`- Trạng thái: ${data.message}`);
        console.log(`- Số lần thử (attempts): ${data.attempts}`);
        console.log(`- Log lỗi đã catch:`, data.error_log);
        console.log(`- Dữ liệu cuối cùng:`, data.data);
        console.log("\n" + "=".repeat(80));
        console.log("Thành công: Agent đã gặp lỗi ở lần 1 nhưng đã tự động RETRY thành công ở lần 2. Không fail ngay.");
        console.log("=".repeat(80) + "\n");
    } else {
        console.log(`[KẾT QUẢ] ❌ FAIL | HTTP ${status} | Latency: ${elapsed}ms`);
        console.log(`Phản hồi không như kỳ vọng:`, data);
        console.log("\n" + "=".repeat(80));
        console.log("Thất bại: Agent không thực hiện retry hoặc trả về kết quả sai.");
        console.log("=".repeat(80) + "\n");
    }
}

run();
