// ─────────────────────────────────────────────────────────────────────────────
//  Authentication Service
//  Handles user registration, login, and token generation.
//  All password operations use bcrypt with a cost factor of 12.
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../../config/database";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import { JwtPayload } from "@codity/shared";

const BCRYPT_ROUNDS = 12;

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: {
    userId: string;
    name: string;
    email: string;
  };
}

// ── Row types ─────────────────────────────────────────────────────────────────

interface UserRow {
  user_id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

// ── Service Functions ─────────────────────────────────────────────────────────

/**
 * Registers a new user. Throws 409 if the email is already taken.
 */
export async function register(dto: RegisterDto): Promise<AuthResult> {
  // Check for duplicate email
  const existing = await query<UserRow>(
    "SELECT user_id FROM users WHERE email = $1",
    [dto.email.toLowerCase()]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    throw AppError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

  const result = await query<UserRow>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING user_id, name, email`,
    [dto.name.trim(), dto.email.toLowerCase(), passwordHash]
  );

  const user = result.rows[0];
  const token = generateToken({ userId: user.user_id, email: user.email });

  return {
    token,
    user: {
      userId: user.user_id,
      name: user.name,
      email: user.email,
    },
  };
}

/**
 * Authenticates a user by email and password. Throws 401 on invalid credentials.
 * Uses a constant-time comparison to prevent timing attacks.
 */
export async function login(dto: LoginDto): Promise<AuthResult> {
  const result = await query<UserRow>(
    "SELECT user_id, name, email, password_hash FROM users WHERE email = $1",
    [dto.email.toLowerCase()]
  );

  const user = result.rows[0];

  // Always run bcrypt.compare even when user doesn't exist to prevent timing attacks
  const passwordMatch = user
    ? await bcrypt.compare(dto.password, user.password_hash)
    : await bcrypt.compare(dto.password, "$2b$12$invalidhashfortimingprotection");

  if (!user || !passwordMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const token = generateToken({ userId: user.user_id, email: user.email });

  return {
    token,
    user: {
      userId: user.user_id,
      name: user.name,
      email: user.email,
    },
  };
}

/**
 * Retrieves the authenticated user's profile.
 */
export async function getProfile(userId: string) {
  const result = await query<UserRow>(
    "SELECT user_id, name, email, created_at FROM users WHERE user_id = $1",
    [userId]
  );

  if (!result.rows[0]) {
    throw AppError.notFound("User");
  }

  const user = result.rows[0];
  return {
    userId: user.user_id,
    name: user.name,
    email: user.email,
    createdAt: user.created_at,
  };
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}
