const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.post('/', userController.createUser);
router.get('/', userController.getUsers);

// Profile routes MUST come before /:id routes
router.get('/profile', userController.getProfile);
router.patch('/profile', userController.updateProfile);

router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
