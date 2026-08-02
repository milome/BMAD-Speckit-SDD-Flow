import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { createRequirementsContractSixModelConsumerInventory } from '../rules/requirements-contract-consumer-registry';
import { canonicalJson, fileHash, sha256, slash } from './requirements-contract-governed-write';

type JsonRecord = Record<string, ReturnType<typeof JSON.parse>>;

const largeDocumentWriter = require('../../../utils/large-document-writer') as {
  safeWriteJson(
    targetPath: string,
    value: unknown,
    options: { mode: 'create' | 'replace' | 'upsert' }
  ): JsonRecord;
};

interface ControlledCommand {
  commandId: string;
  fixtureOnly: boolean;
}

export interface RequirementsContractProductionActivateOptions {
  cwd?: string;
  requirementRecord: string;
  registry: string;
  activationPlanDir: string;
  activationPlanWriteReceiptDir: string;
  successReceipt: string;
  blockedAttemptDir: string;
  json?: boolean;
}

export const REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_ACTION_ID =
  'requirements-contract-production-activate';
export const REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-production-activate.ts';
export const REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_DIST_PATH =
  'packages/bmad-speckit/dist/main-agent/source-authority/scripts/requirements-contract-production-activate.js';
export const REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_CLI_PATH =
  'packages/bmad-speckit/bin/bmad-speckit.js';
export const REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_OWNER_PATH =
  'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-production-activation-receipt.schema.json';
export const REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_SURFACE_PATHS = [
  REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_OWNER_PATH,
  'packages/bmad-speckit/dist/main-agent/source-authority/schemas/requirements-contract-production-activation-receipt.schema.json',
] as const;

const CONTRACT_PATH =
  'docs/plans/2026-07-18-loop-engineering-evidence-closure-remediation-amend13-goal-execution-plan.md';
