"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeScoreRecordSync = exports.appendJsonl = exports.writeSingleFile = exports.ensureDataDir = exports.validateScenarioConstraints = exports.validateRunScoreRecord = void 0;
exports.writeScoreRecord = writeScoreRecord;
var validate_1 = require("./validate");
Object.defineProperty(exports, "validateRunScoreRecord", { enumerable: true, get: function () { return validate_1.validateRunScoreRecord; } });
Object.defineProperty(exports, "validateScenarioConstraints", { enumerable: true, get: function () { return validate_1.validateScenarioConstraints; } });
var write_score_1 = require("./write-score");
Object.defineProperty(exports, "ensureDataDir", { enumerable: true, get: function () { return write_score_1.ensureDataDir; } });
Object.defineProperty(exports, "writeSingleFile", { enumerable: true, get: function () { return write_score_1.writeSingleFile; } });
Object.defineProperty(exports, "appendJsonl", { enumerable: true, get: function () { return write_score_1.appendJsonl; } });
Object.defineProperty(exports, "writeScoreRecordSync", { enumerable: true, get: function () { return write_score_1.writeScoreRecordSync; } });
const write_score_2 = require("./write-score");
/**
 * 异步写入单条评分记录；内部委托 writeScoreRecordSync。
 *
 * @param {RunScoreRecord} record - RunScoreRecord to write.
 * @param {WriteMode} mode - 'single_file' | 'jsonl' | 'both'.
 * @param {WriteScoreRecordOptions} [options] - Optional WriteScoreRecordOptions.
 * @returns {Promise<void>} Promise<void>
 * @throws Error when validation fails.
 */
async function writeScoreRecord(record, mode, options) {
    (0, write_score_2.writeScoreRecordSync)(record, mode, options);
}
