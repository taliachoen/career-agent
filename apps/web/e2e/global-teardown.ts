import { execSync } from "node:child_process";

export default function globalTeardown() {
  execSync("npm run e2e:cleanup -w @career-agent/api", { stdio: "inherit", cwd: "../.." });
}
