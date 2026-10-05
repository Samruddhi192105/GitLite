import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "gitlite_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  expiresAt: number;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

export function assertAuthConfiguration(): void {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured.");
  }
  getAuthSecret();
}

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function setSessionCookie(session: Omit<AuthSession, "expiresAt">): void {
  const payload = Buffer.from(
    JSON.stringify({ ...session, expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })
  ).toString("base64url");
  const token = `${payload}.${sign(payload)}`;

  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getAuthSession(): AuthSession | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;

  try {
    const payload = token.slice(0, separator);
    const suppliedSignature = Buffer.from(token.slice(separator + 1), "base64url");
    const expectedSignature = Buffer.from(sign(payload), "base64url");
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      return null;
    }

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AuthSession;
    if (
      typeof session.userId !== "string" ||
      typeof session.email !== "string" ||
      typeof session.name !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
