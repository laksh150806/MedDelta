# PDF import in v0.3

## Try it

Open **Add record → Try a sample PDF**. The sample contains two pages of fictional instructions. Select the medication lines beside the original page preview, acknowledge the visual check, and choose **Use selected lines**. Enter the document date and save. Use **Source records → Review extraction** to confirm the model's field suggestions.

An original file is optional: choose **Import TXT or PDF** for your own typed, appropriately de-identified file. No file contents are uploaded. PDF.js, its worker, fonts, and related assets are served with the application, without a runtime CDN dependency.

## What is preserved

- Original PDF bytes are held in the browser tab and can be opened from the record card.
- Exported reports include the filename, file size, SHA-256 digest, import timestamp, page count, selected source lines, and page/line references.
- The digest identifies the selected file; it does not verify its authenticity or clinical correctness.
- PDF bytes are not included in JSON exports and are lost when the page is reloaded.
- Only selected lines enter the record. A missing medicine is described as absent from the imported selection, not absent from the entire PDF.
- Editing imported text removes exact PDF page links, because the edited text no longer matches the stored import. Original import metadata remains in the report.

## Limits and explicit failure behavior

- Maximum file size: 10 MB. Maximum pages: 10. Selected text limit: 15,000 characters.
- This extracts an existing text layer. It does not perform OCR or read handwriting.
- A PDF with no extractable text is rejected with an explanation.
- Mixed documents retain warnings for pages without text; comparisons remain provisional.
- A page with some text can still contain an image-only medication section. Visual checking remains necessary; the presence of text does not prove complete extraction.
- Large horizontal gaps split text into separate lines and produce a layout warning. Complex columns, tables, ligatures, hyphenation, and reading order can still be wrong.
- Rotated/vertical text is unsupported and rejects the import rather than silently dropping those items.
- Password-protected, damaged, oversized, and over-limit documents produce errors without overwriting existing editor text.
- Selecting and visually checking text is separate from confirming extracted medication fields. Neither acknowledgement establishes clinical validity.

## Library and licenses

PDF.js is vendored from `pdfjs-dist@6.4.299` under Apache-2.0. Upstream font, CMap, and WASM licenses are retained in `dist/vendor/pdfjs/`. `VENDOR.json` records the package source, version, and SHA-256 file hashes. Local inference and PDF processing require no paid API.

## Reproduce checks

Core logic is covered by `npm test`. For the browser integration suite, run `npm start` in one terminal, then:

```sh
python -m pip install playwright
python -m playwright install chromium
python scripts/smoke_pdf.py
```

The suite uses fictional fixture PDFs, checks repeated failures followed by successful import, and verifies that importing does not issue upload requests. To regenerate fixtures optionally install ReportLab and Pillow and run `python scripts/generate_pdf_fixtures.py`.
