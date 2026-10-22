(() => {
  const client=window.supabase?.createClient('https://sxbfjouuguniegwbevwy.supabase.co','sb_publishable_MqD3lXrftP5B36gcRjpDbw_csTVjpVK');
  const $=id=>document.getElementById(id),status=$('statsStatus');
  let recovering=false;
  client?.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){recovering=true;$('statsLogin').hidden=true;$('statsReport').hidden=true;$('statsReset').hidden=false;status.textContent='בחר סיסמה חדשה לחשבון שלך.';}});
  const labels={page_view:'צפייה בעמוד',cipher_view:'צפייה בכרטיס צופן',cipher_open:'פתיחת צופן',video_play:'הפעלת סרטון',video_open:'פתיחת קישור סרטון',download_click:'לחיצת הורדה'};
  function rows(id,items){const body=$(id);body.replaceChildren();for(const values of items){const tr=document.createElement('tr');for(const v of values){const td=document.createElement('td');td.textContent=String(v??'');tr.appendChild(td);}body.appendChild(tr);}}
  async function load(){
    if(!client){status.textContent='לא ניתן לטעון את שירות ההתחברות. נסה לרענן.';return;}
    $('statsReport').hidden=true;
    const {data:{session}}=await client.auth.getSession();
    if(recovering)return;
    $('statsLogin').hidden=Boolean(session);
    if(!session){status.textContent='נדרשת כניסת מנהל. הסיסמה המקומית של מצב ניהול אינה מספיקה ללא חשבון מנהל מחובר.';return;}
    status.textContent='טוען נתונים…';
    const {data,error}=await client.rpc('site_metric_report',{p_days:Number($('statsDays').value)});
    if(error){$('statsLogin').hidden=false;status.textContent=error.code==='42501'?'לחשבון המחובר אין הרשאה לדוח. היכנס עם חשבון המנהל.':'הדוח אינו זמין כרגע. ייתכן שהגדרת המונים במסד הנתונים טרם הושלמה.';return;}
    $('statsReport').hidden=false;$('statsTotals').replaceChildren();
    for(const [key,label] of Object.entries({visits:'כניסות',page_views:'צפיות בעמודים',cipher_views:'צפיות בכרטיסי צפנים',cipher_opens:'פתיחות צפנים',video_plays:'הפעלות סרטונים',video_opens:'פתיחות קישורי סרטונים',downloads:'לחיצות הורדה'})){
      const card=document.createElement('article'),n=document.createElement('strong'),t=document.createElement('span');n.textContent=Number(data.totals[key]||0).toLocaleString('he-IL');t.textContent=label;card.append(n,t);$('statsTotals').appendChild(card);
    }
    rows('statsDaily',(data.daily||[]).map(d=>[d.day,d.visits,d.views,d.downloads]));
    rows('statsItems',(data.items||[]).map(d=>[labels[d.kind]||d.kind,d.title||d.item,d.item,d.total]));
    $('statsSince').textContent=data.first_event?'האירוע הראשון שנמדד: '+new Date(data.first_event).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}):'המונים מוכנים; טרם התקבלו אירועים.';
    status.textContent='הדוח מעודכן. התקופה מחושבת לאחור מרגע הרענון.';
  }
  $('statsLogin').addEventListener('submit',async e=>{e.preventDefault();if(!client)return;status.textContent='מתחבר…';const {error}=await client.auth.signInWithPassword({email:$('statsEmail').value.trim(),password:$('statsPassword').value});$('statsPassword').value='';if(error){status.textContent='הכניסה לא הצליחה. בדוק את פרטי חשבון המנהל.';return;}await load();});
  $('statsLogout').addEventListener('click',async()=>{await client.auth.signOut();await load();});
  $('statsForgot').addEventListener('click',async()=>{
    if(!client)return;
    const email=$('statsEmail');if(!email.reportValidity())return;
    const button=$('statsForgot');button.disabled=true;status.textContent='שולח בקשת איפוס…';
    try{const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:'https://neriyado20-lab.github.io/site-stats.html'});status.textContent=error?'לא ניתן לשלוח כרגע. נסה שוב מאוחר יותר.':'אם הכתובת משויכת לחשבון, יישלח אליה קישור לקביעת סיסמה חדשה. בדוק גם בדואר הזבל.';}catch{status.textContent='שגיאת חיבור. נסה שוב.';}finally{button.disabled=false;}
  });
  $('statsReset').addEventListener('submit',async e=>{
    e.preventDefault();if(!client||!recovering)return;
    const password=$('statsNewPassword'),confirm=$('statsConfirmPassword'),button=$('statsSavePassword');
    if(password.value.length<12){status.textContent='בחר סיסמה באורך 12 תווים לפחות.';return;}
    if(password.value!==confirm.value){status.textContent='הסיסמאות אינן זהות.';return;}
    button.disabled=true;
    try{const {error}=await client.auth.updateUser({password:password.value});if(error){status.textContent='העדכון לא הצליח. ייתכן שהקישור פג תוקף או שהסיסמה אינה עומדת בדרישות. בקש קישור חדש ונסה שוב.';return;}recovering=false;$('statsReset').hidden=true;await load();}catch{status.textContent='שגיאת חיבור. נסה שוב.';}finally{password.value='';confirm.value='';button.disabled=false;}
  });
  $('statsRefresh').addEventListener('click',load);$('statsDays').addEventListener('change',load);load();
})();
