const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../dist/contract-core.js');
const PDFLib = require('../dist/vendor/pdf-lib-1.17.1.min.js');
const schema = require('../content/contract-fields.json');
const root = path.resolve(__dirname, '..');

// Fictional review fixture, not BIOracle's adopted financial or legal terms.
const example = {
  agreementType:'contract', reference:'EXAMPLE-2026-001', projectTitle:'Adaptive systems research - illustrative project',
  effectiveDate:'2026-11-01', startDate:'2026-11-02', endDate:'2027-04-30',
  providerName:'Example Research Entity (illustrative BIOracle contracting party)',
  providerAddress:'100 Example Avenue\nExample City, NM 00000, United States', providerSigner:'Alex Example', providerTitle:'Authorized Representative', providerEmail:'provider@example.org',
  sponsorName:'Example Sponsor, Inc.', sponsorAddress:'200 Sample Road\nExample City, NM 00000, United States', sponsorSigner:'Morgan Sample', sponsorTitle:'Research Director', sponsorEmail:'sponsor@example.org',
  projectLead:'Dr. Jordan Example', scope:'Develop and evaluate a research model of adaptation in a simulated population. Excludes clinical use, investment advice, production deployment, and collection of personal data.',
  deliverables:'One reproducible code repository, a methods report in PDF, and a final presentation. Deliverables document assumptions, limitations, and uncertainty.',
  milestones:'2026-12-15: research design and initial simulation.\n2027-02-28: interim evaluation.\n2027-04-30: final report and repository.',
  acceptance:'Sponsor reviews each deliverable within 15 calendar days against the stated scope. Written rejection must identify a specific unmet requirement. Provider has 20 calendar days to correct agreed deficiencies. Silence is not acceptance.',
  clientInputs:'Sponsor supplies non-sensitive example datasets and appoints one technical contact before project start.',
  currency:'USD', totalBudget:'100000.00', studentBudget:'40000.00', researchBudget:'30000.00', directBudget:'20000.00', adminBudget:'10000.00', taxTerms:'included',
  paymentSchedule:'USD 40,000 at project commencement, USD 30,000 following the interim evaluation, and USD 30,000 on final acceptance. All advances are reconciled at closeout.',
  invoiceDays:'30', budgetApprover:'Alex Example, Project Administrator', approvalDays:'5', disbursementDays:'5',
  academicSupervisor:'Dr. Jordan Example, Research Supervisor',
  studentPlan:'Two graduate research roles share the USD 40,000 allocation across the project period. Each receives USD 20,000 in equal monthly installments through the appropriate appointment and payroll process. Weekly supervision is provided. No tuition waiver or separate benefits are promised by this example. Existing earned-payment obligations remain payable if sponsor funding is delayed.',
  governingLaw:'State of New Mexico, United States, subject to applicable federal law', disputeForum:'Courts of competent jurisdiction in Bernalillo County, New Mexico, United States',
  ipModel:'provider', ipDetails:'Provider retains its pre-existing simulation toolkit. Sponsor receives an internal-use license to the project report and project-specific code after full payment; any third-party components retain their original licenses.',
  publicationTerms:'Provider and students may publish results and use them in theses after 30 calendar days of sponsor review for confidential information. A single additional delay of up to 60 calendar days may be requested for a patent filing. Sponsor has no right to suppress unfavorable findings.',
  confidentialityYears:'3', dataTerms:'No personal or regulated data permitted. Limit access to the project team; use encrypted storage and transport. Notify the other party of a confirmed project-data incident without undue delay. Retain project records for three years after closeout unless a longer legal obligation applies.',
  terminationDays:'30', cureDays:'30', liabilityCap:'100000.00', specialTerms:'This is a fictional test specimen. No party has approved or executed it.'
};

test('only five essential fields are required, including for sponsored research', () => {
  assert.deepEqual(core.validate(example, schema), []);
  const grant = {...example, agreementType:'grant'};
  assert.deepEqual(core.validate(grant, schema), []);
  assert.equal(schema.flatMap(g => g.fields).filter(f => f.required).length, 5);
  assert.deepEqual(core.validate({...grant, awardId:'EXAMPLE-GRANT-01', awardTerms:'Illustrative award: no profit, prior written approval for reallocation, monthly cost reports, and return of unspent advances.'}, schema), []);
});

