const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3012;

// Item 17: Fraud API với input thiếu field -> lỗi 400
app.post('/api/fraud/check', (req, res) => {
    try {
        const { user_id, driver_id, booking_id, amount, location, device_fingerprint } = req.body;
        
        const missingFields = [];
        if (!user_id) missingFields.push('user_id');
        if (!driver_id) missingFields.push('driver_id');
        if (!booking_id) missingFields.push('booking_id');
        if (!amount) missingFields.push('amount');
        if (!location) missingFields.push('location');
        if (!device_fingerprint) missingFields.push('device_fingerprint');

        if (missingFields.length > 0) {
            return res.status(400).json({ 
                error: 'missing required fields', 
                fields: missingFields,
                message: 'missing required fields' 
            });
        }

        // Mock fraud check: simple pass
        res.json({ fraud_score: 0.1, status: 'CLEAN' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'Fraud detection service is UP' });
});

app.listen(PORT, () => {
    console.log(`Fraud Service running on port ${PORT}`);
});
