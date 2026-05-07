const jwt = require('jsonwebtoken');

/**
 * SCRIPT TEST TC 18: GEN EXPIRED TOKEN
 * Mục tiêu: Tạo một Token có thời gian hết hạn ở quá khứ (-1 giờ) để test lỗi 401.
 */

// Phải dùng đúng Secret Key của hệ thống
const jwtSecret = process.env.JWT_SECRET || 'super_secret_jwt_key_here';

const payload = {
  id: 1,
  email: 'user@test.com',
  role: 'user',
  name: 'Test User'
};

// Ký token với thời gian hết hạn là 1 tiếng TRƯỚC (đã hết hạn)
const expiredToken = jwt.sign(payload, jwtSecret, { expiresIn: '-1h' });

console.log('\n--- TOKEN ĐÃ HẾT HẠN (EXPIRED) ---');
console.log(expiredToken);
console.log('----------------------------------\n');
console.log('HƯỚNG DẪN:');
console.log('1. Copy chuỗi Token ở trên.');
console.log('2. Mở Postman TC 18, dán vào phần Bearer Token.');
console.log('3. Nhấn Send để nhận lỗi 401 Unauthorized.\n');
