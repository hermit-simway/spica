import { AstRoot, AggregateNode, EntityNode, CommandNode, FieldNode } from "./schema.js";

/**
 * Projects a validated AstRoot into a pure OpenAPI 3.0.3 specification object.
 * Maps creation commands, mutation commands, and entity query projections deterministically.
 */
export function projectOpenApi3Spec(model: AstRoot): Record<string, unknown> {
  const paths: Record<string, any> = {};
  const schemas: Record<string, any> = {};

  // Standard Error Envelope Schemas
  schemas["InvariantViolation"] = {
    type: "object",
    properties: {
      error: { type: "string", example: "INVARIANT_VIOLATION" },
      message: { type: "string", example: "Business rule violation" },
      rule: { type: "string", example: "RuleName" }
    },
    required: ["error", "message"]
  };

  schemas["AggregateNotFound"] = {
    type: "object",
    properties: {
      error: { type: "string", example: "AGGREGATE_NOT_FOUND" },
      message: { type: "string", example: "Target aggregate instance was not found" },
      aggregate: { type: "string", example: "AggregateName" },
      id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" }
    },
    required: ["error", "message", "aggregate", "id"]
  };

  for (const agg of model.aggregates) {
    const pluralPath = toPluralKebab(agg.name);
    const tag = agg.name;

    // 1. Generate EntityNode Schemas for this AggregateNode
    for (const entity of agg.entities ?? []) {
      schemas[entity.name] = entityToOpenApiSchema(entity);
    }

    // 2. Query Endpoint: GET /api/{plural}/{id}
    const queryPath = `/api/${pluralPath}/{id}`;
    if (!paths[queryPath]) {
      paths[queryPath] = {};
    }
    paths[queryPath]["get"] = {
      tags: [tag],
      summary: `Get ${agg.name} by ID`,
      description: `Retrieves the current state projection of ${agg.name} aggregate instance.`,
      operationId: `get${agg.name}ById`,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          description: `Unique identifier of the ${agg.name}`,
          schema: { type: "string" }
        }
      ],
      responses: {
        "200": {
          description: `${agg.name} aggregate state retrieved successfully`,
          content: {
            "application/json": {
              schema: {
                $ref: `#/components/schemas/${agg.rootEntity}`
              }
            }
          }
        },
        "404": {
          description: `${agg.name} not found`,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AggregateNotFound"
              }
            }
          }
        }
      }
    };

    // 3. CommandNode Endpoints
    for (const cmd of agg.commands ?? []) {
      const isCreation = cmd.isCreation || (!cmd.requiredState && cmd.targetState);
      const reqSchemaName = `${cmd.name}Request`;
      schemas[reqSchemaName] = commandToRequestSchema(cmd);

      if (isCreation) {
        // Creation CommandNode: POST /api/{plural}
        const createPath = `/api/${pluralPath}`;
        if (!paths[createPath]) {
          paths[createPath] = {};
        }

        const requestBody = buildRequestBody(cmd, reqSchemaName);

        paths[createPath]["post"] = {
          tags: [tag],
          summary: cmd.name,
          description: `Creates a new ${agg.name} aggregate instance in state '${cmd.targetState || "Active"}'.`,
          operationId: cmd.name,
          ...(requestBody ? { requestBody } : {}),
          responses: {
            "201": {
              description: `${agg.name} created successfully`,
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/${agg.rootEntity}`
                  }
                }
              }
            },
            "400": {
              description: "Invalid creation parameters or invariant violation",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/InvariantViolation"
                  }
                }
              }
            }
          }
        };
      } else {
        // Mutation CommandNode: POST /api/{plural}/{id}/{action}
        const actionKebab = toKebabCase(cmd.name);
        const actionPath = `/api/${pluralPath}/{id}/${actionKebab}`;
        if (!paths[actionPath]) {
          paths[actionPath] = {};
        }

        const requestBody = buildRequestBody(cmd, reqSchemaName);

        paths[actionPath]["post"] = {
          tags: [tag],
          summary: cmd.name,
          description: `Executes '${cmd.name}' on ${agg.name}. Requires state: '${cmd.requiredState}'. Transitions to: '${cmd.targetState || cmd.requiredState}'.`,
          operationId: cmd.name,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: `Unique identifier of the ${agg.name}`,
              schema: { type: "string" }
            }
          ],
          ...(requestBody ? { requestBody } : {}),
          responses: {
            "200": {
              description: `${cmd.name} executed successfully`,
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/${agg.rootEntity}`
                  }
                }
              }
            },
            "400": {
              description: "Invalid state transition or invariant violation",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/InvariantViolation"
                  }
                }
              }
            },
            "404": {
              description: `${agg.name} not found`,
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/AggregateNotFound"
                  }
                }
              }
            }
          }
        };
      }
    }
  }

  return {
    openapi: "3.0.3",
    info: {
      title: model.systemName || model.domainName,
      version: model.specVersion ?? "0.0.0",
      description: model.systemDescription || `API specification for ${model.domainName} domain.`
    },
    paths,
    components: {
      schemas
    }
  };
}

function entityToOpenApiSchema(entity: EntityNode): Record<string, any> {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const field of entity.fields) {
    properties[field.name] = fieldToPropertySchema(field);
    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {})
  };
}

function commandToRequestSchema(cmd: CommandNode): Record<string, any> {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const param of cmd.parameters || []) {
    properties[param.name] = fieldToPropertySchema(param);
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {})
  };
}

function fieldToPropertySchema(field: FieldNode): Record<string, any> {
  let baseSchema: Record<string, any>;

  switch (field.type.toLowerCase()) {
    case "string":
      baseSchema = { type: "string" };
      break;
    case "number":
      baseSchema = { type: "number" };
      break;
    case "integer":
      baseSchema = { type: "integer" };
      break;
    case "boolean":
      baseSchema = { type: "boolean" };
      break;
    case "date":
      baseSchema = { type: "string", format: "date" };
      break;
    case "datetime":
      baseSchema = { type: "string", format: "date-time" };
      break;
    default:
      baseSchema = { type: "string" };
      break;
  }

  if (field.description) {
    baseSchema.description = field.description;
  }

  if (field.isList) {
    return {
      type: "array",
      items: baseSchema
    };
  }

  return baseSchema;
}

function buildRequestBody(cmd: CommandNode, schemaName: string): Record<string, any> | undefined {
  if (!cmd.parameters || cmd.parameters.length === 0) {
    return undefined;
  }
  return {
    required: true,
    content: {
      "application/json": {
        schema: {
          $ref: `#/components/schemas/${schemaName}`
        }
      }
    }
  };
}

/**
 * Converts PascalCase string into kebab-case.
 * e.g. "RegisterPatron" -> "register-patron", "PayFee" -> "pay-fee"
 */
export function toKebabCase(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Converts PascalCase AggregateNode Name into pluralized kebab-case.
 * e.g. "Patron" -> "patrons", "BookCopy" -> "book-copies", "Hold" -> "holds"
 */
export function toPluralKebab(name: string): string {
  const kebab = toKebabCase(name);
  if (kebab.endsWith("y") && !kebab.endsWith("ey") && !kebab.endsWith("ay")) {
    return `${kebab.slice(0, -1)}ies`;
  }
  if (kebab.endsWith("s") || kebab.endsWith("ch") || kebab.endsWith("sh")) {
    return `${kebab}es`;
  }
  return `${kebab}s`;
}
