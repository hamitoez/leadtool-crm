import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ChevronRight, Plus, FolderKanban, Calendar } from "lucide-react";
import { CreateTableDialog } from "@/components/projects/create-table-dialog";
import { TableCard } from "@/components/projects/table-card";
import { EditProjectButton } from "@/components/projects/edit-project-button";
import { ScrapeLogSection } from "@/components/projects/scrape-log-section";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: {
      id: projectId,
      userId: session.user.id,
    },
    include: {
      tables: {
        include: {
          _count: {
            select: {
              rows: true,
              columns: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
        <Link
          href="/projects"
          className="hover:text-foreground transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">{project.name}</span>
      </nav>

      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground max-w-2xl">
              {project.description}
            </p>
          )}
          <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Created {new Date(project.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <div className="flex items-center gap-1">
              <FolderKanban className="h-4 w-4" />
              {project.tables.length} table{project.tables.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <EditProjectButton project={project} />
      </div>

      <Separator />

      {/* Tables Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Tabellen</h2>
            <p className="text-sm text-muted-foreground">
              Organisiere deine Daten in Tabellen
            </p>
          </div>
          <CreateTableDialog projectId={project.id}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Neue Tabelle
            </Button>
          </CreateTableDialog>
        </div>

        {project.tables.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No tables yet</h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Create your first table to start organizing your data.
              </p>
              <CreateTableDialog projectId={project.id}>
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Table
                </Button>
              </CreateTableDialog>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {project.tables.map((table) => (
              <TableCard key={table.id} projectId={project.id} table={table} />
            ))}
          </div>
        )}
      </div>

      {/* Failed Scrapes Section */}
      <ScrapeLogSection projectId={project.id} />
    </div>
  );
}
