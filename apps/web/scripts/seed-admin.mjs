// Creates the one admin account with a random email and password, or rotates its password.
//   node scripts/seed-admin.mjs            local D1
//   node scripts/seed-admin.mjs --remote   the deployed D1
// Sign-up is disabled in the app, so this is the only way to make the account. The credentials are
// printed once and written to .admin-credentials (git-ignored, mode 600).
import { execFileSync } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { hashPassword } from "better-auth/crypto"

const remote = process.argv.includes("--remote")
const target = remote ? ["--remote"] : []
const run = (args) =>
  execFileSync("pnpm", ["exec", "void", "db", "execute", ...target, ...args], { encoding: "utf8" })
const q = (value) => `'${String(value).replaceAll("'", "''")}'`

const existing = run(["SELECT id, email FROM user LIMIT 1"])
const match = existing.match(/\b([0-9a-f-]{36})\b.*?(\S+@\S+)/s)

const password = randomBytes(18).toString("base64url")
const hash = await hashPassword(password)
const now = Date.now()
let email
let sql
if (match) {
  const [, userId] = match
  email = match[2]
  sql = `UPDATE account SET password = ${q(hash)}, updated_at = ${now} WHERE user_id = ${q(userId)} AND provider_id = 'credential';
DELETE FROM session WHERE user_id = ${q(userId)};`
} else {
  const userId = randomUUID()
  email = `admin-${randomBytes(4).toString("hex")}@void-media.local`
  sql = `INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (${q(userId)}, 'Admin', ${q(email)}, 1, ${now}, ${now});
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (${q(randomUUID())}, ${q(userId)}, 'credential', ${q(userId)}, ${q(hash)}, ${now}, ${now});`
}

const dir = mkdtempSync(join(tmpdir(), "seed-admin-"))
const file = join(dir, "seed.sql")
writeFileSync(file, sql, { mode: 0o600 })
run(["--file", file])

const line = `${remote ? "remote" : "local"}\temail=${email}\tpassword=${password}\n`
writeFileSync(".admin-credentials", line, { flag: "a", mode: 0o600 })
chmodSync(".admin-credentials", 0o600)
console.log(
  `${match ? "Rotated the password of" : "Created"} the ${remote ? "remote" : "local"} admin.`
)
console.log(`  email:    ${email}`)
console.log(`  password: ${password}`)
console.log("Also appended to apps/web/.admin-credentials.")
