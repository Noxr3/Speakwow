#!/usr/bin/env node
// Copies Speakwow's secrets from 1Password to Vercel and Railway.
//
//   node scripts/secrets-sync.mjs                    what would change (default)
//   node scripts/secrets-sync.mjs --apply            write the changed values
//   node scripts/secrets-sync.mjs --apply --deploy   ...and redeploy what changed
//   node scripts/secrets-sync.mjs --only supabase    only refs containing "supabase"
//
// Values live only in 1Password (vault Speakwow; scripts/secrets.json says
// where each one goes). They are read with `op read`, kept in memory, and
// never printed: the output names variables and says what happened to them.
//
// Vercel cannot read back a "sensitive" variable, so every variable this
// script writes carries a fingerprint of its value in its comment
// ("1password sha256:<12 hex>"); a value is rewritten only when the
// fingerprint differs. Railway values are compared directly.
//
// Tokens: VERCEL_TOKEN, else the Vercel CLI's login; RAILWAY_API_TOKEN, else
// the Railway CLI's login (`railway login`). 1Password: the `op` CLI,
// signed in (the desktop app's CLI integration is enough).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const VERCEL_API = "https://api.vercel.com";
const RAILWAY_API = "https://backboard.railway.com/graphql/v2";
const MARK = "1password";

