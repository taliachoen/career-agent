import { execSync } from "node:child_process";

// Clears users left behind by an earlier, interrupted run. The cleanup script
// refuses to touch a database that does not end in "_test".
export default function globalSetup() {
  execSync("npm run e2e:cleanup -w @career-agent/api", { stdio: "inherit", cwd: "../.." });
}
