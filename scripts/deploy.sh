#!/bin/bash
# Deploy Script für LeadTool
# Führt Build aus und kopiert statische Dateien für Standalone-Mode
#
# WICHTIG: IMMER dieses Script verwenden statt `npx next build` direkt!
#          Sonst fehlen die statischen Dateien im Standalone-Ordner.

set -e

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              LeadTool Deploy Script                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

cd /var/www/leadtool

# 1. Build
echo "[1/5] Building Next.js application..."
npx next build

# 2. Copy static assets (WICHTIG für Standalone-Mode!)
echo "[2/5] Copying static assets to standalone..."
cp -r .next/static .next/standalone/.next/static

# 3. Copy public folder
echo "[3/5] Copying public folder to standalone..."
if [ -d "public" ]; then
  cp -r public .next/standalone/public
fi

# 4. Restart PM2
echo "[4/5] Restarting PM2..."
pm2 restart leadtool

# 5. Verify deployment
echo "[5/5] Verifying deployment..."
sleep 3

STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login)
if [ "$STATUS" = "200" ]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  ✅ Deploy Complete - App is running!                     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    pm2 status
else
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  ❌ Deploy Failed! HTTP status: $STATUS                   ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Last 20 log lines:"
    pm2 logs leadtool --lines 20 --nostream
    exit 1
fi
