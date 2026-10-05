import { execFileSync } from "node:child_process";
import { readdir, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(frontendDirectory, "..");
const sourceRoot = path.join(projectRoot, "src");
const classDirectory = path.join(frontendDirectory, ".gitlite-classes");

async function findJavaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findJavaSources(entryPath);
      return entry.isFile() && entry.name.endsWith(".java") ? [entryPath] : [];
    })
  );
  return nested.flat();
}

const sources = await findJavaSources(sourceRoot);
if (sources.length === 0) {
  throw new Error(`No Java sources found in ${sourceRoot}`);
}

await rm(classDirectory, { recursive: true, force: true });
await mkdir(classDirectory, { recursive: true });
execFileSync("javac", ["-encoding", "UTF-8", "-d", classDirectory, ...sources], {
  cwd: projectRoot,
  stdio: "inherit",
});
console.log(`Compiled ${sources.length} Java sources to ${classDirectory}`);
