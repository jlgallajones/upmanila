/* Dependency-free prototype. Synthetic data only; no API or persistent storage. */
'use strict';
const ReviewModel = (() => {
  const initial = () => ({
    offline: false, nextId: 4, queue: [], audit: [],
    records: [
      {id:'DEMO-001',name:'Demo casualty A',age:'34',sex:'Not specified',incident:'DEMO-INC-01',triage:'red',location:'Scene / Zone A',status:'submitted',notes:'Synthetic field report for review.',history:['Submitted by demo field responder']},
      {id:'DEMO-002',name:'Demo casualty B',age:'28',sex:'Not specified',incident:'DEMO-INC-01',triage:'yellow',location:'Stabilization area',status:'verified',notes:'Synthetic stabilization report.',history:['Submitted by demo field responder','Verified by demo administrator']},
      {id:'DEMO-003',name:'Unidentified demo casualty',age:'',sex:'Unknown',incident:'DEMO-INC-02',triage:'green',location:'Receiving facility',status:'submitted',notes:'Synthetic receiving facility report.',history:['Submitted by demo documenter']}
    ]
  });
  let state = initial();
  function submit(data) {
    if(!['DEMO-INC-01','DEMO-INC-02'].includes(data.incident)) throw Error('Choose an active incident.');
    if(!data.name.trim()) throw Error('Enter a name or an unidentified label.');
    if(data.age !== '' && (!Number.isFinite(Number(data.age)) || Number(data.age)<0 || Number(data.age)>130)) throw Error('Enter an age from 0 to 130, or leave it blank.');
    if(!['red','yellow','green','unknown'].includes(data.triage)) throw Error('Select an assessment label.');
    const row = {...data,id:`DEMO-${String(state.nextId++).padStart(3,'0')}`,status:state.offline?'pending':'submitted',history:[state.offline?'Saved to demo offline queue':'Submitted by demo field responder']};
    (state.offline?state.queue:state.records).push(row);
    return row;
  }
  function sync() {
    if(state.offline) throw Error('Reconnect before synchronizing queued records.');
    const count=state.queue.length;
    for(const row of state.queue){row.status='submitted';row.history.push('Synchronized to demo web review');state.records.push(row);}
    state.queue=[]; return count;
  }
  function review(id,decision,reason='') {
    const row=state.records.find(r=>r.id===id);
    if(!row || row.status!=='submitted') throw Error('Only submitted records can be reviewed.');
    if(!['verified','rejected'].includes(decision)) throw Error('Invalid review decision.');
    if(decision==='rejected' && !reason.trim()) throw Error('Enter a reason to return this record.');
    row.status=decision; row.reason=reason.trim();
    const action=decision==='verified'?'Verified by demo administrator':`Returned for correction: ${reason.trim()}`;
    row.history.push(action);state.audit.unshift(`${row.id}: ${action}`);return row;
  }
  return {get state(){return state;},reset(){state=initial();},submit,sync,review};
})();
globalThis.ReviewModel = ReviewModel;

