import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { setRepositoryRemoteToken } from "@/lib/repositories";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { repositoryId: string } }
) {
  const session = getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const token = `glp_${randomBytes(32).toString("base64url")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenPrefix = token.slice(0, 12);
    const updated = await setRepositoryRemoteToken(session.userId, params.repositoryId, tokenHash, tokenPrefix);
    if (!updated) return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Could not issue repository CLI token:", error);
    return NextResponse.json({ error: "Could not create a CLI access token." }, { status: 503 });
  }
}