const CONTRACT_SHA256 = 'sha256:38d6301646351efb04dff330ac05b3bf5daa667ef31f1630f0b68031cddda90a';
const PACKAGED_COMMAND_TEXT_BASE64 = [
  'bnB4IHZpdGVzdCBydW4gdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZ29sZC10ZW1wbGF0ZS1yZW5kZXIudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1hdXRob3Jpbmctc2tpbGwtY29udHJhY3QudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcS10cmFjZS1jb25maXJtYXRpb24tYmxvY2stZ2VuZXJhdG9yLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZ3JpbGwtcHJvdG9jb2wudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1ncmlsbC1zZXNzaW9uLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZGVjaXNpb24tcmVjZWlwdC50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWNvbmZpcm1hdGlvbi1yZW5kZXItaW5wdXQudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1ibWFkLWNyZWF0ZS1wcmQtY29uc3VtZXIudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1hZHZhbmNlZC1lbGljaXRhdGlvbi1jb25zdW1lci50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWNvZGV4LWNsaS1kaXNjb3ZlcnktZmxvdy50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWNhbm9uaWNhbC1yZW5kZXItd3JpdGUtc2VhbS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXNlcXVlbmNlLWNvbXBpbGVyLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZGlhZ3JhbS1zZXQtcGxhbm5lci50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXNlcXVlbmNlLW1lcm1haWQtcHJvamVjdGlvbi50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWltcGxlbWVudGF0aW9uLXRhc2stZGFnLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtY29uZmlybWF0aW9uLWludGVyYWN0aW9uLWxheW91dC50ZXN0LnRzIHBhY2thZ2VzL2JtYWQtc3BlY2tpdC9zcmMvbWFpbi1hZ2VudC9zb3VyY2UtYXV0aG9yaXR5L3Rlc3RzL3JlcXVpcmVtZW50cy1jb250cmFjdC1zb3VyY2UtdGVtcGxhdGUudGVzdC50cyBwYWNrYWdlcy9ibWFkLXNwZWNraXQvc3JjL21haW4tYWdlbnQvc291cmNlLWF1dGhvcml0eS90ZXN0cy9yZXF1aXJlbWVudHMtY29udHJhY3Qtc291cmNlLXByZC1ydWxlLXBhcml0eS50ZXN0LnRzIHBhY2thZ2VzL2JtYWQtc3BlY2tpdC9zcmMvbWFpbi1hZ2VudC9zb3VyY2UtYXV0aG9yaXR5L3Rlc3RzL3JlcXVpcmVtZW50cy1jb250cmFjdC1zb3VyY2UtcHJkLWluc3RhbmNlLWxpbnQudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1ub3JtYWxpemVkLXBhY2thZ2UtcmVuZGVyLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtYnVzaW5lc3MtYmVoYXZpb3ItZGVsdGEudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1pbXBsZW1lbnRhdGlvbi1pbXBhY3QtbWFwLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtY29tcGFjdC10cmFjZS1tYXRyaXgtcHJvamVjdGlvbi50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXJ1bnRpbWUtYnVuZGxlLWF0b21pYy13cml0ZS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWJ1bmRsZS1wdWJsaXNoLWNvbW1hbmQudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1idW5kbGUtcHVibGlzaC1pbnN0YWxsZWQtY2xpLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtYW1lbmRtZW50LXNhZmUtd3JpdGUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50LXJlY29yZC1zY2hlbWEudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1sYXJnZS1kb2Mtd3JpdGUtZmxvdy50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWFydGlmYWN0LXJvbGUtY2xhc3NpZmllci50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWludGFrZS1yZWNlaXB0LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtaW50ZW50LWxpbmVhZ2UudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1zZW1hbnRpYy1jb25zZXJ2YXRpb24tbWFuaWZlc3QudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1yZW5kZXItcm91bmR0cmlwLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZGlzY292ZXJ5LWVudmVsb3BlLXRlbXBsYXRlLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZW50cnktc291cmNlLXNlc3Npb24udGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL2JtYWQtY3JlYXRlLXByZC1zb3VyY2UtcHJkLWxpbnQudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3NvdXJjZS1wcmQtaW5zdGFuY2UtdG8tY29uZmlybWF0aW9uLWh0bWwudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3NvdXJjZS1wcmQtYXV0aG9yaW5nLWVudHJ5LXNvdXJjZS1saW50LnRlc3QudHM=',
  'cHdzaC5leGUgLU5vTG9nbyAtTm9Qcm9maWxlIC1Db21tYW5kICcmIHsgbnB4IHZpdGVzdCBydW4gdGVzdHMvYWNjZXB0YW5jZS9nb2FsLWNvbnRyYWN0LXByb2ZpbGUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcS10cmFjZS1nb2FsLWNvbnRyYWN0LXByb2ZpbGUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1pZC1uYW1lc3BhY2Utc3luYy50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXN1cmZhY2UtcGFyaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtY2Fub25pY2FsLWFzc2V0cy1tYW5pZmVzdC50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWNvbnN1bWVyLXJlZ2lzdHJ5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtdmFsaWRhdGlvbi1mYWNhZGUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1kaXJlY3QtcGFyc2VyLWJ5cGFzcy50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXBsYW5uaW5nLWFydGlmYWN0LXJlc29sdmVyLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVxdWlyZW1lbnQtc291cmNlLXJlZ2lzdHJ5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtYm1hZC1jb25zdW1lci1yZWdpc3RyeS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWxlZ2FjeS1wcmQtbWlncmF0aW9uLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcHJvamVjdC1wcm9maWxlLW1hbmlmZXN0LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZGlhZ3JhbS1wb2xpY3ktcmVnaXN0cnkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1pbnRlcmFjdGlvbi1zdXJmYWNlLXBhcml0eS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvYWNjZXB0LWluc3RhbGwtY29uc3VtZXItY2xpLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVhZC1mYWNhZGUtY29uc3VtZXItcmVnaXN0cnkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1ub3JtYWxpemVkLXBhY2thZ2Utc3VyZmFjZS1wYXJpdHkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1wcm9kdWN0aW9uLWFjdGl2YXRpb24tcmVjZWlwdC1zdXJmYWNlLXBhcml0eS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnQtcmVjb3JkLWxpdmUtc2NoZW1hLXN1cmZhY2UtcGFyaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVhZC1mYWNhZGUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1yZWFkLWFkYXB0ZXItcGFyaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtdjEtcmVhZC1lbGlnaWJpbGl0eS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWRpcmVjdC1jb25maXJtYXRpb24tcmVhZC1ieXBhc3MudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1zdHJ1Y3R1cmVkLXNvdXJjZS1leHRyYWN0aW9uLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3Qtc291cmNlLXByZC1wYXJzZXItYWR2ZXJzYXJpYWwudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1saW50LXByb2ZpbGUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1wcm9qZWN0LXByb2ZpbGUtcmVzb2x2ZXIudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1kaWFncmFtLWFwcGxpY2FiaWxpdHkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1kZXBsb3ltZW50LWRlbHRhLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZGlhZ3JhbS12YWxpZGF0aW9uLWZhY2FkZS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXRyYWNlLWVkZ2UtdHlwZS1yZWdpc3RyeS1zdXJmYWNlLXBhcml0eS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWFtZW5kMDUtc2FmZS13cml0ZS10YXJnZXQtcmVnaXN0cnktc3VyZmFjZS1wYXJpdHkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC12MS1sZWdhY3ktaW52ZW50b3J5LWZyZWV6ZS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXYxLWxlZ2FjeS1pbnZlbnRvcnktbXV0YXRpb24tcmVqZWN0aW9uLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtdGVybWluYWwtY29tbWFuZC1zdXBlcnZpc29yLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtdGVybWluYWwtY29tbWFuZC1zdXBlcnZpc29yLWluc3RhbGxlZC1jbGkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1maW5hbGl6YXRpb24tc2FmZS13cml0ZXIudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1maW5hbGl6YXRpb24tc3RhZ2luZy1ib3VuZGFyeS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWZpbmFsaXphdGlvbi1mYWlsdXJlLWFyY2hpdmUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1maW5hbGl6YXRpb24tc2FmZS13cml0ZXItc3VyZmFjZS1wYXJpdHkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1maW5hbGl6YXRpb24tc2FmZS13cml0ZXItaW5zdGFsbGVkLWNsaS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWFydGlmYWN0LXJvbGUtcmVnaXN0cnktc3VyZmFjZS1wYXJpdHkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1saW50LXByb2ZpbGUtcmVnaXN0cnktc3VyZmFjZS1wYXJpdHkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1zb3VyY2UtcHJkLXRlbXBsYXRlLXByb2ZpbGUudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1zb3VyY2UtcHJkLXN1cmZhY2UtcGFyaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZGlzY292ZXJ5LWVudmVsb3BlLXN1cmZhY2UtcGFyaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtanVkZ2UtY3JlZGVudGlhbC1yZXNvbHZlci50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWp1ZGdlLXByb3ZpZGVyLXJlZ2lzdHJ5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtanVkZ2UtYWRhcHRlci1zdXJmYWNlLXBhcml0eS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXJlY292ZXJ5LWNvbW1hbmQtaWRlbnRpdHktYXV0aG9yaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVjb3ZlcnktZmluYWxpemF0aW9uLXN1cmZhY2UtcGFyaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVjb3ZlcnktZmluYWxpemF0aW9uLWluc3RhbGxlZC1jbGkudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1wYWNrYWdlLXJ1bnRpbWUtYWN0aW9uLWJpbmRpbmcudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1wYWNrYWdlLXJ1bnRpbWUtYWN0aW9uLWJpbmRpbmctc3VyZmFjZS1wYXJpdHkudGVzdC50czsgaWYgKCRMQVNURVhJVENPREUgLW5lIDApIHsgZXhpdCAkTEFTVEVYSVRDT0RFIH07IG5vZGUgLS10ZXN0IHBhY2thZ2VzL2JtYWQtc3BlY2tpdC90ZXN0cy9tYWluLWFnZW50LWJ1aWxkLWRpc3QudGVzdC5qcyBwYWNrYWdlcy9ibWFkLXNwZWNraXQvdGVzdHMvanVkZ2UtcnVudGltZS1pbnN0YWxsZWQtcGFyaXR5LnRlc3QuanM7IGlmICgkTEFTVEVYSVRDT0RFIC1uZSAwKSB7IGV4aXQgJExBU1RFWElUQ09ERSB9OyBub2RlIF9ibWFkL3NoYXJlZC9nb2FsLWNvbnRyYWN0L3NjcmlwdHMvdmVyaWZ5LWdvYWwtY29udHJhY3QtcHJvZmlsZS5qczsgaWYgKCRMQVNURVhJVENPREUgLW5lIDApIHsgZXhpdCAkTEFTVEVYSVRDT0RFIH0gfSc=',
  'cHdzaC5leGUgLU5vTG9nbyAtTm9Qcm9maWxlIC1Db21tYW5kICcmIHsgbnB4IHZpdGVzdCBydW4gdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3Qtbm9ybWFsaXplZC1wYWNrYWdlLWdvbGRlbi1jb3JwdXMudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1zaGFkb3ctZ3JhcGgtcGFyaXR5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3Qtbm9ybWFsaXplZC1wYWNrYWdlLXNjYWxlLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29uZmlybWF0aW9uLWluZ2VzdC1zY2FsZS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LW5vcm1hbGl6ZWQtcGFja2FnZS1jcm9zcy1wcm9kdWN0LXN0YXRpYy1hdWRpdC50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWVudHJ5LXNvdXJjZS1jb25zZXJ2YXRpb24tZXZhbC50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXNvdXJjZS1yb290LW9taXNzaW9uLWV2YWwudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1saW50LXByb2ZpbGUtbXV0YXRpb24tZXZhbC50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXNvdXJjZS1wcmQtc3VyZmFjZS1ldmFsLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVjb3ZlcnktZmluYWxpemF0aW9uLWNyYXNoLXJlY292ZXJ5LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVjb3ZlcnktZmluYWxpemF0aW9uLXJlcGxheS1ieXBhc3MudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1yZWNvdmVyeS1jb21tYW5kLWlkZW50aXR5LWF1dGhvcml0eS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXN0YWdlLWZpdmUtc3Rhci1hdWRpdC1hcmNoaXRlY3R1cmUtd2F2ZS1nYXRlLnRlc3QudHM7IGlmICgkTEFTVEVYSVRDT0RFIC1uZSAwKSB7IGV4aXQgJExBU1RFWElUQ09ERSB9OyBub2RlIHBhY2thZ2VzL2JtYWQtc3BlY2tpdC9iaW4vYm1hZC1zcGVja2l0LmpzIHJlcXVpcmVtZW50cy1jb250cmFjdC1ldmFsIC0tY29ycHVzIHRlc3RzL2FjY2VwdGFuY2UvZml4dHVyZXMvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWV2YWx1YXRpb24vY29ycHVzLmpzb24gLS1vdXQgZG9jcy9wbGFucy9ldmlkZW5jZS9sb29wLWVuZ2luZWVyaW5nLXJlbWVkaWF0aW9uL3JlcXVpcmVtZW50cy1jb250cmFjdC1ldmFsdWF0aW9uLXJlcG9ydC5qc29uIC0tanNvbjsgaWYgKCRMQVNURVhJVENPREUgLW5lIDApIHsgZXhpdCAkTEFTVEVYSVRDT0RFIH0gfSc=',
  'cHdzaC5leGUgLU5vTG9nbyAtTm9Qcm9maWxlIC1Db21tYW5kICcmIHsgbnB4IHZpdGVzdCBydW4gdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcmVhZC1mYWNhZGUtcHJvZHVjdGlvbi1taWdyYXRpb24udGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC12MS1vdXRwdXQtaGFyZC1jdXQudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1wcm9kdWN0aW9uLWNvbnN1bWVyLWludmVudG9yeS50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXByb2R1Y3Rpb24tYWN0aXZhdGlvbi50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LXByb2R1Y3Rpb24tYWN0aXZhdGlvbi1wbGFuLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcHJvZHVjdGlvbi1hY3RpdmF0ZS1jb21tYW5kLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtcHJvZHVjdGlvbi1hY3RpdmF0ZS1pbnN0YWxsZWQtY2xpLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtaW50YWtlLXByb21vdGlvbi50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvcmVxdWlyZW1lbnRzLWNvbnRyYWN0LWNoZWNrcG9pbnQtbWFpbi1sYW5lLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9yZXF1aXJlbWVudHMtY29udHJhY3QtZXZpZGVuY2UtdmVyaWZ5LWNvbW1hbmQudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1pbnRlcmFjdGlvbi1jb25zdW1lci1taWdyYXRpb24udGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL2FpLXRkZC1jb250cmFjdC1nYXRlLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9ydW4tcmVxdWlyZWQtY29tbWFuZHMtZnJvbS1haS10ZGQtbWFuaWZlc3QudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL21haW4tYWdlbnQtZnVuY3Rpb25hbC1yZXN1bWUtY2hlY2sudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JldmVyc2UtYXVkaXQtY29udHJhY3QudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL2dlbmVyYXRlLWFyY2hpdGVjdHVyZS1jb25maXJtYXRpb24tYXJ0aWZhY3QudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlbmRlci1hcmNoaXRlY3R1cmUtY29uZmlybWF0aW9uLWh0bWwudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3ByZXBhcmUtYXJjaGl0ZWN0dXJlLWNvbmZpcm1hdGlvbi1wYWdlLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9ibWFkLWNyZWF0ZS1wcmQtc291cmNlLXByZC1saW50LnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9zb3VyY2UtcHJkLWluc3RhbmNlLXRvLWNvbmZpcm1hdGlvbi1odG1sLnRlc3QudHMgdGVzdHMvYWNjZXB0YW5jZS9zb3VyY2UtcHJkLWF1dGhvcmluZy1lbnRyeS1zb3VyY2UtbGludC50ZXN0LnRzIHRlc3RzL2FjY2VwdGFuY2UvbWFpbi1hZ2VudC1ibWFkLWFydGlmYWN0LWhhcmRjdXQudGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1lbnRyeS1zb3VyY2UtcHJvZHVjdGlvbi1taWdyYXRpb24udGVzdC50cyB0ZXN0cy9hY2NlcHRhbmNlL3JlcXVpcmVtZW50cy1jb250cmFjdC1wb3N0LWN1dG92ZXItdjEtc291cmNlLXByZC1vdXRwdXQudGVzdC50czsgaWYgKCRMQVNURVhJVENPREUgLW5lIDApIHsgZXhpdCAkTEFTVEVYSVRDT0RFIH07IG5wbSBydW4gdGVzdDpjb25zdW1lci1ydW50aW1lLWZpbmFsOyBpZiAoJExBU1RFWElUQ09ERSAtbmUgMCkgeyBleGl0ICRMQVNURVhJVENPREUgfSB9Jw==',
] as const;
const PACKAGED_COMMAND_ARGV_HASHES = [
  'sha256:be8d1023f85ca4896a5afd5ddcadbf4727a692bcf1333325e7e81e938966fee7',
  'sha256:2e2f1acca90ae7dc9cdde9216deaaf4147ca9e91d771e2a8dae14746b90fbdf8',
  'sha256:4a2f774c965628a78a45e4aa296ee30c9babd801161f47b3f0c8a3fdaf31c392',
  'sha256:e66312385762855ca5ec0965cfa226b421fff8472b2f48ca45e2466314a80dee',
] as const;
const REGISTRY_PATH =
  '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json';
