export {
  canonicalizeRequirementRecord,
  sha256Json,
  type ControlEventEnvelope,
} from './requirement-record-control-store';

if (require.main === module) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        reducer: 'canonical-requirement-record-reducer/v1',
        api: 'import canonicalizeRequirementRecord from requirement-record-control-store',
      },
      null,
      2
    )
  );
}
