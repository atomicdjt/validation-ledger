# Validation Ledger Governance Model

Validation Ledger introduces a rigorous, auditable product governance model. It shifts product management from informal, ephemeral documents to a robust, traceable system of record.

This document defines the core entities and concepts in the Validation Ledger governance model.

## Core Entities

*   **Evidence (EvidenceSignal):** An atomic unit of data extracted from a primary source (e.g., an interview transcript, an email). It represents a concrete observation from the real world. Evidence is immutable once captured; any changes result in a new Revision.
*   **Claim (Hypothesis):** A testable statement about the market, user needs, or product viability. Claims are continuously evaluated based on the weight of Evidence that supports or contradicts them.
*   **Decision:** A discrete, impactful choice made by the product team (e.g., "Build Feature X", "Pivot to Market Y"). Decisions are not made in a vacuum; they must be explicitly informed by Claims and Evidence, creating a clear chain of rationale.
*   **Assumption:** A belief or premise accepted as true without definitive proof, necessary to proceed with a Decision. Assumptions must be explicitly documented and tracked to ensure they are validated or invalidated over time.
*   **Alternative:** A viable option considered and ultimately rejected in favor of the chosen Decision. Documenting Alternatives prevents "decision amnesia" and provides context for future reviews.
*   **Risk:** A potential negative outcome or uncertainty associated with a Decision. Risks must be assessed for severity and status (unassessed, mitigated, accepted).
*   **Constraint:** (Currently represented via Segment Characteristics or implicitly in Risks/Assumptions). A boundary or limitation within which a Decision must be made (e.g., budget, timeline, technical debt).
*   **Review:** A formal evaluation of a Decision by a designated reviewer (e.g., a stakeholder or subject matter expert). Reviews ensure accountability and quality control before a Decision is finalized or after significant new information comes to light.
*   **Revision:** An immutable ledger entry capturing any change to a core entity (Decision, Evidence, Claim, Assumption, Alternative, Risk, Review). Revisions guarantee complete auditability, showing who changed what, when, and why, along with cryptographic hashes to prevent silent tampering.

## Lifecycle & Governance Concepts

*   **Outcome:** The real-world result of a implemented Decision. Tracking Outcomes closes the feedback loop, allowing the team to measure whether the Decision achieved its intended effect.
*   **Provenance:** The unbroken chain of origin for a piece of Evidence. The system maintains a `provenanceState` (e.g., `exact`, `normalized`, `unverified`) to guarantee that an Evidence excerpt accurately reflects the original raw source text. If the source text is altered or the excerpt cannot be located, provenance degrades to `unverified`.
*   **Supersession:** The process by which newer, more accurate Evidence or a revised Decision replaces an older one. The older entity's state changes (e.g., to `superseded`), but it remains in the immutable history for audit purposes.
*   **Contradiction:** A state where new Evidence directly conflicts with an existing Claim or Decision, or where two pieces of Evidence offer conflicting signals. The system surfaces contradictions to force the team to resolve the ambiguity and update their understanding.
