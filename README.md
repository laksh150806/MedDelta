# MedDelta

A working medication-record comparison prototype. Open dated source records, inspect evidence-backed differences, add reviewer notes, and export a JSON report. All record processing happens in the browser; records and notes are held in memory and reset on reload.

![MedDelta medication review workspace with fictional sample records](docs/preview.png)

**Status:** Working v0.4 prototype with 51 automated behavioral tests, local printed-English OCR, PDF/photo import, a local action classifier, and source-linked extraction review. Pharmacist-reviewed validation is still pending.

**Hosted demo:** https://meddelta-review.lakshnagori1508.chatgpt.site (private to the project owner). Everyone with this repository can run the same application locally.

## Run locally

Install Node.js 22 or later, then run:

```sh
git clone https://github.com/laksh150806/MedDelta.git
cd MedDelta
npm start
```

Open http://localhost:3000. No package installation, API key, database, or paid service is needed. The hosted copy uses private Sites access. Google Fonts is an optional presentation dependency; system fonts are the fallback.

## Test

```sh
npm test
```

## What works

- Four fictional sample cases and editable dated records.
- Plain-text, PDF, PNG, JPEG, and WebP import (documents/images up to 10 MB; PDFs up to 10 pages).
- Local printed-English OCR with editable transcriptions and mandatory field confirmation.
- Raw OCR text, user corrections, original image coordinates, and source file hashes retained in exports.
- PDF page preview, explicit line selection, and original-file page references.
- A built-in fictional printed scan and a two-page typed PDF to try without supplying a document.
- A strict parser plus expanded extraction using a local action classifier and field rules.
- A review screen to correct and explicitly confirm expanded extracted fields.
- Source-linked extraction history, reviewer identity, and timestamps.
- Chronological comparison with exact source text and line numbers.
- Explicit changes, unexplained conflicts, omissions, matching instructions, and explicit stops.
- Per-medicine review notes and a complete JSON export.
- Unsupported lines remain visible and make the comparison provisional.

## Important scope

This combines a deterministic comparison engine with a small action classifier trained on synthetic phrases. **It is not a clinically validated product or a general medical AI.** It does not diagnose, choose treatment, check interactions, establish a current medication list, or tell someone what medication to take. Fictional examples are not prescribing guidance.

The parser supports one instruction per line, for example:

```text
Continue Metformin 500 mg orally once daily.
Change Metformin 500 mg orally twice daily.
Stop Cetirizine.
```

Matching uses the exact normalized medicine name, not brand-to-ingredient resolution. Written amounts are not automatically classified as strength or administered dose. Expanded wording such as `Please increase Metformin to 500 mg by mouth twice a day.` can be reviewed using **Source records → Review extraction**. Expanded suggestions and all instructions in OCR-derived records do not enter the comparison until the reviewer confirms them. OCR can omit or misread content; a completeness warning remains after field confirmation. Qualifiers outside the supported grammar are rejected rather than discarded. Missing route information remains unspecified. Document dates order evidence; clinical effective dates are not inferred. A later instruction does not automatically resolve an earlier conflict. Reviewer notes do not modify the original findings or certify safety.

Use only fictional or appropriately de-identified records. Exported files contain source text and notes. There is no server-side patient database or analytics. The site host still receives ordinary page requests.

## Architecture

- `dist/engine.js`: pure parsing and temporal-comparison functions, sample cases.
- `dist/app.js`: browser workflow, extraction review, evidence panels, editing, notes, exports.
- `dist/extraction.js`, `dist/review.js`: suggestions, field validation, and review provenance.
- `dist/classifier.js`, `dist/action-model.js`: local model inference and exported weights.
- `scripts/train_action_model.py`: optional model training.
- `scripts/evaluate.mjs`: reproducible synthetic development evaluation.
- `dist/pdf-import.js`, `dist/pdf-layout.js`: local PDF reading and conservative layout reconstruction.
- `dist/ocr.js`, `dist/ocr-worker.js`: bounded local image decoding and cancellable printed-English OCR.
- `dist/provenance.js`: original-file page references, OCR correction evidence, and review gating.
- `dist/vendor/pdfjs`, `dist/vendor/tesseract`: pinned PDF/OCR assets, English weights, integrity metadata, and upstream licenses.
- `scripts/smoke_pdf.py`, `scripts/smoke_ocr.py`: real browser integration checks using fictional fixtures.
- `dist/index.html`, `dist/styles.css`: responsive interface.
- `tests/engine.test.js`: core behavioral checks.
- `server.js`: dependency-free development server.

## Next research milestone

Use the project brief to establish a pharmacist-reviewed annotation rubric and separate development/evaluation cases. Compare the extraction pipeline with expanded-rule and language-model baselines, and measure unsupported conclusions as well as coverage. Handwriting, multilingual extraction, and broader medication matching remain future work.

See [PROJECT_BRIEF.md](PROJECT_BRIEF.md) for scope, evaluation design, prior work, and the semester plan.


## Model and evaluation

The included model runs locally with no paid service. To reproduce the development evaluation:

```sh
npm run evaluate
npm run evaluate:check
```

Optional retraining (Python 3.11+):

```sh
python -m pip install -r requirements-training.txt
python scripts/train_action_model.py
npm test
npm run evaluate
```

Read [the model card](docs/MODEL_CARD.md) before interpreting the results. The small synthetic benchmark exercises supported constructions; its scores do not establish real-world or clinical performance.

## Try PDF import

Choose **Add record → Try a sample PDF**, select the medication lines on each page, and acknowledge the visual check. Enter the document date, save, then review the extracted fields. PDFs stay in the browser tab.

Read [PDF import behavior and limits](docs/PDF_IMPORT.md). Original PDF bytes are not part of exported JSON reports.

## Try photo and scanned-PDF import

Choose **Add record → Try a printed scan → Read this page with OCR**. Correct the text beside the image, select the medication instructions, and acknowledge the visual check. Save with a document date, then confirm the structured fields in the review screen that opens.

PNG, JPEG, WebP, and scanned PDF pages work with the same local OCR engine. Printed English only; handwriting is not supported. See [the OCR workflow, evidence, limits, and tests](docs/OCR_IMPORT.md).
