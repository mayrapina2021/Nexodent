import { createHmac } from "crypto";

function getSecret() {
  return "dientes-fijos-secret-key-2024"; // Default secret
}

function createToken(userId) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

const token = createToken(1);
console.log("Token for User ID 1 (Default Secret):");
console.log(token);
