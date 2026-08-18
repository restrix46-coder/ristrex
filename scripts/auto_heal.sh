#!/bin/bash

# Auto-healing script for VPS 194.163.155.52
# Path: /var/www/weaver/scripts/auto_heal.sh
# Requires: pm2, jq

# Configuration
SERVICES=("api" "web" "database-service" "auth" "worker" "deploy-hook") # Replace with actual 6 service names
RATE_LIMIT_PATTERN="rate limit|429 Too Many Requests"
DEPLOY_HOOK_SERVICE="deploy-hook"
# Assuming standard pm2 log directory. You may need to adjust this depending on the PM2 user.
DEPLOY_HOOK_LOG="/home/weaver/.pm2/logs/${DEPLOY_HOOK_SERVICE}-error.log" 

echo "========================================"
echo "[$(date -u)] Running auto-healing script"
echo "========================================"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "[ERROR] pm2 is not installed or not in PATH."
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "[ERROR] jq is not installed. Please install jq (e.g., apt-get install jq) for JSON parsing."
    exit 1
fi

# 1. Maintain 100% uptime for all 6 infrastructure services
# Automatically restart any service that is not 'online'
echo "[INFO] Checking status of all services..."
for service in "${SERVICES[@]}"; do
    # Get status of the service
    STATUS=$(pm2 jlist | jq -r ".[] | select(.name == \"$service\") | .pm2_env.status")
    
    if [ -z "$STATUS" ]; then
        echo "[WARN] Service '$service' is not managed by PM2 currently. Please start it initially."
    elif [ "$STATUS" != "online" ]; then
        echo "[ACTION] Service '$service' is currently '$STATUS'. Restarting to maintain uptime..."
        pm2 restart "$service"
    else
        echo "[OK] Service '$service' is online."
    fi
done

# 2. Restart deploy hook if rate limited
echo "[INFO] Checking deploy hook logs for rate limiting..."
if [ -f "$DEPLOY_HOOK_LOG" ]; then
    # Check the last 100 lines of the error log for rate limiting patterns
    RATE_LIMITED=$(tail -n 100 "$DEPLOY_HOOK_LOG" | grep -iE "$RATE_LIMIT_PATTERN")
    if [ -n "$RATE_LIMITED" ]; then
        echo "[ACTION] Rate limit detected in '$DEPLOY_HOOK_SERVICE' logs. Restarting service..."
        pm2 restart "$DEPLOY_HOOK_SERVICE"
        
        # Clear the error log to prevent loop restarts on the same errors in the next cron run
        echo "Flushed log after rate limit restart" > "$DEPLOY_HOOK_LOG"
    else
        echo "[OK] No rate limit detected for '$DEPLOY_HOOK_SERVICE'."
    fi
else
    echo "[WARN] Log file '$DEPLOY_HOOK_LOG' not found. Is the service running and logging to this path?"
fi

# 3. Verify PM2 process tokens (if environment token validation is needed)
# Example: Verify if essential tokens are present in the environment of running processes
# This checks if a process has a missing 'API_TOKEN' or similar required env var.
echo "[INFO] Verifying PM2 process tokens..."
# Add logic to verify process tokens here if necessary. 
# For example, ensuring all services have a valid SECRET_KEY loaded.

echo "[$(date -u)] Auto-healing script completed."
echo "========================================"
