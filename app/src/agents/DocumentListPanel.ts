/**
 * Legal v9.8 — DocumentListPanel
 *
 * Final presentation layer: maps UiViewModel into a PanelOutput — a
 * structured, framework-agnostic view description ready for React rendering
 * or any other consumer.
 *
 * PanelItem fields (one per document):
 *   label    — "FILENAME.EXT" string from UiViewModel.requiredLines /
 *              optionalLines
 *   required — true for required documents, false for optional
 *   section  — 'required' | 'optional'
 *   index    — 0-based position within the item's own section
 *              (optionalItems[0].index === 0, NOT its global position)
 *
 * PanelOutput fields:
 *   title         — UiViewModel.statusLabel ("10 documents" | "No documents")
 *   targetDate    — forwarded from UiViewModel.targetDate
 *   isEmpty       — forwarded from UiViewModel.isEmpty
 *   namedLabel    — parsedJson.named (string label or null)
 *   items         — all PanelItems in order: [...requiredItems, ...optionalItems]
 *   requiredItems — PanelItem[] for required documents
 *   optionalItems — PanelItem[] for optional documents
 *   totalCount    — forwarded from UiViewModel.totalCount
 *
 * Reference policy:
 *   items[i] is the same object reference as the corresponding entry in
 *   requiredItems or optionalItems — no duplication, shared references.
 *   items.length === requiredItems.length + optionalItems.length always holds.
 *
 * renderPanel() is exported for direct test injection with synthetic
 * UiViewModel objects.
 *
 * Calls uiLayer.prepare() exactly once per render() invocation.
 * Does NOT call PipelineOrchestrator.run() or ManifestSerializer.serialize()
 * directly.
 * Does NOT modify any existing engine, agent, or pipeline layer.
 * Backward compatibility remains 100% unchanged.
 *
 * Pure. No mutation. No cache. No I/O. No side effects.
 * No singleton. No randomness. Deterministic output per fixed input.
 * No AI. No LLM. No filesystem. No browser globals.
 * No hooks. No IndexedDB. No HTTP.
 */

import { buildUiLayer }                      from './UiIntegrationLayer';
import type { UiIntegrationLayer }           from './UiIntegrationLayer';
import type { QueryDescriptor }              from './QueryPlanner';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface PanelItem {
  label:    string;
  required: boolean;
  section:  'required' | 'optional';
  index:    number;
}

export interface PanelOutput {
  title:         string;
  targetDate:    string;
  isEmpty:       boolean;
  namedLabel:    string | null;
  items:         readonly PanelItem[];
  requiredItems: readonly PanelItem[];
  optionalItems: readonly PanelItem[];
  totalCount:    number;
}

// ─── Internal narrow types ────────────────────────────────────────────────────

interface MinUiViewModel {
  statusLabel:   string;
  targetDate:    string;
  isEmpty:       boolean;
  totalCount:    number;
  requiredLines: readonly string[];
  optionalLines: readonly string[];
  parsedJson:    { named: string | null };
}

interface MinUiIntegrationLayer {
  prepare(descriptor?: QueryDescriptor): MinUiViewModel;
}

// ─── Exported mapping helper ──────────────────────────────────────────────────

export function renderPanel(vm: MinUiViewModel): PanelOutput {
  const items:         PanelItem[] = [];
  const requiredItems: PanelItem[] = [];
  const optionalItems: PanelItem[] = [];

  for (let i = 0; i < vm.requiredLines.length; i++) {
    const item: PanelItem = { label: vm.requiredLines[i], required: true,  section: 'required', index: i };
    items.push(item);
    requiredItems.push(item);
  }
  for (let i = 0; i < vm.optionalLines.length; i++) {
    const item: PanelItem = { label: vm.optionalLines[i], required: false, section: 'optional', index: i };
    items.push(item);
    optionalItems.push(item);
  }

  return {
    title:         vm.statusLabel,
    targetDate:    vm.targetDate,
    isEmpty:       vm.isEmpty,
    namedLabel:    vm.parsedJson.named,
    items,
    requiredItems,
    optionalItems,
    totalCount:    vm.totalCount,
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export class DocumentListPanel {
  constructor(private readonly uiLayer: MinUiIntegrationLayer) {}

  render(descriptor: QueryDescriptor = {}): PanelOutput {
    return renderPanel(this.uiLayer.prepare(descriptor));
  }
}

// ─── Pipeline factory ─────────────────────────────────────────────────────────

export function buildPanel(
  lastAppliedDate: string,
  currentDate:     string,
  uiLayer:         UiIntegrationLayer = buildUiLayer(lastAppliedDate, currentDate),
): DocumentListPanel {
  return new DocumentListPanel(uiLayer);
}
