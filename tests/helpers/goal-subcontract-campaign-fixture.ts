import fs from 'node:fs';
import path from 'node:path';
import {
  createFixture,
  git,
  hashFile,
  runScript,
} from './goal-subcontract-execution-package-fixture';

function writeJson(root: string, relativePath: string, value: unknown): string {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return target;
}

export function prepareCampaign(
  options: {
    requirementRecordBinding?: object;
    invalidSubject?: boolean;
    opaqueSubject?: boolean;
    titleOnlySubject?: boolean;
    invalidFunctionalOutcome?: boolean;
    englishLifecycleSubject?: boolean;
    englishLifecycleOutcome?: boolean;
    idImplementationSubject?: boolean;
    idImplementationOutcome?: boolean;
    narrativeFunctionalOutcome?: boolean;
    duplicateFunctionalOutcome?: boolean;
    narrativeDuplicateFunctionalOutcome?: boolean;
    caseVariantDuplicateFunctionalOutcome?: boolean;
    blankAffectedScope?: boolean;
    extraValidationTrailer?: boolean;
    mergeCommit?: boolean;
    postChildOwnedCommit?: boolean;
    postUnrelatedCommit?: boolean;
    stagedOwnedDrift?: boolean;
    worktreeOwnedDrift?: boolean;
    renameScopeEscape?: boolean;
    scopeEscape?: boolean;
  } = {}
) {
  const fixture = createFixture(options.requirementRecordBinding);
  const compiled = runScript('build-execution-package.js', [
    '--request',
    fixture.requestPath,
    '--out',
    fixture.packageA,
    '--json',
  ]);
  if (compiled.status !== 0) throw new Error(compiled.stderr || compiled.stdout);
  const compileReceipt = JSON.parse(compiled.stdout);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(fixture.packageA, 'package-manifest.json'), 'utf8')
  );
  const subjects = [
    'feat(auth): 支持访问令牌过期后自动签发新令牌',
    'fix(auth): 轮换刷新凭据后立即撤销旧令牌',
  ];
  if (options.invalidSubject) {
    subjects[0] = 'feat(auth): 实现令牌刷新与旧令牌失效';
  }
  if (options.opaqueSubject) subjects[0] = 'feat(auth): AUTH-01';
  if (options.titleOnlySubject) subjects[0] = `feat(auth): ${fixture.children[0].title}`;
  if (options.englishLifecycleSubject) {
    subjects[0] = 'feat(auth): complete AUTH-01 implementation';
  }
  if (options.idImplementationSubject) {
    subjects[0] = 'feat(auth): AUTH-01 implementation';
  }

  const childResults = fixture.children.map((child, index) => {
    let mergeSecondParent: string | undefined;
    if (options.mergeCommit && index === 0) {
      const baseBranch = git(fixture.root, ['symbolic-ref', '--short', 'HEAD']);
      const hiddenBranch = `hidden-${child.partitionId.toLowerCase()}`;
      git(fixture.root, ['switch', '--quiet', '-c', hiddenBranch]);
      git(fixture.root, [
        'commit',
        '--quiet',
        '--allow-empty',
        '-m',
        `test(${child.partitionId.toLowerCase()}): create hidden child commit`,
      ]);
      mergeSecondParent = git(fixture.root, ['rev-parse', 'HEAD']);
      git(fixture.root, ['switch', '--quiet', baseBranch]);
    }
    const evidenceRelative = `campaign-evidence/${child.partitionId}-evidence.json`;
    const closureRelative = `campaign-evidence/${child.partitionId}-closure.json`;
    const evidencePath = writeJson(fixture.root, evidenceRelative, {
      partitionId: child.partitionId,
      decision: 'pass',
    });
    const closurePath = writeJson(fixture.root, closureRelative, {
      partitionId: child.partitionId,
      childContractHash: child.hash,
      decision: 'pass',
    });
    const evidenceHash = hashFile(evidencePath);
    const closureHash = hashFile(closurePath);
    let stagedPaths: string[];
    if (options.renameScopeEscape && index === 0) {
      fs.rmSync(path.join(fixture.root, child.ownedPath));
      fs.renameSync(
        path.join(fixture.root, fixture.unownedPath),
        path.join(fixture.root, child.ownedPath)
      );
      stagedPaths = [child.ownedPath, fixture.unownedPath];
    } else {
      fs.appendFileSync(
        path.join(fixture.root, child.ownedPath),
        `export const closed = '${child.partitionId}';\n`,
        'utf8'
      );
      stagedPaths = [child.ownedPath];
    }
    const changedPaths = [child.ownedPath];
    if (options.scopeEscape && index === 0) {
      const unownedPath = 'src/shared/campaign-leak.ts';
      writeJson(fixture.root, unownedPath, { leakedBy: child.partitionId });
      changedPaths.push(unownedPath);
      stagedPaths.push(unownedPath);
    }
    const functionalOutcome =
      options.invalidFunctionalOutcome && index === 0
        ? '完成 AUTH-01'
        : options.englishLifecycleOutcome && index === 0
          ? 'completed AUTH-01 implementation work'
          : options.idImplementationOutcome && index === 0
            ? 'AUTH-01 implementation work'
            : index === 0
              ? '访问令牌过期时自动签发新的访问令牌和刷新令牌'
              : '刷新凭据轮换后立即撤销旧刷新令牌';
    const functionalOutcomeLines =
      options.duplicateFunctionalOutcome && index === 0
        ? [`Functional-Outcome: ${functionalOutcome}`, 'Functional-Outcome: 冲突的重复功能结果']
        : [`Functional-Outcome: ${functionalOutcome}`];
    const body = [
      ...(options.narrativeDuplicateFunctionalOutcome && index === 0
        ? [
            'Functional-Outcome: 叙述区域中的伪功能结果',
            'This narrative separates the pseudo trailer from the terminal trailer block.',
            '',
          ]
        : []),
      ...functionalOutcomeLines,
      ...(options.caseVariantDuplicateFunctionalOutcome && index === 0
        ? ['functional-outcome: 大小写变体中的冲突功能结果']
        : []),
      ...(options.narrativeFunctionalOutcome && index === 0
        ? ['This narrative line separates the value from the trailer block.', '']
        : []),
      `Affected-Scope: ${
        options.blankAffectedScope && index === 0 ? '' : 'authentication refresh flow'
      }`,
      `Child-Contract: ${child.partitionId}`,
      `Contract-Hash: ${child.hash}`,
      `Evidence: ${evidenceRelative}#${evidenceHash}`,
      `Validation: CMD-${child.partitionId}${
        options.extraValidationTrailer && index === 0 ? ', CMD-UNBOUND' : ''
      }`,
    ].join('\n');
    if (options.mergeCommit && index === 0) {
      git(fixture.root, ['add', '--', ...stagedPaths]);
      const treeHash = git(fixture.root, ['write-tree']);
      const firstParent = git(fixture.root, ['rev-parse', 'HEAD']);
      const messageRelative = `.merge-message-${child.partitionId}.txt`;
      fs.writeFileSync(
        path.join(fixture.root, messageRelative),
        `${subjects[index]}\n\n${body}\n`,
        'utf8'
      );
      const mergeHash = git(fixture.root, [
        'commit-tree',
        treeHash,
        '-p',
        firstParent,
        '-p',
        mergeSecondParent!,
        '-F',
        messageRelative,
      ]);
      git(fixture.root, ['update-ref', 'HEAD', mergeHash]);
    } else {
      git(fixture.root, ['add', '--', ...stagedPaths]);
      git(fixture.root, ['commit', '--quiet', '-m', subjects[index], '-m', body]);
    }
    const commitHash = git(fixture.root, ['rev-parse', 'HEAD']);
    return {
      partitionId: child.partitionId,
      status: 'closed',
      contractHash: child.hash,
      evidence: { path: evidenceRelative, hash: evidenceHash },
      closure: { path: closureRelative, hash: closureHash },
      validationResults: [
        {
          id: `CMD-${child.partitionId}`,
          status: 'pass',
          evidence: { path: evidenceRelative, hash: evidenceHash },
        },
      ],
      commit: {
        hash: commitHash,
        parentHash: git(fixture.root, ['rev-parse', `${commitHash}^`]),
        treeHash: git(fixture.root, ['rev-parse', `${commitHash}^{tree}`]),
        subject: subjects[index],
        changedPaths,
      },
    };
  });
  if (options.postChildOwnedCommit) {
    fs.appendFileSync(
      path.join(fixture.root, fixture.children[0].ownedPath),
      "export const postClosureCommit = 'drift';\n",
      'utf8'
    );
    git(fixture.root, ['add', '--', fixture.children[0].ownedPath]);
    git(fixture.root, [
      'commit',
      '--quiet',
      '-m',
      'test(auth): mutate closed child ownership after audit chain',
    ]);
  }
  if (options.postUnrelatedCommit) {
    writeJson(fixture.root, 'src/shared/post-campaign.ts', { unrelated: true });
    git(fixture.root, ['add', '--', 'src/shared/post-campaign.ts']);
    git(fixture.root, [
      'commit',
      '--quiet',
      '-m',
      'test(shared): add unrelated post-campaign change',
    ]);
  }
  if (options.stagedOwnedDrift) {
    fs.appendFileSync(
      path.join(fixture.root, fixture.children[0].ownedPath),
      "export const stagedDrift = 'staged';\n",
      'utf8'
    );
    git(fixture.root, ['add', '--', fixture.children[0].ownedPath]);
  }
  if (options.worktreeOwnedDrift) {
    fs.appendFileSync(
      path.join(fixture.root, fixture.children[0].ownedPath),
      "export const worktreeDrift = 'unstaged';\n",
      'utf8'
    );
  }
  const collectionPath = writeJson(fixture.root, 'campaign-evidence/collection.json', {
    decision: 'pass',
  });
  const artifacts = {
    schemaVersion: 'goal-subcontract-completed-campaign-artifacts/v1',
    packageId: manifest.packageId,
    packageManifestHash: manifest.packageManifestHash,
    childResults,
    collectionVerificationResults: [
      {
        id: 'CMD-COLLECTION',
        status: 'pass',
        evidence: {
          path: 'campaign-evidence/collection.json',
          hash: hashFile(collectionPath),
        },
      },
    ],
    openObligations: [],
    drift: [],
    retries: [],
    scopeChanges: [],
    blockers: [],
  };
  const artifactsPath = writeJson(fixture.root, 'campaign-artifacts.json', artifacts);
  return {
    ...fixture,
    packageManifestHash: compileReceipt.packageManifestHash,
    artifactsPath,
    finalOut: path.join(fixture.root, 'final'),
  };
}
