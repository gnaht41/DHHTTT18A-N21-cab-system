const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'Auth Service is UP' });
});

module.exports = router;
