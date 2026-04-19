import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..");
const logsDir = join(repoRoot, "logs");

mkdirSync(logsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const logFile = join(logsDir, `bug-check-${timestamp}.log`);
const logStream = createWriteStream(logFile, { flags: "a" });

const args = new Set(process.argv.slice(2));
const runChecks = !args.has("--tests-only");
const runTests = !args.has("--checks-only");
const runUnit = !args.has("--e2e-only");
const runE2E = !args.has("--unit-only");
const unitTimeoutMs = Math.max(
  10_000,
  Number(process.env.UNIT_TIMEOUT_SECONDS ?? "300") * 1_000
);
const defaultE2ePort = Number(process.env.BUGCHECK_DEV_SERVER_PORT ?? "5173");
const e2eSpec = process.env.BUGCHECK_E2E_SPEC ?? "cypress/e2e/app.cy.ts";

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  process.stdout.write(`${line}\n`);
  logStream.write(`${line}\n`);
}

function section(title) {
  const sep = "════════════════════════════════════════════════════════════";
  log(sep);
  log(`  ${title}`);
  log(sep);
}

function commandLine(command, commandArgs) {
  return [command, ...commandArgs].join(" ");
}

function quoteArg(arg) {
  if (!arg) return '""';
  if (process.platform === "win32") {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function toShellCommand(command, commandArgs) {
  return [command, ...commandArgs.map(quoteArg)].join(" ");
}

function runCommand(command, commandArgs, options = {}) {
  const { timeoutMs, cwd = repoRoot, env, label = commandLine(command, commandArgs) } = options;
  return new Promise((resolve) => {
    log(`$ ${label}`);
    const child = spawn(toShellCommand(command, commandArgs), {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
      windowsHide: true,
    });

    let timedOut = false;
    let timer;

    if (timeoutMs && Number.isFinite(timeoutMs)) {
      timer = setTimeout(() => {
        timedOut = true;
        log(`⚠️ Command timed out after ${Math.round(timeoutMs / 1000)}s`);
        child.kill("SIGTERM");
      }, timeoutMs);
    }

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      logStream.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      logStream.write(text);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut && code === 0) {
        resolve(124);
        return;
      }
      resolve(code ?? 1);
    });
  });
}

async function waitForServer(url, maxAttempts = 30) {
  for (let i = 1; i <= maxAttempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // no-op
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

function getEphemeralPort() {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      resolve(defaultE2ePort);
    });
    server.once("listening", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : defaultE2ePort;
      server.close(() => resolve(port));
    });
    server.listen(0, "127.0.0.1");
  });
}

async function runE2ETests() {
  const chosenPort = Number(process.env.BUGCHECK_DEV_SERVER_PORT ?? 0) || await getEphemeralPort();
  const serverUrl = `http://localhost:${chosenPort}`;
  log(`Starting dev server on port ${chosenPort}...`);

  const devServer = spawn(toShellCommand("npx", [
    "vite",
    "--port",
    String(chosenPort),
    "--strictPort",
  ]), {
    cwd: repoRoot,
    env: process.env,
    shell: true,
    windowsHide: true,
  });

  devServer.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    process.stdout.write(text);
    logStream.write(text);
  });

  devServer.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    process.stderr.write(text);
    logStream.write(text);
  });

  try {
    log("Waiting for dev server to be ready...");
    const ready = await waitForServer(serverUrl, 30);
    if (!ready) {
      log("❌ Dev server did not become ready in time.");
      return 1;
    }

    const code = await runCommand("npx", [
      "cypress",
      "run",
      "--spec",
      e2eSpec,
      "--config",
      `baseUrl=${serverUrl}`,
    ], {
      label: `npx cypress run --spec ${e2eSpec} --config baseUrl=${serverUrl}`,
    });
    return code;
  } finally {
    if (!devServer.killed) {
      devServer.kill("SIGTERM");
    }
  }
}

async function main() {
  section(`MacroPal Bug Check — ${timestamp}`);
  log(`Log file: ${logFile}`);
  log(`Checks: ${runChecks} | Tests: ${runTests} | Unit: ${runUnit} | E2E: ${runE2E}`);

  let lintResult = 0;
  let buildResult = 0;
  let unitResult = 0;
  let e2eResult = 0;

  if (runChecks) {
    section("Static Checks");
    lintResult = await runCommand("npm", ["run", "lint"]);
    buildResult = await runCommand("npm", ["run", "build"]);
  }

  if (runTests) {
    section("Tests");
    if (runUnit) {
      unitResult = await runCommand("npm", ["run", "test.unit.run"], { timeoutMs: unitTimeoutMs });
    }
    if (runE2E) {
      e2eResult = await runE2ETests();
    }
  }

  section("Summary");
  if (runChecks) {
    log(`Lint  : ${lintResult === 0 ? "✅ PASS" : `❌ FAIL (${lintResult})`}`);
    log(`Build : ${buildResult === 0 ? "✅ PASS" : `❌ FAIL (${buildResult})`}`);
  }
  if (runTests) {
    if (runUnit) log(`Unit  : ${unitResult === 0 ? "✅ PASS" : `❌ FAIL (${unitResult})`}`);
    if (runE2E) log(`E2E   : ${e2eResult === 0 ? "✅ PASS" : `❌ FAIL (${e2eResult})`}`);
  }
  log(`Full log saved to: ${logFile}`);

  const overall = lintResult + buildResult + unitResult + e2eResult;
  logStream.end();
  process.exit(overall);
}

void main();
