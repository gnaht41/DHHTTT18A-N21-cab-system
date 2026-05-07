const { exec } = require('child_process');

const API_URL = 'http://localhost:3000/bookings'; 
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3Nzg3NDc5OSwiZXhwIjoxNzc3OTYxMTk5fQ.U4cMXMRgX7ma2i4VUt26aJ-if4Vdc2RUaP-0rhFs4gs";

async function runTest() {
    console.log('====================================================');
    console.log('TEST CASE 77: RETRY EXPONENTIAL BACKOFF');
    console.log('====================================================');
    console.log('Kịch bản: ');
    console.log('1. Đánh sập Pricing Service.');
    console.log('2. Gửi yêu cầu đặt xe.');
    console.log('3. Sau 3 giây, tự động bật lại Pricing Service.');
    console.log('4. Kiểm tra hệ thống có tự hồi phục và lấy được giá thật không.\n');

    // Bước 1: Đảm bảo Pricing Service đang tắt
    console.log('[1/4] Đang đảm bảo Pricing Service đã tắt...');
    await executeCommand('docker-compose stop pricing-service');

    // Bước 2: Gửi request đặt xe (chạy bất đồng bộ)
    console.log('[2/4] Đang gửi yêu cầu đặt xe (hệ thống sẽ bắt đầu Retry)...');
    const startTime = Date.now();
    
    const requestPromise = fetch(API_URL, {
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

    // Bước 3: Đợi 3 giây rồi bật lại service
    console.log('[3/4] Đang đợi 3 giây (trong lúc hệ thống đang retry)...');
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('   >>> Đã đủ 3 giây! Đang bật lại Pricing Service ngay bây giờ...');
    await executeCommand('docker-compose start pricing-service');

    // Bước 4: Chờ kết quả từ request
    try {
        const response = await requestPromise;
        const data = await response.json();
        const duration = Date.now() - startTime;

        console.log(`\n[4/4] KẾT QUẢ CUỐI CÙNG:`);
        console.log(`   -> Trạng thái: ${response.status}`);
        if (data.data) {
            console.log(`   -> Giá tiền nhận được: ${data.data.price}`);
            // Lưu ý: Nếu là giá thật thì thường nó sẽ theo logic trong DB/Service (ví dụ 10.0, 15.0)
            // Nếu là giá fallback ngẫu nhiên thì sẽ có nhiều chữ số thập phân.
        }
        console.log(`   -> Tổng thời gian xử lý: ${duration}ms`);

        if (duration > 4000 && response.status === 201) {
            console.log('\n>>> THÀNH CÔNG: Hệ thống đã kiên trì thử lại (Retry) và tự hồi phục khi service sống lại!');
        }
    } catch (error) {
        console.log(`   -> Lỗi: ${error.message}`);
    }
}

function executeCommand(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.warn(`      (Thông báo: ${stderr.trim()})`);
            }
            resolve(stdout);
        });
    });
}

runTest();
