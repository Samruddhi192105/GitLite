import { NextResponse } from "next/server";
import { getAllCommits } from "@/lib/gitlite";
import { getAuthSession } from "@/lib/auth";
import { authorizeRepository } from "@/lib/repository-access";

export async function GET(request: Request) {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const repositoryId = new URL(request.url).searchParams.get("repoId") || "";
    const context = await authorizeRepository(session, repositoryId);
    if (!context) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    }
    const commits = await getAllCommits(context.root);
    return NextResponse.json(commits);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to get commits" }, { status: 500 });
  }
}
