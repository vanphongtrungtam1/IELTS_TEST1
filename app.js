'use strict';
const $=id=>document.getElementById(id), EXAM=window.EXAM;
const LIMITS={listening:32*60,reading:60*60,writing:60*60,speaking:14*60};
const LABELS={listening:'Listening',reading:'Academic Reading',writing:'Academic Writing',speaking:'Speaking Practice'};
let reviewOpen=false, googleSubmitted=false, speakingUploaded=false, submissionIdForPage='', uploadActive=false;
let section='',part=0,seconds=0,timer=null,finished=false,answers={},flags={},candidate='',zoom=1,recording=null,mediaRecorder=null,recordParts=[],recordings={},recordingPart=0,recordStart=0,recordTicker=null,recordStopPromise=null; const ORDER=['listening','reading','writing','speaking'];
const storage='cfl-ielts-mock01-v1';
let activeQuestion=1, writingLeft=50;
const audioPositions=[0,0,0,0];
let loadedAudioPart=-1;
const audioPlayer=$('audio-player');

function readSaved(){try{return JSON.parse(localStorage.getItem(storage)||'{}')}catch{return {}}}
function save(){let s=readSaved();s.candidate=candidate;if(section){s[section]={answers,flags,part,seconds,finished};}try{localStorage.setItem(storage,JSON.stringify(s))}catch(e){console.warn('Local storage unavailable',e)}}
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pad(n){return String(n).padStart(2,'0')}
function renderClock(){if(!section){$('clock').textContent='--:--';return;}$('clock').textContent=pad(Math.floor(seconds/60))+':'+pad(seconds%60);$('clock').style.color=seconds<300?'#ffcd75':'white'}
function startTimer(){clearInterval(timer);timer=setInterval(()=>{if(finished)return;seconds=Math.max(0,seconds-1);renderClock();if(seconds%5===0)save();if(seconds===0)submit(true)},1000)}
function welcome(){clearInterval(timer);section='';finished=false;$('welcome').hidden=false;$('exam').hidden=true;$('result').hidden=true;$('final-review').hidden=true;reviewOpen=false;$('speaking-controls').hidden=true;$('listening-audio-bar').hidden=true;$('exam').dataset.skill='';audioPlayer.pause();renderClock();$('candidate').value=readSaved().candidate||'';$('candidate-label').textContent='IELTS Mock Test 01';}
function renderTabs(){const pos=ORDER.indexOf(section);$('skill-tabs').innerHTML=ORDER.map((k,i)=>`<div class="skill-tab ${i===pos?'active':''} ${i<pos?'completed':''}"><span class="skill-long">${i+1}. ${LABELS[k]}</span><span class="skill-short">${['Listening','Reading','Writing','Speaking'][i]}</span>${i<pos?' ✓':''}</div>`).join('')}
function start(k='listening'){candidate=$('candidate').value.trim()||candidate;if(!candidate){alert('Please enter your full name.');$('candidate').focus();return}section=k;const s=readSaved()[k]||{};answers=s.answers||{};flags=s.flags||{};part=Math.max(0,Math.min(s.part||0,k==='listening'?3:k==='reading'?2:k==='writing'?1:2));seconds=s.seconds===undefined?LIMITS[k]:s.seconds;finished=false;$('welcome').hidden=true;$('result').hidden=true;$('final-review').hidden=true;reviewOpen=false;$('exam').hidden=false;$('speaking-controls').hidden=k!=='speaking';$('listening-audio-bar').hidden=k!=='listening';$('exam').dataset.skill=k;activeQuestion=k==='listening'||k==='reading'?rangeFor(k,part)[0]:part+1;if(k==='listening')loadedAudioPart=-1;else audioPlayer.pause();$('candidate-label').textContent=candidate;$('section-title').textContent=LABELS[k];$('section-subtitle').textContent=k==='listening'?' · 4 parts / 40 questions':k==='reading'?' · 3 passages / 40 questions':k==='writing'?' · 2 tasks':' · 3 parts';$('highlight-btn').style.display=k==='reading'?'':'none';$('submit-btn').textContent=k==='speaking'?'SAVE & REVIEW →':'SAVE & NEXT →';renderTabs();renderClock();render();startTimer();save()}
function parts(){let d=EXAM.sections[section];if(section==='listening'){let bounds=[7,26,45,81,99];return bounds.slice(0,4).map((v,i)=>d.filter(x=>x.index>=v&&x.index<bounds[i+1]))}if(section==='reading'){let bounds=[102,145,180,214];return bounds.slice(0,3).map((v,i)=>d.filter(x=>x.index>=v&&x.index<bounds[i+1]))}if(section==='writing'){return [d.filter(x=>x.index>=217&&x.index<223),d.filter(x=>x.index>=223)]}return [d.filter(x=>x.index>=232&&x.index<251),d.filter(x=>x.index>=251&&x.index<261),d.filter(x=>x.index>=261)]}
function rangeFor(skill,index){return skill==='listening'?[[1,10],[11,20],[21,30],[31,40]][index]:skill==='reading'?[[1,13],[14,26],[27,40]][index]:[1,skill==='writing'?2:3]}
function range(){return rangeFor(section,part)}
function qType(n){if(section==='listening'){if(n>=21&&n<=25)return'radio';if(n>=18&&n<=20)return'letter';if(n>=26&&n<=30)return'letter';return'text'}if(section==='reading'){if(n<=7)return'roman';if(n>=19&&n<=22||n>=23&&n<=26||n>=27&&n<=30||n>=36&&n<=40)return'letter';return'text'}return'text'}
function input(n){const v=escapeHTML(answers[n]||''),typ=qType(n);if(typ==='radio')return `<span class="muted">Choose A, B or C below</span>`;if(typ==='letter'||typ==='roman'){const set=typ==='roman'?['','i','ii','iii','iv','v','vi','vii','viii','ix','x']:['',...'ABCDEFGHI'];return `<select aria-label="Answer ${n}" data-q="${n}" class="answer short ${v?'answered':''}">${set.map(a=>`<option value="${a}" ${v.toUpperCase()===a.toUpperCase()?'selected':''}>${a||'Select'}</option>`).join('')}</select>`}return `<input aria-label="Answer ${n}" data-q="${n}" class="answer ${v?'answered':''}" value="${v}" placeholder="Answer ${n}" autocomplete="off" spellcheck="false">`}
function lineWithBlanks(t){const rx=/(\b(?:[1-9]|[1-3][0-9]|40)\b)\s*(_{3,})/g;return escapeHTML(t).replace(rx,(match,num)=>`<span class="qn">${num}</span>${input(+num)}`).replace(/_{5,}/g,'________')}
function renderBlock(p,context){let t=p.text,ix=p.index;if(p.style==='Heading 2')return `<h2>${escapeHTML(t)}</h2>`;if(p.style==='Heading 3')return `<h3>${escapeHTML(t)}</h3>`;if(/^Questions? \d+[–-]\d+/i.test(t)||/^(Complete the|Choose|Match each|Reading Passage \d+ has|Answer the questions|Write NO MORE)/i.test(t))return `<p class="direction">${escapeHTML(t)}</p>`;
const m=t.match(/^(\d{1,2})\s+([\s\S]*)/);const inBlank=/\b\d{1,2}\s*_{3,}/.test(t);
if(m&&+m[1]<=40&&context!=='passage'){
 const n=+m[1];let label=m[2].replace(/\n\s*_{4,}/g,'').replace(/_{4,}/g,'');const showInput=!(section==='listening'&&n>=21&&n<=25);
 return `<div class="question-group"><p class="question-line" id="question-${n}"><span class="qn">${n}</span>${escapeHTML(label)} ${showInput?input(n):''}<button type="button" class="flag-btn" data-flag="${n}" aria-label="Flag question ${n}" title="Flag for review">${flags[n]?'⚑':'⚐'}</button></p></div>`;
}
if(inBlank&&context!=='passage')return `<p class="question-line">${lineWithBlanks(t)}</p>`;
if(context==='passage'&&/^[A-I]\s+/.test(t))return `<p><span class="para-letter">${escapeHTML(t[0])}</span>${escapeHTML(t.slice(2))}</p>`;
if(/^[A-G]\s{2,}/.test(t)&&context==='question')return `<p class="option-list">${escapeHTML(t)}</p>`;
return `<p>${escapeHTML(t)}</p>`}
function renderListening(){const p=parts()[part];let out='';let radioN=null;for(let i=0;i<p.length;i++){const x=p[i],t=x.text;
if(part===2&&/^([ABC])\s{2,}/.test(t)&&radioN!==null){let letter=t.trim()[0],checked=answers[radioN]===letter;out+=`<label class="choice"><input type="radio" data-q="${radioN}" name="lq${radioN}" value="${letter}" ${checked?'checked':''}><strong>${letter}</strong> ${escapeHTML(t.trim().slice(1).trim())}</label>`;continue;}
const q=t.match(/^(\d+)\s+/);if(part===2&&q&&+q[1]>=21&&+q[1]<=25){radioN=+q[1];}
else if(t.startsWith('Questions 26'))radioN=null;
out+=renderBlock(x,'question')}
return `<div class="single"><div class="paper"><h2>Listening Part ${part+1}</h2>${out}</div></div>`}
function renderReading(){const p=parts()[part];let passage=[],questions=[];if(part===0){passage=p.filter(x=>x.index>=123&&x.index<=135);questions=p.filter(x=>x.index<123||x.index>=136)}else if(part===1){passage=p.filter(x=>x.index>=146&&x.index<=156);questions=p.filter(x=>x.index>156)}else{passage=p.filter(x=>x.index>=181&&x.index<=190);questions=p.filter(x=>x.index>=191)};
let title=['Trees in trouble','Fatal Attraction','Left or right?'][part];return `<div class="reading-layout"><article class="reading-pane"><h2>${title}</h2>${passage.map(x=>renderBlock(x,'passage')).join('')}</article><section class="reading-pane reading-questions"><h2>Questions ${range()[0]}–${range()[1]}</h2>${questions.map(x=>renderBlock(x,'question')).join('')}</section></div>`}
function renderWriting(){const content=parts()[part], val=escapeHTML(answers['task'+(part+1)]||'');return `<div class="writing-layout" style="--writing-left:${writingLeft}%"><div class="paper writing-prompt" aria-label="Task instructions; scroll independently"><div class="pane-title"><span class="pane-kicker">ACADEMIC WRITING</span><h2>Task ${part+1} · Question</h2></div>${content.map(x=>renderBlock(x,'passage')).join('')}${part===0?'<img src="writing-chart.png" class="chart" alt="Eastport major export values: agriculture 8, 10, 11; technology 5, 11, 15; renewable energy equipment 2, 6, 12 billion USD for 2015, 2025, 2035 respectively">':''}</div><div class="writing-divider" id="writing-divider" title="Drag to resize panels; double click to reset" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Resize Writing panels" aria-valuemin="28" aria-valuemax="72" aria-valuenow="${writingLeft}"><span aria-hidden="true">⇄</span></div><div class="paper writing-answer"><div class="pane-title"><span class="pane-kicker">YOUR RESPONSE</span><h2>Task ${part+1} · Answer</h2></div><textarea data-task="${part+1}" aria-label="Write your answer for Writing Task ${part+1}" placeholder="Type your answer here..." spellcheck="true">${val}</textarea><div class="writing-meta"><div class="counter" id="words">0 words · Minimum ${part===0?150:250}</div><span>Autosaved</span></div></div></div>`}
function renderSpeaking(){const p=parts()[part];return `<div class="speaking-layout"><div class="paper speaking-prompt"><div class="pane-title"><span class="pane-kicker">IELTS SPEAKING</span><h2>Part ${part+1} · Questions</h2></div>${p.map(x=>renderBlock(x,'passage')).join('')}</div></div>`}
function render(){
 $('main-content').innerHTML=section==='listening'?renderListening():section==='reading'?renderReading():section==='writing'?renderWriting():renderSpeaking();
 if(section==='listening')setListeningAudio(part);
 if(section==='speaking'){
  $('speaking-notes').value=answers['note'+part]||'';
  $('note-part-caption').textContent='Part '+(part+1)+' · Your notes';
 }
 renderNavigation();
 $('review-btn').textContent='Review answers';
 $('submit-btn').textContent=section==='speaking'?'SAVE & REVIEW →':'SAVE & NEXT →';
 $('main-content').querySelectorAll('[data-q]').forEach(el=>{
  el.addEventListener('input',()=>{answers[el.dataset.q]=el.value;el.classList.toggle('answered',!!el.value);updateNav();save()});
  el.addEventListener('focus',()=>{activeQuestion=Number(el.dataset.q);renderNavigation()});
 });
 $('main-content').querySelectorAll('[data-q][type=radio]').forEach(el=>el.addEventListener('change',()=>{answers[el.dataset.q]=el.value;updateNav();save()}));
 $('main-content').querySelectorAll('[data-flag]').forEach(b=>b.onclick=()=>{flags[b.dataset.flag]=!flags[b.dataset.flag];b.textContent=flags[b.dataset.flag]?'⚑':'⚐';updateNav();save()});
 if(section==='writing'){
  const el=document.querySelector('[data-task]');
  if(el){el.oninput=()=>{answers['task'+el.dataset.task]=el.value;countWords();save()};countWords();bindResize()}
 }
 $('main-content').scrollTop=0;
 save();
}
function renderNavigation(){
 const nav=$('qnav');
 if(section==='listening'||section==='reading'){
  const groups=section==='listening'?4:3;
  nav.innerHTML=Array.from({length:groups},(_,i)=>{
   const [first,last]=rangeFor(section,i), total=last-first+1;
   const done=Array.from({length:total},(_,j)=>first+j).filter(n=>String(answers[n]||'').trim()).length;
   if(i!==part)return `<button class="nav-group-summary" data-nav-part="${i}" type="button"><span class="group-accent"></span><strong>${section==='reading'?'PASSAGE':'PART'} ${i+1}</strong><small>${done} of ${total}</small></button>`;
   const qs=Array.from({length:total},(_,j)=>{
    const n=first+j;
    return `<button class="qbtn ${answers[n]?'done':''} ${flags[n]?'flag':''} ${n===activeQuestion?'current':''}" type="button" data-jump="${n}" aria-label="Question ${n}${answers[n]?', answered':''}${flags[n]?', flagged':''}" aria-current="${n===activeQuestion?'true':'false'}">${n}</button>`;
   }).join('');
   return `<div class="nav-group-active"><button type="button" class="nav-group-label" data-nav-part="${i}"><span class="group-accent"></span><strong>${section==='reading'?'PASSAGE':'PART'} ${i+1}</strong><small>${done} of ${total}</small></button><div class="nav-questions">${qs}</div></div>`;
  }).join('');
 }else if(section==='writing'){
  nav.innerHTML=Array.from({length:2},(_,i)=>{
   const wc=wordCount(answers['task'+(i+1)]);
   return `<button type="button" class="nav-task ${part===i?'active':''}" data-part="${i}"><span>TASK ${i+1}</span><small>${wc} words · min. ${i?250:150}</small></button>`;
  }).join('');
 }else{
  nav.innerHTML=Array.from({length:3},(_,i)=>`<button type="button" class="nav-task speaking-task ${part===i?'active':''}" data-part="${i}"><span>SPEAKING PART ${i+1}</span><small>${i===1?'Long turn':'Interview & discussion'}</small></button>`).join('');
 }
 nav.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(+b.dataset.jump));
 nav.querySelectorAll('[data-nav-part]').forEach(b=>b.onclick=()=>changePart(+b.dataset.navPart));
 nav.querySelectorAll('[data-part]').forEach(b=>b.onclick=()=>changePart(+b.dataset.part));
 const atStart=section==='listening'||section==='reading'?activeQuestion===1:part===0;
 const atEnd=section==='listening'||section==='reading'?activeQuestion===40:part===parts().length-1;
 $('prev-btn').disabled=atStart;$('next-btn').disabled=atEnd;
 $('finish-skill').title=section==='speaking'?'Save Speaking & review all skills':'Save this skill and continue';
}
function countWords(){const el=document.querySelector('[data-task]');if(el)$('words').textContent=`${el.value.trim()?el.value.trim().split(/\s+/).length:0} words · Minimum ${part===0?150:250}`}
function updateNav(){renderNavigation()}
function jump(n){
 activeQuestion=n;
 const p=section==='listening'?Math.floor((n-1)/10):n<=13?0:n<=26?1:2;
 if(p!==part)changePart(p);else renderNavigation();
 requestAnimationFrame(()=>{
  const e=$('question-'+n)||document.querySelector(`[data-q="${n}"]`);
  if(!e)return;
  const scroller=e.closest('.reading-pane')||$('main-content');
  const r=e.getBoundingClientRect(),sr=scroller.getBoundingClientRect();
  scroller.scrollTo({top:scroller.scrollTop+r.top-sr.top-sr.height*0.3,behavior:'smooth'});
  e.querySelector('input,select')?.focus({preventScroll:true});
 });
}
function changePart(p){
 if(p<0||p>=parts().length)return;
 part=p;
 if(section==='listening'||section==='reading')activeQuestion=range()[0];
 render();
}
function moveNav(dir){
 if(section==='listening'||section==='reading')jump(Math.min(40,Math.max(1,activeQuestion+dir)));
 else changePart(part+dir);
}
function normalize(a){return String(a||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[£,$.\-\s']/g,'').replace(/^(an?|the)(?=[a-z])/,'').trim()}
function correctness(type,n){const supplied=String(answers[n]||'').trim(),accepted=EXAM.keys[type][n]||[];if(!supplied)return null;return accepted.some(a=>normalize(a)===normalize(supplied))}
function result(){finished=true;clearInterval(timer);save();$('exam').hidden=true;$('welcome').hidden=true;$('result').hidden=false;$('result-heading').textContent=LABELS[section]+' completed';let body='';if(section==='reading'||section==='listening'){
let correct=0,attempted=0,rows=[];for(let n=1;n<=40;n++){let v=String(answers[n]||'').trim(),ok=correctness(section,n);if(v)attempted++;if(ok)correct++;rows.push(`<div class="review-row"><strong>Q${n}</strong> · Your answer: <span class="${ok?'ok':'wrong'}">${escapeHTML(v||'—')}</span> · Expected: ${escapeHTML((EXAM.keys[section][n]||[])[0]||'—')}</div>`)}
let ranges=[[39,40,'9.0'],[37,38,'8.5'],[35,36,'8.0'],[33,34,'7.5'],[30,32,'7.0'],[27,29,'6.5'],[23,26,'6.0'],[20,22,'5.5'],[16,19,'5.0'],[13,15,'4.5'],[10,12,'4.0'],[0,9,'Below 4.0']];let approx=ranges.find(([lo,hi])=>correct>=lo&&correct<=hi)?.[2]||'N/A';body=`<div class="scores"><div class="score"><strong>${correct}/40</strong>Correct</div><div class="score"><strong>${attempted}/40</strong>Answered</div><div class="score"><strong>${section==='reading'?approx:'—'}</strong>${section==='reading'?'Approx. practice band':'Raw score only'}</div></div><p class="small">Answers are checked using the supplied teacher's key; spelling variants may need manual review. The Reading band estimate is approximate, not official. No Listening band estimate is shown.</p><details><summary><strong>View detailed answer comparison</strong></summary><div class="answer-review">${rows.join('')}</div></details>`}
else if(section==='writing'){let t1=(answers.task1||'').trim().split(/\s+/).filter(Boolean).length,t2=(answers.task2||'').trim().split(/\s+/).filter(Boolean).length;body=`<div class="scores"><div class="score"><strong>${t1}</strong>Task 1 words</div><div class="score"><strong>${t2}</strong>Task 2 words</div></div><p>Writing answers were saved locally. Download your answers to share with a teacher for assessment; an IELTS band score cannot be reliably calculated from word count alone.</p>`}
else body='<p>Speaking practice complete. You can export your notes using the button below. Any audio recorded during practice must be downloaded separately when you stop the recording; it is not saved inside the answer export.</p>';
$('result-body').innerHTML=body;}
function safeName(){return candidate.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,65)||'Candidate'}
function resultObject(k){const s=k===section?{answers,flags,seconds}:readSaved()[k]||{};const a=s.answers||{};const out={test:'IELTS Academic Mock Test 01',candidate,skill:k,answers:a,flags:s.flags||{},timeRemainingSeconds:s.seconds??null,savedAt:new Date().toISOString()};if(k==='listening'||k==='reading'){out.rawScore=Array.from({length:40},(_,i)=>i+1).reduce((sum,n)=>sum+((EXAM.keys[k][n]||[]).some(key=>normalize(key)===normalize(a[n]))?1:0),0)}return out}
function textAnswers(k){const d=resultObject(k),a=d.answers;let lines=[`IELTS ACADEMIC MOCK TEST 01`,`Candidate: ${candidate}`,`Skill: ${LABELS[k]}`,`Saved: ${new Date().toLocaleString()}`,''];if(k==='listening'||k==='reading'){for(let n=1;n<=40;n++)lines.push(`Question ${n}: ${a[n]||'(blank)'}`);lines.push('',`Correct answers (practice marking): ${d.rawScore}/40`)}else if(k==='writing'){lines.push('WRITING TASK 1',a.task1||'(blank)','','WRITING TASK 2',a.task2||'(blank)')}else for(let i=0;i<3;i++)lines.push(`PART ${i+1} — NOTES`,a['note'+i]||'(blank)','');return lines.join('\n')}
function downloadBlob(blob,name){let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),12000)}
function fileBytes(s){return new TextEncoder().encode(s)}
// Self-contained ZIP creation (stored entries, CRC32): no external CDN dependencies.
const crcTable=(()=>{let a=[];for(let n=0;n<256;n++){let c=n;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;a.push(c>>>0)}return a})();
function crc32(u){let c=0xffffffff;for(const b of u)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
function zipFiles(files){const local=[],central=[];let offset=0;for(const [name,data] of files){let nb=fileBytes(name),u=data instanceof Uint8Array?data:fileBytes(String(data));let crc=crc32(u),h=new Uint8Array(30+nb.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(8,0,true);v.setUint32(14,crc,true);v.setUint32(18,u.length,true);v.setUint32(22,u.length,true);v.setUint16(26,nb.length,true);h.set(nb,30);local.push(h,u);let c=new Uint8Array(46+nb.length),w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint32(16,crc,true);w.setUint32(20,u.length,true);w.setUint32(24,u.length,true);w.setUint16(28,nb.length,true);w.setUint32(42,offset,true);c.set(nb,46);central.push(c);offset+=h.length+u.length}let centralLen=central.reduce((n,u)=>n+u.length,0),e=new Uint8Array(22),v=new DataView(e.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralLen,true);v.setUint32(16,offset,true);return new Blob([...local,...central,e],{type:'application/zip'})}
async function submit(auto=false){
 if(!auto&&!confirm(section==='speaking'?'Save Speaking and open the final review?':'Save answers and move to the next skill?'))return;
 clearInterval(timer);
 if(section==='speaking'&&mediaRecorder?.state==='recording')await stopRecording();
 finished=true;save();audioPlayer.pause();
 if(section!=='speaking'){
  downloadBlob(new Blob([textAnswers(section)],{type:'text/plain;charset=utf-8'}),`IELTS_${safeName()}_${section.toUpperCase()}_answers.txt`);
  setTimeout(()=>start(ORDER[ORDER.indexOf(section)+1]),350);return;
 }
 // Speaking saved: take candidates to review; no submission until they press Submit.
 reviewOpen=true; $('exam').hidden=true;$('speaking-controls').hidden=true;$('final-review').hidden=false;
 $('clock').textContent='REVIEW';$('clock').style.color='white';renderFinalReview();
}
function wordCount(v){const t=String(v||'').trim();return t?t.split(/\s+/).length:0}
function fullResults(){const data={test:'IELTS Academic Mock Test 01',candidate,submittedAt:new Date().toISOString(),skills:{}};for(const k of ORDER)data.skills[k]=resultObject(k);data.skills.speaking.recordingParts=recordings[1]?[1]:[];data.skills.writing.task1WordCount=wordCount(data.skills.writing.answers.task1);data.skills.writing.task2WordCount=wordCount(data.skills.writing.answers.task2);return data}
function renderFinalReview(){const d=fullResults(),l=d.skills.listening,r=d.skills.reading,w=d.skills.writing,sp=d.skills.speaking;
 const each=(k)=>{const a=d.skills[k].answers||{};return Array.from({length:40},(_,i)=>{const n=i+1;return `<span class="review-answer"><b>${n}.</b> ${escapeHTML(a[n]||'—')}</span>`}).join('')};
 const audios=recordings[1]?'One continuous Speaking audio recording is available.':'No Speaking audio recorded.';
 $('review-summary').innerHTML=`<h2>${escapeHTML(candidate)}</h2><div class="review-stats"><div><b>Listening</b><strong>${l.rawScore}/40</strong><small>${Object.values(l.answers||{}).filter(Boolean).length} answered</small></div><div><b>Reading</b><strong>${r.rawScore}/40</strong><small>${Object.values(r.answers||{}).filter(Boolean).length} answered</small></div><div><b>Writing</b><strong>${w.task1WordCount} + ${w.task2WordCount}</strong><small>Task 1 / Task 2 words</small></div><div><b>Speaking</b><strong>${recordings[1]?'Yes':'No'}</strong><small>One full Speaking recording</small></div></div>
 <details><summary>Listening · All 40 answers</summary><div class="review-answer-grid">${each('listening')}</div></details>
 <details><summary>Reading · All 40 answers</summary><div class="review-answer-grid">${each('reading')}</div></details>
 <details><summary>Writing · Task 1 (${w.task1WordCount} words)</summary><pre class="review-essay">${escapeHTML(w.answers.task1||'(No answer)')}</pre></details>
 <details><summary>Writing · Task 2 (${w.task2WordCount} words)</summary><pre class="review-essay">${escapeHTML(w.answers.task2||'(No answer)')}</pre></details>
 <details><summary>Speaking · Notes & recordings</summary><p>${audios}</p>${[0,1,2].map(i=>`<h3>Part ${i+1} notes</h3><pre class="review-essay">${escapeHTML(sp.answers['note'+i]||'(No notes)')}</pre>`).join('')}</details>`;
}
async function downloadComplete(){const files=[];for(const k of ORDER){files.push([`IELTS_${safeName()}_${k.toUpperCase()}_answers.txt`,fileBytes(textAnswers(k))]);files.push([`IELTS_${safeName()}_${k.toUpperCase()}_answers.json`,fileBytes(JSON.stringify(resultObject(k),null,2))])}
 for(const [key,v] of Object.entries(recordings))files.push([`IELTS_${safeName()}_Speaking_Complete.${v.ext}`,new Uint8Array(await v.blob.arrayBuffer())]);
 files.push(['README.txt',fileBytes('IELTS Academic Mock Test 01\nCandidate: '+candidate+'\nOne continuous Speaking audio recording is included if recorded during this browser session.\n')]);
 downloadBlob(zipFiles(files),`IELTS_Mock01_${safeName()}_COMPLETE.zip`);
}
let submissionCountdownTimer=null;
function beginSubmissionCheck(){
 const guide=$('post-submit-guide'),waiting=$('submission-wait'),check=$('submission-check'),counter=$('submission-countdown');
 guide.hidden=false;waiting.hidden=false;check.hidden=true;
 let remaining=30;counter.textContent='00:30';
 clearInterval(submissionCountdownTimer);
 submissionCountdownTimer=setInterval(()=>{
  remaining=Math.max(0,remaining-1);counter.textContent='00:'+String(remaining).padStart(2,'0');
  if(remaining===0){clearInterval(submissionCountdownTimer);waiting.hidden=true;check.hidden=false;check.scrollIntoView({behavior:'smooth',block:'nearest'});}
 },1000);
}
// POST an HTML form to Apps Script in a hidden iframe; each response is verified.
let iframeSerial=0;
function sendToGoogle(url, fields, type, id, timeoutMs=60000){
 return new Promise((resolve,reject)=>{
  const frame=document.createElement('iframe');frame.name='ielts-post-'+(++iframeSerial);frame.style.display='none';
  const form=document.createElement('form');form.method='POST';form.action=url;form.target=frame.name;form.style.display='none';
  for(const [name,value] of Object.entries(fields)){
   const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value);form.append(input);
  }
  document.body.append(frame,form);
  let settled=false;
  const clear=()=>{window.removeEventListener('message',listener);clearTimeout(timerId);form.remove();setTimeout(()=>frame.remove(),500)};
  const finish=(err,data)=>{if(settled)return;settled=true;clear();err?reject(err):resolve(data)};
  const timerId=setTimeout(()=>finish(new Error('No response from Google Apps Script within 60 seconds.')),timeoutMs);
  function listener(e){
   // Apps Script may wrap HtmlService output in an inner iframe.
   // Verify origin, message type and submission ID rather than frame source.
   if(!/^(https:\/\/script\.google\.com|https:\/\/[a-z0-9-]+\.googleusercontent\.com)$/.test(e.origin))return;
   const m=e.data;
   if(!m||m.type!==type||m.submissionId!==id)return;
   if(m.ok===true)finish(null,m);else finish(new Error(m.message||'The server returned an error.'));
  }
  window.addEventListener('message',listener);
  try{form.submit()}catch(err){finish(err)}
 });
}
function audioBase64(bytes){
 let binary='';const step=8192;
 for(let n=0;n<bytes.length;n+=step)binary+=String.fromCharCode(...bytes.subarray(n,n+step));
 return btoa(binary);
}
function speakingEntry(){return recordings[1]||null}
async function uploadSpeaking(url, id){
 const audio=speakingEntry();
 if(!audio)return null;
 const size=audio.blob.size, unit=192*1024;
 if(size>12*1024*1024)throw new Error('Audio is larger than 12 MB. Download your backup ZIP and upload it to the Drive folder manually.');
 if(!size)throw new Error('The audio recording is empty. Please upload the backup ZIP.');
 const total=Math.ceil(size/unit), base={audioAction:'init',submissionId:id,candidate,totalSize:size,totalChunks:total,mime:audio.blob.type||'audio/webm'};
 $('send-status').textContent='Preparing Speaking audio upload… Keep this page open.';
 const init=await sendToGoogle(url,base,'IELTS_AUDIO_RESULT',id);
 if(init.complete)return init.fileUrl;
 const bytes=new Uint8Array(await audio.blob.arrayBuffer());
 for(let n=0;n<total;n++){
  const item=bytes.subarray(n*unit,Math.min((n+1)*unit,bytes.length));
  const request={...base,audioAction:'chunk',chunkIndex:n,audioData:audioBase64(item)};
  let succeeded=false, lastError;
  for(let attempt=0;attempt<3&&!succeeded;attempt++){
   try{await sendToGoogle(url,request,'IELTS_AUDIO_RESULT',id);succeeded=true}
   catch(err){lastError=err}
  }
  if(!succeeded)throw new Error('Speaking audio chunk '+(n+1)+' failed: '+lastError.message);
  $('send-status').textContent='Uploading Speaking audio: '+Math.round((n+1)*100/total)+'% ('+(n+1)+'/'+total+' parts). Do not close this page.';
 }
 $('send-status').textContent='Combining audio and creating the Google Drive link…';
 const final=await sendToGoogle(url,{...base,audioAction:'finish'},'IELTS_AUDIO_RESULT',id,90000);
 if(!final.complete||!final.fileUrl)throw new Error('Drive did not confirm the final audio link.');
 return final.fileUrl;
}
async function submitGoogle(){
 if(uploadActive)return;
 if(googleSubmitted && (speakingUploaded||!speakingEntry())){
  $('send-status').textContent='This test has already been submitted. Check the Google Sheet.';return;
 }
 if(!googleSubmitted&&!confirm('Submit your answers to Google Sheets and upload one Speaking recording to Google Drive? A backup ZIP will also be downloaded.'))return;
 const btn=$('submit-google');btn.disabled=true;uploadActive=true;
 if(!googleSubmitted){
  beginSubmissionCheck();
  try{await downloadComplete()}catch(err){console.warn('Backup ZIP error',err);$('send-status').textContent='ZIP download failed: '+err.message}
 }
 const url=(window.SHEET_CONFIG?.WEB_APP_URL||'').trim();
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(url)){
  $('send-status').textContent='Google Sheets is not configured. Download the ZIP and use the Drive backup link.';
  btn.disabled=false;uploadActive=false;return;
 }
 if(!submissionIdForPage)submissionIdForPage='ielts_'+Date.now()+'_'+Math.random().toString(36).slice(2);
 const token=submissionIdForPage;
 try{
  if(!googleSubmitted){
   $('send-status').textContent='Sending IELTS answers to Google Sheets…';
   const data=fullResults();data.submissionId=token;
   await sendToGoogle(url,{payload:JSON.stringify(data)},'IELTS_SHEET_RESULT',token);
   googleSubmitted=true;localStorage.setItem(storage+'-submitted',token);
  }
  if(speakingEntry()&&!speakingUploaded){
   const link=await uploadSpeaking(url,token);
   speakingUploaded=true;
   $('send-status').textContent='IELTS answers submitted and Speaking audio saved on Google Drive. Audio link: '+link;
  }else{
   $('send-status').textContent='IELTS answers received. No Speaking audio was recorded in this browser session.';
  }
  btn.textContent='SUBMITTED ✓';btn.disabled=true;
 }catch(err){
  console.error('IELTS submission error',err);
  $('send-status').textContent=(googleSubmitted?'Answers were saved, but Speaking audio upload is not confirmed. ':'Submission is not confirmed. ')+err.message+' You may retry or upload your backup ZIP to Drive.';
  btn.textContent='RETRY SUBMISSION / AUDIO UPLOAD';btn.disabled=false;
 }finally{uploadActive=false}
}
$('download-complete').onclick=downloadComplete;$('submit-google').onclick=submitGoogle;
function exportAnswers(){downloadBlob(new Blob([textAnswers(section)],{type:'text/plain'}),`IELTS_${safeName()}_${section}_answers.txt`)}
async function startRecording(){
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){$('record-status').textContent='Microphone recording is not supported in this browser.';return}
 if(mediaRecorder?.state==='recording')return;
 if(recordings[1]){$('record-status').textContent='One Speaking recording is already saved. Please continue to Final Review.';return}
 try{
  recording=await navigator.mediaDevices.getUserMedia({audio:true});
  recordParts=[];recordingPart=part;
  const types=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  const selected=types.find(t=>MediaRecorder.isTypeSupported?.(t));
  mediaRecorder=new MediaRecorder(recording,{...(selected?{mimeType:selected}:{}),audioBitsPerSecond:32000});
  const recorder=mediaRecorder;
  recordStopPromise=new Promise(resolve=>{
   recorder.ondataavailable=e=>{if(e.data.size)recordParts.push(e.data)};
   recorder.onstop=()=>{
    const typ=recorder.mimeType||'audio/webm',ext=typ.includes('mp4')?'mp4':typ.includes('ogg')?'ogg':'webm';
    const blob=new Blob(recordParts,{type:typ});recordings[1]={blob,ext};
    const playback=$('record-playback');
    if(playback){playback.src=URL.createObjectURL(blob);playback.hidden=false}
    resolve();
   };
  });
  recorder.start(1000);recordStart=Date.now();clearInterval(recordTicker);
  recordTicker=setInterval(()=>$('record-elapsed').textContent=pad(Math.floor((Date.now()-recordStart)/60000))+':'+pad(Math.floor((Date.now()-recordStart)/1000)%60),500);
  $('record-status').textContent='● Recording Speaking continuously — you can change Parts and take notes';
  $('record-btn').disabled=true;$('stop-record').disabled=false;
 }catch(e){$('record-status').textContent='Microphone unavailable: '+e.message}
}
async function stopRecording(){
 if(mediaRecorder?.state==='recording'){mediaRecorder.stop();await recordStopPromise}
 clearInterval(recordTicker);recording?.getTracks().forEach(t=>t.stop());recording=null;
 $('record-status').textContent=recordings[1]?'One complete Speaking recording saved (included in ZIP and uploaded on submission)':'No audio recorded';
 $('record-btn').disabled=!!recordings[1];$('stop-record').disabled=true;
}
function bindResize(){
 const layout=document.querySelector('.writing-layout'),handle=$('writing-divider');if(!layout||!handle)return;
 const setWidth=(v)=>{writingLeft=Math.max(28,Math.min(72,v));layout.style.setProperty('--writing-left',writingLeft+'%');handle.setAttribute('aria-valuenow',Math.round(writingLeft))};
 handle.addEventListener('pointerdown',e=>{
  if(window.matchMedia('(max-width:760px)').matches)return;
  e.preventDefault();handle.setPointerCapture(e.pointerId);
  const move=ev=>{const rect=layout.getBoundingClientRect();setWidth((ev.clientX-rect.left)/rect.width*100)};
  const end=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',end);handle.removeEventListener('pointercancel',end)};
  handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
 });
 handle.ondblclick=()=>setWidth(50);
 handle.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setWidth(writingLeft+(e.key==='ArrowRight'?3:-3))}else if(e.key==='Home')setWidth(28);else if(e.key==='End')setWidth(72)};
}
function audioTime(t){return Number.isFinite(t)?Math.floor(t/60)+':'+pad(Math.floor(t%60)):'0:00'}
function updateAudioUI(){
 const duration=audioPlayer.duration;
 $('audio-time').textContent=audioTime(audioPlayer.currentTime)+' / '+audioTime(duration);
 $('audio-seek').value=Number.isFinite(duration)&&duration>0?Math.round(audioPlayer.currentTime/duration*1000):0;
 $('audio-play').textContent=audioPlayer.paused?'▶':'Ⅱ';
 $('audio-play').setAttribute('aria-label',audioPlayer.paused?'Play audio':'Pause audio');
}
function setListeningAudio(index){
 $('audio-part-title').textContent='LISTENING · PART '+(index+1);
 if(loadedAudioPart===index){updateAudioUI();return}
 if(loadedAudioPart>=0)audioPositions[loadedAudioPart]=audioPlayer.currentTime;
 audioPlayer.pause();loadedAudioPart=index;
 audioPlayer.src=encodeURI(EXAM.audio[index]);
 audioPlayer.load();
 audioPlayer.playbackRate=Number($('audio-speed').value);
 audioPlayer.volume=Number($('audio-volume').value)/100;
 updateAudioUI();
}
function bindAudioControls(){
 $('audio-play').onclick=async()=>{try{if(audioPlayer.paused)await audioPlayer.play();else audioPlayer.pause()}catch(err){console.warn('Audio playback unavailable',err);$('audio-time').textContent='Audio unavailable'}};
 audioPlayer.addEventListener('play',updateAudioUI);audioPlayer.addEventListener('pause',updateAudioUI);audioPlayer.addEventListener('timeupdate',updateAudioUI);
 audioPlayer.addEventListener('loadedmetadata',()=>{if(loadedAudioPart>=0){const t=audioPositions[loadedAudioPart];if(Number.isFinite(audioPlayer.duration)&&t<audioPlayer.duration)audioPlayer.currentTime=t;}updateAudioUI()});
 audioPlayer.addEventListener('ended',updateAudioUI);
 $('audio-seek').addEventListener('input',e=>{if(Number.isFinite(audioPlayer.duration))audioPlayer.currentTime=e.target.value/1000*audioPlayer.duration});
 $('audio-volume').addEventListener('input',e=>{audioPlayer.volume=Number(e.target.value)/100;$('audio-volume-label').textContent=e.target.value+'%'});
 $('audio-speed').addEventListener('change',e=>audioPlayer.playbackRate=Number(e.target.value));
 $('audio-reload').onclick=()=>{if(loadedAudioPart>=0)audioPositions[loadedAudioPart]=0;audioPlayer.pause();audioPlayer.load();updateAudioUI()};
 $('audio-settings-toggle').onclick=()=>{const open=$('audio-settings').hidden;$('audio-settings').hidden=!open;$('audio-settings-toggle').setAttribute('aria-expanded',String(open))};
 document.addEventListener('pointerdown',e=>{if(!$('audio-settings').hidden&&!e.target.closest('.audio-right')){$('audio-settings').hidden=true;$('audio-settings-toggle').setAttribute('aria-expanded','false')}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('audio-settings').hidden=true;$('audio-settings-toggle').setAttribute('aria-expanded','false')}});
}
$('font-btn').onclick=()=>{zoom=zoom>=1.25?.9:+(zoom+.1).toFixed(2);document.documentElement.style.setProperty('--zoom',zoom)};
$('exit-btn').onclick=()=>{if(section&&confirm('Return home? Your progress will be saved.')){save();if(mediaRecorder?.state==='recording')stopRecording();welcome()}};
$('prev-btn').onclick=()=>moveNav(-1);$('next-btn').onclick=()=>moveNav(1);$('finish-skill').onclick=()=>submit(false);
$('submit-btn').onclick=()=>submit(false);
$('review-btn').onclick=()=>{if(section==='listening'||section==='reading'){let missing=Array.from({length:40},(_,i)=>i+1).filter(n=>!answers[n]);alert(missing.length?`Unanswered (${missing.length}): ${missing.join(', ')}`:'All 40 questions have answers.')}else alert('Check your responses and submit when ready.')};
$('highlight-btn').onclick=()=>{const sel=window.getSelection();if(!sel||sel.isCollapsed)return;const range=sel.getRangeAt(0);if(!$('main-content').contains(range.commonAncestorContainer))return;try{const mark=document.createElement('mark');mark.className='user-mark';range.surroundContents(mark);sel.removeAllRanges()}catch{alert('Select text within a single paragraph to highlight it.')}};
$('home-btn').onclick=welcome;$('download-btn').onclick=exportAnswers;$('start-test').onclick=()=>{candidate=$('candidate').value.trim();if(!candidate){alert('Please enter your full name.');return}const old=readSaved();if(old.candidate!==candidate){localStorage.removeItem(storage)}start('listening')};$('record-btn').onclick=startRecording;$('stop-record').onclick=stopRecording;$('speaking-notes').oninput=e=>{if(section==='speaking'){answers['note'+part]=e.target.value;save()}};bindAudioControls();welcome();
