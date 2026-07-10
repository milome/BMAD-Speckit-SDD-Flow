# TAM Visual Defect Log

Scope: `System Architecture Overview` TAM/VSDX output shown in `bmads-arch1.png`.

Status meanings:

- `OPEN`: confirmed and not yet fixed.
- `FIXING`: active implementation or audit gate work is in progress.
- `GATED`: a fail-closed machine audit now detects the defect.
- `FIXED`: regenerated artifacts and visual inspection confirm the defect is removed.

## Defects

| ID | Screenshot Finding | Root Cause | Required Fix | Status |
|---|---|---|---|---|
| TAM-VIS-001 | Page-spanning dashed / dotted lines cross the title and content. | Long protocol-boundary markers and routed flow segments were allowed to span large portions of the page. | Boundary markers must be short crossing markers; flow segments must fail if they span a major page axis or overlap the title. | GATED |
| TAM-VIS-002 | TAM endpoint glyphs float at page edges and away from related nodes. | Multi-segment business flows were rendered as separate TAM line masters, giving every segment its own endpoint glyph. | One business edge must not be emitted as repeated same-label TAM flow segments; duplicate segment labels fail audit. | GATED |
| TAM-VIS-003 | Several connectors have zero-length or near-zero line segments. | Route points were duplicated when routes started or ended at the same port. | Flow segments below the minimum visible length fail audit; renderer deduplicates route points. | GATED |
| TAM-VIS-004 | Flow lines cross through unrelated nodes and boundaries. | Existing audit only checked master usage and label sizes, not connector geometry. | VSDX audit must check connector-node intersection using TAM communication path semantics. | FIXING |
| TAM-VIS-005 | Edge labels float far from their connector or overlap nodes. | Labels were placed on generic midpoint anchors without node-aware collision checks. | Flow labels must stay near their connector and must not overlap TAM node shapes. | FIXING |
| TAM-VIS-006 | Right-side nodes and connector endpoint glyphs are close to the page edge. | External panel and endpoint routing allowed minimal right margin. | Audit must fail right-edge clipping risk; renderer must keep endpoints and labels inside safe margins. | GATED |
| TAM-VIS-007 | Boundaries read as visual walls instead of containing/trust zones. | Boundary geometry was represented by full-height protocol-boundary lines. | Boundary markers are short, labeled crossing markers; no boundary marker may exceed the hard length threshold. | GATED |
| TAM-VIS-008 | Large unused whitespace remains while active nodes are sparse and disconnected. | Layout relied on wide fixed columns and routed traffic through empty corridors. | Rebalance panels and use direct or short orthogonal TAM channels; final PNG must be visually inspected. | OPEN |
| TAM-VIS-009 | Machine audit passed despite visible human failures. | VSDX audit lacked geometry, clipping, duplicate-flow, and label-overlap checks. | Add fail-closed geometry receipt fields and self-test assertions for these defects. | GATED |
| TAM-VIS-010 | Boundary labels overlap node labels in the exported PNG, including Users / AI Host, External Services, Local Data, and Operations labels. | Boundary label placement was anchored to boundary boxes but did not run node collision checks, so machine audit passed while exported labels were unreadable. | VSDX audit must fail boundary-label/node overlap; renderer must place boundary labels through the same collision-aware label strategy. | FIXING |
| TAM-VIS-011 | Current `rework8` VSDX audit reports flow labels too far from their rendered TAM connector for Host/Shell, Node runtime, Policy, Runtime, FS specs, and CI flows. | Label placement optimized node avoidance before connector proximity, and adjacent node corridors were too narrow for readable flow labels. | Renderer must prefer candidates within the strict connector-distance gate and rebalance overview columns so labels fit near the actual TAM line. | FIXING |
| TAM-VIS-012 | Current `rework8` VSDX audit reports boundary/flow label overlaps, including Entry vs Users, Entry vs Host handoff, External Services vs HTTPS fetch, Node/FS vs FS records, and Policy vs CI. | Flow labels and boundary labels used separate local greedy placement without enough global fallback candidates. | Boundary and flow labels must share collision-aware placement and VSDX audit must fail any label-label overlap. | FIXING |
| TAM-VIS-013 | External dependency / CI flow label is pushed toward the page edge and reads detached from the CI-to-Ops connector. | CI-to-Ops route used the right side of far-right nodes, leaving insufficient right margin for a readable label. | Route external-to-operations flow on the left side of the external/ops rail so the label can stay near the connector and inside safe page margins. | FIXING |
| TAM-VIS-014 | Top-row Host/Shell and Node runtime labels can only avoid nodes by moving far above the line. | Source, entry, and runtime nodes were too close for the minimum readable label width plus node clearance. | Increase horizontal corridors between top-row nodes instead of shrinking fonts or weakening label-distance checks. | FIXING |
| TAM-VIS-015 | Storage connector endpoint glyphs visually touch or intrude into `Local Evidence & Records` and `Project Specs / Artifacts` label/glyph bands. | Storage flows terminated on the storage master label/glyph area instead of external safe ports. | Storage connector endpoints must use outside-safe ports and VSDX audit must fail `storageConnectorEndpointUnsafePort`. | FIXING |
| TAM-VIS-016 | Storage connector paths enter the storage label band even when the endpoint itself is outside the label text. | Geometry audit checked node intersection but did not reserve the storage master label/glyph band as a no-route region. | VSDX audit must fail `storageConnectorCrossesLabelBand`; renderer must route storage flows outside the reserved band. | FIXING |
| TAM-VIS-017 | Boundary markers can be visually detached from boundary labels, making the boundary marker look like an unrelated floating dash. | Boundary marker placement was derived from raw boundary geometry, while labels were later collision-repositioned. | Boundary markers must be recomputed from final label placement and VSDX audit must fail `boundaryMarkerLabelTooFar`. | FIXING |
| TAM-VIS-018 | CI / external flow endpoints can float in whitespace or cross the provider label zone before reaching Ops / Release Gates. | External-to-operations routing used unsafe right-side ports and did not verify endpoint attachment to nodes. | CI flow must use external/ops safe ports and VSDX audit must fail `connectorEndpointDetachedFromNode`. | FIXING |
| TAM-VIS-019 | The current Visio-exported overview renders as a black-and-white skeleton instead of a TAM/C4 visual model with zone color semantics. | Visio COM renderer dropped real TAM masters but did not apply planned fill/stroke colors and line weights to the dropped shapes. | Renderer must apply non-default fill/stroke/line weights to TAM nodes and flows; VSDX audit must fail `visualStyleUsage` regressions. | FIXING |
| TAM-VIS-020 | Overview lacks visible partition backplanes for Users, Entry, Runtime, Data, External Services, and Cross-Cutting Operations; boundaries read as isolated dashes rather than a System Architecture Overview. | Renderer emitted only TAM boundary markers and labels, but not the C4/TAM partition scaffolding required for a one-page overview. | Renderer must emit editable `TAM Zone Backplane - ...` shapes for all overview zones and VSDX audit must fail `visualFrameUsage` regressions. | FIXING |
| TAM-VIS-021 | Generic Visio rectangles could be added later as architecture content without the audit distinguishing them from allowed labels or backplanes. | Previous audit proved TAM master usage exists, but did not fail unexpected generic architecture-shape roles. | VSDX audit must allowlist only title, legend, labels, and `TAM Zone Backplane - ...`; all other generic shapes fail `visualStyleUsage`. | FIXING |
| TAM-VIS-022 | Zone titles such as External Services, Cross-Cutting Operations, and Package Runtime Control Plane overlap nodes or are clipped by nearby content in the Visio-exported PNG. | Zone titles were emitted as backplane internal text or fixed overlays without node-collision checks. | Zone titles must be dedicated `TAM Zone Label - ...` overlays, wrap long labels, and fail `visualFrameUsage.zoneLabelOverlapsNode` on overlap. | FIXING |
| TAM-VIS-023 | Some TAM nodes visually sit outside their intended zone backplane after manual layout overrides. | Backplanes were fixed panels while node overrides moved nodes independently. | VSDX audit must fail `visualFrameUsage.zoneNodeOutsideBackplane`; renderer must keep every TAM node inside a non-trust zone backplane. | FIXING |
| TAM-VIS-024 | `rework33` still has a long `Host: goal handoff` connector crossing Users, Entry, Runtime, and trust-boundary space, reading as a false primary data spine. | Audit only limits single page-spanning segments; it does not reject a long interior logical flow that crosses multiple semantic zones. | VSDX audit must fail `geometryUsage.flowCrossesMultipleZones`; renderer must move long feedback/handoff flows onto an exterior rail or shorten them to a local semantic handoff marker. | OPEN |
| TAM-VIS-025 | `rework33` right-lower Runtime/Data/Operations area has several parallel vertical and horizontal connector segments stacked together near `FS:*` and `CI:*` labels. | Storage, workflow, and CI routes reuse the same right-side corridor and the audit does not measure local connector density. | VSDX audit must fail `geometryUsage.flowCorridorStack`; renderer must allocate separate storage, CI, and runtime corridors with readable separation. | OPEN |
| TAM-VIS-026 | `rework33` contains long interior data/external flows such as `HTTPS: fetch templates` and storage FS flows that visually cut through zone interiors instead of using explicit dependency corridors. | Renderer chooses shortest orthogonal paths without penalizing zone-interior traversal. | VSDX audit must fail `geometryUsage.longInteriorFlowSegments`; renderer must route long cross-zone flows above, below, or outside zone interiors. | OPEN |
| TAM-VIS-027 | Boundary markers in `rework33` still look like floating standalone dashes or decorative bars even when their labels are nearby. | Boundary marker placement is tied to label proximity only; it does not require attachment to the relevant zone frame edge. | VSDX audit must fail `geometryUsage.boundaryMarkerDetachedFromZoneFrame`; renderer must place each marker directly on or adjacent to its declared zone/backplane edge. | OPEN |
| TAM-VIS-028 | `rework33` passes machine audit even though the overview still reads as routed wiring rather than a C4 Container + TAM trust-boundary overview. | Audit lacks a higher-level overview readability gate for cross-zone corridor budget and connector density. | `geometryUsage.pass` must include span, zone-crossing, corridor-stack, and boundary-attachment receipts before any PNG can be accepted. | OPEN |
| TAM-VIS-029 | `rework37` still has an excessive top exterior `HTTPS: fetch templates` rail that visually floats above the runtime/external zones. | The audit only rejected long segments that intersected zone interiors, so exterior rails above the panels were not counted. | VSDX audit must fail `geometryUsage.longExteriorFlowSegments`; renderer must shorten or reroute external dependency rails. | FIXING |
| TAM-VIS-030 | `rework37` still has an excessive single-segment `Host: goal handoff` back edge from Governance to the actor, producing a false page-level spine. | The overview model connected the governance handoff directly to the human/host actor instead of the CLI/Host Entry surface. | The overview model must terminate handoff at `CLI / Host Entry Surface`, and VSDX audit must fail `geometryUsage.excessiveFlowSegmentSpan`. | FIXING |
| TAM-VIS-031 | `rework37` still uses a wide sparse canvas where Users, Entry, Runtime, External, Data, and Ops read as disconnected islands. | Fixed panel coordinates left oversized gaps between semantic domains after adding TAM partition backplanes. | Renderer must compact the overview partitions while preserving left-to-right C4/TAM ordering and zone containment audit. | FIXING |
| TAM-VIS-032 | `rework37` still has right/bottom dependency rails such as `CI: build/test/release` and FS flows that run as long vertical corridors in whitespace. | External and data nodes were positioned far from their target runtime/operations domains, reusing long vertical rails. | Renderer must move external/data/ops domains closer and the VSDX audit must reject long exterior flow rails. | FIXING |
| TAM-VIS-033 | `rework43` still shows many short colored boundary dashes floating inside or beside ordinary zone frames. | The renderer emits a TAM `protocol boundary` marker for every model boundary even when the overview already represents that boundary as an editable zone backplane. | In overview VSDX, non-trust boundaries must be rendered by the zone backplane plus visible boundary label only; audit must fail `geometryUsage.nonTrustBoundaryMarkersInOverview`. | FIXING |
| TAM-VIS-034 | `rework43` zone titles and boundary labels collide visually, especially `Package Runtime Control Plane` with `Package Runtime Control Boundary` and trust-boundary rails. | Zone labels were not inserted into the global label collision set, and the audit only checked boundary/flow label overlaps. | Zone labels must participate in placement blocking, and audit must fail `visualFrameUsage.zoneLabelOverlapsDiagramLabel`. | FIXING |
| TAM-VIS-035 | `rework43` still reads as routed wiring because `HTTPS: fetch templates` and CI/FS flows use long rails across whitespace. | External/data/operations nodes remain far apart and edge-specific routes prefer exterior rails over short semantic adjacency. | Compact external/data/operations panels and route overview flows through short local corridors; audit span gates must stay fail-closed. | FIXING |
| TAM-VIS-036 | `rework43` has multiple data-plane connector stubs and labels floating between runtime and storage, making FS flows hard to associate with the target stores. | Data-plane routes terminate on external storage safe ports but share a right-side lane detached from storage labels. | Route FS flows from runtime/ops to nearby storage ports with separated short lanes and keep labels close to their connectors. | FIXING |
| TAM-VIS-037 | `rework43` uses duplicate wording for zone and boundary labels, causing the overview to feel like a label inventory rather than a first-contact architecture view. | Model boundary coverage was satisfied by separate boundary labels instead of compact zone header/subtitle semantics. | Keep every boundary label visible for coverage, but place it as a small non-overlapping subtitle near its own zone frame and reserve TAM protocol markers for trust boundaries only. | FIXING |

