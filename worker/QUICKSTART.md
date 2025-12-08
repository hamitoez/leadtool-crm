# Quick Start Guide

Get the LeadTool scraping worker up and running in 5 minutes.

## Prerequisites

- Python 3.11+
- PostgreSQL (with LeadTool database)
- Redis

## 1. Install Dependencies

```bash
cd worker
pip install -r requirements.txt
```

## 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set your configuration:

```bash
# Required
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leadtool?schema=public
REDIS_URL=redis://localhost:6379

# Optional (for LLM fallback)
ANTHROPIC_API_KEY=your-api-key-here
```

## 3. Start Services

Make sure PostgreSQL and Redis are running:

```bash
# Check PostgreSQL
psql $DATABASE_URL -c "SELECT 1"

# Check Redis
redis-cli ping
```

## 4. Run the Worker

```bash
python main.py
```

You should see:
```
2024-01-15 10:00:00 - config - INFO - Configuration validated
2024-01-15 10:00:00 - database - INFO - Database connection pool initialized
2024-01-15 10:00:00 - main - INFO - Starting scraping worker...
2024-01-15 10:00:00 - queue_handler - INFO - Connected to Redis at redis://localhost:6379
2024-01-15 10:00:00 - queue_handler - INFO - Listening for jobs on queue: extraction-queue
```

## 5. Test Extraction

In another terminal, enqueue a test job:

```bash
# Single URL
python enqueue_job.py https://example.com

# Multiple URLs
python enqueue_job.py https://site1.com https://site2.com https://site3.com
```

Or test directly without queue:

```bash
python test_extraction.py https://example.com
```

## 6. Monitor

View real-time statistics:

```bash
# One-time snapshot
python monitor.py

# Continuous monitoring (updates every 5s)
python monitor.py --watch
```

## Docker Quick Start

If you prefer Docker:

```bash
# Build
docker build -t leadtool-worker .

# Run
docker run --env-file .env --network host leadtool-worker
```

Or with Docker Compose:

```bash
docker-compose up -d
```

## Verify Installation

Check that everything is working:

```bash
# 1. Check worker is running
ps aux | grep "python main.py"

# 2. Check queue
redis-cli LLEN extraction-queue

# 3. Check recent extractions
python monitor.py
```

## Common Issues

### "Failed to connect to Redis"

Make sure Redis is running:
```bash
redis-server
```

### "Database connection failed"

Check your DATABASE_URL and ensure PostgreSQL is running:
```bash
psql $DATABASE_URL -c "SELECT version()"
```

### "No module named 'httpx'"

Install dependencies:
```bash
pip install -r requirements.txt
```

### Worker not processing jobs

1. Check Redis queue: `redis-cli LLEN extraction-queue`
2. Check worker logs for errors
3. Verify DATABASE_URL and REDIS_URL are correct

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Configure rate limiting and concurrency in `.env`
- Set up monitoring and alerting
- Deploy to production with Docker

## Production Deployment

For production use:

1. Set up proper logging (e.g., to file or external service)
2. Configure appropriate rate limits
3. Set up process management (systemd, supervisor, or Docker)
4. Enable health checks and monitoring
5. Configure database connection pooling
6. Set up Redis persistence
7. Configure LLM fallback carefully (cost implications)

Example systemd service:

```ini
[Unit]
Description=LeadTool Scraping Worker
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=worker
WorkingDirectory=/opt/leadtool/worker
EnvironmentFile=/opt/leadtool/worker/.env
ExecStart=/usr/bin/python3 /opt/leadtool/worker/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Save as `/etc/systemd/system/leadtool-worker.service` and:

```bash
sudo systemctl enable leadtool-worker
sudo systemctl start leadtool-worker
sudo systemctl status leadtool-worker
```

## Support

For issues or questions, check the logs:

```bash
# If using systemd
journalctl -u leadtool-worker -f

# If running directly
# Logs will appear in stdout
```
