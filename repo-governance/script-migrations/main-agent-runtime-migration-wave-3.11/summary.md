# Main Agent Runtime Migration Wave 3.11 Summary

Generated: 2026-06-06T02:25:34.577Z

Wave 3.11 covers only the thirteen declared entries in `source-inventory.json`.
No root script deletion was performed.
This summary does not prove every source repository script is directly callable in a consumer project.

## Migrated Or Consumer-Reachable Entries

- scripts/host-runtime-mode.ts -> packages/bmad-speckit/src/main-agent/runtime/host-runtime-mode.ts, packages/bmad-speckit/dist/main-agent/runtime/host-runtime-mode.js (package_runtime_module)
- scripts/supervised-worker-runtime.ts -> packages/bmad-speckit/src/main-agent/runtime/supervised-worker-runtime.ts, packages/bmad-speckit/dist/main-agent/runtime/supervised-worker-runtime.js (package_runtime_module)
- scripts/diagnose-bmad-state.ts -> packages/bmad-speckit/src/main-agent/runtime/diagnose-bmad-state.ts, packages/bmad-speckit/dist/main-agent/runtime/diagnose-bmad-state.js (package_runtime_module)
- scripts/parallel-mission-control.ts -> packages/bmad-speckit/src/main-agent/runtime/parallel-mission-control.ts, packages/bmad-speckit/dist/main-agent/runtime/parallel-mission-control.js (package_runtime_module)
- scripts/bmad-state-reader.ts -> packages/bmad-speckit/src/main-agent/helpers/bmad-state-reader.ts, packages/bmad-speckit/dist/main-agent/helpers/bmad-state-reader.js (durable_helper_copy)
- scripts/e2e-verify-paths.ts -> packages/bmad-speckit/src/main-agent/helpers/e2e-verify-paths.ts, packages/bmad-speckit/dist/main-agent/helpers/e2e-verify-paths.js (durable_helper_copy)
- scripts/query-validate.ts -> packages/bmad-speckit/src/main-agent/helpers/query-validate.ts, packages/bmad-speckit/dist/main-agent/helpers/query-validate.js (durable_helper_copy)
- scripts/runtime-step-state.ts -> packages/bmad-speckit/src/main-agent/helpers/runtime-step-state.ts, packages/bmad-speckit/dist/main-agent/helpers/runtime-step-state.js (durable_helper_copy)
- scripts/verify-agent-files.ts -> packages/bmad-speckit/src/main-agent/helpers/verify-agent-files.ts, packages/bmad-speckit/dist/main-agent/helpers/verify-agent-files.js (durable_helper_copy)
- scripts/eval-question-generate.ts -> packages/bmad-speckit/bin/bmad-speckit.js, packages/bmad-speckit/src/commands/eval-question-generate.ts (public_cli_de_surface)
- scripts/check-story-score-written.ts -> packages/bmad-speckit/bin/bmad-speckit.js, packages/bmad-speckit/src/commands/check-score.ts (public_cli_de_surface)

## True No-Migration Entries Within This Contract Inventory

- scripts/create-second-story.ts retained as repo_internal_test_seed_only
- scripts/verify-score-auto-scoped-bundle.cjs retained as repo_internal_verification_harness

## Recorded Validation Commands

