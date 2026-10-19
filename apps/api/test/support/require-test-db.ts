// Import this module FIRST in every e2e test file. It runs before the app (and
// therefore Prisma) is loaded and refuses to run against anything but a
// database whose name ends in "_test".
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. Run the e2e tests via `npm run test:e2e` (it loads .env.test).",
  );
}

const databaseName = new URL(url).pathname.replace(/^\//, "");
if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run e2e tests against database "${databaseName}": the name must end in "_test".`,
  );
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set (expected in .env.test).");
}

export {};
