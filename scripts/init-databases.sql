-- =====================================================
-- DATABASE PER SERVICE - Initialization Script
-- Tự động chạy khi PostgreSQL container khởi động lần đầu
-- =====================================================

-- Create databases for each microservice
-- Each service has COMPLETE ISOLATION - no shared tables

-- 1. AUTH SERVICE DATABASE
-- Contains: Authentication credentials only
-- Tables: users (id, email, password_hash, role, is_active, created_at, updated_at)
CREATE DATABASE auth_db;

-- 2. USER SERVICE DATABASE  
-- Contains: User profile information
-- Tables: user_profiles, user_addresses, user_preferences
CREATE DATABASE user_db;

-- 3. BOOKING SERVICE DATABASE
-- Contains: Ride bookings and requests
-- Tables: bookings, booking_status_history
CREATE DATABASE booking_db;

-- 4. DRIVER SERVICE DATABASE
-- Contains: Driver profiles, vehicles, locations
-- Tables: drivers, vehicles, driver_locations, driver_documents, driver_earnings
CREATE DATABASE driver_db;

-- 5. RIDE SERVICE DATABASE
-- Contains: Active/completed rides, trip data
-- Tables: rides, ride_status_history, route_data, trip_events
CREATE DATABASE ride_db;

-- 6. PAYMENT SERVICE DATABASE
-- Contains: Payments, transactions, wallet
-- Tables: payments, transactions, wallets, payment_methods, refunds
CREATE DATABASE payment_db;

-- 7. PRICING SERVICE DATABASE
-- Contains: Pricing rules, surge pricing
-- Tables: pricing_rules, surge_multipliers, price_estimates, fare_calculations
CREATE DATABASE pricing_db;

-- 8. REVIEW SERVICE DATABASE
-- Contains: Ratings and reviews
-- Tables: reviews, ratings, review_replies
CREATE DATABASE review_db;

-- 9. NOTIFICATION SERVICE DATABASE
-- Contains: Notifications, preferences, delivery logs
-- Tables: notifications, notification_preferences, delivery_logs
CREATE DATABASE notification_db;

-- =====================================================
-- BEST PRACTICES APPLIED:
-- =====================================================
-- 1. Each service has its own database - NO shared tables
-- 2. Service-to-service communication via API/Kafka only
-- 3. No cross-database foreign keys
-- 4. Each service owns its data completely
-- 5. Services can only access their own database
-- =====================================================

-- Grant permissions (optional - for additional security)
-- Note: In production, use separate DB users per service
-- CREATE USER auth_service_user WITH PASSWORD 'auth_pass';
-- GRANT ALL PRIVILEGES ON DATABASE auth_db TO auth_service_user;
-- ... (repeat for each service)

-- Verify databases created
\l
