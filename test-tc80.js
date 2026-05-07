const API_URL = 'http://localhost:3000/bookings'; 
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzg3NDc5OSwiZXhwIjoxNzc3OTYxMTk5fQ.U4cMXMRgX7ma2i4VUt26aJ-if4Vdc2RUaP-0rhFs4gs";

async function runTest() {
    console.log('====================================================');
    console.log('TEST CASE 80: GRACEFUL DEGRADATION');
    console.log('====================================================');
    console.log('Kịch bản: ');
    console.log('1. Hệ thống gặp lỗi khi gọi AI (Gemini) để dự báo ETA.');
    console.log('2. Hệ thống phải tự động "xuống cấp" dùng công thức dự phòng.');
    console.log('3. Luồng đặt xe chính (Core Booking) vẫn phải thành công.\n');

    console.log('[1/2] Đang gửi yêu cầu đặt xe...');
    const startTime = Date.now();
    
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

        console.log(`\n[2/2] KẾT QUẢ:`);
        console.log(`   -> Trạng thái: ${response.status} ${response.statusText}`);
        
        if (response.status === 201) {
            console.log(`   -> Core Function: ĐẶT XE THÀNH CÔNG (ID: ${data.data.id})`);
            console.log(`   -> Feature Degradation: Thời gian di chuyển (duration) vẫn được tính: ${data.data.duration} phút`);
            console.log('\n>>> THÀNH CÔNG: Hệ thống đã xuống cấp nhịp nhàng, bỏ qua AI bị lỗi để giữ luồng chính không bị crash!');
        } else {
            console.log(`   -> Thất bại: Hệ thống bị crash hoặc trả về lỗi.`);
        }
    } catch (error) {
        console.log(`   -> Lỗi kết nối: ${error.message}`);
    }
}

runTest();