/** A short, one-way fingerprint of a value: enough to tell values apart. */
export function fingerprint(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

export function fingerprintComment(value) {
  return `${MARK} ${fingerprint(value)}`;
}

export function sameTargets(a = [], b = []) {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

/**
 * What to do with one Vercel variable. `existing` is the project's variable
 * with the same key and targets (or undefined); `decrypted` is its readable
 * value when Vercel returns one (not for "sensitive").
 */
export function vercelAction(existing, want, value, decrypted) {
  if (!existing) return "create";
  if (existing.type !== want.type) return "update";
  if ((existing.comment ?? "").includes(fingerprint(value))) return "unchanged";
  if (decrypted !== undefined && decrypted === value) return "mark";
  return "update";
}

export function railwayAction(current, value) {
  if (current === undefined) return "create";
  return current === value ? "unchanged" : "update";
}

function describe(action, applied) {
  if (action === "unchanged") return "unchanged";
  const words = {
    create: "create",
    update: "update",
    mark: "add fingerprint (value already matches)",
  };
  return applied
    ? `${words[action]}d`
        .replace("fingerprintd", "fingerprint")
        .replace("matches)d", "matches)")
    : `would ${words[action]}`;
}

function parseArgs(argv) {
  const args = { apply: false, deploy: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--apply") args.apply = true;
    else if (argv[i] === "--deploy") args.deploy = true;
    else if (argv[i] === "--only") args.only = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (args.deploy && !args.apply) throw new Error("--deploy needs --apply");
  return args;
}

/**
 * Every value at once, in one `op inject` call: one 1Password authorization
 * per run instead of one per secret. An empty field comes back as null.
 * Every item and field in secrets.json must exist (empty is fine), or
 * `op inject` refuses the whole template.
 */
export function readAllFromOp(refs, run = execFileSync) {
  // The template holds only references, so a temporary file is safe; `op
  // inject` reading stdin checks for data before a piped write arrives.
  const template = JSON.stringify(
    Object.fromEntries(refs.map((ref, i) => [`s${i}`, `{{ ${ref} }}`])),
  );
  const dir = mkdtempSync(join(tmpdir(), "speakwow-secrets-"));
  const file = join(dir, "template.json");
  writeFileSync(file, template, { mode: 0o600 });
  let out;
  try {
    out = run("op", ["inject", "-i", file], {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (error) {
    const message = String(error.stderr || error.message)
      .trim()
      .split("\n")
      .pop();
    throw new Error(`1Password could not read the secrets: ${message}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const values = JSON.parse(out);
  return new Map(
    refs.map((ref, i) => [ref, values[`s${i}`] ? values[`s${i}`] : null]),
  );
}

function vercelToken() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  const files = [
    join(homedir(), "Library/Application Support/com.vercel.cli/auth.json"),
    join(homedir(), ".local/share/com.vercel.cli/auth.json"),
  ];
  for (const file of files) {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).token;
  }
  throw new Error("No Vercel token: set VERCEL_TOKEN or run `vercel login`.");
}

function railwayToken() {
  if (process.env.RAILWAY_API_TOKEN) return process.env.RAILWAY_API_TOKEN;
  const file = join(homedir(), ".railway/config.json");
  // The CLI's access token is short-lived; any CLI command refreshes it.
  try {
    execFileSync("railway", ["whoami"], { stdio: "ignore" });
  } catch {
    // not installed or not logged in: the error below says what to do
  }
  if (existsSync(file)) {
    const token = JSON.parse(readFileSync(file, "utf8")).user?.accessToken;
    if (token) return token;
  }
  throw new Error(
    "No Railway token: set RAILWAY_API_TOKEN or run `railway login`.",
  );
}

async function vercel(token, path, init = {}) {
  const res = await fetch(`${VERCEL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      `Vercel ${init.method ?? "GET"} ${path.split("?")[0]}: ${res.status} ${body.error?.message ?? ""}`,
    );
  return body;
}

async function railway(token, query, variables) {
  const res = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "speakwow-secrets-sync/1.0",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    throw new Error(
      `Railway: ${res.status} ${(body.errors ?? []).map((e) => e.message).join("; ")}`,
    );
  }
  return body.data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = JSON.parse(readFileSync(join(here, "secrets.json"), "utf8"));
  const secrets = config.secrets.filter(
    (s) => !args.only || s.ref.includes(args.only),
  );
  const rows = [];
  const changed = { vercel: false, railway: false };

  const values = readAllFromOp(secrets.map((s) => s.ref));

  // Vercel
  const vt = vercelToken();
  const teams = await vercel(vt, "/v2/teams?limit=50");
  const team = teams.teams.find((t) => t.slug === config.vercel.team);
  if (!team)
    throw new Error(
      `Vercel team ${config.vercel.team} not found for this login.`,
    );
  const q = `teamId=${team.id}`;
  const project = config.vercel.project;
  const { envs } = await vercel(vt, `/v10/projects/${project}/env?${q}`);
  for (const secret of secrets) {
    for (const want of secret.vercel ?? []) {
      const value = values.get(secret.ref);
      const place = `vercel ${project} ${want.key} [${want.target.join(",")}]`;
      if (value === null) {
        rows.push([place, "skipped: no value in 1Password", secret.ref]);
        continue;
      }
      const existing = envs.find(
        (e) => e.key === want.key && sameTargets(e.target, want.target),
      );
      let decrypted;
      if (existing && existing.type !== "sensitive") {
        const one = await vercel(
          vt,
          `/v1/projects/${project}/env/${existing.id}?${q}`,
        );
        decrypted = one.value;
      }
      const action = vercelAction(existing, want, value, decrypted);
      rows.push([place, describe(action, args.apply), secret.ref]);
      if (!args.apply || action === "unchanged") continue;
      const body = {
        value,
        type: want.type,
        target: want.target,
        comment: fingerprintComment(value),
      };
      if (existing && existing.type === want.type) {
        await vercel(vt, `/v9/projects/${project}/env/${existing.id}?${q}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        if (existing) {
          await vercel(vt, `/v9/projects/${project}/env/${existing.id}?${q}`, {
            method: "DELETE",
          });
        }
        await vercel(vt, `/v10/projects/${project}/env?${q}`, {
          method: "POST",
          body: JSON.stringify({ key: want.key, ...body }),
        });
      }
      if (action !== "mark") changed.vercel = true;
    }
  }

  // Railway
  const wanted = secrets.filter((s) => (s.railway ?? []).length);
  if (wanted.length) {
    const rt = railwayToken();
    const ids = {
      projectId: config.railway.project,
      environmentId: config.railway.environment,
      serviceId: config.railway.service,
    };
    const { variables } = await railway(
      rt,
      "query($projectId: String!, $environmentId: String!, $serviceId: String!) { variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) }",
      ids,
    );
    for (const secret of wanted) {
      for (const want of secret.railway) {
        const value = values.get(secret.ref);
        const place = `railway ${want.key}`;
        if (value === null) {
          rows.push([place, "skipped: no value in 1Password", secret.ref]);
          continue;
        }
        const action = railwayAction(variables[want.key], value);
        rows.push([place, describe(action, args.apply), secret.ref]);
        if (!args.apply || action === "unchanged") continue;
        await railway(
          rt,
          "mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
          { input: { ...ids, name: want.key, value, skipDeploys: true } },
        );
        changed.railway = true;
      }
    }

    if (args.deploy && changed.railway) {
      await railway(
        rt,
        "mutation($environmentId: String!, $serviceId: String!) { serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId) }",
        { environmentId: ids.environmentId, serviceId: ids.serviceId },
      );
      rows.push(["railway", "redeploy started", ""]);
    }
  }

  if (args.deploy && changed.vercel) {
    const { id: projectId } = await vercel(vt, `/v9/projects/${project}?${q}`);
    const list = await vercel(
      vt,
      `/v6/deployments?${q}&projectId=${projectId}&target=production&state=READY&limit=1`,
    );
    const last = list.deployments?.[0];
    if (!last)
      throw new Error("No ready production deployment on Vercel to redeploy.");
    const next = await vercel(vt, `/v13/deployments?${q}&forceNew=1`, {
      method: "POST",
      body: JSON.stringify({
        name: project,
        deploymentId: last.uid,
        target: "production",
      }),
    });
    rows.push([`vercel ${project}`, `redeploy started (${next.id})`, ""]);
  }

  const width = Math.max(...rows.map((r) => r[0].length));
  for (const [place, status, ref] of rows) {
    console.log(
      `${place.padEnd(width)}  ${status}${ref ? `   <- ${ref}` : ""}`,
    );
  }
  if (!args.apply)
    console.log("\nDry run. Add --apply to write (and --deploy to redeploy).");
  else if (!args.deploy && (changed.vercel || changed.railway)) {
    console.log(
      "\nWritten, not deployed: add --deploy, or redeploy, for the new values to take effect.",
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
