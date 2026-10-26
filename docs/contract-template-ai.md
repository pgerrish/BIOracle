# AI placement in uploaded contract PDFs

The business-model page accepts PDF contracts with AcroForm fields, flat text, or scanned pages. The user must sign in and explicitly consent before analysis. The browser sends the PDF and non-empty contract answers to the authenticated Supabase Edge Function `map-contract-fields`. The function temporarily uploads the PDF to OpenAI, requests page locations for exact supplied answers, sets response storage off, and requests deletion of the temporary OpenAI file after processing. The PDF is not stored in Bioracle storage or in user drafts.

The browser overlays selected answers on the original PDF, provides a preview, and downloads a copy only after the user reviews the placements. Matching and placement can be wrong; signature areas are left blank and legal review is still required. Current limits are 5 MB and 20 pages per PDF. Very long answers may not fit the selected area.

## Production setup

1. Deploy `supabase/functions/map-contract-fields/index.ts` as the `map-contract-fields` Edge Function with JWT verification enabled.
2. In Supabase Dashboard → Edge Functions → Secrets, set `OPENAI_API_KEY` to an OpenAI project key. Optionally set `OPENAI_MODEL`; the default is `gpt-4.1-mini`.
3. Set an OpenAI project spending limit. Each input PDF is limited to 5 MB and 20 pages, the response is capped at 6,000 tokens, and uploaded OpenAI files are deleted after analysis is requested.
4. Rebuild and publish the static site so the upload controls are available.

Never place the OpenAI key in `content/accounts.json`, browser JavaScript, or any `dist/` file. Review OpenAI's data handling terms before sharing confidential contract content. PDF visual placement depends on model accuracy and must be checked by the user.
