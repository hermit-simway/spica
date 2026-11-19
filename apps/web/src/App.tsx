import { useEffect, useMemo, useState } from "react";
import {
  projectDomainAggregateMap,
  projectSystemContextDiagram,
  validateAdm,
  type AstRoot
} from "@simway/spica";
import { CANONICAL_LIBRARY_MODEL } from "./sampleModel";
import { DEFAULT_TAB, type LensTab } from "./tabs";
import { buildDriftModel } from "./lib/drift";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { MermaidCanvas } from "./components/MermaidCanvas";
import { DddCrewCanvas } from "./components/DddCrewCanvas";
import { ContractViewer } from "./components/ContractViewer";
import { UmlAuditModal } from "./components/UmlAuditModal";
import { DiagnosticsDrawer } from "./components/DiagnosticsDrawer";

export function App() {
  const [activeTab, setActiveTab] = useState<LensTab>(DEFAULT_TAB);
  const [model, setModel] = useState<AstRoot>(CANONICAL_LIBRARY_MODEL);
  const [selectedAggregate, setSelectedAggregate] = useState<string>(
    CANONICAL_LIBRARY_MODEL.aggregates[0]?.name ?? ""
  );
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [umlOpen, setUmlOpen] = useState(false);
  const [drifted, setDrifted] = useState(false);

  const activeModel = useMemo(() => (drifted ? buildDriftModel(model) : model), [model, drifted]);
  const validation = useMemo(() => validateAdm(activeModel), [activeModel]);

  // Keep the selected aggregate valid when the model is replaced (e.g. markdown import).
  useEffect(() => {
    if (!activeModel.aggregates.some((a) => a.name === selectedAggregate)) {
      setSelectedAggregate(activeModel.aggregates[0]?.name ?? "");
    }
  }, [activeModel, selectedAggregate]);

  const diagram = useMemo(() => {
    if (activeTab === "c4") {
      return { source: projectSystemContextDiagram(activeModel), title: "system-context" };
    }
    if (activeTab === "domain-map") {
      return { source: projectDomainAggregateMap(activeModel), title: "domain-map" };
    }
    return null;
  }, [activeTab, activeModel]);

  const handleTabChange = (tab: LensTab) => {
    if (tab === "uml-audit") {
      setUmlOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  const handleImportModel = (imported: AstRoot) => {
    setDrifted(false);
    setModel(imported);
    setSelectedAggregate(imported.aggregates[0]?.name ?? "");
    setActiveTab("ddd-canvas");
  };

  const handleInjectDrift = () => setDrifted((d) => !d);

  return (
    <div className="studio-shell">
      <WorkspaceHeader
        model={activeModel}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        selectedAggregate={selectedAggregate}
        onAggregateChange={setSelectedAggregate}
        errorCount={validation.errors.length}
        warningCount={validation.warnings.length}
        onOpenDiagnostics={() => setDiagnosticsOpen((o) => !o)}
      />

      <main className="studio-main">
        {diagram && <MermaidCanvas diagram={diagram.source} title={diagram.title} />}

        {activeTab === "ddd-canvas" && (
          <DddCrewCanvas
            model={activeModel}
            selectedAggregate={selectedAggregate}
            onSelectAggregate={setSelectedAggregate}
            onImportModel={handleImportModel}
          />
        )}

        {activeTab === "contracts" && <ContractViewer model={activeModel} />}

        {drifted && (
          <div className="drift-banner">
            ⚠️ Showing a <strong>drifted</strong> model (injected <code>*Id</code> reference + missing{" "}
            <code>$id</code>) to demonstrate live diagnostics.
          </div>
        )}
      </main>

      <DiagnosticsDrawer
        validation={validation}
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        onInjectDrift={handleInjectDrift}
      />

      <UmlAuditModal open={umlOpen} onClose={() => setUmlOpen(false)} />
    </div>
  );
}
