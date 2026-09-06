// This fixture-only profile was reviewed from all source lines, not extractor output.
export const SOURCE_SHA256 = '06f1c8f44fdfea09fb0f12832cd0a319c7938c79aac91aae48f44b54dc731d4a';
export const SOURCE_BYTES = 214296;
export const SOURCE_LINES = 2642;
export const STEM = 'real-source-plan-20260904';

export const SECTIONS = [
  [0, 1, 15, 'document_metadata', 'Declared source identity; not execution authorization.'],
  [1, 16, 31, 'authoring_gate', 'Pending review and current-round permissions.'],
  [2, 32, 83, 'global_goal', 'Goals, supported optimization scope, and preserved behavior.'],
  [3, 84, 104, 'authority_order', 'Ordered authorities and explicit ambiguity stop rules.'],
  [4, 105, 270, 'runtime_architecture', 'Ordered flows, ownership, identity, and prohibited alternatives.'],
  [5, 271, 947, 'repair_matrix', 'All five facets of each FIX plus 24 normative AUDIT rows.'],
  [6, 948, 1066, 'data_model', 'Canonical fields, cold/hot/current semantics, and merge authority.'],
  [7, 1067, 1226, 'runtime_sequence', 'Startup, ingress, aggregation, repair, and publication.'],
  [8, 1227, 1369, 'compatibility_contract', 'Indicators, recording, callbacks, mapping, and queries.'],
  [9, 1370, 1415, 'global_verification', 'Real test boundaries, evidence, environment, and commands.'],
  [10, 1416, 2197, 'scenario_matrix', 'Fixture obligations, historical receipts, 39 scenarios, and cross-references.'],
  [11, 2198, 2239, 'performance_gate', '20 performance obligations and exact benchmark command.'],
  [12, 2240, 2509, 'work_packages', 'Precontract, quality, and all 16 work packages.'],
  [13, 2510, 2565, 'global_prohibitions', '27 explicit non-goals and protected boundaries.'],
  [14, 2566, 2595, 'authoring_contract', 'Conditional contract generation and compiler obligations.'],
  [15, 2596, 2611, 'worktree_gate', 'Preserve dirty worktree changes and restrict staging.'],
  [16, 2612, 2642, 'review_checklist', 'Unchecked review assertions; never evidence of completion.'],
].map(([id, start, end, scope, reason]) => ({ id, start, end, scope, reason }));

export const FIXES = [
  [283, 320], [321, 355], [356, 389], [390, 427], [428, 461],
  [462, 494], [495, 526], [527, 560], [561, 598], [599, 633],
  [634, 673], [674, 710], [711, 745], [746, 789], [790, 828],
  [829, 875], [876, 916],
].map(([start, end], index) => ({ id: `FIX-${pad(index + 1)}`, start, end }));

const scenarios = [
  ['01-S01',1471,1487,[5,7]], ['02-S01',1490,1506,[6,7,11]],
  ['03-S01',1509,1525,[5,6,7]], ['04-S01',1528,1544,[5,7]],
  ['05-S01',1547,1563,[5,7]], ['06-S01',1566,1582,[4,7,9]],
  ['07-S01',1585,1601,[4,9]], ['08-S01',1604,1620,[5,7,9]],
  ['09-S01',1623,1639,[3,4]], ['10-S01',1642,1658,[4,12]],
  ['11-S01',1661,1677,[8,9]], ['12-S01',1680,1696,[8,9]],
  ['13-S01',1699,1715,[8,9]], ['14-S01',1718,1734,[10,11]],
  ['15-S01',1737,1753,[6,10,11]], ['16-S01',1756,1772,[6,11]],
  ['17-S01',1775,1791,[12]], ['18-S01',1794,1810,[12]],
  ['19-S01',1813,1829,[3,12]], ['20-S01',1832,1848,[13]],
  ['21-S01',1851,1867,[3,5,11]], ['22-S01',1870,1886,[3,4,12]],
  ['23-S01',1889,1905,[5,7,8,14]], ['24-S01',1908,1924,[7,9,14]],
  ['09-S02',1958,1973,[4,12]], ['13-S02',1974,1989,[5,7,8,9]],
  ['16-S02',1990,2005,[6,11]], ['16-S03',2006,2021,[6,11]],
  ['16-S04',2022,2037,[10,11]], ['20-S02',2038,2053,[13]],
  ['20-S03',2054,2069,[12,13]], ['20-S04',2070,2085,[3,12,13]],
  ['21-S02',2086,2101,[3,5]], ['21-S03',2102,2117,[3,11,14]],
  ['22-S02',2118,2133,[3,4]], ['23-S02',2134,2149,[5,7,14]],
  ['23-S03',2150,2165,[5,14]], ['24-S02',2166,2181,[5,7,11,14]],
  ['24-S03',2182,2197,[5,11]],
];
export const SCENARIOS = scenarios.map(([id,start,end,works]) => ({
  id: `AC-${id}`, start, end, works: works.map(workId),
}));