const LOCK_PATH =
  '_bmad/shared/requirements-contract/.requirements-contract-consumer-registry.activation.lock';

function resolveWithin(root: string, value: string): string {
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`production_activate_path_escape:${value}`);
  }
  return resolved;
}

function parseJsonObject(text: string, label: string): JsonRecord {
  const value = JSON.parse(text) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`production_activate_json_object_required:${slash(label)}`);
  }
  return value as JsonRecord;
}

function readJson(filePath: string): JsonRecord {
  return parseJsonObject(fs.readFileSync(filePath, 'utf8'), filePath);
}

export function resolveRequirementsContractProductionActivationReceiptSchemaPath(): string {
  const candidates = [
    path.resolve(
      __dirname,
      '..',
      'schemas',
      'requirements-contract-production-activation-receipt.schema.json'
    ),
    ...REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATION_RECEIPT_SCHEMA_SURFACE_PATHS.map((surfacePath) =>
      path.resolve(process.cwd(), surfacePath)
    ),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export function resolveRequirementsContractProductionActivateCliPath(root = process.cwd()): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', '..', '..', 'bin', 'bmad-speckit.js'),
    path.resolve(root, REQUIREMENTS_CONTRACT_PRODUCTION_ACTIVATE_CLI_PATH),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

function controlledCommands(): ControlledCommand[] {
  const schema = readJson(
    path.resolve(
      __dirname,
      '..',
      'schemas',
      'requirements-contract-production-activate-input.schema.json'
    )
  );
  const commands = schema.properties?.controlledCommands?.const;
  if (
    !Array.isArray(commands) ||
    commands.some(
      (command) =>
        !command ||
        typeof command !== 'object' ||
        typeof command.commandId !== 'string' ||
        typeof command.fixtureOnly !== 'boolean'
    )
  ) {
    throw new Error('production_activate_controlled_commands_invalid');
  }
  return commands.map((command) => ({
    commandId: command.commandId,
    fixtureOnly: command.fixtureOnly,
  }));
}

function uuidv7(): string {
  const bytes = randomBytes(16);
  const milliseconds = BigInt(Date.now());
  bytes[0] = Number((milliseconds >> 40n) & 0xffn);
  bytes[1] = Number((milliseconds >> 32n) & 0xffn);
  bytes[2] = Number((milliseconds >> 24n) & 0xffn);
  bytes[3] = Number((milliseconds >> 16n) & 0xffn);
  bytes[4] = Number((milliseconds >> 8n) & 0xffn);
  bytes[5] = Number(milliseconds & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20
  )}-${hex.slice(20)}`;
}

function validate(value: JsonRecord, schemaName: string, label: string): void {
  const schemaPath =
    schemaName === 'requirements-contract-production-activation-receipt.schema.json'
      ? resolveRequirementsContractProductionActivationReceiptSchemaPath()
      : path.resolve(__dirname, '..', 'schemas', schemaName);
  const validator = new Ajv2020({ allErrors: true, strict: false }).compile(readJson(schemaPath));
  if (!validator(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validator.errors ?? [])}`);
  }
}

