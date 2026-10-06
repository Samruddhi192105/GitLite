import fs from "fs/promises";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getGitStatus, runGitLiteCommand } from "@/lib/gitlite";
import {
  getOwnedRepository,
  getRepositoryStoragePath,
  updateOwnedRepositoryTimestamp,
} from "@/lib/repositories";
import { RepositorySyncConflict } from "@/lib/repository-sync-error";
import { acquireRepositorySyncLocks } from "@/lib/repository-sync-lock";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES } from "@/lib/upload-limits";

export const runtime = "nodejs";

const MAX_SYNC_FILES = 100_000;
const MAX_SYNC_BYTES = 2 * 1024 * 1024 * 1024;
const BUNDLE_MAGIC = Buffer.from("GLB1");

function errorResponse(error: unknown) {
  if (error instanceof RepositorySyncConflict) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  console.error("Browser repository sync failed:", error);
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Browser repository sync failed." },
    { status: 500 }
  );
}

function relativePath(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("A file path is required.");
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    segments.some((segment) => segment.includes(":"))
  ) {
    throw new Error("File paths must be relative and remain inside the selected repository.");
  }
  return segments.join("/");
}

function isLocalMetadataPath(value: string): boolean {
  return value.split("/").some((segment) => {
    const name = segment.toLowerCase();
    return name === ".git" || name === ".gitlite";
  });
}

function sessionPath(root: string, value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9-]{36}$/i.test(value)) {
    throw new Error("Invalid browser sync session.");
  }
  return path.join(path.dirname(root), `.gitlite-browser-sync-${value}`);
}

async function listRegularFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Repositories cannot contain symbolic links.");
      if (entry.isDirectory()) await walk(entryPath);
      else if (entry.isFile()) files.push(path.relative(root, entryPath).split(path.sep).join("/"));
    }
  }
  if (await fs.stat(root).catch((error: NodeJS.ErrnoException) =>
    error.code === "ENOENT" ? null : Promise.reject(error))) await walk(root);
  return files.sort();
}

async function currentHead(root: string, branch: string): Promise<string> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(branch)) throw new Error("Invalid branch name.");
  const value = await fs.readFile(path.join(root, ".gitlite", "branches", `${branch}.txt`), "utf8")
    .catch((error: NodeJS.ErrnoException) => error.code === "ENOENT" ? "" : Promise.reject(error));
  const head = value.trim();
  if (head && !/^[a-f0-9]{64}$/i.test(head)) throw new Error("Repository branch points to an invalid commit.");
  return head;
}

async function assertRepositoryClean(root: string): Promise<{ branch: string; head: string }> {
  const status = await getGitStatus(root);
  if (!status.initialized) throw new Error("Repository is not initialized.");
  if (status.stagedFiles.length > 0) {
    throw new RepositorySyncConflict("Commit or discard staged changes before syncing.");
  }
  const branch = (await fs.readFile(path.join(root, ".gitlite", "HEAD"), "utf8")).trim();
  const head = await currentHead(root, branch);
  const working = await listRegularFiles(path.join(root, "working"));
  const snapshotRoot = head
    ? path.join(root, ".gitlite", "commits", head, "snapshot", "working")
    : "";
  const snapshot = head ? await listRegularFiles(snapshotRoot) : [];
  if (working.length !== snapshot.length) {
    throw new RepositorySyncConflict("Commit or discard uncommitted working-tree changes before syncing.");
  }
  for (let index = 0; index < working.length; index++) {
    if (working[index] !== snapshot[index]) {
      throw new RepositorySyncConflict("Commit or discard uncommitted working-tree changes before syncing.");
    }
    const [current, committed] = await Promise.all([
      fs.readFile(path.join(root, "working", working[index])),
      fs.readFile(path.join(snapshotRoot, snapshot[index])),
    ]);
    if (!current.equals(committed)) {
      throw new RepositorySyncConflict("Commit or discard uncommitted working-tree changes before syncing.");
    }
  }
  return { branch, head };
}

