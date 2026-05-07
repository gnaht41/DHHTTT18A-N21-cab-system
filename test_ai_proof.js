const axios = require('axios');

/**
 * SCRIPT CHỨNG MINH AI DISPATCH AGENT (TC 22)
 * Nhiệm vụ: Kiểm tra xem tài xế được chọn có thực sự đang ONLINE không.
 */

async function proveAIDispatch() {
    const BASE_URL = 'http://localhost:3000';

    // === DÁN TOKEN CỦA BẠN VÀO ĐÂY ===
    const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImlkIjoxLCJlbWFpbCI6InVzZXJAdGVzdC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc3NzI2NjQyNywiZXhwIjoxNzc3MzUyODI3fQ.ki8CmMjHAFGfHY1lYmYs7qPvm2qMbFaDZmNoofP2hTo';
    // ================================

    const config = {
        headers: { Authorization: `Bearer ${TOKEN}` }
    };

    try {
        console.log('--- BẮT ĐẦU KIỂM TRA AI DISPATCH AGENT ---');

        // 1. Lấy danh sách tài xế hiện tại
        console.log('Step 1: Lấy danh sách tài xế từ Driver Service...');
        let driversRes;
        try {
            driversRes = await axios.get(`${BASE_URL}/drivers`, config);
        } catch (e) {
            console.log('Thử lại với đường dẫn /drivers/ ...');
            driversRes = await axios.get(`${BASE_URL}/drivers/`, config);
        }
        const allDrivers = driversRes.data.data || driversRes.data;

        const onlineDrivers = allDrivers.filter(d => d.status === 'ONLINE' || d.status === 'AVAILABLE');
        console.log(`Tìm thấy ${allDrivers.length} tài xế. Trong đó có ${onlineDrivers.length} người đang ONLINE.`);

        if (onlineDrivers.length === 0) {
            console.log('❌ LỖI: Không có tài xế nào Online. Vui lòng bật ít nhất 1 tài xế Online trước khi chạy script này!');
            return;
        }

        // 2. Thực hiện đặt xe (Trigger SAGA)
        console.log('\nStep 2: Khách hàng thực hiện đặt xe (POST /bookings)...');
        // Lưu ý: Cần Token Khách hàng ở đây. Nếu API yêu cầu Auth, script sẽ báo 401.
        // Tôi giả định bạn đã config Auth bypass cho môi trường test hoặc dùng Token mặc định.
        const bookingRes = await axios.post(`${BASE_URL}/bookings`, {
            pickup: { lat: 10.76, lng: 106.66 },
            drop: { lat: 10.77, lng: 106.70 },
            distance_km: 5
        }, config).catch(e => e.response);

        if (bookingRes.status !== 201) {
            console.log('❌ LỖI: Không thể tạo Booking. Mã lỗi:', bookingRes.status);
            return;
        }
        console.log('✅ Đã tạo Booking thành công. Đang đợi SAGA gán tài xế...');

        // Đợi 2 giây để Kafka xử lý
        await new Promise(r => setTimeout(r, 2000));

        // 3. Kiểm tra chuyến đi vừa được tạo
        console.log('\nStep 3: Kiểm tra chuyến đi (Ride Service)...');
        const ridesRes = await axios.get(`${BASE_URL}/rides/active`, config);
        const activeRides = ridesRes.data.data || ridesRes.data;

        // Lấy ride mới nhất
        const latestRide = activeRides[0];

        if (!latestRide || !latestRide.driverId) {
            console.log('❌ LỖI: Chưa tìm thấy chuyến đi được gán tài xế.');
            return;
        }

        const selectedDriverId = latestRide.driverId;
        console.log(`Hệ thống đã chọn Tài xế ID: ${selectedDriverId}`);

        // 4. Đối chiếu với trạng thái thực tế
        const chosenOne = allDrivers.find(d => Number(d.userId) === Number(selectedDriverId) || Number(d.id) === Number(selectedDriverId));

        console.log('\n--- KẾT QUẢ ĐỐI CHIẾU ---');
        console.log(`- Tài xế được AI chọn: ${chosenOne ? chosenOne.name : 'Unknown'}`);
        console.log(`- Trạng thái khi chọn: ${chosenOne ? chosenOne.status : 'N/A'}`);

        if (chosenOne && (chosenOne.status === 'ONLINE' || chosenOne.status === 'AVAILABLE')) {
            console.log('\n✅ KẾT LUẬN: THÀNH CÔNG! AI đã chọn đúng tài xế đang hoạt động.');
        } else {
            console.log('\n❌ KẾT LUẬN: THẤT BẠI! AI đã chọn tài xế không hợp lệ.');
        }

    } catch (error) {
        console.error('Lỗi khi thực thi script:', error.message);
    }
}

proveAIDispatch();