function validateSafeWriteReceipt(value: JsonRecord): void {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    'requirements-contract-large-document-writer-safe-write-receipt.schema.json'
  );
  const validator = new Ajv({ allErrors: true, strict: false }).compile(readJson(schemaPath));
  if (!validator(value)) {
    throw new Error(
      `production_activate_plan_write_receipt_schema_invalid:${JSON.stringify(
        validator.errors ?? []
      )}`
    );
  }
}

function commandText(contract: string, commandId: string): string {
  const row = contract.split(/\r?\n/u).find((line) => line.startsWith(`| ${commandId} |`));
  const cell = row?.match(/^\| [^|]+ \| (.*?) \| Repository root \|/u)?.[1]?.trim();
  if (!cell) throw new Error(`production_activate_contract_command_missing:${commandId}`);
  return cell.startsWith('`') && cell.endsWith('`') ? cell.slice(1, -1) : cell;
}

function packagedContractText(commands: ControlledCommand[]): string {
  if (
    commands.length !== PACKAGED_COMMAND_TEXT_BASE64.length ||
    commands.length !== PACKAGED_COMMAND_ARGV_HASHES.length
  ) {
    throw new Error('production_activate_packaged_command_count_mismatch');
  }
  return commands
    .map((command, index) => {
      const text = Buffer.from(PACKAGED_COMMAND_TEXT_BASE64[index], 'base64').toString('utf8');
      if (sha256(canonicalJson([text])) !== PACKAGED_COMMAND_ARGV_HASHES[index]) {
        throw new Error('production_activate_packaged_command_hash_mismatch');
      }
      return `| ${command.commandId} | \`${text}\` | Repository root | packaged | AC-01 |`;
    })
    .join('\n');
}

