# MedDelta

A working medication-record comparison prototype. Open dated source records, inspect evidence-backed differences, add reviewer notes, and export a JSON report. All record processing happens in the browser; records and notes are held in memory and reset on reload.

![MedDelta medication review workspace with fictional sample records](docs/preview.png)

**Status:** Working v0.1 prototype with 16 automated behavioral tests. Model-based extraction and pharmacist-reviewed evaluation are planned, not completed.

**Hosted demo:** https://meddelta-review.lakshnagori1508.chatgpt.site (private to the project owner). Everyone with this repository can run the same application locally.

## Run locally

Install Node.js 22 or later, then run:

```sh
git clone https://github.com/laksh150806/BookMyStayApp.git MedDelta
cd MedDelta
npm start
```

Open http://localhost:3000. No package installation, API key, database, or paid service is needed. The hosted copy uses private Sites access. Google Fonts is an optional presentation dependency; system fonts are the fallback.

## Test

```sh
npm test
```

## What works

- Three fictional sample cases and editable dated records.
- Import of plain-text files (up to 60 KB / 15,000 characters).
- A conservative parser for supported English medication instruction lines.
- Chronological comparison with exact source text and line numbers.
- Explicit changes, unexplained conflicts, omissions, matching instructions, and explicit stops.
- Per-medicine review notes and a complete JSON export.
- Unsupported lines remain visible and make the comparison provisional.

## Important scope

This is a deterministic baseline, **not a trained AI system or clinically validated product**. It does not diagnose, choose treatment, check interactions, establish a current medication list, or tell someone what medication to take. Fictional examples are not prescribing guidance.

The parser supports one instruction per line, for example:

```text
Continue Metformin 500 mg orally once daily.
Change Metformin 500 mg orally twice daily.
Stop Cetirizine.
```

Matching uses the exact normalized medicine name, not brand-to-ingredient resolution. Written amounts are not automatically classified as strength or administered dose. Qualifiers outside the supported grammar are rejected rather than discarded. Missing route information remains unspecified. Document dates order evidence; clinical effective dates are not inferred. A later instruction does not automatically resolve an earlier conflict. Reviewer notes do not modify the original findings or certify safety.

Use only fictional or appropriately de-identified records. Exported files contain source text and notes. There is no server-side patient database or analytics. The site host still receives ordinary page requests.

## Architecture

- `dist/engine.js`: pure parsing and temporal-comparison functions, sample cases.
- `dist/app.js`: browser workflow, evidence panels, editing, notes, exports.
- `dist/index.html`, `dist/styles.css`: responsive interface.
- `tests/engine.test.js`: core behavioral checks.
- `server.js`: dependency-free development server.

## Next research milestone

Use the project brief to establish a pharmacist-reviewed annotation rubric and separate development/evaluation cases. Add an extraction model with human correction, compare it with a single-prompt baseline, and measure unsupported conclusions as well as coverage. OCR and broader medication matching are future work, not features in this release.

See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for scope, evaluation design, prior work, and the semester plan.

