---
name: bmad-eval-questions
description: 棰樺簱 list/add 鍛戒护锛氭煡鐪嬮鐩竻鍗曘€佹柊澧為鐩ā鏉?---

# /bmad-eval-questions

棰樺簱绠＄悊鍛戒护锛屾敮鎸?`list` 涓?`add` 瀛愬懡浠ゃ€?
## 瑙﹀彂鏂瑰紡

- Codex command锛歚/bmad-eval-questions`
- CLI锛歚npx --no-install bmad-speckit eval-questions <subcommand> [options]`

## 瀛愬懡浠?
| 瀛愬懡浠?| 璇存槑 |
|--------|------|
| list | 杩斿洖褰撳墠鐗堟湰棰樼洰娓呭崟锛坕d銆乼itle銆乸ath锛?|
| add | 鏂板棰樼洰妯℃澘鍒板綋鍓嶇増鏈洰褰?|

## 鍙傛暟

- `--version v1\|v2`锛氭寚瀹氱増鏈洰褰曪紝缂虹渷涓?v1
- `--title "xxx"`锛歛dd 鏃跺繀濉紝棰樼洰鏍囬

## 鐢ㄦ硶绀轰緥

```bash
# list锛堢己鐪?v1锛?npx --no-install bmad-speckit eval-questions list
npx --no-install bmad-speckit eval-questions list --version v2

# add
npx --no-install bmad-speckit eval-questions add --title "refactor-scoring"
npx --no-install bmad-speckit eval-questions add --title "refactor-scoring" --version v2
```

## 楠屾敹鍛戒护

```bash
npx --no-install bmad-speckit eval-questions list
npx --no-install bmad-speckit eval-questions list --version v2
npx --no-install bmad-speckit eval-questions add --title "refactor-scoring"
npx --no-install bmad-speckit eval-questions add --title "refactor-scoring" --version v2
```

Codex command 鍐呴儴绛変环璋冪敤涓婅堪鑴氭湰銆?
