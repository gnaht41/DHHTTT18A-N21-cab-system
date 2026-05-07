// test-ai-agent-concurrency.js — TC 59: AI Agent Logic (Concurrency / Race Conditions)
// Kiểm tra Agent có khả năng xử lý nhiều request dispatch song song mà không bị conflict hay race condition hay không.

const BASE_URL = "http://localhost:3011/api/ai";

async function post(path, body, id) {
    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const elapsed = Math.round(performance.now() - start);
        const data = await res.json();
        return { reqId: id, status: res.status, data, elapsed, error: null };
    } catch (e) {
        const elapsed = Math.round(performance.now() - start);
        return { reqId: id, status: 0, data: null, elapsed, error: e.message };
    }
}

async function run() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 59 - LEVEL 6 AI AGENT LOGIC (CONCURRENCY & RACE CONDITIONS)");
    console.log("=".repeat(80));
    console.log("Kịch bản: Gửi 10 request Dispatch song song cùng một lúc tới Agent.");
    console.log("Kỳ vọng: Tất cả request đều thành công (HTTP 200), không bị chết server, mỗi request có trace_id riêng biệt và logic chạy độc lập.\n");

    const NUM_REQUESTS = 10;
    const requests = [];

    // Tạo 10 request với data hơi khác nhau một chút để đảm bảo không cache/mix data
    for (let i = 1; i <= NUM_REQUESTS; i++) {
        const payload = {
            rider: { lat: 10.00, lng: 106.00 + (i * 0.01) },
            preference: i % 2 === 0 ? "nearest" : "balanced",
            drivers: [
                { id: `Driver_Req${i}_A`, name: "Driver A", status: "ONLINE", lat: 10.01, lng: 106.00, eta: i, price: 10 * i },
                { id: `Driver_Req${i}_B`, name: "Driver B", status: "ONLINE", lat: 10.05, lng: 106.00, eta: i + 5, price: 5 * i }
            ]
        };
        requests.push(post("/agent/dispatch", payload, i));
    }

    console.log(`Bắn ${NUM_REQUESTS} request song song...`);
    const results = await Promise.all(requests);

    let passedCount = 0;
    const traceIds = new Set();
    let hasConflict = false;

    console.log("\n--- Kết quả từng Request ---");
    results.forEach(res => {
        const { reqId, status, data, elapsed, error } = res;
        
        if (error || status !== 200) {
            console.log(`[Req ${reqId}] ❌ Thất bại - HTTP ${status} - Lỗi: ${error || "Unknown"}`);
            return;
        }

        const traceId = data.trace_id;
        const selectedId = data.selected_driver?.id;
        
        if (traceIds.has(traceId)) {
            hasConflict = true;
            console.log(`[Req ${reqId}] ❌ LỖI RACE CONDITION: Trùng Trace ID (${traceId})`);
        } else {
            traceIds.add(traceId);
        }

        // Kiểm tra xem ID tài xế được chọn có đúng thuộc về Request ID này không
        if (!selectedId || !selectedId.includes(`Req${reqId}`)) {
            hasConflict = true;
            console.log(`[Req ${reqId}] ❌ LỖI CONFLICT DATA: Chọn nhầm driver của request khác (${selectedId})`);
        } else {
            console.log(`[Req ${reqId}] ✅ OK - Trace: ${traceId} - Chọn: ${selectedId} (${elapsed}ms)`);
            passedCount++;
        }
    });

    console.log("\n" + "=".repeat(80));
    if (passedCount === NUM_REQUESTS && !hasConflict) {
        console.log(`Thành công: Hệ thống xử lý xuất sắc ${NUM_REQUESTS}/${NUM_REQUESTS} request song song mà không bị conflict hay crash.`);
    } else {
        console.log(`Thất bại: Chỉ thành công ${passedCount}/${NUM_REQUESTS} request. Có thể xảy ra lỗi Race Condition hoặc quá tải.`);
    }
    console.log("=".repeat(80) + "\n");
}

run();