if(typeof document !== 'undefined') {
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const incidents=[{id:'DEMO-INC-01',name:'Demo earthquake response',area:'Training Zone A'},{id:'DEMO-INC-02',name:'Demo flood response',area:'Training Zone B'}];
const incidentName=id=>incidents.find(i=>i.id===id)?.name||id;
let webView='dashboard',mobileView='home',formStep=1,incidentFilter='all',draft={name:'',age:'',sex:'Unknown',incident:'DEMO-INC-01',triage:'unknown',location:'',notes:''},toastTimer;
function saveDraft(){if($('casualty-form'))Object.assign(draft,Object.fromEntries(new FormData($('casualty-form'))));}
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
const badge=s=>`<span class="status ${esc(s)}">${s==='submitted'?'Awaiting review':esc(s)}</span>`;
const triage=s=>`<span class="triage ${esc(s)}">${esc({red:'Red',yellow:'Yellow',green:'Green',unknown:'Not assessed'}[s])}</span>`;
const stat=(label,value,sub='')=>`<div class="stat"><span>${label}</span><b>${value}</b><small>${sub}</small></div>`;
function table(rows,reviewOnly=false){return rows.length?`<div class="table-wrap"><table><thead><tr><th>RECORD / NAME</th><th>INCIDENT</th><th>ASSESSMENT</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.id)}</strong><br><span class="muted">${esc(r.name)}</span></td><td>${esc(r.incident)}</td><td>${triage(r.triage)}</td><td>${badge(r.status)}</td><td><button class="table-action" data-detail="${esc(r.id)}">${reviewOnly?'Review':'View record'}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">No records match this view.</div>';}
function renderWeb(){
 const s=ReviewModel.state,pending=s.records.filter(r=>r.status==='submitted');
 $('review-count').textContent=pending.length||'';
 document.querySelectorAll('[data-web]').forEach(b=>b.classList.toggle('active',b.dataset.web===webView));
 $('web-breadcrumb').textContent={dashboard:'Overview',incidents:'Incidents',records:'Casualty records',verification:'Verification',facilities:'Facilities'}[webView];
 let html='';
 if(webView==='dashboard')html=`<p class="eyebrow">COMMAND OVERVIEW</p><h2>Every report moves the response forward.</h2><p class="caption">Synthetic operations snapshot · 2 demonstration incidents</p><div class="stats">${stat('ACTIVE INCIDENTS',2,'Demo response areas')}${stat('CASUALTY RECORDS',s.records.length,'Synchronized reports')}${stat('AWAITING REVIEW',pending.length,'Ready for verification')}${stat('VERIFIED',s.records.filter(r=>r.status==='verified').length,'Reviewed reports')}</div><div class="panel"><div class="panel-title"><h3>Latest casualty reports</h3><button class="table-action" data-web="records">View all records →</button></div>${table([...s.records].reverse().slice(0,4))}</div><div class="panel"><h3>Assessment distribution</h3><div class="bar">${['red','yellow','green'].map(t=>`<span style="width:${s.records.filter(r=>r.triage===t).length/Math.max(1,s.records.length)*100}%"></span>`).join('')}</div><p>${['red','yellow','green','unknown'].map(t=>`${esc(t)}: ${s.records.filter(r=>r.triage===t).length}`).join(' &nbsp; / &nbsp; ')}</p><p>Labels reflect user-entered demonstration data.</p></div>`;
 if(webView==='records')html=`<p class="eyebrow">CASUALTY REGISTER</p><h2>Reports across the response.</h2><div class="section-heading"><label class="search-label">Find a record<input id="record-search" type="search" placeholder="Name or record ID"></label><label class="search-label">Incident<select id="incident-filter"><option value="all">All incidents</option>${incidents.map(i=>`<option value="${i.id}" ${incidentFilter===i.id?'selected':''}>${i.id}</option>`).join('')}</select></label><label class="search-label">Status<select id="status-filter"><option value="all">All statuses</option><option value="submitted">Awaiting review</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label></div><div id="records-table"></div>`;
 if(webView==='verification')html=`<p class="eyebrow">QUALITY & TRACEABILITY</p><h2>Review incoming field reports.</h2><p class="caption">Check the report, approve it, or return it with a correction reason.</p><div class="panel">${table(pending,true)}</div><div class="panel"><h3>Demo review history</h3>${s.audit.length?`<ul class="history">${s.audit.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:'<p>No decisions in this demo session yet.</p>'}</div>`;
 if(webView==='incidents')html=`<p class="eyebrow">INCIDENT OPERATIONS</p><h2>Active response areas.</h2>${incidents.map(i=>`<div class="panel"><div class="panel-title"><h3>${esc(i.name)}</h3>${badge('online')}</div><p>${esc(i.id)} · ${esc(i.area)} · Synthetic incident</p><p>${s.records.filter(r=>r.incident===i.id).length} synchronized reports</p><button class="button subtle" data-incident-records="${i.id}">View incident reports</button></div>`).join('')}`;
 if(webView==='facilities')html=`<p class="eyebrow">CARE NETWORK</p><h2>Receiving facilities.</h2><p class="caption">Illustrative facility directory. Capacity figures are synthetic.</p>${[{name:'Demo receiving facility A',area:'Training Zone A',capacity:'8 / 20'},{name:'Demo receiving facility B',area:'Training Zone B',capacity:'5 / 12'}].map(f=>`<div class="panel"><div class="panel-title"><h3>${f.name}</h3><span class="status online">Available</span></div><p>${f.area} · Occupied / total demo beds: ${f.capacity}</p></div>`).join('')}`;
 $('web-content').innerHTML=html;
 if(webView==='records'){const filter=()=>{incidentFilter=$('incident-filter').value;$('records-table').innerHTML=table(s.records.filter(r=>(`${r.id} ${r.name}`.toLowerCase().includes($('record-search').value.toLowerCase()))&&($('status-filter').value==='all'||r.status===$('status-filter').value)&&(incidentFilter==='all'||r.incident===incidentFilter)));};$('record-search').addEventListener('input',filter);$('status-filter').addEventListener('change',filter);$('incident-filter').addEventListener('change',filter);filter();}
}
function field(label,content){return `<label class="field">${label}${content}</label>`;}
function input(name,type='text',extra=''){return `<input name="${name}" type="${type}" value="${esc(draft[name])}" ${extra}>`;}
function renderMobile(){
 const s=ReviewModel.state;
 $('offline-toggle').checked=s.offline;$('connection-banner').textContent=s.offline?'Offline · new submissions stay in the demo queue':'Connected · ready to submit';$('connection-banner').classList.toggle('offline',s.offline);
 document.querySelectorAll('[data-mobile]').forEach(b=>b.classList.toggle('active',b.dataset.mobile===mobileView));
 let html='';
 if(mobileView==='home')html=`<p class="eyebrow">FIELD RESPONDER / DEMO</p><h2>Ready for your next report.</h2><p class="caption">Your active response workspace</p><div class="record-card"><p>SELECTED INCIDENT</p><strong>Demo earthquake response</strong><p>DEMO-INC-01 · Training Zone A</p><span class="status online">Active incident</span></div><button class="button" data-mobile="add">＋ Add casualty report</button><div class="stats">${stat('QUEUED',s.queue.length,'On this demo device')}${stat('SUBMITTED',s.records.length,'Shared with command')}</div><div class="record-card"><h3>Before you submit</h3><p>Check incident context and identity. Unidentified casualties can be recorded using a temporary label.</p><button class="button subtle" data-mobile="records">Open records & queue</button></div>`;
 if(mobileView==='add'){
 html=`<div class="steps">STEP ${formStep} OF 3 / ${['IDENTITY','ASSESSMENT','REVIEW'][formStep-1]}</div><h2>New casualty report</h2><p class="caption">${formStep===3?'Confirm the details before submitting.':'Use demonstration data for this prototype.'}</p>`;
 if(formStep===1)html+=`<form id="casualty-form">${field('Active incident',`<select name="incident">${incidents.map(i=>`<option value="${i.id}" ${draft.incident===i.id?'selected':''}>${i.name}</option>`).join('')}</select>`)}${field('Name or unidentified label *',input('name','text','required maxlength="100" placeholder="e.g. Unidentified demo D"'))}${field('Age / estimated years (optional)',input('age','number','min="0" max="130"'))}${field('Sex (optional)',`<select name="sex">${['Unknown','Female','Male','Not specified'].map(v=>`<option ${draft.sex===v?'selected':''}>${v}</option>`).join('')}</select>`)}<button class="button" type="submit">Continue to assessment →</button></form>`;
 if(formStep===2)html+=`<form id="casualty-form">${field('User-entered assessment label',`<select name="triage">${[['unknown','Not assessed'],['red','Red'],['yellow','Yellow'],['green','Green']].map(([v,l])=>`<option value="${v}" ${draft.triage===v?'selected':''}>${l}</option>`).join('')}</select>`)}${field('Current location',input('location','text','maxlength="120" placeholder="Scene / training zone"'))}${field('Report notes',`<textarea name="notes" rows="4" maxlength="600">${esc(draft.notes)}</textarea>`)}<div class="form-actions"><button class="button subtle" type="button" data-back-step>Back</button><button class="button" type="submit">Review report →</button></div></form>`;
 if(formStep===3)html+=`<div class="record-card"><p>INCIDENT</p><strong>${esc(incidentName(draft.incident))}</strong><p>CASUALTY</p><strong>${esc(draft.name)}</strong><p>Age: ${esc(draft.age||'Unknown')} · ${esc(draft.sex)}</p>${triage(draft.triage)}<p>${esc(draft.location||'Location not specified')}</p><p>${esc(draft.notes||'No notes added')}</p></div><div class="notice">${s.offline?'Offline: this report will stay in the demo queue until you reconnect and sync.':'Connected: this report will appear in the web verification queue.'}</div><div class="form-actions"><button class="button subtle" data-back-step>Back</button><button id="submit-report" class="button">${s.offline?'Save to offline queue':'Submit report'}</button></div>`;
 }
 if(mobileView==='records')html=`<p class="eyebrow">RECORDS & SYNCHRONIZATION</p><h2>Your work, accounted for.</h2><div class="panel-title"><h3>Queued (${s.queue.length})</h3><button id="sync-all" class="button subtle" ${s.offline||!s.queue.length?'disabled':''}>Sync all</button></div>${s.queue.length?s.queue.map(r=>recordCard(r,true)).join(''):'<p class="caption">No queued reports on this demo device.</p>'}<h3>Submitted (${s.records.length})</h3>${[...s.records].reverse().map(r=>recordCard(r,false)).join('')}`;
 $('mobile-content').innerHTML=html;
 if($('casualty-form'))$('casualty-form').addEventListener('submit',e=>{e.preventDefault();Object.assign(draft,Object.fromEntries(new FormData(e.target)));formStep++;renderMobile();});
 if($('submit-report'))$('submit-report').addEventListener('click',()=>{try{const row=ReviewModel.submit(draft);toast(s.offline?`${row.id} saved in the demo offline queue.`:`${row.id} submitted to demo verification.`);draft={name:'',age:'',sex:'Unknown',incident:'DEMO-INC-01',triage:'unknown',location:'',notes:''};formStep=1;mobileView='records';renderAll();}catch(e){toast(e.message);}});
 if($('sync-all'))$('sync-all').addEventListener('click',()=>{try{toast(`${ReviewModel.sync()} report(s) synchronized to demo web review.`);renderAll();}catch(e){toast(e.message);}});
}
function recordCard(r,queued){return `<div class="record-card"><div class="panel-title"><strong>${esc(r.id)}</strong>${badge(r.status)}</div><p>${esc(r.name)} · ${esc(r.incident)}</p>${triage(r.triage)}${r.reason?`<p>Correction requested: ${esc(r.reason)}</p>`:''}${queued?'<p>Stored in this demo session. Reconnect to synchronize.</p>':`<button class="table-action" data-detail="${esc(r.id)}">View record →</button>`}</div>`;}
function renderAll(){renderWeb();renderMobile();}
function showDetail(id){const r=ReviewModel.state.records.find(r=>r.id===id);if(!r)return;$('detail-title').textContent=r.id;
 $('detail-content').innerHTML=`<div class="detail-grid"><div><small>CASUALTY</small><p>${esc(r.name)}</p></div><div><small>INCIDENT</small><p>${esc(incidentName(r.incident))}</p></div><div><small>AGE / SEX</small><p>${esc(r.age||'Unknown')} / ${esc(r.sex)}</p></div><div><small>ASSESSMENT</small>${triage(r.triage)}</div><div><small>LOCATION</small><p>${esc(r.location||'Not specified')}</p></div><div><small>REVIEW STATUS</small>${badge(r.status)}</div></div><p class="caption">${esc(r.notes||'No notes added')}</p><h3>Record history</h3><ul class="history">${r.history.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>${webView==='verification'&&!$('web-demo').hidden&&r.status==='submitted'?`<label class="field">Correction reason (required when returning)<textarea id="reject-reason" rows="3" maxlength="500"></textarea></label><p id="review-error" role="alert" class="caption"></p><div class="dialog-actions"><button class="button" data-decision="verified" data-id="${r.id}">Approve record</button><button class="button danger" data-decision="rejected" data-id="${r.id}">Return for correction</button></div>`:''}`;
 $('detail-dialog').showModal();}
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]');if(tab){document.querySelectorAll('.tab-panel').forEach(p=>p.hidden=p.id!==tab.dataset.tab);document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===tab)));}
 const web=e.target.closest('[data-web]');if(web){webView=web.dataset.web;renderWeb();}
 const mobile=e.target.closest('[data-mobile]');if(mobile){saveDraft();mobileView=mobile.dataset.mobile;renderMobile();}
 const back=e.target.closest('[data-back-step]');if(back){if($('casualty-form'))Object.assign(draft,Object.fromEntries(new FormData($('casualty-form'))));formStep=Math.max(1,formStep-1);renderMobile();}
 const detail=e.target.closest('[data-detail]');if(detail)showDetail(detail.dataset.detail);
 const decision=e.target.closest('[data-decision]');if(decision){try{ReviewModel.review(decision.dataset.id,decision.dataset.decision,$('reject-reason').value);$('detail-dialog').close();renderAll();toast(decision.dataset.decision==='verified'?'Demo record verified.':'Demo record returned with correction reason.');}catch(err){$('review-error').textContent=err.message;}}
 const incident=e.target.closest('[data-incident-records]');if(incident){webView='records';incidentFilter=incident.dataset.incident;renderWeb();}
});
$('close-dialog').addEventListener('click',()=>$('detail-dialog').close());
$('wireframe-toggle').addEventListener('change',e=>document.body.classList.toggle('wireframe',e.target.checked));
$('offline-toggle').addEventListener('change',e=>{saveDraft();ReviewModel.state.offline=e.target.checked;renderMobile();});
function showDevice(mobile){$('web-demo').hidden=mobile;$('mobile-demo').hidden=!mobile;$('show-web').setAttribute('aria-pressed',String(!mobile));$('show-mobile').setAttribute('aria-pressed',String(mobile));}
$('show-web').addEventListener('click',()=>showDevice(false));$('show-mobile').addEventListener('click',()=>showDevice(true));
$('reset-demo').addEventListener('click',()=>{ReviewModel.reset();webView='dashboard';mobileView='home';formStep=1;incidentFilter='all';draft={name:'',age:'',sex:'Unknown',incident:'DEMO-INC-01',triage:'unknown',location:'',notes:''};renderAll();toast('Demo restored to its starting state.');});
function renderCatalog(){const q=$('table-search').value.toLowerCase();const rows=(globalThis.SCHEMA_CATALOG||[]).filter(t=>t.name.includes(q));$('table-count').textContent=`${rows.length} table(s) found in reviewed SQL source`;$('schema-catalog').innerHTML=rows.map(t=>`<details><summary>${esc(t.name)} <span class="muted">/ ${t.columns.length} declared fields</span></summary><div><p class="caption">${t.sources.map(esc).join('<br>')}</p><ul>${t.columns.map(c=>`<li><code>${esc(c)}</code></li>`).join('')}</ul><details><summary>Source DDL declarations</summary>${t.definitions.map(d=>`<p class="caption">${esc(d.source)}</p><pre>${esc(d.sql)}</pre>`).join('')}</details></div></details>`).join('');}
$('table-search').addEventListener('input',renderCatalog);renderCatalog();renderAll();
}
