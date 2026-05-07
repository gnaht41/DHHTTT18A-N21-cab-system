// Sử dụng fetch có sẵn trong Node.js v22, không cần axios
const API_URL = 'http://localhost:3000/bookings'; 
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzg3NDc5OSwiZXhwIjoxNzc3OTYxMTk5fQ.U4cMXMRgX7ma2i4VUt26aJ-if4Vdc2RUaP-0rhFs4gs";

async function runTest() {
    console.log('====================================================');
    console.log('TEST CASE 75: CIRCUIT BREAKER VALIDATION');
    console.log('====================================================');
    console.log('Kịch bản: Gửi 6 request liên tiếp khi Pricing Service đang sập.');
    console.log('Mục tiêu: Lần thứ 6 phải kích hoạt trạng thái OPEN của Circuit Breaker.\n');

    for (let i = 1; i <= 6; i++) {
        const startTime = Date.now();
        console.log(`[Request #${i}] Đang gửi yêu cầu tạo booking...`);
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pickup: { lat: 10.76, lng: 106.66 },
                    destination: { lat: 10.77, lng: 106.70 },
                    distance: 5.0
                })
            });

            const data = await response.json();
            const duration = Date.now() - startTime;

            console.log(`   -> Kết quả: ${response.status} ${response.statusText}`);
            if (data.data) {
                console.log(`   -> Giá tiền: ${data.data.price}`);
            }
            console.log(`   -> Thời gian phản hồi: ${duration}ms`);
            
            // Nếu thời gian phản hồi < 500ms ở lần thứ 6 (khi service đang sập) 
            // thì chứng tỏ Circuit Breaker đã ngắt mạch và dùng fallback ngay lập tức.
            if (i === 6 && duration < 500) {
                console.log('\n>>> THÀNH CÔNG: Lần thứ 6 phản hồi cực nhanh, chứng tỏ mạch đã NGẮT (OPEN)!');
            }
        } catch (error) {
            console.log(`   -> Lỗi kết nối: ${error.message}`);
        }
        console.log('----------------------------------------------------');
        
        // Nghỉ một chút giữa các request để dễ quan sát log
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\nKIỂM TRA HOÀN TẤT.');
    console.log('Vui lòng kiểm tra log của container cab_booking_service để thấy trạng thái [CircuitBreaker] OPEN.');
}

runTest();
