'use strict';

(() => {
  const form = document.getElementById('contract-form');
  const schema = JSON.parse(document.getElementById('contract-schema').textContent);
  const core = window.BIOracleContract;
  const status = document.getElementById('contract-status');
  const errorsBox = document.getElementById('contract-errors');
  const button = document.getElementById('generate-contract');
  const download = document.getElementById('contract-download');
  const budgetStatus = document.getElementById('contract-budget-status');
  const formatSelect = document.getElementById('contract-format');
  if (!core || !window.PDFLib) {
    button.disabled = true;
    status.textContent = 'The contract generator did not load. Please reload this page.';
    return;
  }
  let url = null;
  function values() { return Object.fromEntries(new FormData(form)); }
  const xml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function contractParagraphs(data) {
    const d = core.prepare(data, schema);
    const paragraphs = [
      {style:'Title', text:d.agreementType === 'grant' ? 'Sponsored Research Agreement' : 'Research Services Agreement'},
      {style:'Subtitle', text:d.projectTitle},
      {text:`Reference: ${d.reference}  |  Effective date: ${d.effectiveDate}`},
      {text:'Unsigned draft. Bracketed text identifies terms still to be agreed. Complete and review all legal, institutional, and award-specific terms before signature. Generation of this document does not execute an agreement.'}
    ];
    for (const block of core.terms(d)) {
      if (block.kind === 'heading') paragraphs.push({style:'Heading1', text:block.text});
      else if (block.kind === 'field') paragraphs.push({style:'Heading2', text:block.label}, {text:block.text});
      else if (block.kind === 'signatures') {
        paragraphs.push({style:'Heading1', text:block.text}, {text:'By signing below, each signatory represents that they are authorized to bind the named entity.'});
        for (const [role, name, signer, title] of [['Provider',d.providerName,d.providerSigner,d.providerTitle],['Sponsor',d.sponsorName,d.sponsorSigner,d.sponsorTitle]]) {
          paragraphs.push({style:'Heading2',text:`${role}: ${name}`},{text:`Authorized representative: ${signer}\nTitle: ${title}`},{text:'Signature: __________________________________   Date: __________________'});
        }
      } else paragraphs.push({text:block.text});
    }
    paragraphs.push({text:'BIOracle | Unsigned agreement draft'});
    return paragraphs;
  }
  function markdown(paragraphs) {
    return paragraphs.map(p => p.style === 'Title' ? `# ${p.text}` : p.style === 'Subtitle' ? `## ${p.text}` : p.style === 'Heading1' ? `\n## ${p.text}` : p.style === 'Heading2' ? `\n### ${p.text}` : p.text).join('\n\n') + '\n';
  }
  function rtf(paragraphs) {
    const escape = value => {
      let out = '';
      for (const char of String(value)) {
        if (char === '\\' || char === '{' || char === '}') out += `\\${char}`;
        else if (char === '\n') out += '\\line ';
        else { const code = char.codePointAt(0); out += code > 127 ? `\\u${code > 32767 ? code - 65536 : code}?` : char; }
      }
      return out;
    };
    const body = paragraphs.map((p,index) => {
      const title = p.style === 'Title', subtitle = p.style === 'Subtitle';
      const heading = p.style === 'Heading1' || p.style === 'Heading2';
      const size = title ? 34 : subtitle ? 25 : p.style === 'Heading1' ? 26 : p.style === 'Heading2' ? 22 : index === 2 ? 19 : 21;
      const before = title ? 0 : p.style === 'Heading1' ? 260 : p.style === 'Heading2' ? 190 : 0;
      const after = title ? 120 : subtitle ? 240 : p.style === 'Heading1' ? 110 : p.style === 'Heading2' ? 65 : 130;
      const color = title || heading ? '\\cf2 ' : index === 2 ? '\\cf3 ' : '\\cf1 ';
      const bold = title || heading ? '\\b ' : '';
      return `{\\pard\\qj\\sa${after}\\sb${before}\\sl300\\slmult1${color}\\f0\\fs${size}${bold}${escape(p.text)}\\b0\\cf1\\par}`;
    }).join('\n');
    return `{\\rtf1\\ansi\\deff0\\viewkind4\\uc1\\paperw12240\\paperh15840\\margl1080\\margr1080\\margt1000\\margb1000{\\fonttbl{\\f0 Aptos;}}{\\colortbl;\\red37\\green46\\blue41;\\red42\\green83\\blue68;\\red105\\green115\\blue108;}\\widowctrl\\hyphauto ${body}}`;
  }
  function crc32(bytes) {
    let crc = -1;
    for (const byte of bytes) { crc ^= byte; for (let k=0;k<8;k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ -1) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder(), local = [], central = []; let offset = 0;
    const u16 = (o,v,n) => {o.setUint16(v,n,true);}, u32 = (o,v,n) => {o.setUint32(v,n,true);};
    for (const [name, value] of Object.entries(files)) {
      const n=enc.encode(name), data=enc.encode(value), crc=crc32(data), h=new Uint8Array(30+n.length), hv=new DataView(h.buffer);
      u32(hv,0,0x04034b50); u16(hv,4,20); u16(hv,6,0); u16(hv,8,0); u16(hv,10,0); u16(hv,12,0); u32(hv,14,crc); u32(hv,18,data.length); u32(hv,22,data.length); u16(hv,26,n.length); u16(hv,28,0); h.set(n,30); local.push(h,data);
      const c=new Uint8Array(46+n.length), cv=new DataView(c.buffer); u32(cv,0,0x02014b50); u16(cv,4,20); u16(cv,6,20); u16(cv,8,0); u16(cv,10,0); u16(cv,12,0); u16(cv,14,0); u32(cv,16,crc); u32(cv,20,data.length); u32(cv,24,data.length); u16(cv,28,n.length); u16(cv,30,0); u16(cv,32,0); u16(cv,34,0); u16(cv,36,0); u32(cv,38,0); u32(cv,42,offset); c.set(n,46); central.push(c); offset += h.length + data.length;
    }
    const centralSize=central.reduce((n,b)=>n+b.length,0), end=new Uint8Array(22), ev=new DataView(end.buffer); u32(ev,0,0x06054b50); u16(ev,4,0); u16(ev,6,0); u16(ev,8,Object.keys(files).length); u16(ev,10,Object.keys(files).length); u32(ev,12,centralSize); u32(ev,16,offset); u16(ev,20,0);
    return new Blob([...local,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  function docx(paragraphs) {
    const body=paragraphs.map(p=>`<w:p><w:pPr>${p.style?`<w:pStyle w:val="${p.style}"/>`:''}<w:spacing w:before="${p.style==='Heading1'?260:p.style==='Heading2'?180:0}" w:after="${p.style==='Title'?120:p.style==='Subtitle'?240:p.style==='Heading1'?100:p.style==='Heading2'?60:140}" w:line="320" w:lineRule="auto"/><w:jc w:val="both"/>${p.style==='Heading1'||p.style==='Heading2'||p.style==='Title'?'<w:keepNext/>':''}</w:pPr>${String(p.text).split('\n').map((line,i)=>`${i?'<w:r><w:br/></w:r>':''}<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join('')}</w:p>`).join('');
    return zip({
      '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
      '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
      'word/document.xml':`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="480" w:footer="480"/></w:sectPr></w:body></w:document>`,
      'word/styles.xml':'<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:color w:val="252E29"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="2A5344"/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="46534B"/><w:sz w:val="27"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="9"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="100"/></w:pPr><w:rPr><w:b/><w:color w:val="2A5344"/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="180" w:after="60"/></w:pPr><w:rPr><w:b/><w:color w:val="46534B"/><w:sz w:val="23"/></w:rPr></w:style></w:styles>'
    });
  }
  function clearDownload() {
    if (url) URL.revokeObjectURL(url);
    url = null;
    download.hidden = true;
    download.removeAttribute('href');
  }
  function syncGrant() {
    const grant = form.elements.agreementType.value === 'grant';
    form.querySelectorAll('[data-grant-only]').forEach(wrapper => {
      wrapper.hidden = !grant;
      const field = wrapper.querySelector('input,textarea');
      field.required = false;
      field.disabled = !grant;
    });
  }
  function showBudget() {
    const d = values();
    const list = document.getElementById('contract-budget-lines');
    list.replaceChildren();
    for (const [key, label] of [...core.allocations, ['totalBudget', 'Total project budget']]) {
      const term = document.createElement('dt');
      const amount = document.createElement('dd');
      term.textContent = label;
      amount.textContent = d.currency ? core.money(d[key], d.currency) : 'Currency to be agreed';
      list.append(term, amount);
    }
    const allocated = core.allocations.map(([key]) => core.cents(d[key]));
    const total = core.cents(d.totalBudget);
    if (total === null || allocated.includes(null) || !d.currency) {
      budgetStatus.textContent = 'Budget details are optional; missing terms will be marked as to be agreed.';
    } else {
      const difference = total - allocated.reduce((sum, amount) => sum + amount, 0);
      budgetStatus.textContent = difference === 0 ? 'Allocations match the total project budget.' : `${core.formatCents(Math.abs(difference), d.currency)} ${difference > 0 ? 'still to allocate' : 'over budget'}.`;
    }
  }
  function showErrors(errors) {
    errorsBox.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'Please correct the following:';
    const list = document.createElement('ul');
    for (const error of errors) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#contract-${error.field}`;
      link.textContent = error.message;
      link.addEventListener('click', event => {
        event.preventDefault();
        form.elements[error.field]?.focus();
      });
      form.elements[error.field]?.setAttribute('aria-invalid', 'true');
      item.append(link); list.append(item);
    }
    errorsBox.append(title, list);
    errorsBox.hidden = false;
    errorsBox.focus();
  }
  form.addEventListener('input', event => {
    event.target.removeAttribute('aria-invalid');
    clearDownload();
    status.textContent = '';
    syncGrant();
    showBudget();
  });
  form.addEventListener('change', syncGrant);
  form.addEventListener('draft-restored', () => {
    clearDownload(); errorsBox.hidden = true; status.textContent = '';
    syncGrant(); showBudget();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    clearDownload();
    errorsBox.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
    const data = values();
    const errors = core.validate(data, schema);
    if (errors.length) { showErrors(errors); return; }
    button.disabled = true;
    const format = formatSelect.value;
    status.textContent = `Preparing your contract ${format.toUpperCase()}…`;
    try {
      let blob, pageCount = null;
      if (format === 'pdf') {
        const result = await core.generate(data, schema, window.PDFLib); blob = new Blob([result.bytes], {type:'application/pdf'}); pageCount = result.pageCount;
      } else {
        const paragraphs = contractParagraphs(data);
        if (format === 'md') blob = new Blob([markdown(paragraphs)], {type:'text/markdown;charset=utf-8'});
        else if (format === 'rtf') blob = new Blob([rtf(paragraphs)], {type:'application/rtf'});
        else if (format === 'docx') blob = docx(paragraphs);
        else throw new Error('Choose a supported format.');
      }
      // Discard a stale result if the user changed the form during generation.
      if (JSON.stringify(values()) !== JSON.stringify(data)) {
        status.textContent = 'The form changed. Generate again to include your latest entries.';
        return;
      }
      url = URL.createObjectURL(blob);
      download.href = url;
      const reference = (data.reference || data.projectTitle || 'agreement').replace(/[^a-z0-9_-]/gi, '-').slice(0, 70);
      const extension = format === 'md' ? 'md' : format;
      download.download = `BIOracle-${reference}-draft.${extension}`;
      download.hidden = false;
      download.click();
      status.textContent = `${pageCount ? `Your ${pageCount}-page ` : 'Your '}contract draft is ready as ${extension.toUpperCase()}. If the download did not start, use the download link.`;
    } catch (error) {
      if (error.fields) showErrors(error.fields);
      status.textContent = error.fields ? 'Correct the indicated entries and generate again.' : `The ${format.toUpperCase()} could not be generated. Your entries are still here; please try again.`;
    } finally { button.disabled = false; }
  });
  syncGrant();
  showBudget();
  button.disabled = false;
})();
