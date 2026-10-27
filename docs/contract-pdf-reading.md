# Browser based PDF reading on the Contract page

The Contract page reads supporting documents and suggests values locally in the visitor's browser. It does not send files or form answers to BIOracle, Supabase, or an AI provider. Login is only needed to save the form draft to an account.

PDF text is read with Mozilla PDF.js. Pages without extractable text use Tesseract.js OCR in a browser worker. DOCX and XLSX files are read with Mammoth and SheetJS. These open source browser libraries and English OCR data load from public CDNs when needed, so an internet connection is required to load the reader assets. Processing then runs on the visitor's device. There is no API key, server compute, or per-document AI fee.

The current local field matcher uses known labels and aliases from the contract schema. It can miss values, mistake a label for a value, or fail on unfamiliar wording and layout. It accepts up to five PDF, DOCX, XLSX, TXT, CSV, or RTF source files, with a combined 5 MB limit and a 20 page limit per PDF. Legacy DOC files must be converted first. Scanned PDFs are OCRed locally. Suggestions show their source line and remain editable; existing answers and conflicting source values are not automatically selected.

For institutional PDFs, the browser finds labels that resemble known contract fields and proposes an answer area beside the label. This is a geometric heuristic, not an AI layout model. It works best on text based forms with clear labels and blank space to the right. OCR may help read scans, but placement on scanned or unusual forms can be inaccurate. Users should inspect every selected field and the complete generated preview before downloading. Signature lines are not detected or filled intentionally.

PDF.js, Tesseract.js, Mammoth, and SheetJS are open source browser libraries. Tesseract uses English trained data fetched from tessdata. Their CDNs and their own privacy and availability policies apply to loading the library assets; uploaded document bytes and completed extraction remain in the browser. The user can also disable network access after the page and needed reader files have loaded, although reloading may require those assets again.
