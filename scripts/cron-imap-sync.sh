#!/bin/bash
# Cron script for IMAP sync (reply/bounce detection)
# Runs every 10 minutes to sync incoming emails
# Add to crontab: */10 * * * * /var/www/leadtool/scripts/cron-imap-sync.sh

CRON_SECRET="${CRON_SECRET:-leadtool-cron-secret-2024}"
API_URL="${API_URL:-http://localhost:3000}"
LOG_FILE="/var/log/leadtool-imap-sync.log"

# Add timestamp to log
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running IMAP sync..." >> $LOG_FILE

curl -s -X GET "$API_URL/api/cron/imap-sync" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  >> $LOG_FILE 2>&1

echo "" >> $LOG_FILE
