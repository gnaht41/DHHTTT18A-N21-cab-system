const API_URL = 'http://localhost:3000/bookings'; 
const VALID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzg3NDc5OSwiZXhwIjoxNzc3OTYxMTk5fQ.U4cMXMRgX7ma2i4VUt26aJ-if4Vdc2RUaP-0rhFs4gs";

async function runTamperTest() {
    console.log('====================================================');
    console.log('TEST CASE 83: JWT TAMPERING ATTACK');
    console.log('====================================================');
    
    // 1. Giải mã Payload của Token cũ
    const parts = VALID_TOKEN.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    console.log('Original Payload:', payload);

    // 2. Tấn công: Sửa đổi Payload (Đổi role thành ADMIN)
    payload.role = 'ADMIN';
    payload.sub = 'admin_001';
    
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64')
        .replace(/=/g, ''); // JWT base64url encoding (remove padding)

    // 3. Tạo Token giả (Payload mới + Chữ ký cũ)
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    
    console.log('\n[!] Đã sửa đổi Token (Payload mới nhưng không có khóa bí mật để ký lại).');
    console.log('Tampered Token created.\n');

    // 4. Gửi request với Token giả
    console.log('[Sending] Đang dùng Token giả để gọi API đặt xe...');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${tamperedToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pickup: "10.762,106.66",
                drop: "10.77,106.70",
                distance: 5
            })
        });

        const data = await response.json();

        console.log(`\n[Result] Kết quả từ Server:`);
        console.log(`   -> Trạng thái: ${response.status} ${response.statusText}`);
        console.log(`   -> Thông báo: ${JSON.stringify(data)}`);

        if (response.status === 401) {
            console.log('\n>>> THÀNH CÔNG: Hệ thống đã phát hiện Token bị sửa đổi và từ chối truy cập (401)!');
        } else if (response.status === 201) {
            console.log('\n>>> THẤT BẠI: Hệ thống đã bị bypass! Hacker đã chiếm quyền ADMIN thành công.');
        }
    } catch (error) {
        console.log(`   -> Lỗi: ${error.message}`);
    }
}

runTamperTest();
