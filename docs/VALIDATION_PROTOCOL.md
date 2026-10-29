# MedDelta temporal evaluation protocol v1

## What this milestone establishes

v0.5 adds a reproducible text-reconciliation benchmark and a browser-local review kit. **No pharmacist has reviewed this dataset yet.** The source packets and proposed reference labels were authored by the developer after inspecting v0.4. They were frozen before the first benchmark run. They are not independent clinical ground truth or a previously unseen external test set.

The comparison algorithm is unchanged in v0.5 (only its version constant changes). Known failures are retained in the report. OCR, PDF reading, and human-confirmed extraction are excluded from this benchmark; they have separate software integration checks.

## Data and partitions

`dist/validation/cases.json` contains 32 fictional source packets, each with one target medicine. The medicine names do not identify actual products. Each packet has at least two records; dates deliberately include missing/invalid examples. No patient data is used.

- **Development/practice: 8 packets.** Agreement, explicit changes, stops, and omissions.
- **Evaluation: 24 packets.** Earlier unresolved discrepancies, equal-date records, restarts, incomplete instructions, ordering/date problems, amounts/routes, record scope, and expanded wording.

Assigned family identifiers do not cross partitions, and exact duplicate source packets are rejected. The partitions share vocabulary and grammar, and some concepts are related. Family separation is an organization choice, not proof of absence of conceptual leakage or real-world generalization.

`reference-labels.json` contains proposed developer labels, rationales, and evidence citations. `manifest.json` records the design-time engine commit, freeze date, and SHA-256 hashes of cases and labels. The benchmark verifies these hashes before running. Future changes require a new dataset version and an explanation; do not silently relabel errors to improve the score. File hashes detect changes but do not certify authenticity.

## Task and labels

Classify what the supplied documents support about the target medicine. Do not decide what someone should take, whether a dose is suitable, or when treatment actually began. A later document alone does not erase an earlier unexplained discrepancy.

| Label | Meaning |
| --- | --- |
| `consistent` | The written amount, unit meaning, route, and frequency agree wherever mentioned. Equivalent SI amounts and equivalent daily wording can agree even if their strings differ. |
| `change` | An explicit documented change/restart explains the relevant transition, without an earlier unresolved discrepancy. |
| `conflict` | Instructions disagree without an adequate explicit explanation, or contradictory same-date records have unknown order. |
| `missing` | The target is absent from a latest supplied record and no applicable explicit stop establishes the latest target-specific instruction. Omission never proves discontinuation. |
| `stopped` | The latest available target-specific instruction explicitly stops it, with no later restart or unresolved discrepancy. This is a statement about documentary evidence. |
| `new` | The target is first documented in the supplied records. Its actual treatment start date is unknown. |
| `unresolved` | Dates, missing fields, conditional/multi-stage instructions, or ambiguous evidence prevent a supported classification. A clearly worded instruction is not inherently unresolved merely because the parser cannot read it. |

Use document dates to order evidence. Evidence line **0** means the document date; other line numbers are one-based source-text lines. The reference labels cite source passages, but a pharmacist can disagree with both the reference and the system.

## Methods

1. **Full history:** the current strict parser and temporal comparison over every supplied record.
2. **Latest pair:** the same parser and comparison rules over the two most recent dated records. Date ties are ordered by record ID for selecting the window. If any date is invalid, neither method discards it to continue; both abstain.

For both methods, any source issue, blocked comparison, or absent target result becomes the benchmark label `unresolved` (abstention). Raw status and issues are retained in each result. This conservative adapter is explicitly stricter than treating a provisional UI status as a final conclusion. It is applied equally to both methods.

The baseline isolates the value of retaining history. It is not an independent state-of-the-art model or an LLM baseline. Expanded suggestions are not automatically treated as reviewed, and no human confirmations are fabricated.

## Metrics

