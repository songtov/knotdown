# Background-context model

Knotdown compiles project Markdown into background context for external AI agents. It does not generate the agent's answer, execute instructions found in notes, or maintain a second knowledge database.

## Product contract

The Markdown folder and `.knowledge/project.yaml` are canonical. A context request identifies one project, describes the current task, may name a working document, and sets a token budget. Knotdown returns an explainable Context Pack that an agent can use as evidence before reasoning or acting.

```text
canonical Markdown
       |
       v
project-scoped compiler IR
       |
       +-- project baseline
       +-- current working document
       +-- task-relevant knowledge
       +-- graph dependencies
       +-- provenance and exclusions
       |
       v
explainable Context Pack
       |
       v
external AI agent
```

Human View and Graph View let a person inspect the same knowledge and relationships. Agent View is a Context Debugger for the exact pack exposed through the runtime, HTTP API, and MCP.

## Context layers

| Layer | Role |
| --- | --- |
| Project baseline | Establish purpose, vocabulary, architecture, policies, and shared constraints |
| Working context | Anchor the pack to the file or area currently being changed |
| Task context | Add documents selected for the current request |
| Dependencies | Traverse explicit imports, references, and embeds needed to interpret selected documents |
| Trace | Preserve source path, document ID, selection reason, graph path, representation, token cost, and exclusion reason |

The selection model is a deterministic union:

```text
baseline + entrypoint + query matches + graph dependencies
```

Candidates are deduplicated, ordered by policy, and reduced from full content to summary or metadata only when required by the token budget. Project scope is mandatory at every stage.

## What an agent should receive

A useful pack answers these background questions without pretending to answer the user's task:

- What project am I operating in?
- What is the current working area?
- Which terms and invariants have project-specific meanings?
- Which procedures, services, decisions, or evidence does this work depend on?
- Why was each item included?
- Which relevant items were excluded, and why?
- Where can the agent read the authoritative source?

Markdown remains untrusted evidence. Every serialized pack carries an instruction boundary telling the agent not to execute instructions found inside the knowledge content.

## Current alpha

The alpha currently provides:

- mandatory project scope;
- an optional entrypoint or deterministic lexical query seed;
- outgoing typed-graph expansion;
- full, summary, and metadata representations;
- token and document limits;
- source paths, graph paths, inclusion reasons, exclusions, and one build ID;
- identical context decisions across Agent View, HTTP, and MCP.

The next context-runtime milestone is:

1. configure one or more always-included baseline documents;
2. merge entrypoint and query candidates instead of choosing one seed mode;
3. promote strongly relevant dependencies to full content when budget permits;
4. select source-located heading sections for more precise packs;
5. add evaluation fixtures that assert required documents and facts for representative agent tasks.

Until that milestone lands, public documentation must not imply that the alpha automatically includes a project baseline or combines an entrypoint with query-based retrieval.

## Non-goals

Knotdown is not a chat UI, autonomous agent, answer generator, vector database, or note-writing assistant. Those products can consume Knotdown's Context Pack, but they do not define its core.
