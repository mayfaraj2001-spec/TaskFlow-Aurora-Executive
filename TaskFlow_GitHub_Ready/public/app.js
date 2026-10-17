/* TaskFlow client: jQuery AJAX + React component + Canvas charts */
const schema={users:{title:'משתמש',fields:[['name','שם מלא','text',true],['email','אימייל','email',true],['role','תפקיד','select',['member','manager']]]},projects:{title:'פרויקט',fields:[['name','שם פרויקט','text',true],['description','תיאור','text'],['status','סטטוס','select',['planning','active','completed']],['owner','אחראי','users',true]]},tasks:{title:'משימה',fields:[['title','כותרת משימה','text',true],['description','תיאור','text'],['project','פרויקט','projects',true],['assignee','אחראי','users',true],['status','סטטוס','select',['todo','doing','done']],['priority','עדיפות','select',['low','medium','high']],['dueDate','תאריך יעד','date']]}};
const labels={todo:'לביצוע',doing:'בטיפול',done:'הושלם',planning:'בתכנון',active:'פעיל',completed:'הסתיים',low:'נמוכה',medium:'בינונית',high:'גבוהה',member:'חבר צוות',manager:'מנהל'};
let type='tasks',editing=null,cache={users:[],projects:[],tasks:[]},charts=[];
function alertError(xhr){alert(xhr.responseJSON?.error||'שגיאת שרת. נסי שוב.')}function api(url,method='GET',data){return $.ajax({url:'/api/'+url,method,contentType:'application/json',data:data?JSON.stringify(data):undefined})}
async function refreshCache(){for(const key of ['users','projects','tasks'])cache[key]=await api(key)}
function fieldHTML(f){const [key,title,kind,required]=f;let control='';if(kind==='select')control='<select name="'+key+'">'+required.map(x=>'<option value="'+x+'">'+(labels[x]||x)+'</option>').join('')+'</select>';else if(['users','projects'].includes(kind))control='<select name="'+key+'" required><option value="">בחרי...</option>'+cache[kind].map(x=>'<option value="'+x._id+'">'+$('<div>').text(x.name).html()+'</option>').join('')+'</select>';else control='<input name="'+key+'" type="'+kind+'" '+(required?'required':'')+'>';return '<label>'+title+control+'</label>'}
function renderForm(){const c=schema[type];$('#formTitle').text((editing?'עריכת ':'יצירת ')+c.title);$('#fields').html(c.fields.map(fieldHTML).join(''));if(editing){const row=cache[type].find(x=>x._id===editing);if(row)for(const f of c.fields)$('[name="'+f[0]+'"]').val(f[2]==='date'&&row[f[0]]?row[f[0]].slice(0,10):row[f[0]]||'')}}
function filters(){const statusOptions=type==='tasks'?['todo','doing','done']:type==='projects'?['planning','active','completed']:['member','manager'];$('#filterStatus').html('<option value="">כל הסטטוסים</option>'+statusOptions.map(x=>'<option value="'+x+'">'+(labels[x]||x)+'</option>').join(''));$('#filterPriority').toggle(type==='tasks').html('<option value="">כל העדיפויות</option>'+['low','medium','high'].map(x=>'<option value="'+x+'">'+labels[x]+'</option>').join(''))}
function displayName(row){return row.title||row.name||row.email}function renderRows(rows){const root=$('#records').empty();if(!rows.length){root.text('אין נתונים להצגה');return}rows.forEach(row=>{const item=$('<div class="item">'),left=$('<div>'),right=$('<div>');left.append($('<strong>').text(displayName(row)));left.append($('<small>').text([row.description,row.status&&labels[row.status],row.priority&&labels[row.priority]].filter(Boolean).join(' • ')));$('<button>').text('עריכה').on('click',()=>{editing=row._id;renderForm();document.getElementById('recordForm').scrollIntoView({behavior:'smooth'})}).appendTo(right);$('<button class="delete">').text('מחיקה').on('click',async()=>{if(!confirm('למחוק את הרשומה?'))return;try{await api(type+'/'+row._id,'DELETE');await loadAll()}catch(e){alertError(e)}}).appendTo(right);item.append(left,right).appendTo(root)})}
async function search(){const p=new URLSearchParams(),q=$('#searchText').val().trim(),s=$('#filterStatus').val(),priority=$('#filterPriority').val();if(q)p.set('q',q);if(s)p.set(type==='users'?'role':'status',s);if(priority&&type==='tasks')p.set('priority',priority);try{renderRows(await api(type+'?'+p))}catch(e){alertError(e)}}
async function renderStats(){const data=await api('stats');$('#metrics').html([['משתמשים',data.users],['פרויקטים',data.projects],['משימות',data.tasks]].map(x=>'<div class="metric"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join(''));charts.forEach(c=>c.destroy());charts=[];if(typeof Chart==='undefined')return;for(const [id,values,keys] of [['statusChart',data.status,['todo','doing','done']],['priorityChart',data.priority,['low','medium','high']]]){const counts=keys.map(k=>values.find(x=>x._id===k)?.count||0);charts.push(new Chart(document.getElementById(id),{type:id==='statusChart'?'doughnut':'bar',data:{labels:keys.map(k=>labels[k]),datasets:[{data:counts,backgroundColor:['#6c5ce7','#9c8ff0','#c7c0f7'],borderRadius:8}]},options:{responsive:true,plugins:{legend:{display:false}}}}))}}
async function loadAll(){await refreshCache();renderForm();await search();await renderStats()}
$(async function(){$('.tabs button').on('click',async function(){type=$(this).data('type');editing=null;$('#searchText').val('');$('.tabs button').removeClass('selected');$(this).addClass('selected');filters();await loadAll()});$('#searchBtn').on('click',search);$('#searchText').on('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search()}});$('#cancelEdit').on('click',()=>{editing=null;renderForm()});$('#recordForm').on('submit',async function(e){e.preventDefault();const obj={};$(this).serializeArray().forEach(x=>{if(x.value)obj[x.name]=x.value});try{await api(type+(editing?'/'+editing:''),editing?'PUT':'POST',obj);editing=null;await loadAll()}catch(err){alertError(err)}});filters();try{await loadAll()}catch(err){alertError(err)}});
const socket=io();socket.on('chatMessage',m=>{const bubble=$('<div class="bubble">');bubble.append($('<strong>').text(m.name+': '),$('<span>').text(m.text));$('#messages').append(bubble).scrollTop($('#messages')[0].scrollHeight)});$('#chatForm').on('submit',function(e){e.preventDefault();socket.emit('chatMessage',{name:$('#chatName').val(),text:$('#chatText').val()});$('#chatText').val('')});
if(window.React&&window.ReactDOM){const e=React.createElement;ReactDOM.createRoot(document.getElementById('reactHero')).render(e('div',{className:'hero-graphic'},e('div',null,'✓',e('small',null,'Plan · Track · Deliver'))))}

/* React media showcase: both HTML5 Video and Canvas are rendered by React. */
if (window.React && window.ReactDOM && document.getElementById('reactMedia')) {
  const h = React.createElement;
  function MediaShowcase() {
    const canvasRef = React.useRef(null);
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = canvas.width, height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#6b5de0');
      gradient.addColorStop(1, '#29b6a8');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('TaskFlow', width / 2, 50);
      ctx.font = '16px Arial';
      ctx.fillText('Plan  •  Track  •  Deliver', width / 2, 82);
    }, []);
    return h('div', { className: 'react-media-showcase' },
      h('video', { controls: true, muted: true, playsInline: true, preload: 'metadata', 'aria-label': 'סרטון הדגמת TaskFlow' },
        h('source', { src: '/intro.mp4', type: 'video/mp4' }),
        'הדפדפן אינו תומך בווידאו'),
      h('canvas', { ref: canvasRef, width: 480, height: 110, role: 'img', 'aria-label': 'איור Canvas של TaskFlow שנוצר ברכיב React' })
    );
  }
  ReactDOM.createRoot(document.getElementById('reactMedia')).render(h(MediaShowcase));
}
