# LeadTool CRM - Python Scraping Worker

Production-ready Python worker service for automated contact data extraction from websites.

## Features

- **Async HTTP Fetching**: High-performance HTTP client with connection pooling and rate limiting
- **Intelligent Page Discovery**: Automatically finds relevant pages (impressum, contact, team, about)
- **Multi-method Extraction**:
  - Regex-based extraction for emails, phones, names
  - Email deobfuscation (handles [at], &#64;, JavaScript, etc.)
  - German phone number normalization to +49 format
  - Person/role extraction with German name patterns
- **LLM Fallback**: Claude AI integration for complex cases
- **Validation & Scoring**: Confidence scoring for all extracted data
- **Redis Queue**: Job queue with retry logic and error handling
- **PostgreSQL Integration**: Direct database operations for results storage

## Architecture

```
worker/
├── main.py              # Entry point and pipeline orchestration
├── config.py            # Configuration from environment variables
├── database.py          # PostgreSQL connection and operations
├── queue_handler.py     # Redis queue consumer
├── pipeline/
│   ├── normalizer.py    # URL normalization
│   ├── fetcher.py       # HTTP client with rate limiting
│   ├── discoverer.py    # Page discovery
│   └── validator.py     # Confidence scoring
├── extractors/
│   ├── email.py         # Email extraction + deobfuscation
│   ├── phone.py         # Phone number extraction
│   ├── person.py        # Person/name extraction
│   └── llm.py           # LLM fallback with Claude
└── utils/
    └── patterns.py      # Regex patterns and helpers
```

## Installation

### Local Development

1. Install dependencies:
```bash
cd worker
pip install -r requirements.txt
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`

4. Run the worker:
```bash
python main.py
```

### Docker

Build and run with Docker:

```bash
cd worker
docker build -t leadtool-worker .
docker run --env-file .env leadtool-worker
```

### Docker Compose

Add to your existing `docker-compose.yml`:

```yaml
services:
  worker:
    build: ./worker
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
```

## Configuration

All configuration is done via environment variables. See `.env.example` for all options.

### Required Variables

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `ANTHROPIC_API_KEY`: Anthropic API key (optional, for LLM fallback)

### Optional Variables

- `RATE_LIMIT_REQUESTS_PER_SECOND`: Rate limit per domain (default: 2.0)
- `HTTP_TIMEOUT`: HTTP request timeout in seconds (default: 15)
- `MAX_RETRIES`: Max retry attempts per job (default: 3)
- `ENABLE_LLM_FALLBACK`: Enable Claude AI fallback (default: true)
- `LLM_CONFIDENCE_THRESHOLD`: Trigger LLM if confidence below this (default: 0.5)
- `LOG_LEVEL`: Logging level (default: INFO)

## Usage

### Job Format

Jobs are enqueued to Redis with the following format:

```json
{
  "extractionId": "clx123abc",
  "url": "https://example.com",
  "rowId": "clx456def",
  "retryCount": 0
}
```

### Extraction Pipeline

1. **URL Normalization**: Clean and standardize the URL
2. **Homepage Fetch**: Retrieve the main page
3. **Page Discovery**: Find impressum, contact, team pages
4. **Parallel Fetching**: Fetch all relevant pages
5. **Data Extraction**: Extract emails, phones, persons using multiple methods
6. **Validation**: Calculate confidence scores
7. **LLM Fallback**: Use Claude AI if confidence is low
8. **Database Storage**: Save all results and update status

### Extraction Methods

#### Email Extraction
- Standard regex patterns
- Deobfuscation: `[at]`, `(at)`, `&#64;`, etc.
- `mailto:` link parsing
- JavaScript deobfuscation (String.fromCharCode, concatenation)
- Classification: personal, role-based, business

#### Phone Extraction
- German phone patterns (+49, 0049, 0...)
- Normalization to +49 format
- Format validation

#### Person Extraction
- Role-based: "Geschäftsführer: Max Mustermann"
- Context-based on team/impressum pages
- German name validation
- First/last name parsing

#### LLM Extraction
- Triggered when confidence < 0.5 or no results
- Uses Claude 3.5 Sonnet
- Structured JSON output
- Cost tracking

### Output

Extracted entities are saved to the database with:
- Entity type (EMAIL, PHONE, PERSON, etc.)
- Value (normalized format)
- Confidence score (0-1)
- Source page type
- Extraction method
- Additional metadata

## Monitoring

### Logs

The worker outputs structured logs:
```
2024-01-15 10:30:00 - main - INFO - Processing extraction clx123abc for URL: https://example.com
2024-01-15 10:30:01 - pipeline.fetcher - INFO - Fetched https://example.com -> 200 (245ms)
2024-01-15 10:30:02 - extractors.email - INFO - Extracted 3 emails from impressum page
2024-01-15 10:30:03 - main - INFO - Extraction clx123abc completed with status COMPLETED. Confidence: 0.85, Entities: 8
```

### Health Check

The Docker container includes a health check that pings Redis:
```bash
docker inspect --format='{{.State.Health.Status}}' leadtool-worker
```

### Metrics

- Processing time per extraction
- Entity counts by type
- Confidence scores
- LLM API usage and cost
- Retry statistics

## Error Handling

- **Network errors**: Automatic retry with exponential backoff
- **Timeouts**: Configurable timeout with fallback
- **Invalid URLs**: Graceful handling with error status
- **Parse errors**: Continue processing other entities
- **Database errors**: Transaction rollback and retry

## Rate Limiting

- Per-domain rate limiting (default: 2 req/s)
- Connection pooling for efficiency
- Burst handling with configurable limits

## Security

- Non-root Docker user
- No credentials in code
- Environment-based configuration
- Input validation and sanitization
- SQL injection protection (parameterized queries)

## Development

### Running Tests

```bash
pytest
```

### Adding New Extractors

1. Create new file in `extractors/`
2. Implement extraction logic
3. Add to pipeline in `main.py`
4. Update patterns in `utils/patterns.py`

### Debugging

Set `LOG_LEVEL=DEBUG` for verbose output:
```bash
LOG_LEVEL=DEBUG python main.py
```

## Performance

- Async I/O for concurrent fetching
- Connection pooling (HTTP/2 support)
- Rate limiting to avoid bans
- Efficient HTML parsing with selectolax
- Database connection pooling

Typical performance:
- Homepage fetch: 200-500ms
- Page discovery: 50-100ms
- Extraction: 100-300ms
- LLM call: 1-3s (when used)
- **Total**: 2-5s per website (without LLM), 3-8s (with LLM)

## Troubleshooting

### Worker not processing jobs

1. Check Redis connection:
```bash
redis-cli -u $REDIS_URL ping
```

2. Check queue:
```bash
redis-cli -u $REDIS_URL LLEN extraction-queue
```

3. Check logs for errors

### Low confidence scores

- Ensure pages have impressum/contact information
- Check if website blocks scrapers (adjust User-Agent)
- Enable LLM fallback for better results

### Database errors

- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Ensure schema is up to date (run migrations)

## License

Proprietary - LeadTool CRM
