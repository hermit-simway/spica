import { Modal } from "./Modal";

interface UmlAuditModalProps {
  open: boolean;
  onClose: () => void;
}

const DELIVERABLES = [
  {
    icon: "🧬",
    title: "PlantUML Class Diagrams",
    detail: "Full entity composition (*--) and association (-->) semantics for every aggregate."
  },
  {
    icon: "🔁",
    title: "State Machine Diagrams",
    detail: "Lifecycle soundness, state reachability, and guard evaluation per command."
  },
  {
    icon: "🗺️",
    title: "XMI Exports",
    detail: "Sparx Enterprise Architect interoperability via deterministic XMI 2.5 serialization."
  },
  {
    icon: "🛡️",
    title: "ARB Audit Certificate",
    detail: "Architecture Review Board sign-off record with invariant traceability."
  }
];

export function UmlAuditModal({ open, onClose }: UmlAuditModalProps) {
  return (
    <Modal
      open={open}
      title="Enterprise Architecture Governance Pack"
      onClose={onClose}
      footer={
        <div className="uml-cta-row">
          <button className="btn btn-primary btn-lg">Request Enterprise Access</button>
          <span className="muted">Part of the Simway Enterprise Governance Suite</span>
        </div>
      }
    >
      <div className="uml-lock">🔒</div>
      <p className="uml-lead">
        Lens 5 unlocks the deterministic Enterprise Architecture Governance Pack — the formal UML
        contract surface between the Application Domain Model and the Java Spout compiler.
      </p>

      <div className="uml-deliverables">
        {DELIVERABLES.map((d) => (
          <div key={d.title} className="uml-deliverable">
            <span className="uml-deliverable-icon">{d.icon}</span>
            <div>
              <div className="uml-deliverable-title">{d.title}</div>
              <div className="uml-deliverable-detail">{d.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
