#!/bin/bash
# Cron script for auto-moving deals
# Add to crontab: 0 * * * * /var/www/leadtool/scripts/cron-auto-move.sh

CRON_SECRET="${CRON_SECRET:-leadtool-cron-secret-2024}"
API_URL="${API_URL:-http://localhost:3000}"

curl -s -X GET "$API_URL/api/cron/auto-move" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  >> /var/log/leadtool-cron.log 2>&1

echo "" >> /var/log/leadtool-cron.log