test('budget, dates, required fields, limits, and legal selections are validated', () => {
  assert.equal(core.cents('0.10') + core.cents('0.20'), core.cents('0.30'));
  for (const invalid of ['-1', '1e6', 'NaN', '10,000', '1.005', '1000000000']) assert.equal(core.cents(invalid), null);
  for (const [field, value] of [['studentBudget','0'], ['totalBudget','90000'], ['liabilityCap','0'], ['startDate','2027-06-01'], ['effectiveDate','2026-12-01'], ['endDate','2027-02-31'], ['providerName',''], ['providerEmail','invalid'], ['invoiceDays','0'], ['ipModel','injected']]) {
    assert.ok(core.validate({...example, [field]:value}, schema).length, `${field}=${value}`);
  }
  assert.deepEqual(core.validate({...example, ipModel:'custom', ipDetails:''}, schema), []);
});

test('five-field form produces a readable PDF with placeholders for every missing term', async () => {
  const minimal = Object.fromEntries(schema.flatMap(g => g.fields).filter(f => f.required).map(f => [f.name, example[f.name]]));
  assert.deepEqual(core.validate(minimal, schema), []);
  const result = await core.generate(minimal, schema, PDFLib);
  const text = result.layout.map(line => line.text).join(' ');
  for (const phrase of ['to be agreed', 'Provider', 'Sponsor', 'Signature:', 'Tax treatment', 'Ownership and licensing']) assert.ok(text.includes(phrase), phrase);
  assert.ok(!/undefined|NaN|Invalid Date/.test(text));
  for (const line of result.layout) assert.ok(line.width <= 491.29 && line.y >= 62);
  fs.mkdirSync(path.join(root, 'output/pdf'), {recursive:true});
  fs.writeFileSync(path.join(root, 'output/pdf/business-model-minimal-contract.pdf'), result.bytes);
});

test('PDF contains a complete draft with safe margins and working pagination', async () => {
  const result = await core.generate(example, schema, PDFLib);
  assert.ok(result.pageCount >= 5);
  for (const line of result.layout) {
    assert.ok(line.y >= 62 && line.y <= 841.89 - 76, JSON.stringify(line));
    assert.ok(line.width <= 595.28 - 104 + .01, JSON.stringify(line));
  }
  assert.ok(result.layout.some(line => line.text.includes('Signature:')));
  const loaded = await PDFLib.PDFDocument.load(result.bytes);
  assert.equal(loaded.getPageCount(), result.pageCount);
  fs.mkdirSync(path.join(root, 'output/pdf'), {recursive:true});
  fs.writeFileSync(path.join(root, 'output/pdf/business-model-example-contract.pdf'), result.bytes);
  fs.mkdirSync(path.join(root, 'tmp/pdfs'), {recursive:true});
  fs.writeFileSync(path.join(root, 'tmp/pdfs/contract-layout.json'), JSON.stringify(result.layout));
});

test('long text, grant terms, literal markup, and accented names survive layout', async () => {
  const d = {...example, agreementType:'grant', awardId:'EXAMPLE-GRANT-01',
    awardTerms:'No profit; actual allowable costs only; return unspent advances. Both parties must review the sponsor award. END-OF-AWARD-TERMS',
    providerSigner:'María Rodríguez', ipModel:'custom', ipDetails:'Project-specific ownership to be agreed as follows: each party owns its separately authored work, with an internal-use license to the other. No joint ownership is assumed.',
    scope:('A long project description with explicit tasks and constraints. '.repeat(55)) + 'END-OF-SCOPE',
    specialTerms:('LongUnbrokenReference'.repeat(20)) + '\nLiteral text: <script>alert(1)</script>\nEND-OF-SPECIAL-TERMS'};
  const result = await core.generate(d, schema, PDFLib);
  for (const line of result.layout) assert.ok(line.width <= 491.28 + .01 && line.y >= 62);
  const text = result.layout.map(l => l.text).join('\n');
  for (const expected of ['END-OF-SCOPE','END-OF-AWARD-TERMS','END-OF-SPECIAL-TERMS','María Rodríguez','<script>alert(1)</script>']) assert.ok(text.includes(expected), expected);
  fs.writeFileSync(path.join(root, 'tmp/pdfs/long-sponsored-research-example.pdf'), result.bytes);
});

