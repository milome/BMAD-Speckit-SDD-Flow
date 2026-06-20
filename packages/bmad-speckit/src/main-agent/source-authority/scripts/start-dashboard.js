"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const runtime_dashboard_fixture_1 = require("../tests/helpers/runtime-dashboard-fixture");
const live_server_1 = require("../packages/scoring/dashboard/live-server");
async function main() {
    const fixture = await (0, runtime_dashboard_fixture_1.createRuntimeDashboardFixture)({
        withSftDataset: true,
        withBundle: true,
        withRealToolTraceFixture: true,
        realToolTraceVariants: ['clean'],
    });
    const server = await (0, live_server_1.startLiveDashboardServer)({
        root: fixture.root,
        host: '127.0.0.1',
        port: 0,
        dataPath: fixture.dataPath,
    });
    console.log('Dashboard URL:', server.url);
    await new Promise(() => { });
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