function resolveContractText(root: string, commands: ControlledCommand[]): string {
  const contractPath = resolveWithin(root, CONTRACT_PATH);
  if (fs.existsSync(contractPath)) {
    if (fileHash(contractPath) !== CONTRACT_SHA256) {
      throw new Error('production_activate_contract_hash_mismatch');
    }
    return fs.readFileSync(contractPath, 'utf8');
  }
  return packagedContractText(commands);
}

function directoryHash(root: string): string {
  const entries: JsonRecord[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (entry.isFile()) {
        entries.push({
          path: slash(path.relative(root, resolved)),
          hash: fileHash(resolved),
        });
      }
    }
  };
  visit(root);
  return sha256(canonicalJson(entries.sort((a, b) => a.path.localeCompare(b.path))));
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function captureCandidateFiles(root: string, snapshotRoot: string): void {
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const source = path.join(current, entry.name);
      const relative = slash(path.relative(root, source));
      if (
        isWithin(snapshotRoot, source) ||
        relative === '.git' ||
        relative.startsWith('.git/') ||
        relative === 'node_modules' ||
        relative.includes('/node_modules/') ||
        relative === 'docs/plans/evidence' ||
        relative.startsWith('docs/plans/evidence/')
      ) {
        continue;
      }
      const target = path.join(snapshotRoot, relative);
      if (entry.isDirectory()) {
        fs.mkdirSync(target, { recursive: true });
        visit(source);
      } else if (entry.isFile()) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(source, target);
      }
    }
  };
  fs.mkdirSync(snapshotRoot, { recursive: true });
  visit(root);
}

