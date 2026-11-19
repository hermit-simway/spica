import type { ValidationResult } from "@simway/spica";

interface DiagnosticsDrawerProps {
  validation: ValidationResult;
  open: boolean;
  onClose: () => void;
  onInjectDrift?: () => void;
}

function isIdDrift(item: { code: string }): boolean {
  return item.code === "E_UNRESOLVED_ENTITY_ID_REF" || item.code === "W_IMPLICIT_ROOT_ID";
}

export function DiagnosticsDrawer({
  validation,
  open,
  onClose,
  onInjectDrift
}: DiagnosticsDrawerProps) {
  const { errors, warnings, valid } = validation;
  const idDriftCount = [...errors, ...warnings].filter(isIdDrift).length;

  return (
    <div className={`diagnostics-drawer${open ? " drawer-open" : ""}`} aria-hidden={!open}>
      <div className="drawer-head">
        <div className="drawer-title">
          <span className={`status-dot ${valid ? "dot-ok" : "dot-error"}`} />
          <span>Live Diagnostics</span>
          <span className="drawer-counts">
            <span className={errors.length ? "text-error" : "text-ok"}>{errors.length} errors</span>
            <span className={warnings.length ? "text-warn" : "text-ok"}>{warnings.length} warnings</span>
            {idDriftCount > 0 && <span className="text-warn">· {idDriftCount} *Id drift</span>}
          </span>
        </div>
        <div className="drawer-actions">
          {onInjectDrift && (
            <button className="btn btn-secondary btn-sm" onClick={onInjectDrift}>
              Inject sample drift
            </button>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close diagnostics">
            ✕
          </button>
        </div>
      </div>

      <div className="drawer-body">
        {valid ? (
          <p className="muted">
            No invariant violations. Every aggregate declares lifecycle states, commands resolve to
            valid state transitions, and all <code>*Id</code> foreign references resolve to declared
            aggregates or entities.
          </p>
        ) : (
          <>
            {errors.length > 0 && (
              <div className="diag-section">
                <h4 className="diag-section-title">Invariant violations & schema errors</h4>
                <ul className="diag-list">
                  {errors.map((e, i) => (
                    <li key={`err-${i}`} className={`diag-item diag-error${isIdDrift(e) ? " diag-idrift" : ""}`}>
                      <code className="diag-code">{e.code}</code>
                      <span className="diag-path">{e.path}</span>
                      <span className="diag-msg">{e.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="diag-section">
                <h4 className="diag-section-title">Warnings & unmanaged foreign identities</h4>
                <ul className="diag-list">
                  {warnings.map((w, i) => (
                    <li key={`warn-${i}`} className={`diag-item diag-warn${isIdDrift(w) ? " diag-idrift" : ""}`}>
                      <code className="diag-code">{w.code}</code>
                      <span className="diag-path">{w.path}</span>
                      <span className="diag-msg">{w.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {idDriftCount > 0 && (
              <div className="diag-guidance">
                <strong>Guidance:</strong> resolve <code>*Id</code> drift by ensuring every{" "}
                <code>*Id</code> field references a declared aggregate/entity, and every root entity
                declares an explicit <code>$id</code> field. Re-run <code>validateAdm(model)</code> to
                confirm structural completeness.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
