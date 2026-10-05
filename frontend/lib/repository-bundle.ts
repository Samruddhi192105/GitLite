import fs from "fs/promises";
import path from "path";

export const MAX_REPOSITORY_BUNDLE_BYTES = 20 * 1024 * 1024;
const MAX_BUNDLE_ENTRIES = 20_000;
const MAGIC = Buffer.from("GLB1");

export type RepositoryBundle = Map<string, Buffer>;

function validateBundlePath(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    !(normalized.startsWith("working/") || normalized.startsWith(".gitlite/")) ||
    normalized === ".gitlite/remote-url"
  ) {
    throw new Error("Repository bundle contains an invalid path.");
  }
  return normalized;
}

async function collectFiles(root: string, relativeDirectory: string, output: RepositoryBundle) {
  const directory = path.join(root, relativeDirectory);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`.replace(/\\/g, "/");
    const absolutePath = path.join(root, relativeDirectory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Repositories cannot contain symbolic links.");
    if (entry.isDirectory()) {
      await collectFiles(root, relativePath, output);
    } else if (entry.isFile()) {
      const key = validateBundlePath(relativePath);
      const contents = await fs.readFile(absolutePath);
      output.set(key, contents);
    }
  }
}

export async function readRepositoryBundle(root: string): Promise<Buffer> {
  const files: RepositoryBundle = new Map();
  await collectFiles(root, ".gitlite", files);
  await collectFiles(root, "working", files);
  if (files.size === 0 || files.size > MAX_BUNDLE_ENTRIES) {
    throw new Error("Repository bundle has an invalid number of files.");
  }

  const pieces: Buffer[] = [MAGIC, Buffer.alloc(4)];
  pieces[1].writeUInt32BE(files.size);
  let totalBytes = 8;
  for (const [relativePath, contents] of Array.from(files.entries())) {
    const pathBytes = Buffer.from(relativePath, "utf8");
    if (pathBytes.length > 4096) throw new Error("Repository path is too long.");
    const entryHeader = Buffer.alloc(2 + pathBytes.length + 8);
    entryHeader.writeUInt16BE(pathBytes.length, 0);
    pathBytes.copy(entryHeader, 2);
    entryHeader.writeBigUInt64BE(BigInt(contents.length), 2 + pathBytes.length);
    pieces.push(entryHeader, contents);
    totalBytes += entryHeader.length + contents.length;
    if (totalBytes > MAX_REPOSITORY_BUNDLE_BYTES) {
      throw new Error("Repository is too large to transfer (maximum 20 MB).");
    }
  }
  return Buffer.concat(pieces, totalBytes);
}

export function parseRepositoryBundle(bundle: Buffer): RepositoryBundle {
  if (bundle.length < 8 || !bundle.subarray(0, 4).equals(MAGIC)) {
    throw new Error("Invalid GitLite repository bundle.");
  }
  const count = bundle.readUInt32BE(4);
  if (count === 0 || count > MAX_BUNDLE_ENTRIES) {
    throw new Error("Repository bundle has an invalid number of files.");
  }

  const files: RepositoryBundle = new Map();
  let offset = 8;
  for (let index = 0; index < count; index++) {
    if (offset + 2 > bundle.length) throw new Error("Repository bundle is truncated.");
    const pathLength = bundle.readUInt16BE(offset);
    offset += 2;
    if (pathLength === 0 || pathLength > 4096 || offset + pathLength + 8 > bundle.length) {
      throw new Error("Repository bundle contains an invalid path.");
    }
    const relativePath = validateBundlePath(
      new TextDecoder("utf-8", { fatal: true }).decode(bundle.subarray(offset, offset + pathLength))
    );
    offset += pathLength;
    const contentLength = bundle.readBigUInt64BE(offset);
    offset += 8;
    if (contentLength > BigInt(MAX_REPOSITORY_BUNDLE_BYTES) || contentLength > BigInt(bundle.length - offset)) {
      throw new Error("Repository bundle contains an invalid file size.");
    }
    if (files.has(relativePath)) throw new Error("Repository bundle contains duplicate paths.");
    files.set(relativePath, Buffer.from(bundle.subarray(offset, offset + Number(contentLength))));
    offset += Number(contentLength);
  }
  if (offset !== bundle.length) throw new Error("Repository bundle contains trailing data.");
  if (!files.has(".gitlite/HEAD")) throw new Error("Repository bundle has no GitLite HEAD.");
  return files;
}

export async function installRepositoryBundle(root: string, files: RepositoryBundle): Promise<void> {
  const parent = path.dirname(root);
  await fs.mkdir(parent, { recursive: true });
  const temporaryRoot = await fs.mkdtemp(path.join(parent, ".gitlite-sync-"));
  const backupRoot = `${root}.backup-${Date.now()}`;
  let movedOriginal = false;
  try {
    for (const [relativePath, contents] of Array.from(files.entries())) {
      const safePath = validateBundlePath(relativePath);
      const destination = path.resolve(temporaryRoot, ...safePath.split("/"));
      if (!destination.startsWith(`${temporaryRoot}${path.sep}`)) {
        throw new Error("Repository bundle path escaped its temporary directory.");
      }
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, contents, { flag: "wx" });
    }
    await fs.mkdir(path.join(temporaryRoot, ".gitlite", "staging"), { recursive: true });
    await fs.mkdir(path.join(temporaryRoot, "working"), { recursive: true });
    try {
      await fs.rename(root, backupRoot);
      movedOriginal = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await fs.rename(temporaryRoot, root);
    if (movedOriginal) await fs.rm(backupRoot, { recursive: true, force: true });
  } catch (error) {
    if (movedOriginal) {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rename(backupRoot, root);
    }
    await fs.rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

export function getBundleHead(files: RepositoryBundle, branch: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(branch)) {
    throw new Error("Invalid branch name.");
  }
  const head = files.get(".gitlite/HEAD")?.toString("utf8").trim();
  if (head !== branch) throw new Error("The pushed repository must have the selected branch checked out.");
  const branchHead = files.get(`.gitlite/branches/${branch}.txt`)?.toString("utf8").trim() || "";
  if (branchHead && !/^[a-f0-9]{64}$/i.test(branchHead)) {
    throw new Error("Branch points to an invalid commit.");
  }
  return branchHead;
}

export function assertBundleWorkingTreeClean(files: RepositoryBundle): void {
  for (const relativePath of Array.from(files.keys())) {
    if (relativePath.startsWith(".gitlite/staging/")) {
      throw new Error("Commit or unstage changes before syncing.");
    }
  }
  const branch = files.get(".gitlite/HEAD")?.toString("utf8").trim() || "";
  const head = getBundleHead(files, branch);
  const snapshotPrefix = head ? `.gitlite/commits/${head}/snapshot/working/` : "";
  const snapshot = new Map<string, Buffer>();
  if (head) {
    for (const [filePath, contents] of Array.from(files.entries())) {
      if (filePath.startsWith(snapshotPrefix)) {
        snapshot.set(filePath.slice(snapshotPrefix.length), contents);
      }
    }
  }
  const working = new Map<string, Buffer>();
  for (const [filePath, contents] of Array.from(files.entries())) {
    if (filePath.startsWith("working/")) {
      working.set(filePath.slice("working/".length), contents);
    }
  }
  if (
    working.size !== snapshot.size ||
    Array.from(working.entries()).some(([filePath, contents]) => {
      const committed = snapshot.get(filePath);
      return !committed || !contents.equals(committed);
    })
  ) {
    throw new Error("Commit or remove untracked/modified files before syncing.");
  }
}

export function isFastForward(files: RepositoryBundle, ancestor: string, descendant: string): boolean {
  if (!ancestor) return true;
  let current = descendant;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    if (current === ancestor) return true;
    visited.add(current);
    const metadata = files.get(`.gitlite/commits/${current}/metadata.txt`)?.toString("utf8");
    if (!metadata) return false;
    current = metadata.match(/^Parent\s*:\s*(.*)$/m)?.[1]?.trim() || "";
  }
  return false;
}
