// PostToolUse (Edit|Write): runs Prettier on the edited file, only for file types it supports.
// Never fails the tool call: a formatting problem is printed as a warning.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectDir, readInput, targetPath } from "./lib.mjs";

try {
  const input = await readInput();
  const file = targetPath(input);
  const root = projectDir(input);
  const inProject = file && !path.relative(root, file).startsWith("..");
  if (!inProject || !fs.existsSync(file)) {
    process.exit(0);
  }

  const require = createRequire(path.join(root, "package.json"));
  const loaded = await import(pathToFileURL(require.resolve("prettier")).href);
  const prettier = loaded.default ?? loaded;

  const info = await prettier.getFileInfo(file, {
    ignorePath: path.join(root, ".prettierignore"),
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) {
    process.exit(0);
  }

  const options = (await prettier.resolveConfig(file)) ?? {};
  const source = fs.readFileSync(file, "utf8");
  const formatted = await prettier.format(source, { ...options, filepath: file });
  if (formatted !== source) {
    fs.writeFileSync(file, formatted);
  }
} catch (error) {
  process.stderr.write(
    `Prettier hook warning: ${error instanceof Error ? error.message : error}\n`,
  );
}
process.exit(0);
