# AI extraction from supporting documents and placement in contract PDFs

## Extract source information into the online form

The Contract page accepts up to five previous contracts or supporting documents (PDF, DOC, DOCX, RTF, TXT, CSV, and XLSX), with a combined limit of 5 MB. The user must sign in and explicitly consent before analysis. The browser sends the files and the contract form's field labels and types to the authenticated Supabase Edge Function `extract-contract-answers`. Existing webpage answers are not sent to this extraction function.

The function temporarily uploads each source file to OpenAI and requests structured field suggestions with `store:false`; it requests deletion of each temporary OpenAI file after processing. AI suggestions include a short source excerpt and confidence. The user can edit each suggestion and must select which values to apply. Existing values and conflicting suggestions start unchecked. Applying a selection updates the online form and its existing account-scoped autosave; the uploaded files and unselected AI suggestions are not saved in the user's draft. AI extraction can miss or misread details, so users should verify every value. Do not upload confidential material unless authorized to share it.

Deploy `supabase/functions/extract-contract-answers/index.ts` as `extract-contract-answers` with JWT verification enabled. Configure `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in Supabase Edge Function secrets, using an OpenAI project spending limit. Never place the key in browser JavaScript, account data, or `dist/` files.

Supported formats depend on OpenAI's file input support. PDF inputs include page visuals; other supported document formats are provided for text extraction. See OpenAI's [file inputs guide](https://developers.openai.com/api/docs/guides/file-inputs) and [structured outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs).

## Fill a user-provided institutional PDF

The Contract page accepts PDF contracts with AcroForm fields, flat text, or scanned pages. The user must sign in and explicitly consent before analysis. The browser sends the PDF and non-empty contract answers to the authenticated Supabase Edge Function `map-contract-fields`. The function temporarily uploads the PDF to OpenAI, requests page locations for exact supplied answers, sets response storage off, and requests deletion of the temporary OpenAI file after processing. The PDF is not stored in Bioracle storage or in user drafts.

The browser overlays selected answers on the original PDF, provides a preview, and downloads a copy only after the user reviews the placements. Matching and placement can be wrong; signature areas are left blank and legal review is still required. Current limits are 5 MB and 20 pages per PDF. Very long answers may not fit the selected area.

## Production setup

1. Deploy `supabase/functions/map-contract-fields/index.ts` as the `map-contract-fields` Edge Function with JWT verification enabled.
2. In Supabase Dashboard → Edge Functions → Secrets, set `OPENAI_API_KEY` to an OpenAI project key. Optionally set `OPENAI_MODEL`; the default is `gpt-4.1-mini`.
3. Set an OpenAI project spending limit. Each input PDF is limited to 5 MB and 20 pages, the response is capped at 6,000 tokens, and uploaded OpenAI files are deleted after analysis is requested.
4. Rebuild and publish the static site so the upload controls are available.

Never place the OpenAI key in `content/accounts.json`, browser JavaScript, or any `dist/` file. Review OpenAI's data handling terms before sharing confidential contract content. PDF visual placement depends on model accuracy and must be checked by the user.
