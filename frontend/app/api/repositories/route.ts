import { NextRequest, NextResponse } from "next/server";
import { MongoServerError } from "mongodb";
import { getAuthSession } from "@/lib/auth";
import { createOwnedRepository, listOwnedRepositories } from "@/lib/repositories";

export const runtime = "nodejs";

export async function GET() {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const repositories = await listOwnedRepositories(session.userId);
    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("Could not list repositories:", error);
    return NextResponse.json({ error: "Could not load repositories." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 60) {
      return NextResponse.json({ error: "Repository name must be between 1 and 60 characters." }, { status: 400 });
    }
    if (!/^[A-Za-z0-9._ -]+$/.test(name)) {
      return NextResponse.json({ error: "Use letters, numbers, spaces, dots, underscores, or hyphens in repository names." }, { status: 400 });
    }

    const repository = await createOwnedRepository(session.userId, name);
    return NextResponse.json({ repository }, { status: 201 });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json({ error: "A repository with that name already exists." }, { status: 409 });
    }
    console.error("Could not create repository:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create repository." },
      { status: 503 }
    );
  }
}
