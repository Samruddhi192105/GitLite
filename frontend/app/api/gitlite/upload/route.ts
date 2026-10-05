import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getGitStatus, getWorkingDir, hasSymlinkInPath } from "@/lib/gitlite";
import { authorizeRepository } from "@/lib/repository-access";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_FILES, MAX_UPLOAD_SIZE_LABEL } from "@/lib/upload-limits";
import { RepositorySyncConflict } from "@/lib/repository-sync-error";
import { acquireRepositorySyncLocks } from "@/lib/repository-sync-lock";

export const runtime = "nodejs";

function validateRelativePath(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("An uploaded file is missing its relative path.");
  }
  const normalized = value.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:/.test(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("Uploaded paths must remain inside the repository.");
  }
  return segments.join(path.sep);
}

export async function POST(request: NextRequest) {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const createdFiles: string[] = [];
  let releaseLock: (() => Promise<void>) | undefined;
  try {
    const form = await request.formData();
    const repositoryId = form.get("repoId");
    const pathsField = form.get("paths");
    if (typeof repositoryId !== "string" || typeof pathsField !== "string") {
      return NextResponse.json({ error: "Repository ID and file paths are required." }, { status: 400 });
    }

    const context = await authorizeRepository(session, repositoryId);
    if (!context) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    }
    releaseLock = await acquireRepositorySyncLocks(session.userId, [repositoryId]);

    let requestedPaths: unknown;
    try {
      requestedPaths = JSON.parse(pathsField);
    } catch {
      return NextResponse.json({ error: "Uploaded file paths are invalid." }, { status: 400 });
    }
    const uploads = form.getAll("files");
    if (
      !Array.isArray(requestedPaths) ||
      uploads.length === 0 ||
      uploads.length !== requestedPaths.length ||
      uploads.length > MAX_UPLOAD_FILES ||
      uploads.some((file) => typeof file === "string")
    ) {
      return NextResponse.json({ error: `Choose between 1 and ${MAX_UPLOAD_FILES.toLocaleString()} files to upload.` }, { status: 400 });
    }

    let relativePaths: string[];
    try {
      relativePaths = requestedPaths.map(validateRelativePath);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Uploaded paths are invalid." },
        { status: 400 }
      );
    }
    if (new Set(relativePaths).size !== relativePaths.length) {
      return NextResponse.json({ error: "The upload contains duplicate file paths." }, { status: 400 });
    }

    const workingDirectory = getWorkingDir(context.root);
    if (fs.lstatSync(workingDirectory).isSymbolicLink()) {
      return NextResponse.json({ error: "The repository working directory is invalid." }, { status: 400 });
    }
    let totalBytes = 0;
    let destinations: string[];
    try {
      destinations = relativePaths.map((relativePath) => {
        const destination = path.resolve(workingDirectory, relativePath);
        if (!destination.startsWith(`${workingDirectory}${path.sep}`) ||
            hasSymlinkInPath(workingDirectory, destination)) {
          throw new Error("Uploaded paths must remain inside the repository.");
        }
        return destination;
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Uploaded paths are invalid." },
        { status: 400 }
      );
    }

    for (let index = 0; index < uploads.length; index++) {
      const file = uploads[index];
      if (typeof file === "string") continue;
      totalBytes += file.size;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: `Uploads are limited to ${MAX_UPLOAD_SIZE_LABEL} at a time.` }, { status: 413 });
      }
      if (fs.existsSync(destinations[index])) {
        return NextResponse.json({ error: `File already exists: ${relativePaths[index]}` }, { status: 409 });
      }
    }

    for (let index = 0; index < uploads.length; index++) {
      const file = uploads[index];
      if (typeof file === "string") continue;
      const destination = destinations[index];
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const descriptor = fs.openSync(destination, "wx");
      createdFiles.push(destination);
      try {
        fs.writeFileSync(descriptor, Buffer.from(await file.arrayBuffer()));
      } finally {
        fs.closeSync(descriptor);
      }
    }

    return NextResponse.json({ success: true, status: await getGitStatus(context.root) });
  } catch (error) {
    for (const file of createdFiles) {
      try {
        fs.unlinkSync(file);
      } catch (cleanupError) {
        console.error("Could not roll back a partial repository upload:", cleanupError);
      }
    }
    console.error("GitLite file upload failed:", error);
    const code = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not upload files." },
      { status: error instanceof RepositorySyncConflict ? 409 : code === "EEXIST" ? 409 : 500 }
    );
  } finally {
    if (releaseLock) await releaseLock();
  }
}
