#!/bin/bash
# =====================================================
# VERIFY DATABASE PER SERVICE REFACTOR
# =====================================================

set -e

echo "=========================================="
echo "VERIFYING DATABASE PER SERVICE ARCHITECTURE"
echo "=========================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 1. Verify all databases exist
echo "1. Checking databases exist..."
DBS=$(docker exec cab_postgres psql -U postgres -t -c "SELECT datname FROM pg_database WHERE datname LIKE '%_db';" 2>/dev/null || echo "")

REQUIRED_DBS="auth_db user_db booking_db driver_db ride_db payment_db pricing_db review_db notification_db"

for DB in $REQUIRED_DBS; do
    if echo "$DBS" | grep -q "$DB"; then
        echo -e "${GREEN}✓${NC} Database $DB exists"
    else
        echo -e "${RED}✗${NC} Database $DB MISSING"
        ((ERRORS++))
    fi
done

echo ""

# 2. Verify service DB_NAME environment variables
echo "2. Checking service DB_NAME configuration..."

SERVICES="auth-service:auth_db user-service:user_db booking-service:booking_db driver-service:driver_db ride-service:ride_db payment-service:payment_db pricing-service:pricing_db review-service:review_db notification-service:notification_db"

for SERVICE_CONFIG in $SERVICES; do
    IFS=':' read -r SERVICE EXPECTED_DB <<< "$SERVICE_CONFIG"
    CONTAINER="cab_${SERVICE//-/_}"
    
    ACTUAL_DB=$(docker exec $CONTAINER printenv DB_NAME 2>/dev/null || echo "NOT_SET")
    
    if [ "$ACTUAL_DB" = "$EXPECTED_DB" ]; then
        echo -e "${GREEN}✓${NC} $SERVICE: DB_NAME=$ACTUAL_DB"
    else
        echo -e "${RED}✗${NC} $SERVICE: Expected $EXPECTED_DB, got $ACTUAL_DB"
        ((ERRORS++))
    fi
done

echo ""

# 3. Verify no shared DB_NAME=postgres
echo "3. Checking for shared database (should be empty)..."
SHARED_DBS=$(docker ps --format "{{.Names}}" | grep cab_ | xargs -I {} docker exec {} printenv DB_NAME 2>/dev/null | grep "postgres" || true)

if [ -z "$SHARED_DBS" ]; then
    echo -e "${GREEN}✓${NC} No services using shared 'postgres' database"
else
    echo -e "${RED}✗${NC} Found services still using shared database!"
    echo "$SHARED_DBS"
    ((ERRORS++))
fi

echo ""

# 4. Verify table isolation
echo "4. Checking table isolation..."

# Check auth_db only has users table
AUTH_TABLES=$(docker exec cab_postgres psql -U postgres -d auth_db -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ' || echo "")
if echo "$AUTH_TABLES" | grep -q "users" && ! echo "$AUTH_TABLES" | grep -q "bookings\|drivers\|rides"; then
    echo -e "${GREEN}✓${NC} auth_db contains only auth tables"
else
    echo -e "${YELLOW}⚠${NC} auth_db tables: $AUTH_TABLES"
    ((WARNINGS++))
fi

# Check user_db only has profile tables
USER_TABLES=$(docker exec cab_postgres psql -U postgres -d user_db -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public';" 2>/dev/null | tr -d ' ' || echo "")
if echo "$USER_TABLES" | grep -q "user_profiles" && ! echo "$USER_TABLES" | grep -q "users\|bookings"; then
    echo -e "${GREEN}✓${NC} user_db contains only profile tables"
else
    echo -e "${YELLOW}⚠${NC} user_db tables: $USER_TABLES"
    ((WARNINGS++))
fi

echo ""

# 5. Verify Kafka topics exist
echo "5. Checking Kafka topics..."
REQUIRED_TOPICS="user.created user.updated user.deleted"

for TOPIC in $REQUIRED_TOPICS; do
    EXISTS=$(docker exec cab_kafka kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null | grep "$TOPIC" || echo "")
    if [ -n "$EXISTS" ]; then
        echo -e "${GREEN}✓${NC} Kafka topic '$TOPIC' exists"
    else
        echo -e "${YELLOW}⚠${NC} Kafka topic '$TOPIC' not found (will be auto-created)"
        ((WARNINGS++))
    fi
done

echo ""

# 6. Verify service health
echo "6. Checking service health..."

HEALTH_CHECKS="3001:auth-service 3006:user-service 3002:booking-service 3003:driver-service 3004:ride-service 3005:payment-service"

for CHECK in $HEALTH_CHECKS; do
    IFS=':' read -r PORT SERVICE <<< "$CHECK"
    
    if curl -s http://localhost:$PORT/health > /dev/null 2>&1 || curl -s http://localhost:$PORT > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $SERVICE responding on port $PORT"
    else
        echo -e "${YELLOW}⚠${NC} $SERVICE not responding on port $PORT (may need to start)"
        ((WARNINGS++))
    fi
done

echo ""

# 7. Verify no direct DB imports in code
echo "7. Checking code for anti-patterns..."

# Check for direct model imports from other services
ANTI_PATTERNS=$(find services/ -name "*.js" -type f -exec grep -l "require.*models.*User.*auth-service\|require.*auth-service.*models" {} \; 2>/dev/null || true)

if [ -z "$ANTI_PATTERNS" ]; then
    echo -e "${GREEN}✓${NC} No cross-service model imports found"
else
    echo -e "${RED}✗${NC} Found cross-service imports:"
    echo "$ANTI_PATTERNS"
    ((ERRORS++))
fi

echo ""

# Summary
echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
    echo "Database Per Service architecture is correctly configured!"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}✓ PASSED WITH WARNINGS${NC}"
    echo "Warnings: $WARNINGS (non-critical issues)"
    exit 0
else
    echo -e "${RED}✗ VERIFICATION FAILED${NC}"
    echo "Errors: $ERRORS"
    echo "Warnings: $WARNINGS"
    echo ""
    echo "Please fix the errors above before proceeding."
    exit 1
fi
