(()=>{
 const nav=document.querySelector('.side-nav');if(!nav)return;
 const input=document.createElement('input');input.className='admin-nav-search';input.type='search';input.placeholder='Найти раздел панели…';input.setAttribute('aria-label','Поиск раздела');nav.before(input);
 input.addEventListener('input',()=>{const q=input.value.trim().toLocaleLowerCase('ru');nav.querySelectorAll('button').forEach(b=>b.classList.toggle('nav-search-hidden',!b.textContent.toLocaleLowerCase('ru').includes(q)));});
 const globalSave=document.getElementById('saveAllTop');
 globalSave?.addEventListener('click',e=>{const view=document.querySelector('.view.active');const save=view?.querySelector('[data-save]');if(save){e.preventDefault();e.stopImmediatePropagation();save.click();}},true);
 document.querySelectorAll('.view').forEach(v=>{if(v.id==='view-dashboard')return;const b=document.createElement('button');b.className='btn';b.textContent='← Назад на главную';b.type='button';b.style.marginBottom='16px';b.onclick=()=>document.querySelector('[data-view="dashboard"]')?.click();v.prepend(b);});
})();
