export const dynamic = "force-dynamic";
export const revalidate = 0;
import { NextResponse } from "next/server";
import { getGitStatus } from "@/lib/gitlite";
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
    const status = await getGitStatus(context.root);
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to get status" }, { status: 500 });
  }
}
