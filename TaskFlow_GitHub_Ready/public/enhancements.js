/* Dashboard enhancements: uses the existing API, models and shared cache. */
(function(){
const $doc=$(document);
const safe=v=>$('<span>').text(String(v??'')).html();
const dayMs=86400000;
function dayDiff(date){if(!date)return null;const d=new Date(date);if(Number.isNaN(d.getTime()))return null;const now=new Date();return Math.round((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(now.getFullYear(),now.getMonth(),now.getDate()))/dayMs)}
function taskAlerts(){return (cache.tasks||[]).filter(t=>t.status!=='done').map(t=>({...t,days:dayDiff(t.dueDate)})).filter(t=>t.days!==null&&t.days<=3).sort((a,b)=>a.days-b.days)}
function deadlineText(days){return days<0?`באיחור של ${Math.abs(days)} ימים`:days===0?'להיום':days===1?'למחר':'בעוד '+days+' ימים'}
function renderDashboard(){
 const tasks=cache.tasks||[],done=tasks.filter(t=>t.status==='done').length,doing=tasks.filter(t=>t.status==='doing').length,todo=tasks.filter(t=>t.status==='todo').length,alerts=taskAlerts(),late=alerts.filter(t=>t.days<0).length;
 const cards=[['סה״כ משימות',tasks.length,'◫','indigo'],['בתהליך',doing,'◷','blue'],['הושלמו',done,'✓','green'],['באיחור',late,'!','rose']];
 $('#quickStats').html(cards.map(c=>`<div class="quick-card ${c[3]}"><span class="quick-icon">${c[2]}</span><span class="quick-value">${c[1]}</span><span class="quick-label">${c[0]}</span></div>`).join(''));
 const percent=tasks.length?Math.round(done/tasks.length*100):0;
 $('#progressWidget').html(`<div class="progress-main"><div class="progress-ring" style="--percent:${percent}"><div><strong>${percent}%</strong><span>הושלמו</span></div></div><div class="progress-details"><div><i class="legend-dot done"></i>הושלמו <b>${done}</b></div><div><i class="legend-dot doing"></i>בטיפול <b>${doing}</b></div><div><i class="legend-dot todo"></i>לביצוע <b>${todo}</b></div></div></div><div class="progress-foot">${tasks.length?`${done} מתוך ${tasks.length} משימות הושלמו`:'צרי משימה ראשונה כדי להתחיל לעקוב'}</div>`);
 $('#attentionList').empty();
 if(!alerts.length){$('#attentionList').html('<div class="empty-state">✓ אין כרגע משימות עם דדליין קרוב או באיחור</div>')}
 else alerts.slice(0,5).forEach(t=>$('#attentionList').append(`<div class="attention-row"><span class="attention-icon ${t.days<0?'urgent':''}">${t.days<0?'!':'◷'}</span><div><strong>${safe(t.title)}</strong><small>${safe(t.priority==='high'?'עדיפות גבוהה':t.priority==='medium'?'עדיפות בינונית':'עדיפות נמוכה')}</small></div><span class="deadline-pill ${t.days<0?'overdue':''}">${deadlineText(t.days)}</span></div>`));
 const notificationItems=alerts.filter(t=>t.days<=1||t.priority==='high');
 $('#notificationCount').text(notificationItems.length).prop('hidden',!notificationItems.length);
 $('#notificationList').html(notificationItems.length?notificationItems.slice(0,12).map(t=>`<div class="notification-item"><span class="notification-icon">${t.days<0?'!':'◷'}</span><div><strong>${safe(t.title)}</strong><small>${deadlineText(t.days)}</small></div></div>`).join(''):'<div class="empty-state">אין התראות חדשות</div>');
 renderKanban();
}
function renderKanban(){const root=$('#kanbanBoard').empty();if(typeof type!=='undefined'&&type!=='tasks'){$('#kanbanPanel').hide();return}$('#kanbanPanel').show();const statuses=[['todo','לביצוע'],['doing','בטיפול'],['done','הושלם']];statuses.forEach(([status,title])=>{const list=(cache.tasks||[]).filter(t=>t.status===status);const col=$(`<div class="kanban-column"><div class="kanban-head"><span class="status-dot ${status}"></span><strong>${title}</strong><span class="kanban-count">${list.length}</span></div><div class="kanban-items"></div></div>`);const body=col.find('.kanban-items');if(!list.length)body.append('<div class="kanban-empty">אין משימות בשלב זה</div>');list.forEach(t=>{const d=dayDiff(t.dueDate);const card=$('<div class="kanban-card">');card.append($('<strong>').text(t.title));const project=cache.projects.find(p=>p._id===t.project);card.append($('<small>').text(project?.name||'משימה'));const foot=$('<div class="kanban-foot">');foot.append($('<span>').addClass('priority-tag '+(t.priority||'medium')).text(labels[t.priority]||'בינונית'));if(d!==null)foot.append($('<span>').addClass('kanban-due '+(d<0&&status!=='done'?'overdue':'')).text(deadlineText(d)));card.append(foot);const selector=$('<select class="status-switch" aria-label="שינוי סטטוס משימה">');statuses.forEach(([s,l])=>selector.append($('<option>').val(s).text(l)));selector.val(status).on('change',async function(){const next=$(this).val();this.disabled=true;try{await api('tasks/'+t._id,'PUT',{status:next});await loadAll();toast('סטטוס המשימה עודכן בהצלחה')}catch(err){alertError(err);this.disabled=false;this.value=status}});card.append(selector);body.append(card)});root.append(col)})}
function toast(message){const el=$('<div class="toast">').text(message).appendTo('#toastArea');setTimeout(()=>el.fadeOut(250,()=>el.remove()),3400)}
const oldLoadAll=loadAll;
loadAll=async function(){await oldLoadAll();renderDashboard()};
$doc.ready(function(){
 $('#todayDate').text(new Intl.DateTimeFormat('he-IL',{day:'numeric',month:'long',year:'numeric'}).format(new Date()));
 $('#notificationBtn').on('click',function(e){e.stopPropagation();const p=$('#notificationPopover');p.prop('hidden',!p.prop('hidden'));$(this).attr('aria-expanded',String(!p.prop('hidden')))});
 $doc.on('click',function(e){if(!$(e.target).closest('.notification-wrap').length){$('#notificationPopover').prop('hidden',true);$('#notificationBtn').attr('aria-expanded','false')}});
 $('#refreshBtn').on('click',async function(){try{await loadAll();toast('הנתונים עודכנו')}catch(e){alertError(e)}});
 $('.side-link').on('click',function(){$('.side-link').removeClass('active');$(this).addClass('active')});
 renderDashboard();
});
})();
