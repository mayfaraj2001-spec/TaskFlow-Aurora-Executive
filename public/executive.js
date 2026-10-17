/* Executive dashboard — read-only reporting on live MongoDB data. */
(function(){
 const $ = window.jQuery;
 if(!$)return;
 const html=v=>$('<div>').text(String(v??'')).html();
 const asText=n=>new Intl.NumberFormat('he-IL').format(n||0);
 const dateText=s=>s?new Date(s).toLocaleDateString('he-IL'):'לא נקבע';
 let current=null;
 function pill(text,kind){return `<span class="exec-tag ${kind||''}">${html(text)}</span>`;}
 function draw(d){
  current=d;
  const cards=[['אחוז השלמה',`${d.completion}%`,'↗','violet'],['משימות פעילות',asText(d.inProgress+d.pending),'◷','cyan'],['משימות באיחור',asText(d.overdue),'!','pink'],['פרויקטים',asText(d.projectCount),'▦','green']];
  $('#executiveKpis').html(cards.map(([title,value,icon,color])=>`<div class="exec-kpi ${color}"><span class="exec-kpi-icon">${icon}</span><strong>${value}</strong><span>${title}</span><div class="exec-kpi-glow"></div></div>`).join(''));
  const total=d.total||0;
  $('#executiveHealth').html(`<div class="exec-health-score"><div class="exec-donut" style="--done:${d.completion}"><div><b>${d.completion}%</b><small>השלמה</small></div></div><div class="exec-health-legend"><div><i class="exec-dot done"></i>הושלמו <b>${d.completed}</b></div><div><i class="exec-dot doing"></i>בטיפול <b>${d.inProgress}</b></div><div><i class="exec-dot todo"></i>לביצוע <b>${d.pending}</b></div></div></div><div class="exec-insight-line">${total?`מתוך ${total} משימות, ${d.completed} הושלמו.`:'אין עדיין משימות לניתוח.'}</div>`);
  const riskRows=[['משימות באיחור',d.overdue,'critical'],['יעד בשבוע הקרוב',d.upcoming,'warning'],['פתוחות בעדיפות גבוהה',d.highOpen,'notice']];
  $('#executiveRisks').html(riskRows.map(([name,n,kind])=>`<div class="exec-risk-row"><div><span class="exec-risk-mark ${kind}"></span><strong>${name}</strong></div>${pill(n,kind)}</div>`).join('')+`<div class="exec-insight-line">התראות מבוססות תאריך יעד, סטטוס ועדיפות.</div>`);
  const items=d.timeline||[];
  $('#executiveTimeline').html(items.length?items.map(t=>`<div class="exec-timeline-item"><div class="exec-timeline-mark ${t.overdue?'late':''}"></div><div class="exec-timeline-content"><strong>${html(t.title)}</strong><small>${html(t.project)} · ${html(t.assignee)}</small></div><div class="exec-timeline-end">${pill(t.overdue?'באיחור':t.days===0?'היום':`עוד ${t.days} ימים`,t.overdue?'critical':'notice')}<small>${html(dateText(t.dueDate))}</small></div></div>`).join(''):'<div class="exec-empty">אין כרגע משימות פתוחות עם תאריך יעד.</div>');
  $('#executiveStatus').text(`נתונים מעודכנים · ${new Date(d.generatedAt).toLocaleString('he-IL')} · ${d.projectName}`);
 }
 async function load(){try{const id=$('#executiveProject').val();$('#executiveStatus').text('מעדכנת נתוני הנהלה...');const data=await $.getJSON('/api/reports/summary'+(id?'?project='+encodeURIComponent(id):''));draw(data)}catch(e){$('#executiveStatus').text('לא ניתן לטעון את נתוני ההנהלה. בדקי את חיבור השרת.')}}
 async function projects(){try{const rows=await $.getJSON('/api/projects');const sel=$('#executiveProject'),old=sel.val();sel.empty().append($('<option>').val('').text('כל הפרויקטים'));rows.forEach(p=>sel.append($('<option>').val(p._id).text(p.name)));if(old&&rows.some(p=>p._id===old))sel.val(old)}catch(e){/* Report endpoint will display its own error. */}}
 async function download(kind){const btn=kind==='excel'?$('#exportExcel'):$('#exportSlides');const original=btn.html();btn.prop('disabled',true).text('מכינה את הדוח...');try{const project=$('#executiveProject').val(),url='/api/reports/'+kind+(project?'?project='+encodeURIComponent(project):'');const response=await fetch(url);if(!response.ok){let msg='יצירת הדוח נכשלה';try{const obj=await response.json();msg=obj.error||msg}catch{}throw new Error(msg)}const blob=await response.blob();const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download=kind==='excel'?'TaskFlow_Executive_Report.xlsx':'TaskFlow_Executive_Brief.pptx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),3000);$('#executiveStatus').text('הדוח נוצר וההורדה החלה.')}catch(e){$('#executiveStatus').text(e.message||'שגיאה ביצירת הדוח')}finally{btn.prop('disabled',false).html(original)}}
 $(function(){
  $('#executiveProject').on('change',load);
  $('#exportExcel').on('click',()=>download('excel'));
  $('#exportSlides').on('click',()=>download('slides'));
  $('#refreshBtn').on('click',()=>{projects().then(load)});
  $('#executive').on('mouseenter',()=>{if(!current)load()});
  projects().then(load);
 });
})();
