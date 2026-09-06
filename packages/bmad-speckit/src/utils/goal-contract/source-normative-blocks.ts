const { sha256Text, stableStringify } = require(
  __filename.endsWith('.ts') ? '../large-document-writer/receipts.ts' : '../large-document-writer/receipts'
);

export type GoalSourceNormativeBlocksModule = never;

const ID_PATTERN = /\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/gu;
const STRONG_PROHIBITION = /不得|禁止|不能证明|不可作为|\b(?:must not|shall not|forbidden|prohibited|cannot prove)\b/iu;
const RELEASE_BLOCKING = /\b(?:blocks?|prohibits?|prevents?)\s+(?:release|publication|deployment)\s+(?:until|unless|before)\b/iu;
const NEGATION = /不得|禁止|不(?:再|直接|自行|自动|额外|重复|独立)?(?:能|可|应|得|使用|修改|新增|增加|添加|创建|建立|让|执行|生成|运行|订阅|恢复|提交|实现|保存|保留|依赖|触发|等待|重启|引入|按|把|写|补写|补造|改变|改|阻塞|删除|重算|清空|停止|复制|伪造|虚构|触碰|连接|覆盖|使|因为|暂存|提供|扩大|裁剪|认为|接受|替换|省略|越过|重新|作为|为|参与|携带|进入|读取|读|轮询|经过|通过|与|以|由|在|包含|做|计算|持久化|推进|递增|发布|调用|换|猜测|纳入|计入|混用|用于|用|嵌套|封存)|不\s+(?:monkeypatch|patch)\b|\b(?:must not|shall not|do not|never|forbidden|prohibited|cannot)\b/iu;
const REQUIRED = /必须|应当|只能|一律|保持|保留|继续|等于|统一|\b(?:must|shall|required|retain|preserve)\b/iu;
const REQUIRED_PREDICATE = /使用|复用|沿用|接收|维护|发布|生成|保存|传递|串行|携带|标记|标为|返回|拒绝|释放|重建|读取|检查|重验|核对|断言|进入|只送|只计算|只提供|只加载|只结束|只适配|交给|交由|转交|追加|写入|迁到|改为|仍存在|始终有|重新请求|再次请求|建立|减去|删除|设置|运行|执行|调用|关闭|合并|加载|插入|重发|发出|去重|隔离|分配|切换|重评|记录|计数|驱动|停止|提交|提供|暂存|判(?:FAIL|BLOCKED)|只用|(?<!不)发恢复|插断点|交(?=[A-Z])|是[“"]|(?:^|后)用|\b(?:release|retain|reuse|return|assert|verify|publish|send|append|reject)\b/iu;
const PERMITTED = /可(?:在|以|用于|由|继续|限制|作为|使用|复用|合并|读取|检查|选择|保留|运行|执行|创建|发送|提供)|\b(?:may|permitted)\b/iu;
const CONDITION = /如果|只有|此前|之后|之前|失败|缺少|不存在|未确认|确认前|若|当|(?:不能|无法|不可|不命中|不匹配)[^，,。；]{0,100}(?:时|则|即)|\b(?:if|when|unless|until|before|after)\b/iu;
const SHELL = /^(?:powershell|pwsh|sh|bash|shell|cmd|console)$/iu;
const COMMAND = /(?:^|[`\s])(?:python(?:3)?\s+-m\s+|npm\s+|npx\s+|node\s+|pwsh(?:\.exe)?\s+|git\s+|rg\s+|\$env:)/u;

function declaredId(text) {
  const stripped = text.trim().replace(/^#{1,6}\s+|^(?:[-*+]\s+|\d+[.)]\s+)(?:\[[ xX]\]\s*)?/u, '');
  const firstCell = stripped.startsWith('|') ? stripped.split('|')[1].trim().replace(/^`|`$/gu, '') : stripped;
  return /^(?:Task\s+)?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)(?=\s*[:：]|\s*$)/u.exec(firstCell)?.[1] || null;
}

function lexicalKind(text) {
  if (!text.trim()) return 'blank';
  if (/^\s*(?:`{3,}|~{3,})/u.test(text)) return 'fence';
  if (/^#{1,6}\s+/u.test(text)) return 'heading';
  if (/^\*\*[^*]+\*\*\s*$/u.test(text)) return 'facet_heading';
  if (/^\s*\|/u.test(text)) return 'table_row';
  if (/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u.test(text)) return 'list_item';
  if (/^\s*>/u.test(text)) return 'blockquote';
  return 'paragraph';
}

function sourceRef(snapshot, bytes, first, last) {
  return { sourceArtifactId: snapshot.sourceArtifactId, sourceSnapshotHash: snapshot.sourceSnapshotHash,
    startByte: first.startByte, endByteExclusive: last.endByteExclusive,
    exactTextHash: sha256Text(bytes.subarray(first.startByte, last.endByteExclusive).toString('utf8')),
    lineStart: first.lineNumber, lineEnd: last.lineNumber };
}

function fieldRole(text) {
  if (/^\s*\|/u.test(text)) return null;
  const label = /^\s*(?:[-*+]\s+)?\*{0,2}([^:：\n]{1,60})[:：]/u.exec(text)?.[1].replace(/\*/gu, '').trim() || '';
  if (/^(?:前置(?:任务)?|依赖|dependencies?|depends on)$/iu.test(label)) return 'dependencies';
  if (/^applicability$/iu.test(label)) return 'applicability_condition';
  if (/^(?:对应工作包|Goal Tasks?|Tasks?|工作包)$/iu.test(label)) return 'task_reference';
  if (/^(?:验收|Acceptance)(?:引用)?$/iu.test(label)) return 'acceptance_reference';
  if (/^(?:对应修复|Fix(?:es| reference)?)(?:引用)?$/iu.test(label)) return 'fix_reference';
  if (/^(?:红灯|Red).*命令|^Red command$/iu.test(label)) return 'red_command';
  if (/^(?:绿灯|Green).*命令|^Green command$/iu.test(label)) return 'green_command';
  if (/回归命令|Regression command/iu.test(label)) return 'regression_command';
  if (/命令|^Command|^Run$/iu.test(label)) return 'command';
  if (/证据|^Evidence|^Receipt/iu.test(label)) return 'evidence';
  if (/禁止.*(?:路径|文件)|forbidden paths/iu.test(label)) return 'forbidden_paths';
  if (/产品.*(?:路径|文件)|Owned Production Paths|^Target modification paths$/iu.test(label)) return 'product_paths';
  if (/测试.*nodeid|test.*nodeid|^nodeids?$/iu.test(label)) return 'test_nodeid';
  if (/测试.*(?:路径|文件)/u.test(label)) return /nodeid/u.test(label) ? 'test_nodeid' : 'test_paths';
  if (/只读.*(?:路径|fixture)|fixture.*路径/u.test(label)) return 'readonly_fixture_paths';
  if (/Stop condition|停止条件/iu.test(label)) return 'stop_condition';
  if (/^(?:PASS|FAIL|BLOCKED)(?:\/BLOCKED)?$/u.test(label)) return `${label.toLowerCase().replace('/', '_or_')}_criterion`;
  if (/Atomic group|原子组/iu.test(label)) return 'atomic_group';
  if (/Purpose|目的/iu.test(label)) return 'purpose';
  if (/实施步骤|Steps/iu.test(label)) return 'implementation_steps';
  if (/初始状态/u.test(label)) return 'initial_state';
  if (/生产入口/u.test(label)) return 'production_entry';
  if (/操作/u.test(label)) return 'operations';
  if (/直接断言/u.test(label)) return 'direct_assertions';
  if (/清理|teardown/iu.test(label)) return 'teardown';
  return null;
}

function partition(snapshot, bytes) {
  const lines = snapshot.lineIndex.filter((line) => line.endByteExclusive > line.startByte)
    .map((line) => ({ ...line, text: bytes.subarray(line.startByte, line.contentEndByte).toString('utf8') }));
  const blocks = [];
  for (let index = 0; index < lines.length;) {
    const first = lines[index];
    let kind = lexicalKind(first.text);
    let end = index + 1;
    if (index === 0 && first.text === '---') {
      kind = 'frontmatter';
      while (end < lines.length && !/^(?:---|\.\.\.)\s*$/u.test(lines[end].text)) end++;
      if (end < lines.length) end++;
    } else if (kind === 'fence') {
      const marker = /^\s*(`{3,}|~{3,})/u.exec(first.text)[1];
      const closing = new RegExp(`^\\s*${marker[0]}{${marker.length},}\\s*$`, 'u');
      while (end < lines.length && !closing.test(lines[end].text)) end++;
      if (end < lines.length) end++;
    } else if (kind === 'paragraph' || kind === 'blank') {
      while (end < lines.length && lexicalKind(lines[end].text) === kind) end++;
    }
    const ref = sourceRef(snapshot, bytes, first, lines[end - 1]);
    const text = bytes.subarray(ref.startByte, ref.endByteExclusive).toString('utf8');
    const id = `source-block-${sha256Text(`${snapshot.sourceSnapshotHash}:${ref.startByte}:${ref.endByteExclusive}`).slice(7)}`;
    blocks.push({ id, kind, text, sourceRef: ref, declaredId: declaredId(text), fieldRole: fieldRole(text) });
    index = end;
  }
  return blocks;
}

function inheritedListRule(parent) {
  if (!parent) return null;
  const text = parent.text;
  if (/必须.*修复.*(?:问题|异常)|must.*repair.*(?:issues?|defects?)/iu.test(text)) return { disposition: 'observed_user_issue', polarity: 'descriptive', kind: 'repair_target' };
  if (/(?:只能|仅).*优化.*(?:以下|位置)|优化.*(?:只能|仅).*(?:以下|位置)|optimization.*(?:only|allowlist)/iu.test(text)) return { disposition: 'permitted_optimization_location', polarity: 'permitted', kind: 'optimization_allowlist' };
  if (/以下.*(?:不得|不能).*改变|不得.*改变.*(?:以下|语义)|preserve.*following/iu.test(text)) return { disposition: 'preserved_behavior', polarity: 'preserve', kind: 'preserved_semantics' };
  if (/(?:不允许|禁止|不得).*(?:架构|以下|方案)|prohibited.*(?:alternatives|architecture)/iu.test(text)) return { disposition: 'architecture_prohibition', polarity: 'forbidden', kind: 'prohibited_alternatives' };
  if (/(?:ingress|接收\s*Tick|接收行情).*(?:顺序|步骤)|(?:按以下顺序|固定步骤)/iu.test(text)) return { disposition: 'ordered_ingress_step', polarity: null, kind: 'ordered_ingress_step' };
  if (/(?:比较字段|comparison\s+fields?).*(?:固定|如下|following)|(?:closed|固定).*(?:comparison|比较字段)/iu.test(text)) return { disposition: 'comparison_field_member', polarity: 'required', kind: 'comparison_field_member' };
  if (/(?:以下事件|following events?).*(?:加载|刷新|refresh|load)/iu.test(text)) return { disposition: 'conditional_refresh_trigger', polarity: 'required', kind: 'conditional_refresh_trigger' };
  if (/(?:legacy contract|legacy\s+contract|legacy\s+契约).*(?:一次提供|following|如下)|(?:一次提供|following|如下).*(?:legacy contract|legacy\s+contract)/iu.test(text)) return { disposition: 'legacy_contract_field_member', polarity: 'required', kind: 'legacy_contract_field_member' };
  if (/(?:样本|fixture).*(?:必须覆盖|must cover).*(?:以下|following)/iu.test(text)) return { disposition: 'required_fixture_coverage', polarity: 'required', kind: 'required_fixture_coverage' };
  if (/顺序.*裁决|按以下顺序|priority order/iu.test(text)) return { disposition: 'ordered_authority', polarity: null, kind: 'authority_precedence' };
  if (/(?:确认.*(?:之前|之后|前|后))|confirmation/iu.test(text)) return { disposition: 'normative', polarity: null, kind: 'source_confirmation_gate' };
  if (/(?:必须|固定|如下|以下|只能|仅|不允许|禁止|不得|一次提供)|(?:must|required|following)/iu.test(text)) return { disposition: 'normative', polarity: null, kind: 'declared_list_inheritance' };
  return null;
}

function scopeFor(block, headings, namedOwner) {
  const owner = block.declaredId ? block : namedOwner || [...headings].reverse().find((entry) => entry.declaredId);
  const id = owner?.declaredId || '';
  return { kind: /^AC-/u.test(id) ? 'acceptance' : /^WORK-|(?:^|-)T\d+[A-Z]?$/u.test(id) ? 'task'
    : /^FIX-/u.test(id) ? 'fix' : 'source_section', ownerId: id || null,
  ownerBlockRefs: owner ? [owner.id] : headings.length ? [headings.at(-1).id] : [] };
}

function classifyBlock(block, context) {
  if (block.kind === 'frontmatter') return ['metadata', 'Frontmatter records source status, not execution authorization.'];
  if (block.kind === 'blank') return ['layout', 'Retained layout covers the original source bytes.'];
  if (block.kind === 'blockquote' && /^(?:>\s*)+$/u.test(block.text.trim())) {
    return ['structure', 'Empty quote markers retain source layout without declaring an obligation.'];
  }
  if (['heading', 'facet_heading'].includes(block.kind)) {
    if (!block.declaredId && /\b(?:must|shall)\b|(?:^|\s)(?:必须|禁止|不得)/iu.test(block.text)
      && !/(?:的|所需的)(?:旧语义|最小修改|替代架构)/u.test(block.text)) return ['normative', 'The heading itself states an explicit normative sentence.'];
    return ['structure', 'A heading defines a container or declared identity, not an independent command.'];
  }
  if (block.kind === 'table_row' && context.tableHeader) return ['structure', 'Table header or delimiter supplies column semantics.'];
  if (block.kind === 'paragraph' && block.text.trim().split(/\r?\n/u).every((line) =>
    /^\s*\*{0,2}(?:Execution Class|Owned Production Paths|Aggregate Gate Phase|Aggregate Validation Commands)\*{0,2}\s*[:：]/iu.test(line))) {
    return ['association', 'Task execution metadata binds to its declared task owner without creating another obligation.'];
  }
  if (context.reviewPending) return ['review_pending', 'A source review checklist is not an executed acceptance result.'];
  if (context.example) return ['example', 'Explicit example content is not a production task declaration.'];
  if (context.background && !STRONG_PROHIBITION.test(block.text) && !/\b(?:must|shall|should|may)\b|必须|应当|建议/iu.test(block.text)) return ['background', 'The source explicitly identifies background or explanatory material.'];
  if (context.baseline) return ['baseline_fact', 'This source container reports prior behavior.'];
  if (context.deviation && !STRONG_PROHIBITION.test(block.text) && !/必须|\bmust\b/iu.test(block.text)) return ['observed_deviation', 'Observed defects are not desired outcomes.'];
  if (context.deviation && /不能证明|cannot prove/iu.test(block.text)) return ['evidence_use_boundary', 'The clause restricts proof claims even inside a deviation container.'];
  if (context.historical) return /(?:可用于|不能证明|不解除|不得.*通过)/u.test(block.text)
    ? ['mixed_evidence_and_normative', 'Historical evidence and active proof boundaries require separate clause classification.']
    : ['historical_evidence', 'Existing source evidence is not a result from this execution.'];
  if (/^(?:[-*+]\s+)?`?[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*`?(?:[ \t]+references[ \t]+`?[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*`?)+\.?$/u.test(block.text.trim())) {
    return ['association', 'An exact ID references chain declares a source association, not an implementation action.'];
  }
  if (/^\s*(?:[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\s*(?:->|→|=>)\s*)+[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\s*$/u.test(block.text)) {
    return ['association', 'An explicit task chain declares dependencies, not an implementation action.'];
  }
  if (/\b(?:remains|is|are)\s+excluded\b/iu.test(block.text)) {
    return ['normative', 'A current source exclusion declares a boundary; observational containers were classified first.'];
  }
  if (['product_paths', 'test_paths'].includes(block.fieldRole)) return ['scope_declaration', 'The labeled field declares product or test scope.'];
  if (block.fieldRole === 'readonly_fixture_paths') return ['input_declaration', 'The labeled field declares read-only inputs.'];
  if (block.fieldRole === 'evidence') return ['evidence_requirement', 'The labeled field requires evidence, not an observed PASS.'];
  if (/command$/u.test(block.fieldRole || '') || (block.kind === 'fence' && SHELL.test(block.fenceLanguage))) return ['command_declaration', 'Source-declared shell text is retained without execution.'];
  if (/reference$/u.test(block.fieldRole || '') || ['dependencies', 'test_nodeid', 'atomic_group', 'applicability_condition'].includes(block.fieldRole)) return ['association', 'A labeled relationship is retained with its source owner.'];
  if (block.kind === 'table_row' && context.tableAssociation) return ['association', 'Table columns explicitly associate source records.'];
  if (block.kind === 'table_row' && context.tableNormative) return ['normative', 'Explicit responsibility and prohibition columns supply the row authority.'];
  if (context.listRule) return [context.listRule.disposition, 'The list inherits the explicit preceding source declaration.'];
  if (block.kind === 'fence' && context.normativeContainer) return ['normative', 'An explicit normative container supplies authority to this non-shell specification or flow.'];
  if (/本文件.*(?:唯一|冻结)|(?:用户|人工).*确认.*(?:之前|前)|只(?:更新|替换)|不替换|固定.*(?:流程|顺序|为)|(?:流程|顺序).*固定为/u.test(block.text)) {
    return ['normative', 'An explicit source-authority, confirmation boundary, restricted change, or fixed-flow declaration supplies normative context.'];
  }
  if (block.declaredId || context.namedOwner || block.fieldRole
    || context.normativeContainer && ['list_item', 'fence', 'blockquote', 'table_row'].includes(block.kind)
    || STRONG_PROHIBITION.test(block.text) || RELEASE_BLOCKING.test(block.text) || REQUIRED.test(block.text)
    || PERMITTED.test(block.text) || CONDITION.test(block.text) && REQUIRED_PREDICATE.test(block.text)
    || /^(?:[-*+]\s+)?(?:>\s*)?(?:Run|Create|Modify|Add|Fail|Stop|Steps|Preserve)\b/u.test(block.text)) {
    return ['normative', 'Source text declares a requirement, explicit modality, typed field, or inherited list/table item.'];
  }
  return ['unresolved', 'No deterministic normative or descriptive role was established; retain the source for clarification.'];
}

function inheritIndentedPathFields(blocks) {
  const pathFields = new Set(['product_paths', 'test_paths', 'readonly_fixture_paths', 'forbidden_paths']);
  const parents = [];
  for (const block of blocks) {
    if (block.kind === 'blank') continue;
    if (block.kind !== 'list_item' || /^ *\t/u.test(block.text)) { parents.length = 0; continue; }
    const indent = /^ */u.exec(block.text)[0].length;
    while (parents.length && parents.at(-1).indent >= indent) parents.pop();
    const parent = parents.at(-1)?.block;
    if (!block.fieldRole && parent && pathFields.has(parent.fieldRole) &&
      /^\s*(?:[-*+]|\d+[.)])\s+`[^`\r\n]+`[.;]?\s*$/u.test(block.text)) {
      block.fieldRole = parent.fieldRole;
      block.inheritedFieldFrom = parent.id;
    }
    parents.push({ block, indent });
  }
  return blocks;
}

function attachContexts(blocks) {
  const headings = [];
  let facet = null;
  let namedOwner = null;
  let parent = null;
  let table = null;
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    if (block.kind === 'heading') {
      const level = /^#+/u.exec(block.text)[0].length;
      while (headings.length && headings.at(-1).level >= level) headings.pop();
      headings.push({ id: block.id, level, title: block.text.trim().replace(/^#+\s+/u, ''), declaredId: block.declaredId });
      facet = null; namedOwner = null; parent = inheritedListRule(block) ? block : null; table = null;
    } else if (block.kind === 'facet_heading') { facet = block; parent = inheritedListRule(block) ? block : null; namedOwner = null; }
    if (block.kind === 'table_row' && /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/u.test(blocks[index + 1]?.text || '')) table = block;
    const titles = [...headings.map((entry) => entry.title), facet?.text || ''].join('\n');
    const listRule = block.kind === 'list_item' || (block.kind === 'fence' && /确认|confirmation/iu.test(parent?.text || '')) ? inheritedListRule(parent) : null;
    const context = { namedOwner: Boolean(namedOwner), listRule,
      tableHeader: block === table || /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/u.test(block.text),
      tableAssociation: table && /scenario|场景/iu.test(table.text) && /nodeid|工作包|Task/iu.test(table.text),
      tableNormative: table && /职责|responsibilit/iu.test(table.text) && /禁止|forbidden|must not/iu.test(table.text),
      example: /(?:^|\n)(?:\d+[.\d]*\s*)?(?:example|示例)(?:\b|\s|[:：]|$)/iu.test(titles),
      background: /(?:^|\n)(?:background|notes|description|problem statement|背景|说明)(?:\b|\s|[:：]|$)/iu.test(titles),
      normativeContainer: Boolean(namedOwner || headings.some((entry) => entry.declaredId))
        || Boolean(parent?.disposition === 'normative' && /[:：]\s*$/u.test(parent.text))
        || /requirements?|implementation|\btasks?\b|acceptance|verification|\brules?\b|contract|goal|completion|risk controls|release sequencing|业务目标|需求|数据流|执行边界|职责|验收|性能|流程|规则|必须|最小修改|目标.*拓扑|target.*topology/iu.test(titles),
      baseline: /实际行为|旧行为基线|legacy baseline|previous behavior/iu.test(facet?.text || ''),
      deviation: /当前实现偏差|当前.*问题|observed (?:defects|deviations)|current (?:defects|deviations)/iu.test(titles),
      historical: /证据.*(?:冻结状态|检查状态)|historical evidence|evidence snapshot/iu.test(titles),
      reviewPending: /(?:用户|人工).*(?:确认清单|审阅|检查)|review checklist/iu.test(titles),
      acceptanceScenario: /真实场景验收|acceptance scenarios?/iu.test(titles),
    };
    Object.assign(block, { headingPath: headings.map((entry) => entry.title),
      parentBlockRefs: [...headings.map((entry) => entry.id), ...(facet ? [facet.id] : []), ...(namedOwner ? [namedOwner.id] : []),
        ...(block.inheritedFieldFrom ? [block.inheritedFieldFrom] : [])],
      scope: scopeFor(block, headings, namedOwner), context,
      inheritedFrom: listRule ? parent.id : null,
      tableHeaderRef: table?.id || null,
      fenceLanguage: block.kind === 'fence' ? /^\s*(?:`{3,}|~{3,})([^\s]*)/u.exec(block.text)?.[1] || '' : null,
    });
    [block.disposition, block.reason] = classifyBlock(block, context);
    if (context.tableAssociation && block.declaredId) {
      block.scope = { kind: 'source_association', ownerId: block.declaredId, ownerBlockRefs: [table.id, block.id] };
      block.declaredId = null;
    }
    if (block.declaredId && !['heading', 'table_row'].includes(block.kind)) namedOwner = block;
    if (block.kind === 'paragraph') parent = block;
    if (!['blank', 'table_row'].includes(block.kind)) table = null;
  }
  return blocks;
}

function clausePieces(text, kind) {
  if (kind === 'fence') return [{ text, start: 0 }];
  const parts = [];
  let start = 0;
  let inline = false;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '`') inline = !inline;
    if (!inline && /[。；]/u.test(text[index])) {
      parts.push({ text: text.slice(start, index + 1), start });
      start = index + 1;
    }
  }
  if (start < text.length) parts.push({ text: text.slice(start), start });
  return parts.filter((part) => part.text.trim());
}

function modalitiesOf(text, { sourceUsageConstraint = false } = {}) {
  const plain = text.replace(/`[^`]*`/gu, '').replace(/(?:明确)?禁止(?:行为|事项|清单)|prohibited behaviors/giu, '')
    .replace(/可(?:执行|运行)(?=命令|证据|文件|脚本|程序)/gu, '')
    .replace(/才可(?:以)?执行/gu, '必须执行')
    .replace(/不可重复(?=边界)/gu, '')
    .replace(/(?:如果|若)[^，,。；]{0,100}[，,]/gu, '')
    .replace(/\b(?:if|when|unless|until)\b[^,\n.;]{0,160},/giu, '')
    .replace(/(?:不能(?!在)|无法(?!在)|不可(?!在)|不(?:匹配|命中|相等|存在|满足))[^，,。；]{0,100}?(?:时|则|即)/gu, '')
    .replace(/不(?:依赖|命中|参与|变化|可变)[^，,。；]{0,80}?的/gu, '')
    // Negation inside an assertion describes its expected state, not a forbidden assertion action.
    .replace(/(?:断言|\bassert(?:\s+that)?\b|\bverify\s+that\b)[\s\S]*?(?=(?:但|but|并且)\s*(?:不得|禁止|must not|do not)|$)/giu, '必须断言结果');
  const modalities = new Set();
  const units = plain.split(/[,，]|\bbut\b|但是|而是|但(?=必须|不得|不能|只能|可)|(?:并且|且|并)(?=(?:立即)?(?:必须|不得|禁止|不覆盖|只能|把|交|请求|返回|释放|release))/iu);
  for (const unit of units) {
    if (/不等于/u.test(unit) && !STRONG_PROHIBITION.test(unit)) modalities.add('required');
    if (NEGATION.test(unit) || RELEASE_BLOCKING.test(unit) || /\b(?:remains|is|are)\s+excluded\b/iu.test(unit)) modalities.add('forbidden');
    else if (PERMITTED.test(unit) && !REQUIRED.test(unit)) modalities.add('permitted');
    else {
      if (REQUIRED.test(unit) || REQUIRED_PREDICATE.test(unit) || sourceUsageConstraint && /用于/u.test(unit)) modalities.add('required');
      if (/逐(?:个|一)(?:审计|验证|核对)/u.test(unit)) modalities.add('required');
    }
  }
  return ['required', 'forbidden', 'permitted'].filter((mode) => modalities.has(mode));
}

function attachClauses(blocks, bytes) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  for (const block of blocks) {
    if (['metadata', 'layout', 'structure', 'example'].includes(block.disposition)) { block.clauses = []; continue; }
    let pieces = clausePieces(block.text, block.kind);
    const table = byId.get(block.tableHeaderRef);
    if (table) {
      const headers = [...table.text.matchAll(/\|([^|]+)/gu)].map((match) => match[1].trim());
      const bindings = headers.map((header) => /^(?:后续|对应)?(?:绑定|关联|引用)|^(?:references?|bindings?|related)\b/iu.test(header));
      if (bindings.some(Boolean)) {
        const semanticCells = [...block.text.matchAll(/\|([^|]+)/gu)].flatMap((cell, column) =>
          bindings[column] || /^(?:审计)?ID$|^(?:audit\s+)?id$/iu.test(headers[column] || '')
            ? [] : [{ start: cell.index + 1, end: cell.index + 1 + cell[1].length }]);
        pieces = pieces.map((piece) => ({ ...piece, semanticText: semanticCells.map((cell) => {
          const start = Math.max(cell.start, piece.start);
          const end = Math.min(cell.end, piece.start + piece.text.length);
          return end > start ? block.text.slice(start, end) : '';
        }).join('') }));
      }
    }
    const responsibilityTable = table && /职责|responsibilit/iu.test(table.text) && /禁止|forbidden|must not/iu.test(table.text);
    if (responsibilityTable) pieces = [...block.text.matchAll(/\|([^|]+)/gu)].slice(1, 3)
      .map((match, index) => ({ text: match[1], start: match.index + 1, columnPolarity: index === 0 ? 'required' : 'forbidden' }));
    block.clauses = pieces.map((piece, index) => {
      let disposition = block.disposition;
      const semanticText = piece.semanticText ?? piece.text;
      let modalities = modalitiesOf(semanticText, { sourceUsageConstraint: Boolean(block.declaredId || block.fieldRole) });
      if (piece.semanticText !== undefined && !piece.semanticText.trim()) disposition = 'background';
      if (disposition === 'mixed_evidence_and_normative') {
        disposition = /不解除/u.test(piece.text) ? 'preserved_gate'
          : /可用于|用于离线|不能证明|不得.*通过/u.test(piece.text) ? 'evidence_use_boundary' : 'historical_evidence';
      }
      if (/^\s*(?:当前)?(?:仓库|项目)(?:目前|当前)?(?:没有|尚无|不存在)[^，,。；]{0,100}(?:权威|规范|基线)\s*[。；]?\s*$/u.test(semanticText)
        || /^\s*(?:the\s+)?(?:repository|project)\s+(?:has no|lacks)\s+[^,.;]{0,100}\b(?:authority|baseline|standard)\s*[.;]?\s*$/iu.test(semanticText)
        || /^(?:本|该)?(?:文件|文档)(?:的)?(?:当前|目前)?状态(?:为|是)[^。；]{0,80}(?:待|pending)/iu.test(semanticText.trim())
        || /^(?:用户|人工)[^。；]{0,80}确认[^。；]{0,80}(?:之前|前)[:：]\s*$/u.test(semanticText.trim())) disposition = 'baseline_fact';
      const observational = ['background', 'baseline_fact', 'observed_deviation', 'observed_user_issue', 'historical_evidence', 'review_pending'].includes(disposition);
      if (observational) modalities = ['descriptive'];
      if (disposition === 'evidence_use_boundary' && /用于离线/u.test(piece.text) && !NEGATION.test(piece.text)) modalities = ['permitted'];
      let polarity = observational ? 'descriptive' : modalities.length > 1 ? 'mixed' : modalities[0] || 'required';
      const inheritedPolarity = block.context.listRule?.polarity;
      if (inheritedPolarity && (!modalities.length || ['preserve', 'descriptive'].includes(inheritedPolarity)
        || inheritedPolarity === 'permitted' && !REQUIRED.test(semanticText) && !NEGATION.test(semanticText))) {
        polarity = inheritedPolarity;
        modalities = [inheritedPolarity];
      }
      else if (inheritedPolarity && modalities.some((mode) => mode !== inheritedPolarity)) disposition = 'normative';
      if (piece.columnPolarity) { polarity = piece.columnPolarity; modalities = [polarity]; }
      if (disposition === 'preserved_gate') polarity = 'preserve';
      if (/只是.*验证样本.*不是.*唯一|validation sample.*not.*only/iu.test(piece.text)) polarity = 'preserve';
      if (disposition === 'unresolved') { polarity = 'unresolved'; modalities = []; }
      const implicitExpectedState = block.context.acceptanceScenario && /后\s*[,，]/u.test(semanticText)
        && /仍(?:存在|保持|有效)|still\s+(?:contains?|exists?|remains?)/iu.test(semanticText);
      const roleExpectedState = ['direct_assertions', 'pass_criterion', 'fail_criterion', 'fail_or_blocked_criterion'].includes(block.fieldRole)
        || block.fieldRole === 'purpose' && /[:：]\s*(?:确保|ensure that)/iu.test(block.text) || implicitExpectedState;
      if (!observational && !STRONG_PROHIBITION.test(semanticText) && roleExpectedState) {
        polarity = 'required'; modalities = ['required'];
      }
      const parent = byId.get(block.inheritedFrom);
      const conditions = CONDITION.test(piece.text) || block.fieldRole === 'dependencies' || implicitExpectedState
        ? [{ kind: 'source_condition', text: piece.text, sourceBlockRefs: [block.id] }] : [];
      const currentRound = /本轮|当前轮次|current (?:authoring )?round/iu.test(piece.text);
      if (currentRound) conditions.push({ kind: 'current_authoring_round', text: piece.text, sourceBlockRefs: [block.id] });
      if (parent && !(currentRound && block.context.listRule.kind === 'source_confirmation_gate')) conditions.push({ kind: block.context.listRule.kind, text: parent.text, sourceBlockRefs: [parent.id] });
      const startByte = block.sourceRef.startByte + Buffer.byteLength(block.text.slice(0, piece.start));
      const endByteExclusive = startByte + Buffer.byteLength(piece.text);
      const source = bytes.subarray(startByte, endByteExclusive);
      return { id: `${block.id}:clause-${index + 1}`, text: piece.text,
        sourceRef: { ...block.sourceRef, startByte, endByteExclusive, exactTextHash: sha256Text(source.toString('utf8')) },
        disposition, polarity, modalities, scope: currentRound ? { kind: 'current_authoring_round', ownerBlockRefs: [block.id] } : block.scope, conditions,
        derivation: { status: disposition === 'unresolved' ? 'unresolved' : modalities.length && !parent ? 'source_declared' : 'derived',
          ruleId: piece.columnPolarity ? 'responsibility-table-columns/v1' : parent ? `${block.context.listRule.kind}/v1`
            : observational ? 'explicit-observation-container/v1' : modalities.length ? 'clause-scoped-modality/v1' : 'declared-normative-container/v1',
          premiseBlockRefs: [...new Set([block.id, ...(parent ? [parent.id] : []), ...(table ? [table.id] : []), ...block.parentBlockRefs])] },
        expectedOutcome: { kind: observational ? 'not_a_current_run_result' : polarity === 'forbidden' ? 'source_prohibited_state' : 'source_required_state',
          assertionText: piece.text, declaredVerdicts: [...new Set(piece.text.match(/\b(?:PASS|FAIL|BLOCKED|FAILED|COMPLETE|ABORTED)\b/gu) || [])] },
      };
    });
  }
  return blocks;
}

function compileSourceBlocksInternal({ snapshot, sourceBytes }) {
  new TextDecoder('utf-8', { fatal: true }).decode(sourceBytes);
  const sourceBlocks = attachClauses(attachContexts(inheritIndentedPathFields(partition(snapshot, sourceBytes))), sourceBytes);
  let offset = 0;
  for (const block of sourceBlocks) {
    if (block.sourceRef.startByte !== offset) throw new Error('source_block_partition_invalid');
    offset = block.sourceRef.endByteExclusive;
    delete block.context;
  }
  if (offset !== sourceBytes.length) throw new Error('source_block_partition_invalid');
  const sourceRelations = attachDeclarations(sourceBlocks, snapshot, sourceBytes);
  return { sourceBlocks, sourceRelations, sourceCoverage: { sourceBytes: sourceBytes.length, coveredBytes: offset,
    uncoveredByteRanges: [], unresolvedBlockRefs: sourceBlocks.filter((block) => block.disposition === 'unresolved').map((block) => block.id),
    sourceBlocksHash: sha256Text(stableStringify(sourceBlocks)) } };
}

function fragmentRef(block, snapshot, bytes, start, end) {
  const startByte = block.sourceRef.startByte + Buffer.byteLength(block.text.slice(0, start));
  const endByteExclusive = block.sourceRef.startByte + Buffer.byteLength(block.text.slice(0, end));
  const first = snapshot.lineIndex.find((line) => startByte >= line.startByte && startByte < line.endByteExclusive);
  const last = snapshot.lineIndex.find((line) => endByteExclusive > line.startByte && endByteExclusive <= line.endByteExclusive);
  return { ...block.sourceRef, startByte, endByteExclusive, lineStart: first.lineNumber, lineEnd: last.lineNumber,
    exactTextHash: sha256Text(bytes.subarray(startByte, endByteExclusive).toString('utf8')) };
}

function commandFragments(block) {
  if (['metadata', 'layout', 'structure', 'example', 'background', 'baseline_fact', 'observed_deviation', 'historical_evidence', 'review_pending', 'unresolved'].includes(block.disposition)) return [];
  if (block.kind !== 'fence') return [...block.text.matchAll(/`([^`]+)`/gu)]
    .filter((match) => COMMAND.test(match[1]) && !/^\$env:\s*$/u.test(match[1])
      && !/^pwsh(?:\.exe)?\s+-(?:Command|File)\s*$/iu.test(match[1]))
    .map((match) => ({ start: match.index + 1, end: match.index + 1 + match[1].length }));
  if (!SHELL.test(block.fenceLanguage)) return [];
  const fragments = [];
  const lines = [...block.text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/gu)].filter((match) => match[0]);
  for (let index = 1; index < lines.length - 1; index++) {
    const line = lines[index];
    if (!line[0].trim() || /^\s*#/u.test(line[0])) continue;
    let end = index;
    while (end + 1 < lines.length - 1 && /[`\\]\s*(?:\r?\n|\r)$/u.test(lines[end][0])) end++;
    fragments.push({ start: line.index, end: lines[end].index + lines[end][0].replace(/[\r\n]+$/u, '').length });
    index = end;
  }
  return fragments;
}

function typedIdKind(id) {
  if (/^AC-|(?:^|-)AC\d/u.test(id)) return 'acceptance';
  if (/^CMD-|(?:^|-)CMD\d/u.test(id)) return 'command';
  if (/^EVD-|(?:^|-)EVD\d/u.test(id)) return 'evidence';
  if (/^WORK-|(?:^|-)T\d+[A-Z]?$/u.test(id)) return 'task';
  if (/^FIX-/u.test(id)) return 'fix';
  if (/^REQ-/u.test(id)) return 'requirement';
  return null;
}

function explicitPathRole(block, match) {
  const declared = ({ product_paths: 'owned', test_paths: 'owned', forbidden_paths: 'forbidden',
    readonly_fixture_paths: 'input', evidence: 'artifact' })[block.fieldRole];
  if (declared) return declared;
  if (['background', 'example', 'historical_evidence', 'baseline_fact', 'observed_deviation', 'unresolved'].includes(block.disposition)) return null;
  const prefix = block.text.slice(0, match.index).split(/[。；,\n]/u).at(-1);
  if (NEGATION.test(prefix) && /mutate|modify|write|delete|修改|写|删除/iu.test(prefix)) return 'forbidden';
  if (/(?:^|\s)(?:Modify|Create|Add|Delete)\s+(?:files?\s+)?$/iu.test(prefix) || /(?:新增|修改|创建|删除)(?:文件|路径)?\s*$/u.test(prefix)) return 'owned';
  if (block.headingPath.some((title) => /completion evidence|evidence packet|证据包|证据交付/iu.test(title))
    && /preserve|retain|required|must|保留|必须/iu.test(block.text)) return 'artifact';
  return null;
}

function explicitRangeIds(text, known) {
  const expanded = new Map();
  const ranges = /\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*?)-(\d+)\s*(?:至|到|\.\.|through|to|~)\s*\1-(\d+)\b/gu;
  for (const match of text.matchAll(ranges)) {
    const first = Number(match[2]);
    const last = Number(match[3]);
    if (last < first || last - first >= known.size) throw Object.assign(new Error('source_obligation_range_unresolved'), { failureClass: 'source_obligation_range_unresolved', range: match[0] });
    for (let value = first; value <= last; value++) {
      const id = `${match[1]}-${String(value).padStart(match[2].length, '0')}`;
      if (!known.has(id)) throw Object.assign(new Error('source_obligation_dependency_unknown'), { failureClass: 'source_obligation_dependency_unknown', dependencyId: id, range: match[0] });
      expanded.set(id, match[0]);
    }
  }
  return expanded;
}

function attachReferenceResolutions(blocks, relations, known) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const declarations = new Map(blocks.filter((block) => block.declaredId).map((block) => [block.declaredId, block.id]));
  const ownerOf = (block) => block.declaredId || block.scope.ownerId;
  const targetsOf = (block) => [...new Set([...(block.text.match(ID_PATTERN) || []).filter((id) => known.has(id)), ...explicitRangeIds(block.text, known).keys()])];
  const under = (block, target) => ownerOf(block) === target || block.parentBlockRefs.includes(declarations.get(target));
  const sectionOf = (block) => [...block.parentBlockRefs].reverse().find((id) => byId.get(id)?.kind === 'heading' && !byId.get(id).declaredId);
  const add = (block, kind, target, targetType, premises, details = {}) => {
    const sourceBlockRefs = [...new Set([block.id, ...premises])];
    if (block.typedRefs.some((ref) => ref.kind === kind && ref.targetId === target && ref.pathRole === details.pathRole)) return;
    block.typedRefs.push({ kind, targetId: target, targetType, relation: 'inherited', sourceBlockRefs, ...details });
    relations.push({ kind, fromType: ownerOf(block) ? 'obligation' : 'block', fromId: ownerOf(block) || block.id,
      toType: targetType, toId: target, sourceBlockRefs, declarationStatus: 'derived', relation: 'inherited', ...details });
  };
  const pathCache = new Map();
  const pathsFor = (block, visited = new Set()) => {
    if (visited.has(block.id)) return [];
    if (pathCache.has(block.id)) return pathCache.get(block.id);
    const nextVisited = new Set([...visited, block.id]);
    const paths = block.typedRefs.filter((ref) => ref.kind === 'path' && ref.pathRole === 'owned')
      .map((ref) => ({ path: ref.targetId, premises: ref.sourceBlockRefs, sourceRef: ref.sourceRef }));
    if (block.fieldRole === 'test_nodeid') for (const match of block.text.matchAll(/`([^`]+)`/gu)) {
      const file = match[1].split('::')[0];
      if (/^(?:[\w.-]+\/)+[^\s]+\.py$/u.test(file)) paths.push({ path: file, premises: [block.id], sourceRef: block.sourceRef });
    }
    if (!['test_paths', 'product_paths'].includes(block.fieldRole)) return paths;
    const candidates = [];
    for (const target of targetsOf(block)) candidates.push(...blocks.filter((candidate) => candidate.id !== block.id && under(candidate, target)
      && (candidate.fieldRole === block.fieldRole || block.fieldRole === 'test_paths' && candidate.fieldRole === 'test_nodeid')));
    if (block.fieldRole === 'test_paths' && /本节全部明确测试文件|all (?:explicit )?test files in this section/iu.test(block.text)) {
      const section = sectionOf(block);
      candidates.push(...blocks.filter((candidate) => candidate.id !== block.id && sectionOf(candidate) === section && candidate.fieldRole === 'test_paths'));
    }
    for (const candidate of candidates) for (const path of pathsFor(candidate, nextVisited)) {
      paths.push({ ...path, premises: [...new Set([block.id, candidate.id, ...path.premises])] });
    }
    const unique = [...new Map(paths.map((item) => [item.path, item])).values()];
    pathCache.set(block.id, unique);
    return unique;
  };
  for (const block of blocks.filter((item) => ['test_paths', 'product_paths'].includes(item.fieldRole))) {
    for (const path of pathsFor(block)) add(block, 'path', path.path, 'path', path.premises, {
      pathRole: 'owned', fieldRole: block.fieldRole, sourceRef: path.sourceRef,
      derivationRuleId: 'explicit-source-path-reference/v1', sourcePathExpression: block.text.trim(),
    });
  }
  for (const block of blocks) for (const ref of [...block.typedRefs]) {
    if (ref.kind !== 'command' || typedIdKind(ref.targetId) !== 'command') continue;
    const declaration = byId.get(declarations.get(ref.targetId));
    if (!declaration) continue;
    for (const command of declaration.commandDeclarations) add(block, 'command', command.id, 'command_declaration',
      [declaration.id, ...ref.sourceBlockRefs], { declaredCommandRef: ref.targetId,
        derivationRuleId: 'explicit-command-declaration-reference/v1', commandRelation: 'declared_command_alias',
        executionStatus: 'source_declared_not_executed', authorization: 'not_granted_by_source_declaration' });
  }
  for (const block of blocks.filter((item) => /command$/u.test(item.fieldRole || '')
    && (!item.commandDeclarations.length && !item.typedRefs.some((ref) => ref.kind === 'command')
      || /各(?:AC|验收|场景)\s*(?:nodeid|命令)|all\s+(?:acceptance|scenario)\s+(?:commands|nodeids)/iu.test(item.text)))) {
    const candidates = [];
    if (/各(?:AC|验收|场景)\s*(?:nodeid|命令)|all\s+(?:acceptance|scenario)\s+(?:commands|nodeids)/iu.test(block.text)) {
      candidates.push(...blocks.filter((candidate) => candidate.scope.kind === 'acceptance'));
    }
    for (const target of targetsOf(block)) candidates.push(...blocks.filter((candidate) => under(candidate, target)
      && (block.fieldRole !== 'regression_command' || !/^WORK-/u.test(target) || candidate.fieldRole === 'regression_command')));
    for (const match of block.text.matchAll(/第(\d+(?:\.\d+)*)节|section\s+(\d+(?:\.\d+)*)/giu)) {
      const number = match[1] || match[2];
      const section = blocks.find((candidate) => candidate.kind === 'heading' && new RegExp(`^#{1,6}\\s+${number.replace(/\./gu, '\\.')}[.\\s:：]`, 'u').test(candidate.text));
      if (section) candidates.push(...blocks.filter((candidate) => candidate.parentBlockRefs.includes(section.id)
        && (!/scenario|场景/iu.test(block.text) || candidate.scope.kind === 'acceptance')));
    }
    for (const candidate of candidates) for (const command of candidate.commandDeclarations) add(block, 'command', command.id, 'command_declaration', [candidate.id], {
      derivationRuleId: 'explicit-source-command-set/v1', commandRelation: 'command_set_includes',
      executionStatus: 'source_declared_not_executed', authorization: 'not_granted_by_source_declaration',
    });
    if (!block.typedRefs.some((ref) => ref.kind === 'command') && /对应AC|corresponding (?:acceptance|scenario)/iu.test(block.text)) {
      add(block, 'conditional_command_selection', block.id, 'block', [block.id], { resolutionStatus: 'conditional',
        derivationRuleId: 'conditional-source-command-selection/v1', sourceCondition: block.text.trim(),
        clauseRefs: block.clauses.map((clause) => clause.id), executionStatus: 'source_declared_not_executed' });
    }
  }
}

function attachTaskLocalDeclarations(blocks, relations) {
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const excluded = new Set(['metadata', 'layout', 'example', 'background', 'baseline_fact',
    'observed_deviation', 'historical_evidence', 'review_pending', 'unresolved']);
  for (const block of blocks) {
    const kind = typedIdKind(block.declaredId || '');
    if (!['acceptance', 'command', 'evidence'].includes(kind) || excluded.has(block.disposition)) continue;
    const owner = [...block.parentBlockRefs].reverse().map((id) => byId.get(id)).find((candidate) =>
      candidate?.kind === 'heading' && typedIdKind(candidate.declaredId || '') === 'task');
    if (!owner || excluded.has(owner.disposition)) continue;
    const targets = kind === 'command' ? block.commandDeclarations.map((command) => command.id) : [block.declaredId];
    for (const targetId of targets) {
      const sourceBlockRefs = [owner.id, block.id];
      const detail = { relation: 'inherited', derivationRuleId: 'nearest-declared-task-local-declaration/v1' };
      if (relations.some((edge) => edge.fromType === 'obligation' && edge.fromId === owner.declaredId &&
        edge.kind === kind && edge.toId === targetId)) continue;
      owner.typedRefs.push({ kind, targetId, sourceBlockRefs, ...detail });
      relations.push({ kind, fromType: 'obligation', fromId: owner.declaredId,
        toType: kind === 'command' ? 'command_declaration' : 'obligation', toId: targetId,
        sourceBlockRefs, declarationStatus: 'derived', ...detail });
    }
  }
}

function attachDeclarations(blocks, snapshot, bytes) {
  const relations = [];
  const known = new Set(blocks.map((block) => block.declaredId).filter(Boolean));
  const lastRed = new Map();
  for (const block of blocks) {
    block.commandDeclarations = commandFragments(block).map((fragment) => {
      const source = fragmentRef(block, snapshot, bytes, fragment.start, fragment.end);
      const clauses = block.clauses.filter((clause) => clause.sourceRef.startByte <= source.startByte && clause.sourceRef.endByteExclusive >= source.endByteExclusive);
      const forbidden = clauses.some((clause) => clause.polarity === 'forbidden');
      return { id: `source-command-${sha256Text(`${block.id}:${fragment.start}:${fragment.end}`).slice(7)}`,
        invocation: block.text.slice(fragment.start, fragment.end), sourceRef: source, clauseRefs: clauses.map((clause) => clause.id),
        polarity: forbidden ? 'forbidden' : 'source_declared', authorization: forbidden ? 'prohibited' : 'not_granted_by_source_declaration',
        executionStatus: 'source_declared_not_executed', portability: 'not_executed' };
    });
    const ownerId = block.declaredId || block.scope.ownerId;
    const ownerType = ownerId ? 'obligation' : 'block';
    const fromId = ownerId || block.id;
    block.typedRefs = [];
    if (block.declaredId) relations.push({ kind: 'declares', fromType: 'block', fromId: block.id, toType: 'obligation',
      toId: block.declaredId, sourceBlockRefs: [block.id], declarationStatus: 'source_declared' });
    if (block.scope.ownerId) relations.push({ kind: 'declared_owner', fromType: 'block', fromId: block.id, toType: 'obligation',
      toId: block.scope.ownerId, sourceBlockRefs: [...new Set([block.id, ...block.scope.ownerBlockRefs])], declarationStatus: 'source_declared' });
    const parentId = block.parentBlockRefs.filter((id) => id !== block.id).at(-1);
    if (parentId) relations.push({ kind: 'source_parent', fromType: 'block', fromId: block.id, toType: 'block',
      toId: parentId, sourceBlockRefs: [block.id, parentId], declarationStatus: 'source_declared' });
    const add = (kind, targetId, extra = {}) => {
      const ref = { kind, targetId, sourceBlockRefs: [block.id], relation: 'declared', ...extra };
      block.typedRefs.push(ref);
      relations.push({ kind, fromType: ownerType, fromId, toType: extra.targetType || 'obligation', toId: targetId,
        sourceBlockRefs: [block.id], declarationStatus: extra.relation === 'inherited' ? 'derived' : 'source_declared', ...extra });
    };
    for (const command of block.commandDeclarations) add('command', command.id, { targetType: 'command_declaration' });
    if (block.fieldRole === 'red_command' && block.commandDeclarations.length) lastRed.set(fromId, block.commandDeclarations[0].id);
    if (block.fieldRole === 'green_command' && !block.commandDeclarations.length && /同一命令|same command/iu.test(block.text) && lastRed.has(fromId)) {
      add('command', lastRed.get(fromId), { targetType: 'command_declaration', relation: 'inherited', derivationRuleId: 'same-owner-red-command-reference/v1' });
    }
    if (['metadata', 'layout', 'example'].includes(block.disposition)) continue;
    const ranges = block.fieldRole === 'dependencies' ? explicitRangeIds(block.text, known) : new Map();
    for (const id of [...new Set([...(block.text.match(ID_PATTERN) || []), ...ranges.keys()])]) {
      if (id === block.declaredId) continue;
      const targetKind = typedIdKind(id);
      const kind = block.fieldRole === 'dependencies' && targetKind === 'task' ? 'dependency' : block.fieldRole === 'atomic_group' ? 'atomic_group' : targetKind;
      const detail = ranges.has(id) ? { relation: 'inherited', derivationRuleId: 'explicit-declared-id-range/v1', sourceRangeExpression: ranges.get(id) }
        : block.fieldRole === 'dependencies' && targetKind === 'acceptance' ? { prerequisite: true } : {};
      if (kind && (known.has(id) || ['dependency', 'atomic_group'].includes(kind))) add(kind, id, detail);
      if (block.fieldRole === 'acceptance_reference' && block.disposition === 'association' && known.has(id)) {
        add('acceptance', id, { targetKind: targetKind || 'declared_source', relationRole: 'acceptance_criterion' });
      }
    }
    let evidenceDirectory = null;
    for (const match of block.text.matchAll(/`([^`]+)`/gu)) {
      const pathRole = explicitPathRole(block, match);
      if (pathRole && /^(?:(?:\.?\.?\/)?(?:[A-Za-z0-9_.-]+\/)+[^\s]+|[\w.-]+\.(?:json|log|md|npz))$/u.test(match[1]) && !match[1].includes('::')) {
        const basename = pathRole === 'artifact' && !match[1].includes('/') && evidenceDirectory;
        const target = basename ? `${evidenceDirectory}/${match[1]}` : match[1];
        if (pathRole === 'artifact' && match[1].includes('/')) evidenceDirectory = match[1].slice(0, match[1].lastIndexOf('/'));
        add('path', target, { targetType: 'path', pathRole, fieldRole: block.fieldRole,
          ...(block.inheritedFieldFrom ? { relation: 'inherited', derivationRuleId: 'indented-path-field-inheritance/v1',
            sourceBlockRefs: [block.inheritedFieldFrom, block.id] } : {}),
          ...(basename ? { relation: 'inherited', derivationRuleId: 'same-declaration-evidence-directory/v1', sourcePathExpression: match[1] } : {}),
          sourceRef: fragmentRef(block, snapshot, bytes, match.index + 1, match.index + 1 + match[1].length) });
      }
    }
    if (block.inheritedFrom) relations.push({ kind: 'inherits_source_condition', fromType: 'block', fromId: block.id,
      toType: 'block', toId: block.inheritedFrom, sourceBlockRefs: [block.id, block.inheritedFrom], declarationStatus: 'derived' });
  }
  attachTaskLocalDeclarations(blocks, relations);
  attachReferenceResolutions(blocks, relations, known);
  return relations;
}

function compileSourceClauseCoverage(sourceBlocks) {
  const clauses = sourceBlocks.flatMap((block) => (block.clauses || []).map((clause) => ({
    id: clause.id,
    sourceBlockId: block.id,
    sourceBlockKind: block.kind,
    sourceBlockDisposition: block.disposition,
    declaredSourceId: block.declaredId || null,
    sourceArtifactId: clause.sourceRef.sourceArtifactId,
    sourceSnapshotHash: clause.sourceRef.sourceSnapshotHash,
    startByte: clause.sourceRef.startByte,
    endByteExclusive: clause.sourceRef.endByteExclusive,
    lineStart: clause.sourceRef.lineStart,
    lineEnd: clause.sourceRef.lineEnd,
    exactTextHash: clause.sourceRef.exactTextHash,
    disposition: clause.disposition,
    polarity: clause.polarity,
    modalities: [...(clause.modalities || [])],
    conditions: structuredClone(clause.conditions || []),
    scope: structuredClone(clause.scope),
    derivation: structuredClone(clause.derivation),
    expectedOutcome: structuredClone(clause.expectedOutcome),
  }))).sort((left, right) => left.startByte - right.startByte || left.endByteExclusive - right.endByteExclusive || left.id.localeCompare(right.id, 'en'));
  const ids = clauses.map((clause) => clause.id);
  if (new Set(ids).size !== ids.length) throw new Error('source_clause_coverage_duplicate');
  return clauses;
}

function sourceClauseCoverageSummary(sourceBlocks) {
  const clauses = compileSourceClauseCoverage(sourceBlocks);
  return {
    schemaVersion: 'goal-contract-source-clause-coverage/v1',
    sourceArtifactId: clauses[0]?.sourceArtifactId || null,
    sourceSnapshotHash: clauses[0]?.sourceSnapshotHash || null,
    clauseCount: clauses.length,
    clauseSetHash: sha256Text(stableStringify(clauses)),
    clauseSpans: clauses.map(({ id, sourceBlockId, startByte, endByteExclusive, exactTextHash }) => ({
      id, sourceBlockId, startByte, endByteExclusive, exactTextHash,
    })),
  };
}

function compileSourceBlocksWithCoverage({ snapshot, sourceBytes }) {
  const compiled = compileSourceBlocksInternal({ snapshot, sourceBytes });
  return {
    ...compiled,
    sourceClauseCoverage: compileSourceClauseCoverage(compiled.sourceBlocks),
    sourceClauseCoverageSummary: sourceClauseCoverageSummary(compiled.sourceBlocks),
  };
}

module.exports = { compileSourceBlocks: compileSourceBlocksWithCoverage, compileSourceClauseCoverage,
  sourceClauseCoverageSummary, declaredId, fieldRole, modalitiesOf, typedIdKind, COMMAND };