- cmd-git-status-baseline: passed (exitCode 0, stdout sha256:b9c6dfee7344ef94d70ad382e8a7090339fbb12ad88ba05bbc3c4750a2c3989a, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-encoding-pre-implementation: passed (exitCode 0, stdout sha256:95f01b2c1cc4ffc06efb93fe2085a8d1de849fa2b67761560514bce7dbc6e21b, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-build-scoring: passed (exitCode 0, stdout sha256:7ffa27e41ff329b070e79591c10027aef3cdc08cfcc2626460d8786c30755ce2, stderr sha256:90fc28f6bd33d26e19b320f3e1c8781df0d9ec06f90743cc856077cd7ed7c353)
- cmd-test-scoring-eval-questions: passed (exitCode 0, stdout sha256:e5014dff7e560c6545da313623859809731d366f59c26d22630e1a4970fe5c23, stderr sha256:74a52d1402c071e2fdf4dd86e04665ebb52c5aed54ca31ac1662edf49fddc11e)
- cmd-build-main-agent-dist: passed (exitCode 0, stdout sha256:34a81a86c03b093fe182fc734c0198bf48dc270d534bc907a04ab597f6fcf9e5, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-package-build-dispatch-regressions: passed (exitCode 0, stdout sha256:85b243db1086d9184feff9903a099eca374a84ec4acff20ef106c2ed7e5a2a0c, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-runtime-modules: passed (exitCode 0, stdout sha256:9f0e7ad4e2b2168805d94348114fb60d99e61caeaeaab009eaa9e402363f0aa3, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-helpers: passed (exitCode 0, stdout sha256:b7acff75dcf88e878d15d60a5831450e10975c2d0722128b366f65bb4e02527a, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-eval-question-generate: passed (exitCode 0, stdout sha256:90ca31cfde438ecccf189e28de5c4767131deb82a8fab0a51df4d10bdd09de69, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-check-score: passed (exitCode 0, stdout sha256:d1ec33e12627aed18a3f0cae9bb8049705487ba4ba66cb2fbbb092e5da94111d, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-smoke-eval-question-generate-source-tree: passed (exitCode 0, stdout sha256:cc6ea62ef3c5f109b4796305eff6096dcbe3d00ec52f949ee0a20d9e02c6c42f, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-runtime-acceptance-import-switches: passed (exitCode 0, stdout sha256:64c620adef4983f7381425b7005e1e619624cb2e5d245df5b38b5bd0c6f05f80, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-closure-audit-write: passed (exitCode 0, stdout sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-validate-registry: passed (exitCode 0, stdout sha256:03e86d3a93b78396c78137de46ac5ecd960049e7c9b3b3792b5ac8b7abe51970, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-assert-no-migration-internal-exact: passed (exitCode 0, stdout sha256:8a38da60a915c7f2e1de9f1860f24501cf66410f44d3700326ec283d6a8d5c80, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-assert-root-scripts-not-deleted: passed (exitCode 0, stdout sha256:a95008243d2c1439fcecd1e591ca9288b2f98507974d5fc06702428c13777141, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-assert-public-cli-dispatch: passed (exitCode 0, stdout sha256:077449378dc12ae7e6f41102453bd4f13695741a226d59f0431c8ba72e7aeba2, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-assert-closure-audit-exact-wave-3-11: passed (exitCode 0, stdout sha256:8232e82cbd26c815cdee74ac0b4934308de3d652d8d69dac5744ba49016978a3, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-validate-wave-3-11-pre-evidence: failed (exitCode 1, stdout sha256:fe642b2109f07fce0512ea07579102348a5d394e1281d717a77e4ca04dc1cea7, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-validate-wave-3-11-pre-evidence: passed (exitCode 0, stdout sha256:235cd5300e488f17716c4e3d2a9459f7f7eeb19e64f9ef4ca68e7982c26f6bbb, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-wave-3-11-contract-pre-evidence: passed (exitCode 0, stdout sha256:982f1a0ff37e598d7952191c41ae03ebe620871a77d90e59f2347fce58784aa0, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-test-install-surface-regressions: passed (exitCode 0, stdout sha256:d83af41bd1bfa2e9feb6f36b45d6a365fbf685b842b2423c0c86873c11f8c2d3, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-run-install-matrix: passed (exitCode 0, stdout sha256:970c16e3f309c8d86d145b007c0bd94378f30c3ac7c29fd8122e08c993e433e8, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-validate-wave-3-11-evidence-running: failed (exitCode 1, stdout sha256:c4eab9afde2d582496ec150288a2373e02e8b587bc19a6329f995a37dfee6736, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)
- cmd-validate-wave-3-11-evidence-running: passed (exitCode 0, stdout sha256:f38e9b00da1257c3034f72780774c487d0918cc44ea1d0b56a2ca8ea0b1faad9, stderr sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855)

## Planned Final Closeout Commands

- cmd-assert-final-closeout-language: pending at summary seal time
- cmd-encoding-final: pending at summary seal time
- cmd-test-wave-3-11-contract-final: pending at summary seal time
- cmd-validate-wave-3-11-final: pending at summary seal time

## Residual Risks

- Final acceptance and final validator rows are recorded after packet sealing; sealed artifacts keep ACC013 and ACC014 self-excluded by design.
