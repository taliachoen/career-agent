// Shared helpers for the Claude Code hooks. Pure Node, so they run on Windows without bash or jq.
import path from "node:path";

export async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks)
    .toString("utf8")
    .replace(/^\uFEFF/, "");
  return raw.trim() ? JSON.parse(raw) : {};
}

export function projectDir(input) {
  return path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

// Absolute path of the file the tool touches, or null when the input has none.
export function targetPath(input) {
  const file = input.tool_input?.file_path;
  return typeof file === "string" && file ? path.resolve(projectDir(input), file) : null;
}
