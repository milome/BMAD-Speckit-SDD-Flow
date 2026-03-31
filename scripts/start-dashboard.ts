import { createRuntimeDashboardFixture } from '../tests/helpers/runtime-dashboard-fixture';
import { startLiveDashboardServer } from '../packages/scoring/dashboard/live-server';

async function main() {
  const fixture = await createRuntimeDashboardFixture({
    withSftDataset: true,
    withBundle: true,
    withRealToolTraceFixture: true,
    realToolTraceVariants: ['clean'],
  });

  const server = await startLiveDashboardServer({
    root: fixture.root,
    host: '127.0.0.1',
    port: 3456,
    dataPath: fixture.dataPath,
  });

  console.log('Dashboard URL:', server.url);
  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
