# Integration Guide

How to integrate the Python worker with the Next.js LeadTool CRM application.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────┐         ┌──────────────────┐
│   Next.js App   │────────▶│    Redis    │────────▶│  Python Worker   │
│   (Frontend)    │         │   (Queue)   │         │   (Extraction)   │
└─────────────────┘         └─────────────┘         └──────────────────┘
        │                                                      │
        │                                                      │
        └──────────────────────┬───────────────────────────────┘
                               ▼
                        ┌─────────────┐
                        │ PostgreSQL  │
                        │ (Database)  │
                        └─────────────┘
```

## Workflow

1. User enters URL in Next.js app
2. App creates Extraction record in database
3. App pushes job to Redis queue
4. Python worker picks up job
5. Worker processes extraction
6. Worker saves results to database
7. App displays results to user

## Next.js Integration

### 1. Install Redis Client

In your Next.js project:

```bash
npm install ioredis
```

### 2. Create Queue Service

Create `src/lib/queue.ts`:

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function enqueueExtraction(
  extractionId: string,
  url: string,
  rowId: string
) {
  const job = {
    extractionId,
    url,
    rowId,
    retryCount: 0,
  };

  await redis.lpush('extraction-queue', JSON.stringify(job));
  console.log(`Enqueued extraction ${extractionId} for ${url}`);
}

export async function getQueueLength(): Promise<number> {
  return await redis.llen('extraction-queue');
}
```

### 3. Create API Endpoint

Create `src/app/api/extractions/start/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { enqueueExtraction } from '@/lib/queue';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, rowId } = await req.json();

  if (!url || !rowId) {
    return NextResponse.json(
      { error: 'URL and rowId are required' },
      { status: 400 }
    );
  }

  try {
    // Create extraction record
    const extraction = await prisma.extraction.create({
      data: {
        rowId,
        url,
        normalizedUrl: url, // Worker will normalize
        status: 'PENDING',
        progress: 0,
      },
    });

    // Enqueue job
    await enqueueExtraction(extraction.id, url, rowId);

    return NextResponse.json({
      extractionId: extraction.id,
      status: 'queued',
    });
  } catch (error) {
    console.error('Error starting extraction:', error);
    return NextResponse.json(
      { error: 'Failed to start extraction' },
      { status: 500 }
    );
  }
}
```

### 4. Create Status Polling Endpoint

Create `src/app/api/extractions/[id]/status/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const extractionId = params.id;

  const extraction = await prisma.extraction.findUnique({
    where: { id: extractionId },
    include: {
      entities: {
        orderBy: { confidence: 'desc' },
      },
      scrapedPages: {
        select: {
          pageType: true,
          statusCode: true,
          fetchTime: true,
        },
      },
    },
  });

  if (!extraction) {
    return NextResponse.json(
      { error: 'Extraction not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: extraction.id,
    status: extraction.status,
    progress: extraction.progress,
    confidence: extraction.confidence,
    error: extraction.error,
    entities: extraction.entities,
    scrapedPages: extraction.scrapedPages,
  });
}
```

### 5. Frontend Component

Create `src/components/ExtractionButton.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ExtractionButton({ url, rowId }: { url: string; rowId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [extractionId, setExtractionId] = useState<string | null>(null);

  const startExtraction = async () => {
    setStatus('loading');

    try {
      // Start extraction
      const res = await fetch('/api/extractions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, rowId }),
      });

      const data = await res.json();
      setExtractionId(data.extractionId);

      // Poll for status
      const pollInterval = setInterval(async () => {
        const statusRes = await fetch(`/api/extractions/${data.extractionId}/status`);
        const statusData = await statusRes.json();

        if (statusData.status === 'COMPLETED' || statusData.status === 'FAILED') {
          clearInterval(pollInterval);
          setStatus(statusData.status === 'COMPLETED' ? 'success' : 'error');

          // Refresh the page data
          window.location.reload();
        }
      }, 2000);

    } catch (error) {
      console.error('Extraction error:', error);
      setStatus('error');
    }
  };

  return (
    <Button
      onClick={startExtraction}
      disabled={status === 'loading'}
    >
      {status === 'loading' ? 'Extracting...' : 'Extract Data'}
    </Button>
  );
}
```

## Database Schema

The worker uses these Prisma models (already in your schema):

- `Extraction`: Main extraction record
- `ScrapedPage`: Fetched pages (homepage, impressum, etc.)
- `ExtractedEntity`: Individual extracted entities (emails, phones, persons)

