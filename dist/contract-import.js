'use strict';

(() => {
  const form = document.getElementById('contract-form');
  const schema = JSON.parse(document.getElementById('contract-schema')?.textContent || '[]');
  const fileInput = document.getElementById('contract-source-files');
  const cloneButton = document.getElementById('contract-source-clone');
  const analyzeButton = document.getElementById('contract-source-analyze');
  const applyButton = document.getElementById('contract-source-apply');
  const suggestionsBox = document.getElementById('contract-source-suggestions');
  const status = document.getElementById('contract-source-status');
  const fileSummary = document.getElementById('contract-source-file-summary');
  const fileList = document.getElementById('contract-source-file-list');
  const cloneList = document.getElementById('contract-source-clones');
  if (!form || !fileInput || !window.BIOraclePDFReader) return;

  const MB = 1024 * 1024;
  const fields = schema.flatMap(group => group.fields);
  const fieldMap = new Map(fields.map(field => [field.name, field]));
  let suggestions = [];
  let selectedFiles = [];
  let clones = [];

  function clearSuggestions() {
    suggestions = [];
    suggestionsBox.replaceChildren();
    suggestionsBox.hidden = true;
    applyButton.disabled = true;
  }
  function refresh() {
    const pdfCount=selectedFiles.filter(file=>/\.pdf$/i.test(file.name)).length;
    cloneButton.hidden=!pdfCount;
    cloneButton.disabled=!pdfCount;
    analyzeButton.disabled=!selectedFiles.length||(pdfCount>0&&clones.length!==pdfCount);
    analyzeButton.textContent=pdfCount?'Extract information from RTF copies':'Extract information from documents';
  }
  function clearClones(){
    clones.forEach(item=>URL.revokeObjectURL(item.url));
    clones=[];cloneList.replaceChildren();cloneList.hidden=true;
  }
  function acceptedFiles(files) {
    const allowed = /\.(pdf|docx|rtf|txt|csv|xlsx)$/i;
    return files.length > 0 && files.length <= 5 && files.every(file => allowed.test(file.name));
  }

  function formatSize(bytes) { return bytes < 1024 * 1024 ? `${Math.max(1,Math.round(bytes/1024))} KB` : `${(bytes/1024/1024).toFixed(1)} MB`; }
  function renderFiles() {
    fileList.replaceChildren();
    selectedFiles.forEach((file,index) => {
      const item = document.createElement('li');
      const name = document.createElement('span'); name.textContent = `${file.name} · ${formatSize(file.size)}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-button';
      remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${file.name}`);
      remove.addEventListener('click', () => {
        selectedFiles.splice(index,1); clearSuggestions(); clearClones(); renderFiles();
        status.textContent = selectedFiles.length ? 'File removed. The remaining documents are ready for analysis.' : 'Choose a previous contract or supporting documents.';
        refresh();
      });
      item.append(name,remove); fileList.append(item);
    });
    const total = selectedFiles.reduce((sum,file)=>sum+file.size,0);
    fileSummary.textContent = `${selectedFiles.length} of 5 documents selected · ${formatSize(total)} of 5 MB`;
  }
  fileInput.addEventListener('change', () => {
    clearSuggestions();
    const incoming = [...(fileInput.files || [])];
    fileInput.value = '';
    if (!incoming.length) { refresh(); return; }
    const currentKeys = new Set(selectedFiles.map(file=>`${file.name}:${file.size}:${file.lastModified}`));
    const additions = incoming.filter(file=>!currentKeys.has(`${file.name}:${file.size}:${file.lastModified}`));
    const combined = [...selectedFiles,...additions];
    const total = combined.reduce((sum,file)=>sum+file.size,0);
    if (!acceptedFiles(combined)) {
      status.textContent = 'Choose up to 5 PDF, DOCX, RTF, TXT, CSV, or XLSX files.';
    } else if (total > 5 * MB) {
      status.textContent = 'The combined size must be 5 MB or less. The new selection was not added.';
    } else {
      clearClones();
      selectedFiles = combined;
      status.textContent = `${selectedFiles.length} document${selectedFiles.length === 1 ? '' : 's'} ready. Add more files or analyze them together.`;
    }
    renderFiles();
    refresh();
  });

  cloneButton.addEventListener('click',async()=>{
    const pdfs=selectedFiles.filter(file=>/\.pdf$/i.test(file.name));
    if(!pdfs.length)return;
    cloneButton.disabled=true;analyzeButton.disabled=true;clearClones();clearSuggestions();
    try{
      for(const [index,file] of pdfs.entries()){
        status.textContent=`Creating text RTF copy from ${file.name} (${index+1} of ${pdfs.length})…`;
        const parsed=await window.BIOraclePDFReader.readPdf(new Uint8Array(await file.arrayBuffer()),progress=>{status.textContent=`${file.name}: ${progress}`;});
        const rtf=window.BIOraclePDFReader.createRtfCopy(parsed.pages);
        const name=file.name.replace(/\.pdf$/i,'')+'.rtf';
        const url=URL.createObjectURL(new Blob([rtf],{type:'application/rtf;charset=utf-8'}));
        clones.push({sourceFile:file,name,rtf,url});
      }
      cloneList.replaceChildren();
      for(const clone of clones){
        const li=document.createElement('li');
        const link=document.createElement('a');link.href=clone.url;link.download=clone.name;link.textContent=`Download ${clone.name}`;
        li.append(link);cloneList.append(li);
      }
      cloneList.hidden=false;
      status.textContent='RTF text copies are ready. Review or download them above, then extract suggestions from the copies.';
    }catch(error){
      clearClones();status.textContent=error.message||'Could not create an RTF copy of one of the PDFs.';
    }finally{refresh();}
  });

  function currentValue(name) {
    const element = form.elements[name];
    return element && !element.disabled ? String(element.value || '').trim() : '';
  }

  function renderSuggestions(items) {
    clearSuggestions();
    const heading = document.createElement('h4'); heading.textContent = 'Review suggested form entries';
    const note = document.createElement('p'); note.textContent = 'Nothing is selected automatically. Check each value you want to use, edit it if needed, and apply only after reviewing the source line.';
    const list = document.createElement('div'); list.className = 'template-mapping-list';
    for (const [index, item] of items.entries()) {
      const field = fieldMap.get(item.field);
      if (!field) continue;
      const row = document.createElement('div'); row.className = 'contract-suggestion-row';
      const includeLabel = document.createElement('label'); includeLabel.className = 'template-placement-label';
      const include = document.createElement('input'); include.type = 'checkbox'; include.dataset.include = 'true';
      include.checked = item.confidence === 'high' && !item.conflict && !currentValue(field.name);
      item.include = include.checked;
      include.addEventListener('change', () => { item.include = include.checked; });
      const title = document.createElement('span'); title.textContent = `${field.label} · ${item.confidence} confidence${item.conflict ? ' · sources disagree' : ''}`;
      includeLabel.append(include, title);

      let editor;
      if (field.type === 'select') {
        editor = document.createElement('select');
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose…'; editor.append(empty);
        for (const [value, label] of field.options || []) { const option = document.createElement('option'); option.value = value; option.textContent = label; editor.append(option); }
      } else if (field.type === 'textarea') {
        editor = document.createElement('textarea'); editor.rows = 3; editor.maxLength = field.maxLength || 4000;
      } else {
        editor = document.createElement('input'); editor.type = 'text'; editor.maxLength = field.maxLength || (field.type === 'money' ? 12 : 200);
        if (field.type === 'money') editor.inputMode = 'decimal';
      }
      editor.value = item.value;
      editor.dataset.value = 'true';
      editor.setAttribute('aria-label', `Suggested value for ${field.label}`);
      const evidence = document.createElement('p'); evidence.className = 'contract-suggestion-evidence';
      evidence.textContent = `${item.sourceDocument}: “${item.evidence}”`;
      row.append(includeLabel, editor, evidence); list.append(row);
      item.editorIndex = index;
    }
    suggestionsBox.append(heading, note, list);
    suggestionsBox.hidden = false;
    applyButton.disabled = !suggestionsBox.querySelector('input[data-include]');
  }

  analyzeButton.addEventListener('click', async () => {
    const files = [...selectedFiles];
    if (!acceptedFiles(files) || files.reduce((sum, file) => sum + file.size, 0) > 5 * MB) {
      status.textContent = 'Choose up to five supported files with a combined size of 5 MB or less.'; return;
    }
    const pdfs=files.filter(file=>/\.pdf$/i.test(file.name));
    if(pdfs.length&&clones.length!==pdfs.length){status.textContent='Create the RTF copies first. Information is extracted from those copies.';return;}
    analyzeButton.disabled = true; clearSuggestions(); status.textContent = 'Preparing documents for analysis…';
    try {
      const documents=[];
      for(const [index,file] of files.entries()) {
        const clone=clones.find(item=>item.sourceFile===file);
        if(clone){
          status.textContent=`Extracting text from ${clone.name} (${index+1} of ${files.length})…`;
          documents.push({...window.BIOraclePDFReader.readRtf(clone.rtf),name:clone.name});
          continue;
        }
        status.textContent = `Reading ${file.name} (${index+1} of ${files.length}) in this browser…`;
        const result=await window.BIOraclePDFReader.readFile(file,progress=>{status.textContent=`${file.name}: ${progress}`;});
        documents.push({...result,name:file.name});
      }
      suggestions = window.BIOraclePDFReader.extractSuggestions(documents,fields).filter(item => {
        const field = fieldMap.get(item.field);
        return field && typeof item.value === 'string' && item.value.length <= (field.maxLength || 4000) &&
          ['high','medium','low'].includes(item.confidence) && typeof item.sourceDocument === 'string' &&
          typeof item.evidence === 'string' && item.evidence.length <= 500 && typeof item.conflict === 'boolean' &&
          (field.type !== 'select' || field.options?.some(([value]) => value === item.value));
      });
      if (!suggestions.length) throw new Error('No clear field values were found. Try a different or more complete document.');
      renderSuggestions(suggestions);
      status.textContent = `Found ${suggestions.length} possible form entr${suggestions.length === 1 ? 'y' : 'ies'} on this device. Review and select values to apply.`;
    } catch (error) {
      clearSuggestions(); status.textContent = error.message || 'Unable to analyze these documents. Please try again.';
    } finally { refresh(); }
  });

  applyButton.addEventListener('click', () => {
    const rows = [...suggestionsBox.querySelectorAll('.contract-suggestion-row')];
    let applied = 0;
    for (const row of rows) {
      if (!row.querySelector('input[data-include]')?.checked) continue;
      const item = suggestions.find(value => value.editorIndex === rows.indexOf(row));
      const editor = row.querySelector('[data-value]');
      const target = item && form.elements[item.field];
      if (!item || !editor || !target || target.disabled) continue;
      target.value = editor.value;
      target.dispatchEvent(new Event('input', {bubbles:true}));
      target.dispatchEvent(new Event('change', {bubbles:true}));
      applied++;
    }
    status.textContent = applied ? `Applied ${applied} suggestion${applied === 1 ? '' : 's'}. Sign in to save the updated form to your account.` : 'No suggestions were selected.';
  });
  refresh();
})();
