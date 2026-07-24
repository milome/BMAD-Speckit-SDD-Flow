import { runCli } from '../src/cli';
import { conditionalTarget } from '../src/conditional-target';
import { loadRegisteredTarget } from '../src/dynamic-registry';
import { exported } from '../src/exported';
import { generatedOwnerless } from '../src/generated-ownerless';
import { generatedRetired } from '../src/generated-retired';
import { productionImported } from '../src/production-imported';
import { protectedApi } from '../src/protected';
import { protectedUnbound } from '../src/protected-unbound';
import { unused } from '../src/unused';

void [
  conditionalTarget,
  exported,
  generatedOwnerless,
  generatedRetired,
  loadRegisteredTarget,
  productionImported,
  protectedApi,
  protectedUnbound,
  runCli,
  unused,
];
