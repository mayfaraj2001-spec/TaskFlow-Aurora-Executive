/* Optional UX controls; no changes to data/API */
(function(){
  function start(){
    const bar=document.createElement('nav');
    bar.className='tf-quickbar';bar.setAttribute('aria-label','פעולות מהירות');
    bar.innerHTML='<span class="tf-pulse" aria-hidden="true"></span><a class="tf-main" href="#manage">＋ משימה</a><a href="#insights">◫ מדדים</a><a href="#executive">◈ דוח הנהלה</a><button class="tf-theme-toggle" type="button" aria-label="החלפת מצב תצוגה" title="מצב בהיר / כהה">◐</button>';
    document.body.appendChild(bar);
    const btn=bar.querySelector('button');
    btn.addEventListener('click',function(){const dark=document.body.classList.toggle('tf-dark');btn.setAttribute('aria-pressed',String(dark));try{localStorage.setItem('tf_theme',dark?'dark':'light')}catch(e){}});
    try{if(localStorage.getItem('tf_theme')==='dark'){document.body.classList.add('tf-dark');btn.setAttribute('aria-pressed','true')}}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
