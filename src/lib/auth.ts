import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { env } from "@/config/env";
import { pool } from "@/db";
import crypto from "crypto";

export interface AuthUser {
  userId: number;
  email: string;
  role: string;
}

/**
 * Extract and verify JWT from Authorization header
 */
export async function authenticateRequest(
  req: NextRequest
): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader) {
    return null;
  }

  // Support both Bearer tokens and API keys
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      console.error("[Auth] JWT verification failed:", error);
      return null;
    }
  }

  // API Key authentication
  if (authHeader.startsWith("ApiKey ")) {
    const apiKey = authHeader.substring(7);
    const keyHash = hashApiKey(apiKey);
    
    try {
      const { rows } = await pool.query(
        `
        SELECT u.id, u.email, u.role 
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.key_hash = $1 
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
        `,
        [keyHash]
      );

      if (rows.length === 0) {
        return null;
      }

      // Update last_used_at asynchronously
      pool.query(
        "UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1",
        [keyHash]
      ).catch((err) => console.error("[Auth] Failed to update last_used_at:", err));

      return {
        userId: rows[0].id,
        email: rows[0].email,
        role: rows[0].role,
      };
    } catch (error) {
      console.error("[Auth] API key verification failed:", error);
      return null;
    }
  }

  return null;
}

/**
 * Generate JWT token
 */
export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { userId: user.userId, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * Hash API key for secure storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  return `ck_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * Middleware helper to require authentication
 */
export async function requireAuth(
  req: NextRequest
): Promise<{ user: AuthUser } | Response> {
  const user = await authenticateRequest(req);
  
  if (!user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return { user };
}

