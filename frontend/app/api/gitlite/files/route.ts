import { NextRequest, NextResponse } from "next/server";
import { getDirectoryTree, getFileDetails } from "@/lib/gitlite";
import { getAuthSession } from "@/lib/auth";
import { authorizeRepository } from "@/lib/repository-access";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const repositoryId = searchParams.get("repoId") || "";
    const context = await authorizeRepository(session, repositoryId);
    if (!context) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    }
    const subPath = searchParams.get("path") || "";
    const modeParam = searchParams.get("mode") || "project";
    if (modeParam !== "project" && modeParam !== "snapshot") {
      return NextResponse.json({ error: "Invalid repository view mode." }, { status: 400 });
    }
    const mode = modeParam;
    const commitId = searchParams.get("commitId") || undefined;
    const isFileQuery = searchParams.get("isFile") === "true";
    const download = searchParams.get("download") === "true";

    if (isFileQuery && subPath) {
      const fileData = getFileDetails(subPath, mode, commitId, context.root);
      if (!fileData) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      if (download) {
        const basePath = mode === "snapshot" && commitId
          ? path.join(context.root, ".gitlite", "commits", commitId, "snapshot")
          : context.root;
        const bytes = await fs.readFile(path.resolve(basePath, subPath));
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileData.name)}`,
            "Cache-Control": "no-store",
          },
        });
      }
      return NextResponse.json({ type: "file", file: fileData });
    }

    const items = await getDirectoryTree(subPath, mode, commitId, context.root);
    return NextResponse.json({ type: "directory", path: subPath, items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load files" }, { status: 500 });
  }
}
