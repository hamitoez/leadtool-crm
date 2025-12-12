# Python Scraper - DEPRECATED

**This Python scraper has been replaced by the built-in Node.js scraper.**

## What Changed?

The web scraping functionality is now integrated directly into the Next.js application using Node.js/TypeScript. This provides:

- **Better integration**: No separate Python service to run
- **Improved performance**: Uses Playwright for JavaScript-rendered pages
- **Full Firecrawl compatibility**: Implements Firecrawl v2 API
- **LLM extraction**: Built-in support for OpenAI, Anthropic, and Ollama

## New Scraper Location

The new scraper is located at:
```
src/lib/scraper/
├── index.ts              # Main entry point
├── types.ts              # TypeScript types
├── engines/
│   ├── playwright.ts     # Browser-based scraping
│   └── fetch.ts          # Fast HTTP scraping
├── transformers/
│   ├── html-to-markdown.ts
│   ├── metadata.ts
│   └── llm-extract.ts
└── crawler/
    ├── WebCrawler.ts     # Multi-page crawling
    ├── robots.ts         # robots.txt support
    └── sitemap.ts        # Sitemap discovery
```

## API Endpoints

The following endpoints use the new Node.js scraper:

- `POST /api/scrape` - CRM contact extraction (backward compatible)
- `POST /api/v2/scrape` - Firecrawl-compatible scraping
- `POST /api/v2/crawl` - Website crawling
- `GET /api/v2/crawl?id=xxx` - Crawl status

## Migration

No migration needed! The API interface remains the same. Simply remove the Python scraper service from your deployment.

## Removing This Directory

Once you've verified the new scraper works, you can safely delete this entire `scraper/` directory:

```bash
rm -rf scraper/
```

Also remove any Python-related entries from your `docker-compose.yml` if present.
