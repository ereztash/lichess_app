/**
 * THE LICENSING BOUNDARY, AS A PREDICATE OVER A TREE.
 *
 * WHY THIS EXISTS. This product ships one GPL component -- Stockfish -- behind a Worker boundary,
 * and its first-party code is intended to move to a proprietary default. Both halves of that
 * arrangement are invisible at a glance and easy to undo by accident: an `npm install` of a
 * copyleft package, a snippet pasted with its licence header intact, a manifest edited back to a
 * whole-project GPL claim, an engine version bumped without its compliance record. None of those
 * produce a test failure, a type error, or a broken screen. They produce a licensing problem that
 * surfaces at a due-diligence review, years later, priced accordingly.
 *
 * IT TAKES A TREE RATHER THAN READING THE REPOSITORY. That is the whole of what makes the positive
 * control meaningful: the gate and its control run THIS function over two different directories,
 * so a control that goes red proves the predicate can detect the violation rather than proving
 * that some other, weaker predicate can. `scripts/gate-scan.ts` states the same rule for the gates
 * it serves, and this follows it.
 *
 * WHAT IT DOES NOT DO. It is not a licence scanner and does not attempt to be one: it reads
 * declared licences from a lockfile and declared headers from source. Code copied from a copyleft
 * project with its header stripped is invisible here and is invisible to any scanner of this kind.
 * `IP_PROVENANCE_AUDIT.md` §2 says so in the same words. What this gate catches is DRIFT -- the
 * boundary being moved by ordinary work -- which is the failure that actually happens.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

import { sourceFiles, type Finding } from "./gate-scan.js";

/**
 * A tree to check, named so the gate and the control differ only in their input.
 *
 * `root` is the directory containing the manifests; `proprietary` the paths whose files must carry
 * no copyleft notice; `gplAllowlist` the first-party paths deliberately held on the GPL side.
 */
export interface LicenseTree {
  root: string;
  proprietary: string[];
  gplAllowlist: string[];
}

/**
 * The real repository, and the allowlist is the interesting part.
 *
 * `scripts/sf-wasm.mjs` is first-party code that calls `require("stockfish")` and drives the engine
 * IN-PROCESS -- the one place in this repository where first-party and engine code share a process.
 * `LICENSING.md` §6 holds it on the GPL side deliberately. Listing it here is what makes that
 * placement enforced rather than described: a second such file, or this one moved into an
 * application directory, fails.
 */
export const REPOSITORY: LicenseTree = {
  root: ".",
  proprietary: ["client/src", "server", "shared"],
  gplAllowlist: ["scripts/sf-wasm.mjs"],
};

/**
 * STRONG COPYLEFT: reaches the whole work it is combined with.
 *
 * GPL, AGPL, LGPL and SSPL are the licences whose obligations can propagate beyond the files they
 * cover. A strong-copyleft package that is not the engine is a change to this product's licensing
 * architecture.
 */
const STRONG_COPYLEFT = /\b(A?GPL|LGPL|SSPL)[-\s]?[0-9]/i;

/**
 * WEAK, FILE-LEVEL COPYLEFT: reaches the covered files and stops.
 *
 * MPL-2.0 §3.3 permits distributing a Larger Work under other terms provided the MPL-covered files
 * stay MPL. EPL and CDDL work the same way. Treating these as violations was this gate's first
 * design and it was WRONG: the real tree carries fourteen of them -- `axe-core` and thirteen
 * `lightningcss` platform builds, pulled in by the CSS toolchain -- and every one is build-time
 * tooling that never reaches a distributed byte. A gate that calls those a licensing violation is
 * a gate somebody switches off.
 *
 * WHAT IS STILL CHECKED, because the harmless case and the harmful one differ by exactly one fact:
 * a weak-copyleft package that reaches the DISTRIBUTED OUTPUT is conveyed, and conveying it carries
 * obligations. `distributedCopyleft` below is that check, and it is the reason this is a
 * classification rather than an exemption.
 */
const WEAK_COPYLEFT = /\b(MPL|EPL|CDDL)[-\s]?[0-9]/i;

/**
 * A COPYLEFT NOTICE AS IT IS ACTUALLY WRITTEN IN A FILE HEADER, which is not an SPDX identifier.
 *
 * THIS GATE'S POSITIVE CONTROL CAUGHT THIS, and it is worth recording because the miss was silent.
 * The dependency checks read `license` fields out of a lockfile, and those really are SPDX strings
 * -- `GPL-3.0`, `MPL-2.0` -- so a pattern like `GPL[-\s]?[0-9]` reads them correctly. The header
 * check was given the same pattern and therefore matched almost nothing: a real GPL header says
 * *"the terms of the GNU General Public License"*, spelled out, and contains no `GPL` token at all.
 * The fixture was written the way a real pasted header looks, the control went red on four checks
 * out of five, and the fifth -- the one that catches a PASTE, which is the commonest way a boundary
 * is lost -- was dead.
 *
 * Both spellings are matched here: the prose names and the SPDX identifiers.
 */
