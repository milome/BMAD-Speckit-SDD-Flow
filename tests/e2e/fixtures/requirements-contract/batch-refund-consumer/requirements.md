---
schemaVersion: requirements-contract-intake-source/v1
authoritySources:
  - path: repo/refund-batch-contract.json
    rootClass: idempotency
    proposedAuthorityClass: derived
    bodySchemaVersion: requirements-contract-idempotency-root/v1
  - path: repo/refund-idempotency-requirement.json
    rootClass: functional_requirement
    proposedAuthorityClass: source_grounded
    bodySchemaVersion: requirement-contract-requirement/v2
  - path: policy/refund-audit-policy.json
    rootClass: functional_requirement
    proposedAuthorityClass: source_grounded
    bodySchemaVersion: requirement-contract-requirement/v2
  - path: policy/refund-approval-policy.json
    rootClass: functional_requirement
    proposedAuthorityClass: source_grounded
    bodySchemaVersion: requirement-contract-requirement/v2
  - path: policy/refund-batch-submission-policy.json
    rootClass: functional_requirement
    proposedAuthorityClass: source_grounded
    bodySchemaVersion: requirement-contract-requirement/v2
  - path: policy/refund-item-result-policy.json
    rootClass: functional_requirement
    proposedAuthorityClass: source_grounded
    bodySchemaVersion: requirement-contract-requirement/v2
  - path: policy/refund-submission-performance-policy.json
    rootClass: non_functional_requirement
    proposedAuthorityClass: source_grounded
    bodySchemaVersion: requirement-contract-requirement/v2
  - path: policy/questions/approval-failure-outcomes.json
    rootClass: unresolved_decision
    proposedAuthorityClass: source_authority
    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1
  - path: policy/questions/approval-separation-of-duties.json
    rootClass: unresolved_decision
    proposedAuthorityClass: source_authority
    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1
  - path: policy/questions/audit-content-retention.json
    rootClass: unresolved_decision
    proposedAuthorityClass: source_authority
    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1
  - path: policy/questions/batch-limit-exceeded.json
    rootClass: unresolved_decision
    proposedAuthorityClass: source_authority
    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1
  - path: policy/questions/batch-mixed-result.json
    rootClass: unresolved_decision
    proposedAuthorityClass: source_authority
    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1
  - path: policy/questions/item-failure-policy.json
    rootClass: unresolved_decision
    proposedAuthorityClass: source_authority
    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1
  - path: policy/questions/submission-p95-boundary.json
    rootClass: unresolved_decision
    proposedAuthorityClass: source_authority
    bodySchemaVersion: requirements-contract-unresolved-decision-root/v1
  - path: architecture/refund-queue-architecture.json
    rootClass: rule
    proposedAuthorityClass: derived
    bodySchemaVersion: requirements-contract-rule-root/v1
  - path: tests/refund-batch-contract-test.json
    rootClass: acceptance
    proposedAuthorityClass: derived
    bodySchemaVersion: requirements-contract-acceptance-root/v1
---

# 一批退款申请

客服需要一次提交一批退款申请，每批最多 100 笔。系统在后台队列逐笔处理退款，并返回每笔退款的处理结果。

系统必须保留批次审计记录。批次总金额大于或等于 10000 时必须进入审批。提交接口的 P95 响应时间不得超过 5 秒。
