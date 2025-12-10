#!/bin/bash
# Start the Impressum Scraper Service

cd /var/www/leadtool/scraper

# Activate virtual environment
source venv/bin/activate

# Set environment variables if not set
export SCRAPER_HOST="${SCRAPER_HOST:-127.0.0.1}"
export SCRAPER_PORT="${SCRAPER_PORT:-8765}"

echo "Starting Impressum Scraper on $SCRAPER_HOST:$SCRAPER_PORT..."

# Start the server
python -m scraper.server
