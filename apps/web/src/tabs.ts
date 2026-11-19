export type LensTab = "c4" | "domain-map" | "ddd-canvas" | "contracts" | "uml-audit";

export interface LensTabDef {
  id: LensTab;
  label: string;
}

export const LENS_TABS: LensTabDef[] = [
  { id: "c4", label: "🌐 System Context" },
  { id: "domain-map", label: "📊 Domain Map" },
  { id: "ddd-canvas", label: "📋 Domain Canvas" },
  { id: "contracts", label: "🔌 OpenAPI / ADM" },
  { id: "uml-audit", label: "🔒 UML Audit" }
];

export const DEFAULT_TAB: LensTab = "c4";
