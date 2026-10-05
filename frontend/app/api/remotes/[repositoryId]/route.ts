import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { getRepositoryStoragePath, getRepositoryById } from "@/lib/repositories";
import {
  getBundleHead,
  assertBundleWorkingTreeClean,
  installRepositoryBundle,
  isFastForward,
  MAX_REPOSITORY_BUNDLE_BYTES,
  parseRepositoryBundle,
  readRepositoryBundle,
} from "@/lib/repository-bundle";

export const runtime = "nodejs";

async function authorize(request: NextRequest, repositoryId: string) {
  const match = request.headers.get("authorization")?.match(/^Bearer (glp_[A-Za-z0-9_-]{32,})$/);
  if (!match) return null;
  const repository = await getRepositoryById(repositoryId);
  if (!repository?.remoteTokenHash) return null;
  const suppliedHash = createHash("sha256").update(match[1]).digest();
  const expectedHash = Buffer.from(repository.remoteTokenHash, "hex");
  if (suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
    return null;
  }
  return {
    repository,
    root: getRepositoryStoragePath(repository.ownerId, repository._id.toString()),
  };
}

function requestedBranch(request: NextRequest): string {
  const branch = request.nextUrl.searchParams.get("branch") || "main";
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(branch)) {
    throw new Error("Invalid branch name.");
  }
  return branch;
}

async function readCurrentBranchHead(root: string, branch: string): Promise<string> {
  try {
    return (await fs.readFile(`${root}/.gitlite/branches/${branch}.txt`, "utf8")).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

export async function GET(request: NextRequest, { params }: { params: { repositoryId: string } }) {
  try {
    const context = await authorize(request, params.repositoryId);
    if (!context) return NextResponse.json({ error: "Invalid or missing repository access token." }, { status: 401 });
    const branch = requestedBranch(request);
    const bundle = await readRepositoryBundle(context.root);
    const head = await readCurrentBranchHead(context.root, branch);
    return new NextResponse(new Uint8Array(bundle), {
      headers: {
        "Content-Type": "application/vnd.gitlite.bundle",
        "Content-Length": String(bundle.length),
        "Cache-Control": "no-store",
        "X-GitLite-Head": head || "empty",
      },
    });
  } catch (error) {
    console.error("Could not export GitLite repository:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not export repository." },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { repositoryId: string } }) {
  try {
    const context = await authorize(request, params.repositoryId);
    if (!context) return NextResponse.json({ error: "Invalid or missing repository access token." }, { status: 401 });
    const branch = requestedBranch(request);
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_REPOSITORY_BUNDLE_BYTES) {
      return NextResponse.json({ error: "Repository exceeds the 20 MB sync limit." }, { status: 413 });
    }
    const payload = Buffer.from(await request.arrayBuffer());
    if (payload.length > MAX_REPOSITORY_BUNDLE_BYTES) {
      return NextResponse.json({ error: "Repository exceeds the 20 MB sync limit." }, { status: 413 });
    }

    const files = parseRepositoryBundle(payload);
    const uploadedHead = getBundleHead(files, branch);
    const currentHead = await readCurrentBranchHead(context.root, branch);
    const expectedHeadHeader = request.headers.get("x-gitlite-expected-head") || "";
    const expectedHead = expectedHeadHeader === "empty" ? "" : expectedHeadHeader;
    if (expectedHead !== currentHead) {
      return NextResponse.json({ error: "Remote branch changed since your last sync. Pull and retry." }, { status: 409 });
    }
    const currentBundle = parseRepositoryBundle(await readRepositoryBundle(context.root));
    try {
      assertBundleWorkingTreeClean(currentBundle);
      assertBundleWorkingTreeClean(files);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Working tree is not clean." }, { status: 409 });
    }
    if (!isFastForward(files, currentHead, uploadedHead)) {
      return NextResponse.json({ error: "Push rejected: this is not a fast-forward update." }, { status: 409 });
    }

    await installRepositoryBundle(context.root, files);
    return NextResponse.json({ success: true, head: uploadedHead || "empty" });
  } catch (error) {
    console.error("Could not update GitLite remote:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update remote repository." },
      { status: 400 }
    );
  }
}
