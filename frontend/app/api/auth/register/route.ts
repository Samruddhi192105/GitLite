import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { MongoServerError } from "mongodb";
import { assertAuthConfiguration } from "@/lib/auth";
import { getUsersCollection } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertAuthConfiguration();
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Name must be between 2 and 80 characters." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters and no more than 72 bytes." },
        { status: 400 }
      );
    }

    const users = await getUsersCollection();
    const user = {
      name,
      email,
      passwordHash: await hash(password, 12),
      createdAt: new Date(),
    };

    try {
      await users.insertOne(user);
      return NextResponse.json({ message: "Account created successfully. Please sign in to continue." }, { status: 201 });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Account registration failed:", error);
    return NextResponse.json(
      { error: "Could not create your account. Check your MongoDB and authentication configuration." },
      { status: 503 }
    );
  }
}
