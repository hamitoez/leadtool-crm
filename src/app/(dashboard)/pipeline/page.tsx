import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PipelineBoard } from "@/components/pipeline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FolderKanban } from "lucide-react";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;

  // Get all user projects
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { tables: true } },
    },
  });

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] gap-4">
        <FolderKanban className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Keine Projekte vorhanden</h2>
        <p className="text-muted-foreground">
          Erstelle zuerst ein Projekt, um die Pipeline zu nutzen.
        </p>
        <Button asChild>
          <Link href="/projects">Projekte erstellen</Link>
        </Button>
      </div>
    );
  }

  // Use first project if none selected
  const selectedProjectId = params.projectId || projects[0].id;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Project Selector */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Projekt:</label>
          <form action="/pipeline" method="GET">
            <Select name="projectId" defaultValue={selectedProjectId}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Projekt auswählen" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    <Link href={`/pipeline?projectId=${project.id}`}>
                      {project.name}
                    </Link>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </form>
        </div>
      </div>

      {/* Pipeline Board */}
      <div className="flex-1">
        <PipelineBoard projectId={selectedProjectId} />
      </div>
    </div>
  );
}
