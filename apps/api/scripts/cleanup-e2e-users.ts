// Deletes the users the browser (Playwright) tests created, and their jobs.
// Only rows whose email matches e2e-*@example.com are touched, and only in a
// database whose name ends in "_test".
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set (expected from .env.test).");
}
const databaseName = new URL(url).pathname.replace(/^\//, "");
if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to clean database "${databaseName}": the name must end in "_test".`,
  );
}

const where = { email: { startsWith: "e2e-", endsWith: "@example.com" } };

const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({ where, select: { id: true } });
  const userIds = users.map((user) => user.id);
  // Postings go with their job (cascade).
  await prisma.job.deleteMany({ where: { userId: { in: userIds } } });
  const removed = await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`Removed ${removed.count} e2e users from ${databaseName}.`);
} finally {
  await prisma.$disconnect();
}
