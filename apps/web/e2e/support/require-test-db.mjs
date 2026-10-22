// Runs (with .env.test loaded) right before the e2e API server starts. If the
// database is not a "_test" one, it exits non-zero and the server never starts.
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set (expected from apps/api/.env.test).");
  process.exit(1);
}

const databaseName = new URL(url).pathname.replace(/^\//, "");
if (!databaseName.endsWith("_test")) {
  console.error(`Refusing to start the e2e API on database "${databaseName}": the name must end in "_test".`);
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set (expected from apps/api/.env.test).");
  process.exit(1);
}
