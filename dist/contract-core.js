/* Contract terms and PDF layout. No network requests or browser storage. */
(function (root) {
  'use strict';
  const allocations = [
    ['studentBudget', 'Graduate-student support'],
    ['researchBudget', 'Investigator / research team'],
    ['directBudget', 'Other direct project costs'],
    ['adminBudget', 'Administration / indirect costs']
  ];
  function cents(value) {
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(String(value).trim())) return null;
    const [whole, fraction = ''] = String(value).trim().split('.');
    return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  }
  function money(value, currency) {
    const amount = cents(value);
    return amount === null ? (String(value || '').startsWith('[') ? value : '[Amount to be agreed]') : formatCents(amount, currency);
  }
  function formatCents(amount, currency) {
    return `${currency} ${(amount / 100).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
  }
  function validate(data, schema) {
    const errors = [];
    for (const field of schema.flatMap(group => group.fields)) {
      if (field.grantOnly && data.agreementType !== 'grant') continue;
      const value = String(data[field.name] || '').trim();
      const add = message => errors.push({field:field.name, message:`${field.label}: ${message}`});
      if (!value) { if (field.required !== false) add('please complete this field.'); continue; }
      if (value.length > (field.maxLength || (field.type === 'textarea' ? 4000 : 200))) add('please shorten this entry.');
      if (field.type === 'select' && !field.options.some(([key]) => key === value)) add('choose one of the available options.');
      if (field.type === 'money' && cents(value) === null) add('enter up to 9 whole digits and 2 decimal places, without commas.');
      if (field.type === 'number' && (!/^\d+$/.test(value) || Number(value) < (field.min || 0) || Number(value) > (field.max || 365))) add(`enter a whole number from ${field.min || 0} to ${field.max || 365}.`);
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) add('enter a valid email address.');
      if (field.type === 'date') {
        const date = new Date(`${value}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) add('enter a valid calendar date.');
      }
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) add('remove unsupported control characters.');
    }
    for (const field of ['totalBudget','liabilityCap']) {
      if (cents(data[field]) === 0) errors.push({field, message:`${field === 'studentBudget' ? 'Graduate-student support' : field === 'totalBudget' ? 'Total project budget' : 'Liability cap'} must be greater than zero.`});
    }
    const amounts = allocations.map(([key]) => cents(data[key]));
    const total = cents(data.totalBudget);
    if (total !== null && amounts.every(amount => amount !== null) && amounts.reduce((a, b) => a + b, 0) !== total) {
      errors.push({field:'totalBudget', message:'The four budget allocations must add up exactly to the total project budget.'});
    }
    if (data.startDate && data.endDate && data.startDate > data.endDate) errors.push({field:'endDate', message:'Project end date must be on or after the start date.'});
    if (data.effectiveDate && data.startDate && data.effectiveDate > data.startDate) errors.push({field:'effectiveDate', message:'Effective date must be on or before the project start date.'});
    return errors;
  }

  function prepare(data, schema) {
    const result = {};
    for (const field of schema.flatMap(group => group.fields)) {
      const value = String(data[field.name] || '').trim().normalize('NFC');
      result[field.name] = value || field.default || `[${field.label} to be agreed]`;
    }
    result.currency = String(data.currency || '').trim() || '[Currency to be agreed]';
    result.reference = String(data.reference || '').trim() || 'DRAFT - reference to be assigned';
    result.taxTerms = data.taxTerms || 'pending';
    result.ipModel = data.ipModel || 'pending';
    result.specialTerms = String(data.specialTerms || '').trim() || 'No additional negotiated terms supplied. Any additions must be agreed in writing before signature.';
    return result;
  }

  function terms(d) {
    const grant = d.agreementType === 'grant';
    const blocks = [];
    const h = text => blocks.push({kind:'heading', text});
    const p = text => blocks.push({kind:'paragraph', text});
    const field = (label, text) => blocks.push({kind:'field', label, text});
    h('1. Parties, purpose, and term');
    p(`This ${grant ? 'Sponsored Research Agreement' : 'Research Services Agreement'} (Agreement), reference ${d.reference}, is proposed between ${d.providerName} (Provider), acting for BIOracle, and ${d.sponsorName} (Sponsor), effective ${d.effectiveDate}, subject to execution by both parties. The project is ${d.projectTitle}. The performance period is ${d.startDate} through ${d.endDate}, unless extended or terminated under this Agreement.`);
    field('Provider address and notices', `${d.providerAddress}\nPhone: ${d.providerPhone}\nAttention: ${d.providerSigner}, ${d.providerTitle}\nEmail: ${d.providerEmail}`);
    field('Sponsor address and notices', `${d.sponsorAddress}\nAttention: ${d.sponsorSigner}, ${d.sponsorTitle}\nEmail: ${d.sponsorEmail}`);
    field('Project lead', d.projectLead);
    if (grant) {
      field('Award reference', d.awardId);
      field('Award conditions and incorporated documents', d.awardTerms);
      p('This Agreement supplements, and does not itself constitute or replace, the identified award instrument. Applicable law and mandatory award conditions prevail over inconsistent provisions of this Agreement. Each party shall receive the identified incorporated documents before signature. No cost, fee, transfer, or payment is authorized by this Agreement if prohibited by the award. Required approvals remain conditions of performance.');
    }
    h('2. Scope, deliverables, and acceptance');
    field('Scope and exclusions', d.scope);
    field('Deliverables and formats', d.deliverables);
    field('Milestones and due dates', d.milestones);
    field('Acceptance criteria and review process', d.acceptance);
    field('Sponsor inputs, access, and dependencies', d.clientInputs);
    p('Provider shall perform the defined work with reasonable professional skill and care. Sponsor shall supply the agreed inputs and give timely, specific feedback. Neither party may unilaterally expand the scope or budget. Changes to scope, milestones, acceptance, or funding require a written amendment approved by authorized representatives and, where applicable, the funder. Acceptance is governed by the stated criteria; silence alone does not establish acceptance unless expressly agreed above.');
    h('3. Funding and budget allocations');
    p(`The total project budget is ${money(d.totalBudget, d.currency)}. All amounts in this Agreement are in ${d.currency}. ${d.taxTerms === 'included' ? 'Applicable taxes are included in the stated total.' : d.taxTerms === 'additional' ? 'Only legally applicable taxes, separately identified on a valid invoice, may be charged in addition to the stated total.' : '[Tax treatment to be agreed in writing before signature.]'}`);
    for (const [key, label] of allocations) field(label, money(d[key], d.currency));
    p('These allocations establish the agreed project budget, not an immediate distribution of money or a guaranteed return. Provider shall maintain records supporting project charges and commitments. Reallocation requires written approval by the named budget approver and any additional approval required by Sponsor or the award. Graduate-student support shall not be reduced without a written amendment addressing existing commitments. No party is required to incur costs beyond the agreed funding ceiling without a written amendment.');
    if (grant) p('Charges to a sponsored award must be allowable, allocable, reasonable, documented, and consistent with its conditions. Indirect costs, student support, effort reporting, unspent balances, and closeout shall follow the award requirements. A budget label does not establish cost eligibility; this template does not create a right to profit or a discretionary distribution from restricted grant funds.');
    h('4. Invoicing, approvals, and payment');
    field('Funding and invoice schedule', d.paymentSchedule);
    p(`Sponsor shall pay valid, undisputed invoices within ${d.invoiceDays} calendar days of receipt in accordance with the funding schedule and applicable award terms. Sponsor shall promptly identify disputed items and the reasons in writing; undisputed amounts remain due. The parties shall work in good faith to resolve discrepancies.`);
    p(`The budget approver is ${d.budgetApprover}. Complete payment or purchase requests should be approved or returned with specific reasons within ${d.approvalDays} business days. Once approval, required documentation, and available project funds are in place, Provider shall target payment processing within ${d.disbursementDays} business days. These are administrative processing commitments, not guarantees of bank settlement or funder payment timing. Business days exclude weekends and public holidays at the Provider's notice address.`);
    p('Provider shall promptly notify Sponsor and affected project personnel of material funding or approval delays and propose a recovery plan. Neither an administrative target nor a late sponsor payment excuses wages or other amounts already owed under applicable law or separate appointments. Banking instructions shall be exchanged and verified separately; this Agreement contains no account credentials.');
    h('5. Graduate-student support and supervision');
    field('Academic supervisor', d.academicSupervisor);
    field('Funded student roles, support, and payment plan', d.studentPlan);
    p(`Provider shall reserve ${money(d.studentBudget, d.currency)} within the budget for the stated graduate-student support and administer it through appropriate, lawful appointment or payment arrangements. The academic supervisor shall oversee the agreed research and mentorship responsibilities. This Agreement is not itself an employment contract, fellowship appointment, admission offer, or tuition waiver. Required individual arrangements must be documented before a student begins the funded work.`);
    p('The parties shall review upcoming student commitments when changing project scope, funding, or duration. Student payments shall follow the stated plan and the controlling appointment, award, and legal requirements. Any wind-down must address earned compensation and existing obligations; this Agreement does not waive students’ rights or make students responsible for a sponsor’s unpaid invoices.');
    h('6. Intellectual property and permitted use');
    p('Each party retains ownership of intellectual property developed independently of the project or owned before it (Background IP). No Background IP transfers merely by being used in the project. Third-party and open-source materials remain subject to their own terms. Neither party may grant rights it does not hold.');
    if (d.ipModel === 'provider') p('Subject to mandatory award terms and the specific terms below, Provider owns results created by its personnel under this Agreement. Upon full payment of amounts due, Provider grants Sponsor a non-exclusive, worldwide, perpetual license to use the delivered results for Sponsor’s internal purposes. This license does not authorize sublicensing, resale, or transfer of ownership. Background IP is licensed only to the extent expressly specified below.');
    if (d.ipModel === 'client') p('Subject to mandatory award terms and the specific terms below, Provider assigns to Sponsor its transferable rights in the project deliverables upon full payment of amounts due. This assignment excludes Background IP, third-party materials, and rights Provider does not hold. Before incorporating retained materials necessary to use a deliverable, the parties shall agree the necessary license in writing. Invention rights and any required confirmatory assignments are governed by the specific terms below.');
    if (d.ipModel === 'custom') p('Ownership and licensing of project results are governed by the expressly stated custom terms below, subject to applicable law and mandatory award conditions. No broader license or transfer is implied.');
    if (d.ipModel === 'pending') p('[Ownership and licensing of project results to be agreed in writing before signature. No ownership transfer or project-results license is implied by this incomplete draft.]');
    field('Specific IP, background-material, and license terms', d.ipDetails);
    h('7. Publication and academic use');
    field('Agreed publication, review, patent-delay, and thesis terms', d.publicationTerms);
    p('The parties shall apply these terms consistently with confidentiality, third-party rights, academic commitments, and mandatory award requirements. No party may use the other’s name, marks, or implied endorsement in publicity without prior written consent, except for a legally required disclosure or an expressly permitted acknowledgment.');
    h('8. Confidentiality and data');
    p(`A party receiving information identified as confidential, or reasonably understood to be confidential in context, shall use it only for this project and protect it with reasonable care. Disclosure is limited to persons with a need to know and obligations of protection. These duties continue for ${d.confidentialityYears} years after termination; trade secrets remain protected for as long as required by applicable law.`);
    p('These duties do not cover information demonstrably public without breach, already lawfully known, independently developed without use of the information, or lawfully received from another source without a duty of confidence. Legally compelled disclosure is permitted after notice where lawful and reasonable efforts to limit disclosure. These provisions do not restrict protected reporting or other non-waivable rights.');
    field('Data handling, security, and project-specific requirements', d.dataTerms);
    p('Neither party shall provide personal, sensitive, regulated, or restricted data beyond the agreed scope. Any required data-processing, ethics, export-control, or other authorization must be in place before the affected work begins. On completion or termination, information shall be returned, retained, or deleted as agreed above and as required by law or the award, with continuing protection for lawful retained copies.');
    h('9. Research uncertainty and responsibilities');
    p('Research outcomes are uncertain. Provider does not guarantee a particular scientific finding, commercial result, regulatory approval, publication, or future performance. Provider remains responsible for the agreed standard of professional care and deliverables. Sponsor remains responsible for decisions made using the results and for uses outside the agreed scope. Except as expressly provided or required by law, no other warranty is given.');
    h('10. Liability');
    p(`To the extent permitted by applicable law and mandatory award conditions, each party’s aggregate liability arising from this Agreement shall not exceed ${money(d.liabilityCap, d.currency)}. Neither party shall be liable to the other for indirect or consequential loss, including lost profits, to the extent such exclusion is lawful. These limits do not apply to fraud, willful misconduct, or liability that cannot lawfully be limited. They do not excuse amounts properly due for performed work or permit withholding earned student or employee compensation. No separate indemnity is created unless expressly set out in the additional terms.`);
    h('11. Termination and closeout');
    p(`Either party may terminate for convenience on ${d.terminationDays} calendar days’ written notice, subject to controlling award conditions. For a material breach, the non-breaching party may terminate if the breach is not cured within ${d.cureDays} calendar days after written notice describing it. The parties shall promptly discuss a good-faith cure plan where a breach cannot reasonably be cured within that period. Work prohibited by law must stop without waiting for a cure period.`);
    p('On termination, Provider shall stop new avoidable commitments, protect project records, and provide an accounting of work performed and commitments properly incurred. Sponsor shall pay amounts properly due for work performed and authorized non-cancelable commitments, subject to the funding ceiling and award conditions. Provider shall reconcile advances and return unearned or disallowed balances as required. The parties shall agree the handover of paid-for deliverables and a responsible student-support wind-down. Accrued payment, confidentiality, IP, data, dispute, and other provisions intended to survive remain effective.');
    h('12. Governing law, disputes, and notices');
    field('Governing law', d.governingLaw);
    field('Agreed courts / dispute venue', d.disputeForum);
    p('The parties shall first attempt to resolve disputes through good-faith discussion between authorized representatives. If unresolved, either party may seek relief in the agreed courts, subject to applicable mandatory law. Nothing prevents urgent relief where legally available. Formal notices shall be sent to the addresses or emails identified above, with evidence of delivery. Changes to notice details must be communicated in writing.');
    h('13. General provisions');
    p('The parties act as independent contractors; this Agreement does not create a partnership, joint venture, agency, or employment relationship between the parties. Neither party may bind the other without written authority. Neither party may assign this Agreement without the other’s written consent, except as required by law. Subcontracting does not relieve Provider of its responsibilities and remains subject to award approval requirements.');
    p('A party affected by events beyond its reasonable control shall promptly notify the other, mitigate their effects, and agree appropriate schedule adjustments. This does not excuse amounts already owed. Any amendment or waiver must be in writing by authorized representatives. Failure to enforce a term is not a continuing waiver. If a term is unenforceable, the remaining terms continue to the extent legally possible.');
    p(`This Agreement and its expressly identified incorporated documents constitute the parties’ agreement on this project. ${grant ? 'Mandatory law and award conditions take precedence; express negotiated amendments then prevail over inconsistent standard template language.' : 'Mandatory law takes precedence; express negotiated amendments prevail over inconsistent standard template language.'} The parties may sign in counterparts, including electronic signatures where legally permitted. Entering a name in the generator is not a signature and does not execute this Agreement.`);
    h('14. Additional negotiated terms');
    p(d.specialTerms || 'None.');
    blocks.push({kind:'signatures', text:'Execution by authorized representatives'});
    return blocks;
  }

  async function generate(data, schema, PDFLib, logoBytes) {
    const entered = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v).trim().normalize('NFC')]));
    const errors = validate(entered, schema);
    if (errors.length) { const error = new Error('Please correct the contract fields.'); error.fields = errors; throw error; }
    const d = prepare(entered, schema);
    const {PDFDocument, StandardFonts, rgb} = PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const logo = logoBytes ? await doc.embedPng(logoBytes) : null;
    const clean = value => String(value).replace(/[\u2010-\u2015]/g, '-').replace(/\t/g, '    ');
    // Fail visibly rather than dropping names or unsupported characters from a legal document.
    for (const group of schema) for (const field of group.fields) {
      if (field.grantOnly && d.agreementType !== 'grant') continue;
      try { font.encodeText(clean(d[field.name] || '').replace(/\n|\r/g, ' ')); }
      catch {
        const error = new Error('The PDF font cannot represent a character in an entry.');
        error.fields = [{field:field.name, message:`${field.label}: the PDF font cannot render one or more characters. Use a Latin-script spelling or contact BIOracle for a manually prepared agreement.`}];
        throw error;
      }
    }
    doc.setTitle(`${d.agreementType === 'grant' ? 'Sponsored Research' : 'Research Services'} Agreement - ${d.reference}`);
    doc.setAuthor('BIOracle');
    doc.setSubject('Unsigned contract draft for review');
    const width = 595.28, height = 841.89, margin = 52, bodyWidth = width - 2 * margin;
    const ink = rgb(.13,.18,.16), green = rgb(.21,.37,.32), muted = rgb(.38,.42,.40);
    const layout = [];
    let page, y;
    const addressLines = String(d.providerAddress || '[New Mexico address to be agreed]').split(/\r?\n/);
    const contactLine = addressLines.join(', ').replace(/\s+/g, ' ').replace(/\u2010|\u2011|\u2012|\u2013|\u2014/g, '-');
    const contactLine2 = [d.providerPhone || '[New Mexico phone to be agreed]',d.providerEmail || '[BIOracle email to be agreed]'].join('  | ');
    function newPage() {
      page = doc.addPage([width, height]);
      if (logo) page.drawImage(logo,{x:margin,y:height-92,width:76,height:76});
      const brandX = margin + (logo ? 88 : 0);
      page.drawText('DRAFT - FOR REVIEW', {x:width - margin - bold.widthOfTextAtSize('DRAFT - FOR REVIEW', 8), y:height - 18, size:8, font:bold, color:muted});
      const contactMax = width - margin - brandX;
      let contactSize = 7.2;
      while (contactSize > 5 && font.widthOfTextAtSize(contactLine,contactSize) > contactMax) contactSize -= .2;
      page.drawText(contactLine,{x:brandX,y:height-37,size:contactSize,font,color:muted,maxWidth:contactMax});
      page.drawText(contactLine2,{x:brandX,y:height-52,size:7.2,font,color:muted,maxWidth:contactMax});
      page.drawLine({start:{x:margin,y:height - 103}, end:{x:width - margin,y:height - 103}, thickness:.6,color:rgb(.79,.83,.80)});
      y = height - 129;
    }
    function ensure(space) { if (y - space < 62) newPage(); }
    function wrap(value, face, size, maxWidth = bodyWidth) {
      const lines = [];
      for (const paragraph of clean(value).replace(/\r\n?/g, '\n').split('\n')) {
        let line = '';
        for (const word of paragraph.trim().split(/\s+/)) {
          if (!word) continue;
          if (face.widthOfTextAtSize(word, size) > maxWidth) {
            if (line) { lines.push(line); line = ''; }
            for (const character of word) {
              if (face.widthOfTextAtSize(line + character, size) > maxWidth) { lines.push(line); line = ''; }
              line += character;
            }
          } else if (line && face.widthOfTextAtSize(line + ' ' + word, size) > maxWidth) {
            lines.push(line); line = word;
          } else line += (line ? ' ' : '') + word;
        }
        lines.push(line);
      }
      return lines;
    }
    function write(value, face = font, size = 10.5, leading = 15.5, after = 10) {
      const lines = wrap(value, face, size);
      for (let i = 0; i < lines.length; i++) {
        // Keep a paragraph's last two lines together when a page fills.
        ensure(leading * (lines.length - i === 2 ? 2 : 1));
        if (lines[i]) page.drawText(lines[i], {x:margin, y, size, font:face, color:ink});
        layout.push({page:doc.getPageCount(), y, width:face.widthOfTextAtSize(lines[i], size), text:lines[i]});
        y -= leading;
      }
      y -= after;
    }
    newPage();
    write(d.agreementType === 'grant' ? 'Sponsored Research Agreement' : 'Research Services Agreement', bold, 23, 28, 12);
    write(d.projectTitle, font, 15, 20, 12);
    write(`Reference: ${d.reference}  |  Effective date: ${d.effectiveDate}`, font, 10, 15, 12);
    write('Unsigned draft. Bracketed text identifies terms still to be agreed. Complete and review all legal, institutional, and award-specific terms before signature. Generation of this document does not execute an agreement.', font, 10, 14, 22);
    for (const block of terms(d)) {
      if (block.kind === 'heading') {
        ensure(wrap(block.text, bold, 13).length * 18 + 48);
        write(block.text, bold, 13, 18, 9);
      } else if (block.kind === 'field') {
        ensure(wrap(block.label, bold, 10.5).length * 15 + 40);
        write(block.label, bold, 10.5, 15, 3);
        write(block.text);
      } else if (block.kind === 'signatures') {
        ensure(275);
        write(block.text, bold, 13, 18, 12);
        write('By signing below, each signatory represents that they are authorized to bind the named entity.', font, 10.5, 15.5, 18);
        for (const [role, name, signer, title] of [
          ['Provider', d.providerName, d.providerSigner, d.providerTitle],
          ['Sponsor', d.sponsorName, d.sponsorSigner, d.sponsorTitle]
        ]) {
          ensure(100 + wrap(name + ' / ' + signer + ' / ' + title, font, 10.5).length * 15.5);
          write(`${role}: ${name}`, bold, 10.5, 15.5, 3);
          write(`Authorized representative: ${signer}\nTitle: ${title}`, font, 10.5, 15.5, 20);
          write('Signature: __________________________________   Date: __________________', font, 10, 15, 20);
        }
      } else write(block.text);
    }
    const pageCount = doc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const current = doc.getPage(i);
      current.drawLine({start:{x:margin,y:48},end:{x:width - margin,y:48},thickness:.5,color:rgb(.79,.83,.80)});
      current.drawText('BIOracle  ·  Unsigned draft for review', {x:margin,y:32,size:8,font,color:muted});
      const number = `Page ${i + 1} of ${pageCount}`;
      current.drawText(number,{x:width - margin - font.widthOfTextAtSize(number,8),y:32,size:8,font,color:muted});
    }
    return {bytes:await doc.save(), pageCount, layout};
  }
  const api = {allocations, cents, money, formatCents, validate, prepare, terms, generate};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BIOracleContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
