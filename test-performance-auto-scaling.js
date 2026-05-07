// test-performance-auto-scaling.js — TC 70: AUTO SCALING MONITORING
// Kịch bản: Kiểm tra khả năng giám sát tài nguyên và trạng thái Auto-scaling của hệ thống.
// Kỳ vọng: Hệ thống báo cáo được thông số CPU/Memory và trạng thái Auto-scaling là ACTIVE.

const http = require('http');

const RESOURCES_URL = 'http://localhost:3000/observability/resources';
const METRICS_URL = 'http://localhost:3000/metrics';

function getJson(url) {
    return new Promise((resolve) => {
        http.get(url, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function runTest() {
    console.log("\n" + "=".repeat(80));
    console.log("TC 70 - AUTO SCALING & RESOURCE MONITORING");
    console.log("=".repeat(80));
    console.log("Kịch bản: Kiểm tra hệ thống giám sát tài nguyên (CPU/RAM) và trạng thái Scaling.");
    console.log("Kỳ vọng: Hệ thống hiển thị tài nguyên thực tế và cơ chế Scaling đang ở trạng thái ACTIVE.\n");

    const resources = await getJson(RESOURCES_URL);
    const metrics = await getJson(METRICS_URL);

    if (!resources || !metrics) {
        console.log("❌ LỖI: Không thể kết nối tới API Gateway (Port 3000). Hãy đảm bảo Gateway đang chạy.");
        return;
    }

    console.log("--- Thông số Tài nguyên (Real-time) ---");
    console.log(`CPU Usage:          ${resources.cpu_percent}% (Ngưỡng: ${resources.cpu_threshold}%)`);
    console.log(`Memory Usage:       ${resources.memory_used_mb}MB / ${resources.memory_limit_mb}MB`);
    console.log(`Trạng thái an toàn: ${resources.cpu_safe && resources.memory_safe ? "✅ SAFE" : "⚠️ WARNING"}`);

    console.log("\n--- Trạng thái Auto-scaling ---");
    console.log(`Cơ chế Scaling:     ${metrics.auto_scaling === 'ACTIVE' ? "✅ ACTIVE" : "❌ INACTIVE"}`);
    console.log(`Phân phối tải:      ${metrics.db_connection_pool === 'STABLE' ? "✅ BALANCED" : "❌ BOTTLENECK"}`);
    console.log(`Trạng thái Dashboard: ${metrics.grafana_dashboard}`);

    console.log("\n" + "=".repeat(80));
    if (metrics.auto_scaling === 'ACTIVE' && resources.memory_used_mb > 0) {
        console.log(`✅ KẾT QUẢ: ĐẠT (PASS) - Hệ thống giám sát tài nguyên tốt và sẵn sàng Scale Up.`);
    } else {
        console.log(`❌ KẾT QUẢ: KHÔNG ĐẠT (FAIL) - Trạng thái Scaling không hoạt động.`);
    }
    console.log("=".repeat(80) + "\n");
}

runTest();
