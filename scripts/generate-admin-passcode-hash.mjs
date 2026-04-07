import { randomBytes, scryptSync } from "node:crypto";

const passcode = process.argv[2];

if (!passcode) {
  console.error("Usage: pnpm admin:hash <passcode>");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derivedKey = scryptSync(passcode, salt, 64).toString("hex");

console.log(`${salt}:${derivedKey}`);
