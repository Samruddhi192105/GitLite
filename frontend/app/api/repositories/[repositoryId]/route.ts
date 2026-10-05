import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getOwnedRepository } from "@/lib/repositories";

export async function GET(
  _request: NextRequest,
  { params }: { params: { repositoryId: string } }
) {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const repository = await getOwnedRepository(session.userId, params.repositoryId);
    if (!repository) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    }
    return NextResponse.json({
      repository: {
        id: repository._id.toString(),
        name: repository.name,
        slug: repository.slug,
        createdAt: repository.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Could not read repository:", error);
    return NextResponse.json({ error: "Could not load repository." }, { status: 503 });
  }
}
