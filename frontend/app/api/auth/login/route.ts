import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { assertAuthConfiguration, setSessionCookie } from "@/lib/auth";
import { getUsersCollection } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertAuthConfiguration();
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ email });
    if (!user || !(await compare(password, user.passwordHash))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }

    setSessionCookie({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
    });
    return NextResponse.json({ user: { email: user.email, name: user.name } });
  } catch (error) {
    console.error("Sign-in failed:", error);
    return NextResponse.json(
      { error: "Could not sign in. Check your MongoDB and authentication configuration." },
      { status: 503 }
    );
  }
}