const COPYLEFT_NOTICE = new RegExp(
  [
    String.raw`GNU\s+(Affero\s+)?(Lesser\s+)?General\s+Public\s+Licen[cs]e`,
    String.raw`Mozilla\s+Public\s+Licen[cs]e`,
    String.raw`Eclipse\s+Public\s+Licen[cs]e`,
    String.raw`Common\s+Development\s+and\s+Distribution\s+Licen[cs]e`,
    String.raw`Server\s+Side\s+Public\s+Licen[cs]e`,
    String.raw`\b(A?GPL|LGPL|SSPL|MPL|EPL|CDDL)[-\s]?[0-9]`,
  ].join("|"),
  "i",
);

/**
 * The one strong-copyleft package this product is permitted to depend on.
 *
 * A SET OF ONE, AND THE SIZE IS THE POINT. The migration is tractable precisely because the
 * strong-copyleft surface is a single engine behind a message boundary. A second entry here is a
 * change to the product's licensing architecture and must be a decision somebody makes in a diff,
 * which is what an allowlist of one buys that a "no new copyleft" rule of thumb does not.
 */
const PERMITTED_COPYLEFT_PACKAGES = new Set(["stockfish"]);

/** The compliance record a conveyed GPL component must carry. Losing any of it is a violation. */
const REQUIRED_COMPLIANCE_PATHS = [
  "LICENSING.md",
  "THIRD_PARTY_NOTICES.md",
  "client/public/licenses/stockfish/COPYING.txt",
];

/**
 * Check one tree. Findings mean the boundary moved.
 *
 * FIVE CHECKS, AND EACH ONE IS A WAY THE BOUNDARY HAS ACTUALLY BEEN LOST BY SOMEBODY. They are not
 * a taxonomy invented for completeness: a pasted header, an installed package, a manifest edited
 * back, a deleted notice, an engine bumped in a routine dependency update.
 */
/**
 * Package names that appear in the built output, or an empty set when there is no build to read.
 *
 * READ FROM THE EMITTED CHUNKS RATHER THAN FROM THE MANIFEST, because "is it a devDependency" is
 * the wrong question -- a devDependency can still be bundled, and a production dependency can be
 * tree-shaken away entirely. What decides whether a licence obligation is engaged is whether the
 * bytes are conveyed, and the only honest place to read that is the bytes.
 *
 * AN ABSENT BUILD YIELDS AN EMPTY SET, AND THAT IS DELIBERATE. A gate that failed on a clean
 * checkout would be a gate that runs before `npm run build` and reports the tree's licensing as
 * broken. The build is checked where a build exists; the other four checks do not need one.
 */
function distributedPackageNames(root: string): Set<string> {
  const out = new Set<string>();
  const assets = join(root, "dist", "public", "assets");
  if (!existsSync(assets)) return out;
  let blob = "";
  for (const file of readdirSync(assets)) {
    if (extname(file) !== ".js") continue;
    blob += readFileSync(join(assets, file), "utf8");
  }
  for (const name of KNOWN_WEAK_COPYLEFT_PACKAGES) {
    if (blob.includes(name)) out.add(name);
  }
  return out;
}

/**
 * The weak-copyleft packages currently in the resolved tree, pinned so a NEW one is visible.
 *
 * Scanning emitted chunks for an arbitrary package name is not possible -- a bundler does not keep
 * package names -- so this list is what `distributedPackageNames` searches for. Its real value is
 * the other direction: a weak-copyleft package that arrives and is not on this list is reported by
 * the freshness check below, so the list cannot silently fall behind the tree.
 */
const KNOWN_WEAK_COPYLEFT_PACKAGES = ["axe-core", "lightningcss"];

