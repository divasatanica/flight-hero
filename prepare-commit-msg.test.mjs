import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const hook = resolve(".husky/prepare-commit-msg");

function runHook({
  nvm = false,
  codex = true,
  failure = false,
  message = "--generate",
  staged = true,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "commit-hook-test-"));
  try {
    const bin = join(root, "bin");
    const nodeBin = join(root, "nvm-bin");
    const nvmDir = join(root, "nvm");
    for (const dir of [bin, nodeBin, nvmDir]) mkdirSync(dir);
    const executable = (file, content) =>
      writeFileSync(file, content, { mode: 0o755 });
    executable(
      join(bin, "git"),
      '#!/bin/sh\nif [ "$3" = "--quiet" ]; then exit "$STAGED_STATUS"; fi\nprintf "synthetic staged diff\\n"\n',
    );
    if (codex)
      executable(
        join(nvm ? nodeBin : bin, "codex"),
        `#!/bin/sh
printf 'called' > "$CALL_MARKER"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output-last-message" ]; then shift; output="$1"; fi
  shift
done
cat > "$INPUT_MARKER"
if [ "$CODEX_FAILURE" = "yes" ]; then echo 'synthetic Codex failure' >&2; exit 1; fi
printf 'chore: generate commit message\\n' > "$output"
`,
      );
    if (nvm)
      writeFileSync(
        join(nvmDir, "nvm.sh"),
        'export PATH="$NVM_TEST_BIN:$PATH"\n',
      );
    const messageFile = join(root, "message");
    writeFileSync(messageFile, message);
    const result = spawnSync("/bin/sh", ["-e", hook, messageFile, "message"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:/usr/bin:/bin`,
        HOME: root,
        NVM_DIR: nvmDir,
        NVM_TEST_BIN: nodeBin,
        CALL_MARKER: join(root, "called"),
        INPUT_MARKER: join(root, "input"),
        STAGED_STATUS: staged ? "1" : "0",
        CODEX_FAILURE: failure ? "yes" : "no",
      },
    });
    return {
      ...result,
      message: readFileSync(messageFile, "utf8"),
      called: existsSync(join(root, "called")),
      input: existsSync(join(root, "input"))
        ? readFileSync(join(root, "input"), "utf8")
        : "",
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("finds Codex installed through nvm when GUI PATH omits it", () => {
  const result = runHook({ nvm: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.message, "chore: generate commit message\n");
  assert.match(result.input, /synthetic staged diff/);
});

test("uses Codex already on PATH", () => {
  assert.equal(runHook().message, "chore: generate commit message\n");
});

test("keeps manual commit messages without invoking Codex", () => {
  const result = runHook({ message: "feat: manual message" });
  assert.equal(result.called, false);
  assert.equal(result.message, "feat: manual message");
});

test("skips generation when nothing is staged", () => {
  assert.equal(runHook({ staged: false }).called, false);
});

test("reports a missing CLI", () => {
  assert.match(runHook({ codex: false }).stderr, /Codex CLI was not found/);
});

test("shows the actual Codex error when generation fails", () => {
  const result = runHook({ failure: true });
  assert.match(result.stderr, /synthetic Codex failure/);
  assert.equal(result.message, "--generate");
});
