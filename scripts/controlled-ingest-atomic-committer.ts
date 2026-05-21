export {
  appendControlEventAndReplay,
  eventLogPathForRecord,
  readJson,
  receiptPathForEvent,
  sha256Json,
  sha256Text,
  writeJsonAtomic,
  type ControlCommitResult,
  type ControlEventEnvelope,
  type RequirementRecordReducer,
} from './requirement-record-control-store';

if (require.main === module) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        committer: 'requirement-record-control-store/v1',
        api: 'import appendControlEventAndReplay from requirement-record-control-store',
      },
      null,
      2
    )
  );
}
