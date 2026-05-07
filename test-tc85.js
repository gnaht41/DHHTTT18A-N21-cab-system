const API_URL = 'http://localhost:3000/bookings'; // Endpoint này bị áp dụng Rate Limit (100 req/s)
const MAX_REQUESTS = 150;

async function runRateLimitTest() {
    console.log('====================================================');
    console.log('TEST CASE 85: RATE LIMIT ATTACK (ANTI-SPAM)');
    console.log('====================================================');
    console.log(`Kịch bản: Gửi liên tiếp ${MAX_REQUESTS} request để xem hệ thống chặn spam.\n`);

    let successCount = 0;
    let blockedCount = 0;
    let lastError = '';

    const requests = [];
    for (let i = 0; i < MAX_REQUESTS; i++) {
        requests.push(
            fetch(API_URL)
                .then(res => {
                    if (res.status === 200) successCount++;
                    if (res.status === 429) {
                        blockedCount++;
                        lastError = '429 Too Many Requests';
                    }
                })
                .catch(err => {
                    // console.log('Error:', err.message);
                })
        );
        
        // Gửi theo từng đợt nhỏ để không làm nghẽn network local quá mức
        if (i % 20 === 0) await new Promise(r => setTimeout(r, 10));
    }

    await Promise.all(requests);

    console.log(`[Result] Tổng kết sau khi spam:`);
    console.log(`   -> Số request thành công: ${successCount}`);
    console.log(`   -> Số request bị chặn (429): ${blockedCount}`);

    if (blockedCount > 0) {
        console.log('\n>>> THÀNH CÔNG: Hệ thống đã kích hoạt Rate Limit và trả về 429!');
    } else {
        console.log('\n>>> THẤT BẠI: Hệ thống chưa chặn được spam (Vẫn nhận 100% request).');
    }
}

runRateLimitTest();
