/**
 * Keeps the agent skills written elsewhere as committed copies under .agents/skills.
 *
 * A symlink dangles on a fresh clone, renders as a path on GitHub and is skipped by agents that
 * don't follow links, so each skill is a real copy that nobody edits here. Two kinds of source:
 * - package: a skill inside an installed dependency. The copy must match it byte for byte, so a
 *   dependency upgrade that changes the skill shows up here.
 * - repo: a skill in a git repository. The lock records the commit and a content hash, so the
 *   check stays offline and catches local edits; --update pulls the latest commit.
 *
 * Usage:
 *   node scripts/agent-skills.js            check; exit 1 when a copy drifted from its source
 *   node scripts/agent-skills.js --update   rewrite every copy from its source
 *
 * Package sources need `pnpm install` first; --update needs the network for repo sources.
 */

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const LOCK = ".agents/skills/skills-lock.json"

/** Each committed copy and the source it mirrors. */
const SKILLS = [
  { target: ".agents/skills/void", package: "apps/web/node_modules/void/skills/void" },
  {
    target: ".agents/skills/sweet-mode",
    repo: "https://github.com/SweetRetry/retry-kit",
    path: "skills/web-design/sweet-mode",
  },
]

function listFiles(directory) {
  if (!existsSync(directory)) {
    return []
  }

  return readdirSync(directory, { recursive: true })
    .filter((file) => statSync(join(directory, file)).isFile())
    .sort()
}

/**
 * One hash over every file path and its content, so renames and deletions count too.
 * Line endings are normalized so a CRLF checkout doesn't read as an edit.
 */
function hashDirectory(directory) {
  const hash = createHash("sha256")

  for (const file of listFiles(directory)) {
    const content = readFileSync(join(directory, file), "utf8").replace(/\r\n/g, "\n")
    hash.update(`${file}\0${content}\0`)
  }

  return hash.digest("hex")
}

/** Files that differ between the copy and its source, as A/M/D relative to the copy. */
function diffDirectories(target, source) {
  const targetFiles = new Set(listFiles(target))
  const changes = []

  for (const file of listFiles(source)) {
    if (!targetFiles.delete(file)) {
      changes.push(`A ${file}`)
    } else if (!readFileSync(join(source, file)).equals(readFileSync(join(target, file)))) {
      changes.push(`M ${file}`)
    }
  }

  for (const file of targetFiles) {
    changes.push(`D ${file}`)
  }

  return changes
}

function readLock() {
  const path = join(repositoryRoot, LOCK)

  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {}
}

function replaceWith(target, source) {
  rmSync(target, { recursive: true, force: true })
  cpSync(source, target, { recursive: true })
}

/** The reasons a copy drifted; an empty list means it is current. */
function checkSkill(skill, lock) {
  const target = join(repositoryRoot, skill.target)

  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    return ["L a symlink, not a copy"]
  }

  if (skill.package) {
    const source = join(repositoryRoot, skill.package)

    if (!existsSync(source)) {
      console.error(`✗ ${skill.package} is missing. Run pnpm install first.`)
      process.exit(1)
    }

    return diffDirectories(target, source)
  }

  const locked = lock[skill.target]

  if (!locked) {
    return [`missing from ${LOCK}`]
  }

  return hashDirectory(target) === locked.hash ? [] : [`edited since ${locked.commit.slice(0, 7)}`]
}

/** Rewrites one copy and returns where it came from. */
function updateSkill(skill, lock) {
  const target = join(repositoryRoot, skill.target)

  if (skill.package) {
    replaceWith(target, join(repositoryRoot, skill.package))
    return skill.package
  }

  const clone = mkdtempSync(join(tmpdir(), "agent-skill-"))

  try {
    execFileSync("git", ["clone", "--quiet", "--depth", "1", skill.repo, clone])
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: clone,
      encoding: "utf8",
    }).trim()
    replaceWith(target, join(clone, skill.path))
    lock[skill.target] = { repo: skill.repo, path: skill.path, commit, hash: hashDirectory(target) }

    return `${skill.repo}/tree/${commit.slice(0, 7)}/${skill.path}`
  } finally {
    rmSync(clone, { recursive: true, force: true })
  }
}

function main() {
  const lock = readLock()

  if (process.argv.includes("--update")) {
    for (const skill of SKILLS) {
      console.log(`✓ Rewrote ${skill.target} from ${updateSkill(skill, lock)}`)
    }

    writeFileSync(join(repositoryRoot, LOCK), `${JSON.stringify(lock, null, 2)}\n`, "utf8")
    return
  }

  let drifted = false

  for (const skill of SKILLS) {
    const changes = checkSkill(skill, lock)

    if (changes.length === 0) {
      console.log(`✓ ${skill.target} matches its source`)
      continue
    }

    drifted = true
    console.log(`✗ ${skill.target} drifted from its source\n`)

    for (const change of changes) {
      console.log(`  ${change}`)
    }

    console.log()
  }

  if (drifted) {
    console.log("These copies are not edited here. Change the skill at its source, then run")
    console.log("pnpm skills:update and commit the copy. Undo a local edit with git checkout.")
    process.exitCode = 1
  }
}

main()
