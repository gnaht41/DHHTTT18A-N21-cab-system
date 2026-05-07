const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Sequelize, DataTypes } = require('sequelize');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Database Connection
const sequelize = new Sequelize(
    process.env.DB_NAME || 'postgres',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'postgres',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
    }
);

// Price Rule Model
const PriceRule = sequelize.define('PriceRule', {
    serviceId: { type: DataTypes.STRING, unique: true, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    baseFare: { type: DataTypes.FLOAT, defaultValue: 5.0 },
    multiplier: { type: DataTypes.FLOAT, defaultValue: 1.0 },
    waitingTime: { type: DataTypes.STRING, defaultValue: '3 min' },
    icon: { type: DataTypes.STRING, defaultValue: 'Car' }
});

// Seed Data helper
const seedRules = async () => {
    const rules = [
        { serviceId: 'economy', name: 'Cab Economy', baseFare: 5.0, multiplier: 1.0, waitingTime: '3 min', icon: 'Car' },
        { serviceId: 'premium', name: 'Cab Premium', baseFare: 10.0, multiplier: 1.5, waitingTime: '2 min', icon: 'Shield' },
        { serviceId: 'luxury', name: 'Cab Luxury', baseFare: 20.0, multiplier: 2.5, waitingTime: '5 min', icon: 'Star' }
    ];
    for (const rule of rules) {
        await PriceRule.findOrCreate({
            where: { serviceId: rule.serviceId },
            defaults: rule
        });
    }
};

// Fare estimation for all available services
app.post('/api/pricing/estimate', async (req, res) => {
    try {
        const { pickup, destination, distance, demand_index, supply_index } = req.body;

        if (pickup === undefined || destination === undefined || distance === undefined) {
            return res.status(400).json({ error: 'pickup, destination and distance are required' });
        }

        if (typeof distance !== 'number' || Number.isNaN(distance) || distance < 0) {
            return res.status(422).json({ error: 'distance must be a non-negative number' });
        }

        const demandIndex = demand_index === undefined ? 1 : Number(demand_index);
        const supplyIndex = supply_index === undefined ? 1 : Number(supply_index);

        if (Number.isNaN(demandIndex) || demandIndex < 0) {
            return res.status(422).json({ error: 'demand_index must be a non-negative number' });
        }

        if (Number.isNaN(supplyIndex) || supplyIndex <= 0) {
            return res.status(422).json({ error: 'supply_index must be a positive number' });
        }

        const rules = await PriceRule.findAll();
        const distanceKm = distance ? (distance / 1000) : 3.0;
        const surgeMultiplier = Math.max(1.0, demandIndex / supplyIndex);

        const estimates = rules.map(rule => {
            const price = parseFloat((rule.baseFare * surgeMultiplier + (distanceKm * rule.multiplier)).toFixed(2));
            return {
                id: rule.serviceId,
                name: rule.name,
                wait: rule.waitingTime,
                icon: rule.icon,
                price: price,
                surge_multiplier: surgeMultiplier,
                currency: 'USD'
            };
        });

        res.json({ pickup, destination, distance, demand_index: demandIndex, supply_index: supplyIndex, estimates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Item 8: Pricing API trả về giá hợp lệ
app.post('/api/pricing', async (req, res) => {
    try {
        const { distance_km, demand_index } = req.body;
        const distKm = distance_km === undefined ? 1 : Number(distance_km);
        const demandIndex = demand_index === undefined ? 1 : Number(demand_index);

        if (Number.isNaN(distKm) || distKm < 0) {
            return res.status(422).json({ error: 'distance_km must be a non-negative number' });
        }

        const rule = await PriceRule.findOne({ where: { serviceId: 'economy' } });
        const baseFare = rule ? rule.baseFare : 5.0;
        const multiplier = rule ? rule.multiplier : 1.0;

        // Item 16: Surge không bao giờ < 1
        const surge = Math.max(1.0, demandIndex);
        const price = parseFloat((baseFare * surge + (distKm * multiplier)).toFixed(2));

        res.json({ price, surge });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3008;
sequelize.sync({ alter: true })
    .then(async () => {
        await seedRules();
        app.listen(PORT, () => console.log(`Pricing Service (DB-Backed) running on port ${PORT}`));
    })
    .catch(err => {
        console.error('Failed to sync database:', err.message);
        process.exit(1);
    });
