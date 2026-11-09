import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;

  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const storedBuffer = Buffer.from(hash, "hex");
  const derivedKey = (await scrypt(password, salt, storedBuffer.length)) as Buffer;

  if (storedBuffer.length !== derivedKey.length) return false;
  return timingSafeEqual(storedBuffer, derivedKey);
}

export function generateTemporaryPassword(length = 12) {
  return randomBytes(length).toString("base64url").slice(0, length);
}
