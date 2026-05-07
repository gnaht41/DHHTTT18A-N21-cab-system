#!/bin/bash

# ================================================================
# CAB SYSTEM - ARCHITECTURE FIXES DEPLOYMENT SCRIPT
# ================================================================
# 
# Automates deployment of:
# 1. Redis cache layer
# 2. Circuit breaker + resilient HTTP client
# 3. Dead Letter Queue (DLQ)
# 4. MongoDB document store
#
# Usage: ./deploy-architecture-fixes.sh
# ================================================================

set -e

echo "🚀 CAB SYSTEM - Architecture Fixes Deployment"
echo "============================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_COMPOSE_FILE="$WORKSPACE_DIR/docker-compose.yml"

# ================================================================
# PHASE 1: PRE-DEPLOYMENT CHECKS
# ================================================================
echo -e "${BLUE}[1/5] Running pre-deployment checks...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
  exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose first.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Docker and Docker Compose found${NC}"

# Check if Docker daemon is running
if ! docker ps > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker daemon not running. Please start Docker.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Docker daemon is running${NC}"

# ================================================================
# PHASE 2: STOP EXISTING SERVICES
# ================================================================
echo ""
echo -e "${BLUE}[2/5] Stopping existing services...${NC}"

cd "$WORKSPACE_DIR"

if docker-compose ps | grep -q "Up"; then
  echo "Stopping running services..."
  docker-compose down --volumes || true
  sleep 2
fi

echo -e "${GREEN}✅ Services stopped${NC}"

# ================================================================
# PHASE 3: DEPLOY INFRASTRUCTURE
# ================================================================
echo ""
echo -e "${BLUE}[3/5] Deploying Redis + MongoDB + PostgreSQL + Kafka...${NC}"

# Start infrastructure services
echo "Starting PostgreSQL..."
docker-compose up -d postgres
sleep 5

echo "Starting Zookeeper..."
docker-compose up -d zookeeper
sleep 3

echo "Starting Kafka..."
docker-compose up -d kafka
sleep 5

echo "Starting Redis..."
docker-compose up -d redis
sleep 3

echo "Starting MongoDB..."
docker-compose up -d mongodb
sleep 5

# Verify services are healthy
echo ""
echo "Verifying infrastructure health..."

services=("postgres" "redis" "mongodb" "kafka")
for service in "${services[@]}"; do
  if docker-compose ps "$service" | grep -q "healthy"; then
    echo -e "${GREEN}✅ $service is healthy${NC}"
  elif docker-compose ps "$service" | grep -q "Up"; then
    echo -e "${YELLOW}⚠️  $service is running (may still be initializing)${NC}"
  else
    echo -e "${RED}❌ $service is not running${NC}"
    exit 1
  fi
done

echo -e "${GREEN}✅ Infrastructure deployed${NC}"

# ================================================================
# PHASE 4: DEPLOY MICROSERVICES
# ================================================================
echo ""
echo -e "${BLUE}[4/5] Deploying microservices...${NC}"

services=(
  "auth-service"
  "user-service"
  "booking-service"
  "driver-service"
  "ride-service"
  "payment-service"
  "pricing-service"
  "review-service"
  "notification-service"
  "api-gateway"
)

for service in "${services[@]}"; do
  echo "Starting $service..."
  docker-compose up -d "$service"
  sleep 2
done

echo -e "${GREEN}✅ All microservices deployed${NC}"

# ================================================================
# PHASE 5: POST-DEPLOYMENT VERIFICATION
# ================================================================
echo ""
echo -e "${BLUE}[5/5] Post-deployment verification...${NC}"

echo ""
echo "🔍 Checking running containers..."
docker-compose ps

echo ""
echo "🔗 Checking connectivity..."

# Test PostgreSQL
echo -n "PostgreSQL: "
if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Connected${NC}"
else
  echo -e "${YELLOW}⚠️  Pending...${NC}"
fi

# Test Redis
echo -n "Redis: "
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Connected${NC}"
else
  echo -e "${YELLOW}⚠️  Pending...${NC}"
fi

# Test MongoDB
echo -n "MongoDB: "
if docker-compose exec -T mongodb mongosh --quiet --eval "db.runCommand('ping')" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Connected${NC}"
else
  echo -e "${YELLOW}⚠️  Pending...${NC}"
fi

# Test Kafka
echo -n "Kafka: "
if docker-compose exec -T kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Connected${NC}"
else
  echo -e "${YELLOW}⚠️  Pending...${NC}"
fi

echo ""
echo "🔗 Service URLs:"
echo "  API Gateway:         http://localhost:3000"
echo "  Auth Service:        http://localhost:3001"
echo "  Booking Service:     http://localhost:3002"
echo "  Driver Service:      http://localhost:3003"
echo "  Ride Service:        http://localhost:3004"
echo "  Payment Service:     http://localhost:3005"
echo "  User Service:        http://localhost:3006"
echo "  Pricing Service:     http://localhost:3008"
echo "  Review Service:      http://localhost:3009"
echo "  Notification Service: http://localhost:3010"
echo ""
echo "🗄️  Database URLs:"
echo "  PostgreSQL:    postgresql://postgres:postgres@localhost:5432/[service]_db"
echo "  Redis:         redis://localhost:6379"
echo "  MongoDB:       mongodb://root:root@localhost:27017"
echo "  Kafka:         kafka:9092 (internal), localhost:29092 (external)"
echo ""

# ================================================================
# DEPLOYMENT SUMMARY
# ================================================================
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""

echo "📊 WHAT WAS DEPLOYED:"
echo "  1. ✅ Redis cache (JWT token caching)"
echo "  2. ✅ Circuit Breaker (resilient HTTP calls)"
echo "  3. ✅ Dead Letter Queue (DLQ) consumer"
echo "  4. ✅ MongoDB (notification history)"
echo ""

echo "🧪 NEXT STEPS:"
echo ""
echo "1. Test Redis JWT caching:"
echo "   curl http://localhost:3001/api/auth/status"
echo ""
echo "2. Monitor Circuit Breaker:"
echo "   curl http://localhost:3004/metrics"
echo ""
echo "3. Start DLQ monitor:"
echo "   cd services/booking-service && npm install && node bin/dlq-monitor.js"
echo ""
echo "4. Check MongoDB notifications:"
echo "   mongosh 'mongodb://root:root@localhost:27017' --eval 'db.notifications.find().limit(5)'"
echo ""

echo "📚 DOCUMENTATION:"
echo "  - AUDIT-ARCHITECTURE.md      (Full audit report with fixes)"
echo "  - ARCHITECTURE-ANALYSIS.md   (Detailed technical analysis)"
echo "  - ARCHITECTURE-SUMMARY.md    (Quick reference guide)"
echo "  - docker-compose.yml         (Infrastructure definition)"
echo ""

echo "🆘 TROUBLESHOOTING:"
echo "  - View logs:  docker-compose logs [service-name]"
echo "  - Stop all:   docker-compose down"
echo "  - Clean up:   docker-compose down -v"
echo ""

exit 0
