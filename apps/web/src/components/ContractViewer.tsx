import { useMemo, useState } from "react";
import {
  projectOpenApi3Spec,
  /* [Commented out pending Kiro end-to-end verification]
  projectKiroSpec,
  type KiroSpecFiles,
  */
  type AstRoot
} from "@simway/spica";
import { copyText, downloadText } from "../lib/download";
import { highlightJson } from "../lib/jsonHighlight";

interface ContractViewerProps {
  model: AstRoot;
}

interface TextPaneProps {
  title: string;
  icon: string;
  accent: "blue" | "orange" | "green" | "purple" | "cyan";
  content: string;
  filename: string;
  mimeType: string;
  isJson?: boolean;
}

function ContractPane({
  title,
  icon,
  accent,
  content,
  filename,
  mimeType,
  isJson = false
}: TextPaneProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await copyText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const onDownload = () => downloadText(filename, content, mimeType);

  return (
    <section className="contract-pane">
      <div className="contract-pane-head">
        <span className={`contract-title accent-${accent}`}>
          {icon} {title}
        </span>
        <div className="contract-actions">
          <button className="btn btn-secondary btn-sm" onClick={onCopy}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onDownload}>
            Download
          </button>
        </div>
      </div>
      <pre className="contract-code">
        <code>{isJson ? highlightJson(content) : content}</code>
      </pre>
    </section>
  );
}

export function ContractViewer({ model }: ContractViewerProps) {
  /* [Commented out pending Kiro end-to-end verification]
  const [subMode, setSubMode] = useState<"api" | "kiro">("api");
  const [selectedTarget, setSelectedTarget] = useState<string>("all");
  const [activeKiroFile, setActiveKiroFile] = useState<keyof KiroSpecFiles>("requirements");
  */

  const admJson = useMemo(() => JSON.stringify(model, null, 2), [model]);
  const openApiJson = useMemo(
    () => JSON.stringify(projectOpenApi3Spec(model), null, 2),
    [model]
  );

  /* [Commented out pending Kiro end-to-end verification]
  const kiroResult = useMemo(() => {
    if (selectedTarget === "all") {
      return projectKiroSpec(model);
    }
    return projectKiroSpec(model, { aggregateName: selectedTarget });
  }, [model, selectedTarget]);
  */

  return (
    <div className="contract-viewer-shell" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Sub-header navigation toolbar */}
      <div
        className="contract-sub-toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          gap: "12px",
          flexWrap: "wrap"
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className="badge badge-cyan" style={{ fontSize: "12px", padding: "4px 8px" }}>
            🔌 Production Contracts (OpenAPI 3.0 & Open ADM)
          </span>
          {/* [Commented out pending Kiro end-to-end verification]
          <button
            className={`btn btn-sm ${subMode === "api" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSubMode("api")}
          >
            🔌 OpenAPI & ADM
          </button>
          <button
            className={`btn btn-sm ${subMode === "kiro" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSubMode("kiro")}
          >
            ⚡ AWS Kiro Specs (.kiro/specs/)
          </button>
          */}
        </div>

        {/* [Commented out pending Kiro end-to-end verification]
        {subMode === "kiro" && (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Target:</span>
            <select
              className="select-sm"
              style={{
                backgroundColor: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "12px"
              }}
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
            >
              <option value="all">📦 System Feature ({kiroResult.featureName})</option>
              {model.aggregates.map((agg) => (
                <option key={agg.name} value={agg.name}>
                  🧩 Aggregate: {agg.name}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "4px", marginLeft: "8px" }}>
              {(["requirements", "design", "tasks"] as const).map((fileKey) => (
                <button
                  key={fileKey}
                  className={`btn btn-xs ${activeKiroFile === fileKey ? "btn-primary" : "btn-secondary"}`}
                  style={{ textTransform: "capitalize", fontSize: "11px", padding: "2px 8px" }}
                  onClick={() => setActiveKiroFile(fileKey)}
                >
                  {fileKey}.md
                </button>
              ))}
            </div>
          </div>
        )}
        */}
      </div>

      {/* Content Panes */}
      <div className="contract-viewer">
        <ContractPane
          title="Application Domain Model (ADM)"
          icon="📄"
          accent="blue"
          content={admJson}
          filename="adm.json"
          mimeType="application/json"
          isJson
        />
        <ContractPane
          title="OpenAPI 3.0.3 Specification"
          icon="🔌"
          accent="orange"
          content={openApiJson}
          filename="openapi.json"
          mimeType="application/json"
          isJson
        />
      </div>

      {/* [Commented out pending Kiro end-to-end verification]
      {subMode === "kiro" && (
        <div className="contract-viewer" style={{ gridTemplateColumns: "1fr" }}>
          <ContractPane
            title={
              activeKiroFile === "requirements"
                ? `requirements.md — EARS User Stories & Criteria (.kiro/specs/${kiroResult.featureName}/)`
                : activeKiroFile === "design"
                ? `design.md — Architecture & State Machines (.kiro/specs/${kiroResult.featureName}/)`
                : `tasks.md — Actionable Implementation Checklist (.kiro/specs/${kiroResult.featureName}/)`
            }
            icon={activeKiroFile === "requirements" ? "📝" : activeKiroFile === "design" ? "📐" : "☑️"}
            accent={activeKiroFile === "requirements" ? "green" : activeKiroFile === "design" ? "blue" : "orange"}
            content={kiroResult.files[activeKiroFile]}
            filename={`${activeKiroFile}.md`}
            mimeType="text/markdown"
            isJson={false}
          />
        </div>
      )}
      */}
    </div>
  );
}
