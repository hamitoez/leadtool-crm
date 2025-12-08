import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const hashedPassword = await bcrypt.hash("test1234", 12);

  const user = await prisma.user.upsert({
    where: { email: "test@test.com" },
    update: {},
    create: {
      email: "test@test.com",
      name: "Test User",
      password: hashedPassword,
    },
  });

  console.log("Test user created:", user.email);

  // Create a sample project
  const project = await prisma.project.upsert({
    where: { id: "sample-project" },
    update: {},
    create: {
      id: "sample-project",
      userId: user.id,
      name: "Sample Project",
      description: "A sample project for testing",
    },
  });

  console.log("Sample project created:", project.name);

  // Create a sample table
  const table = await prisma.table.upsert({
    where: { id: "sample-table" },
    update: {},
    create: {
      id: "sample-table",
      projectId: project.id,
      name: "Leads",
      description: "Sample leads table",
    },
  });

  console.log("Sample table created:", table.name);

  // Create columns
  const columns = [
    { name: "Company", type: "TEXT" as const, position: 0 },
    { name: "Website", type: "URL" as const, position: 1 },
    { name: "Email", type: "EMAIL" as const, position: 2 },
    { name: "Phone", type: "PHONE" as const, position: 3 },
    { name: "Status", type: "STATUS" as const, position: 4 },
  ];

  for (const col of columns) {
    await prisma.column.upsert({
      where: { id: `col-${col.name.toLowerCase()}` },
      update: {},
      create: {
        id: `col-${col.name.toLowerCase()}`,
        tableId: table.id,
        name: col.name,
        type: col.type,
        position: col.position,
        config: col.type === "STATUS"
          ? { options: ["New", "Contacted", "Qualified", "Closed"] }
          : {},
      },
    });
  }

  console.log("Columns created");

  // Create sample rows with cells
  const sampleData = [
    { company: "Acme Corp", website: "https://acme.com", email: "info@acme.com", phone: "+49 123 456789", status: "New" },
    { company: "TechStart GmbH", website: "https://techstart.de", email: "hello@techstart.de", phone: "+49 987 654321", status: "Contacted" },
    { company: "Digital Solutions", website: "https://digital-solutions.io", email: "contact@digital-solutions.io", phone: "+49 555 123456", status: "Qualified" },
  ];

  for (let i = 0; i < sampleData.length; i++) {
    const data = sampleData[i];
    const row = await prisma.row.upsert({
      where: { id: `row-${i}` },
      update: {},
      create: {
        id: `row-${i}`,
        tableId: table.id,
        position: i,
      },
    });

    // Create cells
    const cellData = [
      { columnId: "col-company", value: data.company },
      { columnId: "col-website", value: data.website },
      { columnId: "col-email", value: data.email },
      { columnId: "col-phone", value: data.phone },
      { columnId: "col-status", value: data.status },
    ];

    for (const cell of cellData) {
      await prisma.cell.upsert({
        where: {
          rowId_columnId: {
            rowId: row.id,
            columnId: cell.columnId,
          },
        },
        update: { value: cell.value },
        create: {
          rowId: row.id,
          columnId: cell.columnId,
          value: cell.value,
        },
      });
    }
  }

  console.log("Sample data created");
  console.log("\n✅ Seed completed!");
  console.log("Login with: test@test.com / test1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
