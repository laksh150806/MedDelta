# MedDelta action classifier v1

## Intended use

Suggest one action label (start, continue, change, stop, or listed) while a person reviews a medication instruction. This component is a small NLP baseline, not a general medical language model or a treatment recommender.

The browser runs multinomial logistic regression over unigram/bigram counts. Python training exports weights directly to `dist/action-model.js`; `dist/classifier.js` implements identical inference without a model server. The classifier sees only the action cue before the medicine name. Medicine names, amounts, and schedules are intentionally excluded to avoid those fields becoming action-classification shortcuts.

## Data and training

- 35 synthetic action cues, seven per class, authored for this project.
- No patient records or proprietary datasets.
- No pharmacist review of the training or evaluation data to date.
- Explicit training and evaluation template families in `data/action-templates.json`.
- The optional training environment is pinned in `requirements-training.txt`.
- Regenerate with `python scripts/train_action_model.py`.
- Export parity tests compare JavaScript scores with Python reference scores.

## Evaluation and its limits

`npm run evaluate` produces `docs/evaluation.json`. It covers 10 action cue families absent from classifier training, expanded into 30 fictional instructions, plus 16 unsupported instructions.

The current synthetic development results are 30/30 complete suggestions matching the fixture fields, 10/10 action cues classified as expected, and 16/16 unsupported lines rejected. The strict baseline covers none of the 30 expanded-language examples. **These examples deliberately exercise the new supported constructions. The parser was designed with those constructions in mind. This is not a blinded, independent, or clinically representative benchmark, and the result is not a claim of clinical accuracy.** The expanded extractor combines learned action classification with hand-written field rules; the improvement cannot be attributed solely to the model.

The model's scores are not calibrated probabilities of correctness. They are not displayed as medical confidence. A score below 0.6, or an action inconsistent with the parsed fields, leaves the action unselected for the reviewer. That threshold is a prototype heuristic and has no clinical validation.

## Review boundary

Expanded suggestions never enter the medication timeline automatically. The user checks each row, may correct fields, supplies reviewer initials/name, and confirms. Confirmations retain the original source, initial suggested fields, confirmed fields, reviewer, and timestamp. Source text, title, or date changes invalidate the current confirmation. Prior confirmations remain in exported review history when records are edited.

Conditional instructions, dates, durations, tapers, multi-medicine lines, ambiguous abbreviations, and tablet/capsule counts remain outside the representation. The tool does not silently remove these qualifiers to make a line parseable. Some other unsupported constructions can still be misinterpreted; human confirmation does not establish clinical validity.

## Known limitations

- Very small synthetic training set and narrow English grammar.
- No generalization evidence for real prescriptions, languages, or specialties.
- No OCR, handwritten input, ingredient/brand alias mapping, or medication database.
- No patient-level contextual reasoning, drug-interaction checks, or treatment selection.
- Written amount is not distinguished automatically from product strength or administered dose.
- A user may confirm an incorrect interpretation; confirmation is an audit event, not a safety guarantee.
- User-entered reviewer names are not authenticated signatures.

## Next research work

Create a pharmacist-reviewed annotation rubric and a separately held-out, diverse case set before changing models against that set. Compare strict rules, expanded rules without learned action classification, the hybrid extractor, and an appropriate language-model baseline. Report errors, abstention coverage, and unsupported resolutions, rather than only aggregate accuracy.
