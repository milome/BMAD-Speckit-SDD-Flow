const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('js-yaml');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';
const MODULE_PATHS = {
  credential: 'scripts/requirements-contract-judge-credential-resolver',
  registry: 'scripts/requirements-contract-judge-provider-registry',
  openAiAdapter: 'scripts/requirements-contract-openai-compatible-judge-adapter',
  anthropicAdapter: 'scripts/requirements-contract-anthropic-compatible-judge-adapter',
};
const REGISTRY_PROJECTION = path.join(
  'shared',
  'requirements-contract',
  'requirements-contract-judge-provider-registry.json'
);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
      BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
      ...(options.env || {}),
    },
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout || 300_000,
  });
}

function expectSuccess(result, label) {
  assert.equal(
    result.status,
    0,
    `${label}\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${
      result.stderr || result.error?.message || ''
    }`
  );
  return result;
}

function assertProductionModulesExist() {
  for (const [kind, relativePath] of Object.entries(MODULE_PATHS)) {
    const sourcePath = path.join(
      PACKAGE_ROOT,
      'src',
      'main-agent',
      'source-authority',
      `${relativePath}.ts`
    );
    assert.equal(existsSync(sourcePath), true, `expected Judge ${kind} source module`);
  }
}

function parsePackFilename(stdout) {
  const parsed = JSON.parse(String(stdout || '').trim());
  assert.equal(Array.isArray(parsed), true);
  assert.equal(parsed.length, 1);
  assert.equal(typeof parsed[0].filename, 'string');
  return parsed[0].filename;
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256(filePath) {
  return `sha256:${createHash('sha256').update(readFileSync(filePath)).digest('hex')}`;
}

function filesBelow(root) {
  if (!existsSync(root)) return [];
  const result = [];
  for (const entry of readdirSync(root)) {
    const candidate = path.join(root, entry);
    if (statSync(candidate).isDirectory()) result.push(...filesBelow(candidate));
    else result.push(candidate);
  }
  return result;
}

function assertFakeCredentialExcluded(root, fakeCredential, allowedPath) {
  for (const filePath of filesBelow(root)) {
    if (path.resolve(filePath) === path.resolve(allowedPath)) continue;
    const bytes = readFileSync(filePath);
    assert.equal(
      bytes.includes(Buffer.from(fakeCredential, 'utf8')),
      false,
      `fake private credential leaked into ${filePath}`
    );
  }
}

function runtimeConfig() {
  return {
    judgeRuntime: {
      schemaVersion: 'requirements-contract-judge-runtime/v1',
      enabled: true,
      activeProviderRef: 'provider-a',
      selectionPolicy: {
        mode: 'contract_locked',
        runtimeFallbackAllowed: false,
        runtimeAutoDiscoveryAllowed: false,
        environmentOverrideAllowed: false,
        cliTransportAllowed: false,
        selectionReceiptRequired: true,
      },
      credentialConfig: {
        source: 'config_file',
        path: '_bmad-output/config/private/judge-provider.credentials.yaml',
        schemaVersion: 'requirements-contract-judge-credentials/v1',
        allowedRoot: '_bmad-output/config/private',
        environmentFallbackAllowed: false,
      },
      providers: {
        'provider-a': {
          enabled: true,
          transport: 'openai-compatible',
          apiStyle: 'chat_completions',
          model: 'judge-model-a',
          credentialRef: 'provider-a',
          endpoint: {
            baseUrl: 'https://installed-judge.example.test/base-only',
            resolutionMode: 'transport_managed',
            routingOwnership: 'transport_adapter',
            upstreamVersioning: 'gateway_managed',
            explicitOperationPath: null,
          },
          authentication: {
            type: 'bearer',
            sensitivity: 'secret',
            arbitraryNonEmptyValueAllowed: false,
          },
          auditPolicy: {
            independenceClass: 'different_provider_different_model',
            blindReview: true,
            allowPassAuthority: false,
            toolsAllowed: false,
            implementationWritesAllowed: false,
          },
          requestPolicy: {
            timeoutMs: 10_000,
            maximumAttempts: 1,
            structuredResponseRequired: true,
          },
        },
      },
    },
  };
}

function writeInstalledProbe(consumerRoot, installedRoot) {
  const probePath = path.join(consumerRoot, 'judge-installed-probe.cjs');
  const moduleMap = Object.fromEntries(
    Object.entries(MODULE_PATHS).map(([kind, relativePath]) => [
      kind,
      path.join(installedRoot, 'dist', 'main-agent', 'source-authority', `${relativePath}.js`),
    ])
  );
  writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const Module = require('node:module');",
      `const moduleMap = ${JSON.stringify(moduleMap)};`,
      'const forbidden = /(?:^|[\\\\/])src[\\\\/]|\\.tsx?$|\\btsx\\b|\\bts-node\\b|main-agent-orchestration\\.ts/i;',
      'const sourceFallbacks = [];',
      'const originalLoad = Module._load;',
      'Module._load = function(request, parent, isMain) {',
      "  if (forbidden.test(String(request || ''))) sourceFallbacks.push(String(request));",
      '  return originalLoad.call(this, request, parent, isMain);',
      '};',
      'function loadOne(kind) {',
      '  const modulePath = moduleMap[kind];',
      '  if (!fs.existsSync(modulePath)) throw new Error(`installed_${kind}_module_missing`);',
      '  return require(modulePath);',
      '}',
      'function pickFunction(value, names) {',
      '  for (const name of names) if (typeof value?.[name] === "function") return value[name].bind(value);',
      "  throw new Error(`installed_export_missing:${names.join('|')}`);",
      '}',
      '(async () => {',
      '  const cwd = process.cwd();',
      '  const credentialModule = loadOne("credential");',
      '  const registryModule = loadOne("registry");',
      '  const openAiAdapterModule = loadOne("openAiAdapter");',
      '  const anthropicAdapterModule = loadOne("anthropicAdapter");',
      '  const resolveCredential = pickFunction(credentialModule, ["resolveRequirementsContractJudgeCredential"]);',
      '  const createRegistry = pickFunction(registryModule, [',
      '    "createRequirementsContractJudgeProviderRegistry",',
      '  ]);',
      '  const resolveProvider = pickFunction(registryModule, ["resolveRequirementsContractJudgeProvider"]);',
      '  const openAiAdapter = openAiAdapterModule.OpenAICompatibleJudgeAdapter;',
      '  const anthropicAdapter = anthropicAdapterModule.AnthropicCompatibleJudgeAdapter;',
      '  if (!openAiAdapter || !anthropicAdapter) throw new Error("installed_adapter_export_missing");',
      '  for (const adapter of [openAiAdapter, anthropicAdapter]) {',
      '    for (const method of ["probe", "judge", "buildRequest"]) pickFunction(adapter, [method]);',
      '  }',
      '  const credential = await resolveCredential({ cwd, config: "judge-runtime.yaml" });',
      '  const config = require("js-yaml").load(fs.readFileSync("judge-runtime.yaml", "utf8"));',
      '  const runtime = config.judgeRuntime;',
      '  const registry = await createRegistry({ judgeRuntime: runtime, runtime });',
      '  const selection = await resolveProvider({',
      '    registry, judgeRuntime: runtime, runtime, activeProviderRef: runtime.activeProviderRef,',
      '  });',
      '  const provider = selection.provider || selection.definition || selection;',
      '  const buildRequest = pickFunction(openAiAdapter, ["buildRequest"]);',
      '  const request = await buildRequest({',
      '    provider, credential: credential.credentialHandle,',
      '    body: { model: provider.model, messages: [{ role: "user", content: "installed parity" }] },',
      '    payload: { model: provider.model, messages: [{ role: "user", content: "installed parity" }] },',
      '  });',
      '  process.stdout.write(JSON.stringify({',
      '    providerRef: selection.providerRef || provider.providerRef || provider.id,',
      '    model: provider.model,',
      '    url: request.url || request.endpoint || request.operationUrl,',
      '    sourceFallbacks,',
      '  }));',
      '})().catch((error) => {',
      '  process.stderr.write(String(error && error.stack || error));',
      '  process.exitCode = 1;',
      '});',
      '',
    ].join('\n'),
    'utf8'
  );
  return probePath;
}

