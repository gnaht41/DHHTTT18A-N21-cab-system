const http = require('http');

console.log('═══════════════════════════════════════════════════');
console.log('     TC 78: Service Mesh Routing Fail Test (Simulation)');
console.log('═══════════════════════════════════════════════════');
console.log('Mục tiêu: Giả lập Service Mesh tự động chuyển hướng request');
console.log('          khi route chính bị lỗi (Fallback Route).\n');

// Cấu hình URL của API Gateway
const GATEWAY_URL = 'http://localhost:3000';
const endpoint = '/resilience/mesh-routing-fail';

const options = {
    hostname: 'localhost',
    port: 3000,
    path: endpoint,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    let data = '';

    // Nhận dữ liệu trả về từ server
    res.on('data', (chunk) => {
        data += chunk;
    });

    // Khi nhận xong toàn bộ dữ liệu
    res.on('end', () => {
        console.log(`📡 Status Code: ${res.statusCode}`);
        try {
            const jsonResponse = JSON.parse(data);
            console.log('📦 Phản hồi từ Server:');
            console.log(JSON.stringify(jsonResponse, null, 2));

            console.log('\n📌 ĐÁNH GIÁ KẾT QUẢ:');
            if (jsonResponse.rerouted && jsonResponse.fallback_route) {
                console.log('  ✅ PASS: Hệ thống đã phát hiện route lỗi (primary_route: FAILED).');
                console.log(`  ✅ PASS: Request không bị mất, đã được reroute qua [${jsonResponse.fallback_route}].`);
                console.log(`  💬 Message: ${jsonResponse.message}`);
            } else {
                console.log('  ❌ FAIL: Không nhận được phản hồi Reroute hợp lệ.');
            }
        } catch (e) {
            console.log('Lỗi phân tích JSON:', e.message);
        }
        
        console.log('\n═══════════════════════════════════════════════════');
    });
});

// Xử lý lỗi kết nối
req.on('error', (error) => {
    console.error('❌ Lỗi kết nối đến server:', error.message);
    console.log('Hãy chắc chắn rằng API Gateway (port 3000) đang chạy!');
});

// Gửi request
req.end();
