# MedDelta

**Working title:** Evidence-linked temporal medication reconciliation for pharmacist review.

## Decision

Build MedDelta with a pharmacist as the domain reviewer. The first version compares typed medication instructions across dated documents, reconstructs explicit changes, and flags unresolved contradictions. It supports reconciliation; it does not prescribe, select a preferred treatment, or tell patients to stop or change medication.

## Target user and workflow

The primary user is a pharmacist reviewing records from several visits.

1. Import two or three typed records for one fictional patient.
2. Extract medication, ingredient (when verified), strength, formulation, route, dose, frequency, start/end dates, and explicit action words.
3. Show extracted fields beside their source passages for correction.
4. Build a timeline of documented instructions.
5. Display explicit changes, unresolved contradictions, and missing information.
6. Let the pharmacist record a resolution and its supporting evidence.

Every finding retains document ID, source text, document date, effective date if present, and uncertainty. Document date and treatment effective date are separate fields. Absence from a later list is not automatically a stop order. A later date alone does not establish clinical authority. A changed instruction can be intentional; a difference is not automatically an error.

## Proposed technical contribution

Test whether structured medication events, explicit temporal reasoning, and source-linked clarification questions improve reconciliation over a single-prompt language model and a simple latest-document comparison.

Research question: Can the system distinguish documented regimen changes from unresolved instruction conflicts while reducing unsupported resolutions and maintaining useful coverage?

This is a proposed contribution, not an established novelty claim. Medication reconciliation, prescription extraction, and brand matching already exist. Verify the precise gap before proposing publication or patent claims.

Relevant prior work:

- Medication Companion: https://github.com/dwivedialok/medication-companion
- AI-Based Automation for Medication Reconciliation, scoping review: https://pmc.ncbi.nlm.nih.gov/articles/PMC13160534/

## First milestone

Support typed English records and a small, pharmacist-verified medication vocabulary. Implement structured extraction, source verification, timeline construction, and four scenario families:

- Explicitly documented replacement or dose change.
- Conflicting overlapping instructions without a documented resolution.
- A medication omitted from a later document without an explicit stop.
- An uncertain medication match or missing date requiring clarification.

Do not start with handwriting recognition, a national brand database, drug interaction checking, diagnosis, treatment recommendations, multilingual voice, or hospital integration. Those features would enlarge the validation problem before the core contribution is demonstrated.

## Pharmacist involvement

Ask the pharmacist to help define what counts as an explicit change, an unresolved conflict, and insufficient evidence. Have them review fictional cases and corrections to the small medication vocabulary. Collect review notes rather than treating every annotation as unquestionable ground truth.

Start with a modest development set of fictional cases. Freeze a separate evaluation set before model or rule tuning. Group cases derived from the same template in the same split to reduce leakage. Synthetic cases establish controlled task performance, not clinical effectiveness. Real patient records are unnecessary for the first version.

## Evaluation

Compare:

1. A simple latest-document comparison.
2. A single-prompt language-model baseline using the same input records.
3. MedDelta with structured temporal events and explicit unknown states.

Report field extraction accuracy, conflict precision/recall, event classification, evidence attribution correctness, unsupported-resolution rate, and coverage. A system that marks everything unknown must not appear successful merely because it makes no unsupported resolutions. Compare methods at comparable coverage where possible.

Use ablations to assess the contribution of temporal reasoning and source verification. Predefine labels and metrics with the reviewer. Record model versions and seeds where applicable. Keep held-out results separate from development results.

## Demonstration

Use clearly marked fictional records. Upload an old prescription, a discharge note, and a follow-up record. Show one documented change, one unresolved discrepancy, and one omission that correctly stays uncertain. Let the reviewer click each finding to see exact source evidence and record a resolution.

Do not claim that the system prevented harm, improved patient outcomes, or achieved clinical accuracy based on this demonstration.

## Free implementation path

- Python for extraction, event validation, and reconciliation.
- SQLite for local records, evidence, and review history.
- A local interface after the reconciliation core works.
- Open-source OCR for printed documents as a later milestone.
- An optional locally runnable open-weight language model, selected after checking laptop memory, license, and performance. No paid API is required by the architecture.

Begin with structured sample inputs so the temporal logic can be developed without model hosting or OCR dependencies. This is a baseline, not the complete AI contribution.

## Suggested semester sequence

1. Define the event schema and pharmacist annotation rubric; examine closest prior work.
2. Build and test the structured reconciliation baseline and evidence trace.
3. Add extraction from typed documents with human correction.
4. Run the frozen comparison and ablation experiments.
5. Add the demonstration interface and exportable review report.
6. Write the project report around measured findings and limitations.

Timeline depends on team size, available hours, hardware, and reviewer availability. Hackathon eligibility depends on each event's rules about prior work.

## Implemented milestone: v0.2

The browser app now includes a small learned action classifier, expanded field rules, explicit per-line confirmation, reviewer corrections, evidence history, and a reproducible synthetic development evaluation. The original strict parser remains the baseline. See `docs/MODEL_CARD.md` for data, limitations, and evaluation scope. Pharmacist-reviewed evaluation, OCR, broader language coverage, and brand resolution remain future milestones.

## Implemented milestone: v0.3

Typed PDFs can now be imported locally with page previews and explicit line selection. Source filenames, hashes, pages, and extracted-line references accompany unchanged imported text. Mixed text/image-only documents retain unread-page warnings, and unsupported imports do not overwrite existing drafts. This is text-layer extraction, not OCR or clinical validation.


## Implemented milestone: v0.4

Printed English images (PNG/JPEG/WebP) and scanned PDF pages can now be read locally using pinned Tesseract.js LSTM assets. Reviewers correct line-level transcripts beside the original, then explicitly confirm the structured fields. Strict-looking OCR text is gated too. Exports retain raw OCR text, corrections, valid source rectangles, file hashes, and review history. Cancellation, timeout, unread content, and failed imports preserve uncertainty and existing drafts. See `docs/OCR_IMPORT.md`.

OCR is an enabling input feature, not a claim of research novelty. The research contribution still needs evidence from a frozen, pharmacist-reviewed evaluation of temporal reconciliation, source attribution, uncertainty, and unsupported conclusions. Handwriting and independent clinical validation remain outside this release.


## Implemented milestone: v0.5

A frozen, developer-authored temporal challenge now contains 8 practice and 24 evaluation packets, with proposed labels, rationales, citations, and file hashes. Full history and a latest-two-record baseline are scored with identical parsing/abstention rules. Full history matches 20/24 proposed evaluation labels at 16/24 coverage; the baseline matches 18/24 at the same coverage. Equivalent units and expanded wording expose retained failures. This is constructed text evaluation, not independent clinical validation.

The browser Validation lab collects reviewer judgments before prediction reveal, validates review-file imports, preserves citations and revisions, and records exposure. A printable source-only guide/packet and blank CSV support review outside the private hosted site. Pharmacist review and independent adjudication are still pending. See `docs/VALIDATION_PROTOCOL.md`.