function encodeBundle(entries: Array<{ path: string; content: Buffer }>): Buffer {
  const pieces: Buffer[] = [BUNDLE_MAGIC, Buffer.alloc(4)];
  pieces[1].writeUInt32BE(entries.length);
  let totalBytes = 8;
  for (const entry of entries) {
    const name = Buffer.from(relativePath(entry.path), "utf8");
    if (name.length > 4096) throw new Error("Repository path is too long.");
    const header = Buffer.alloc(2 + name.length + 8);
    header.writeUInt16BE(name.length, 0);
    name.copy(header, 2);
    header.writeBigUInt64BE(BigInt(entry.content.length), 2 + name.length);
    pieces.push(header, entry.content);
    totalBytes += header.length + entry.content.length;
    if (totalBytes > MAX_UPLOAD_BYTES) throw new Error("Download batch exceeds 100 MB.");
  }
  return Buffer.concat(pieces, totalBytes);
}

function uploadDirectory(root: string, id: string): string {
  return path.join(path.dirname(root), `.gitlite-browser-sync-${id}`);
}

async function acquirePushSessionLock(directory: string): Promise<() => Promise<void>> {
  const lockPath = path.join(directory, "sync.lock");
  let handle;
  try {
    handle = await fs.open(lockPath, "wx");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new RepositorySyncConflict("A browser sync operation is already using this upload session.");
    }
    throw error;
  }
  return async () => {
    try {
      await handle.close();
    } finally {
      await fs.rm(lockPath, { force: true });
    }
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { repositoryId: string } }
) {
  const session = getAuthSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const repository = await getOwnedRepository(session.userId, params.repositoryId);
  if (!repository) return NextResponse.json({ error: "Repository not found." }, { status: 404 });
  const root = getRepositoryStoragePath(session.userId, repository._id.toString());
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = form.get("action");
      const id = form.get("sessionId");
      const pathsField = form.get("paths");
      if (action !== "uploadBatch" || typeof pathsField !== "string") {
        return NextResponse.json({ error: "Invalid upload batch." }, { status: 400 });
      }
      const directory = sessionPath(root, id);
      const releaseSession = await acquirePushSessionLock(directory);
      try {
      const metadata = JSON.parse(await fs.readFile(path.join(directory, "metadata.json"), "utf8")) as {
        paths: string[];
        bytes: number;
        ownerId: string;
        repositoryId: string;
      };
      if (metadata.ownerId !== session.userId || metadata.repositoryId !== repository._id.toString()) {
        return NextResponse.json({ error: "Upload session does not belong to this repository." }, { status: 403 });
      }
      const requested = JSON.parse(pathsField) as unknown;
      const uploads = form.getAll("files");
      if (!Array.isArray(requested) || requested.length === 0 ||
          requested.length !== uploads.length || requested.length > MAX_UPLOAD_FILES ||
          uploads.some((file) => typeof file === "string")) {
        return NextResponse.json({ error: "Upload batch must contain up to 10,000 files." }, { status: 400 });
      }
      const names = requested.map(relativePath);
      if (names.some(isLocalMetadataPath)) {
        return NextResponse.json({ error: "Local Git metadata is excluded from browser folder sync." }, { status: 400 });
      }
      if (new Set(names).size !== names.length ||
          names.some((name) => metadata.paths.includes(name))) {
        return NextResponse.json({ error: "Upload contains duplicate file paths." }, { status: 409 });
      }
      const files = uploads as File[];
      const batchBytes = files.reduce((total, file) => total + file.size, 0);
      if (batchBytes > MAX_UPLOAD_BYTES || metadata.bytes + batchBytes > MAX_SYNC_BYTES ||
          metadata.paths.length + names.length > MAX_SYNC_FILES) {
        return NextResponse.json({ error: "Sync data exceeds 100,000 files or 2 GB total." }, { status: 413 });
      }
      const uploadRoot = path.join(directory, "upload", "working");
      const createdFiles: string[] = [];
      try {
        for (let index = 0; index < files.length; index++) {
          const destination = path.resolve(uploadRoot, names[index]);
          if (!destination.startsWith(`${uploadRoot}${path.sep}`)) {
            throw new Error("Invalid upload path.");
          }
          await fs.mkdir(path.dirname(destination), { recursive: true });
          await fs.writeFile(destination, Buffer.from(await files[index].arrayBuffer()), { flag: "wx" });
          createdFiles.push(destination);
        }
      } catch (error) {
        await Promise.all(createdFiles.map((file) => fs.rm(file, { force: true })));
        throw error;
      }
      metadata.paths.push(...names);
      metadata.bytes += batchBytes;
      await fs.writeFile(path.join(directory, "metadata.json"), JSON.stringify(metadata));
      return NextResponse.json({ uploadedFiles: metadata.paths.length, uploadedBytes: metadata.bytes });
      } finally {
        await releaseSession();
      }
    }

    const body = await request.json();
    if (body?.action === "manifest") {
      const state = await assertRepositoryClean(root);
      const snapshotRoot = state.head
        ? path.join(root, ".gitlite", "commits", state.head, "snapshot", "working")
        : "";
      const paths = snapshotRoot ? await listRegularFiles(snapshotRoot) : [];
      const files = [];
      for (const file of paths.filter((item) => !isLocalMetadataPath(item))) {
        const content = await fs.readFile(path.join(snapshotRoot, file));
        files.push({
          path: file,
          size: content.length,
          hash: createHash("sha256").update(content).digest("hex"),
        });
      }
      return NextResponse.json({ branch: state.branch, head: state.head, files });
    }

    if (body?.action === "downloadFiles") {
      if (!Array.isArray(body.paths) || body.paths.length > MAX_UPLOAD_FILES) {
        return NextResponse.json({ error: "Download batch must contain up to 10,000 files." }, { status: 400 });
      }
      if (new Set(body.paths).size !== body.paths.length) {
        return NextResponse.json({ error: "Download batch contains duplicate file paths." }, { status: 400 });
      }
      const state = await assertRepositoryClean(root);
      if (body.head !== state.head || body.branch !== state.branch) {
        return NextResponse.json({ error: "Repository changed while downloading. Retry the operation." }, { status: 409 });
      }
      const snapshotRoot = state.head
        ? path.join(root, ".gitlite", "commits", state.head, "snapshot", "working")
        : "";
      const entries = [];
      let bytes = 0;
      for (const value of body.paths) {
        const name = relativePath(value);
        if (isLocalMetadataPath(name)) {
          return NextResponse.json({ error: "Local Git metadata is not part of browser folder sync." }, { status: 400 });
        }
        const filePath = path.resolve(snapshotRoot, name);
        if (!snapshotRoot || !filePath.startsWith(`${snapshotRoot}${path.sep}`)) {
          return NextResponse.json({ error: "Invalid repository file path." }, { status: 400 });
        }
        const content = await fs.readFile(filePath);
        bytes += content.length;
        if (bytes > MAX_UPLOAD_BYTES) {
          return NextResponse.json({ error: "Download batch exceeds 100 MB." }, { status: 413 });
        }
        entries.push({ path: name, content });
      }
      return new NextResponse(new Uint8Array(encodeBundle(entries)), {
        headers: { "Content-Type": "application/vnd.gitlite.browser-bundle", "Cache-Control": "no-store" },
      });
    }

    if (body?.action === "beginPush") {
      const state = await assertRepositoryClean(root);
      if (body.baseHead !== state.head || body.branch !== state.branch) {
        return NextResponse.json({ error: "The hosted repository has changed. Pull before pushing." }, { status: 409 });
      }
      const id = randomUUID();
      const directory = uploadDirectory(root, id);
      await fs.mkdir(path.join(directory, "upload", "working"), { recursive: true });
      await fs.writeFile(path.join(directory, "metadata.json"), JSON.stringify({
        branch: state.branch,
        baseHead: state.head,
        paths: [],
        bytes: 0,
        ownerId: session.userId,
        repositoryId: repository._id.toString(),
      }), { flag: "wx" });
      return NextResponse.json({ sessionId: id });
    }

    if (body?.action === "cancelPush") {
      const directory = sessionPath(root, body.sessionId);
      const metadata = JSON.parse(await fs.readFile(path.join(directory, "metadata.json"), "utf8")) as {
        ownerId: string;
        repositoryId: string;
      };
      if (metadata.ownerId !== session.userId || metadata.repositoryId !== repository._id.toString()) {
        return NextResponse.json({ error: "Upload session does not belong to this repository." }, { status: 403 });
      }
      await fs.rm(directory, { recursive: true, force: true });
      return NextResponse.json({ success: true });
    }

    if (body?.action === "finishPush") {
      const directory = sessionPath(root, body.sessionId);
      const releaseSession = await acquirePushSessionLock(directory);
      try {
        const release = await acquireRepositorySyncLocks(session.userId, [repository._id.toString()]);
        try {
        const metadata = JSON.parse(await fs.readFile(path.join(directory, "metadata.json"), "utf8")) as {
          branch: string;
          baseHead: string;
          paths: string[];
          bytes: number;
          ownerId: string;
          repositoryId: string;
        };
        if (metadata.ownerId !== session.userId || metadata.repositoryId !== repository._id.toString()) {
          return NextResponse.json({ error: "Upload session does not belong to this repository." }, { status: 403 });
        }
        const uploadWorking = path.join(directory, "upload", "working");
        const persistedPaths = await listRegularFiles(uploadWorking);
        const declaredPaths = new Set(metadata.paths);
        const persistedBytes = (await Promise.all(persistedPaths.map(async (file) =>
          (await fs.stat(path.join(uploadWorking, file))).size
        ))).reduce((total, size) => total + size, 0);
        if (persistedPaths.length !== declaredPaths.size ||
            persistedPaths.some((file) => !declaredPaths.has(file)) ||
            persistedBytes !== metadata.bytes ||
            persistedPaths.length > MAX_SYNC_FILES ||
            persistedBytes > MAX_SYNC_BYTES) {
          throw new Error("Uploaded file data does not match the browser sync manifest.");
        }
        const state = await assertRepositoryClean(root);
        if (metadata.branch !== state.branch || metadata.baseHead !== state.head) {
          return NextResponse.json({ error: "The hosted repository changed during upload. Pull and retry." }, { status: 409 });
        }

        const oldWorking = path.join(directory, "old-working");
        const stagingDirectory = path.join(root, ".gitlite", "staging");
        const oldStaging = path.join(directory, "old-staging");
        const previousSnapshot = state.head
          ? path.join(root, ".gitlite", "commits", state.head, "snapshot", "working")
          : "";
        const previousPaths = previousSnapshot ? await listRegularFiles(previousSnapshot) : [];
        const nextPaths = new Set(metadata.paths);
        await fs.rename(path.join(root, "working"), oldWorking);
        let workingMoved = true;
        let stagingMoved = false;
        try {
          await fs.rename(stagingDirectory, oldStaging);
          stagingMoved = true;
          await fs.rename(uploadWorking, path.join(root, "working"));
          await fs.mkdir(stagingDirectory, { recursive: true });
          for (const oldPath of previousPaths.filter(isLocalMetadataPath)) {
            const source = path.join(oldWorking, oldPath);
            const destination = path.join(root, "working", oldPath);
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await fs.copyFile(source, destination);
          }
          const deletionDirectory = path.join(root, ".gitlite", "staging", "deleted");
          for (const oldPath of previousPaths.filter((file) => !isLocalMetadataPath(file))) {
            if (nextPaths.has(oldPath)) continue;
            const marker = path.join(deletionDirectory, oldPath);
            await fs.mkdir(path.dirname(marker), { recursive: true });
            await fs.writeFile(marker, "", { flag: "wx" });
          }

          const stageResult = await runGitLiteCommand(["addall"], root);
          if (!stageResult.success) throw new Error(stageResult.stderr || "Could not stage browser changes.");
        } catch (error) {
          try {
            if (workingMoved) {
              await fs.rm(path.join(root, "working"), { recursive: true, force: true });
              await fs.rename(oldWorking, path.join(root, "working"));
              workingMoved = false;
            }
            if (stagingMoved) {
              await fs.rm(stagingDirectory, { recursive: true, force: true });
              await fs.rename(oldStaging, stagingDirectory);
              stagingMoved = false;
            }
          } catch (rollbackError) {
            throw new AggregateError([error, rollbackError], "Browser push failed and repository rollback was incomplete.");
          }
          throw error;
        }
        const head = await currentHead(root, state.branch);
        await updateOwnedRepositoryTimestamp(session.userId, repository._id.toString()).catch((timestampError) => {
          console.error("Browser push staged changes, but the repository timestamp could not be updated:", timestampError);
        });
        try {
          await fs.rm(oldWorking, { recursive: true, force: true });
          await fs.rm(oldStaging, { recursive: true, force: true });
          await fs.rm(directory, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error("Browser push staged changes, but temporary sync files could not be cleaned up:", cleanupError);
        }
        return NextResponse.json({
          success: true,
          head,
          message: "Browser folder pushed and staged. Review the staged files and commit them in GitLite.",
        });
        } finally {
          await release();
        }
      } finally {
        await releaseSession();
      }
    }

    return NextResponse.json({ error: "Unknown browser sync action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
