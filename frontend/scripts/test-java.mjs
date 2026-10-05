import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(frontendDirectory, "..");
const sourceRoot = path.join(projectRoot, "src");
const testSource = path.join(frontendDirectory, "tests", "java", "GitLiteIntegrationTest.java");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "gitlite-java-tests-"));
const classDirectory = path.join(tempRoot, "classes");

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

try {
  const sources = await findJavaSources(sourceRoot);
  execFileSync("javac", ["-encoding", "UTF-8", "-d", classDirectory, ...sources, testSource], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  execFileSync("java", ["-cp", classDirectory, "GitLiteIntegrationTest", classDirectory], {
    cwd: projectRoot,
    stdio: "inherit",
  });
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
