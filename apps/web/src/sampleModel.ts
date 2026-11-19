import rawJson from "./canonical-library.adm.json";
import { validateAdm, type AstRoot } from "@simway/spica";

const model = rawJson as unknown as AstRoot;
const res = validateAdm(model);
if (!res.valid || !res.model) {
  throw new Error("Invalid canonical library model: " + JSON.stringify(res.errors));
}

export const CANONICAL_LIBRARY_MODEL: AstRoot = res.model;
