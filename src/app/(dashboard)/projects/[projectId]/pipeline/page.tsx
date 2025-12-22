import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PipelineBoard } from "@/components/pipeline";

interface PipelinePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function PipelinePage({ params }: PipelinePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { projectId } = await params;

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId: session.user.id,
    },
  });

  if (!project) {
    redirect("/dashboard");
  }

  return (
    <div className="h-[calc(100vh-64px)]">
      <PipelineBoard projectId={projectId} />
    </div>
  );
}
