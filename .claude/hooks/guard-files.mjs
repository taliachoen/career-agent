// PreToolUse (Edit|Write): blocks edits to applied migrations and to real .env files.
// Exit code 2 blocks the tool call and sends stderr to Claude.
import fs from "node:fs";
import path from "node:path";
import { projectDir, readInput, targetPath } from "./lib.mjs";

function block(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

const input = await readInput();
const file = targetPath(input);
if (!file) {
  process.exit(0);
}

// .env, .env.test, .env.local ... but not *.example (.env.example, .env.test.example).
const name = path.basename(file).toLowerCase();
if (/^\.env(\..+)?$/.test(name) && !name.endsWith(".example")) {
  block(
    `Blocked: ${path.basename(file)} holds secrets and must not be edited by Claude (see CLAUDE.md). ` +
      "Tell the user which variable to change, or edit the matching .env.example file instead.",
  );
}

// Everything inside a migration folder that already exists is an applied migration.
const migrationsDir = path.join(projectDir(input), "apps", "api", "prisma", "migrations");
const relative = path.relative(migrationsDir, file);
if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
  const [first] = relative.split(path.sep);
  if (fs.existsSync(path.join(migrationsDir, first))) {
    block(
      `Blocked: ${first} is an existing migration. Applied migrations must never be edited (see CLAUDE.md). ` +
        "Create a new migration instead: npm run prisma:migrate:dev -w @career-agent/api -- --name <name>.",
    );
  }
}
process.exit(0);
