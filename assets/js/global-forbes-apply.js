(()=>{
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY = 'br_global_forbes_request_id';
  const MAX_IMAGE_BYTES = 850000;
  let db = null;

  function initFirebase(){
    try{
      if(!window.firebase || !window.BR_FIREBASE_CONFIG) return null;
      if(!firebase.apps.length) firebase.initializeApp(window.BR_FIREBASE_CONFIG);
      return firebase.database();
    }catch(e){ console.warn('Global Forbes apply Firebase unavailable', e); return null; }
  }

  function showMessage(text, type=''){
    document.querySelectorAll('[data-global-apply-message]').forEach(el=>{
      el.textContent = text;
      el.className = `gfa-message ${type}`.trim();
    });
  }

  async function compressImage(file){
    if(!file) return '';
    if(!/^image\//i.test(file.type)) throw new Error('Выберите изображение со скриншотом.');
    if(file.size > 12*1024*1024) throw new Error('Скриншот слишком большой. Максимум 12 МБ до сжатия.');
    const dataUrl = await new Promise((resolve,reject)=>{
      const fr=new FileReader(); fr.onload=()=>resolve(fr.result); fr.onerror=reject; fr.readAsDataURL(file);
    });
    const img = await new Promise((resolve,reject)=>{
      const im=new Image(); im.onload=()=>resolve(im); im.onerror=()=>reject(new Error('Не удалось прочитать скриншот.')); im.src=dataUrl;
    });
    let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    const maxSide=1280;
    if(Math.max(w,h)>maxSide){ const k=maxSide/Math.max(w,h); w=Math.round(w*k); h=Math.round(h*k); }
    const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
    canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,w,h);
    let q=.82, out=canvas.toDataURL('image/jpeg',q);
    while(out.length*0.75>MAX_IMAGE_BYTES && q>.46){ q-=.08; out=canvas.toDataURL('image/jpeg',q); }
    if(out.length*0.75>MAX_IMAGE_BYTES) throw new Error('Не удалось достаточно сжать скриншот. Попробуйте изображение поменьше.');
    return out;
  }

  function formMarkup(){
    return `<form class="gfa-form gfa-form-v2" data-global-forbes-apply-form>
      <section class="gfa-section">
        <div class="gfa-section-head">
          <span class="gfa-step">01</span>
          <div><h3>Данные игрока</h3><p>Укажи информацию ровно так, как она должна появиться в Общем Forbes.</p></div>
        </div>
        <div class="gfa-grid">
          <label class="gfa-field"><span>Игровой ник <b>*</b></span><input name="nickname" required maxlength="40" placeholder="Nickname_Player" autocomplete="off"><small>Без тегов и лишних символов.</small></label>
          <label class="gfa-field"><span>Сервер <b>*</b></span><input name="server" required maxlength="6" placeholder="78" inputmode="numeric"><small>Например: 78.</small></label>
          <label class="gfa-field"><span>Имя / подпись</span><input name="name" maxlength="80" placeholder="Как подписать в списке"><small>Можно оставить пустым.</small></label>
          <label class="gfa-field"><span>Ваш VK</span><input name="vk" type="url" maxlength="300" placeholder="https://vk.com/..."><small>Для связи при проверке.</small></label>
        </div>
      </section>

      <section class="gfa-section gfa-proof-section">
        <div class="gfa-section-head">
          <span class="gfa-step">02</span>
          <div><h3>Доказательство</h3><p>Достаточно одного варианта: скриншота <strong>или</strong> ссылки на публикацию VK.</p></div>
        </div>
        <div class="gfa-proof-grid">
          <label class="gfa-upload-card">
            <input name="proofFile" type="file" accept="image/*" hidden>
            <span class="gfa-upload-icon">📸</span>
            <strong>Загрузить скриншот</strong>
            <span class="gfa-upload-copy">Нажми, чтобы выбрать изображение</span>
            <small>JPG / PNG • до 12 МБ • изображение будет сжато</small>
            <div class="gfa-upload-selected" data-global-proof-selected>Файл не выбран</div>
          </label>
          <div class="gfa-proof-or"><span>ИЛИ</span></div>
          <label class="gfa-proof-link gfa-field"><span>Ссылка на доказательство VK</span><input name="proofUrl" type="url" maxlength="1000" placeholder="https://vk.com/wall... или ссылка на фото"><small>Подойдёт пост, фото или альбом, где видны ник и факт присутствия в Forbes.</small></label>
        </div>
        <div class="gfa-preview" data-global-proof-preview hidden><div class="gfa-preview-head"><span>Предпросмотр скриншота</span><button type="button" data-global-proof-clear>Удалить</button></div><img alt="Предпросмотр доказательства"></div>
      </section>

      <section class="gfa-section">
        <div class="gfa-section-head">
          <span class="gfa-step">03</span>
          <div><h3>Комментарий</h3><p>Необязательно, но поможет быстрее проверить заявку.</p></div>
        </div>
        <label class="gfa-field"><span>Комментарий для администрации</span><textarea name="comment" maxlength="500" rows="4" placeholder="Например: публикация от 21 сентября, место #24, сервер 78…"></textarea><small>Максимум 500 символов.</small></label>
      </section>

      <label class="gfa-check gfa-confirm-v2"><input name="confirm" type="checkbox" required><span><b>Подтверждаю корректность данных</b><small>Ник, сервер и доказательство относятся к моей записи в Forbes.</small></span></label>
      <div class="gfa-actions gfa-actions-v2"><button class="gfa-primary" type="submit"><span>Отправить заявку</span><i>→</i></button><button class="gfa-secondary" type="button" data-global-apply-close>Отмена</button></div>
      <div class="gfa-message" data-global-apply-message role="status" aria-live="polite"></div>
    </form>`;
  }

  function wireForm(form){
    const input=form.querySelector('input[name="proofFile"]');
    const preview=form.querySelector('[data-global-proof-preview]');
    const selected=form.querySelector('[data-global-proof-selected]');
    const clearBtn=form.querySelector('[data-global-proof-clear]');
    let previewUrl='';
    const resetPreview=()=>{
      if(previewUrl){ try{URL.revokeObjectURL(previewUrl);}catch(_){} previewUrl=''; }
      if(input) input.value='';
      if(preview) preview.hidden=true;
      if(selected) selected.textContent='Файл не выбран';
    };
    input?.addEventListener('change',()=>{
      const f=input.files?.[0];
      if(!f){ resetPreview(); return; }
      if(previewUrl){ try{URL.revokeObjectURL(previewUrl);}catch(_){} }
      previewUrl=URL.createObjectURL(f);
      if(selected) selected.textContent=`Выбран: ${f.name}`;
      if(preview){ preview.hidden=false; preview.querySelector('img').src=previewUrl; }
    });
    clearBtn?.addEventListener('click',resetPreview);
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const button=form.querySelector('button[type="submit"]');
      const fd=new FormData(form);
      const nickname=String(fd.get('nickname')||'').trim();
      const server=String(fd.get('server')||'').trim();
      const name=String(fd.get('name')||'').trim();
      const vk=String(fd.get('vk')||'').trim();
      const proofUrl=String(fd.get('proofUrl')||'').trim();
      const comment=String(fd.get('comment')||'').trim();
      const file=input?.files?.[0] || null;
      if(!nickname || !server){ showMessage('Укажите ник и сервер.','error'); return; }
      if(vk && !/^https:\/\//i.test(vk)){ showMessage('VK-ссылка должна начинаться с https://','error'); return; }
      if(proofUrl && !/^https:\/\//i.test(proofUrl)){ showMessage('Ссылка на доказательство должна начинаться с https://','error'); return; }
      if(!file && !proofUrl){ showMessage('Добавьте скриншот или ссылку на доказательство в VK.','error'); return; }
      if(!db) db=initFirebase();
      if(!db){ showMessage('Firebase сейчас недоступен. Попробуйте позже.','error'); return; }
      button.disabled=true; showMessage('Сжимаем доказательство и отправляем…','');
      try{
        if((await db.ref('settings/emergency/requestsClosed').once('value')).val()===true)throw new Error('Приём заявок временно закрыт на технические работы.');
        const proofImage=file ? await compressImage(file) : '';
        const ref=db.ref('forbesRequests').push();
        const value={
          scope:'global', type:'join', requestId:ref.key,
          nickname:nickname.slice(0,40), server:server.slice(0,6), name:name.slice(0,80),
          vk:vk.slice(0,300), proofUrl:proofUrl.slice(0,1000), proofImage,
          comment:comment.slice(0,500), status:'pending', createdAt:Date.now(), source:'global-forbes'
        };
        await ref.set(value);
        try{localStorage.setItem(KEY,ref.key);}catch(_){ }
        showMessage(`Заявка отправлена. ID: ${ref.key}. Администрация проверит доказательство.`, 'success');
        form.reset(); resetPreview();
      }catch(err){
        console.error(err);
        const msg=/permission/i.test(String(err?.code||err?.message||''))?'Firebase запретил отправку. Нужны актуальные правила базы.':(err?.message||'Не удалось отправить заявку.');
        showMessage(msg,'error');
      }finally{button.disabled=false;}
    });
  }

  function openDialog(){
    let dialog=$('#globalForbesApplyDialog');
    if(!dialog) return;
    if(!dialog.querySelector('form')){ dialog.querySelector('.gfa-dialog-body').innerHTML=formMarkup(); wireForm(dialog.querySelector('form')); }
    if(typeof dialog.showModal==='function') dialog.showModal(); else dialog.setAttribute('open','');
  }

  function closeDialog(){ const d=$('#globalForbesApplyDialog'); if(d?.open) d.close(); else d?.removeAttribute('open'); }

  function init(){
    db=initFirebase();
    document.querySelectorAll('[data-global-apply-open]').forEach(b=>b.addEventListener('click',openDialog));
    document.addEventListener('click',e=>{ if(e.target.closest('[data-global-apply-close]')) closeDialog(); });
    const standalone=$('[data-global-forbes-standalone]');
    if(standalone){ standalone.innerHTML=formMarkup(); wireForm(standalone.querySelector('form')); }
    const d=$('#globalForbesApplyDialog'); if(d) d.addEventListener('click',e=>{ if(e.target===d) closeDialog(); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
