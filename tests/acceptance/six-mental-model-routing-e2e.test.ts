import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateRequirementRecordSchemaObject } from '../../scripts/requirement-record-live-schema-gate';
import {
  MODELS,
  NEXT_MODEL,
  type JsonObject,
  ROUTE_ORDER,
  appendModelResult,
  closeRecord,
  ingestReconfirmation,
  modelResults,
  openRerunLoop,
  readRecord,
  recordPostCloseCarrier,
  requestReconfirmation,
  resolveRerunLoop,
  rollbackToRequirementConfirmation,
  transition,
  transitionAfterRerun,
  withRecord,
} from './helpers/six-mental-model-routing-index';

describe('six mental model routing e2e matrix', () => {
  it('advances one record through the canonical happy path and closes only after delivery confirmation pass', () => {
    withRecord((recordPath) => {
      for (const fromModel of ROUTE_ORDER.slice(0, -1)) {
        const toModel = NEXT_MODEL[fromModel]!;
        transition(recordPath, fromModel, toModel);
        appendModelResult(recordPath, toModel, 'pass');
      }

      closeRecord(recordPath);

      const record = readRecord(recordPath);
      expect(record.status).toBe('closed');
      expect(record.currentMentalModel).toBe('delivery_confirmation');
      expect(record.lastEventType).toBe('record_closed');
      expect((record.mentalModelTransitions as unknown[])).toHaveLength(5);
      expect(ROUTE_ORDER.map((model) => (modelResults(record)[model] as JsonObject).status)).toEqual(
        ['pass', 'pass', 'pass', 'pass', 'pass', 'pass']
      );
      expect(validateRequirementRecordSchemaObject(record).ok).toBe(true);
    });
  });

  it.each(MODELS)('fails closed when %s is not pass before leaving that model', (model) => {
    withRecord((recordPath) => {
      for (const fromModel of ROUTE_ORDER.slice(0, ROUTE_ORDER.indexOf(model))) {
        const toModel = NEXT_MODEL[fromModel]!;
        transition(recordPath, fromModel, toModel);
        appendModelResult(recordPath, toModel, 'pass');
      }

      appendModelResult(recordPath, model, 'blocked');
      const before = readFileSync(recordPath, 'utf8');
      const next = NEXT_MODEL[model];

      if (next) {
        expect(() => transition(recordPath, model, next)).toThrow(
          'mental_model_transition_requires_current_model_pass'
        );
      } else {
        expect(() => closeRecord(recordPath)).toThrow(
          'record_closed_requires_delivery_confirmation_pass'
        );
      }

      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('fails closed on non-adjacent model transitions without mutating the record', () => {
    withRecord((recordPath) => {
      let before = readFileSync(recordPath, 'utf8');
      expect(() =>
        transition(recordPath, 'requirement_confirmation', 'implementation_readiness')
      ).toThrow('mental_model_transition_order_violation');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);

      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');
      transition(recordPath, 'architecture_confirmation', 'implementation_readiness');
      appendModelResult(recordPath, 'implementation_readiness', 'pass');

      before = readFileSync(recordPath, 'utf8');
      expect(() =>
        transition(recordPath, 'implementation_readiness', 'delivery_confirmation')
      ).toThrow('mental_model_transition_order_violation');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('fails closed when transition fromModel does not match currentMentalModel', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');

      const before = readFileSync(recordPath, 'utf8');
      expect(() =>
        transition(recordPath, 'requirement_confirmation', 'architecture_confirmation')
      ).toThrow('mental_model_transition_from_model_mismatch');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('blocks forward progression while a blocking reconfirmation request is open', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');
      requestReconfirmation(recordPath);

      const before = readFileSync(recordPath, 'utf8');
      expect(() =>
        transition(recordPath, 'architecture_confirmation', 'implementation_readiness')
      ).toThrow('mental_model_transition_blocked_by_open_reconfirmation');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('recovers from a blocked model only after the rerun loop is resolved and the model result is pass', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');
      transition(recordPath, 'architecture_confirmation', 'implementation_readiness');

      appendModelResult(recordPath, 'implementation_readiness', 'blocked');
      openRerunLoop(recordPath, 'implementation_readiness');
      expect(() =>
        transitionAfterRerun(recordPath, 'implementation_readiness', 'execution_closure')
      ).toThrow('mental_model_transition_blocked_by_open_rerun_loop');

      resolveRerunLoop(recordPath, 'implementation_readiness');
      appendModelResult(recordPath, 'implementation_readiness', 'pass');
      transitionAfterRerun(recordPath, 'implementation_readiness', 'execution_closure');

      const record = readRecord(recordPath);
      expect(record.currentMentalModel).toBe('execution_closure');
      expect((record.rerunLoops as JsonObject[]).at(-1)).toMatchObject({
        rerunLoopId: 'rerun-implementation_readiness',
        status: 'resolved',
      });
      expect(validateRequirementRecordSchemaObject(record).ok).toBe(true);
    });
  });

  it('does not treat resolved rerun as pass when the model result remains blocked', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');
      transition(recordPath, 'architecture_confirmation', 'implementation_readiness');

      appendModelResult(recordPath, 'implementation_readiness', 'blocked');
      openRerunLoop(recordPath, 'implementation_readiness');
      resolveRerunLoop(recordPath, 'implementation_readiness');

      const before = readFileSync(recordPath, 'utf8');
      expect(() =>
        transitionAfterRerun(recordPath, 'implementation_readiness', 'execution_closure')
      ).toThrow('mental_model_transition_requires_current_model_pass');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('fails closed when record_closed is attempted before reaching delivery_confirmation', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');

      const before = readFileSync(recordPath, 'utf8');
      expect(() => closeRecord(recordPath)).toThrow(
        'record_closed_requires_delivery_confirmation_model'
      );
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('routes semantic drift to reconfirmation and resumes from requirement confirmation after controlled ingest', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');
      transition(recordPath, 'architecture_confirmation', 'implementation_readiness');

      requestReconfirmation(recordPath);
      rollbackToRequirementConfirmation(recordPath, 'implementation_readiness');
      let record = readRecord(recordPath);
      expect(record.status).toBe('reconfirm_required');
      expect(record.currentMentalModel).toBe('requirement_confirmation');
      expect((record.reconfirmationRequests as JsonObject[]).at(-1)).toMatchObject({
        status: 'blocking_open',
        targetModel: 'requirement_confirmation',
      });

      ingestReconfirmation(recordPath);
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');

      record = readRecord(recordPath);
      expect(record.status).toBe('user_confirmed');
      expect(record.currentMentalModel).toBe('architecture_confirmation');
      expect((record.reconfirmationRequests as JsonObject[]).at(-1)).toMatchObject({
        status: 'controlled_confirmed',
      });
      expect(validateRequirementRecordSchemaObject(record).ok).toBe(true);
    });
  });

  it('fails closed when controlled reconfirmation ingest uses mismatched hashes', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'pass');
      transition(recordPath, 'architecture_confirmation', 'implementation_readiness');
      requestReconfirmation(recordPath);
      rollbackToRequirementConfirmation(recordPath, 'implementation_readiness');

      const before = readFileSync(recordPath, 'utf8');
      expect(() =>
        ingestReconfirmation(recordPath, {
          sourceDocumentHash:
            'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        })
      ).toThrow('reconfirmation_ingest_hash_mismatch');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('treats stale model results as non-progressable semantic drift blockers', () => {
    withRecord((recordPath) => {
      transition(recordPath, 'requirement_confirmation', 'architecture_confirmation');
      appendModelResult(recordPath, 'architecture_confirmation', 'stale');

      const before = readFileSync(recordPath, 'utf8');
      expect(() =>
        transition(recordPath, 'architecture_confirmation', 'implementation_readiness')
      ).toThrow('mental_model_transition_requires_current_model_pass');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });

  it('records post-close defect evidence without reopening or changing the closed origin route', () => {
    withRecord((recordPath) => {
      for (const fromModel of ROUTE_ORDER.slice(0, -1)) {
        const toModel = NEXT_MODEL[fromModel]!;
        transition(recordPath, fromModel, toModel);
        appendModelResult(recordPath, toModel, 'pass');
      }
      closeRecord(recordPath);

      const before = readRecord(recordPath);
      recordPostCloseCarrier(recordPath);
      const after = readRecord(recordPath);

      expect(after.status).toBe('closed');
      expect(after.currentMentalModel).toBe(before.currentMentalModel);
      expect(after.closeout).toEqual(before.closeout);
      expect(after.sixModelResults).toEqual(before.sixModelResults);
      expect(after.lastEventType).toBe('post_close_revalidation_carrier_recorded');
      expect(after.artifactIndex).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artifactType: 'post_close_revalidation_carrier',
            sourceOfTruthRole: 'evidence',
          }),
        ])
      );
      expect(validateRequirementRecordSchemaObject(after).ok).toBe(true);
    });
  });

  it('rejects post-close defect carriers that attempt to mutate control fields', () => {
    withRecord((recordPath) => {
      for (const fromModel of ROUTE_ORDER.slice(0, -1)) {
        const toModel = NEXT_MODEL[fromModel]!;
        transition(recordPath, fromModel, toModel);
        appendModelResult(recordPath, toModel, 'pass');
      }
      closeRecord(recordPath);

      const before = readFileSync(recordPath, 'utf8');
      expect(() =>
        recordPostCloseCarrier(recordPath, {
          currentMentalModel: 'implementation_readiness',
          status: 'user_confirmed',
        })
      ).toThrow('post_close_carrier_cannot_mutate_control_fields');
      expect(readFileSync(recordPath, 'utf8')).toBe(before);
    });
  });
});
