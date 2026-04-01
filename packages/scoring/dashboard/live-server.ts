import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { queryRuntimeDashboard, type RuntimeDashboardQueryOptions } from './runtime-query';

const EMBEDDED_DASHBOARD_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Runtime Observatory</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/app.js" type="module"></script>
  </body>
</html>`;

function loadEmbeddedUiAsset(assetName: string): string | null {
  const embeddedRoot = path.resolve(process.cwd(), 'packages', 'scoring', 'dashboard', 'ui');
  const embeddedPath = path.join(embeddedRoot, assetName);
  if (fs.existsSync(embeddedPath)) {
    return fs.readFileSync(embeddedPath, 'utf-8');
  }
  return null;
}

export interface LiveDashboardServerOptions extends RuntimeDashboardQueryOptions {
  host?: string;
  port?: number;
}

export interface LiveDashboardServerHandle {
  host: string;
  port: number;
  url: string;
  close(): Promise<void>;
}

function getMimeType(filePath: string): string {
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}

function resolveUiAsset(assetName: string): string {
  const candidates = [
    path.join(__dirname, 'ui', assetName),
    path.resolve(__dirname, '..', '..', 'dashboard', 'ui', assetName),
    path.resolve(process.cwd(), 'packages', 'scoring', 'dashboard', 'ui', assetName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`dashboard ui asset not found: ${assetName}`);
}

function getUiAssetContent(assetName: string): string {
  const embedded = loadEmbeddedUiAsset(assetName);
  if (embedded != null) {
    return embedded;
  }

  if (assetName === 'index.html') {
    return EMBEDDED_DASHBOARD_HTML;
  }

  throw new Error(`dashboard ui asset not found: ${assetName}`);
}

function sendJson(
  response: http.ServerResponse,
  statusCode: number,
  payload: unknown
): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(
  response: http.ServerResponse,
  statusCode: number,
  filePathOrAssetName: string,
  content?: string
): void {
  const filePath = content == null ? filePathOrAssetName : path.resolve(filePathOrAssetName);
  response.writeHead(statusCode, {
    'content-type': getMimeType(filePath),
    'cache-control': 'no-store',
  });
  response.end(content ?? fs.readFileSync(filePath, 'utf-8'));
}

function parseDashboardQueryOptions(
  requestUrl: URL,
  options: LiveDashboardServerOptions
): RuntimeDashboardQueryOptions {
  return {
    root: options.root,
    dataPath: options.dataPath,
    strategy: options.strategy,
    epic: options.epic,
    story: options.story,
    windowHours: options.windowHours,
    workItemId: requestUrl.searchParams.get('work_item_id') ?? undefined,
    boardGroupId: requestUrl.searchParams.get('board_group_id') ?? undefined,
  };
}

export async function startLiveDashboardServer(
  options: LiveDashboardServerOptions = {}
): Promise<LiveDashboardServerHandle> {
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 43123;

  const server = http.createServer((request, response) => {
    const method = request.method ?? 'GET';
    const requestUrl = new URL(request.url ?? '/', `http://${host}`);

    if (method !== 'GET') {
      sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }

    const snapshot = queryRuntimeDashboard(parseDashboardQueryOptions(requestUrl, options));

    if (requestUrl.pathname === '/health') {
      sendJson(response, 200, {
        ok: true,
        dashboard_url: `http://${host}:${(server.address() as { port: number }).port}`,
      });
      return;
    }

    if (requestUrl.pathname === '/api/snapshot') {
      sendJson(response, 200, snapshot);
      return;
    }
    if (requestUrl.pathname === '/api/overview') {
      sendJson(response, 200, snapshot.overview);
      return;
    }
    if (requestUrl.pathname === '/api/runtime-context') {
      sendJson(response, 200, snapshot.runtime_context);
      return;
    }
    if (requestUrl.pathname === '/api/stage-timeline') {
      sendJson(response, 200, snapshot.stage_timeline);
      return;
    }
    if (requestUrl.pathname === '/api/score-detail') {
      sendJson(response, 200, snapshot.score_detail);
      return;
    }
    if (requestUrl.pathname === '/api/sft-summary') {
      sendJson(response, 200, snapshot.sft_summary);
      return;
    }
    if (requestUrl.pathname === '/api/workboard') {
      sendJson(response, 200, snapshot.workboard);
      return;
    }

    if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
      sendText(response, 200, 'index.html', getUiAssetContent('index.html'));
      return;
    }
    if (requestUrl.pathname === '/app.js') {
      sendText(response, 200, resolveUiAsset('app.js'));
      return;
    }
    if (requestUrl.pathname === '/styles.css') {
      sendText(response, 200, resolveUiAsset('styles.css'));
      return;
    }

    sendJson(response, 404, { ok: false, error: 'not_found' });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const port = (server.address() as { port: number }).port;

  return {
    host,
    port,
    url: `http://${host}:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