function snapshotMembers(snapshotRoot: string): JsonRecord[] {
  const members: JsonRecord[] = [];
  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) visit(resolved);
      else if (entry.isFile()) {
        members.push({
          path: slash(path.relative(snapshotRoot, resolved)),
          hash: fileHash(resolved),
        });
      }
    }
  };
  visit(snapshotRoot);
  return members.sort((a, b) => a.path.localeCompare(b.path));
}

function writeAtomicText(target: string, value: string, identity: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${identity}.tmp`;
  fs.writeFileSync(temporary, value, 'utf8');
  fs.renameSync(temporary, target);
}

function writeCreateOnlyJson(target: string, value: JsonRecord, label: string): void {
  const receipt = largeDocumentWriter.safeWriteJson(target, value, { mode: 'create' });
  if (
    receipt.targetPath !== path.resolve(target) ||
    receipt.finalHash !== fileHash(target) ||
    canonicalJson(readJson(target)) !== canonicalJson(value)
  ) {
    throw new Error(`${label}_readback_mismatch`);
  }
}

function executeCommands(root: string, commands: JsonRecord[]): JsonRecord[] {
  return commands.map((command) => {
    const result = spawnSync(String(command.commandText), {
      cwd: root,
      encoding: 'utf8',
      shell: true,
      windowsHide: true,
    });
    const exitCode = result.status ?? (result.error ? 1 : 0);
    return {
      commandId: command.commandId,
      argvHash: command.argvHash,
      exitCode,
      stdoutHash: sha256(result.stdout ?? ''),
      stderrHash: sha256(`${result.stderr ?? ''}${result.error?.message ?? ''}`),
      decision: exitCode === 0 ? 'pass' : 'blocked',
    };
  });
}

export async function requirementsContractProductionActivateCommand(
  options: RequirementsContractProductionActivateOptions
): Promise<JsonRecord> {
  const root = path.resolve(options.cwd ?? process.cwd());
  if (slash(options.registry) !== REGISTRY_PATH) {
    throw new Error('production_activate_registry_path_mismatch');
  }
  const sixModelConsumerInventory = createRequirementsContractSixModelConsumerInventory(root);
  const recordPath = resolveWithin(root, options.requirementRecord);
  const registryPath = resolveWithin(root, options.registry);
  const successReceiptPath = resolveWithin(root, options.successReceipt);
  const record = readJson(recordPath);
  const requirementSetId = String(record.requirementSetId ?? record.recordId ?? '');
  const implementationAttemptId = String(record.currentAttemptId ?? '');
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(requirementSetId)) {
    throw new Error('production_activate_requirement_set_id_invalid');
  }
  if (!/^IMPL-ATTEMPT-[A-Z0-9][A-Z0-9._-]*$/u.test(implementationAttemptId)) {
    throw new Error('production_activate_active_implementation_attempt_invalid');
  }
  if (Array.isArray(record.implementationAttempts)) {
    const active = record.implementationAttempts.filter(
      (entry: JsonRecord) =>
        entry.active === true || ['active', 'implementation_in_progress'].includes(entry.status)
    );
    if (
      active.length !== 1 ||
      String(active[0].implementationAttemptId ?? active[0].attemptId) !== implementationAttemptId
    ) {
      throw new Error('production_activate_active_implementation_attempt_not_unique');
    }
  }
  const registryPreimageText = fs.readFileSync(registryPath, 'utf8');
  const registryBefore = parseJsonObject(registryPreimageText, registryPath);
  if (
    registryBefore.requirementSetId !== undefined &&
    registryBefore.requirementSetId !== requirementSetId
  ) {
    throw new Error('production_activate_registry_requirement_set_mismatch');
  }
  const preimageHash = sha256(registryPreimageText);
  const activationAttemptId = `ACT-ATTEMPT-${uuidv7()}`;
  const activationReceiptId = `ACT-RECEIPT-${uuidv7()}`;
  const targetRegistry = {
    ...registryBefore,
    requirementSetId,
    shadowOutputEnabled: false,
    v1OutputEnabled: false,
    productionReadModelVersion: 'v2',
    activationReceiptId,
    sixModelConsumerInventory,
  };
  const targetRegistryText = `${JSON.stringify(targetRegistry, null, 2)}\n`;
  const targetRegistryHash = sha256(targetRegistryText);
  const plannedSnapshotPath = slash(
    path.join(
      '_bmad-output/runtime/requirement-records',
      requirementSetId,
      'activation',
      implementationAttemptId,
      activationAttemptId,
      'candidate-snapshot',
      '/'
    )
  );
  const planRelativePath = slash(
    path.join(options.activationPlanDir, `${activationAttemptId}.json`)
  );
  const promotionRelativePath = slash(
    path.join(options.activationPlanWriteReceiptDir, `${activationAttemptId}.receipt.json`)
  );
  const commands = controlledCommands();
  const contract = resolveContractText(root, commands);
  const commandPlans = commands.map(({ commandId, fixtureOnly }) => {
    const text = commandText(contract, commandId);
    return {
      commandId,
      argvHash: sha256(canonicalJson([text])),
      fixtureOnly,
      commandText: text,
    };
  });
  const plan = {
    schemaVersion: 'requirements-contract-production-activation-plan/v1',
    requirementRecord: {
      path: slash(path.relative(root, recordPath)),
      hash: fileHash(recordPath),
    },
    requirementSetId,
    implementationAttemptId,
    activationAttemptId,
    activationReceiptId,
    idGenerationScheme: 'uuidv7',
    registry: {
      path: REGISTRY_PATH,
      preimageHash,
      targetArtifact12Hash: targetRegistryHash,
    },
    plannedSnapshotPath,
    nestedCommands: commandPlans.map(({ commandText: _commandText, ...command }) => command),
    cliIdentityHash: fileHash(resolveRequirementsContractProductionActivateCliPath(root)),
    schemaIdentityHash: fileHash(
      path.resolve(
        __dirname,
        '..',
        'schemas',
        'requirements-contract-production-activation-plan.schema.json'
      )
    ),
    expectedPromotionReceiptPath: promotionRelativePath,
    createdAt: new Date().toISOString(),
  };
  validate(
    plan,
    'requirements-contract-production-activation-plan.schema.json',
    'production_activate_plan'
  );
  const planPath = resolveWithin(root, planRelativePath);
  const planWriteReceipt = largeDocumentWriter.safeWriteJson(planPath, plan, {
    mode: 'create',
  });
  const planHash = fileHash(planPath);
  validateSafeWriteReceipt(planWriteReceipt);
  if (
    planWriteReceipt.targetPath !== path.resolve(planPath) ||
    planWriteReceipt.finalHash !== planHash
  ) {
    throw new Error('production_activate_plan_write_receipt_mismatch');
  }
  const promotionPath = resolveWithin(root, promotionRelativePath);
  if (fs.existsSync(promotionPath)) {
    throw new Error('production_activate_plan_write_receipt_already_exists');
  }
  writeAtomicText(
    promotionPath,
    `${JSON.stringify(planWriteReceipt, null, 2)}\n`,
    `${activationAttemptId}.plan-receipt`
  );
  if (canonicalJson(readJson(promotionPath)) !== canonicalJson(planWriteReceipt)) {
    throw new Error('production_activate_plan_write_receipt_readback_mismatch');
  }
  const snapshotRoot = resolveWithin(root, plannedSnapshotPath);
  captureCandidateFiles(root, snapshotRoot);
  fs.mkdirSync(path.join(snapshotRoot, path.dirname(REGISTRY_PATH)), { recursive: true });
  fs.writeFileSync(path.join(snapshotRoot, REGISTRY_PATH), targetRegistryText, 'utf8');
  const members = snapshotMembers(snapshotRoot);
  const snapshotManifest = {
    schemaVersion: 'requirements-contract-production-activation-snapshot/v1',
    activationAttemptId,
    activationReceiptId,
    activationPlanPath: planRelativePath,
    activationPlanHash: planHash,
    registryPath: REGISTRY_PATH,
    registryHash: targetRegistryHash,
    requirementRecordHash: fileHash(recordPath),
    memberCount: members.length,
    memberInventoryHash: sha256(canonicalJson(members)),
    members,
    receiptAndEvidenceExcluded: true,
  };
  const snapshotManifestPath = path.join(snapshotRoot, 'snapshot-manifest.json');
  writeAtomicText(
    snapshotManifestPath,
    `${JSON.stringify(snapshotManifest, null, 2)}\n`,
    `${activationAttemptId}.snapshot-manifest`
  );
  if (canonicalJson(readJson(snapshotManifestPath)) !== canonicalJson(snapshotManifest)) {
    throw new Error('production_activate_snapshot_manifest_readback_mismatch');
  }
  const candidateSnapshotHash = directoryHash(snapshotRoot);
  const commandReceipts = executeCommands(snapshotRoot, commandPlans);
  const receiptSchemaPath = resolveRequirementsContractProductionActivationReceiptSchemaPath();
  const baseReceipt = {
    schemaVersion: 'requirements-contract-production-activation-receipt/v1',
    requirementSetId,
    implementationAttemptId,
    activationAttemptId,
    activationReceiptId,
    selectedReceiptSchemaVersion: 'requirements-contract-production-activation-receipt/v1',
    selectedReceiptSchemaHash: fileHash(receiptSchemaPath),
    activationPlan: {
      path: planRelativePath,
      hash: planHash,
      promotionReceiptPath: promotionRelativePath,
      promotionReceiptHash: fileHash(promotionPath),
    },
    candidateSnapshot: {
      path: plannedSnapshotPath,
      hash: candidateSnapshotHash,
    },
    commands: commandReceipts,
    lock: {
      acquired: false,
      lockIdentityHash: sha256(`requirements-contract-production-activation-lock/v1\n${LOCK_PATH}`),
    },
    compareAndSwap: {
      registryPreimageHash: preimageHash,
      registryTargetHash: targetRegistryHash,
      decision: 'blocked',
    },
  };
  let registryWriteApplied = false;
  const blocked = (code: string, phase: string, stderrHash = sha256('')) => {
    if (
      registryWriteApplied &&
      (!fs.existsSync(registryPath) || fileHash(registryPath) !== preimageHash)
    ) {
      writeAtomicText(registryPath, registryPreimageText, `${activationAttemptId}.restore`);
    }
    if (!fs.existsSync(registryPath)) {
      throw new Error('production_activate_registry_missing_after_block');
    }
    const restoredRegistryHash = fileHash(registryPath);
    if (registryWriteApplied && restoredRegistryHash !== preimageHash) {
      throw new Error('production_activate_registry_restore_failed');
    }
    const selectedReceiptPath = slash(
      path.join(options.blockedAttemptDir, `${activationAttemptId}.json`)
    );
    const receipt = {
      ...baseReceipt,
      activationOutcome: 'blocked',
      selectedReceiptPath,
      failure: { code, phase, stderrHash },
      restoration: {
        registryRestored: true,
        restoredRegistryHash,
        decision: 'pass',
      },
    };
    validate(
      receipt,
      'requirements-contract-production-activation-receipt.schema.json',
      'production_activate_receipt'
    );
    writeCreateOnlyJson(
      resolveWithin(root, selectedReceiptPath),
      receipt,
      'production_activate_blocked_receipt'
    );
    if (options.json) process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return receipt;
  };
  const failedCommand = commandReceipts.find((command) => command.decision !== 'pass');
  if (failedCommand) {
    return blocked(
      'nested_command_failed',
      String(failedCommand.commandId).toLowerCase().replace('-', '_'),
      failedCommand.stderrHash
    );
  }
  if (fileHash(path.join(snapshotRoot, REGISTRY_PATH)) !== targetRegistryHash) {
    return blocked('candidate_artifact12_mismatch', 'candidate_snapshot');
  }
  const lockPath = resolveWithin(root, LOCK_PATH);
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    fs.mkdirSync(lockPath);
  } catch {
    return blocked('activation_lock_unavailable', 'lock');
  }
  baseReceipt.lock.acquired = true;
  let successfulReceipt: JsonRecord | undefined;
  try {
    if (fileHash(registryPath) !== preimageHash) {
      return blocked('registry_preimage_mismatch', 'compare_and_swap');
    }
    writeAtomicText(registryPath, targetRegistryText, activationAttemptId);
    registryWriteApplied = true;
    const readbackHash = fileHash(registryPath);
    if (readbackHash !== targetRegistryHash) {
      return blocked('registry_readback_mismatch', 'readback');
    }
    const selectedReceiptPath = slash(options.successReceipt);
    const receipt = {
      ...baseReceipt,
      activationOutcome: 'success',
      selectedReceiptPath,
      compareAndSwap: {
        ...baseReceipt.compareAndSwap,
        decision: 'pass',
      },
      readback: {
        registryHash: readbackHash,
        selectorDecision: 'pass',
        activeImplementationAttemptId: implementationAttemptId,
        decision: 'pass',
      },
    };
    validate(
      receipt,
      'requirements-contract-production-activation-receipt.schema.json',
      'production_activate_receipt'
    );
    if (fs.existsSync(successReceiptPath)) {
      return blocked('success_receipt_already_exists', 'receipt');
    }
    successfulReceipt = receipt;
  } finally {
    fs.rmSync(lockPath, { recursive: true, force: true });
  }
  if (!successfulReceipt) {
    throw new Error('production_activate_success_receipt_missing_after_unlock');
  }
  try {
    writeCreateOnlyJson(
      successReceiptPath,
      successfulReceipt,
      'production_activate_success_receipt'
    );
  } catch (error) {
    const receiptWriteCode =
      error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;
    try {
      fs.mkdirSync(lockPath);
    } catch {
      throw new Error('production_activate_success_receipt_rollback_lock_unavailable');
    }
    try {
      if (!fs.existsSync(registryPath) || fileHash(registryPath) !== targetRegistryHash) {
        throw new Error('production_activate_success_receipt_rollback_cas_mismatch');
      }
      writeAtomicText(registryPath, registryPreimageText, `${activationAttemptId}.receipt-restore`);
      if (fileHash(registryPath) !== preimageHash) {
        throw new Error('production_activate_success_receipt_rollback_readback_mismatch');
      }
      return blocked(
        receiptWriteCode === 'TARGET_EXISTS'
          ? 'success_receipt_already_exists'
          : 'success_receipt_publish_failed',
        'receipt',
        sha256(error instanceof Error ? error.message : String(error))
      );
    } finally {
      fs.rmSync(lockPath, { recursive: true, force: true });
    }
  }
  if (options.json) process.stdout.write(`${JSON.stringify(successfulReceipt)}\n`);
  return successfulReceipt;
}
