import { spawn, execFile } from "node:child_process";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve, delimiter } from "node:path";

const [, , bbAppDir, label, runsArg = "3", pathMode = "fresh", outDir = tmpdir()] = process.argv;
const launcherEntry = join(resolve(bbAppDir), "dist", "bb-app.js");
const runs = Number(runsArg);

function reservePort() {
  return new Promise((ok, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => ok(p));
    });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freshPath() {
  const nodeDir = dirname(process.execPath);
  if (process.platform === "win32") {
    const root = process.env.SystemRoot ?? "C:\\Windows";
    const git = (process.env.PATH ?? "").split(delimiter).filter((p) => /\\Git\\(cmd|bin)/i.test(p));
    return [nodeDir, `${root}\\System32`, root, `${root}\\System32\\Wbem`, `${root}\\System32\\WindowsPowerShell\\v1.0`, ...git].join(delimiter);
  }
  return [nodeDir, "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(delimiter);
}

async function stopTree(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((r) => child.once("exit", r));
  if (process.platform === "win32") {
    await new Promise((r) => execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => r()));
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  }
  await Promise.race([exited, sleep(15000)]);
}

async function timed(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    const body = await res.json().catch(() => null);
    return { status: res.status, ms: Date.now() - start, body };
  } catch (error) {
    return { status: String(error), ms: Date.now() - start, body: null };
  }
}

async function oneRun(index) {
  const root = await mkdtemp(join(tmpdir(), "bb-agent-list-"));
  const dataDir = join(root, "data");
  const home = join(root, "home");
  await mkdir(home, { recursive: true });
  const serverPort = await reservePort();
  const daemonPort = await reservePort();
  const base = `http://127.0.0.1:${serverPort}`;
  const env = { ...process.env, BB_TELEMETRY: "false", NODE_ENV: "production" };
  if (pathMode === "fresh") {
    env.PATH = freshPath();
    env.Path = env.PATH;
    env.HOME = home;
    env.USERPROFILE = home;
    env.APPDATA = join(home, "AppData", "Roaming");
    env.LOCALAPPDATA = join(home, "AppData", "Local");
    await mkdir(env.APPDATA, { recursive: true });
    await mkdir(env.LOCALAPPDATA, { recursive: true });
  }
  for (const k of ["BB_SERVER_URL", "BB_DATA_DIR", "BB_THREAD_ID", "BB_SKIP_ONBOARDING"]) delete env[k];
  const t0 = Date.now();
  const child = spawn(process.execPath, [launcherEntry, "--data-dir", dataDir, "--server-port", String(serverPort), "--host-daemon-port", String(daemonPort), "--bundled"], {
    detached: process.platform !== "win32",
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  let readyAt = null;
  const onData = (c) => {
    output += c.toString("utf8");
    if (readyAt === null && output.includes("bb is ready")) readyAt = Date.now();
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  const result = { run: index, label, platform: process.platform, pathMode };
  try {
    while (readyAt === null) {
      if (child.exitCode !== null) throw new Error(`launcher exited ${child.exitCode}`);
      if (Date.now() - t0 > 180000) throw new Error("never ready");
      await sleep(20);
    }
    result.readyMs = readyAt - t0;
    const hosts = (await timed(`${base}/api/v1/hosts`)).body;
    const host = (Array.isArray(hosts) ? hosts : hosts?.hosts ?? [])[0];
    const hostId = host.id;
    const q = `hostId=${encodeURIComponent(hostId)}`;
    const [states, providers, cli] = await Promise.all([
      timed(`${base}/api/v1/system/providers/state?${q}`),
      timed(`${base}/api/v1/system/providers?${q}`),
      timed(`${base}/api/v1/hosts/${hostId}/provider-clis/status`),
    ]);
    result.firstStatesMs = states.ms;
    result.firstStatesStatus = states.status;
    result.statesFromReadyMs = Date.now() - readyAt;
    result.firstProvidersMs = providers.ms;
    result.firstCliStatusMs = cli.ms;
    result.providers = (states.body?.providers ?? []).map((p) => `${p.providerId}:${p.status}`).join(" ");
    result.listed = (providers.body ?? []).map?.((p) => p.id).join(" ");
    const repeat = [];
    for (let i = 0; i < 2; i += 1) repeat.push((await timed(`${base}/api/v1/system/providers/state?${q}`)).ms);
    result.repeatStatesMs = repeat;
  } catch (error) {
    result.error = String(error);
    result.output = output.slice(-3000);
  } finally {
    await stopTree(child);
    const logs = join(dataDir, "logs");
    try {
      const lines = [];
      for (const f of ["server.1.log", "host-daemon.1.log"]) {
        const raw = await readFile(join(logs, f), "utf8").catch(() => "");
        for (const l of raw.split("\n")) {
          try {
            const j = JSON.parse(l);
            if (/provider\.health|provider health|Provider health|health/i.test(j.msg ?? "") || /provider\.health/.test(JSON.stringify(j).slice(0, 400))) lines.push([j.time - t0, f.slice(0, 6), j.msg, j.providerId ?? j.commandType ?? ""]);
          } catch {}
        }
      }
      await writeFile(join(outDir, `${label}-${index}-healthlog.json`), JSON.stringify(lines, null, 1));
    } catch {}
    for (let i = 0; i < 20; i += 1) {
      try { await rm(root, { recursive: true, force: true }); break; } catch { await sleep(250); }
    }
  }
  console.log(JSON.stringify(result));
  return result;
}

const all = [];
for (let i = 1; i <= runs; i += 1) all.push(await oneRun(i));
const ok = all.filter((r) => r.firstStatesMs !== undefined);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
console.log(`SUMMARY ${label} ${process.platform} path=${pathMode} runs=${ok.length}/${all.length} firstStates(ms)=${ok.map((r) => r.firstStatesMs).join(",")} median=${med(ok.map((r) => r.firstStatesMs))} max=${Math.max(...ok.map((r) => r.firstStatesMs))} repeat=${ok.map((r) => r.repeatStatesMs.join("/")).join(",")}`);
