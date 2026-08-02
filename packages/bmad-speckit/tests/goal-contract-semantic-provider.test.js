const { afterEach, describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const {
  assertNoForbiddenPartitionAuthorityArgs,
  createGoalContractSemanticProvider,
  loadGoalContractSemanticProviderRegistry,
} = require('../src/utils/goal-contract/semantic-provider-registry.ts');

const roots = [];
const hash = (value) =>
  `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
const request = () => ({
  sourceSnapshotHash: hash('source'),
  sourceObligationGraphHash: hash('graph'),
  methodologyProfileHash: hash('methodology'),
  repositoryFactsHash: hash('facts'),
  sourceSnapshot: { aggregateHash: hash('source') },
  repositoryFacts: { state: 'not_provided', facts: [] },
});
const providerScript = String.raw`
const crypto=require('node:crypto');let raw='';process.stdin.on('data',c=>raw+=c);
process.stdin.on('end',()=>{const mode=process.argv[2]||'ok';if(mode==='fail')process.exit(7);
if(mode==='invalid')return process.stdout.write('{}');const q=JSON.parse(raw);
process.stdout.write(JSON.stringify({roleContract:q.roleContract,requestHash:'sha256:'+crypto.createHash('sha256').update(raw).digest('hex'),sessionIdentity:mode==='same'?'shared':q.roleContract,result:{role:q.roleContract},providerIdentity:'local',modelIdentity:'test'}));});`;
function fixture(provider) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-semantic-provider-'));
  roots.push(root);
  const dir = path.join(root, '_bmad', 'shared', 'goal-contract');
  fs.mkdirSync(dir, { recursive: true });
  const script = path.join(root, 'provider.cjs');
  fs.writeFileSync(script, providerScript, 'utf8');
  fs.copyFileSync(path.resolve(__dirname, '../../../_bmad/shared/goal-contract/goal-contract-semantic-provider-registry.schema.json'), path.join(dir, 'goal-contract-semantic-provider-registry.schema.json'));
  const registry = {
    schemaVersion: 'goal-contract-semantic-provider-registry/v1',
    enabled: true,
    activeProviderRef: 'local',
    providers: { local: typeof provider === 'function' ? provider(script) : provider },
    roleContracts: {
      implementation_view: 'goal_contract_implementation_view/v1',
      acceptance_evidence_view: 'goal_contract_acceptance_evidence_view/v1',
    },
  };
  fs.writeFileSync(
    path.join(dir, 'goal-contract-semantic-provider-registry.json'),
    `${JSON.stringify(registry, null, 2)}\n`
  );
  return { root, registry, script };
}
async function server(status = 200) {
  const instance = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      res.writeHead(status, { 'content-type': 'application/json' });
      if (status >= 300) return res.end('failure');
      const q = JSON.parse(raw);
      res.end(JSON.stringify({ roleContract: q.roleContract, requestHash: hash(raw), sessionIdentity: q.roleContract, result: { acceptanceItems: [{}] } }));
    });
  });
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  return { instance, url: `http://127.0.0.1:${instance.address().port}` };
}
afterEach(() => roots.splice(0).forEach((root) => fs.rmSync(root, { recursive: true, force: true })));
describe('goal-contract semantic provider', () => {
  it('uses isolated process roles, trusted receipt reuse, and duplicate guards', async () => {
    const { root } = fixture((script) => ({ providerType: 'process', command: process.execPath, args: [script], credentialEnvRefs: [] }));
    const provider = createGoalContractSemanticProvider({ packageRoot: root, env: {} });
    const implementation = await provider.deriveImplementationView(request()), acceptance = await provider.deriveAcceptanceEvidenceView(request());
    assert.deepEqual([implementation.receipt.transportExitCode, implementation.receipt.methodologyProfileHash], [0, request().methodologyProfileHash]);
    assert.notEqual(implementation.receipt.sessionIdentity, acceptance.receipt.sessionIdentity);
    await assert.rejects(() => provider.deriveImplementationView(request()), (e) => e.failureClass === 'semantic_provider_duplicate_invocation');
    const receiptsDir = path.join(root, 'receipts');
    await createGoalContractSemanticProvider({ packageRoot: root, env: {}, receiptsDir }).deriveImplementationView(request());
    const reused = await createGoalContractSemanticProvider({ packageRoot: root, env: {}, receiptsDir }).deriveImplementationView(request());
    assert.equal(reused.receipt.reused, true);
    assert.deepEqual(reused.view, reused.result);
    const receiptPath = path.join(receiptsDir, fs.readdirSync(receiptsDir).find((name) => name.endsWith('.json'))), envelope = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    envelope.receipt.requestHash = hash('tampered'); fs.writeFileSync(receiptPath, JSON.stringify(envelope));
    const repaired = await createGoalContractSemanticProvider({ packageRoot: root, env: {}, receiptsDir }).deriveImplementationView(request());
    assert.equal(repaired.receipt.reused, false); assert.ok(fs.readdirSync(receiptsDir).some((name) => name.includes('.quarantine-')));
  });
  it('uses loopback HTTP and rejects non-2xx status', async (t) => {
    const ok = await server();
    const bad = await server(503);
    t.after(() => ok.instance.close());
    t.after(() => bad.instance.close());
    const { root } = fixture({ providerType: 'http', urlEnvRef: 'GOAL_PROVIDER_URL', credentialEnvRefs: [], timeoutMs: 2000 });
    const result = await createGoalContractSemanticProvider({ packageRoot: root, env: { GOAL_PROVIDER_URL: ok.url } }).deriveAcceptanceEvidenceView(request());
    assert.equal(result.receipt.transportStatus, 200);
    await assert.rejects(
      () => createGoalContractSemanticProvider({ packageRoot: root, env: { GOAL_PROVIDER_URL: bad.url } }).deriveAcceptanceEvidenceView(request()),
      (e) => e.failureClass === 'semantic_provider_http_failed'
    );
  });
  it('rejects secret, judge, unavailable, process, response, session, and authority misuse', async () => {
    const secret = fixture((script) => ({ providerType: 'process', command: process.execPath, args: [script], credentialEnvRefs: [], apiKey: 'literal' }));
    assert.throws(() => loadGoalContractSemanticProviderRegistry({ packageRoot: secret.root, env: {} }), (e) => e.failureClass === 'semantic_provider_registry_contains_secret');
    const judge = fixture((script) => ({ providerType: 'process', command: process.execPath, args: [script], credentialEnvRefs: [] }));
    judge.registry.roleContracts.implementation_view = 'requirements_contract_judge/v1';
    fs.writeFileSync(path.join(judge.root, '_bmad/shared/goal-contract/goal-contract-semantic-provider-registry.json'), JSON.stringify(judge.registry));
    assert.throws(() => loadGoalContractSemanticProviderRegistry({ packageRoot: judge.root, env: {} }), (e) => e.failureClass === 'semantic_provider_role_mismatch');
    const missing = fixture((script) => ({ providerType: 'process', command: process.execPath, args: [script], credentialEnvRefs: [] }));
    missing.registry.activeProviderRef = 'missing';
    fs.writeFileSync(path.join(missing.root, '_bmad/shared/goal-contract/goal-contract-semantic-provider-registry.json'), JSON.stringify(missing.registry));
    assert.throws(() => createGoalContractSemanticProvider({ packageRoot: missing.root, env: {} }), (e) => e.failureClass === 'semantic_provider_unavailable');
    for (const [mode, failureClass] of [['fail', 'semantic_provider_process_failed'], ['invalid', 'semantic_provider_response_invalid']]) {
      const { root } = fixture((script) => ({ providerType: 'process', command: process.execPath, args: [script, mode], credentialEnvRefs: [] }));
      await assert.rejects(() => createGoalContractSemanticProvider({ packageRoot: root, env: {} }).deriveImplementationView(request()), (e) => e.failureClass === failureClass);
    }
    const same = fixture((script) => ({ providerType: 'process', command: process.execPath, args: [script, 'same'], credentialEnvRefs: [] }));
    const provider = createGoalContractSemanticProvider({ packageRoot: same.root, env: {} });
    await provider.deriveImplementationView(request());
    await assert.rejects(() => provider.deriveAcceptanceEvidenceView(request()), (e) => e.failureClass === 'view_isolation_violation');
    assert.throws(() => assertNoForbiddenPartitionAuthorityArgs(['--semantic-response-file', 'answer.json']), (e) => e.failureClass === 'partition_authority_argument_forbidden');
  });
});
