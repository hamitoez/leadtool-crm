#!/bin/bash
# Cron script for campaign email scheduler
# Runs every 5 minutes to process active campaigns
# Add to crontab: */5 * * * * /var/www/leadtool/scripts/cron-campaign-scheduler.sh

CRON_SECRET="${CRON_SECRET:-leadtool-cron-secret-2024}"
API_URL="${API_URL:-http://localhost:3000}"
LOG_FILE="/var/log/leadtool-campaign-scheduler.log"

# Add timestamp to log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running campaign scheduler..." >> $LOG_FILE

curl -s -X GET "$API_URL/api/cron/campaign-scheduler" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  >> $LOG_FILE 2>&1

echo "" >> $LOG_FILE