test('unsupported glyphs fail explicitly rather than corrupting a party name', async () => {
  await assert.rejects(core.generate({...example, providerSigner:'王 Example'}, schema, PDFLib), error => error.fields?.[0]?.field === 'providerSigner');
});

test('page has both About links and every form field, with local scripts only', () => {
  const about = fs.readFileSync(path.join(root, 'dist/about/index.html'), 'utf8');
  assert.match(about, /href="\/business-model\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(about, /href="\/mission\/" target="_blank"/);
  const page = fs.readFileSync(path.join(root, 'dist/business-model/index.html'), 'utf8');
  for (const group of schema) for (const field of group.fields) {
    assert.ok(page.includes(`name="${field.name}"`), field.name);
    assert.ok(page.includes(`for="contract-${field.name}"`), field.name);
  }
  assert.match(page, />generate contract </);
  assert.match(page, /src="\/vendor\/pdf-lib-1.17.1.min.js"/);
  assert.ok(!/script src="https?:/.test(page));
});

test('form controller permits optional grant fields, blocks invalid budgets, and downloads a real PDF', async () => {
  class Element {
    constructor() { this.listeners = {}; this.attrs = {}; this.children = []; this.disabled = false; this.hidden = false; this.value = ''; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    focus() { this.focused = true; }
    click() { this.clicked = true; }
  }
  const form = new Element();
  form.elements = {};
  const grantWrappers = [];
  for (const field of schema.flatMap(group => group.fields)) {
    const element = new Element(); element.value = example[field.name] || ''; form.elements[field.name] = element;
    if (field.grantOnly) {
      const wrapper = new Element(); wrapper.querySelector = () => element; grantWrappers.push(wrapper);
    }
  }
  form.querySelectorAll = selector => selector === '[data-grant-only]' ? grantWrappers : Object.values(form.elements).filter(el => el.attrs['aria-invalid']);
  form.reportValidity = () => true;
  const nodes = {'contract-form':form, 'contract-schema':{textContent:JSON.stringify(schema)}};
  for (const id of ['contract-status','contract-errors','generate-contract','contract-download','contract-budget-status','contract-budget-lines']) nodes[id] = new Element();
  nodes['generate-contract'].disabled = true;
  const blobs = new Map();
  const context = {
    window:{BIOracleContract:core, PDFLib}, Blob,
    document:{getElementById:id => nodes[id], createElement:() => new Element()},
    FormData:class {
      constructor(form) { this.entries = Object.entries(form.elements).filter(([,el]) => !el.disabled).map(([key, el]) => [key, el.value]); }
      [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
    },
    URL:{createObjectURL:blob => { const url = `blob:test-${blobs.size}`; blobs.set(url, blob); return url; }, revokeObjectURL:url => blobs.delete(url)}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/contract-form.js'), 'utf8'), context);
  assert.equal(nodes['generate-contract'].disabled, false);
  assert.ok(form.elements.awardTerms.disabled);
  const submit = () => form.listeners.submit({preventDefault() {}});
  form.elements.totalBudget.value = '5';
  await submit();
  assert.equal(blobs.size, 0);
  assert.equal(nodes['contract-errors'].hidden, false);
  form.elements.totalBudget.value = example.totalBudget;
  await submit();
  assert.equal(blobs.size, 1);
  assert.equal(nodes['contract-download'].clicked, true);
  assert.equal(nodes['contract-download'].download, 'BIOracle-EXAMPLE-2026-001-draft.pdf');
  const blob = [...blobs.values()][0];
  assert.equal(blob.type, 'application/pdf');
  assert.ok((await PDFLib.PDFDocument.load(await blob.arrayBuffer())).getPageCount() >= 5);
  form.elements.agreementType.value = 'grant';
  form.listeners.input({target:form.elements.agreementType});
  assert.equal(blobs.size, 0, 'Changing inputs revokes the stale download.');
  assert.equal(form.elements.awardTerms.disabled, false);
  assert.equal(form.elements.awardTerms.required, false);
  await submit();
  assert.equal(blobs.size, 1, 'Missing optional grant terms receive placeholder text.');
  form.elements.awardId.value = 'EXAMPLE-GRANT-01';
  form.elements.awardTerms.value = 'Actual allowable costs only; required approvals and sponsor reports apply.';
  await submit();
  assert.equal(blobs.size, 1);
  assert.match(nodes['contract-status'].textContent, /contract draft is ready/);
});
