"""Business-model page and accessible contract form, driven by a shared schema."""
import json
from html import escape
from pathlib import Path

SCHEMA = json.loads((Path(__file__).resolve().parents[1] / 'content/contract-fields.json').read_text())


def render_business_model():
    content = '''<section class="page-intro wrap"><p class="eyebrow">BIOracle / Our business model</p>
      <h1>Fund the work.<br><em>Support the people.</em></h1>
      <div class="intro-bottom"><p class="lead">A proposed framework for moving grants and contracts into research promptly, with graduate-student support written into the budget from the beginning.</p><a class="text-link" href="#contract-builder">Construct a contract <span aria-hidden="true">↓</span></a></div></section>
      <section class="wrap section business-model-copy" aria-labelledby="funding-title">
        <p class="eyebrow">The operating model</p><h2 id="funding-title">Clear allocations.<br><em>Shorter paths to the work.</em></h2>
        <p class="body-copy">Our aim is to reduce administrative delay while sustaining rigorous research and meaningful opportunities for graduate students. The framework below is a proposal: allocation amounts, approval deadlines, and legal terms must be agreed for each project. It does not announce fixed institutional percentages.</p>
        <div class="two-columns business-principles">
          <article><h3>Budget student support first.</h3><p>Identify graduate-student roles, paid research time, supervision, and any tuition or benefits before committing the rest of the budget. Give this support its own allocation and payment plan, so students can see what is funded and for how long. Student payments must use the appropriate appointment, payroll, fellowship, or other permitted process.</p></article>
          <article><h3>Make every allocation visible.</h3><p>Divide the project budget into graduate-student support, investigator and research-team compensation, other direct project costs, and administration or indirect costs. The amounts must add up to the agreed total. These are spending allocations, not automatic cash distributions or promised returns. Each charge needs a documented project purpose.</p></article>
          <article><h3>Agree the route before work starts.</h3><p>Name a budget approver and an academic supervisor. Set the approval turnaround, the time to process an approved payment once funds and documentation are available, and the sponsor’s invoice deadline. Agree an advance or milestone schedule that can support those commitments. A clear route reduces repeated negotiations and gives delayed requests an accountable owner.</p></article>
          <article><h3>Track progress and adjust openly.</h3><p>Review spending, upcoming student commitments, and deliverables together. Document budget changes and obtain any required sponsor consent before reallocating funds. Neither a short approval target nor a late sponsor payment removes existing obligations to students or employees. If funding is delayed, communicate promptly and agree what work can continue.</p></article>
        </div>
        <div class="about-note"><h3>Grants and contracts have different constraints.</h3><p>A commercial contract sets an agreed price and scope. A sponsored research award may restrict eligible costs, indirect costs, student appointments, reporting, and transfers between budget categories. Award conditions and applicable law govern those decisions. For U.S. federal awards, see the official <a class="inline-link" href="https://www.govinfo.gov/content/pkg/CFR-2026-title2-vol01/xhtml/CFR-2026-title2-vol01-part200-subpartE.html" target="_blank" rel="noopener noreferrer">cost principles in 2 CFR Part 200, Subpart E</a>. Other funders and jurisdictions may use different rules.</p></div>
      </section>
      <section class="wrap section" id="contract-builder" aria-labelledby="contract-builder-title">
        <p class="eyebrow">Agreement builder</p><h2 id="contract-builder-title">Put the terms in writing.</h2>
        <p class="body-copy">Complete the fields below to download a formal, unsigned contract draft with the scope, funding allocations, student-support commitments, legal provisions, and signature blocks. Choose PDF, DOCX, Markdown, or RTF. This template needs legal review for the parties, jurisdiction, and any sponsor requirements; generating it does not execute an agreement.</p>
        <p class="form-note">Only the five fields marked <span class="required-mark" aria-hidden="true">*</span> are required. Unanswered optional fields receive standard “to be agreed” text in the PDF. Log in to save your responses automatically to your account and continue on your next visit.</p>
        <div class="contract-account-bar"><button type="button" class="button button-quiet" data-account-button>Log in</button><p id="draft-save-status" role="status" aria-live="polite">Log in to save your progress.</p><button id="draft-save-retry" class="text-button" type="button" hidden>Retry saving</button></div>
        <div id="draft-conflict" class="draft-conflict" hidden><p>A saved draft differs from the entries here. Choose which version to keep before saving continues.</p><div class="form-actions"><button id="draft-use-saved" class="button button-quiet" type="button">Use saved draft</button><button id="draft-use-local" class="text-button" type="button">Keep these entries</button></div></div>
        <noscript><p>Enable JavaScript to use the contract generator.</p></noscript>
        <form id="contract-form" class="contract-form">
    '''
    for group in SCHEMA:
        content += f'<fieldset><legend>{escape(group["title"])}</legend><p class="contract-group-note">{escape(group["description"])}</p><div class="form-two">'
        for field in group['fields']:
            key = field['name']
            hint = field.get('hint', '')
            optional = not field.get('required', True)
            label = escape(field['label']) + ('' if optional else ' <span class="required-mark" aria-hidden="true">*</span><span class="sr-only"> (required)</span>')
            extra_class = ' contract-wide' if field['type'] == 'textarea' else ''
            attrs = f'id="contract-{key}" name="{key}"'
            if not optional and not field.get('grantOnly'):
                attrs += ' required'
            if hint:
                attrs += f' aria-describedby="hint-{key}"'
            conditional = ' data-grant-only hidden' if field.get('grantOnly') else ''
            content += f'<div class="form-field{extra_class}"{conditional}><label for="contract-{key}">{label}</label>'
            if field['type'] == 'select':
                content += f'<select {attrs}><option value="">Choose…</option>'
                content += ''.join(f'<option value="{escape(value)}">{escape(text)}</option>' for value, text in field['options']) + '</select>'
            elif field['type'] == 'textarea':
                content += f'<textarea {attrs} rows="4" maxlength="{field.get("maxLength", 4000)}"></textarea>'
            else:
                field_type = field['type']
                if field_type == 'money':
                    attrs += ' inputmode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" maxlength="12"'
                    field_type = 'text'
                elif field_type == 'number':
                    attrs += f' min="{field.get("min", 0)}" max="{field.get("max", 365)}" step="1"'
                elif field_type not in ('date',):
                    attrs += f' maxlength="{field.get("maxLength", 200)}"'
                content += f'<input {attrs} type="{field_type}">'
            if hint:
                content += f'<small id="hint-{key}">{escape(hint)}</small>'
            content += '</div>'
        content += '</div></fieldset>'
    content += '''<div class="contract-budget-summary" aria-labelledby="allocation-title"><h3 id="allocation-title">Budget allocation</h3><dl id="contract-budget-lines"></dl><p id="contract-budget-status" role="status" aria-live="polite">Budget details are optional; missing terms will be marked as to be agreed.</p></div>
      <div id="contract-errors" class="contract-errors" role="alert" tabindex="-1" hidden></div>
      <div class="form-actions"><label for="contract-format">Draft format</label><select id="contract-format" name="contractFormat"><option value="pdf">PDF</option><option value="docx">DOCX</option><option value="md">Markdown (.md)</option><option value="rtf">RTF</option></select><button id="generate-contract" class="button" type="submit" disabled>generate contract <span aria-hidden="true">↓</span></button><a id="contract-download" class="text-link" hidden>Download contract draft again</a></div>
      <p id="contract-status" class="form-status" role="status" aria-live="polite"></p>
      </form>
      <section class="contract-template-panel" aria-labelledby="contract-template-title">
        <p class="eyebrow">Use your own document</p><h3 id="contract-template-title">Fill a PDF contract form</h3>
        <p class="body-copy">Upload a PDF contract, including a scanned or flat document. AI will inspect the pages and suggest where your webpage answers belong. Review the placements and preview the result before downloading. AI placement can be imperfect, so check the full document carefully.</p>
        <div class="form-field"><label for="contract-template-file">Your PDF contract (up to 5 MB and 20 pages)</label><input id="contract-template-file" type="file" accept="application/pdf,.pdf"></div>
        <label class="template-consent"><input id="contract-template-consent" type="checkbox"><span>I agree to send the entire PDF and my non-empty webpage form answers to BIOracle’s processing function and OpenAI for analysis. The function requests deletion of the temporary OpenAI file after processing. Do not continue with confidential information unless you are authorized to share it.</span></label>
        <div class="form-actions"><button id="contract-template-map" class="button button-quiet" type="button" disabled>Analyze PDF with AI</button><button id="contract-template-preview-button" class="button button-quiet" type="button" disabled>Preview selected entries</button><button id="contract-template-fill" class="button" type="button" disabled>Download filled PDF</button></div>
        <div id="contract-template-mappings" class="template-mappings" hidden></div>
        <iframe id="contract-template-preview" class="template-preview" title="Preview of the filled PDF" hidden></iframe>
        <p id="contract-template-status" class="form-status" role="status" aria-live="polite">Log in to use AI field matching.</p>
        <a id="contract-template-download" class="text-link" hidden>Download filled contract PDF again</a>
      </section></section>'''
    content += '<script type="application/json" id="contract-schema">' + json.dumps(SCHEMA).replace('<', '\\u003c') + '</script>'
    return content
