#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Testing Database without Docker ===${NC}"

# Configuration
DB_NAME="sitetech_test"
DB_USER="postgres"
export PGHOST=localhost

# Cleanup function
cleanup() {
  echo -e "\n${YELLOW}Cleaning up...${NC}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Drop and recreate database
echo -e "\n${YELLOW}Dropping and recreating database...${NC}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DB_NAME;"

# Run bootstrap script
echo -e "\n${YELLOW}Running bootstrap script...${NC}"
sudo -u postgres psql -d $DB_NAME -v ON_ERROR_STOP=1 -f supabase/tests/bootstrap_no_docker.sql

# Apply migrations in order
echo -e "\n${YELLOW}Applying migrations...${NC}"
for migration in supabase/migrations/*.sql; do
  echo "  Applying: $(basename $migration)"
  sudo -u postgres psql -d $DB_NAME -v ON_ERROR_STOP=1 -f "$migration"
done

# Install pgTAP extension
echo -e "\n${YELLOW}Installing pgTAP extension...${NC}"
sudo -u postgres psql -d $DB_NAME -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pgtap;"

# Grant PUBLIC execute on pgTAP functions (they are created after our event trigger is active)
echo -e "${YELLOW}Granting PUBLIC execute on pgTAP functions...${NC}"
sudo -u postgres psql -d $DB_NAME -v ON_ERROR_STOP=1 -c "
DO \$\$
DECLARE
  func record;
BEGIN
  FOR func IN 
    SELECT p.oid::regprocedure as func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    JOIN pg_extension e ON e.oid = d.refobjid AND e.extname = 'pgtap'
    WHERE n.nspname IN ('public', 'tap')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', func.func_sig);
  END LOOP;
END;
\$\$;
"

# Run pgTAP tests
echo -e "\n${YELLOW}Running pgTAP tests...${NC}"
PGPASSWORD=postgres pg_prove -d $DB_NAME -U authenticator supabase/tests/*.test.sql

echo -e "\n${GREEN}=== All tests completed ===${NC}"
