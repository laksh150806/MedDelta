# Printed English OCR in v0.4

MedDelta can read PNG, JPEG, and WebP images and raster pages in PDFs locally. OCR produces a draft transcription; it does not determine which medicine or dose is appropriate. Handwriting and languages other than English are outside this release's scope.

## Try the complete workflow

1. Choose **Add record → Try a printed scan**, or import a fictional/de-identified photo or PDF.
2. Choose **Read this page with OCR**. For a PDF, choose each page separately. Typed PDFs still use their text layer by default; OCR can also be run on a page with a partial text layer.
3. Compare the original preview with the editable lines. Use **Enlarge preview** to inspect small print and scroll within the image. Correct names, decimals, units, and action words. Select medication instructions; headers, dates, and footers should generally stay unchecked. No lines are selected automatically.
4. Acknowledge the visual check and use the selected lines. Enter the document date and save.
5. The field review opens automatically. Check each suggested field, enter your name/initials, and confirm the instructions. Every instruction in a record that used OCR requires this review, including text that matches the strict grammar.
6. Inspect the comparison and export the report. The original image/PDF can be opened from the record card or field-review screen while the tab is open.

This is a two-stage review: correcting a transcription is separate from confirming its structured meaning. Changing a field clears that row's confirmation checkbox. Editing a record's text, title, or date invalidates its prior field review.

If OCR misses a whole instruction, manually transcribe it in the record editor after importing, or use a clearer source image. Editing the combined record text removes exact page/line links; the original import and corrections remain in the report. OCR cannot establish that all content was read, so an OCR completeness warning remains even after the selected fields are confirmed.

## Evidence and corrections

The JSON export records:

- File name, size, SHA-256 digest, page count, and import time. A hash identifies bytes; it does not establish authenticity.
- The OCR engine/model versions and the time OCR was run on each page.
- Each selected line's raw OCR text, corrected transcription, source page/line, and source rectangle when valid. Rectangle coordinates refer to the rendered OCR image and its recorded pixel dimensions, not PDF coordinate units.
- The engine's uncalibrated recognition score and a closer-inspection flag for scores below 85 or missing scores. This threshold is a UI heuristic, not a validated confidence threshold. A high score never approves an instruction.
- The later field suggestions, reviewer corrections, confirmations, reviewer name, and timestamp. These are self-entered review records, not authenticated clinician signatures.

Only selected lines are exported as line-level OCR evidence. Original binary files and full-page OCR results are not included. Original files remain in memory until the record is removed, the sample is switched, or the tab is closed/reloaded. The report does not restore the original file.

## Local processing and dependencies

Tesseract.js 6.0.1, tesseract.js-core 6.1.2, and English `4.0.0_best_int` weights from `@tesseract.js-data/eng@1.0.0` are vendored under `dist/vendor/tesseract`. Both SIMD and non-SIMD LSTM cores are included. Versions, npm integrity metadata, SHA-256 file hashes, and upstream licenses are included in `VENDOR.json` and adjacent files.

The tools and model load from the application's origin only when OCR is requested. No external OCR service, runtime CDN, API key, or package installation is needed. OCR runs in a short-lived worker, supervised by another worker so cancellation/timeout can terminate initialization as well as recognition. Workers are stopped after each page. Engine language-data IndexedDB caching is disabled; ordinary HTTP caching of static application assets may still occur. Document content is held in memory.

The first OCR run downloads roughly 7 MB of application assets (before any HTTP transfer compression) and can take longer on a phone. The site still makes ordinary page/asset requests; Google Fonts is optional presentation traffic unrelated to record content. Browser tests run recognition with external requests blocked.

## Bounds and failure behavior

- PNG, JPEG, WebP, PDF: at most 10 MB per file. PDF: at most 10 pages.
- Images: at most 24 megapixels; no side longer than 12,000 pixels.
- OCR image canvas: fits within 2,400 × 3,200 pixels. PDF pages render at up to 3× their PDF dimensions; photos are downscaled when necessary, without changing their aspect ratio.
- OCR: at most 500 lines / 100,000 text characters per page. Selected text: 15,000 characters per record; one nonempty instruction of up to 1,500 characters per selected line.
- Each OCR run has a two-minute timeout and can be cancelled. It does not replace existing extracted lines until recognition succeeds.
- Blank images, corrupt/unsupported files, failed engine loading, and timeouts show errors. A failed or cancelled import does not overwrite the editor draft.
- Unread pages, uncertain layout, and OCR completeness warnings remain visible. OCR may omit text, merge columns, misread digits, or turn handwriting into plausible nonsense. Use clear, upright printed English and visually check the whole page.
- Password-protected PDFs are not accepted; the app does not collect passwords. HEIC, automatic perspective correction, automatic rotation, handwriting recognition, and multilingual OCR are not implemented.

OCR is an input capability. It does not broaden the medication parser's supported grammar, add brand matching, or provide clinical validation. Unsupported instructions remain unresolved.

## Reproduce verification

```sh
npm test
npm run evaluate:check
```

For real browser integration, start `npm start` in another terminal, then install Python Playwright and its Chromium browser if necessary:

```sh
python -m pip install playwright
python -m playwright install chromium
python scripts/smoke_ocr.py
python scripts/smoke_pdf.py
```

The OCR suite uses the actual vendored engine and fictional images. It checks PNG/JPEG/WebP and scanned PDFs, raw/corrected evidence, mandatory field confirmation, exports, same-origin-only requests, corrupt/blank images, cancellation during worker startup, unavailable language data, timeout, retry, and mobile width. The PDF suite retains the text-layer regression coverage.

Fixtures can be regenerated with `python scripts/generate_ocr_fixtures.py` after installing Pillow and ReportLab. These are controlled software integration checks, not independent OCR accuracy measurements or clinical validation. A separately frozen and pharmacist-reviewed evaluation set remains a research milestone.
