import { useMemo, useState } from "react";
import {
  parseDddCrewMarkdown,
  projectDddCrewMarkdown,
  type AggregateNode,
  type AstRoot,
  type CommandNode
} from "@simway/spica";
import { copyText, downloadText } from "../lib/download";
import { Modal } from "./Modal";

interface DddCrewCanvasProps {
  model: AstRoot;
  selectedAggregate: string;
  onSelectAggregate: (name: string) => void;
  onImportModel: (model: AstRoot) => void;
}

interface CrossAggregateTrigger {
  source: string;
  event: string;
}

function collectCrossAggregateTriggers(agg: AggregateNode, model: AstRoot): CrossAggregateTrigger[] {
  const triggers: CrossAggregateTrigger[] = [];
  const aggregateNames = new Set(model.aggregates.map((a) => a.name));

  for (const cmd of agg.commands ?? []) {
    // Explicit "Aggregate.Event" trigger notation.
    if (cmd.triggerEvent) {
      const parts = cmd.triggerEvent.split(".");
      if (parts.length === 2 && aggregateNames.has(parts[0])) {
        triggers.push({ source: parts[0], event: parts[1] });
      } else {
        triggers.push({ source: "external", event: cmd.triggerEvent });
      }
    }

    // Policy-declared cross-aggregate source.
    for (const policyName of cmd.policies ?? []) {
      const policy = (agg.policies ?? []).find((p) => p.name === policyName);
      if (policy?.sourceAggregate && aggregateNames.has(policy.sourceAggregate)) {
        triggers.push({ source: policy.sourceAggregate, event: policy.sourceEvent || policy.name });
      }
    }
  }

  // Dedupe.
  const seen = new Set<string>();
  return triggers.filter((t) => {
    const key = `${t.source}.${t.event}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function commandParams(cmd: CommandNode): string {
  const params = cmd.parameters ?? [];
  if (params.length === 0) return "—";
  return params
    .map((p) => `${p.name}${p.isList ? "[]" : ""}: ${p.type}${p.required ? "" : "?"}`)
    .join(", ");
}

export function DddCrewCanvas({
  model,
  selectedAggregate,
  onSelectAggregate,
  onImportModel
}: DddCrewCanvasProps) {
  const [modal, setModal] = useState<"import" | "export" | null>(null);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [exportedMarkdown, setExportedMarkdown] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const activeAgg =
    model.aggregates.find((a) => a.name === selectedAggregate) ?? model.aggregates[0];

  const crossAggregateTriggers = useMemo(
    () => (activeAgg ? collectCrossAggregateTriggers(activeAgg, model) : []),
    [activeAgg, model]
  );

  if (!activeAgg) {
    return <div className="empty-state">No aggregates defined in the domain model.</div>;
  }

  const states = activeAgg.states ?? [];
  const commands = activeAgg.commands ?? [];
  const policies = activeAgg.policies ?? [];
  const invariants = activeAgg.invariants ?? [];
  const transitions = activeAgg.transitions ?? [];
  const reducers = activeAgg.reducers ?? [];
  const emittedEvents = commands.filter((c) => c.emits).map((c) => ({ event: c.emits as string, command: c.name }));

  const openImport = () => {
    setImportText("");
    setImportError(null);
    setModal("import");
  };

  const openExport = () => {
    setExportedMarkdown(projectDddCrewMarkdown(model));
    setCopyState("idle");
    setModal("export");
  };

  const doImport = () => {
    try {
      const parsed = parseDddCrewMarkdown(importText);
      onImportModel(parsed);
      setModal(null);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  const doCopyExport = async () => {
    await copyText(exportedMarkdown);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1500);
  };

  const doDownloadExport = () => {
    downloadText(`${model.domainName}-ddd-canvas.md`, exportedMarkdown, "text/markdown");
  };

  return (
    <div className="ddd-canvas">
      <div className="canvas-toolbar">
        <div className="aggregate-tabs" role="tablist" aria-label="Aggregates">
          {model.aggregates.map((agg) => (
            <button
              key={agg.name}
              role="tab"
              aria-selected={agg.name === activeAgg.name}
              className={`aggregate-tab${agg.name === activeAgg.name ? " aggregate-tab-active" : ""}`}
              onClick={() => onSelectAggregate(agg.name)}
            >
              {agg.name}
            </button>
          ))}
        </div>
        <div className="canvas-actions">
          <button className="btn btn-secondary" onClick={openImport}>⇪ Import Markdown</button>
          <button className="btn btn-primary" onClick={openExport}>⇩ Export Markdown</button>
        </div>
      </div>

      <div className="aggregate-summary">
        <div>
          <span className="summary-label">Aggregate</span>
          <span className="summary-value">{activeAgg.name}</span>
        </div>
        <div>
          <span className="summary-label">Root Entity</span>
          <span className="summary-value">{activeAgg.rootEntity}</span>
        </div>
        <div>
          <span className="summary-label">Lifecycle States</span>
          <span className="summary-value">{states.length ? states.join(" · ") : "—"}</span>
        </div>
      </div>

      <div className="ddd-grid">
        {/* Commands */}
        <section className="ddd-card">
          <h3 className="ddd-card-title">📥 Handled Commands</h3>
          {commands.length === 0 ? (
            <p className="muted">No commands declared.</p>
          ) : (
            <ul className="ddd-list">
              {commands.map((cmd) => (
                <li key={cmd.name} className="ddd-item">
                  <div className="ddd-item-head">
                    <span className="cmd-name">{cmd.name}</span>
                    {cmd.isCreation && <span className="badge badge-cyan">creation</span>}
                    <span className="cmd-actor">[{cmd.actor ?? "User"}]</span>
                  </div>
                  <div className="ddd-item-sub">
                    params: <code>{commandParams(cmd)}</code>
                  </div>
                  <div className="ddd-item-sub">
                    {cmd.requiredState || "∅"} → {cmd.targetState || "∅"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Events */}
        <section className="ddd-card">
          <h3 className="ddd-card-title">📢 Events & Triggers</h3>
          {emittedEvents.length === 0 && crossAggregateTriggers.length === 0 ? (
            <p className="muted">No events emitted.</p>
          ) : (
            <>
              <ul className="ddd-list">
                {emittedEvents.map((ev) => (
                  <li key={`${ev.event}-${ev.command}`} className="ddd-item">
                    <span className="event-name">{ev.event}</span>
                    <span className="ddd-item-sub">from {ev.command}</span>
                  </li>
                ))}
              </ul>
              {crossAggregateTriggers.length > 0 && (
                <>
                  <h4 className="ddd-sub-title">Cross-aggregate triggers</h4>
                  <ul className="ddd-list">
                    {crossAggregateTriggers.map((t) => (
                      <li key={`${t.source}.${t.event}`} className="ddd-item">
                        <span className="trigger-name">
                          {t.source} → {t.event}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>

        {/* Invariants & Transitions */}
        <section className="ddd-card">
          <h3 className="ddd-card-title">🛡️ Invariants & Transitions</h3>
          {(policies.length > 0 || invariants.length > 0) ? (
            <ul className="ddd-list">
              {policies.map((p) => (
                <li key={`pol-${p.name}`} className="ddd-item">
                  <span className="invariant-name">🛡️ {p.name}</span>
                  <span className="ddd-item-sub">{p.description}</span>
                </li>
              ))}
              {invariants.map((inv, i) => (
                <li key={`inv-${i}`} className="ddd-item">
                  <span className="invariant-name">⚖️ {inv.name ?? "invariant"}</span>
                  <span className="ddd-item-sub">{inv.rule}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Standard identity invariants enforced.</p>
          )}

          <h4 className="ddd-sub-title">Lifecycle transitions</h4>
          {transitions.length === 0 ? (
            <p className="muted">Derived from command requiredState → targetState.</p>
          ) : (
            <ul className="ddd-list">
              {transitions.map((t, i) => (
                <li key={`tr-${i}`} className="ddd-item">
                  <span className="transition">
                    {t.trigger}: {t.fromState} → {t.toState}
                    {t.guardCondition ? ` [${t.guardCondition}]` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Read-model projections */}
        <section className="ddd-card">
          <h3 className="ddd-card-title">📊 Read-model Projections</h3>
          {reducers.length === 0 ? (
            <p className="muted">No state projection reducers declared.</p>
          ) : (
            <ul className="ddd-list">
              {reducers.map((r, i) => (
                <li key={`red-${i}`} className="ddd-item">
                  <span className="reducer">
                    {r.commandName} → {r.operation} {r.targetField}
                  </span>
                  <span className="ddd-item-sub">source: {r.sourceParameter}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Import modal */}
      <Modal open={modal === "import"} title="Import DDD Canvas Markdown" onClose={() => setModal(null)}>
        <p className="modal-hint">
          Paste a DDD Crew Aggregate Design Canvas (v1.1) markdown document. It will be parsed via{" "}
          <code>parseDddCrewMarkdown()</code> and validated against the canonical schema.
        </p>
        <textarea
          className="import-textarea"
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="# Aggregate Design Canvas: MyDomain …"
          spellCheck={false}
        />
        {importError && <pre className="import-error">{importError}</pre>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={doImport} disabled={!importText.trim()}>
            Parse & Import
          </button>
        </div>
      </Modal>

      {/* Export modal */}
      <Modal open={modal === "export"} title="Export DDD Canvas Markdown" onClose={() => setModal(null)}>
        <pre className="export-preview">{exportedMarkdown}</pre>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={doCopyExport}>
            {copyState === "copied" ? "✓ Copied" : "Copy Markdown"}
          </button>
          <button className="btn btn-primary" onClick={doDownloadExport}>Download .md</button>
        </div>
      </Modal>
    </div>
  );
}
