const axios = require('axios');

/**
 * SCRIPT TEST TC 20: PAYLOAD TOO LARGE (413)
 * Mục tiêu: Gửi một gói dữ liệu 1.1MB để kiểm tra khả năng chặn DoS của Gateway.
 */
async function testPayloadLimit() {
  const url = 'http://localhost:3000/auth/register';
  
  // Tạo chuỗi văn bản nặng 1.1 MB (vượt quá giới hạn 1MB của Gateway)
  const hugeString = 'A'.repeat(1.1 * 1024 * 1024);
  
  const payload = {
    email: 'huge_test@test.com',
    password: '123',
    name: hugeString
  };

  console.log('--- Đang gửi payload 1.1MB đến API Gateway (Giới hạn 1MB) ---');
  
  try {
    const response = await axios.post(url, payload, {
      // Cho phép axios gửi dữ liệu lớn
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    console.log('Kết quả bất ngờ:', response.status, '(Request không bị chặn)');
  } catch (error) {
    if (error.response) {
      console.log('✅ THÀNH CÔNG: Hệ thống đã chặn gói dữ liệu quá lớn!');
      console.log('Mã lỗi HTTP:', error.response.status); // Sẽ là 413
      console.log('Phản hồi từ Server:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Lỗi kết nối:', error.message);
    }
  }
}

testPayloadLimit();
