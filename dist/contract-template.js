'use strict';

(() => {
  const form = document.getElementById('contract-form');
  const schema = JSON.parse(document.getElementById('contract-schema').textContent);
  const fileInput = document.getElementById('contract-template-file');
  const mapButton = document.getElementById('contract-template-map');
  const previewButton = document.getElementById('contract-template-preview-button');
  const fillButton = document.getElementById('contract-template-fill');
  const mappingsBox = document.getElementById('contract-template-mappings');
  const status = document.getElementById('contract-template-status');
  const download = document.getElementById('contract-template-download');
  const preview = document.getElementById('contract-template-preview');
  if (!form || !window.PDFLib || !window.BIOraclePDFReader) return;

  const sourceFields = schema.flatMap(group => group.fields.map(field => ({name:field.name,label:field.label})));
  let pdfBytes = null, placements = [], formSnapshot = '', downloadUrl = null, previewUrl = null, previewStale = true, analysisStale = false;
  const contractValues = () => Object.fromEntries(sourceFields.map(({name}) => [name, form.elements[name]?.disabled ? '' : (form.elements[name]?.value || '')]));
  function refresh() {
    mapButton.disabled = !fileInput.files?.length;
    previewButton.disabled = !pdfBytes || !placements.length || analysisStale;
    fillButton.disabled = !downloadUrl || previewStale;
  }
  function clearBlob(url) { if (url) URL.revokeObjectURL(url); }
  function clearResult() {
    placements = []; pdfBytes = null; formSnapshot = ''; previewStale = true; analysisStale = false;
    mappingsBox.replaceChildren(); mappingsBox.hidden = true;
    preview.hidden = true; preview.removeAttribute('src');
    clearBlob(previewUrl); previewUrl = null;
    clearBlob(downloadUrl); downloadUrl = null; download.hidden = true; download.removeAttribute('href');
    previewButton.disabled = true; fillButton.disabled = true;
  }
  fileInput.addEventListener('change', () => {
    clearResult();
    const file = fileInput.files?.[0];
    if (!file) { status.textContent = 'Choose a PDF contract to continue.'; refresh(); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) { fileInput.value = ''; status.textContent = 'Choose a PDF file.'; refresh(); return; }
    if (file.size > 5 * 1024 * 1024) { fileInput.value = ''; status.textContent = 'The PDF must be smaller than 5 MB.'; refresh(); return; }
    status.textContent = 'PDF selected. It will be read in this browser and will not be uploaded.'; refresh();
  });
  function invalidatePreview() {
    if (placements.length && JSON.stringify(contractValues()) !== formSnapshot) {
      analysisStale = true; previewStale = true; previewButton.disabled = true; fillButton.disabled = true;
      status.textContent = 'The webpage answers changed. Analyze the PDF again before filling it.';
      return;
    }
    if (placements.length && mappingsBox.querySelectorAll('select[data-source],input[data-include]').length) {
      previewStale = true; fillButton.disabled = true;
      status.textContent = 'Update the preview to review your selected changes.';
    }
  }
  form.addEventListener('input', invalidatePreview);
  form.addEventListener('change', invalidatePreview);

  function renderPlacements() {
    mappingsBox.replaceChildren();
    const heading = document.createElement('h4'); heading.textContent = 'Review suggested placements'; mappingsBox.append(heading);
    const note = document.createElement('p'); note.textContent = 'Nothing is selected automatically. Check each placement you want to use, choose the matching answer, then preview the result. Signature lines are not filled.'; mappingsBox.append(note);
    const list = document.createElement('div'); list.className = 'template-mapping-list';
    for (const [index, item] of placements.entries()) {
      const row = document.createElement('div'); row.className = 'template-mapping-row';
      const title = document.createElement('div'); title.className = 'template-placement-label';
      const include = document.createElement('input'); include.type = 'checkbox'; include.dataset.include = 'true'; include.checked = item.confidence === 'high';
      include.addEventListener('change', () => { item.include = include.checked; markPreviewStale(); });
      const description = document.createElement('span'); description.textContent = `${item.fieldLabel || 'Suggested entry'} · page ${item.page + 1} · ${item.confidence} confidence`;
      title.append(include, description);
      const select = document.createElement('select'); select.dataset.source = 'true'; select.setAttribute('aria-label', `Value for suggested entry ${index + 1}`);
      for (const source of sourceFields) {
        if (!String(contractValues()[source.name] || '').trim()) continue;
        const option = document.createElement('option'); option.value = source.name; option.textContent = source.label;
        option.selected = item.source === source.name; select.append(option);
      }
      select.addEventListener('change', () => { item.source = select.value; markPreviewStale(); });
      row.append(title, select); list.append(row);
    }
    mappingsBox.append(list); mappingsBox.hidden = false;
    refresh();
  }
  function markPreviewStale() {
    previewStale = true; fillButton.disabled = true;
    status.textContent = 'Update the preview to review your selected changes.';
  }

  mapButton.addEventListener('click', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    mapButton.disabled = true; clearResult(); status.textContent = 'Checking the PDF and preparing your answers…';
    try {
      const raw = new Uint8Array(await file.arrayBuffer());
      const pdf = await window.PDFLib.PDFDocument.load(raw, {updateMetadata:false});
      const pageCount = pdf.getPageCount();
      if (pageCount > 20) throw new Error('For browser performance, the PDF must have 20 pages or fewer.');
      const answers = sourceFields.map(field => ({name:field.name,label:field.label,value:String(contractValues()[field.name] || '').trim()})).filter(field => field.value);
      if (!answers.length) throw new Error('Enter some contract details in the webpage form first.');
      pdfBytes = raw; formSnapshot = JSON.stringify(contractValues());
      status.textContent = 'Reading labels and finding likely answer areas on this device…';
      const readResult = await window.BIOraclePDFReader.readPdf(raw,progress=>{status.textContent=progress;});
      const pageInfo = pdf.getPages().map(page => {
        const size = page.getSize();
        return {width:size.width,height:size.height,rotation:((page.getRotation().angle % 360) + 360) % 360};
      });
      placements = window.BIOraclePDFReader.mapAnswersToPdf(readResult.pages,answers,sourceFields).filter(item =>
        Number.isInteger(item.page) && item.page >= 0 && item.page < pageCount &&
        answers.some(answer => answer.name === item.source) &&
        [item.x,item.y,item.width,item.height].every(Number.isInteger) &&
        item.x >= 0 && item.y >= 0 && item.width > 0 && item.height > 0 && item.x + item.width <= 10000 && item.y + item.height <= 10000 &&
        ['high','medium','low'].includes(item.confidence)
      ).map(item => ({...item,include:item.confidence === 'high'}));
      if (!placements.length) throw new Error('No likely answer areas were found. Try a text-based PDF with clearly labeled fields, or enter answers manually in the form.');
      // Keep the uploaded page geometry so later placement cannot reference a non-existent page.
      placements = placements.filter(item => item.page < pageInfo.length);
      analysisStale = false;
      renderPlacements();
      status.textContent = `Found ${placements.length} possible placements on this device. Review them, then preview the filled copy.`;
    } catch (error) {
      clearResult(); status.textContent = error.message || 'Unable to analyze this PDF. Please try another document.';
    } finally { refresh(); }
  });

  function wrapText(value, font, size, maxWidth) {
    const lines = [];
    for (const paragraph of String(value).replace(/\r\n?/g,'\n').split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (!line) { line = word; continue; }
        if (font.widthOfTextAtSize(`${line} ${word}`, size) <= maxWidth) line += ` ${word}`;
        else { lines.push(line); line = word; }
      }
      if (line) lines.push(line);
      if (!paragraph.trim()) lines.push('');
    }
    return lines;
  }
  function nativeBox(page, item) {
    const {width:pageW,height:pageH} = page.getSize();
    const angle = ((page.getRotation().angle % 360) + 360) % 360;
    if (![0,90,180,270].includes(angle)) throw new Error('A PDF page has an unsupported rotation.');
    const swapped = angle === 90 || angle === 270;
    const viewW = swapped ? pageH : pageW, viewH = swapped ? pageW : pageH;
    const u = item.x / 10000 * viewW, v = item.y / 10000 * viewH;
    const w = item.width / 10000 * viewW, h = item.height / 10000 * viewH;
    if (angle === 90) return {x:v+h,y:u,width:h,height:w,rotate:90,fitWidth:w,fitHeight:h};
    if (angle === 180) return {x:pageW-u,y:v+h,width:w,height:h,rotate:180,fitWidth:w,fitHeight:h};
    if (angle === 270) return {x:pageW-v-h,y:pageH-u,width:h,height:w,rotate:270,fitWidth:w,fitHeight:h};
    return {x:u,y:pageH-v-h,width:w,height:h,rotate:0,fitWidth:w,fitHeight:h};
  }
  async function makeFilledPdf() {
    const {PDFDocument,StandardFonts,rgb,degrees} = window.PDFLib;
    const doc = await PDFDocument.load(pdfBytes, {updateMetadata:false});
    const pages = doc.getPages();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const rows = [...mappingsBox.querySelectorAll('.template-mapping-row')];
    for (const [index,row] of rows.entries()) {
      const include = row.querySelector('input[data-include]')?.checked;
      const source = row.querySelector('select[data-source]')?.value;
      if (!include || !source) continue;
      const item = placements[index], page = pages[item.page];
      if (!page) continue;
      const text = String(contractValues()[source] || '').trim();
      if (!text) continue;
      const box = nativeBox(page,item);
      let chosen = null, lines = null;
      for (let size = Math.min(11, box.fitHeight * 0.7); size >= 4.5; size -= 0.5) {
        const candidate = wrapText(text,font,size,Math.max(5,box.fitWidth-4));
        if (candidate.length * size * 1.18 <= box.fitHeight && candidate.every(line => font.widthOfTextAtSize(line,size) <= box.fitWidth-3)) { chosen=size; lines=candidate; break; }
      }
      if (chosen === null) throw new Error(`“${sourceFields.find(field=>field.name===source)?.label || source}” does not fit in its selected space. Leave it unchecked or shorten that answer.`);
      page.drawText(lines.join('\n'), {x:box.x+2,y:box.y+1,size:chosen,font,color:rgb(.08,.1,.09),lineHeight:chosen*1.18,rotate:degrees(box.rotate),maxWidth:box.fitWidth-3});
    }
    return await doc.save();
  }

  previewButton.addEventListener('click', async () => {
    if (!pdfBytes) return;
    previewButton.disabled = true; fillButton.disabled = true; status.textContent = 'Preparing the filled PDF preview…';
    try {
      if (![...mappingsBox.querySelectorAll('input[data-include]')].some(input => input.checked)) throw new Error('Select at least one placement to fill.');
      const bytes = await makeFilledPdf();
      clearBlob(previewUrl); clearBlob(downloadUrl);
      previewUrl = URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      downloadUrl = previewUrl;
      preview.src = previewUrl; preview.hidden = false;
      const project = String(contractValues().reference || contractValues().projectTitle || 'agreement').replace(/[^a-z0-9_-]/gi,'-').slice(0,70);
      download.href = previewUrl; download.download = `BIOracle-${project}-filled.pdf`; download.hidden = false;
      previewStale = false; fillButton.disabled = false;
      status.textContent = 'Preview ready. Review every page and click Download filled PDF when it looks right.';
    } catch (error) {
      previewStale = true; clearBlob(downloadUrl); downloadUrl = null; download.hidden = true;
      status.textContent = error.message || 'The preview could not be prepared. Adjust the selections and try again.';
    } finally { refresh(); }
  });
  fillButton.addEventListener('click', () => {
    if (!downloadUrl || previewStale) return;
    download.click();
  });
  refresh();
})();