const works = [
  [2250,2266,[],[]], [2267,2284,[1],[]],
  [2285,2300,[1,2],[9,21,22]], [2301,2316,[3],[6,7,8,9,10]],
  [2317,2332,[2,3],[3,4,5,8]], [2333,2348,[1],[3,16]],
  [2349,2364,[4,5,6],[1,2,3,4,5,23,24]], [2365,2380,[1,7],[11,12,13]],
  [2381,2396,[7,8],[6,7,8,11,12,13,24]], [2397,2412,[3,4],[14,15]],
  [2413,2428,[6,7,10],[2,14,15,16]], [2429,2444,[3,4],[17,18,19]],
  [2445,2460,[4,12],[20]], [2461,2476,[5,7,9],[23,24]],
  [2477,2492,[8,9,10,11,12,13,14],Array.from({length:24},(_,i)=>i+1)],
  [2493,2509,[3,4,5,6,7,8,9,10,11,12,13,14,15],[]],
];
export const WORKS = works.map(([start,end,dependencies,testFamilies],index) => ({
  id: workId(index + 1), start, end, dependencies: dependencies.map(workId),
  testFamilies: testFamilies.map(id => `AC-${pad(id)}`),
}));

// Labels are obtained only at these independently reviewed source anchors.
export const LABEL_ANCHORS = {
  fix_reference: [1473], work_reference: [1474], product_paths: [1475,2253,2288],
  test_nodeid: [1476], initial_state: [1477], production_entry: [1478],
  operations: [1479], direct_assertions: [1480], pass_criterion: [1481],
  fail_criterion: [1482], verification_command: [1483], evidence: [1484],
  teardown: [1485], blocked_criterion: [1486], purpose: [2252],
  test_paths: [2254,2497], dependencies: [2255], acceptance_reference: [2256],
  implementation_steps: [2257], red_command: [2258], green_command: [2259],
  regression_command: [2260], fail_or_blocked_criterion: [2263],
  stop_condition: [2265], readonly_fixture_paths: [2271], delete_targets: [2498],
};

export const NAMED_COUNTS = {
  'REQ-GOAL':6,'REQ-AUTH':5,'REQ-FLOW':10,'REQ-DATA':5,'REQ-COLD':7,
  'REQ-HOT':8,'REQ-CURRENT':6,'REQ-MERGE':9,'REQ-BOOT':8,'REQ-TICK':8,
  'REQ-AGG':8,'REQ-GAP':12,'REQ-PUB':14,'REQ-IND':11,'REQ-REC':14,
  'REQ-CALLBACK':13,'REQ-MAP':7,'REQ-QUERY':6,'REQ-OBS':3,'REQ-TEST':14,
  FIXTURE:10,PERF:20,PRECONTRACT:1,QUALITY:2,'NOT-DONE':27,CONTRACT:12,DIRTY:7,
};

