import type { AstRoot, FieldNode } from "@simway/spica";

/**
 * Builds a deliberately "drifted" copy of a valid model to exercise the
 * live `validateAdm` diagnostics drawer:
 *  1. Injects an unresolved `*Id` foreign reference (`ghostId` → `Ghost`).
 *  2. Strips the root entity's explicit `$id` field (implicit identity warning).
 */
export function buildDriftModel(model: AstRoot): AstRoot {
  const clone = JSON.parse(JSON.stringify(model)) as AstRoot;
  const aggregate = clone.aggregates[0];
  if (!aggregate) return clone;

  const rootEntity = (aggregate.entities ?? []).find((e) => e.name === aggregate.rootEntity);
  if (rootEntity) {
    const driftField: FieldNode = {
      name: "ghostId",
      type: "string",
      required: false
    };
    rootEntity.fields.push(driftField);

    // Strip explicit identity to surface the implicit-root-id warning.
    rootEntity.fields = rootEntity.fields.filter((f) => f.name !== "$id");
  }

  return clone;
}
