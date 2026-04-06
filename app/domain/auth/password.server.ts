import * as crypto from "node:crypto";

const HASH_ALGO = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function encode(input: Uint8Array) {
  return Buffer.from(input).toString("hex");
}

function decode(input: string) {
  return Uint8Array.from(Buffer.from(input, "hex"));
}

export async function hashPassword(password: string) {
  const normalized = String(password || "");
  if (!normalized.trim()) {
    throw new Error("Password is required.");
  }

  const salt = encode(Uint8Array.from(crypto.randomBytes(SALT_LENGTH)));
  const derived = await scrypt(normalized, salt, KEY_LENGTH);
  return [
    HASH_ALGO,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt,
    encode(derived),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash?: string | null) {
  if (!storedHash) return false;

  const [algorithm, nRaw, rRaw, pRaw, saltHex, hashHex] = storedHash.split("$");
  if (algorithm !== HASH_ALGO || !saltHex || !hashHex) return false;

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  const actualHash = decode(hashHex);
  const candidate = await scrypt(password, saltHex, actualHash.length, {
    N: n,
    r,
    p,
  });

  if (candidate.length !== actualHash.length) return false;

  return crypto.timingSafeEqual(candidate, actualHash);
}

export function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(10);
  let output = "";
  for (const byte of bytes) {
    output += alphabet[byte % alphabet.length];
  }
  return output;
}

function scrypt(
  password: string,
  salt: string,
  keyLength: number,
  options?: crypto.ScryptOptions
) : Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keyLength, options || {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    }, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(Uint8Array.from(derivedKey as Buffer));
    });
  });
}
