import { readFileSync } from 'node:fs';
import { resolveRequirementsContractSemanticIrAuthority, type RequirementsContractSemanticIr } from './requirements-contract-semantic-ir';

export function readRequirementsContractSemanticIrAuthority(filePath: string): RequirementsContractSemanticIr {
  return resolveRequirementsContractSemanticIrAuthority(JSON.parse(readFileSync(filePath, 'utf8')));
}