## Environment Variables

Add to your `.env`:

```bash
# Redis (for queue)
REDIS_URL=redis://localhost:6379

# Worker will use same DATABASE_URL as Next.js app
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leadtool?schema=public
```

## Server Actions (Alternative)

Instead of API routes, you can use Server Actions:

Create `src/app/actions/extraction.ts`:

```typescript
'use server';

import { prisma } from '@/lib/prisma';
import { enqueueExtraction } from '@/lib/queue';
import { revalidatePath } from 'next/cache';

export async function startExtraction(url: string, rowId: string) {
  const extraction = await prisma.extraction.create({
    data: {
      rowId,
      url,
      normalizedUrl: url,
      status: 'PENDING',
      progress: 0,
    },
  });

  await enqueueExtraction(extraction.id, url, rowId);

  revalidatePath('/projects');

  return { extractionId: extraction.id };
}

export async function getExtractionStatus(extractionId: string) {
  return await prisma.extraction.findUnique({
    where: { id: extractionId },
    include: {
      entities: true,
    },
  });
}
```

## Real-time Updates (Optional)

For real-time updates, you can use Server-Sent Events (SSE) or WebSockets.

Example SSE endpoint `src/app/api/extractions/[id]/stream/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const interval = setInterval(async () => {
        const extraction = await prisma.extraction.findUnique({
          where: { id: params.id },
        });

        if (extraction) {
          const data = `data: ${JSON.stringify(extraction)}\n\n`;
          controller.enqueue(encoder.encode(data));

          if (extraction.status === 'COMPLETED' || extraction.status === 'FAILED') {
            clearInterval(interval);
            controller.close();
          }
        }
      }, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## Testing Integration

1. Start PostgreSQL and Redis
2. Start the Python worker: `cd worker && python main.py`
3. Start Next.js app: `npm run dev`
4. Create a table row with a URL column
5. Click "Extract Data" button
6. Watch the worker logs and database for updates

## Production Considerations

1. **Queue Monitoring**: Set up alerts for queue length
2. **Worker Scaling**: Run multiple worker instances for high load
3. **Rate Limiting**: Configure per-domain rate limits
4. **Error Handling**: Implement retry logic with exponential backoff
5. **Cost Control**: Monitor LLM API usage and costs
6. **Caching**: Cache extraction results to avoid re-processing
7. **Webhooks**: Add webhook notifications for completed extractions

## Example: Full Integration Flow

```typescript
// 1. User adds URL to table
const row = await prisma.row.create({
  data: {
    tableId: 'table-123',
    position: 0,
    cells: {
      create: [
        {
          columnId: 'url-column-id',
          value: 'https://example.com',
        },
      ],
    },
  },
});

// 2. Automatically trigger extraction
const extraction = await prisma.extraction.create({
  data: {
    rowId: row.id,
    url: 'https://example.com',
    normalizedUrl: 'https://example.com',
    status: 'PENDING',
  },
});

await enqueueExtraction(extraction.id, 'https://example.com', row.id);

// 3. Worker processes
// (happens automatically in background)

// 4. Check results
const results = await prisma.extractedEntity.findMany({
  where: { extractionId: extraction.id },
  orderBy: { confidence: 'desc' },
});

// 5. Update table cells with extracted data
for (const entity of results) {
  if (entity.entityType === 'EMAIL') {
    await prisma.cell.upsert({
      where: {
        rowId_columnId: {
          rowId: row.id,
          columnId: 'email-column-id',
        },
      },
      update: { value: entity.value },
      create: {
        rowId: row.id,
        columnId: 'email-column-id',
        value: entity.value,
        metadata: { confidence: entity.confidence },
      },
    });
  }
}
```

## Troubleshooting

### Jobs not being processed

- Check worker is running: `ps aux | grep "python main.py"`
- Check queue: `redis-cli LLEN extraction-queue`
- Check worker logs for errors

### Extraction stuck in PROCESSING

- Worker may have crashed mid-processing
- Re-enqueue the job or restart worker
- Check database for partial results

### Low confidence scores

- Website may not have impressum/contact page
- Enable LLM fallback for better results
- Check scraped pages for content

## Support

For integration issues:
1. Check worker logs: `python monitor.py`
2. Check database for extraction records
3. Verify Redis queue is working
4. Test worker directly: `python test_extraction.py <url>`
