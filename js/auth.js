/* =========================================================
   auth.js — регистрация, вход, выход (модальное окно)
   Сервера нет, поэтому пользователи хранятся в localStorage:
     users       — массив всех зарегистрированных пользователей
     currentUser — логин того, кто сейчас вошёл
   ========================================================= */

// Тестовый пользователь, чтобы можно было сразу проверить вход
var DEMO_USER = { name: 'Аня Смирнова', login: 'anya', email: 'anya@mail.ru', pass: '123456', date: '12.11.2026' };

var users = load('users', null);
if (!Array.isArray(users) || !users.length) {
  users = [DEMO_USER];
  save('users', users);
}

// найти пользователя, который сейчас вошёл (или null)
function getUser() {
  var login = load('currentUser', null);
  if (!login) return null;
  return users.filter(function (u) { return u.login === login; })[0] || null;
}

var currentUser = getUser();

// короткое имя: «Иванова Анна Сергеевна» -> «Анна», «Аня Смирнова» -> «Аня»
function shortName(u) {
  var parts = u.name.trim().split(/\s+/);
  return parts.length >= 3 ? parts[1] : parts[0];
}

/* ---------- состояние авторизации в шапке ----------
   В шапке есть оба набора кнопок (для гостя и для вошедшего),
   CSS показывает нужный по классу logged у <html>. */
function renderUserUI() {
  document.documentElement.classList.toggle('logged', !!currentUser);
  if (!currentUser) return;
  document.getElementById('hName').textContent = shortName(currentUser);
  document.getElementById('hAva').textContent = shortName(currentUser).charAt(0).toUpperCase();
}

// после входа / выхода обновляем страницу без перезагрузки
function onAuthChange() {
  renderUserUI();
  if (typeof reloadFavs === 'function') reloadFavs();
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderCabinet === 'function') renderCabinet();
}

function logIn(u) {
  currentUser = u;
  save('currentUser', u.login);
  onAuthChange();
}

function logOut() {
  currentUser = null;
  save('currentUser', null);
  onAuthChange();
  showToast({ title: 'Вы вышли из аккаунта', text: 'Чтобы снова увидеть свой список, войдите.', time: 3500 });
}

document.getElementById('logoutBtn').addEventListener('click', logOut);
renderUserUI();

/* =================== МОДАЛЬНОЕ ОКНО =================== */
var overlay = document.getElementById('authOverlay');
var lastFocus = null;

function setMode(mode) {
  document.querySelectorAll('.seg [data-mode]').forEach(function (b) {
    var on = b.dataset.mode === mode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on);
  });
  document.getElementById('loginForm').style.display = mode === 'login' ? 'flex' : 'none';
  document.getElementById('regForm').style.display = mode === 'reg' ? 'flex' : 'none';
  document.getElementById('confirmForm').style.display = mode === 'confirm' ? 'flex' : 'none';
  document.querySelector('.seg').style.display = mode === 'confirm' ? 'none' : 'flex';
  if (mode === 'reg') newCaptcha();
  if (mode !== 'confirm') clearInterval(resendTimer);

  var first = mode === 'login' ? 'lLogin' : mode === 'reg' ? 'rName' : 'c1';
  setTimeout(function () { document.getElementById(first).focus(); }, 60);
}

function openAuth(mode, notice) {
  lastFocus = document.activeElement;
  var n = document.getElementById('authNotice');
  n.textContent = notice || '';
  n.style.display = notice ? 'block' : 'none';
  document.body.classList.remove('menu');
  document.body.classList.add('modal-open');
  overlay.classList.add('show');
  overlay.setAttribute('aria-hidden', 'false');
  setMode(mode || 'login');
}

