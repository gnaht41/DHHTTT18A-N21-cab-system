const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');

// GET /api/drivers (List all drivers)
router.get('/', driverController.getAllDrivers.bind(driverController));
router.get('', driverController.getAllDrivers.bind(driverController));

// POST /api/drivers (For testing to add a new driver)
router.post('/', driverController.createDriver.bind(driverController));

// GET /api/drivers/available
router.get('/available', driverController.getAvailableDrivers.bind(driverController));

// GET /api/drivers/me
router.get('/me', driverController.getMe.bind(driverController));

// GET /api/drivers/:id
router.get('/:id', driverController.getDriverById.bind(driverController));

// PUT /api/drivers/:id/location
router.put('/:id/location', driverController.updateLocation.bind(driverController));

// POST /api/drivers/assign (DISABLED - Assignment now centralized in Ride Service)
// router.post('/assign', driverController.assignNearestDriver.bind(driverController));
router.post('/assign', (req, res) => {
    console.log('[DriverService] WARNING: Attempted to use deprecated /assign endpoint');
    res.status(410).json({
        error: 'Driver assignment is now centralized in Ride Service',
        message: 'Drivers receive ride assignments via socket only'
    });
});

// PATCH /api/drivers/status (Used by UI to toggle online/offline)
router.patch('/status', driverController.updateStatus.bind(driverController));

// GET /api/drivers/:id/status (Used by ride-service to check availability)
router.get('/:id/status', driverController.getStatus.bind(driverController));

// PATCH /api/drivers/:id/profile (Used by driver app to update name/phone)
router.patch('/:id/profile', driverController.updateProfile.bind(driverController));

// POST /api/drivers/:id/earnings (Called by ride-service when trip completes)
router.post('/:id/earnings', driverController.addEarnings.bind(driverController));

module.exports = router;