describe('Judge runtime installed parity', () => {
  it(
    'packs and installs registry/adapters without credentials or source fallback',
    { timeout: 600_000 },
    async () => {
      assertProductionModulesExist();
      expectSuccess(
        run(process.execPath, [BUILD_SCRIPT], {
          cwd: PACKAGE_ROOT,
          timeout: 180_000,
        }),
        'Judge runtime dist build failed'
      );

      const root = mkdtempSync(path.join(os.tmpdir(), 'judge-installed-parity-'));
      const packRoot = path.join(root, 'pack');
      const consumerRoot = path.join(root, 'consumer');
      mkdirSync(packRoot, { recursive: true });
      mkdirSync(consumerRoot, { recursive: true });
      writeJson(path.join(consumerRoot, 'package.json'), {
        name: 'judge-installed-parity-consumer',
        version: '1.0.0',
        private: true,
      });
      const fakeCredential = `installed-fixture-private-credential-${randomUUID()}`;

      try {
        const pack = expectSuccess(
          run(npmCommand, ['pack', '--ignore-scripts', '--json', '--pack-destination', packRoot], {
            cwd: PACKAGE_ROOT,
            timeout: 180_000,
          }),
          'npm pack failed'
        );
        assert.equal(pack.stdout.includes(fakeCredential), false);
        assert.equal(pack.stderr.includes(fakeCredential), false);
        const tarball = path.join(packRoot, parsePackFilename(pack.stdout));

        const extractedRoot = path.join(root, 'extracted');
        mkdirSync(extractedRoot, { recursive: true });
        expectSuccess(
          run(tarCommand, ['-xf', tarball, '-C', extractedRoot], {
            cwd: root,
            timeout: 120_000,
          }),
          'tarball extraction failed'
        );
        assertFakeCredentialExcluded(
          extractedRoot,
          fakeCredential,
          path.join(extractedRoot, '__never_allowed__')
        );

        const install = expectSuccess(
          run(
            npmCommand,
            [
              'install',
              '--ignore-scripts',
              '--no-audit',
              '--no-fund',
              '--no-package-lock',
              '--no-save',
              tarball,
            ],
            { cwd: consumerRoot }
          ),
          'npm install from packed package failed'
        );
        assert.equal(install.stdout.includes(fakeCredential), false);
        assert.equal(install.stderr.includes(fakeCredential), false);

        const installedRoot = path.join(consumerRoot, 'node_modules', 'bmad-speckit');
        assert.equal(lstatSync(installedRoot).isSymbolicLink(), false);
        for (const agent of ['cursor', 'claude-code', 'codex']) {
          const init = expectSuccess(
            run(
              process.execPath,
              [path.join(installedRoot, 'bin', 'bmad-speckit-init.js'), '--agent', agent],
              {
                cwd: consumerRoot,
                timeout: 180_000,
                env: { INIT_CWD: consumerRoot },
              }
            ),
            `installed ${agent} initialization failed`
          );
          assert.equal(init.stdout.includes(fakeCredential), false);
          assert.equal(init.stderr.includes(fakeCredential), false);
        }

        const registrySurfaces = [
          path.join(consumerRoot, '_bmad', REGISTRY_PROJECTION),
          path.join(consumerRoot, '.cursor', REGISTRY_PROJECTION),
          path.join(consumerRoot, '.claude', REGISTRY_PROJECTION),
          path.join(consumerRoot, '.codex', REGISTRY_PROJECTION),
          path.join(installedRoot, '_bmad', REGISTRY_PROJECTION),
        ];
        const registrySurfaceState = Object.fromEntries(
          registrySurfaces.map((surface) => [surface, existsSync(surface)])
        );
        for (const surface of registrySurfaces) {
          assert.equal(
            existsSync(surface),
            true,
            `registry surface missing: ${surface}\n${JSON.stringify(registrySurfaceState, null, 2)}`
          );
        }
        const canonicalRegistryHash = sha256(registrySurfaces[0]);
        for (const surface of registrySurfaces) {
          assert.equal(sha256(surface), canonicalRegistryHash);
        }
        assert.equal(
          existsSync(
            path.join(
              installedRoot,
              'dist',
              'main-agent',
              'source-authority',
              '_bmad',
              REGISTRY_PROJECTION
            )
          ),
          false,
          'installed runtime must not contain a redundant source-authority _bmad mirror'
        );

        const credentialPath = path.join(
          consumerRoot,
          '_bmad-output',
          'config',
          'private',
          'judge-provider.credentials.yaml'
        );
        mkdirSync(path.dirname(credentialPath), { recursive: true });
        writeFileSync(
          path.join(consumerRoot, 'judge-runtime.yaml'),
          yaml.dump(runtimeConfig(), { lineWidth: -1 }),
          'utf8'
        );
        writeFileSync(
          credentialPath,
          yaml.dump(
            {
              schemaVersion: 'requirements-contract-judge-credentials/v1',
              credentialRevision: 9,
              providers: {
                'provider-a': {
                  authenticationType: 'bearer',
                  apiKey: fakeCredential,
                },
              },
            },
            { lineWidth: -1 }
          ),
          'utf8'
        );

        for (const sourceFallback of [
          path.join(installedRoot, 'src'),
          path.join(installedRoot, 'tests'),
          path.join(
            installedRoot,
            'dist',
            'main-agent',
            'source-authority',
            'packages',
            'bmad-speckit',
            'src'
          ),
        ]) {
          rmSync(sourceFallback, { recursive: true, force: true });
        }

        const probePath = writeInstalledProbe(consumerRoot, installedRoot);
        const probe = expectSuccess(
          run(process.execPath, [probePath], { cwd: consumerRoot }),
          'installed Judge runtime probe failed'
        );
        assert.equal(probe.stderr, '');
        assert.equal(probe.stdout.includes(fakeCredential), false);
        const summary = JSON.parse(probe.stdout);
        assert.deepEqual(summary, {
          providerRef: 'provider-a',
          model: 'judge-model-a',
          url: 'https://installed-judge.example.test/chat/completions',
          sourceFallbacks: [],
        });

        assertFakeCredentialExcluded(consumerRoot, fakeCredential, credentialPath);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );
});
