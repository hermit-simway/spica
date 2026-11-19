# Contributing to Spica

Thank you for your interest in contributing to **Spica: The Open Meta-Specification for Spec-Driven Development (SDD)**!

Spica is an Apache 2.0 open-source project designed to bridge human domain experts and AI coding agents by providing a single, machine-verifiable source of truth (Open ADM).

---

## 🏛️ Monorepo Architecture

Spica is organized as a lightweight `pnpm` monorepo:

```text
spica/
├── packages/
│   ├── core/              # @simway/spica: Open ADM Zod schema, validator, CLI, and projectors
│   └── mcp/               # @simway/spica-mcp: Model Context Protocol server (Planned / TBD)
├── apps/
│   └── web/               # Spica Studio: Interactive web canvas (Vite + React + Mermaid)
├── skills/
│   └── spica-architect/   # AgentSkills standard skill for Claude Code & AI agents
└── prompts/
    └── spica-architect.md # Socratic DDD prompt for LLMs
```

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js:** v20.0.0 or higher (CI runs v22)
- **Package Manager:** `pnpm` v11.2.2 (`npm install --global pnpm@11.2.2`)

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/sim-way/spica.git
cd spica

# 2. Install dependencies across workspace
pnpm install

# 3. Build all packages
pnpm build

# 4. Run test suites
pnpm test
```

---

## 🧪 Testing & Verification

We enforce strict test coverage and zero-regression rules:

```bash
# Run all unit and projector tests
pnpm test

# Typecheck TypeScript across all packages
pnpm typecheck

# Start Spica Studio locally
pnpm --filter web dev
```

---

## 📐 Architectural Principles

1. **Format Hegemony & Spec Purity:** Open ADM is a pure domain specification (IR). It must never be polluted with runtime hacks, ORM compromises, or language-specific exhaust.
2. **Deterministic Invariant Validation:** Any additions to the ADM schema must come with corresponding mathematical validators in `@simway/spica` (`admValidator.ts`).
3. **Spec-Driven Projections:** Projections (Kiro, OpenAPI, C4, Mermaid, DDD Crew) must be deterministic and pure functions of the validated ADM AST.

---

## 📬 Submitting a Pull Request

1. Fork the repo and create a feature branch (`git checkout -b feat/your-feature-name`).
2. Ensure all tests and typechecks pass (`pnpm test && pnpm typecheck`).
3. Write clean, conventional commit messages (`feat: ...`, `fix: ...`, `docs: ...`).
4. Push your branch and open a Pull Request against `main`.

---

## ⚖️ License & Attribution

By contributing to Spica, you agree that your contributions will be licensed under the **Apache License, Version 2.0**.
