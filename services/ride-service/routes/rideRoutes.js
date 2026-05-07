const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const rideService = require('../services/rideService');

// POST /api/rides (Invoked mostly by booking-service to confirm a ride setup)
router.post('/', rideController.createRide.bind(rideController));

router.get('/', rideController.getAll.bind(rideController));
router.get('/active', rideController.getActiveRide.bind(rideController));
router.get('/last', rideController.getLastRide.bind(rideController));
router.get('/history', rideController.getRideHistory.bind(rideController));
router.get('/:rideId', rideController.getById.bind(rideController));

// PUT/PATCH /api/rides/:id/status
router.put('/:id/status', rideController.updateStatus.bind(rideController));
router.patch('/:id/status', rideController.updateStatus.bind(rideController));

// PUT /api/rides/:id/location (For driver location updates via Socket)
router.put('/:id/location', async (req, res) => {
  try {
    const result = await rideService.emitDriverLocationToRide(req.params.id, req.body.location);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/accept', rideController.accept.bind(rideController));
router.post('/:id/arrive', rideController.arrive.bind(rideController));
router.post('/:id/start', rideController.start.bind(rideController));
router.post('/:id/complete', rideController.complete.bind(rideController));
router.post('/:id/cancel', rideController.cancel.bind(rideController));

// Driver manually accepts a booking → creates the ride
router.post('/booking/:bookingId/accept', rideController.acceptBooking.bind(rideController));

module.exports = router;
