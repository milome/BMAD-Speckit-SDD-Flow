import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  architectureConfirmationHashFor,
  resolveArchitectureConfirmationHashRecipe,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/architecture-confirmation-hash-recipe';

const ROOT = process.cwd();
const SCRIPT = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'generate-architecture-confirmation-artifact.ts'
);
const RENDERER = path.join(
  ROOT,
  '_bmad',
  'skills',
  'requirements-contract-authoring',
  'scripts',
  'render-architecture-confirmation-html.ts'
);

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-confirm-producer-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function runNode(script: string, args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function writeProductSourceFixture() {
  const sourceDir = path.join(tempDir, 'product-src');
  fs.mkdirSync(sourceDir, { recursive: true });
  const hostPath = path.join(sourceDir, 'product_host.py');
  const widgetPath = path.join(sourceDir, 'display_settings_widget.py');
  const dialogPath = path.join(sourceDir, 'display_settings_dialog.py');

  fs.writeFileSync(
    hostPath,
    `class ContractManager(QtWidgets.QWidget):
    def __init__(self):
        self.button_show = QtWidgets.QPushButton("Query")
        self.button_show.clicked.connect(self.show_contracts)

    def show_contracts(self):
        return []

class ProductHostWindow:
    def __init__(self):
        self.display_settings_widget = DisplaySettingsWidget()
        self.display_settings_button = QtWidgets.QPushButton("Display settings")
        self.display_settings_button.clicked.connect(self.show_display_settings)

    def show_display_settings(self):
        self.display_settings_widget.show_settings_dialog()
`,
    'utf8'
  );
  fs.writeFileSync(
    widgetPath,
    `@dataclass
class DisplayStyleState:
    opacity: float = 0.05
    visible: bool = True

class DisplaySettingsWidget(QtWidgets.QWidget):
    def show_settings_dialog(self):
        self._show_settings_dialog()

    def _show_settings_dialog(self):
        current_settings = DisplaySettingsSnapshot(
            opacity=self._style_state.opacity,
            visible=self._style_state.visible,
        )
        new_settings = show_display_settings_dialog(
            current_settings=current_settings,
            parent=self,
            on_apply=self._apply_display_settings,
            on_preview=self._apply_display_settings,
        )
        if new_settings:
            self._main_engine.write_log("settings updated")

    def _apply_display_settings(self, settings):
        self._display_item.setOpacity(settings.opacity)
        self._display_item.setVisible(settings.visible)
        self._style_state.opacity = settings.opacity
        self._style_state.visible = settings.visible
        self._visibility_checkbox.setChecked(settings.visible)
        self._opacity_slider.setValue(int(settings.opacity * 100))
        self._persist_display_policy(settings.opacity)
        self._preview_surface.update()

    def _persist_display_policy(self, opacity):
        policy_manager = PolicyManager()
        policy_manager.save_policy("display", opacity)
`,
    'utf8'
  );
  fs.writeFileSync(
    dialogPath,
    `@dataclass
class DisplaySettingsSnapshot:
    opacity: float = 0.05
    visible: bool = True

class DisplaySettingsDialog(QtWidgets.QDialog):
    def __init__(self, settings=None, parent=None, on_preview=None):
        self._original_settings = settings
        self._on_preview = on_preview
        self._display_group = self._create_display_group("Display", settings.opacity, settings.visible)

    def _create_display_group(self, title, init_opacity, init_visible):
        visible_checkbox = QtWidgets.QCheckBox("Visible")
        opacity_slider = QtWidgets.QSlider(QtCore.Qt.Horizontal)
        opacity_slider.valueChanged.connect(self._on_setting_changed)
        visible_checkbox.toggled.connect(self._on_setting_changed)

    def _on_setting_changed(self):
        self._on_preview(self.get_settings())

    def _on_cancel(self):
        self._on_preview(self._original_settings)
        self.reject()

    def _on_reset(self):
        self._display_group.visible_checkbox.setChecked(self._original_settings.visible)
        self._display_group.opacity_slider.setValue(int(self._original_settings.opacity * 100))
        self._on_setting_changed()

    def get_settings(self):
        return DisplaySettingsSnapshot()

def show_display_settings_dialog(current_settings=None, parent=None, on_apply=None, on_preview=None):
    dialog = DisplaySettingsDialog(current_settings, parent, on_preview=on_preview)
    if dialog.exec() == QtWidgets.QDialog.DialogCode.Accepted:
        new_settings = dialog.get_settings()
        on_apply(new_settings)
        return new_settings
    return None
`,
    'utf8'
  );
  return { hostPath, widgetPath, dialogPath };
}

function writeFixture(options: { includePreConfirmationDrilldown?: boolean } = {}) {
  const source = path.join(tempDir, 'source.md');
  const record = path.join(
    tempDir,
    '_bmad-output/runtime/requirement-records/REQ-FIXTURE/requirement-record.json'
  );
  const sourceHash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const implementationHash =
    'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const block = `implementationConfirmation:
  contractSchemaVersion: 1
  status: user_confirmed
  recordId: REQ-FIXTURE
  requirementSetId: REQ-FIXTURE
  entryFlow: standalone_tasks
  entryFlowClass: task_packet_entry
  workflowAdapter: direct
  contractAuthoringRequired: true
  confirmationLanguage: zh-CN
  confirmedAt: '2026-05-20T00:00:00.000Z'
  confirmedBy: tester
  sourceDocumentHash: ${sourceHash}
  implementationConfirmationHash: ${implementationHash}
${options.includePreConfirmationDrilldown ? `  preConfirmationDrilldown:
    semanticKernelRef:
      path: authoring/semantic-kernel.json
      hash: sha256:1111111111111111111111111111111111111111111111111111111111111111
    mustDecompositionPacketRef:
      path: authoring/must_decomposition_packet.json
      hash: sha256:2222222222222222222222222222222222222222222222222222222222222222
    criticalAuditor:
      minimumRounds: 3
      consecutiveNoNewGapRounds: 3
      latestReceiptHash: sha256:3333333333333333333333333333333333333333333333333333333333333333
      convergenceVerdict: no_new_valid_gap
` : ''}
  must:
    - id: MUST-001
      text: fixture
      evidenceRefs: [EVD-001]
  evidence:
    - id: EVD-001
      text: fixture evidence
  sequenceViews:
    - id: SEQ-BUSINESS-001
      title: Display settings business happy path
      visualKind: happy
      scope: business
      covers: [MUST-001]
      mermaid: |-
        sequenceDiagram
          actor User
          participant Widget as DisplaySettingsWidget
          participant Dialog as SettingsDialog
          User->>Widget: Open compact period summary [MUST-001]
          Widget-->>User: Show selected periods and settings entry [MUST-001]
          User->>Dialog: Open source-defined settings dialog [MUST-001]
          Dialog->>Widget: Preview visible periods through canonical path [MUST-001]
      traceRows: [TRACE-001]
      evidenceRefs: [EVD-001]
      acceptanceRefs: [ACC-001]
  flowViews:
    - id: FLOW-BUSINESS-001
      title: Display settings business state flow
      visualKind: flow
      scope: business
      covers: [MUST-001]
      mermaid: |-
        flowchart TD
          Summary[Compact summary] --> Dialog[Settings dialog]
          Dialog --> Apply[Apply visible periods]
          Apply --> Summary
      traceRows: [TRACE-001]
      evidenceRefs: [EVD-001]
      acceptanceRefs: [ACC-001]
  currentTargetMap:
    schemaVersion: current-target-map/v1
    displayProfile: closed_loop_current_target_map
    introduction: Display settings compact interaction business architecture
    currentSummary:
      - id: CT-CURRENT-001
        text: Current display controls are embedded in the dense footer surface.
    targetSummary:
      - id: CT-TARGET-001
        text: Target display settings move dense controls behind a compact settings dialog.
`;
  fs.writeFileSync(source, `# Fixture\n\n\`\`\`yaml\n${block}\`\`\`\n`, 'utf8');

  const renderer = path.join(
    ROOT,
    '_bmad',
    'skills',
    'requirements-contract-authoring',
    'scripts',
    'render-requirements-confirmation-html.ts'
  );
  const htmlOut = path.join(tempDir, 'confirmation.html');
  const render = runNode(renderer, [
    '--source',
    source,
    '--out',
    htmlOut,
    '--language',
    'zh-CN',
    '--record-id',
    'REQ-FIXTURE',
    '--entry-flow',
    'standalone_tasks',
    '--strict',
    'false',
    '--json',
  ]);
  expect(render.status, `${render.stdout}\n${render.stderr}`).toBe(0);
  const report = JSON.parse(
    fs.readFileSync(path.join(tempDir, 'confirmation-render-report.json'), 'utf8')
  );
  const updatedSource = fs
    .readFileSync(source, 'utf8')
    .replace(sourceHash, report.sourceDocumentHash)
    .replace(implementationHash, report.implementationConfirmationHash);
  fs.writeFileSync(source, updatedSource, 'utf8');
  fs.mkdirSync(path.dirname(record), { recursive: true });
  fs.writeFileSync(
    record,
    `${JSON.stringify(
      {
        recordId: 'REQ-FIXTURE',
        requirementSetId: 'REQ-FIXTURE',
        status: 'user_confirmed',
        sourceDocumentHash: report.sourceDocumentHash,
        implementationConfirmationHash: report.implementationConfirmationHash,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return { source, record };
}

const targetPaths = JSON.stringify([
  'src/product/display_settings_widget.py',
  'src/product/display_settings_dialog.py',
  'tests/product/test_display_settings_batch_and_rollback.py',
  'docs/plans/display_settings_requirements.md',
]);
const consumerImpactScan = JSON.stringify([
  { category: 'data_model', status: 'triggered', summary: 'fixture' },
]);
const governanceImpactScan = JSON.stringify([
  {
    category: 'orchestration_hook_gate_ingest_rerun_closeout',
    status: 'triggered',
    summary: 'fixture',
  },
]);
const triggerMatrix = JSON.stringify([
  { trigger: 'shared_schema_or_contract_changed', decision: 'triggered', reason: 'fixture' },
]);
const requiredArchitectureDiagramTypes = [
  'system_architecture',
  'deployment',
  'class',
  'swimlane',
  'state_machine',
  'sequence',
  'activity',
];

describe('generate-architecture-confirmation-artifact', () => {
  it('generates a requirement-scoped architecture confirmation JSON without mutating the requirement record', () => {
    const fixture = writeFixture();
    const productSources = writeProductSourceFixture();
    const expectedProductTargetRefs = [
      path.normalize(productSources.hostPath),
      path.normalize(productSources.widgetPath),
      path.normalize(productSources.dialogPath),
    ];
    const expectedSupplementalTargetRefs = [
      path.normalize('tests/product/test_display_settings_batch_and_rollback.py'),
      path.normalize('docs/plans/display_settings_requirements.md'),
    ];
    const beforeRecord = fs.readFileSync(fixture.record, 'utf8');
    const out = path.join(tempDir, 'architecture-confirmation.json');
    const result = runNode(SCRIPT, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--out',
      out,
      '--run-id',
      'arch-fixture-001',
      '--target-paths',
      JSON.stringify([
        productSources.hostPath,
        productSources.widgetPath,
        productSources.dialogPath,
        'tests/product/test_display_settings_batch_and_rollback.py',
        'docs/plans/display_settings_requirements.md',
      ]),
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(fs.readFileSync(fixture.record, 'utf8')).toBe(beforeRecord);
    const artifact = JSON.parse(fs.readFileSync(out, 'utf8'));
    const recipe = resolveArchitectureConfirmationHashRecipe();
    expect(artifact.recordId).toBe('REQ-FIXTURE');
    expect(artifact.architectureConfirmationArtifactHash).toBe(
      architectureConfirmationHashFor(artifact, recipe)
    );
    expect(artifact.confirmationPhrase).toContain('确认架构确认进入实施准备');
    expect(artifact.businessArchitectureDiagrams?.map((view: Record<string, unknown>) => view.type)).toEqual(
      requiredArchitectureDiagramTypes
    );
    expect(artifact.governanceArchitectureDiagrams?.map((view: Record<string, unknown>) => view.type)).toEqual(
      requiredArchitectureDiagramTypes
    );
    expect(artifact.architectureDiagrams?.map((view: Record<string, unknown>) => view.type)).toEqual(
      requiredArchitectureDiagramTypes
    );
    const businessByType = new Map(
      (artifact.businessArchitectureDiagrams as Array<Record<string, unknown>>).map((view) => [
        view.type,
        view,
      ])
    );
    const businessJson = JSON.stringify(artifact.businessArchitectureDiagrams);
    expect(businessJson).not.toMatch(
      /Business UI Surface|Canonical Apply Path|Chart Display Result|BusinessRequirement|UserVisibleSurface/u
    );
    expect(String(businessByType.get('system_architecture')?.mermaid)).toContain('DisplaySettingsWidget');
    expect(String(businessByType.get('system_architecture')?.mermaid)).toContain('ProductHostWindow');
    expect(String(businessByType.get('system_architecture')?.mermaid)).not.toContain('ContractManager');
    expect(String(businessByType.get('system_architecture')?.mermaid)).toContain('display_settings_button');
    expect(String(businessByType.get('system_architecture')?.mermaid)).toContain('DisplaySettingsDialog');
    expect(String(businessByType.get('system_architecture')?.mermaid)).toContain('DisplaySettingsSnapshot');
    expect(String(businessByType.get('system_architecture')?.mermaid)).toContain('PolicyManager');
    expect(String(businessByType.get('system_architecture')?.mermaid)).toContain('Rendered product state update');
    expect(String(businessByType.get('system_architecture')?.mermaid)).not.toMatch(
      /-->\|[^|\n]*\[[A-Z]+-\d+\][^|\n]*\|/u
    );
    expect(String(businessByType.get('class')?.mermaid)).toContain('DisplaySettingsWidget');
    expect(String(businessByType.get('class')?.mermaid)).toContain('ProductHostWindow');
    expect(String(businessByType.get('class')?.mermaid)).not.toContain('ContractManager');
    expect(String(businessByType.get('class')?.mermaid)).toContain('DisplaySettingsDialog');
    expect(String(businessByType.get('class')?.mermaid)).toContain('DisplaySettingsSnapshot');
    expect(String(businessByType.get('class')?.mermaid)).toContain('_apply_display_settings');
    expect(String(businessByType.get('class')?.mermaid)).toContain('_on_cancel');
    expect(String(businessByType.get('class')?.mermaid)).not.toMatch(/\bclass\s+(?:Open|Generic)\b/u);
    expect(String(businessByType.get('class')?.mermaid)).not.toMatch(/sourceAnchored(?:State|Surface)/u);
    expect(String(businessByType.get('class')?.mermaid)).not.toMatch(/\bclass\s+Test/u);
    expect(String(businessByType.get('class')?.mermaid)).not.toMatch(/\bclass\s+\w*Requirements\b/u);
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('subgraph UserLane');
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('subgraph HostSurfaceLane');
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('subgraph WidgetLane');
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('subgraph DialogLane');
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('subgraph RenderStateLane');
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('clicked.connect');
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('on_preview');
    expect(String(businessByType.get('swimlane')?.mermaid)).toContain('cancel rollback');
    expect(String(businessByType.get('state_machine')?.mermaid)).toContain(
      'Current display controls are embedded in the dense footer surface'
    );
    expect(String(businessByType.get('state_machine')?.mermaid)).toContain(
      'Target display settings move dense controls behind a compact settings dialog'
    );
    expect(businessJson).toContain('DisplaySettings');
    for (const view of artifact.businessArchitectureDiagrams as Array<Record<string, unknown>>) {
      const businessTargetRefs = (view.targetPathRefs as string[]).map((targetPath) =>
        path.normalize(targetPath)
      );
      expect(view.mermaid).toMatch(/^(?:flowchart|sequenceDiagram|classDiagram|stateDiagram-v2)/u);
      expect(view.evidenceRefs).toEqual(expect.arrayContaining(['EVD-036', 'EVD-037']));
      expect(businessTargetRefs).toEqual(expect.arrayContaining(expectedProductTargetRefs));
      expect(
        businessTargetRefs.every((targetPath) =>
          [...expectedProductTargetRefs, ...expectedSupplementalTargetRefs].includes(targetPath)
        )
      ).toBe(true);
      expect(businessTargetRefs.some((targetPath) => /(?:^|[\\/])scripts[\\/].+\.ts$/u.test(targetPath))).toBe(
        false
      );
      expect(view.scope).toBe('business_architecture');
    }
    for (const view of artifact.governanceArchitectureDiagrams as Array<Record<string, unknown>>) {
      expect(view.scope).toBe('governance_architecture');
    }

    const html = path.join(tempDir, 'architecture-confirmation.html');
    const render = runNode(RENDERER, [
      '--architecture-confirmation',
      out,
      '--out',
      html,
      '--language',
      'zh-CN',
      '--json',
    ]);
    expect(render.status, `${render.stdout}\n${render.stderr}`).toBe(0);
  });

  it('uses confirmation hash normalization for preConfirmationDrilldown volatile fields', () => {
    const fixture = writeFixture({ includePreConfirmationDrilldown: true });
    const out = path.join(tempDir, 'architecture-confirmation-drilldown.json');
    const result = runNode(SCRIPT, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--out',
      out,
      '--run-id',
      'arch-fixture-drilldown',
      '--target-paths',
      targetPaths,
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const artifact = JSON.parse(fs.readFileSync(out, 'utf8'));
    const record = JSON.parse(fs.readFileSync(fixture.record, 'utf8'));
    expect(artifact.sourceDocumentHash).toBe(record.sourceDocumentHash);
    expect(artifact.implementationConfirmationHash).toBe(record.implementationConfirmationHash);
  });

  it('fails closed when impact scans or target paths are missing', () => {
    const fixture = writeFixture();
    const out = path.join(tempDir, 'architecture-confirmation.json');
    const result = runNode(SCRIPT, [
      '--source',
      fixture.source,
      '--requirement-record',
      fixture.record,
      '--out',
      out,
      '--run-id',
      'arch-fixture-002',
      '--target-paths',
      '[]',
      '--consumer-impact-scan',
      consumerImpactScan,
      '--governance-impact-scan',
      governanceImpactScan,
      '--full-architecture-trigger-matrix',
      triggerMatrix,
      '--json',
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('targetPaths must not be empty');
  });
});