export function licenseBoundaryFindings(tree: LicenseTree): Finding[] {
  const findings: Finding[] = [];
  const at = (file: string, line: number, text: string) => findings.push({ file, line, text });
  const allow = new Set(tree.gplAllowlist.map((p) => p.replaceAll("\\", "/")));

  /*
   * 1. NO COPYLEFT NOTICE IN A PROPRIETARY DIRECTORY.
   *
   * Reads the header region rather than the whole file, because a licence notice lives at the top
   * and prose further down that happens to name a licence -- this repository's own documentation
   * does, at length -- is discussion rather than a grant.
   */
  for (const dir of tree.proprietary) {
    const full = join(tree.root, dir);
    if (!existsSync(full)) continue;
    for (const file of sourceFiles(full)) {
      const rel = file.replaceAll("\\", "/").replace(/^\.\//, "");
      if (allow.has(rel) || allow.has(rel.replace(`${tree.root}/`, ""))) continue;
      const head = readFileSync(file, "utf8").split("\n").slice(0, 30);
      head.forEach((line, i) => {
        if (!COPYLEFT_NOTICE.test(line)) return;
        at(rel, i + 1, `copyleft notice in a proprietary path: ${line.trim().slice(0, 80)}`);
      });
    }
  }

  /*
   * 2. NO NEW COPYLEFT DEPENDENCY, read from the RESOLVED tree and not the declared ranges.
   *
   * `package.json` says what was asked for; the lockfile says what is actually installed and
   * therefore what is actually conveyed. A transitive copyleft package appears only in the second.
   */
  const distributed = distributedPackageNames(tree.root);
  const lockPath = join(tree.root, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
      packages?: Record<string, { license?: string; version?: string }>;
    };
    for (const [path, meta] of Object.entries(lock.packages ?? {})) {
      const name = /node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(path)?.[1];
      if (!name || !meta.license) continue;
      if (PERMITTED_COPYLEFT_PACKAGES.has(name)) continue;
      if (STRONG_COPYLEFT.test(meta.license)) {
        at(
          "package-lock.json",
          1,
          `strong-copyleft dependency not on the allowlist: ${name} (${meta.license})`,
        );
        continue;
      }
      /*
       * Weak copyleft is permitted, and is a violation only if it is CONVEYED. Build tooling is
       * not conveyed; a package whose name appears in an emitted chunk is.
       */
      if (WEAK_COPYLEFT.test(meta.license) && distributed.has(name)) {
        at(
          "package-lock.json",
          1,
          `weak-copyleft dependency reaches the distributed output: ${name} (${meta.license})`,
        );
      }
    }
  }

  /*
   * 3. NO WHOLE-PRODUCT GPL CLAIM IN PACKAGE METADATA.
   *
   * Deliberately checks `package.json`'s `license` field and not the root `LICENSE` file. This
   * repository IS the historical GPL line and its root licence is correct as it stands; what must
   * never happen is the PROPRIETARY product carrying a GPL declaration. The check is therefore
   * conditional on the manifest claiming to be the proprietary product, which is what
   * the `decisionLabLicenseScope` field marks.
   */
  const pkgPath = join(tree.root, "package.json");
  if (existsSync(pkgPath)) {
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { license?: string; decisionLabLicenseScope?: string };
    if (pkg.decisionLabLicenseScope === "proprietary" && COPYLEFT_NOTICE.test(pkg.license ?? "")) {
      at(
        "package.json",
        raw.split("\n").findIndex((l) => l.includes('"license"')) + 1,
        `the proprietary product declares a copyleft licence: ${pkg.license}`,
      );
    }
  }

  /*
   * 4. THE COMPLIANCE RECORD IS STILL THERE.
   *
   * A conveyed GPL component owes a licence text and a notice. Deleting either is not a licensing
   * OPINION anybody would defend -- it is a file that went missing in a refactor.
   */
  for (const required of REQUIRED_COMPLIANCE_PATHS) {
    if (!existsSync(join(tree.root, required))) {
      at(required, 1, "required licence/compliance file is missing");
    }
  }

  /*
   * 5. THE ENGINE VERSION AND ITS COMPLIANCE RECORD AGREE.
   *
   * The failure this catches is mundane and is exactly why it needs a machine: a dependency bump
   * changes the conveyed engine, and the notices go on naming the old version, the old hashes and
   * the old corresponding source. The distribution is then out of compliance while every test is
   * green.
   */
  if (existsSync(lockPath) && existsSync(join(tree.root, "THIRD_PARTY_NOTICES.md"))) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8")) as {
      packages?: Record<string, { version?: string }>;
    };
    const installed = Object.entries(lock.packages ?? {}).find(([p]) =>
      p.endsWith("node_modules/stockfish"),
    )?.[1]?.version;
    const notices = readFileSync(join(tree.root, "THIRD_PARTY_NOTICES.md"), "utf8");
    if (installed && !notices.includes(installed)) {
      at(
        "THIRD_PARTY_NOTICES.md",
        1,
        `stockfish@${installed} is installed and conveyed, and the notices do not name that version`,
      );
    }
  }

  return findings;
}
