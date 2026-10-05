import { NextRequest, NextResponse } from "next/server";
import { getDirectoryTree, getFileDetails } from "@/lib/gitlite";
import { getAuthSession } from "@/lib/auth";
import { authorizeRepository } from "@/lib/repository-access";

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

    if (isFileQuery && subPath) {
      const fileData = getFileDetails(subPath, mode, commitId, context.root);
      if (!fileData) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      return NextResponse.json({ type: "file", file: fileData });
    }

    const items = await getDirectoryTree(subPath, mode, commitId, context.root);
    return NextResponse.json({ type: "directory", path: subPath, items });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load files" }, { status: 500 });
  }
}
