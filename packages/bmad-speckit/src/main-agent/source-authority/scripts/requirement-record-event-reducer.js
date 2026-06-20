"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256Json = exports.canonicalizeRequirementRecord = void 0;
var requirement_record_control_store_1 = require("./requirement-record-control-store");
Object.defineProperty(exports, "canonicalizeRequirementRecord", { enumerable: true, get: function () { return requirement_record_control_store_1.canonicalizeRequirementRecord; } });
Object.defineProperty(exports, "sha256Json", { enumerable: true, get: function () { return requirement_record_control_store_1.sha256Json; } });
if (require.main === module) {
    console.log(JSON.stringify({
        ok: true,
        reducer: 'canonical-requirement-record-reducer/v1',
        api: 'import canonicalizeRequirementRecord from requirement-record-control-store',
    }, null, 2));
}
