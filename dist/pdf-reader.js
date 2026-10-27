'use strict';

(() => {
  const aliases = {
    reference:['agreement number','contract number','contract no','reference number','contract id','solicitation number','document number'],
    projectTitle:['project name','title of project','study title','research title','project description title'],
    effectiveDate:['agreement date','date of agreement','execution date','date signed'],
    startDate:['project commencement','commencement date','period of performance start','performance start date'],
    endDate:['project end','completion date','period of performance end','performance end date'],
    awardId:['grant number','award number','award id','funding opportunity number','sponsor award number'],
    awardTerms:['award conditions','grant conditions','terms and conditions of award'],
    providerName:['provider legal name','university legal name','contractor legal name','performer legal entity','subrecipient legal name','service provider name'],
    sponsorName:['sponsor legal name','client legal name','customer legal name','funding organization','funding agency','recipient organization','recipient legal name','lead organization','performing organization','institution name'],
    providerAddress:['provider address','contractor address','university address','performer address','subrecipient address'],
    sponsorAddress:['sponsor address','client address','recipient address','institution address'],
    providerSigner:['provider signatory','contractor signatory','authorized representative provider'],
    sponsorSigner:['sponsor signatory','client signatory','authorized representative sponsor'],
    providerTitle:['provider title','contractor title','provider representative title'], sponsorTitle:['sponsor title','client title','sponsor representative title'],
    providerEmail:['provider email','contractor email','provider contact email'], sponsorEmail:['sponsor email','client email','recipient contact email'],
    scope:['scope of work','statement of work','services to be performed','project description','research plan','technical approach','work to be performed'],
    deliverables:['project deliverables','required deliverables','products and deliverables'], milestones:['project milestones','milestone schedule','deliverable schedule'],
    acceptance:['acceptance criteria','review and acceptance','deliverable acceptance'], clientInputs:['client responsibilities','sponsor responsibilities','sponsor furnished resources','customer dependencies'],
    currency:['project currency','currency code'], totalBudget:['total amount','total award','total funding','contract amount','total cost','estimated total costs','total project costs'],
    studentBudget:['student support','graduate student support','student stipend allocation'], researchBudget:['research team allocation','personnel allocation','investigator compensation'],
    directBudget:['direct costs','other direct costs','project expenses'], adminBudget:['indirect costs','overhead','administrative costs','facilities and administration'],
    paymentSchedule:['payment terms','payment schedule','disbursement schedule','invoicing schedule'], invoiceDays:['payment due','net days','payment deadline'],
    academicSupervisor:['principal investigator','faculty supervisor','scientific lead'], studentPlan:['student support plan','graduate student plan','student appointments'],
    governingLaw:['governing law','applicable law','choice of law'], disputeForum:['venue','jurisdiction','dispute resolution forum'], ipDetails:['intellectual property','ownership of intellectual property','inventions and patents'],
    publicationTerms:['publication rights','publication and thesis rights','publications and publicity'], dataTerms:['data protection','data handling','privacy and security','information security'],
    terminationDays:['termination notice','notice of termination'], cureDays:['cure period','cure notice period'], liabilityCap:['limitation of liability','liability limit','maximum liability'], specialTerms:['additional terms','special provisions','other conditions']
  };
  const normalize = value => String(value || '').replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const fieldTerms = field => [...new Set([field.label, field.name, ...(aliases[field.name] || [])])].sort((a,b)=>b.length-a.length);
  function termSpan(text,term){
    const words=normalize(term).split(' ').filter(Boolean);
    if(!words.length)return null;
    const pattern=words.map(esc).join('[^a-z0-9]+');
    return String(text).match(new RegExp(`(?:^|[^a-z0-9])(${pattern})(?=$|[^a-z0-9])`,'i'));
  }
  function termScore(text,term){
    if(termSpan(text,term))return 100+normalize(term).length;
    const wanted=normalize(term).split(' ').filter(word=>word.length>2);
    if(wanted.length<2)return 0;
    const actual=new Set(normalize(text).split(' '));
    const overlap=wanted.filter(word=>actual.has(word)).length/wanted.length;
    return overlap>=.8?60+overlap*10+Math.min(wanted.length,6):0;
  }
  function bestTerm(text,field){
    let best=null;
    for(const term of fieldTerms(field)){
      const score=termScore(text,term);
      if(score&&(!best||score>best.score))best={term,score,match:termSpan(text,term)};
    }
    return best;
  }

  let tesseractPromise;
  const loadedScripts = new Map();
  function loadScript(src, globalName) {
    if(window[globalName]) return Promise.resolve(window[globalName]);
    if(!loadedScripts.has(src)) loadedScripts.set(src,new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=src;
      script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error('A document reader could not start.'));
      script.onerror=()=>reject(new Error('Could not load a free document reader. Check your internet connection and try again.'));
      document.head.append(script);
    }));
    return loadedScripts.get(src);
  }
  async function loadTesseract() {
    if (!tesseractPromise) tesseractPromise = new Promise((resolve,reject) => {
      if (window.Tesseract) { resolve(window.Tesseract); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.0/dist/tesseract.min.js';
      script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('The local OCR library could not start. Check your internet connection and try again.'));
      script.onerror = () => reject(new Error('Could not load the free OCR library. Check your internet connection and try again.'));
      document.head.append(script);
    });
    return tesseractPromise;
  }
  let workerPromise;
  async function getOcrWorker(onProgress) {
    if (!workerPromise) workerPromise = (async () => {
      const Tesseract = await loadTesseract();
      return Tesseract.createWorker('eng', 1, {
        workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.0/dist/worker.min.js',
        corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.0.0',
        langPath:'https://tessdata.projectnaptha.com/4.0.0',
        logger: message => { if (message.status === 'recognizing text') onProgress?.(Math.round((message.progress || 0)*100)); }
      });
    })();
    return workerPromise;
  }

  function textBlocks(items, viewport) {
    const blocks=[];
    for (const item of items) {
      if (!item.str?.trim() || !item.transform) continue;
      const transform = window.pdfjsLib.Util.transform(viewport.transform,item.transform);
      const height = Math.max(5,Math.hypot(transform[2],transform[3]));
      const block={text:item.str.trim(),x:transform[4],y:transform[5]-height,width:Math.max(2,item.width||height),height};
      let row=blocks.find(entry=>Math.abs(entry.y-block.y)<Math.max(4,height*.55));
      if (!row) { row={text:'',x:block.x,y:block.y,width:0,height:block.height,items:[]}; blocks.push(row); }
      row.items.push(block);
    }
    for(const row of blocks){
      row.items.sort((a,b)=>a.x-b.x);
      row.text=row.items.map(item=>item.text).join(' ').replace(/\s+/g,' ').trim();
      row.x=Math.min(...row.items.map(item=>item.x));
      const right=Math.max(...row.items.map(item=>item.x+item.width)); row.width=right-row.x;
      row.height=Math.max(...row.items.map(item=>item.height));
      row.runs=row.items;
      delete row.items;
    }
    return blocks.sort((a,b)=>a.y-b.y||a.x-b.x);
  }

  async function readPdf(bytes, onProgress) {
    if (!window.pdfjsLib) throw new Error('The free PDF reader did not load. Reload the page and try again.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const task=window.pdfjsLib.getDocument({data:bytes});
    const pdf=await task.promise;
    if(pdf.numPages>20) throw new Error('For browser performance, choose a PDF with 20 pages or fewer.');
    const pages=[];
    for(let n=1;n<=pdf.numPages;n++){
      onProgress?.(`Reading page ${n} of ${pdf.numPages}…`);
      const page=await pdf.getPage(n), viewport=page.getViewport({scale:1});
      const content=await page.getTextContent();
      let blocks=textBlocks(content.items,viewport);
      const annotations=await page.getAnnotations({intent:'display'});
      const formFields=annotations.filter(item=>item.fieldName&&item.rect&&item.fieldType==='Tx'&&!String(item.fieldValue||'').trim()).map(item=>{
        const rect=viewport.convertToViewportRectangle(item.rect);
        const x=Math.min(rect[0],rect[2]),y=Math.min(rect[1],rect[3]);
        const width=Math.abs(rect[2]-rect[0]),height=Math.abs(rect[3]-rect[1]);
        return {name:item.fieldName,x:Math.round(x/viewport.width*10000),y:Math.round(y/viewport.height*10000),width:Math.round(width/viewport.width*10000),height:Math.round(height/viewport.height*10000)};
      });
      const textLength=blocks.map(b=>b.text).join(' ').replace(/\s/g,'').length;
      if(textLength<18){
        const worker=await getOcrWorker(onProgress);
        const scale=Math.min(1.7,Math.max(1.2,1400/viewport.width));
        const ocrView=page.getViewport({scale});
        const canvas=document.createElement('canvas'); canvas.width=Math.ceil(ocrView.width); canvas.height=Math.ceil(ocrView.height);
        const context=canvas.getContext('2d',{willReadFrequently:true});
        await page.render({canvasContext:context,viewport:ocrView}).promise;
        const result=await worker.recognize(canvas);
        blocks=(result.data.lines||[]).map(line=>({
          text:line.text.trim(),x:line.bbox.x0/scale,y:line.bbox.y0/scale,
          width:(line.bbox.x1-line.bbox.x0)/scale,height:(line.bbox.y1-line.bbox.y0)/scale
        })).filter(line=>line.text);
        canvas.width=canvas.height=0;
      }
      pages.push({width:viewport.width,height:viewport.height,blocks,formFields});
    }
    return {pages,text:pages.map(page=>page.blocks.map(block=>block.text).join('\n')).join('\n')};
  }

  function rtfEscape(value){
    let out='';
    for(const char of String(value)){
      const code=char.codePointAt(0);
      if(char==='\\'||char==='{'||char==='}')out+='\\'+char;
      else if(char==='\n')out+='\\line ';
      else if(char==='\r')continue;
      else if(code>=32&&code<=126)out+=char;
      else{
        const units=code>0xffff?[0xd800+((code-0x10000)>>10),0xdc00+((code-0x10000)&0x3ff)]:[code];
        out+=units.map(unit=>`\\u${unit>32767?unit-65536:unit}?`).join('');
      }
    }
    return out;
  }
  function createRtfCopy(pages){
    const body=pages.flatMap((page,index)=>[
      `PDF text copy · Page ${index+1}`,
      ...page.blocks.map(block=>block.text).filter(Boolean)
    ]).map(rtfEscape).join('\\par\n');
    return `{\\rtf1\\ansi\\deff0\\uc1{\\fonttbl{\\f0 Arial;}}\\viewkind4\\f0\\fs20 ${body}}`;
  }
  function readRtf(rtf){
    const text=String(rtf)
      .replace(/\\u(-?\d+)\??/g,(_,value)=>String.fromCharCode((Number(value)+65536)%65536))
      .replace(/\\'([0-9a-f]{2})/gi,(_,value)=>String.fromCharCode(parseInt(value,16)))
      .replace(/\\(?:par|line|page)\b ?/gi,'\n')
      .replace(/\\tab\b ?/gi,'\t')
      .replace(/\\([{}\\])/g,'$1')
      .replace(/\\[a-z]+-?\d* ?/gi,'')
      .replace(/[{}]/g,'')
      .replace(/\r/g,'');
    const lines=text.split('\n').map((value,index)=>({text:value.trim(),x:0,y:index*14,width:1000,height:12})).filter(line=>line.text);
    return {text:lines.map(line=>line.text).join('\n'),pages:[{width:1000,height:Math.max(800,lines.length*14),blocks:lines}]};
  }

  async function readFile(file,onProgress){
    if(/\.pdf$/i.test(file.name)||file.type==='application/pdf') return readPdf(new Uint8Array(await file.arrayBuffer()),onProgress);
    if(/\.rtf$/i.test(file.name))return readRtf(await file.text());
    if(/\.(txt|csv)$/i.test(file.name)){
      let text=await file.text();
      const lines=text.split(/\r?\n/).map((value,index)=>({text:value.trim(),x:0,y:index*14,width:1000,height:12})).filter(line=>line.text);
      return {text:lines.map(line=>line.text).join('\n'),pages:[{width:1000,height:Math.max(800,lines.length*14),blocks:lines}]};
    }
    if(/\.docx$/i.test(file.name)){
      const mammoth=await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.9.0/mammoth.browser.min.js','mammoth');
      const result=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
      const lines=result.value.split(/\r?\n/).map((value,index)=>({text:value.trim(),x:0,y:index*14,width:1000,height:12})).filter(line=>line.text);
      return {text:result.value,pages:[{width:1000,height:Math.max(800,lines.length*14),blocks:lines}]};
    }
    if(/\.xlsx$/i.test(file.name)){
      const XLSX=await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array'});
      const lines=workbook.SheetNames.flatMap(name=>XLSX.utils.sheet_to_csv(workbook.Sheets[name]).split(/\r?\n/).map(value=>`${name}: ${value}`)).map((value,index)=>({text:value.trim(),x:0,y:index*14,width:1000,height:12})).filter(line=>line.text);
      return {text:lines.map(line=>line.text).join('\n'),pages:[{width:1000,height:Math.max(800,lines.length*14),blocks:lines}]};
    }
    throw new Error('This browser reader supports PDF, DOCX, RTF, TXT, CSV, and XLSX files. Legacy DOC files must be converted first.');
  }

  function candidateValue(blocks,index,field){
    const line=blocks[index].text;
    const match=bestTerm(line,field);
    if(!match) return null;
    const found=match.match;
    const end=found?found.index+found[0].length:line.length;
    let value=found?line.slice(end).replace(/^\s*(?:[:#=–—-]\s*)?/,'').trim():'';
    value=value.replace(/\s+(?:page|section)\s+\d+\s*$/i,'').replace(/[|•]+$/,'').trim();
    if(!value){
      const next=blocks[index+1];
      if(next && next.y-blocks[index].y < Math.max(55,blocks[index].height*4) && !fieldsAnyMatch(next.text)) value=next.text.trim();
    }
    if(field.type==='select'&&value){
      const option=(field.options||[]).find(([key,label])=>normalize(value).includes(normalize(label))||normalize(value)===normalize(key));
      if(option)value=option[0];
    }
    if(!value||normalize(value)===normalize(match.term)||value.length> (field.maxLength||1000))return null;
    return {value,term:match.term};
  }
  let knownFields=[];
  function fieldsAnyMatch(line){return knownFields.some(field=>bestTerm(line,field));}
  function extractSuggestions(documents,fields){
    knownFields=fields;
    const found=[];
    for(const doc of documents){
      const blocks=doc.pages.flatMap(page=>page.blocks);
      for(const field of fields){
        for(let i=0;i<blocks.length;i++){
          const candidate=candidateValue(blocks,i,field); if(!candidate)continue;
      found.push({field:field.name,value:candidate.value,confidence:'medium',sourceDocument:doc.name,evidence:blocks[i].text.slice(0,400),conflict:false});
        }
      }
    }
    const groups=new Map();
    for(const item of found){const prior=groups.get(item.field)||[];prior.push(item);groups.set(item.field,prior);}
    const output=[];
    for(const group of groups.values()){
      const distinct=new Set(group.map(item=>normalize(item.value)));
      const conflict=distinct.size>1;
      for(const item of (conflict?group:group.slice(0,1)))output.push({...item,conflict,confidence:'medium'});
    }
    return output;
  }

  function mapAnswersToPdf(pages,answers,fields){
    const known=new Map(fields.map(field=>[field.name,field]));
    const placements=[];
    for(const [pageIndex,page] of pages.entries()){
      for(const widget of page.formFields||[]){
        const ranked=answers.map(answer=>({answer,field:known.get(answer.name)})).filter(item=>item.field).map(item=>({...item,match:bestTerm(widget.name,item.field)})).filter(item=>item.match&&item.match.score>=60).sort((a,b)=>b.match.score-a.match.score);
        if(!ranked.length||(ranked[1]&&ranked[1].match.score===ranked[0].match.score))continue;
        const {answer,field}=ranked[0];
        placements.push({page:pageIndex,source:answer.name,fieldLabel:field.label,fieldName:widget.name,confidence:ranked[0].match.score>=100?'high':'medium',x:widget.x,y:widget.y,width:widget.width,height:widget.height});
      }
    }
    for(const answer of answers){
      if(placements.some(item=>item.source===answer.name))continue;
      const field=known.get(answer.name); if(!field)continue;
      const terms=fieldTerms(field);
      for(const [pageIndex,page] of pages.entries()){
        for(let i=0;i<page.blocks.length;i++){
          const block=page.blocks[i];
          const matched=bestTerm(block.text,field);
          if(!matched)continue;
          const match=matched.match; if(!match)continue;
          const term=matched.term;
          const run=block.runs?.find(item=>termSpan(item.text,term));
          const runMatch=run&&termSpan(run.text,term);
          const labelRight=run&&runMatch
            ? run.x+run.width*Math.min(1,(runMatch.index+runMatch[0].length)/Math.max(1,run.text.length))
            : block.x+block.width*Math.min(1,(match.index+match[0].length)/Math.max(1,block.text.length));
          if(run&&runMatch){
            const remainder=run.text.slice(runMatch.index+runMatch[0].length).replace(/[\s:;#=–—._-]+/g,'');
            if(remainder.length>1)continue;
          }
          const sameLineRuns=(block.runs||[]).filter(item=>item.x>labelRight+3);
          const nextX=sameLineRuns.length?Math.min(...sameLineRuns.map(item=>item.x)):page.width-24;
          let x=labelRight+5,y=block.y,width=Math.min(page.width-x-18,nextX-x-3),height=Math.max(12,block.height*1.5);
          if(width<48){
            const below=page.blocks.filter(other=>other.y>block.y+block.height&&other.y-block.y<55).sort((a,b)=>a.y-b.y)[0];
            if(below)continue;
            x=block.x;y=block.y+block.height+4;width=Math.min(page.width-x-24,block.width+100);height=Math.max(13,block.height*1.5);
          }
          if(width<35||height<8)continue;
          placements.push({page:pageIndex,source:answer.name,fieldLabel:field.label,confidence:'medium',x:Math.round(x/page.width*10000),y:Math.round(y/page.height*10000),width:Math.round(width/page.width*10000),height:Math.round(height/page.height*10000)});
          break;
        }
        if(placements.some(item=>item.source===answer.name&&item.page===pageIndex))break;
      }
    }
    return placements;
  }

  window.BIOraclePDFReader={readFile,readPdf,createRtfCopy,readRtf,extractSuggestions,mapAnswersToPdf};
})();
