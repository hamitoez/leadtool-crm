# Worker Directory Structure

Complete overview of the Python scraping worker architecture.

```
worker/
├── README.md                    # Main documentation
├── QUICKSTART.md               # Quick start guide
├── INTEGRATION.md              # Next.js integration guide
├── STRUCTURE.md                # This file
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Docker image definition
├── docker-compose.yml          # Docker Compose configuration
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
│
├── main.py                     # Entry point - orchestrates pipeline
├── config.py                   # Configuration from environment
├── database.py                 # PostgreSQL operations
├── queue_handler.py            # Redis queue consumer
│
├── pipeline/                   # Processing pipeline modules
│   ├── __init__.py
│   ├── normalizer.py           # URL normalization & validation
│   ├── fetcher.py              # Async HTTP client with rate limiting
│   ├── discoverer.py           # Page discovery (impressum, kontakt, etc.)
│   └── validator.py            # Confidence scoring & validation
│
├── extractors/                 # Entity extraction modules
│   ├── __init__.py
│   ├── email.py                # Email extraction + deobfuscation
│   ├── phone.py                # Phone number extraction & normalization
│   ├── person.py               # Person/name extraction
│   └── llm.py                  # LLM-based extraction (Claude)
│
├── utils/                      # Utility modules
│   ├── __init__.py
│   └── patterns.py             # Regex patterns & helpers
│
├── test_extraction.py          # Direct testing without queue
├── enqueue_job.py              # Manual job enqueuing
└── monitor.py                  # Monitoring dashboard
```

## Module Responsibilities

### Core Modules

#### `main.py`
- Entry point for the worker
- Orchestrates the complete extraction pipeline
- Manages async operations
- Handles graceful shutdown

**Key functions:**
- `ExtractionPipeline.process()` - Main processing logic
- `main()` - Worker initialization and queue listening

#### `config.py`
- Loads configuration from environment variables
- Validates required settings
- Provides defaults for optional settings
- Centralized configuration access

**Key settings:**
- Database and Redis URLs
- Rate limiting parameters
- HTTP client settings
- LLM configuration
- Discovery patterns

#### `database.py`
- PostgreSQL connection pooling
- CRUD operations for extractions
- Manages extraction status updates
- Saves scraped pages and entities

**Key functions:**
- `update_extraction_status()` - Update extraction progress
- `save_scraped_page()` - Save fetched page
- `save_extracted_entity()` - Save extracted data
- `get_extraction()` - Retrieve extraction record

#### `queue_handler.py`
- Redis queue consumer
- Job retry logic
- Error handling
- Graceful shutdown

**Key functions:**
- `listen()` - Listen for jobs on Redis queue
- `_process_job_with_retry()` - Process with retry logic
- `enqueue_job()` - Manually enqueue jobs

### Pipeline Modules

