"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = void 0;
const party_mode_runtime_1 = require("./party-mode-runtime");
var party_mode_runtime_2 = require("./party-mode-runtime");
Object.defineProperty(exports, "runCli", { enumerable: true, get: function () { return party_mode_runtime_2.runCli; } });
if (require.main === module) {
    try {
        const result = (0, party_mode_runtime_1.runCli)(process.argv.slice(2));
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    }
}