## Audit Fields Added

- `geometryUsage.zeroLengthFlowSegments`
- `geometryUsage.pageSpanningFlowSegments`
- `geometryUsage.boundaryMarkerTooLong`
- `geometryUsage.connectorEndpointOutOfBounds`
- `geometryUsage.connectorCrossesNode`
- `geometryUsage.edgeLabelTooFarFromConnector`
- `geometryUsage.edgeLabelOverlapsNode`
- `geometryUsage.boundaryLabelOverlapsNode`
- `geometryUsage.labelLabelOverlaps`
- `geometryUsage.connectorCrossesNodeLabel`
- `geometryUsage.connectorEndpointGlyphOverlapsNodeLabel`
- `geometryUsage.storageMasterGlyphOverlapsNodeLabel`
- `geometryUsage.storageNodeLabelUnsafePlacement`
- `geometryUsage.storageConnectorEndpointUnsafePort`
- `geometryUsage.storageConnectorCrossesLabelBand`
- `geometryUsage.boundaryMarkerLabelTooFar`
- `geometryUsage.connectorEndpointDetachedFromNode`
- `geometryUsage.rightEdgeClippingRisk`
- `geometryUsage.titleOverlap`
- `geometryUsage.duplicateFlowSegmentLabels`
- `geometryUsage.flowCrossesMultipleZones`
- `geometryUsage.flowCorridorStack`
- `geometryUsage.longInteriorFlowSegments`
- `geometryUsage.longExteriorFlowSegments`
- `geometryUsage.excessiveFlowSegmentSpan`
- `geometryUsage.boundaryMarkerDetachedFromZoneFrame`
- `geometryUsage.nonTrustBoundaryMarkersInOverview`
- `visualFrameUsage.zoneLabelOverlapsDiagramLabel`
- `visualFrameUsage.pass`
- `visualFrameUsage.missingZoneFrames`
- `visualFrameUsage.missingZoneLabels`
- `visualFrameUsage.zoneLabelOverlapsNode`
- `visualFrameUsage.zoneNodeOutsideBackplane`
- `visualStyleUsage.pass`
- `visualStyleUsage.genericShapeRoleViolations`
- `visualStyleUsage.unstyledTamNodes`
- `visualStyleUsage.unstyledTamFlows`
