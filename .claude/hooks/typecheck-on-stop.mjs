// Stop: runs the typecheck. A failure blocks the stop (exit 2) and sends the errors to Claude.
// If Claude already retried once (stop_hook_active) and it still fails, it may stop with a warning,
// so a typecheck that cannot be fixed does not loop forever.
import { spawnSync } from "node:child_process";
import { projectDir, readInput } from "./lib.mjs";

const MAX_OUTPUT = 6000;

const input = await readInput();
const cwd = projectDir(input);

// Nothing changed in the code: nothing to check.
const status = spawnSync("git status --porcelain -- apps packages", {
  cwd,
  shell: true,
  encoding: "utf8",
});
if (status.status === 0 && !status.stdout.trim()) {
  process.exit(0);
}

const result = spawnSync("npm run typecheck", { cwd, shell: true, encoding: "utf8" });
if (result.status === 0) {
  process.exit(0);
}

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  .replace(/\u001b\[[0-9;]*m/g, "")
  .trim();
const shown = output.length > MAX_OUTPUT ? `...${output.slice(-MAX_OUTPUT)}` : output;

if (input.stop_hook_active) {
  process.stdout.write(
    JSON.stringify({
      systemMessage:
        "Typecheck still fails after a retry. Stopping anyway. Fix it before committing.",
    }),
  );
  process.exit(0);
}
process.stderr.write(`npm run typecheck failed. Fix these errors before finishing:\n${shown}\n`);
process.exit(2);
