import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">
            Manage your CRM projects and tables
          </p>
        </div>
        <CreateProjectDialog>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </CreateProjectDialog>
      </div>

      <Suspense fallback={<ProjectsLoading />}>
        <ProjectsList userId={session.user.id} />
      </Suspense>
    </div>
  );
}

async function ProjectsList({ userId }: { userId: string }) {
  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      _count: {
        select: { tables: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderKanban className="h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Create your first project to start organizing your leads.
          </p>
          <CreateProjectDialog>
            <Button className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </CreateProjectDialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
