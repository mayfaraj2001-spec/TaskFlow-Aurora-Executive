/* Executive reporting. Reports are built from MongoDB at request time. */
const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const ExcelJS = require('exceljs');
const pptxgen = require('pptxgenjs');
const statusLabel = {todo:'לביצוע',doing:'בטיפול',done:'הושלם'};
const priorityLabel = {low:'נמוכה',medium:'בינונית',high:'גבוהה'};
const projectStatus = {planning:'בתכנון',active:'פעיל',completed:'הסתיים'};
const day = 86400000;
const localDay = d => { const x = new Date(d); return Date.UTC(x.getFullYear(),x.getMonth(),x.getDate()); };
const safeCell = value => { const s=String(value??''); return /^[\s]*[=+@\-\t\r]/.test(s) ? "'"+s : s; };
const fmtDate = d => d ? new Date(d).toLocaleDateString('he-IL',{timeZone:'Asia/Jerusalem'}) : '—';
const palette = {navy:'162442',purple:'6555E9',green:'16A87A',red:'E45576',muted:'71809B',light:'F3F5FC',white:'FFFFFF',amber:'D78B2C'};
async function getData(req){
 const id = req.query.project || '';
 if(id && !mongoose.isValidObjectId(id)){ const err=new Error('מזהה פרויקט לא תקין');err.status=400;throw err; }
 const [projects,users,tasks] = await Promise.all([
  Project.find(id?{_id:id}:{}).lean(),User.find().lean(),Task.find(id?{project:id}:{}).sort({dueDate:1,createdAt:-1}).lean()
 ]);
 if(id && !projects.length){const err=new Error('הפרויקט לא נמצא');err.status=404;throw err;}
 const projMap=new Map(projects.map(p=>[String(p._id),p]));
 const userMap=new Map(users.map(u=>[String(u._id),u]));
 const today=localDay(new Date());
 const items=tasks.map(t=>{
  const due=t.dueDate?localDay(t.dueDate):null;
  const days=due===null?null:Math.round((due-today)/day);
  return {id:String(t._id),title:t.title||'',description:t.description||'',project:projMap.get(String(t.project))?.name||'לא ידוע',assignee:userMap.get(String(t.assignee))?.name||'לא ידוע',status:t.status||'todo',priority:t.priority||'medium',dueDate:t.dueDate,days,overdue:t.status!=='done'&&days!==null&&days<0,upcoming:t.status!=='done'&&days!==null&&days>=0&&days<=7};
 });
 const total=items.length,completed=items.filter(t=>t.status==='done').length,inProgress=items.filter(t=>t.status==='doing').length,pending=items.filter(t=>t.status==='todo').length,overdue=items.filter(t=>t.overdue).length,upcoming=items.filter(t=>t.upcoming).length,highOpen=items.filter(t=>t.priority==='high'&&t.status!=='done').length;
 const byProject=projects.map(p=>{const ts=items.filter(t=>t.project===p.name);const done=ts.filter(t=>t.status==='done').length;return {name:p.name,status:p.status,total:ts.length,done,completion:ts.length?Math.round(done/ts.length*100):0,overdue:ts.filter(t=>t.overdue).length};});
 const completion=total?Math.round(completed/total*100):0;
 const alerts=items.filter(t=>t.overdue||t.upcoming||(t.priority==='high'&&t.status!=='done')).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||(a.days??99999)-(b.days??99999));
 const timeline=items.filter(t=>t.status!=='done'&&t.days!==null).sort((a,b)=>a.days-b.days).slice(0,8);
 return {generatedAt:new Date().toISOString(),projectId:id,projectName:id?projects[0].name:'כל הפרויקטים',projectCount:projects.length,userCount:users.length,total,completed,inProgress,pending,overdue,upcoming,highOpen,completion,items,byProject,alerts,timeline};
}
function publicSummary(d){const {items,...rest}=d;return rest;}
exports.summary=async(req,res)=>res.json(publicSummary(await getData(req)));
exports.excel=async(req,res)=>{
 const d=await getData(req),wb=new ExcelJS.Workbook();wb.creator='TaskFlow';wb.created=new Date();wb.subject='דוח ניהולי על מצב הפרויקטים';
 const overview=wb.addWorksheet('סיכום מנהלים',{views:[{rightToLeft:true,showGridLines:false}]});
 overview.columns=[{width:34},{width:22},{width:24},{width:24}];
 overview.mergeCells('A1:D2');overview.getCell('A1').value='TaskFlow | דוח מצב מנהלים';overview.getCell('A1').font={size:21,bold:true,color:{argb:'FFFFFFFF'}};overview.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF162442'}};overview.getCell('A1').alignment={vertical:'middle',horizontal:'right'};
 overview.addRow(['היקף הדוח',safeCell(d.projectName)]);overview.addRow(['הופק בתאריך',fmtDate(d.generatedAt)]);overview.addRow([]);
 for(const [label,val] of [['מספר פרויקטים',d.projectCount],['משימות',d.total],['משימות שהושלמו',d.completed],['משימות בטיפול',d.inProgress],['משימות לביצוע',d.pending],['אחוז השלמה',d.completion/100],['משימות באיחור',d.overdue],['משימות עם יעד בשבוע הקרוב',d.upcoming],['משימות פתוחות בעדיפות גבוהה',d.highOpen]]){const row=overview.addRow([label,val]);row.getCell(1).font={bold:true,color:{argb:'FF162442'}};row.getCell(2).font={bold:true,color:{argb:'FF6555E9'}};if(label==='אחוז השלמה')row.getCell(2).numFmt='0%';}
 overview.addRow([]);overview.addRow(['הערה','הנתונים משקפים מצב נוכחי בעת הפקת הדוח.']);
 const tasks=wb.addWorksheet('פירוט משימות',{views:[{rightToLeft:true,state:'frozen',ySplit:1}]});
 tasks.columns=[{header:'משימה',key:'title',width:35},{header:'פרויקט',key:'project',width:28},{header:'אחראי',key:'assignee',width:24},{header:'סטטוס',key:'status',width:17},{header:'עדיפות',key:'priority',width:17},{header:'תאריך יעד',key:'due',width:18},{header:'ימים ליעד',key:'days',width:15},{header:'באיחור',key:'late',width:15},{header:'תיאור',key:'description',width:42}];
 d.items.forEach(t=>tasks.addRow({title:safeCell(t.title),project:safeCell(t.project),assignee:safeCell(t.assignee),status:statusLabel[t.status]||t.status,priority:priorityLabel[t.priority]||t.priority,due:t.dueDate?new Date(t.dueDate):null,days:t.days??'',late:t.overdue?'כן':'לא',description:safeCell(t.description)}));
 tasks.getColumn('due').numFmt='dd/mm/yyyy';tasks.autoFilter={from:'A1',to:'I'+Math.max(2,d.items.length+1)};
 tasks.getRow(1).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF162442'}};c.font={bold:true,color:{argb:'FFFFFFFF'}};c.alignment={vertical:'middle'}});tasks.getRow(1).height=26;
 for(let i=2;i<=d.items.length+1;i++){if(i%2===0)tasks.getRow(i).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F5FC'}};if(d.items[i-2]?.overdue)tasks.getCell(`H${i}`).font={bold:true,color:{argb:'FFE45576'}};}
 const projs=wb.addWorksheet('מצב פרויקטים',{views:[{rightToLeft:true}]});projs.columns=[{header:'פרויקט',key:'name',width:38},{header:'סטטוס',key:'status',width:18},{header:'משימות',key:'total',width:16},{header:'הושלמו',key:'done',width:16},{header:'השלמה',key:'completion',width:18},{header:'באיחור',key:'overdue',width:16}];
 d.byProject.forEach(p=>projs.addRow({...p,name:safeCell(p.name),status:projectStatus[p.status]||p.status,completion:p.completion/100}));projs.getColumn('completion').numFmt='0%';projs.getRow(1).eachCell(c=>{c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF162442'}};c.font={bold:true,color:{argb:'FFFFFFFF'}}});
 const buffer=await wb.xlsx.writeBuffer();res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.set('Content-Disposition','attachment; filename="TaskFlow_Executive_Report.xlsx"');res.send(Buffer.from(buffer));
};
exports.slides=async(req,res)=>{
 const d=await getData(req),pptx=new pptxgen();pptx.layout='LAYOUT_WIDE';pptx.author='TaskFlow';pptx.subject='דוח מצב פרויקטים';pptx.title='TaskFlow | דוח הנהלה';pptx.lang='he-IL';pptx.theme={headFontFace:'Arial',bodyFontFace:'Arial',lang:'he-IL'};
 const W=13.333,H=7.5;
 function bg(slide,dark=false){slide.background={color:dark?palette.navy:'F6F8FD'};slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:W,h:.1,line:{color:palette.purple},fill:{color:palette.purple}});}
 function txt(slide,value,x,y,w,h,opt={}){slide.addText(String(value),{x,y,w,h,fontFace:'Arial',fontSize:16,color:palette.navy,align:'right',rtlMode:true,margin:0,breakLine:false,...opt});}
 function title(slide,t,sub){txt(slide,t,1,0.5,11.3,.6,{fontSize:27,bold:true});if(sub)txt(slide,sub,1,1.13,11.3,.4,{fontSize:12,color:palette.muted});}
 function box(slide,x,y,w,h,color='FFFFFF'){slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.16,line:{color:'E8EDF6'},fill:{color},radius:.15});}
 function footer(slide,num){txt(slide,`TaskFlow  •  ${fmtDate(d.generatedAt)}  •  ${num}`,0.8,7.15,11.7,.2,{fontSize:9,color:palette.muted,align:'left'});}
 let s=pptx.addSlide();bg(s,true);txt(s,'TASKFLOW  /  EXECUTIVE BRIEF',1.1,1.15,11,.45,{fontSize:16,color:'AAA3FF',bold:true});txt(s,'תמונת מצב למנהלים',1.1,2.02,11,.85,{fontSize:36,bold:true,color:'FFFFFF'});txt(s,d.projectName,1.1,3.05,11,.55,{fontSize:21,color:'D9DEFA'});txt(s,`נכון לתאריך ${fmtDate(d.generatedAt)}`,1.1,4.1,11,.35,{fontSize:14,color:'ABB8D4'});footer(s,1);
 s=pptx.addSlide();bg(s);title(s,'המדדים המרכזיים','סיכום ביצועי הפרויקטים בזמן הפקת הדוח');
 const cards=[['משימות',d.total],['הושלמו',d.completed],['אחוז השלמה',`${d.completion}%`],['באיחור',d.overdue],['בטיפול',d.inProgress],['בעדיפות גבוהה',d.highOpen]];
 cards.forEach(([name,value],i)=>{const x=1+(i%3)*3.82,y=1.9+Math.floor(i/3)*2.05;box(s,x,y,3.5,1.65);txt(s,name,x+.2,y+.2,3.05,.32,{fontSize:13,color:palette.muted});txt(s,value,x+.2,y+.68,3.05,.66,{fontSize:30,bold:true,color:i===3?palette.red:palette.purple})});footer(s,2);
 s=pptx.addSlide();bg(s);title(s,'סטטוס המשימות','התפלגות משימות לפי שלב ביצוע');
 const states=[['הושלם',d.completed,palette.green],['בטיפול',d.inProgress,palette.purple],['לביצוע',d.pending,palette.amber]];
 states.forEach(([label,n,color],i)=>{const y=2.02+i*1.32;txt(s,label,9.6,y,2.2,.36,{fontSize:16,bold:true});box(s,2.0,y+.46,9.75,.33,'E6EAF3');if(d.total&&n){s.addShape(pptx.ShapeType.roundRect,{x:2.0,y:y+.46,w:Math.max(.09,9.75*n/d.total),h:.33,line:{color},fill:{color}})}txt(s,`${n}  |  ${d.total?Math.round(n/d.total*100):0}%`,2.0,y-.02,3.5,.36,{fontSize:14,color});});footer(s,3);
 s=pptx.addSlide();bg(s);title(s,'סיכונים ופעולות נדרשות','משימות שדורשות תשומת לב ניהולית');
 const alerts=d.alerts.slice(0,5);if(!alerts.length)txt(s,'אין כרגע משימות חריגות לפי הקריטריונים שהוגדרו.',1.2,2.2,10.9,.6,{fontSize:20,color:palette.green});
 alerts.forEach((t,i)=>{const y=1.7+i*.9;box(s,1.05,y,11.15,.75);txt(s,t.title.slice(0,75),5.5,y+.14,6.3,.35,{fontSize:15,bold:true});txt(s,t.overdue?'באיחור':t.upcoming?'יעד קרוב':'עדיפות גבוהה',2.7,y+.15,2.5,.3,{fontSize:12,color:t.overdue?palette.red:palette.amber});txt(s,t.project.slice(0,25),1.25,y+.16,1.5,.3,{fontSize:10,color:palette.muted});});footer(s,4);
 s=pptx.addSlide();bg(s);title(s,'תמונת מצב לפי פרויקט','השוואה בין פרויקטים, כאשר נבחר דוח כלל ארגוני');
 const ps=d.byProject.slice(0,6);if(!ps.length)txt(s,'אין פרויקטים להצגה',1.2,2.1,11,.5,{fontSize:18});
 ps.forEach((p,i)=>{const y=1.7+i*.75;box(s,1.05,y,11.2,.62);txt(s,p.name.slice(0,45),7.7,y+.13,4.3,.3,{fontSize:13,bold:true});txt(s,`${p.completion}% הושלמו`,4.9,y+.13,2.4,.3,{fontSize:12,color:palette.green});txt(s,`${p.overdue} באיחור`,2.6,y+.13,1.9,.3,{fontSize:12,color:p.overdue?palette.red:palette.muted});txt(s,`${p.total} משימות`,1.25,y+.13,1.2,.3,{fontSize:11,color:palette.muted});});footer(s,5);
 s=pptx.addSlide();bg(s,true);txt(s,'הצעדים הבאים',1.0,1.2,11.3,.8,{fontSize:33,bold:true,color:'FFFFFF'});const steps=['טיפול במשימות באיחור ובחסמים','תעדוף משימות פתוחות בעדיפות גבוהה','עדכון סטטוסים ומועדי יעד באופן שוטף'];steps.forEach((t,i)=>txt(s,`${i+1}.  ${t}`,1.15,2.5+i*.95,10.8,.5,{fontSize:19,color:'E4E8FF'}));txt(s,'מבוסס על נתוני המערכת; ההמלצות הן כלליות ולא ניתוח סיבתי.',1.15,6.5,10.9,.3,{fontSize:10,color:'9BAAC8'});footer(s,6);
 const buf=await pptx.write({outputType:'nodebuffer'});res.set('Content-Type','application/vnd.openxmlformats-officedocument.presentationml.presentation');res.set('Content-Disposition','attachment; filename="TaskFlow_Executive_Brief.pptx"');res.send(Buffer.from(buf));
};
