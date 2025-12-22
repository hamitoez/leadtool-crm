import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function createDemoForAllUsers() {
  const users = await prisma.user.findMany({
    where: {
      workflows: {
        none: {
          name: "Demo: Willkommens-Workflow"
        }
      }
    },
    select: { id: true, email: true }
  });

  console.log(`Found ${users.length} users without demo workflow`);

  for (const user of users) {
    console.log(`Creating demo for: ${user.email}`);
    const suffix = user.id.slice(-4);

    await prisma.workflow.create({
      data: {
        userId: user.id,
        name: "Demo: Willkommens-Workflow",
        description: "Ein einfacher Demo-Workflow, der zeigt wie Automatisierungen funktionieren. Klicke auf 'Ausführen' um ihn zu testen!",
        isActive: false,
        viewport: { x: 0, y: 0, zoom: 0.8 },
        nodes: {
          create: [
            { id: `trigger-${suffix}`, nodeType: "TRIGGER", subType: "MANUAL", label: "Manueller Start", positionX: 50, positionY: 150, config: {} },
            { id: `action1-${suffix}`, nodeType: "ACTION", subType: "NOTIFY_USER", label: "Willkommens-Nachricht", positionX: 400, positionY: 100, config: { notificationTitle: "Workflow gestartet!", notificationMessage: "Dein erster Workflow wurde erfolgreich ausgeführt." } },
            { id: `action2-${suffix}`, nodeType: "ACTION", subType: "CREATE_REMINDER", label: "Erinnerung setzen", positionX: 750, positionY: 100, config: { reminderTitle: "Workflow-Demo abgeschlossen", reminderMinutes: 5 } },
          ],
        },
        edges: {
          create: [
            { id: `edge1-${suffix}`, sourceNodeId: `trigger-${suffix}`, targetNodeId: `action1-${suffix}`, sourceHandle: null, targetHandle: null },
            { id: `edge2-${suffix}`, sourceNodeId: `action1-${suffix}`, targetNodeId: `action2-${suffix}`, sourceHandle: null, targetHandle: null },
          ],
        },
      },
    });
    console.log(`  ✓ Created`);
  }

  console.log("Done!");
  await prisma.$disconnect();
}

createDemoForAllUsers();