#### `pipeline/normalizer.py`
- URL normalization and cleaning
- Schema handling (add https://)
- Domain extraction
- Relative to absolute URL conversion

**Key functions:**
- `normalize_url()` - Normalize URL to standard format
- `get_domain()` - Extract domain from URL
- `is_same_domain()` - Check if URLs share domain
- `make_absolute_url()` - Convert relative to absolute

#### `pipeline/fetcher.py`
- Async HTTP client (httpx)
- Connection pooling
- Rate limiting per domain
- User-Agent rotation
- Timeout handling

**Key classes:**
- `Fetcher` - HTTP client with rate limiting
- `RateLimiter` - Per-domain rate limiting
- `FetchResult` - Fetch result dataclass

#### `pipeline/discoverer.py`
- Find relevant pages from homepage
- Parse HTML for links
- Match URL and text patterns
- Extract clean text content

**Key functions:**
- `discover()` - Find relevant pages
- `prioritize_pages()` - Order pages by importance
- `extract_text_content()` - Clean text extraction

#### `pipeline/validator.py`
- Validate extracted entities
- Calculate confidence scores
- Check email domains
- Validate phone formats

**Key functions:**
- `validate_email()` - Email validation with scoring
- `validate_phone()` - Phone validation
- `validate_person()` - Person validation
- `calculate_overall_confidence()` - Aggregate scoring

### Extractor Modules

#### `extractors/email.py`
- Standard regex extraction
- Email deobfuscation (multiple patterns)
- mailto: link extraction
- JavaScript deobfuscation
- Email classification

**Key classes:**
- `EmailExtractor` - Main extraction class
- `ExtractedEmail` - Result dataclass

**Extraction methods:**
1. Standard regex on text
2. Deobfuscation patterns
3. mailto: links from HTML
4. JavaScript email patterns

#### `extractors/phone.py`
- German phone number patterns
- Normalization to +49 format
- Format validation
- Confidence scoring

**Key classes:**
- `PhoneExtractor` - Main extraction class
- `ExtractedPhone` - Result dataclass

#### `extractors/person.py`
- Role-based extraction
- German name patterns
- Name parsing (first/last)
- Role extraction

**Key classes:**
- `PersonExtractor` - Main extraction class
- `ExtractedPerson` - Result dataclass

**Extraction methods:**
1. Role-based (Geschäftsführer: Name)
2. Context-based (team/impressum pages)

#### `extractors/llm.py`
- Anthropic Claude integration
- Structured extraction from impressum
- JSON response parsing
- Cost tracking

**Key functions:**
- `extract_from_impressum()` - LLM-based extraction
- `convert_llm_to_entities()` - Convert to entity format
- `get_stats()` - Usage statistics

### Utility Modules

#### `utils/patterns.py`
- Regex patterns for all entity types
- Helper functions
- Classification logic
- Validation rules

**Pattern categories:**
- Email patterns (standard + obfuscation)
- Phone patterns (German formats)
- Name patterns (German names)
- Address patterns
- Company patterns
- Trade register patterns
- VAT ID patterns

### Support Scripts

#### `test_extraction.py`
- Test extraction without queue
- Create test database records
- Display formatted results
- Support multiple URLs

**Usage:**
```bash
python test_extraction.py https://example.com
```

#### `enqueue_job.py`
- Manually enqueue jobs to Redis
- Create test database records
- Bulk job enqueuing

**Usage:**
```bash
python enqueue_job.py https://site1.com https://site2.com
```

#### `monitor.py`
- Real-time monitoring dashboard
- Queue statistics
- Extraction statistics
- Recent activity
- Failed extractions

**Usage:**
```bash
# One-time snapshot
python monitor.py

# Continuous monitoring
python monitor.py --watch
```

## Data Flow

```
1. Job arrives from Redis queue
   ↓
2. Create Extraction record (PENDING → PROCESSING)
   ↓
3. Normalize URL
   ↓
4. Fetch homepage
   ↓
5. Save ScrapedPage (homepage)
   ↓
6. Discover relevant pages (impressum, kontakt, team, about)
   ↓
7. Fetch all relevant pages in parallel
   ↓
8. Save ScrapedPages
   ↓
9. Extract entities from all pages
   - Emails (regex, deobfuscation, mailto, JS)
   - Phones (pattern matching, normalization)
   - Persons (role-based, context-based)
   ↓
10. Validate entities (confidence scoring)
   ↓
11. Save valid ExtractedEntities
   ↓
12. Calculate overall confidence
   ↓
13. LLM fallback if confidence < threshold
   ↓
14. Update Extraction (COMPLETED/PARTIAL/FAILED)
```

## Database Schema

### `extractions`
- Main extraction record
- Status: PENDING, PROCESSING, COMPLETED, FAILED, PARTIAL
- Progress: 0-100
- Confidence: 0-1
- Links to Row (1:1)

### `scraped_pages`
- Fetched pages
- Stores HTML and text content
- Links to Extraction (N:1)

### `extracted_entities`
- Individual extracted entities
- Types: EMAIL, PHONE, PERSON, ADDRESS, etc.
- Confidence scores
- Links to Extraction (N:1)

## Configuration

All configuration via environment variables:

### Required
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection

### Optional
- `ANTHROPIC_API_KEY` - For LLM fallback
- `RATE_LIMIT_REQUESTS_PER_SECOND` - Rate limiting
- `HTTP_TIMEOUT` - Request timeout
- `MAX_RETRIES` - Job retry attempts
- `ENABLE_LLM_FALLBACK` - Enable/disable LLM
- `LOG_LEVEL` - Logging verbosity

See `.env.example` for all options.

## Dependencies

### Core
- `httpx` - Async HTTP client
- `redis` - Redis client
- `psycopg2-binary` - PostgreSQL driver
- `selectolax` - Fast HTML parser
- `anthropic` - Claude API client
- `pydantic` - Data validation
- `python-dotenv` - Environment variables

### Utilities
- `tldextract` - Domain extraction

## Performance Characteristics

### Typical Processing Time
- URL normalization: < 1ms
- Homepage fetch: 200-500ms
- Page discovery: 50-100ms
- Relevant page fetching: 1-2s (parallel)
- Entity extraction: 100-300ms
- LLM extraction: 1-3s (if used)

**Total: 2-5s per website** (without LLM), **3-8s** (with LLM)

### Concurrency
- Max concurrent domains: 3 (configurable)
- Max pages per domain: 2 (configurable)
- Rate limit: 2 req/s per domain (configurable)

### Resource Usage
- Memory: ~50-100MB per worker
- CPU: Low (mostly I/O bound)
- Network: Moderate (depends on rate limit)

## Error Handling

- Network errors → Retry with backoff
- Timeouts → Configurable, with retry
- Invalid URLs → Mark as FAILED
- Parse errors → Continue with other entities
- Database errors → Rollback and retry
- LLM errors → Log and continue without LLM

## Monitoring

### Logs
Structured logging with levels:
- DEBUG: Detailed operation logs
- INFO: Normal operation
- WARNING: Recoverable errors
- ERROR: Processing failures

### Metrics
- Queue length
- Processing time
- Success/failure rates
- Entity counts by type
- Confidence scores
- LLM usage and cost

### Health Checks
- Redis connectivity
- Database connectivity
- Queue processing

## Deployment

### Local Development
```bash
python main.py
```

### Docker
```bash
docker build -t leadtool-worker .
docker run --env-file .env leadtool-worker
```

### Docker Compose
```bash
docker-compose up -d
```

### Production (systemd)
```bash
sudo systemctl enable leadtool-worker
sudo systemctl start leadtool-worker
```

## Testing

### Unit Tests
```bash
pytest
```

### Integration Test
```bash
python test_extraction.py https://example.com
```

### Manual Test
```bash
# 1. Start worker
python main.py

# 2. Enqueue job (in another terminal)
python enqueue_job.py https://example.com

# 3. Monitor
python monitor.py --watch
```

## Extending

### Adding New Entity Type

1. Create pattern in `utils/patterns.py`
2. Create extractor in `extractors/`
3. Add to pipeline in `main.py`
4. Update validator in `pipeline/validator.py`
5. Add to database schema (Prisma)

### Adding New Page Type

1. Add pattern to `config.py` (DISCOVERY_PATTERNS)
2. Update discoverer logic if needed
3. Test with real websites

### Custom Extraction Logic

Extend `ExtractionPipeline` class in `main.py` with custom methods.

## Security

- Non-root Docker user
- No credentials in code
- Environment-based config
- SQL injection protection (parameterized queries)
- Input validation
- Rate limiting to avoid abuse

## Maintenance

### Regular Tasks
- Monitor queue length
- Check error rates
- Review failed extractions
- Update patterns for new websites
- Monitor LLM costs

### Scaling
- Run multiple workers for high load
- Use Redis cluster for high throughput
- Database connection pooling
- Optimize rate limits

## Support

- Check logs: `python monitor.py`
- Test directly: `python test_extraction.py <url>`
- Check queue: `redis-cli LLEN extraction-queue`
- Check database: `psql $DATABASE_URL`
