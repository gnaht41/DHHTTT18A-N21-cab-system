const API_URL = 'http://localhost:3000/security/rbac-check'; 

async function runAuthTest() {
    console.log('====================================================');
    console.log('TEST CASE 84: UNAUTHORIZED API ACCESS (RBAC)');
    console.log('====================================================');
    console.log('Kịch bản: ');
    console.log('1. Một User bình thường (role: passenger) cố gắng thực hiện hành động quản trị (manage_users).');
    console.log('2. Hệ thống RBAC phải nhận diện role và chặn truy cập trái phép.\n');

    console.log('[Sending] Đang gửi yêu cầu thực hiện hành động Admin...');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                role: 'passenger',
                action: 'manage_users',
                resource: 'user_database'
            })
        });

        const data = await response.json();

        console.log(`\n[Result] Kết quả từ Server:`);
        console.log(`   -> Trạng thái: ${response.status} ${response.statusText}`);
        console.log(`   -> Thông báo: ${JSON.stringify(data)}`);

        if (response.status === 403) {
            console.log('\n>>> THÀNH CÔNG: Hệ thống đã chặn truy cập (403 Forbidden)!');
            console.log('>>> Lý do: ' + data.reason);
        } else {
            console.log('\n>>> THẤT BẠI: Hệ thống không chặn được truy cập trái phép.');
        }
    } catch (error) {
        console.log(`   -> Lỗi kết nối: ${error.message}`);
    }
}

runAuthTest();
