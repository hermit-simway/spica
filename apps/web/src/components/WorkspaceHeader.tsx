import type { AstRoot } from "@simway/spica";
import { LENS_TABS, type LensTab } from "../tabs";

interface WorkspaceHeaderProps {
  model: AstRoot;
  activeTab: LensTab;
  onTabChange: (tab: LensTab) => void;
  selectedAggregate: string;
  onAggregateChange: (name: string) => void;
  errorCount: number;
  warningCount: number;
  onOpenDiagnostics: () => void;
}

export function WorkspaceHeader({
  model,
  activeTab,
  onTabChange,
  selectedAggregate,
  onAggregateChange,
  errorCount,
  warningCount,
  onOpenDiagnostics
}: WorkspaceHeaderProps) {
  const clean = errorCount === 0;

  return (
    <header className="studio-header">
      <div className="studio-brand">
        <span className="studio-logo">⚡</span>
        <strong className="studio-name">SPICA STUDIO</strong>
        <span className="studio-version">v0.1.0</span>
        <span className="studio-sep">|</span>
        <span className="studio-domain">{model.domainName}</span>

        <select
          className="aggregate-select"
          value={selectedAggregate}
          onChange={(e) => onAggregateChange(e.target.value)}
          aria-label="Select aggregate"
        >
          {model.aggregates.map((agg) => (
            <option key={agg.name} value={agg.name}>
              {agg.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="studio-tabs" aria-label="Workspace lenses">
        {LENS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-button${isActive ? " tab-active" : ""}`}
              onClick={() => onTabChange(tab.id)}
              aria-pressed={isActive}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <button
        className="diagnostics-badge"
        onClick={onOpenDiagnostics}
        title="Toggle diagnostics drawer"
        aria-label="Toggle diagnostics drawer"
      >
        <span className={`status-dot ${clean ? "dot-ok" : "dot-error"}`} />
        <span className={clean ? "text-ok" : "text-error"}>
          {clean ? "Invariants Clean" : `${errorCount} Error${errorCount === 1 ? "" : "s"}`}
        </span>
        {warningCount > 0 && <span className="text-warn">· {warningCount} warn</span>}
      </button>
    </header>
  );
}
