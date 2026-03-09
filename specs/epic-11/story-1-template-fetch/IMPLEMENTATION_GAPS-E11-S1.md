# IMPLEMENTATION_GAPS: Story 11.1 模板拉取

**Epic**: 11 - speckit-template-offline  
**Story**: 11.1 - 模板拉取（template-fetch）  
**Created**: 2026-03-09  
**Input**: spec-E11-S1.md、plan-E11-S1.md、Story 11-1、PRD、ARCH

---

## 需求映射清单（GAPS ↔ 需求文档 + plan）

| 需求文档章节 | spec.md 对应 | plan.md 对应 | GAPS 覆盖 |
|-------------|-------------|-------------|----------|
| Story 11-1 本 Story 范围 | spec §Requirements | plan Phase 1–4 | 见下表 |
| PRD §5.2/§5.4/§5.8/§5.9 | spec FR-001–FR-012 | plan §1–§3 | 见下表 |
| ARCH §3.2/§4.3 | spec Implementation Constraints | plan §1.1、§1.2 | 见下表 |

---

## Gaps 清单（按需求文档章节）

| 需求文档章节 | Gap ID | 需求要点 | 当前实现状态 | 缺失/偏差说明 |
|-------------|--------|----------|-------------|---------------|
| Story 11-1 Task 1 | GAP-1.1 | 拉取后解压写入 ~/.bmad-speckit/templates/\<template-id\>/\<tag\>/ 或 latest/ | 未实现 | template-fetcher 仅解压到 os.tmpdir()，未写入 cache |
| Story 11-1 Task 1 | GAP-1.2 | cache 目录不存在时创建（mkdirSync recursive） | 未实现 | 无 cache 写入路径 |
| Story 11-1 Task 1 | GAP-1.3 | init 调用 TemplateFetcher 时传入 tag 或 latest，复用已写入 cache 路径 | 部分实现 | init 传 tag，但无 cache 复用逻辑；返回为临时目录 |
| Story 11-1 Task 2 | GAP-2.1 | init 与 TemplateFetcher 支持 --template \<tag\>（含 latest）与 --template \<url\> | 部分实现 | init 无 --template 参数；仅交互式选 tag；无 url 分支 |
| Story 11-1 Task 2 | GAP-2.2 | URL 拉取时相同超时与错误码 3；解压到 cache 下可识别目录（如 url-\<hash\>） | 未实现 | 无 URL 拉取逻辑 |
| Story 11-1 Task 3 | GAP-3.1 | 超时配置链：CLI > SDD_NETWORK_TIMEOUT_MS > 项目级 networkTimeoutMs > 全局 networkTimeoutMs > 30000 | 部分实现 | 仅读取 SDD_NETWORK_TIMEOUT_MS；未读 ConfigManager；无 CLI 参数 |
| Story 11-1 Task 3 | GAP-3.2 | 所有模板拉取 HTTP(S) 请求应用该超时；超时后输出含「网络超时」的错误信息，退出码 3 | 部分实现 | 有超时与 exit 3，但超时文案可能未含「网络超时」；未使用配置链得到的值 |
| Story 11-1 Task 4 | GAP-4.1 | 拉取 404/非 2xx 或解压失败时统一退出码 3 与明确提示 | 部分实现 | 有 HTTP 状态码与 throw，需确认 init 侧 exit(3) 与文案 |
| Story 11-1 Task 4 | GAP-4.2 | TemplateFetcher 与 init 拉取路径补充单元/集成测试（latest、tag、url、超时、失败） | 未实现 | 需补充覆盖 cache、--template、超时链、失败场景的测试 |

---

## 包/文件 Gap 汇总

| 预期变更 | 当前状态 | Gap ID |
|----------|----------|--------|
| template-fetcher.js：cache 根目录、写入 cache、url 拉取、接收 networkTimeoutMs | 仅临时目录、仅 GitHub、仅 env 超时 | GAP-1.1, 1.2, 2.2, 3.2 |
| init.js：--template 解析、超时配置链、传 networkTimeoutMs 与 templateSpec、exit(3) 与文案 | 无 --template；未传 networkTimeoutMs；未按配置链 | GAP-2.1, 3.1, 4.1 |
| 单元/集成测试 | 现有测试未覆盖 cache、url、超时链 | GAP-4.2 |

---

## 说明

本 Story 在 Story 10.1 TemplateFetcher 最小实现与 init 基础上扩展。GAPS 反映从当前实现到 plan/spec 的完整差距。实施时先实现超时配置链与 cache 写入，再实现 --template url，最后补充测试与错误文案。

<!-- AUDIT: PASSED by code-reviewer -->
