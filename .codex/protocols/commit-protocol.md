# Commit Protocol

鎻愪氦璇锋眰涓庨棬鎺у崗璁€?
## Rules

1. **鎵ц Agent 绂佹鐩存帴 `git commit`**
2. 鍙兘鍙?`commit_request` 鍒?bmad-master
3. 鍙湁 bmad-master 鍙牴鎹?audit_status 鏀捐鎻愪氦

## Commit Request Format

```yaml
request_type: commit_request
stage: implement
audit_status: pending | pass | fail
artifact_paths:
  - src/...
  - tests/...
```

## Gate Logic

- `audit_status=fail` 鈫?**DENY**
- `audit_status=pass` + `bmad-master` 纭 鈫?**ALLOW**
- 鏈粡瀹¤鐩存帴 commit 鈫?**BLOCKED**

## Only bmad-master can approve commit

bmad-master 鏍规嵁浠ヤ笅鐘舵€佸喅瀹氾細
- `.codex/state/bmad-progress.yaml` 涓殑 `audit_status`
- 鏈€杩戜竴娆″璁℃姤鍛婄殑缁撹
- 褰撳墠 stage 鏄惁鍏佽鎻愪氦