- **Exact label agreement:** matches / all packets, including agreements on `unresolved`.
- **Coverage:** non-abstaining outputs / all packets. An always-abstaining system has zero coverage.
- **Agreement among covered:** correct non-abstaining outputs / non-abstaining outputs; null if none.
- **Wrong non-abstaining outputs:** incorrect outputs that were not abstentions.
- **Conflict precision/recall:** binary confusion counts for `conflict`; abstaining on a reference conflict is a false negative. Undefined denominators produce null, not perfect scores.
- **Unsupported-resolution proxy:** the number of `consistent`, `change`, `stopped`, or `new` outputs when the reference is `conflict`, `missing`, or `unresolved`, divided by the count of these uncertain reference labels. This operational proxy is not a patient-harm or clinical-safety metric.
- **Source-text alignment:** emitted source passages whose document ID, line, and text match the supplied records / emitted passages. It does not establish that the evidence logically supports the finding.
- **Confusion matrix and case-level results:** reported for every method, separately by partition.

## Initial recorded results

| Evaluation partition (24 packets) | Full history | Latest pair |
| --- | ---: | ---: |
| Exact proposed-reference agreement | 20/24 | 18/24 |
| Non-abstaining outputs | 16/24 | 16/24 |
| Correct among non-abstaining outputs | 15/16 | 13/16 |
| Wrong non-abstaining outputs | 1 | 3 |
| Unsupported-resolution proxy count | 0 | 2 |

Both methods match all 8 practice labels. The evaluation errors are deliberately visible:

- **E16:** both flag a discrepancy for equivalent gram/milligram amounts. The reference is `consistent`; the current engine does not convert units.
- **E22–E24:** both abstain on meaningfully clear expanded wording/negation. Coverage is lost; a reviewer can handle these through the application, but this automated benchmark does not simulate that reviewer.
- **E01–E02:** the latest-pair baseline loses earlier unexplained discrepancies; full history retains them.

The eight abstentions comprise five reference cases that require insufficient-evidence labels and three missed clear instructions. These counts explain why exact agreement and coverage must be reported together. The small, constructed sample does not support clinical accuracy, novelty, or statistically significant superiority claims.

## Pharmacist review workflow

1. Open the Validation lab and its review guide. Review the 8 practice packets to clarify the rubric. Record suggested rubric changes before evaluation; material changes require a new protocol/dataset version.
2. Review the 24 evaluation packets from source evidence, without inspecting predictions, proposed labels, benchmark reports, or prior reviewer answers. Choose a label, cite passages/dates, and explain uncertainty.
3. Export the review JSON before leaving. The lab supports reopening only its own versioned review format and validates identity, citations, labels, and histories before replacement. Ordinary medication-workspace exports are a different format.
4. After completing the evaluation labels, reveal the predictions. The application records exposure times. Later saved revisions retain earlier snapshots and are marked as made after exposure.
5. Discuss disagreements and record adjudication separately. Do not silently replace independent labels with system suggestions. An independent second reviewer and inter-rater agreement would strengthen the study; this release does not automate adjudication.
6. Report who reviewed, the self-reported role, review conditions, completion counts, prior exposure, disagreements, and limitations. Reviewer names/roles are not authenticated. Exported JSON can be edited outside the app, so exposure history is a workflow aid, not tamper-proof evidence.

Predictions are hidden in the normal review screen, but the open-source code, labels, and downloadable reports are publicly inspectable. This is interface-level separation, not a secure blinded experiment. The browser's clock supplies timestamps. Reopened reviews retain prior exposure; starting a new review cannot prove the reviewer has never seen the cases.

## Reproduction

```sh
npm test
npm run evaluate:check
npm run benchmark
npm run benchmark:check
```

`dist/validation/benchmark-report.json` contains the complete method results, exact dataset hashes, and engine source hash. CI checks report freshness without requiring a perfect score. No paid service is used.

For browser workflow checks, run `npm start` in one terminal and `python scripts/smoke_validation.py` in another (Python Playwright and Chromium required). This exercises judgment saving, evidence requirements, hidden predictions, exposure/revision history, export/reopen, malformed-import rejection, mobile layout, and preservation of the main medication workspace in another tab.
