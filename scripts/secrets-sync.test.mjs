import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  fingerprint,
  fingerprintComment,
  railwayAction,
  readAllFromOp,
  sameTargets,
  vercelAction,
} from "./secrets-sync.mjs";

const config = JSON.parse(
  readFileSync(new URL("./secrets.json", import.meta.url), "utf8"),
);

test("a fingerprint tells values apart and gives nothing away", () => {
  const a = fingerprint("sb_secret_example_one");
  assert.match(a, /^sha256:[0-9a-f]{12}$/);
  assert.notEqual(a, fingerprint("sb_secret_example_two"));
  assert.equal(a, fingerprint("sb_secret_example_one"));
  assert.ok(!fingerprintComment("sb_secret_example_one").includes("example"));
});

test("a Vercel variable is rewritten only when its value changed", () => {
  const want = { key: "K", target: ["production"], type: "sensitive" };
  const value = "new-value";
  assert.equal(vercelAction(undefined, want, value), "create");
  assert.equal(
    vercelAction(
      { type: "sensitive", comment: fingerprintComment(value) },
      want,
      value,
    ),
    "unchanged",
  );
  assert.equal(
    vercelAction(
      { type: "sensitive", comment: fingerprintComment("old") },
      want,
      value,
    ),
    "update",
  );
  // a sensitive variable with no fingerprint cannot be compared: write it
  assert.equal(vercelAction({ type: "sensitive" }, want, value), "update");
  // a readable one with the same value only gets its fingerprint
  const readable = { ...want, type: "encrypted" };
  assert.equal(
    vercelAction({ type: "encrypted" }, readable, value, value),
    "mark",
  );
  assert.equal(
    vercelAction({ type: "encrypted" }, want, value, value),
    "update",
  );
});

test("a Railway variable is compared directly", () => {
  assert.equal(railwayAction(undefined, "v"), "create");
  assert.equal(railwayAction("v", "v"), "unchanged");
  assert.equal(railwayAction("old", "v"), "update");
});

test("targets match in any order", () => {
  assert.ok(sameTargets(["production", "preview"], ["preview", "production"]));
  assert.ok(!sameTargets(["production"], ["production", "preview"]));
});

test("the secrets map points only at the Speakwow vault, once per place", () => {
  const seen = new Set();
  for (const secret of config.secrets) {
    assert.match(
      secret.ref,
      /^op:\/\/Speakwow\/[a-z0-9-]+\/[a-z0-9_]+$/,
      secret.ref,
    );
    assert.ok(
      secret.vercel?.length || secret.railway?.length,
      `${secret.ref} goes nowhere`,
    );
    for (const v of secret.vercel ?? []) {
      assert.ok(
        ["encrypted", "sensitive"].includes(v.type),
        `${v.key}: type ${v.type}`,
      );
      // Vercel refuses sensitive variables in development
      if (v.type === "sensitive")
        assert.ok(!v.target.includes("development"), v.key);
      const place = `vercel:${v.key}:${[...v.target].sort()}`;
      assert.ok(!seen.has(place), `${place} twice`);
      seen.add(place);
    }
    for (const r of secret.railway ?? []) {
      const place = `railway:${r.key}`;
      assert.ok(!seen.has(place), `${place} twice`);
      seen.add(place);
    }
  }
});

test("all secrets come from one 1Password call, and empty fields are skipped", () => {
  const calls = [];
  const fake = (cmd, args) => {
    calls.push([cmd, args.slice(0, 2)]);
    const template = JSON.parse(readFileSync(args[2], "utf8"));
    assert.deepEqual(template, {
      s0: "{{ op://Speakwow/a/key }}",
      s1: "{{ op://Speakwow/b/key }}",
    });
    return JSON.stringify({ s0: "value-a", s1: "" });
  };
  const values = readAllFromOp(
    ["op://Speakwow/a/key", "op://Speakwow/b/key"],
    fake,
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["op", ["inject", "-i"]]);
  assert.equal(values.get("op://Speakwow/a/key"), "value-a");
  assert.equal(values.get("op://Speakwow/b/key"), null);
});
