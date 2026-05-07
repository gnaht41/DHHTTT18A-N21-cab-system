const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');

// Mapped to /api/bookings in app.js
router.get('/', bookingController.getBookings.bind(bookingController));
router.post('/', bookingController.createBooking.bind(bookingController));
router.get('/active', bookingController.getActiveBooking.bind(bookingController));
// DISABLED: Drivers should NOT poll for bookings. Assignment is centralized in Ride Service.
// router.get('/pending', bookingController.getPendingBookings.bind(bookingController));
router.get('/pending', (req, res) => {
    console.log('[BookingService] WARNING: /pending endpoint is deprecated. Assignment is now centralized.');
    res.status(410).json({
        error: 'Polling for bookings is disabled',
        message: 'Driver assignment is handled automatically by Ride Service via socket'
    });
});
router.get('/:id', bookingController.getById.bind(bookingController));
router.patch('/:id/status', bookingController.updateStatus.bind(bookingController));

module.exports = router;