export const REVIEW_NOTES = [
  { id:'source-review-pending', lines:[20,28,2572,2642], status:'source_declared_pending',
    decision:'Never infer human confirmation or execution authorization from fixture inclusion.' },
  { id:'offline-live-exception', lines:[1444,1467,2244], status:'source_declared_exception',
    decision:'Preserve offline contract entry and market-open blockers for corresponding live acceptance.' },
  { id:'historical-pass-receipts', lines:[1452,1466], status:'historical_evidence_only',
    decision:'Source receipt PASS is not a test result, verification receipt, or authorization of this run.' },
  { id:'work-05-command-scope', lines:[1609,1616,2324,2325], status:'coverage_not_proven',
    decision:'Preserve work red/green command and AC-08 command as distinct many-to-many declarations.' },
  { id:'work-11-command-scope', lines:[2170,2178,2420,2421], status:'coverage_not_proven',
    decision:'Preserve work red/green command and AC-24-S02 command; do not assert selector coverage.' },
  { id:'native-command-globs', lines:[2486,2502], status:'portability_not_executed',
    decision:'Preserve raw glob arguments; this oracle neither expands nor executes them.' },
  { id:'dynamic-quality-template', lines:[2246], status:'requires_actual_changed_files',
    decision:'Retain compileall placeholder and actual-file selection rule, not a fabricated concrete command.' },
  { id:'source-goal-list-inheritance', lines:[44,46,56,60,62,69,71,73,82], status:'independent_review_correction',
    decision:'Observed issues are required repair targets; optimization locations are permissions; protected behaviors inherit forbid-change.' },
  { id:'ownership-table-column-polarity', lines:[184,186,196], status:'independent_review_correction',
    decision:'Each module has a required exclusive responsibility cell and a distinct explicitly forbidden responsibility cell.' },
  { id:'source-current-round-condition', lines:[20,22,28,30,2572,2574], status:'independent_review_correction',
    decision:'Pending confirmation and current-round source editing restrictions must not become permanent prohibitions on future work.' },
  { id:'mixed-historical-evidence-boundaries', lines:[1452,1463], status:'independent_review_correction',
    decision:'Historical receipts do not erase the still-active fixture gate or CSV use permissions and proof prohibitions.' },
  { id:'permissions-and-negative-verbs', lines:[209,230,374], status:'independent_review_correction',
    decision:'Keep optional drain permission, required stream identity, prohibited checkpoint changes, and explicit no-write/no-change semantics.' },
  { id:'normative-statements-in-deviation-containers', lines:[368,438,1392,2560], status:'independent_review_correction',
    decision:'A deviation heading cannot erase the DataService authority prohibition or the active fake/idle-timer proof boundary.' },
  { id:'authority-list-child-prohibitions', lines:[86,92,93], status:'independent_review_correction',
    decision:'Priority-order inheritance and the child statements own prohibitions coexist; ordering never grants tests or dirty files authority.' },
  { id:'clause-reviewed-modality', lines:[178,864,1012,1051,2242,2506,2530,2546,2550,2552], status:'independent_review_correction',
    decision:'Apply source-reviewed clause polarity where a prohibition negates preservation, a fixed quantity is only an object, or modality words occur inside a required field list.' },
  { id:'independent-review-transaction-and-live-evidence', lines:[779,1467], status:'independent_review_correction',
    decision:'Independent reviewer confirmed a mixed transaction requirement/prohibition, descriptive current blocker, and permitted offline evidence uses. The separate market-open proof prohibition remains unchanged.' },
];

export const REVIEWED_CLAUSE_RULES = [
  {line:779,clause:1,polarity:'mixed',modalities:['required','forbidden'],
    reason:'The sentence requires one db.atomic transaction and separately prohibits one transaction per interval.'},
  {line:1467,clause:1,disposition:'mixed_evidence_and_normative',defaultClauseDisposition:'normative',
    clauseDisposition:'historical_evidence',polarity:'descriptive',outcome:'not_a_current_run_result',
    reason:'The source reports its current live blocker; it does not require that blocker to remain permanently active.'},
  {line:1467,clause:2,clauseDisposition:'evidence_use_boundary',polarity:'permitted',
    outcome:'declared_permitted_offline_uses',
    reason:'The source identifies permitted offline evidence uses without independently imposing an unqualified only-use prohibition.'},
  {line:368,clause:1,disposition:'normative',polarity:'forbidden',
    outcome:'forbid_dataservice_authoritative_data_construction_or_write',
    reason:'The statement itself prohibits DataService authority writes despite its deviation heading.'},
  {line:438,clause:1,disposition:'evidence_use_boundary',polarity:'forbidden',
    outcome:'forbid_claiming_unsupported_proof',relatedBoundaries:[{id:'REQ-TEST-003',line:1392},{id:'NOT-DONE-025',line:2560}],
    reason:'Fake components and idle timers cannot prove the production chain; this is an active proof restriction.'},
  {line:92,clause:1,polarity:'forbidden',outcome:'forbid_current_tests_overriding_user_behavior_or_source',
    reason:'Current tests are evidence only and cannot override user behavior or this source.'},
  {line:93,clause:1,polarity:'forbidden',outcome:'forbid_uncommitted_files_becoming_authority_automatically',
    reason:'Uncommitted files cannot automatically become requirement, implementation, or acceptance authority.'},
  {line:178,clause:2,polarity:'forbidden',reason:'Recoverability from historical bars is inside the prohibited representation, not an independent permission.'},
  {line:864,clause:1,polarity:'required',reason:'Hot completed data must use an identity map and ordered view; this representation precedes the separate deletion prohibition.'},
  {line:864,clause:2,polarity:'forbidden',reason:'Fixed quantity names an invalid deletion trigger; it is not a requirement modality.'},
  {line:1012,clause:1,polarity:'forbidden',reason:'Fixed minute/bar quantities name forbidden deletion triggers.'},
  {line:1051,clause:2,polarity:'forbidden',reason:'Keeping duplicate identities is the object of the prohibition.'},
  {line:2242,clause:1,polarity:'required',reason:'Forbidden behavior is a required Task field, not a prohibition of Task contents.'},
  {line:2506,clause:2,polarity:'forbidden',reason:'Retaining dual chains is prohibited, not independently required.'},
  {line:2530,clause:1,polarity:'forbidden',reason:'The negative verb forbids retaining a stale view as runtime authority.'},
  {line:2546,clause:1,polarity:'forbidden',reason:'The sentence prohibits establishing the specified Recorder transaction or config version.'},
  {line:2550,clause:1,polarity:'forbidden',reason:'The sentence prohibits establishing the specified descriptor lease, TTL, or allocation.'},
  {line:2552,clause:1,polarity:'forbidden',reason:'Both implementing arbitrary overlap coalescing and retaining retries are prohibited.'},
];