function closeAuth() {
  if (!overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  clearInterval(resendTimer);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

// любая кнопка с data-auth="login" / "reg" открывает окно
document.addEventListener('click', function (e) {
  var opener = e.target.closest('[data-auth]');
  if (opener) {
    e.preventDefault();
    openAuth(opener.dataset.auth);
    return;
  }
  var switcher = e.target.closest('.auth [data-mode]');
  if (switcher) setMode(switcher.dataset.mode);
});
document.getElementById('authClose').addEventListener('click', closeAuth);
overlay.addEventListener('click', function (e) { if (e.target === overlay) closeAuth(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAuth(); });

/* ---------- общие функции для форм ---------- */
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// показать/убрать ошибку под полем; возвращает true, если ошибки нет
function showErr(inputId, errId, text) {
  document.getElementById(errId).textContent = text || '';
  document.getElementById(inputId).classList.toggle('bad', !!text);
  return !text;
}

function today() {
  var d = new Date();
  return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear();
}

/* =================== ВХОД =================== */
document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var login = document.getElementById('lLogin').value.trim();
  var pass = document.getElementById('lPass').value;

  var ok = showErr('lLogin', 'eLLogin', login ? '' : 'Введите логин');
  ok = showErr('lPass', 'eLPass', pass ? '' : 'Введите пароль') && ok;
  if (!ok) return;

  var u = users.filter(function (x) { return x.login === login; })[0];
  if (!u) { showErr('lLogin', 'eLLogin', 'Пользователь с таким логином не найден'); return; }
  if (u.pass !== pass) { showErr('lPass', 'eLPass', 'Неверный пароль'); return; }

  document.getElementById('loginForm').reset();
  closeAuth();
  logIn(u);
  showToast({ title: 'Вы вошли', text: 'Привет, ' + shortName(u) + '! Список «Буду смотреть» — в личном кабинете.', time: 3500 });
});

/* =================== РЕГИСТРАЦИЯ =================== */
var capText = '';
var pendingUser = null;   // данные, которые ждут подтверждения почты
var mailCode = '';
var resendTimer = null;
var codeInputs = Array.prototype.slice.call(document.querySelectorAll('#codeBoxes input'));

// капча: 5 случайных символов, нарисованных на canvas с помехами
function newCaptcha() {
  var chars = 'ABCDEFGHJKLMNPRSTUVWXYZ23456789';
  capText = '';
  for (var i = 0; i < 5; i++) capText += chars[Math.floor(Math.random() * chars.length)];

  var c = document.getElementById('capCanvas');
  var x = c.getContext('2d');
  x.fillStyle = '#EDEBDF';
  x.fillRect(0, 0, c.width, c.height);
  for (var k = 0; k < 6; k++) {
    x.strokeStyle = ['#7a6a5a', '#5b7a4a', '#8a5a6a'][k % 3];
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(Math.random() * c.width, Math.random() * c.height);
    x.bezierCurveTo(Math.random() * c.width, Math.random() * c.height, Math.random() * c.width, Math.random() * c.height, Math.random() * c.width, Math.random() * c.height);
    x.stroke();
  }
  for (var j = 0; j < 5; j++) {
    x.save();
    x.translate(30 + j * 46, 58);
    x.rotate((Math.random() - 0.5) * 0.6);
    x.font = 'bold ' + (38 + Math.floor(Math.random() * 10)) + 'px Georgia, serif';
    x.fillStyle = ['#2b2b2b', '#3a5a8a', '#7a2b2b', '#2b5a3a'][j % 4];
    x.fillText(capText[j], -12, 0);
    x.restore();
  }
}
document.getElementById('capNew').addEventListener('click', newCaptcha);

// «отправка письма»: сервера нет, поэтому код показываем в уведомлении справа сверху
function sendCode() {
  mailCode = String(Math.floor(100000 + Math.random() * 900000));
  var code = mailCode;
  var t = showToast({
    from: 'Почта · ' + pendingUser.email,
    title: 'Код подтверждения',
    text: 'Введите этот код на сайте «Сериальщик»:',
    extra: '<span class="t-code">' + code + '</span>' +
      '<div class="t-actions"><button type="button" class="btn sm" data-paste>Вставить код</button>' +
      '<button type="button" class="btn sm out" data-copy>Скопировать</button></div>',
    time: 30000
  });
  t.el.querySelector('[data-paste]').onclick = function () { fillCode(code); t.close(); };
  t.el.querySelector('[data-copy]').onclick = function (e) {
    try { navigator.clipboard.writeText(code); } catch (err) {}
    e.target.textContent = 'Скопировано';
  };

  // повторно отправить можно через 30 секунд
  var left = 30;
  var btn = document.getElementById('resend');
  btn.disabled = true;
  btn.textContent = 'Отправить ещё раз через ' + left + ' с';
  clearInterval(resendTimer);
  resendTimer = setInterval(function () {
    left--;
    if (left <= 0) {
      clearInterval(resendTimer);
      btn.disabled = false;
      btn.textContent = 'Отправить ещё раз';
    } else {
      btn.textContent = 'Отправить ещё раз через ' + left + ' с';
    }
  }, 1000);
}

function clearCode() {
  codeInputs.forEach(function (i) { i.value = ''; });
  document.getElementById('codeBoxes').className = 'code';
  document.getElementById('eCode').textContent = '';
}

function fillCode(str) {
  var digits = String(str).replace(/\D/g, '').slice(0, 6).split('');
  codeInputs.forEach(function (inp, i) { inp.value = digits[i] || ''; });
  (codeInputs[digits.length] || codeInputs[5]).focus();
  if (digits.length === 6) checkCode();
}

function checkCode() {
  var entered = codeInputs.map(function (x) { return x.value; }).join('');
  var box = document.getElementById('codeBoxes');
  var err = document.getElementById('eCode');
  if (!pendingUser) return;
  if (entered.length < 6) { err.textContent = 'Введите все 6 цифр'; box.className = 'code bad'; return; }
  if (entered !== mailCode) { err.textContent = 'Неверный код. Проверьте письмо'; box.className = 'code bad'; return; }

  // код верный — сохраняем пользователя и входим
  box.className = 'code ok';
  clearInterval(resendTimer);
  users.push(pendingUser);
  save('users', users);
  var u = pendingUser;
  pendingUser = null;
  document.getElementById('regForm').reset();
  closeAuth();
  logIn(u);
  showToast({ title: 'Почта подтверждена', text: 'Добро пожаловать, ' + shortName(u) + '! Аккаунт создан.', time: 5000 });
}

document.getElementById('regForm').addEventListener('submit', function (e) {
  e.preventDefault();
  function v(id) { return document.getElementById(id).value.trim(); }

  var name = v('rName'), login = v('rLogin'), mail = v('rMail');
  var p1 = document.getElementById('rPass').value, p2 = document.getElementById('rPass2').value;
  var ok = true;

  ok = showErr('rName', 'eRName', !name ? 'Введите ФИО' : name.length < 2 ? 'Слишком короткое имя' : '') && ok;

  var loginErr = '';
  if (login.length < 3) loginErr = 'Не короче 3 символов';
  else if (!/^[A-Za-z0-9_]+$/.test(login)) loginErr = 'Только латиница, цифры и _';
  else if (users.some(function (x) { return x.login === login; })) loginErr = 'Такой логин уже занят';
  ok = showErr('rLogin', 'eRLogin', loginErr) && ok;

  var mailErr = '';
  if (!EMAIL_RE.test(mail)) mailErr = 'Введите корректную почту';
  else if (users.some(function (x) { return x.email.toLowerCase() === mail.toLowerCase(); })) mailErr = 'Почта уже зарегистрирована';
  ok = showErr('rMail', 'eRMail', mailErr) && ok;

  ok = showErr('rPass', 'eRPass', p1.length < 6 ? 'Не короче 6 символов' : '') && ok;
  ok = showErr('rPass2', 'eRPass2', !p2 ? 'Повторите пароль' : p1 !== p2 ? 'Пароли не совпадают' : '') && ok;

  if (v('rCap').toUpperCase() !== capText) {
    showErr('rCap', 'eRCap', 'Символы введены неверно');
    newCaptcha();
    document.getElementById('rCap').value = '';
    ok = false;
  } else {
    showErr('rCap', 'eRCap', '');
  }

  var agree = document.getElementById('rAgree').checked;
  document.getElementById('eRAgree').textContent = agree ? '' : 'Нужно согласиться с правилами';
  if (!agree) ok = false;

  if (!ok) return;

  // всё верно — отправляем код на почту и ждём подтверждения
  pendingUser = { name: name, login: login, email: mail, pass: p1, date: today() };
  document.getElementById('cMail').textContent = mail;
  clearCode();
  setMode('confirm');
  sendCode();
});

// ввод кода по клеткам
codeInputs.forEach(function (inp, i) {
  inp.addEventListener('input', function () {
    inp.value = inp.value.replace(/\D/g, '').slice(-1);
    document.getElementById('codeBoxes').className = 'code';
    if (inp.value && codeInputs[i + 1]) codeInputs[i + 1].focus();
    if (codeInputs.every(function (x) { return x.value; })) checkCode();
  });
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !inp.value && codeInputs[i - 1]) codeInputs[i - 1].focus();
    if (e.key === 'ArrowLeft' && codeInputs[i - 1]) codeInputs[i - 1].focus();
    if (e.key === 'ArrowRight' && codeInputs[i + 1]) codeInputs[i + 1].focus();
  });
  inp.addEventListener('paste', function (e) {
    e.preventDefault();
    fillCode((e.clipboardData || window.clipboardData).getData('text'));
  });
});

document.getElementById('confirmForm').addEventListener('submit', function (e) {
  e.preventDefault();
  checkCode();
});
document.getElementById('resend').addEventListener('click', function () {
  clearCode();
  sendCode();
  codeInputs[0].focus();
});
document.getElementById('backToReg').addEventListener('click', function () {
  pendingUser = null;
  setMode('reg');
});
