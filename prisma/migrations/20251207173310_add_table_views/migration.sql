-- CreateTable
CREATE TABLE "table_views" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL DEFAULT '[]',
    "sorting" JSONB NOT NULL DEFAULT '[]',
    "columnVisibility" JSONB NOT NULL DEFAULT '{}',
    "columnOrder" JSONB NOT NULL DEFAULT '[]',
    "globalFilter" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "table_views_tableId_idx" ON "table_views"("tableId");

-- AddForeignKey
ALTER TABLE "table_views" ADD CONSTRAINT "table_views_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
