<p align="center">
  <img src="assets/spica-banner.svg" alt="Spica — Open Domain Model and Projection Toolchain for SDD" width="600" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@simway/spica"><img src="https://img.shields.io/badge/npm-@simway%2Fspica-blue.svg?style=flat" alt="npm package" /></a>
  <a href="llms.txt"><img src="https://img.shields.io/badge/llms.txt-Agent_Ready-6366f1?style=flat" alt="llms.txt" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-475569.svg?style=flat" alt="License: Apache 2.0" /></a>
</p>

---

> **One Domain Model. Multiple Projections.**  
> Spica is a projection toolchain for **Spec-Driven Development (SDD)**, built around Open ADM, an open, machine-verifiable specification for application-domain models.  
> Define domain rules once in Open ADM and generate projections for C4 diagrams, domain maps, DDD Crew canvases, and OpenAPI 3.0 contracts.
>  
> 🤖 **For AI Agents:** Install the Spica Architect skill with `npx skills add sim-way/spica --skill spica-architect`.

---

### 🧠 What is Spica?

Spica is an open Spec-Driven Development toolchain that turns a machine-verifiable domain model into architecture diagrams, API contracts, and other project artifacts.

#### Open ADM: Spica's domain-model IR

Open ADM (Application Domain Model) is an Apache-2.0-licensed, machine-verifiable **Intermediate Representation (IR)** for business-domain concepts. It gives Spica a structured source from which to generate multiple artifacts:

```
[ Fuzzy Business Intent / PRD / AI Prompt ]
                    │
                    ▼
      ┌───────────────────────────┐
      │       Open ADM (IR)       │  ◄── Application Domain Model:
      │ Entities · States · Rules │      Canonical source for modeled domain concepts
      └─────────────┬─────────────┘
                    │ (Generated Projections)
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   [ C4 Docs ]  [ Domain Map ]  [ OpenAPI / Other Artifacts ]
```

#### Why not just OpenAPI, Prisma, or TypeScript?

| Specification | What It Captures | What It Misses |
| :--- | :--- | :--- |
| **OpenAPI / Swagger** | HTTP routes, REST verbs, JSON payloads | Does not natively model aggregate boundaries, state-machine semantics (`Created → Paid → Shipped`), or domain invariants. |
| **Prisma / SQL DDL** | Database tables, column types, foreign keys | Does not by itself model business operations, lifecycle rules, or domain events. |
| **TypeScript / Zod** | Typed data shapes and runtime validation | Types and schemas alone do not define domain semantics or generate cross-system architecture projections. |
| **Open ADM** | A model of selected business-domain concepts | Captures entities, lifecycle states, commands, event emissions, and declared invariants in a machine-verifiable JSON model. |

---

### 💡 Why Spica?

- **Agent-Centered Workflow:** Gives AI coding agents (Claude Code, Codex, Cursor) a validated, machine-verifiable domain model to reference during implementation.
- **Deterministic Validation:** Checks schema integrity, aggregate boundaries, and state-machine lifecycles without requiring database containers or a project build.
- **Tech-Agnostic Intent:** Models pure business semantics free of framework, ORM, or database coupling.

---

### 🔄 Multi-Lens Projections

From a single Open ADM model, Spica deterministically generates multiple project artifacts:

| Lens | Purpose | Output Format | CLI Command |
| :--- | :--- | :--- | :--- |
| **🌐 Macro Architecture** | System Documentation | C4 Level 1 System Context diagram | `spica project-c4 <file>` |
| **📊 Domain Map** | Technical Review & Invariants | Topological aggregate map & state lifecycles | `spica project-domain-map <file>` |
| **📋 Domain Canvas** | Team Discovery & Visual Modeling | DDD Crew Aggregate Design Canvas (Markdown export) | `spica build` |
| **🔌 OpenAPI Contract** | REST APIs & Gateways | OpenAPI 3.0.3 specification with typed models & error schemas | `spica project-openapi <file>` |

---

### ⚡ Quick Start

**Prerequisites:** Node.js 20 or later is required for `npx` and the Spica CLI. For local development, pnpm is also required.

#### 1. Bootstrap IDE Tooling
Scaffold turnkey configs (`CLAUDE.md`, `CODEX.md`, and `.vscode/settings.json`) in your project root:

```bash
npx -y @simway/spica init
```

#### 2. Author & Validate Your Domain Model
Scaffold a schema-compliant model or validate an existing one:

```bash
# Scaffold a new domain model (defaults to .spica/<Domain>.adm.json)
npx -y @simway/spica new Billing --actor Admin --aggregate Invoice

# Validate the model and its declared constraints
npx -y @simway/spica validate .spica/Billing.adm.json
```

#### 3. Build & Project
```bash
# Validate, then generate the projection bundle in one command
npx -y @simway/spica build .spica/Billing.adm.json

# Or project individual lenses on-demand
npx -y @simway/spica project-c4 .spica/Billing.adm.json -o c4-context.mmd
npx -y @simway/spica project-domain-map .spica/Billing.adm.json -o domain-map.mmd
npx -y @simway/spica project-openapi .spica/Billing.adm.json -o openapi.json
```

---

### 🛠️ Local Development

```bash
git clone https://github.com/sim-way/spica.git
cd spica
pnpm install
pnpm dev       # Launches local development server
pnpm test      # Runs automated verification test suite
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for contribution guidelines.

---

### 📚 Resources

- 🤖 **[Claude Code & Agent Skill](skills/spica-architect/SKILL.md):** AgentSkills standard for autonomous coding agents.
- 🤖 **[Spica Architect Prompt](prompts/spica-architect.md):** Socratic DDD domain modeler system prompt.
- ⚖️ **[License](LICENSE):** Apache 2.0 for Spica project code; see [NOTICE](NOTICE) for third-party material.
