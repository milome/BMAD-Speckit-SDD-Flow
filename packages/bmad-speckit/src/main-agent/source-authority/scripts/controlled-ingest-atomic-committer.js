"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeJsonAtomic = exports.sha256Text = exports.sha256Json = exports.receiptPathForEvent = exports.readJson = exports.eventLogPathForRecord = exports.appendControlEventAndReplay = void 0;
var requirement_record_control_store_1 = require("./requirement-record-control-store");
Object.defineProperty(exports, "appendControlEventAndReplay", { enumerable: true, get: function () { return requirement_record_control_store_1.appendControlEventAndReplay; } });
Object.defineProperty(exports, "eventLogPathForRecord", { enumerable: true, get: function () { return requirement_record_control_store_1.eventLogPathForRecord; } });
Object.defineProperty(exports, "readJson", { enumerable: true, get: function () { return requirement_record_control_store_1.readJson; } });
Object.defineProperty(exports, "receiptPathForEvent", { enumerable: true, get: function () { return requirement_record_control_store_1.receiptPathForEvent; } });
Object.defineProperty(exports, "sha256Json", { enumerable: true, get: function () { return requirement_record_control_store_1.sha256Json; } });
Object.defineProperty(exports, "sha256Text", { enumerable: true, get: function () { return requirement_record_control_store_1.sha256Text; } });
Object.defineProperty(exports, "writeJsonAtomic", { enumerable: true, get: function () { return requirement_record_control_store_1.writeJsonAtomic; } });
if (require.main === module) {
    console.log(JSON.stringify({
        ok: true,
        committer: 'requirement-record-control-store/v1',
        api: 'import appendControlEventAndReplay from requirement-record-control-store',
    }, null, 2));
}
