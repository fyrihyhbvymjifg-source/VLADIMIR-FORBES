(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const admin = !!document.querySelector('#adminApp');
  const labels = {pending: 'На проверке', approved: 'Одобрена', rejected: 'Отклонена'};
  const PROCESSED_REQUEST_TTL = 24 * 60 * 60 * 1000; // обработанные заявки храним 1 день
  let auth, db, api, account = null, request = null, linkRequest = null, linkedPlayer = null, publicContacts = null, mode = '', revision = 0, opener, next = 'profile', lastRefreshAt = 0;
  const dialog = document.createElement('dialog');
  dialog.className = 'br-account-dialog';
  dialog.setAttribute('aria-labelledby', 'brAccountTitle');
  document.body.append(dialog);

  function close() { dialog.close(); opener?.focus(); }
  dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-br-close]')) close(); });
  function view(title, body) {
    const wideView = /br-change-form|br-proof-assist|br-review-tabs|br-requests/.test(body)
      || title === 'Заявка Forbes'
      || title === 'Проверка заявок Forbes';
    dialog.classList.toggle('br-account-profile-view', title === 'Мой профиль');
    dialog.classList.toggle('br-account-wide', wideView);
    dialog.classList.toggle('br-account-compact', !wideView);
    dialog.innerHTML = `<div class="br-account-inner"><button class="br-close" data-br-close aria-label="Закрыть" type="button">×</button><div class="br-kicker">BLACK RUSSIA <span>VLADIMIR / 78</span></div><h2 id="brAccountTitle">${title}</h2>${body}<p class="br-feedback" role="status" aria-live="polite"></p></div>`;
    if (!dialog.open) { opener = document.activeElement; dialog.showModal(); }
    // При переходе между экранами модалки всегда начинаем сверху.
    // На мобильных браузерах scrollTop раньше сохранялся, из-за чего заголовок открывался обрезанным.
    requestAnimationFrame(() => { dialog.scrollTop = 0; dialog.querySelector('.br-account-inner')?.scrollIntoView({block:'start'}); });
  }
  function feedback(message) { const el = dialog.querySelector('.br-feedback'); if (el) el.textContent = message; }
  function errorMessage(e) {
    const code = String(e?.code || '');
    if (/invalid-credential|wrong-password|user-not-found/.test(code)) return 'Неверный email или пароль.';
    if (code.includes('email-already-in-use')) return 'Этот email уже зарегистрирован. Перейдите ко входу.';
    if (code.includes('weak-password')) return 'Пароль должен содержать минимум 8 символов.';
    if (code.includes('too-many-requests')) return 'Слишком много попыток. Попробуйте позже.';
    if (code.includes('invalid-email')) return 'Проверьте email.';
    if (/functions\/not-found|functions\/unavailable|functions\/internal|functions\/deadline-exceeded/.test(code)) return 'Сервер Forbes ещё не подключён к Firebase. Администратору нужно развернуть Cloud Functions.';
    if (/network|unavailable|internal|not-found|deadline-exceeded/.test(code)) return 'Сервис аккаунтов недоступен. Попробуйте позже.';
    if (/permission-denied|permission_denied|database\/permission-denied/.test(code) || /permission_denied/i.test(String(e?.message || ''))) return 'Firebase запретил запись. Опубликуйте актуальные правила Realtime Database из firebase-database-rules.json.';
    return e?.message || 'Не удалось выполнить действие. Попробуйте снова.';
  }
  async function action(form, task) {
    const buttons = [...form.querySelectorAll('button')];
    buttons.forEach(b => b.disabled = true); feedback('Подождите…');
    try { await task(); } catch (e) { feedback(errorMessage(e)); }
    finally { buttons.forEach(b => b.disabled = false); }
  }
  const field = (label, name, type = 'text', attrs = '') => `<label>${label}<input name="${name}" type="${type}" required ${attrs}></label>`;
  const normalizeNick = value => String(value || '').trim().toLowerCase();
  // Treat separators used in game/site nicknames as equivalent, e.g. Calypso_Person == Calypso Person.
  const canonicalNick = value => normalizeNick(value)
    .normalize('NFKC')
    .replace(/[\s._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const playerKey = value => String(value || '').replace(/[.#$\[\]\/]/g, '_').slice(0, 160);
  function firebaseArray(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') return Object.keys(v).sort((a,b) => (Number(a) || 0) - (Number(b) || 0)).map(k => v[k]).filter(Boolean);
    return [];
  }
  async function getPlayers() {
    const snap = await db.ref('players').once('value');
    const cloud = firebaseArray(snap.val());
    if (cloud.length) return cloud;
    return Array.isArray(window.BR_PLAYERS) ? window.BR_PLAYERS.filter(Boolean) : [];
  }
  async function findPlayerByNick(nickname) {
    const wantedExact = normalizeNick(nickname);
    const wantedCanonical = canonicalNick(nickname);
    if (!wantedCanonical) return null;
    const all = await getPlayers();
    // Prefer an exact (case-insensitive) nickname match. If an admin changed '_' to a space,
    // fall back to a canonical separator-insensitive comparison.
    return all.find(p => normalizeNick(p?.nick) === wantedExact)
      || all.find(p => canonicalNick(p?.nick) === wantedCanonical)
      || null;
  }
  async function findPlayerById(id) {
    if (!id) return null;
    // Fast path: read only the linked player instead of downloading the whole rating.
    try {
      const snap = await db.ref('players').orderByChild('id').equalTo(String(id)).limitToFirst(1).once('value');
      let found = null;
      snap.forEach(child => { if (!found) found = child.val(); });
      if (found) return found;
    } catch (e) {
      console.warn('Player ID lookup fallback', e?.code || e?.message || e);
    }
    return (await getPlayers()).find(p => String(p?.id || '') === String(id)) || null;
  }
  async function issueAccountId(root) {
    const counter = root.child('accounts/counter');
    const tx = await counter.transaction(v => Number(v || 0) + 1);
    const id = Number(tx.snapshot.val());
    if (!tx.committed || !Number.isFinite(id)) throw new Error('Не удалось выдать ID. Повторите попытку.');
    return id;
  }

  async function call(name, data = {}) {
    // Spark-compatible path: direct Realtime Database, no Cloud Functions required.
    // Auth and Database use the same Firebase App instance.
    const uid = auth?.currentUser?.uid;
    if (!uid) throw new Error('Войдите в аккаунт.');
    if (!db) throw new Error('База данных Firebase недоступна.');
    const root = db.ref('forbesService');

    if (name === 'forbesProfile') {
      let profileSnap = await root.child('accounts/users/' + uid).once('value');
      let linkSnap = await root.child('linkRequests/' + uid).once('value');

      if (!profileSnap.exists() && data.nickname) {
        const nickname = String(data.nickname).trim();
        if (!/^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(nickname)) throw new Error('Ник: 3–32 латинских символа, цифры и подчёркивание.');
        const existingPlayer = await findPlayerByNick(nickname);

        if (existingPlayer) {
          const pending = {
            uid,
            nickname,
            playerId: String(existingPlayer.id || ''),
            playerNick: String(existingPlayer.nick || nickname),
            playerRank: Number(existingPlayer.rank) || 0,
            status: 'pending',
            createdAt: Date.now()
          };
          if (!pending.playerId) throw new Error('У найденной записи Forbes нет ID. Исправьте запись в админ-панели.');
          const current = linkSnap.val();
          if (!current || current.status !== 'pending' || String(current.playerId) !== pending.playerId) {
            await root.child('linkRequests/' + uid).set(pending);
            linkSnap = await root.child('linkRequests/' + uid).once('value');
          }
        } else {
          const id = await issueAccountId(root);
          await root.child('accounts/users/' + uid).set({id, nickname, createdAt: Date.now()});
          profileSnap = await root.child('accounts/users/' + uid).once('value');
        }
      }

      let profile = profileSnap.val();
      // Migration for accounts created before linking existed: if an unlinked account's nickname
      // now matches a Forbes player (including '_' vs space), create a safe admin-confirmed link request.
      // Do not recreate a request that an admin already rejected.
      if (profile && !profile.linkedPlayerId && !linkSnap.exists()) {
        const existingPlayer = await findPlayerByNick(profile.nickname);
        if (existingPlayer?.id) {
          const pending = {
            uid,
            nickname: String(profile.nickname || existingPlayer.nick || ''),
            playerId: String(existingPlayer.id),
            playerNick: String(existingPlayer.nick || profile.nickname || ''),
            playerRank: Number(existingPlayer.rank) || 0,
            status: 'pending',
            createdAt: Date.now()
          };
          await root.child('linkRequests/' + uid).set(pending);
          linkSnap = await root.child('linkRequests/' + uid).once('value');
        }
      }

      const [appSnap, noticeSnap] = await Promise.all([
        root.child('applications/' + uid).once('value'),
        root.child('notifications/' + uid).once('value')
      ]);
      let application = appSnap.val();
      if (application && application.status !== 'pending') {
        const processedAt = Number(application.reviewedAt || application.createdAt || 0);
        if (processedAt && processedAt < Date.now() - PROCESSED_REQUEST_TTL) {
          try { await root.child('applications/' + uid).remove(); application = null; } catch {}
        }
      }
      let player = null;
      const currentLink = linkSnap.val();
      if (profile?.linkedPlayerId) player = await findPlayerById(profile.linkedPlayerId);
      else if (currentLink?.playerId) player = await findPlayerById(currentLink.playerId);
      const notices = Object.values(noticeSnap.val() || {}).sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      return {profile, application, linkRequest: currentLink, linkedPlayer: player, notifications: notices};
    }

    if (name === 'forbesCancelLink') {
      const ref = root.child('linkRequests/' + uid), snap = await ref.once('value');
      if (snap.exists() && snap.val().status === 'approved') throw new Error('Одобренную привязку нельзя отменить из профиля.');
      await ref.remove();
      return true;
    }

    if (name === 'forbesSubmit') {
      const profile = (await root.child('accounts/users/' + uid).once('value')).val();
      if (!profile) throw new Error('Сначала завершите регистрацию.');
      if (profile.linkedPlayerId) throw new Error('Ваш аккаунт уже связан с существующей записью Forbes.');
      const existing = (await root.child('applications/' + uid).once('value')).val();
      if (existing && existing.status !== 'rejected') throw new Error('Заявка уже отправлена или одобрена.');
      const value = {uid, accountId: profile.id, nickname: profile.nickname, money: Number(data.money), businesses: Number(data.businesses), transport: Number(data.transport), proof: String(data.proof), proofSentToVk: !!data.vkSent, status: 'pending', createdAt: Date.now()};
      await root.child('applications/' + uid).set(value); return value;
    }

    if (name === 'forbesChangeSubmit') {
      const profile = (await root.child('accounts/users/' + uid).once('value')).val();
      if (!profile?.linkedPlayerId) throw new Error('Изменять данные может только аккаунт, привязанный к Forbes.');
      const player = await findPlayerById(profile.linkedPlayerId);
      if (!player) throw new Error('Связанная запись Forbes не найдена.');
      const existing = (await root.child('applications/' + uid).once('value')).val();
      if (existing?.status === 'pending') throw new Error('У вас уже есть заявка на рассмотрении.');
      const proof = String(data.proof || '').trim().slice(0, 1000);
      if (!/^https:\/\//i.test(proof)) throw new Error('Добавьте ссылку на доказательство (VK).');
      if (!data.vkSent) throw new Error('Поставьте галочку, что скинули доказательства в VK.');
      const money = Math.max(0, Math.min(999999999999999, Number(data.money) || 0));
      const businesses = Math.max(0, Math.min(100, Number(data.businesses) || 0));
      const houses = Math.max(0, Math.min(100, Number(data.houses) || 0));
      const garages = Math.max(0, Math.min(100, Number(data.garages) || 0));
      const transport = Math.max(0, Math.min(1000, Number(data.transport) || 0));
      const previousHistory = Array.isArray(existing?.history) ? existing.history.slice(-9) : [];
      if (existing) previousHistory.push({type:existing.type || 'join',status:existing.status || '',createdAt:Number(existing.createdAt)||0,reviewedAt:Number(existing.reviewedAt)||0,note:String(existing.note||'').slice(0,200)});
      const value = {
        uid, accountId:Number(profile.id)||0, nickname:String(profile.nickname || player.nick || ''),
        type:'change', playerId:String(profile.linkedPlayerId),
        money, businesses, houses, garages, transport,
        oldMoney:String(player.amount || ''),
        oldBusinesses:linkedAssetCount(player.businesses),
        oldHouses:linkedAssetCount(player.properties,'house'),
        oldGarages:linkedAssetCount(player.garages) + linkedAssetCount(player.properties,'garage'),
        oldTransport:Number(player.transport)||0,
        proof, proofSentToVk: !!data.vkSent, userComment:String(data.comment || '').trim().slice(0,500),
        status:'pending', createdAt:Date.now(), history:previousHistory
      };
      await root.child('applications/' + uid).set(value);
      return value;
    }

    if (name === 'forbesList') {
      const [appsSnap, linksSnap] = await Promise.all([
        root.child('applications').once('value'),
        root.child('linkRequests').once('value')
      ]);
      const cutoff = Date.now() - PROCESSED_REQUEST_TTL;
      const pruneProcessed = async (snap, path) => {
        const keep = [];
        const updates = {};
        snap.forEach(child => {
          const value = child.val() || {};
          const processedAt = Number(value.reviewedAt || value.createdAt || 0);
          if (value.status !== 'pending' && processedAt && processedAt < cutoff) updates[child.key] = null;
          else keep.push(value);
        });
        if (Object.keys(updates).length) {
          try { await root.child(path).update(updates); } catch (e) { console.warn('Forbes history cleanup skipped', path, e?.code || e?.message || e); }
        }
        return keep.sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      };
      const [applications, links] = await Promise.all([
        pruneProcessed(appsSnap, 'applications'),
        pruneProcessed(linksSnap, 'linkRequests')
      ]);
      return {applications, links};
    }

    if (name === 'forbesReview') {
      const ref = root.child('applications/' + data.uid), snap = await ref.once('value');
      if (!snap.exists() || snap.val().status !== 'pending') throw new Error('Эта заявка уже обработана.');
      const current = snap.val();
      if (data.status === 'rejected' && !String(data.note || '').trim()) throw new Error('Укажите причину отклонения.');
      if (current.type === 'change' && data.status === 'approved') {
        if (!current.playerId) throw new Error('В заявке отсутствует Player ID.');
        const playerSnap = await db.ref('players').orderByChild('id').equalTo(String(current.playerId)).limitToFirst(1).once('value');
        let playerKeyFound = '', player = null;
        playerSnap.forEach(child => { if (!player) { playerKeyFound = child.key; player = child.val(); } });
        if (!player || playerKeyFound === '') throw new Error('Игрок для изменения не найден в рейтинге.');
        const nextPlayer = {
          ...player,
          amount: compactMoneyValue(Number(current.money) || 0),
          businesses: adjustAssetCount(player.businesses, current.businesses, 'business', current.uid),
          properties: adjustAssetCount((Array.isArray(player.properties) ? player.properties : []).filter(x => String(x?.kind || 'house') !== 'garage'), current.houses, 'house', current.uid),
          garages: adjustAssetCount(player.garages, current.garages, 'garage', current.uid),
          transport: Math.max(0, Number(current.transport) || 0)
        };
        await db.ref('players/' + playerKeyFound).set(nextPlayer);
      }
      const value = {...current, status: data.status, note: String(data.note || '').slice(0, 500), reviewedAt: Date.now(), reviewedBy: uid};
      await ref.set(value);
      await root.child('notifications/' + data.uid).push({type: current.type === 'change' ? 'forbes_change' : 'forbes_decision', status:data.status, note:value.note, createdAt:Date.now(), read:false});
      return value;
    }

    if (name === 'forbesLinkReview') {
      if (!['approved', 'rejected'].includes(data.status)) throw new Error('Некорректное решение.');
      const targetUid = String(data.uid || '');
      const ref = root.child('linkRequests/' + targetUid), snap = await ref.once('value');
      if (!snap.exists() || snap.val().status !== 'pending') throw new Error('Эта привязка уже обработана.');
      const current = snap.val();
      const note = String(data.note || '').trim().slice(0, 500);
      if (data.status === 'rejected') {
        if (!note) throw new Error('Укажите причину отклонения.');
        const value = {...current, status:'rejected', note, reviewedAt:Date.now(), reviewedBy:uid};
        await ref.set(value);
        await root.child('notifications/' + targetUid).push({type:'forbes_link', status:'rejected', note, playerId:current.playerId, createdAt:Date.now(), read:false});
        return value;
      }

      const key = playerKey(current.playerId);
      if (!key) throw new Error('У записи Forbes отсутствует ID.');
      const linkRef = root.child('playerLinks/' + key);
      const linkedAt = Date.now();
      const claim = await linkRef.transaction(value => {
        if (value && value.uid && value.uid !== targetUid) return;
        return {uid:targetUid, playerId:String(current.playerId), nickname:String(current.playerNick || current.nickname), linkedAt};
      });
      if (!claim.committed || claim.snapshot.val()?.uid !== targetUid) throw new Error('Эта запись Forbes уже привязана к другому аккаунту.');

      const accountRef = root.child('accounts/users/' + targetUid);
      let accountValue = (await accountRef.once('value')).val();
      if (!accountValue) {
        const id = await issueAccountId(root);
        accountValue = {id, nickname:String(current.playerNick || current.nickname), createdAt:linkedAt, linkedPlayerId:String(current.playerId), linkedAt};
        await accountRef.set(accountValue);
      } else {
        if (accountValue.linkedPlayerId && String(accountValue.linkedPlayerId) !== String(current.playerId)) throw new Error('У аккаунта уже есть другая привязка Forbes.');
        accountValue = {...accountValue, nickname:String(current.playerNick || accountValue.nickname), linkedPlayerId:String(current.playerId), linkedAt};
        await accountRef.set(accountValue);
      }

      const value = {...current, status:'approved', note, accountId:Number(accountValue.id), reviewedAt:linkedAt, reviewedBy:uid};
      await ref.set(value);
      await root.child('notifications/' + targetUid).push({type:'forbes_link', status:'approved', note, playerId:current.playerId, accountId:Number(accountValue.id), createdAt:linkedAt, read:false});
      return value;
    }

    throw new Error('Неизвестная операция.');
  }

  function nav() {
    document.querySelectorAll('[data-br-account]').forEach(el => { el.textContent = auth?.currentUser ? (account ? `Профиль #${account.id}` : 'Мой профиль') : 'Войти'; });
  }
  async function refresh() {
    const version = ++revision;
    if (!auth?.currentUser) { account = request = linkRequest = linkedPlayer = null; nav(); return; }
    const [data] = await Promise.all([call('forbesProfile'), loadPublicContacts()]);
    if (version !== revision) return;
    account = data.profile;
    request = data.application;
    linkRequest = data.linkRequest;
    linkedPlayer = data.linkedPlayer;
    lastRefreshAt = Date.now();
    nav();
  }

  function login(register = false) {
    mode = 'auth';
    view(register ? 'Создать аккаунт' : 'Добро пожаловать', `<p class="br-muted">${register ? 'Зарегистрируйтесь. Если такой ник уже есть в Forbes, сайт предложит безопасно связать существующую запись.' : 'Войдите, чтобы открыть профиль и подать заявку Forbes.'}</p><div class="br-tabs"><button type="button" data-login class="${register ? '' : 'selected'}">Вход</button><button type="button" data-register class="${register ? 'selected' : ''}">Регистрация</button></div><form class="br-form">${register ? field('Игровой ник', 'nickname', 'text', 'pattern="[A-Za-z][A-Za-z0-9_]{2,31}" maxlength="32" placeholder="Name_Surname" autocomplete="nickname"') : ''}${field('Email', 'email', 'email', 'autocomplete="email" maxlength="254" placeholder="player@example.com"')}${field('Пароль', 'password', 'password', `minlength="8" maxlength="128" autocomplete="${register ? 'new-password' : 'current-password'}"`)}<button class="br-primary" type="submit">${register ? 'Зарегистрироваться' : 'Войти'}</button></form>`);
    dialog.querySelector('[data-login]').onclick = () => login();
    dialog.querySelector('[data-register]').onclick = () => login(true);
    dialog.querySelector('form').onsubmit = e => {
      e.preventDefault(); const form = e.currentTarget, data = new FormData(form);
      action(form, async () => {
        if (!auth) throw new Error('Сервис входа недоступен. Обновите страницу.');
        const email = data.get('email').trim(), password = data.get('password');
        if (register) {
          const result = await auth.createUserWithEmailAndPassword(email, password);
          await result.user.updateProfile({displayName: data.get('nickname').trim()});
          try { await call('forbesProfile', {nickname: result.user.displayName}); }
          catch (err) { await enter(); throw err; }
        } else await auth.signInWithEmailAndPassword(email, password);
        await enter();
      });
    };
  }

  function setup() {
    mode = 'setup';
    if (linkRequest?.status === 'pending') {
      const p = linkedPlayer || linkRequest;
      view('Найдена запись Forbes', `<p class="br-muted">Этот ник уже есть в рейтинге. Чтобы никто не смог забрать чужой профиль, привязку должен подтвердить администратор.</p><div class="br-status"><span class="br-kicker">ОЖИДАЕТ ПРИВЯЗКИ</span><b>${esc(p.nick || linkRequest.playerNick || linkRequest.nickname)}${Number(p.rank || linkRequest.playerRank) ? ` · #${Number(p.rank || linkRequest.playerRank)}` : ''}</b><p>После подтверждения существующая запись Forbes будет связана с этим аккаунтом. Данные рейтинга не создаются заново.</p></div><div class="br-form"><button class="br-primary" data-refresh>Проверить статус</button><button class="br-secondary" data-cancel-link>Указать другой ник</button><button class="br-secondary" data-logout>Выйти</button></div>`);
      dialog.querySelector('[data-refresh]').onclick = () => action(dialog, async () => { await refresh(); if (account) profile(); else setup(); });
      dialog.querySelector('[data-cancel-link]').onclick = () => action(dialog, async () => { await call('forbesCancelLink'); linkRequest = linkedPlayer = null; setup(); });
      bindLogout();
      return;
    }

    const rejected = linkRequest?.status === 'rejected';
    view('Завершите регистрацию', `${rejected ? `<div class="br-status" data-status="rejected"><span class="br-kicker">ПРИВЯЗКА ОТКЛОНЕНА</span><b>${esc(linkRequest.playerNick || linkRequest.nickname)}</b>${linkRequest.note ? `<p>${esc(linkRequest.note)}</p>` : '<p>Можно указать другой ник и попробовать снова.</p>'}</div>` : '<p class="br-muted">Аккаунт создан. Укажите ник. Если он уже есть в Forbes, появится запрос на привязку; если нет — будет выдан новый ID.</p>'}<form class="br-form">${field('Игровой ник', 'nickname', 'text', 'pattern="[A-Za-z][A-Za-z0-9_]{2,31}" maxlength="32" autocomplete="nickname"')}<button class="br-primary">${rejected ? 'Проверить другой ник' : 'Продолжить'}</button></form><button class="br-secondary" data-logout>Выйти</button>`);
    dialog.querySelector('input').value = rejected ? '' : (auth.currentUser.displayName || '');
    dialog.querySelector('form').onsubmit = e => { e.preventDefault(); const form = e.currentTarget; action(form, async () => { await call('forbesProfile', {nickname: new FormData(form).get('nickname').trim()}); await enter(); }); };
    bindLogout();
  }

  function statusCard() {
    if (linkedPlayer || account?.linkedPlayerId) {
      const p = linkedPlayer || {};
      return `<div class="br-status" data-status="approved"><span class="br-kicker">СВЯЗАНО С FORBES</span><b>${esc(p.nick || account.nickname)}${Number(p.rank) ? ` · место #${Number(p.rank)}` : ''}</b><p>Аккаунт связан с существующей записью рейтинга${p.amount ? ` · состояние: ${esc(p.amount)}` : ''}.</p></div>`;
    }
    if (linkRequest?.status === 'pending') {
      const p = linkedPlayer || linkRequest;
      return `<div class="br-status"><span class="br-kicker">НАЙДЕНА ЗАПИСЬ FORBES</span><b>${esc(p.nick || linkRequest.playerNick || account?.nickname)}${Number(p.rank || linkRequest.playerRank) ? ` · место #${Number(p.rank || linkRequest.playerRank)}` : ''}</b><p>Запрос на привязку отправлен администратору. После подтверждения профиль будет использовать данные этой записи${p.amount ? ` · состояние: ${esc(p.amount)}` : ''}.</p></div>`;
    }
    if (linkRequest?.status === 'rejected') {
      return `<div class="br-status" data-status="rejected"><span class="br-kicker">ПРИВЯЗКА ОТКЛОНЕНА</span><b>${esc(linkRequest.playerNick || linkRequest.nickname || account?.nickname)}</b>${linkRequest.note ? `<p>${esc(linkRequest.note)}</p>` : '<p>Администратор отклонил запрос на привязку.</p>'}</div>`;
    }
    if (!request || request.status !== 'pending') return '<div class="br-status"><b>Активных заявок нет</b><p>Новая заявка появится здесь только пока она находится на проверке.</p></div>';
    return `<div class="br-status" data-status="${esc(request.status)}"><span class="br-kicker">Заявка Forbes</span><b>${esc(labels[request.status] || request.status)}</b><p>Состояние: ${Number(request.money).toLocaleString('ru-RU')} ₽</p><p>Бизнесы: ${Number(request.businesses)} · Транспорт: ${Number(request.transport)}</p>${request.note ? `<p>Комментарий: ${esc(request.note)}</p>` : ''}</div>`;
  }
  function bindLogout() {
    dialog.querySelector('[data-logout]').onclick = e => action(dialog, async () => { await auth.signOut(); account = request = linkRequest = linkedPlayer = null; nav(); next = 'profile'; login(); });
  }
  function linkedAvatarHtml(p) {
    const raw = String(p?.avatar || '').trim();
    const src = /^https?:\/\//i.test(raw) || /^data:image\//i.test(raw) ? raw : '';
    const initials = String(p?.nick || account?.nickname || 'BR').replace(/[^A-Za-z0-9А-Яа-яЁё]/g, '').slice(0, 2).toUpperCase() || 'BR';
    return src
      ? `<div class="br-profile-avatar br-profile-avatar-photo"><img src="${esc(src)}" alt="Фото ${esc(p?.nick || account?.nickname || '')}"></div>`
      : `<div class="br-profile-avatar">${esc(initials)}</div>`;
  }
  function linkedAssetCount(value, kind) {
    if (!Array.isArray(value)) return 0;
    if (!kind) return value.length;
    return value.filter(x => String(x?.kind || 'house') === kind).length;
  }
  function parseMoneyNumber(raw) {
    let s = String(raw ?? '').trim().toLowerCase().replace(/₽|руб(?:\.|лей)?/g, '').trim();
    if (!s) return 0;
    let mult = 1;
    const m = s.match(/(трлн|млрд|млн|тыс\.?|ккк|кк|kkk|kk|k|к)\s*$/i);
    if (m) {
      const u = m[1].toLowerCase();
      if (/^трлн/.test(u)) mult = 1e12;
      else if (/^(млрд|ккк|kkk)/.test(u)) mult = 1e9;
      else if (/^(млн|кк|kk)/.test(u)) mult = 1e6;
      else mult = 1e3;
      s = s.slice(0, -m[1].length).trim();
    }
    s = s.replace(/\s+/g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? Math.max(0, Math.round(n * mult)) : 0;
  }
  function compactMoneyValue(raw) {
    const n = typeof raw === 'number' ? raw : parseMoneyNumber(raw);
    if (!Number.isFinite(n) || n <= 0) return '0';
    const units = [[1e12,'трлн'],[1e9,'млрд'],[1e6,'млн'],[1e3,'тыс.']];
    for (const [d,u] of units) if (n >= d) {
      const v = n / d;
      return `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:v>=100?0:v>=10?1:2}).format(v)} ${u}`;
    }
    return new Intl.NumberFormat('ru-RU').format(n);
  }
  function adjustAssetCount(list, count, kind, uid) {
    const wanted = Math.max(0, Math.min(100, Number(count) || 0));
    const src = Array.isArray(list) ? list.map(x => ({...x})) : [];
    const next = src.slice(0, wanted);
    for (let i = next.length; i < wanted; i++) {
      const id = `${kind}-${String(uid || 'user').slice(0,8)}-${Date.now()}-${i+1}`;
      if (kind === 'business') next.push({id,type:'other',number:'',location:'',name:'Подтверждено заявкой',value:'',main:false});
      else if (kind === 'house') next.push({id,kind:'house',number:'',location:'',note:'Подтверждено заявкой',value:'',main:false});
      else next.push({id,kind:'garage',number:'',location:'',capacity:'',note:'Подтверждено заявкой',value:'',main:false});
    }
    return next;
  }
  async function loadPublicContacts() {
    if (publicContacts) return publicContacts;
    try {
      const snap = await db.ref('settings/siteSettings').once('value');
      const x = snap.val() || {};
      publicContacts = {ownerVk:String(x.ownerVk || '').trim(), techVk:String(x.techVk || '').trim()};
    } catch { publicContacts = {ownerVk:'', techVk:''}; }
    return publicContacts;
  }
  function contactButtonsHtml() {
    const ok = u => /^https:\/\//i.test(String(u || ''));
    const item = (url, label) => ok(url)
      ? `<a class="br-vk-contact" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><b>VK</b><span>${esc(label)}</span></a>`
      : `<span class="br-vk-contact is-disabled" aria-disabled="true" title="Ссылка пока не настроена в админ-панели"><b>VK</b><span>${esc(label)}<small>не настроен</small></span></span>`;
    return `<div class="br-vk-contacts">${item(publicContacts?.ownerVk,'Владелец')}${item(publicContacts?.techVk,'Тех. администратор')}</div>`;
  }
  function proofContactsHtml(){
    const contacts = contactButtonsHtml();
    return `<div class="br-proof-assist"><div class="br-proof-assist-copy"><b>Отправка доказательств в VK</b><span>Откройте VK владельца или тех. администратора и отправьте доказательства туда. Ссылки меняются в админ-панели → Система → VK-контакты.</span></div>${contacts}<label class="br-proof-check"><input type="checkbox" name="vkSent" value="1" required><span>Я скинул доказательства в VK владельцу или тех. администратору</span></label></div>`;
  }
  function linkedHistoryHtml(p) {
    const history = (Array.isArray(p?.rankHistory) ? p.rankHistory : []).filter(h => Number(h?.from) > 0 && Number(h?.to) > 0).slice(0, 3);
    if (!history.length) return `<div class="br-profile-history br-profile-history-empty"><div class="br-profile-section-title">История позиции</div><p>Изменений места пока нет.</p></div>`;
    return `<div class="br-profile-history"><div class="br-profile-section-title">История позиции</div>${history.map(h => {
      const up = Number(h.to) < Number(h.from);
      const when = Number(h.time) ? new Date(Number(h.time)).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
      return `<div class="br-profile-history-row"><b class="${up ? 'up' : 'down'}">${up ? '↑' : '↓'} #${Number(h.from)} → #${Number(h.to)}</b><time>${esc(when)}</time></div>`;
    }).join('')}</div>`;
  }
  function linkedTrendHtml(p) {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const events = (Array.isArray(p?.rankHistory) ? p.rankHistory : []).filter(h => Number(h?.time) >= cutoff && Number(h?.from) > 0 && Number(h?.to) > 0).sort((a,b) => Number(a.time) - Number(b.time));
    let baseline = Number(p?.rank) || 0;
    events.forEach(h => { if (!baseline) baseline = Number(h.from) || 0; });
    if (events.length) baseline = Number(events[0].from) || baseline;
    const current = Number(p?.rank) || baseline;
    const delta = baseline ? baseline - current : 0;
    const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const text = delta > 0 ? `↑ +${delta} за 7 дней` : delta < 0 ? `↓ ${delta} за 7 дней` : 'Без изменений';
    const values = [baseline || current || 1, ...events.map(h => Number(h.to) || current || 1), current || 1];
    const min = Math.min(...values), max = Math.max(...values), span = Math.max(1, max-min);
    const pts = values.map((v,i) => { const x = values.length === 1 ? 0 : i * 120 / (values.length - 1); const y = 8 + ((v-min)/span) * 30; return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
    return `<div class="br-profile-trend"><div><div class="br-profile-section-title">Динамика за 7 дней</div><span class="br-profile-delta ${cls}">${esc(text)}</span></div><svg viewBox="0 0 120 46" aria-hidden="true"><polyline points="${pts}"></polyline></svg></div>`;
  }
  function linkedProfileBody(p) {
    const rank = Number(p?.rank) || 0;
    const best = Number(p?.bestRank) || rank || 0;
    const amount = String(p?.amount || '').trim() || 'Не указано';
    const name = String(p?.name || '').trim();
    const businesses = linkedAssetCount(p?.businesses);
    const houses = linkedAssetCount(p?.properties, 'house');
    const garages = linkedAssetCount(p?.garages) + linkedAssetCount(p?.properties, 'garage');
    const transport = Math.max(0, Number(p?.transport) || 0);
    const ratingDays = p?.createdAt ? Math.max(1, Math.floor((Date.now() - Number(p.createdAt)) / 86400000) + 1) : 1;
    const refreshed = lastRefreshAt ? new Date(lastRefreshAt).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    const vk = /^https?:\/\//i.test(String(p?.vk || '')) ? String(p.vk) : '';
    return `<div class="br-profile-hero">${linkedAvatarHtml(p)}<div class="br-profile-identity"><strong>${esc(p?.nick || account.nickname)}</strong>${name ? `<p>${esc(name)}</p>` : ''}<span>Участник #${esc(account.id)}</span></div></div>
      <div class="br-profile-feature"><div class="br-profile-feature-rank"><i>♛</i><div><span>Место в рейтинге</span><b>${rank ? `#${rank}` : '—'}</b></div></div><div class="br-profile-feature-wealth"><span>Состояние</span><b>${esc(amount)}</b><small>Баланс + имущество</small></div></div>
      <div class="br-profile-grid"><div class="br-profile-stat"><span>Лучшее место</span><b>${best ? `#${best}` : '—'}</b></div><div class="br-profile-stat"><span>В рейтинге</span><b>${ratingDays} дн.</b></div><div class="br-profile-stat"><span>Сервер</span><b>78 Vladimir</b></div><div class="br-profile-stat"><span>Обновлено</span><b>${esc(refreshed)}</b></div></div>
      ${linkedTrendHtml(p)}${linkedHistoryHtml(p)}
      <div class="br-profile-assets"><div><span>💼 Бизнесы</span><b>${businesses}</b></div><div><span>🏠 Дома</span><b>${houses}</b></div><div><span>🅿️ Гаражи</span><b>${garages}</b></div><div><span>🚘 Транспорт</span><b>${transport}</b></div>${vk ? `<a href="${esc(vk)}" target="_blank" rel="noopener noreferrer"><span>VK игрока</span><b>Открыть ↗</b></a>` : `<div><span>VK игрока</span><b>—</b></div>`}</div>${contactButtonsHtml()}`;
  }
  function changeStatusCard() {
    // После решения карточка сразу исчезает из профиля; запись остаётся в Firebase до 24 часов для истории администратора.
    if (!request || request.type !== 'change' || request.status !== 'pending') return '';
    const status = labels[request.status] || request.status;
    const cls = request.status === 'approved' ? 'approved' : request.status === 'rejected' ? 'rejected' : 'pending';
    return `<div class="br-change-status ${cls}"><div><span>Заявка на изменение</span><b>${esc(status)}</b></div><p>Баланс: ${esc(compactMoneyValue(request.money))} · Бизнесы: ${Number(request.businesses)||0} · Дома: ${Number(request.houses)||0} · Гаражи: ${Number(request.garages)||0} · Транспорт: ${Number(request.transport)||0}</p>${request.note ? `<small>${esc(request.note)}</small>` : ''}</div>`;
  }
  function profile() {
    mode = 'profile';
    const canApply = !account?.linkedPlayerId && linkRequest?.status !== 'pending' && (!request || request.status === 'rejected');
    const isLinked = !!(linkedPlayer || account?.linkedPlayerId);
    const body = isLinked
      ? `${linkedProfileBody(linkedPlayer || {})}<div class="br-profile-link-state"><span>СВЯЗАНО С FORBES</span><b>Профиль синхронизирован с рейтингом</b></div>${changeStatusCard()}`
      : `<div class="br-identity"><div class="br-avatar">${esc(account.nickname.slice(0,2).toUpperCase())}</div><div><strong>${esc(account.nickname)}</strong><span>Участник #${account.id}</span></div></div>${statusCard()}`;
    const canChange = isLinked && request?.status !== 'pending';
    view('Мой профиль', `${body}<div class="br-form br-profile-controls">${canApply ? '<button class="br-primary" data-apply>Подать заявку Forbes</button>' : ''}${isLinked ? `<button class="br-primary" data-change ${canChange ? '' : 'disabled'}>✏️ Изменить баланс и имущество</button>` : ''}<a class="br-secondary" href="chat.html">💬 Forbes Chat</a><a class="br-secondary" href="support.html">🎫 Поддержка</a><button class="br-secondary" data-refresh>Обновить статус</button><button class="br-secondary br-logout" data-logout>Выйти</button></div>`);
    dialog.querySelector('[data-apply]')?.addEventListener('click', apply);
    if (dialog.querySelector('[data-change]') && canChange) dialog.querySelector('[data-change]').onclick = changeApply;
    dialog.querySelector('[data-refresh]').onclick = () => action(dialog, async () => { await refresh(); profile(); });
    bindLogout();
  }
  function changeApply() {
    if (!auth?.currentUser) { next = 'profile'; return login(); }
    if (!account?.linkedPlayerId || !linkedPlayer) return profile();
    if (request?.status === 'pending') { profile(); feedback('Сначала дождитесь решения по текущей заявке.'); return; }
    mode = 'change';
    const p = linkedPlayer || {};
    const currentMoney = parseMoneyNumber(p.amount || 0);
    const businesses = linkedAssetCount(p.businesses);
    const houses = linkedAssetCount(p.properties,'house');
    const garages = linkedAssetCount(p.garages) + linkedAssetCount(p.properties,'garage');
    const transport = Math.max(0, Number(p.transport) || 0);
    view('Изменить данные Forbes', `<p class="br-muted">Изменения не применятся сразу. Отправьте новые данные и доказательство — администрация проверит заявку.</p><form class="br-form br-change-form">${field('Баланс / деньги, ₽','money','number',`min="0" max="999999999999999" step="1" value="${currentMoney}"`)}<div class="br-fields">${field('Бизнесы','businesses','number',`min="0" max="100" step="1" value="${businesses}"`)}${field('Дома','houses','number',`min="0" max="100" step="1" value="${houses}"`)}</div><div class="br-fields">${field('Гаражи','garages','number',`min="0" max="100" step="1" value="${garages}"`)}${field('Транспорт','transport','number',`min="0" max="1000" step="1" value="${transport}"`)}</div><label>Доказательство VK<input name="proof" type="url" required maxlength="1000" pattern="https://.*" placeholder="https://vk.com/... или https://vk.ru/..."></label>${proofContactsHtml()}<label>Комментарий<textarea name="comment" maxlength="500" placeholder="Что изменилось и где это видно на доказательстве"></textarea></label><div class="br-change-warning"><b>Проверка администрацией</b><span>До одобрения текущие данные профиля останутся без изменений.</span></div><button class="br-primary">Отправить на проверку</button><button type="button" class="br-secondary" data-profile>Назад в профиль</button></form>`);
    dialog.querySelector('[data-profile]').onclick = profile;
    dialog.querySelector('form').onsubmit = e => { e.preventDefault(); const form=e.currentTarget, fd=new FormData(form); action(form, async () => {
      request = await call('forbesChangeSubmit', {money:Number(fd.get('money')), businesses:Number(fd.get('businesses')), houses:Number(fd.get('houses')), garages:Number(fd.get('garages')), transport:Number(fd.get('transport')), proof:String(fd.get('proof')||'').trim(), vkSent:!!fd.get('vkSent'), comment:String(fd.get('comment')||'').trim()});
      profile(); feedback('Заявка отправлена администрации. Данные изменятся только после одобрения.');
    }); };
  }
  function apply() {
    if (!auth?.currentUser) { next = 'apply'; return login(); }
    if (!account) return setup();
    if (account.linkedPlayerId) return profile();
    if (request && request.status !== 'rejected') return profile();
    mode = 'apply';
    view('Заявка Forbes', `<p class="br-muted">${esc(account.nickname)} <b>#${account.id}</b> · Укажите общую стоимость имущества в рублях.</p><form class="br-form">${field('Общее состояние, ₽', 'money', 'number', 'min="0" max="999999999999999" step="1" placeholder="150000000"')}<div class="br-fields">${field('Бизнесы', 'businesses', 'number', 'min="0" max="10000" step="1" value="0"')}${field('Транспорт', 'transport', 'number', 'min="0" max="10000" step="1" value="0"')}</div>${field('Ссылка на подтверждение', 'proof', 'url', 'maxlength="1000" pattern="https://.*" placeholder="https://…"')}${proofContactsHtml()}<p class="br-muted">Приложите ссылку на скриншоты или видео с подтверждением имущества. Заявку проверит администрация.</p><button class="br-primary">Отправить на проверку</button><button type="button" class="br-secondary" data-profile>Назад в профиль</button></form>`);
    dialog.querySelector('[data-profile]').onclick = profile;
    dialog.querySelector('form').onsubmit = e => { e.preventDefault(); const form = e.currentTarget, data = new FormData(form); action(form, async () => { request = await call('forbesSubmit', {money: Number(data.get('money')), businesses: Number(data.get('businesses')), transport: Number(data.get('transport')), proof: data.get('proof').trim(), vkSent: !!data.get('vkSent')}); profile(); feedback('Заявка отправлена. Статус появится здесь после проверки.'); }); };
  }
  async function enter(destination = next) {
    next = destination;
    if (!auth?.currentUser) return login();
    mode = 'loading'; view('Мой аккаунт', '<p class="br-muted">Загружаем профиль…</p>');
    try { await refresh(); if (!dialog.open) return; if (!account) setup(); else if (next === 'apply') apply(); else profile(); }
    catch (e) { view('Не удалось загрузить профиль', '<button class="br-primary" data-retry>Повторить</button><button class="br-secondary" data-logout>Выйти</button>'); feedback(errorMessage(e)); dialog.querySelector('[data-retry]').onclick = () => enter(); bindLogout(); }
  }

  function canAdminWrite() { return !!(window.BRAdminAccess?.isOwner || (window.BRAdminAccess && !window.BRAdminAccess.readOnly)); }
  function canLinkWrite() { return !!(window.BRAdminAccess?.isOwner || window.BRAdminAccess?.canWrite?.('players_edit')); }
  function canReviewRequests() { return !!(window.BRAdminAccess?.isOwner || window.BRAdminAccess?.can?.('forbes_requests')); }
  function canReviewRequestsWrite() { return !!(window.BRAdminAccess?.isOwner || window.BRAdminAccess?.canWrite?.('forbes_requests')); }
  async function review() {
    if (!canReviewRequests()) { feedback('Нет доступа к заявкам Forbes.'); return; }
    mode = 'admin';
    view('Проверка заявок Forbes', '<p class="br-muted">Загружаем заявки…</p>');
    dialog.classList.add('br-review-dialog');
    try {
      const data = await call('forbesList');
      if (!dialog.open || mode !== 'admin') return;
      const applications = Array.isArray(data?.applications) ? data.applications : [];
      const links = Array.isArray(data?.links) ? data.links : [];
      const pendingLinks = links.filter(x => x.status === 'pending').length;
      const pendingApps = applications.filter(x => x.status === 'pending').length;
      let kind = pendingLinks ? 'links' : 'applications';
      view('Проверка заявок Forbes', `<div class="br-tabs br-review-tabs"><button type="button" data-kind="links" class="${kind === 'links' ? 'selected' : ''}">Привязки${pendingLinks ? ` (${pendingLinks})` : ''}</button><button type="button" data-kind="applications" class="${kind === 'applications' ? 'selected' : ''}">Заявки${pendingApps ? ` (${pendingApps})` : ''}</button></div><div class="br-review-toolbar"><select aria-label="Статус заявок"><option value="pending">На проверке</option><option value="approved">Одобренные</option><option value="rejected">Отклонённые</option><option value="all">Все</option></select><button class="br-secondary" data-reload>Обновить</button></div><div class="br-requests"></div>`);

      const render = () => {
        const filter = dialog.querySelector('select').value;
        dialog.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('selected', b.dataset.kind === kind));
        const source = kind === 'links' ? links : applications;
        const filtered = source.filter(r => filter === 'all' || r.status === filter);
        if (kind === 'links') {
          dialog.querySelector('.br-requests').innerHTML = filtered.map(r => `<article class="br-request"><div class="br-request-head"><strong>${esc(r.playerNick || r.nickname)} ${Number(r.playerRank) ? `<span>#${Number(r.playerRank)}</span>` : ''}</strong><span>${esc(labels[r.status] || r.status)}</span></div><p>Запрос на привязку существующей записи Forbes к аккаунту пользователя.</p><p class="br-muted">Player ID: ${esc(r.playerId)} · ${new Date(r.createdAt).toLocaleString('ru-RU')}</p>${r.note ? `<p>${esc(r.note)}</p>` : ''}${r.status === 'pending' && canReviewRequestsWrite() && canLinkWrite() ? `<form data-link-uid="${esc(r.uid)}"><label>Комментарий<textarea name="note" maxlength="500" placeholder="При одобрении необязательно; при отклонении укажите причину"></textarea></label><div class="br-fields"><button class="br-primary" name="decision" value="approved">Связать</button><button class="br-secondary" name="decision" value="rejected">Отклонить</button></div></form>` : ''}</article>`).join('') || '<p class="br-empty">Запросов на привязку в этом разделе нет.</p>';
          dialog.querySelectorAll('form[data-link-uid]').forEach(form => { form.onsubmit = e => { e.preventDefault(); const status = e.submitter.value, note = new FormData(form).get('note').trim(); if (status === 'rejected' && !note) { feedback('Укажите причину отклонения.'); form.querySelector('textarea').focus(); return; } action(form, async () => { await call('forbesLinkReview', {uid: form.dataset.linkUid, status, note}); await review(); }); }; });
        } else {
          dialog.querySelector('.br-requests').innerHTML = filtered.map(r => {
            const isChange = r.type === 'change';
            const summary = isChange
              ? `<div class="br-change-compare"><div><span>Баланс</span><b>${esc(r.oldMoney || '—')} → ${esc(compactMoneyValue(r.money))}</b></div><div><span>Бизнесы</span><b>${Number(r.oldBusinesses)||0} → ${Number(r.businesses)||0}</b></div><div><span>Дома</span><b>${Number(r.oldHouses)||0} → ${Number(r.houses)||0}</b></div><div><span>Гаражи</span><b>${Number(r.oldGarages)||0} → ${Number(r.garages)||0}</b></div><div><span>Транспорт</span><b>${Number(r.oldTransport)||0} → ${Number(r.transport)||0}</b></div></div>`
              : `<p>${Number(r.money).toLocaleString('ru-RU')} ₽ · Бизнесы: ${Number(r.businesses)} · Транспорт: ${Number(r.transport)}</p>`;
            const allowWrite = canReviewRequestsWrite() && (isChange ? canLinkWrite() : canAdminWrite());
            return `<article class="br-request ${isChange?'br-request-change':''}"><div class="br-request-head"><strong>${esc(r.nickname)} <span>#${Number(r.accountId)}</span></strong><span>${isChange?'Изменение данных · ':''}${esc(labels[r.status] || r.status)}</span></div>${summary}<p class="br-muted">${new Date(r.createdAt).toLocaleString('ru-RU')}${r.playerId ? ` · Player ID: ${esc(r.playerId)}` : ''}</p>${r.userComment ? `<p><b>Комментарий игрока:</b> ${esc(r.userComment)}</p>` : ''}${r.proofSentToVk ? `<p><b>VK подтверждение:</b> Игрок отметил, что скинул док-ва в VK.</p>` : ''}${/^https:\/\//i.test(r.proof) ? `<a class="br-proof-link" href="${esc(r.proof)}" target="_blank" rel="noopener noreferrer">VK · открыть доказательство ↗</a>` : ''}${r.note ? `<p><b>Решение:</b> ${esc(r.note)}</p>` : ''}${r.status === 'pending' && allowWrite ? `<form data-uid="${esc(r.uid)}"><label>Комментарий администратора<textarea name="note" maxlength="500" placeholder="При отклонении причина обязательна"></textarea></label><div class="br-fields"><button class="br-primary" name="decision" value="approved">${isChange?'Одобрить и применить':'Одобрить'}</button><button class="br-secondary" name="decision" value="rejected">Отклонить</button></div></form>` : ''}</article>`;
          }).join('') || '<p class="br-empty">Заявок в этом разделе пока нет.</p>';
          dialog.querySelectorAll('form[data-uid]').forEach(form => { form.onsubmit = e => { e.preventDefault(); const status = e.submitter.value, note = new FormData(form).get('note').trim(); if (status === 'rejected' && !note) { feedback('Укажите причину отклонения.'); form.querySelector('textarea').focus(); return; } action(form, async () => { await call('forbesReview', {uid: form.dataset.uid, status, note}); await review(); }); }; });
        }
      };

      dialog.querySelectorAll('[data-kind]').forEach(button => { button.onclick = () => { kind = button.dataset.kind; render(); }; });
      dialog.querySelector('select').onchange = render;
      dialog.querySelector('[data-reload]').onclick = review;
      render();
    } catch (e) { view('Проверка заявок Forbes', '<button class="br-primary" data-retry>Повторить</button>'); feedback(errorMessage(e)); dialog.querySelector('[data-retry]').onclick = review; }
  }

  function init() {
    try {
      if (!window.firebase || !window.BR_FIREBASE_CONFIG) throw new Error('Firebase недоступен');
      const app = admin ? (firebase.apps.find(a => a.name === '[DEFAULT]') || firebase.initializeApp(window.BR_FIREBASE_CONFIG)) : (firebase.apps.find(a => a.name === 'forbesPublic') || firebase.initializeApp(window.BR_FIREBASE_CONFIG, 'forbesPublic'));
      auth = app.auth(); db = app.database(); api = app.functions('us-central1');
      if (!admin) {
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {}));
        auth.onAuthStateChanged(() => { refresh().catch(() => nav()); });
      } else auth.onAuthStateChanged(() => { if (dialog.open) close(); });
    } catch (e) { console.warn('Forbes account initialization:', e.message); }
    if (admin) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'nav-btn'; button.dataset.forbesRequestsNav = '1'; button.hidden = true; button.innerHTML = '<span class="nav-icon">▤</span><span>Заявки Forbes / изменения</span>'; button.onclick = review;
      document.querySelector('.side-nav')?.append(button);
      const syncRequestAccess = () => { button.hidden = !canReviewRequests(); };
      syncRequestAccess();
      let tries = 0; const timer = setInterval(() => { syncRequestAccess(); if (++tries > 40 || window.BRAdminAccess) clearInterval(timer); }, 250);
      window.addEventListener('focus', syncRequestAccess, {passive:true});
    } else {
      const navigation = document.querySelector('.topbar .nav');
      document.querySelectorAll('a[href="forbes-login.html"]').forEach(el => { el.dataset.brAccount = ''; el.href = '#account'; });
      const forbes = navigation?.querySelector('a[href="forbes-apply.html"]');
      if (forbes) { forbes.classList.add('br-forbes-nav'); navigation.append(forbes); }
      const accountLink = navigation?.querySelector('[data-br-account]'); if (accountLink) navigation.append(accountLink);
      document.addEventListener('click', e => { const link = e.target.closest('a[href="forbes-apply.html"], [data-br-account]'); if (link) { e.preventDefault(); enter(link.hasAttribute('data-br-account') ? 'profile' : 'apply'); } });
      nav();
      const initial = new URLSearchParams(location.search).get('account');
      if (initial) {
        if (auth) { const unsubscribe = auth.onAuthStateChanged(() => { unsubscribe(); enter(initial === 'apply' ? 'apply' : 'profile'); }); }
        else login();
      }
    }
  }
  init();
})();
