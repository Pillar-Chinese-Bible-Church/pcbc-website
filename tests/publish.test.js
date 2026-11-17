import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const script = path.resolve("scripts/publish.sh");
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pcbc-publish-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const cwd = path.join(directory, "work");
  const remote = path.join(directory, "remote.git");
  fs.mkdirSync(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--bare", remote);
  git("init", "-b", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Release test");
  git("remote", "add", "origin", remote);
  const commit = label => { fs.writeFileSync(path.join(cwd, "content.txt"), label); git("add", "."); git("commit", "-m", label); return git("rev-parse", "HEAD"); };
  const initial = commit("initial");
  git("push", "origin", "main", `${initial}:refs/heads/live`);
  const publish = revision => execFileSync("bash", [script], { cwd, env: { ...process.env, REVISION: revision }, stdio: "pipe" });
  const live = () => git("ls-remote", "origin", "refs/heads/live").split(/\s/)[0];
  return { git, commit, publish, live, initial };
}

test("publishing uses the tested commit even when main has advanced", t => {
  const f = fixture(t);
  const reviewed = f.commit("reviewed");
  const latest = f.commit("newer-unreviewed");
  f.git("push", "origin", "main");
  f.git("checkout", "--detach", reviewed);
  f.publish(reviewed);
  assert.equal(f.live(), reviewed);
  assert.notEqual(f.live(), latest);
  assert.throws(() => f.publish(latest), "reject a revision different from the checkout");
});

test("publishing rejects malformed, off-main and backward live revisions", t => {
  const f = fixture(t);
  const latest = f.commit("newer");
  f.git("push", "origin", "main");
  f.publish(latest);
  f.git("checkout", "--detach", f.initial);
  assert.throws(() => f.publish(f.initial));
  f.git("checkout", "-b", "feature");
  const feature = f.commit("feature-only");
  assert.throws(() => f.publish(feature));
  assert.throws(() => f.publish("main; echo unsafe"));
  assert.equal(f.live(), latest);
});