export const INHERITED_LIST_RULES = [
  {start:88,end:93,parentLine:86,parentId:'SOURCE_AUTHORITY_ORDER',disposition:'ordered_authority',
    polarity:'source_modalities',relation:'authority_precedence',effect:'apply_in_the_declared_priority_order'},
  {start:158,end:170,parentLine:156,parentId:'SOURCE_INGRESS_SEQUENCE',disposition:'ordered_ingress_step',
    polarity:'source_modalities',relation:'ordered_ingress_step',effect:'execute_in_the_declared_single_thread_order'},
  {start:260,end:269,parentLine:258,parentId:'SOURCE_ARCHITECTURE_PROHIBITIONS',disposition:'architecture_prohibition',
    polarity:'forbidden',relation:'prohibited_architecture_alternative',effect:'do_not_introduce_this_alternative'},
  {start:46,end:56,parentLine:44,parentId:'REQ-GOAL-003',disposition:'observed_user_issue',
    polarity:'descriptive',relation:'repair_target',effect:'repair_the_observed_issue_not_reproduce_it'},
  {start:62,end:69,parentLine:60,parentId:'REQ-GOAL-005',disposition:'permitted_optimization_location',
    polarity:'permitted',relation:'optimization_allowlist_member',effect:'optimization_allowed_here_not_required_here'},
  {start:73,end:82,parentLine:71,parentId:'REQ-GOAL-006',disposition:'preserved_behavior',
    polarity:'preserve',relation:'preserve_user_semantics',effect:'forbid_change_during_performance_optimization'},
  {start:964,end:975,parentLine:962,parentId:'REQ-DATA-004',disposition:'comparison_field_member',
    polarity:'required',relation:'closed_comparison_field_set',effect:'use_this_business_field_for_completed_comparison'},
  {start:989,end:994,parentLine:987,parentId:'REQ-COLD-004',disposition:'conditional_refresh_trigger',
    polarity:'required',relation:'refresh_when_trigger_occurs',effect:'load_or_locally_refresh_cold_when_this_event_occurs'},
  {start:1202,end:1209,parentLine:1200,parentId:'REQ-PUB-006',disposition:'legacy_contract_field_member',
    polarity:'required',relation:'legacy_contract_required_field',effect:'publish_this_field_in_the_single_legacy_contract'},
  {start:1428,end:1436,parentLine:1426,parentId:'FIXTURE-004',disposition:'required_fixture_coverage',
    polarity:'required',relation:'fixture_required_coverage_point',effect:'fixture_must_cover_this_market_window_or_event'},
];

export const REVIEWED_STANDALONE_PARAGRAPHS = [18,20,30,86,109,156,273,919,1071,1149,1467,1927,2242];
export const REVIEWED_UNNAMED_FLOWS = [121,275,1073,1151];

export function pad(value) { return String(value).padStart(2,'0'); }
export function workId(value) { return `WORK-${pad(value)}`; }
