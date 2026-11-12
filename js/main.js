/* =========================================================
   main.js — логика страниц
   На каждой странице в <body> есть data-page="...",
   по нему понимаем, что нужно запустить.
   ========================================================= */

var PAGE = document.body.dataset.page;

/* ---------- список «Буду смотреть» ----------
   У каждого пользователя свой список: ключ favs_<логин> в localStorage.
   Без входа список пустой, а сердечко предлагает войти. */
function favsKey() {
  return 'favs_' + currentUser.login;
}
var favs = [];

// перечитать список (при загрузке, входе и выходе)
function reloadFavs() {
  favs = currentUser ? load(favsKey(), []) : [];
}
reloadFavs();

function isFav(id) {
  return favs.indexOf(id) !== -1;
}

function toggleFav(id) {
  var s = byId(id);
  if (!currentUser) {
    var t = showToast({
      title: 'Нужно войти',
      text: 'Список «Буду смотреть» хранится в личном кабинете.',
      extra: '<div class="t-actions" style="margin-top:8px"><button type="button" class="btn sm" data-auth="login">Войти</button><button type="button" class="btn sm out" data-auth="reg">Регистрация</button></div>',
      time: 5000
    });
    return;
  }
  if (isFav(id)) {
    favs = favs.filter(function (x) { return x !== id; });
    showToast({ title: 'Убрано из списка', text: '«' + s.title + '» больше не в «Буду смотреть».', time: 3000 });
  } else {
    favs.push(id);
    showToast({ title: 'Добавлено в список', text: '«' + s.title + '» теперь в «Буду смотреть».', time: 3000 });
  }
  save(favsKey(), favs);
  renderAll();
}

// счётчики в шапке и в меню
function renderBadges() {
  ['sideBadge', 'topBadge'].forEach(function (id) {
    var b = document.getElementById(id);
    if (!b) return;
    b.textContent = favs.length;
    b.style.display = favs.length ? 'flex' : 'none';
  });
}

/* ---------- строка таблицы (одинаковая для каталога, похожих и списка) ---------- */
function rowHtml(s) {
  var on = isFav(s.id);
  var ratingWidth = Math.round((s.rating - 7) / 3 * 100); // 7.0 -> 0%, 10.0 -> 100%
  return '<tr data-id="' + s.id + '">' +
    '<td class="mono muted">' + num(s.id) + '</td>' +
    '<td><span class="t">' + s.title + '</span><span class="d">' + s.desc + '</span></td>' +
    '<td><span class="dot" style="--c:' + CAT_COLOR[s.cat] + '">' + s.cat + '</span></td>' +
    '<td class="mono">' + s.year + '</td>' +
    '<td class="mono">' + s.seasons + '</td>' +
    '<td><div class="rate"><div class="bar"><i style="width:' + ratingWidth + '%"></i></div><span class="mono">' + s.rating.toFixed(1) + '</span></div></td>' +
    '<td>' + (on ? '<span class="pill lime">в списке</span>' : '<span class="pill blue">новый</span>') + '</td>' +
    '<td><button type="button" class="heart' + (on ? ' on' : '') + '" data-fav="' + s.id + '" aria-label="' +
      (on ? 'Убрать из списка' : 'Добавить в «Буду смотреть»') + '"><svg class="i" aria-hidden="true" style="width:16px;height:16px"><use href="#i-heart"/></svg></button></td>' +
    '</tr>';
}

/* ---------- карточка сериала (каталог) ---------- */
function cardHtml(s) {
  var on = isFav(s.id);
  var ratingWidth = Math.round((s.rating - 7) / 3 * 100);
  return '<article class="scard" data-id="' + s.id + '" tabindex="0" aria-label="' + s.title + ', открыть описание">' +
    '<div class="scard-top"><span class="scard-num">' + num(s.id) + '</span>' +
      '<span class="dot" style="--c:' + CAT_COLOR[s.cat] + '">' + s.cat + '</span></div>' +
    '<h3>' + s.title + '</h3>' +
    '<p>' + s.desc + '</p>' +
    '<div class="scard-meta"><span>' + s.year + '</span><span>сезонов: ' + s.seasons + '</span></div>' +
    '<div class="rate"><div class="bar"><i style="width:' + ratingWidth + '%"></i></div><span class="mono">' + s.rating.toFixed(1) + '</span></div>' +
    '<div class="scard-foot">' +
      (on ? '<span class="pill lime">в списке</span>' : '<span class="pill blue">новый</span>') +
      '<button type="button" class="heart' + (on ? ' on' : '') + '" data-fav="' + s.id + '" aria-label="' +
        (on ? 'Убрать из списка' : 'Добавить в «Буду смотреть»') + '"><svg class="i" aria-hidden="true" style="width:16px;height:16px"><use href="#i-heart"/></svg></button>' +
    '</div>' +
  '</article>';
}

// клик по сердечку — в список, клик по карточке/строке — на страницу сериала
function bindTable(box) {
  if (!box) return;
  box.addEventListener('click', function (e) {
    var heart = e.target.closest('[data-fav]');
    if (heart) {
      e.stopPropagation();
      toggleFav(+heart.dataset.fav);
      return;
    }
    var item = e.target.closest('[data-id]');
    if (item) location.href = 'series.html?id=' + item.dataset.id;
  });
  // карточку можно открыть с клавиатуры (Enter)
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches('.scard')) location.href = 'series.html?id=' + e.target.dataset.id;
  });
}

/* ================= ГЛАВНАЯ ================= */
function renderHome() {
  var c = document.getElementById('weekCount');
  if (!c) return;
  c.textContent = favs.length;
  document.getElementById('weekBar').style.width = (favs.length / SERIES.length * 100) + '%';
}

/* ================= КАТАЛОГ ================= */
var cat = 'Все';
var query = '';
var sort = 'rating';

function renderCatalog() {
  var chips = document.getElementById('chips');
  if (!chips) return;

  // плитки-фильтры с количеством
  var cats = ['Все', 'Драма', 'Комедия', 'Криминал', 'Фантастика'];
  chips.innerHTML = cats.map(function (c) {
    var n = c === 'Все' ? SERIES.length : SERIES.filter(function (s) { return s.cat === c; }).length;
    var color = c === 'Все' ? 'var(--text)' : CAT_COLOR[c];
    return '<button type="button" class="chip' + (c === cat ? ' on' : '') + '" data-cat="' + c + '">' +
      '<b style="color:' + color + '">' + n + '</b><span>' + c.toLowerCase() + '</span></button>';
  }).join('');

  // фильтр + поиск
  var list = SERIES.filter(function (s) {
    var text = (s.title + ' ' + s.desc).toLowerCase();
    return (cat === 'Все' || s.cat === cat) && text.indexOf(query) !== -1;
  });

  // сортировка
  list.sort(function (a, b) {
    if (sort === 'rating') return b.rating - a.rating;
    if (sort === 'new') return b.year - a.year;
    return a.title.localeCompare(b.title, 'ru');
  });

  // карточки выводятся из массива SERIES через map + join
  document.getElementById('cards').innerHTML = list.length
    ? list.map(cardHtml).join('')
    : '<p class="muted">Ничего не нашлось. Попробуй другое слово или жанр.</p>';
  document.getElementById('shown').textContent = 'Показано ' + list.length + ' из ' + SERIES.length;
}

function initCatalog() {
  // запрос из поиска в шапке: catalog.html?q=...
  var q = new URLSearchParams(location.search).get('q') || '';
  query = q.toLowerCase();
  document.getElementById('q').value = q;
  document.getElementById('topSearch').value = q;

  document.getElementById('chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (b) { cat = b.dataset.cat; renderCatalog(); }
  });
  document.getElementById('q').addEventListener('input', function (e) {
    query = e.target.value.trim().toLowerCase();
    renderCatalog();
  });
  document.getElementById('qBtn').addEventListener('click', renderCatalog);
  document.getElementById('sort').addEventListener('change', function (e) {
    sort = e.target.value;
    renderCatalog();
  });
  bindTable(document.getElementById('cards'));
}

/* ================= СТРАНИЦА СЕРИАЛА ================= */
var currentId = 7;

function renderSeries() {
  var title = document.getElementById('sTitle');
  if (!title) return;
  var s = byId(currentId);
  var on = isFav(s.id);

  document.title = s.title + ' — Сериальщик';
  document.getElementById('sCrumb').textContent = s.title;
  title.textContent = s.title;
  document.getElementById('sPill').innerHTML = on ? '<span class="pill lime">в списке</span>' : '<span class="pill blue">новый</span>';
  document.getElementById('sDesc').textContent = s.desc;
  document.getElementById('sCat').innerHTML = '<span class="dot" style="--c:' + CAT_COLOR[s.cat] + '">' + s.cat + '</span>';
  document.getElementById('sYear').textContent = s.year;
  document.getElementById('sSeasons').textContent = s.seasons;
  document.getElementById('sRate').textContent = s.rating.toFixed(1);
  document.getElementById('sFull').textContent = s.full;
  document.getElementById('sFav').textContent = on ? 'Убрать из списка' : '+ Буду смотреть';

  var similar = SERIES.filter(function (x) { return x.cat === s.cat && x.id !== s.id; });
  document.getElementById('similar').innerHTML = similar.map(rowHtml).join('');
}

function initSeries() {
  var id = +new URLSearchParams(location.search).get('id');
  currentId = byId(id) ? id : 7; // если id неправильный — показываем «Во все тяжкие»
  document.getElementById('sFav').addEventListener('click', function () { toggleFav(currentId); });
  bindTable(document.getElementById('similar'));
}

/* ================= ПОДБОРКИ + СЛАЙДЕР ================= */
var slide = 0;
var slideTimer = null;

function renderSlider() {
  var c = COLLECTIONS[slide];
  document.getElementById('slNum').textContent = '0' + (slide + 1);
  document.getElementById('slTitle').textContent = c.title;
  document.getElementById('slText').textContent = c.text;
  document.getElementById('slDots').innerHTML = COLLECTIONS.map(function (x, i) {
    return '<button type="button" class="' + (i === slide ? 'on' : '') + '" data-i="' + i + '" aria-label="Подборка ' + (i + 1) + '"></button>';
  }).join('');
  document.getElementById('slList').innerHTML = c.ids.map(function (id) {
    var s = byId(id);
    return '<a href="series.html?id=' + id + '" class="kv"><span class="mono muted">' + num(id) + '</span>' +
      '<b style="flex:1">' + s.title + '</b><span class="mono lime">' + s.rating.toFixed(1) + '</span></a>';
  }).join('');
}

function go(n) {
  slide = (n + COLLECTIONS.length) % COLLECTIONS.length; // по кругу
  renderSlider();
}

function startAuto() {
  clearInterval(slideTimer);
  slideTimer = setInterval(function () { go(slide + 1); }, 5000);
}

function initCollections() {
  document.getElementById('slPrev').onclick = function () { go(slide - 1); };
  document.getElementById('slNext').onclick = function () { go(slide + 1); };
  document.getElementById('slDots').addEventListener('click', function (e) {
    if (e.target.dataset.i) go(+e.target.dataset.i);
  });
  // пауза при наведении
  var box = document.getElementById('slider');
  box.addEventListener('mouseenter', function () { clearInterval(slideTimer); });
  box.addEventListener('mouseleave', startAuto);

  // карточки всех подборок
  document.getElementById('colGrid').innerHTML = COLLECTIONS.map(function (c, i) {
    return '<div class="card stage"><div class="eyebrow">Подборка 0' + (i + 1) + ' · ' + plural(c.ids.length) + '</div><h3>' + c.title + '</h3>' +
      c.ids.map(function (id) {
        var s = byId(id);
        return '<a href="series.html?id=' + id + '" class="step" style="display:block"><span class="num">' + num(id) + '</span>' +
          '<b>' + s.title + '</b><p>' + s.cat.toLowerCase() + ' · ' + s.year + ' · рейтинг ' + s.rating.toFixed(1) + '</p></a>';
      }).join('') + '</div>';
  }).join('');

  renderSlider();
  startAuto();
}

/* ================= ЛИЧНЫЙ КАБИНЕТ ================= */
function renderList() {
  var rows = document.getElementById('listRows');
  if (!rows || !currentUser) return;
  var list = SERIES.filter(function (s) { return isFav(s.id); });
  var n = list.length;

  var seasons = 0, sum = 0, genres = [];
  list.forEach(function (s) {
    seasons += s.seasons;
    sum += s.rating;
    if (genres.indexOf(s.cat) === -1) genres.push(s.cat);
  });
  var avg = n ? (sum / n).toFixed(1) : '—';

  function stat(label, value, sub, pct, color) {
    return '<div class="card stat"><span style="display:block;margin-bottom:10px">' + label + '</span>' +
      '<b style="color:' + color + '">' + value + '</b><span>' + sub + '</span>' +
      '<div class="bar" style="margin-top:12px"><i style="width:' + pct + '%;background:' + color + '"></i></div></div>';
  }
  document.getElementById('listStats').innerHTML =
    stat('В списке', n, 'из ' + SERIES.length + ' сериалов', n / SERIES.length * 100, 'var(--blue)') +
    stat('Средний рейтинг', avg, 'по твоему списку', n ? (avg - 7) / 3 * 100 : 0, 'var(--lime)') +
    stat('Жанров', genres.length, 'из 4 жанров', genres.length / 4 * 100, 'var(--orange)') +
    stat('Сезонов впереди', seasons, 'примерно ' + seasons * 8 + ' часов', Math.min(seasons / 30 * 100, 100), 'var(--red)');

  rows.innerHTML = list.map(rowHtml).join('');
  document.getElementById('listTable').style.display = n ? 'block' : 'none';
  document.getElementById('listEmpty').style.display = n ? 'none' : 'block';
  document.getElementById('clearList').style.display = n ? 'inline' : 'none';
  document.getElementById('cabLead').textContent = plural(n);
}

// показать кабинет или «доступ закрыт» — вызывается при загрузке, входе и выходе
function renderCabinet() {
  var cabIn = document.getElementById('cabIn');
  if (!cabIn) return;
  // без входа кабинет закрыт, данные не выводятся
  if (!currentUser) {
    cabIn.style.display = 'none';
    document.getElementById('cabOut').style.display = 'block';
    document.getElementById('listRows').innerHTML = '';
    return;
  }
  document.getElementById('cabOut').style.display = 'none';
  cabIn.style.display = 'block';
  document.getElementById('cName').textContent = shortName(currentUser);
  document.getElementById('kvName').textContent = currentUser.name;
  document.getElementById('kvLogin').textContent = currentUser.login;
  document.getElementById('kvEmail').textContent = currentUser.email;
  document.getElementById('kvDate').textContent = currentUser.date;
  renderList();
}

function initCabinet() {
  bindTable(document.getElementById('listRows'));
  document.getElementById('clearList').addEventListener('click', function () {
    if (!confirm('Очистить весь список «Буду смотреть»?')) return;
    favs = [];
    save(favsKey(), favs);
    renderAll();
  });
  renderCabinet();
}

/* ================= КОНТАКТЫ ================= */
function initContacts() {
  var forms = document.querySelectorAll('#contacts form');
  // 1-я форма — обратная связь, 2-я — подписка
  forms[0].addEventListener('submit', function (e) {
    e.preventDefault();
    var name = document.getElementById('cn'), mail = document.getElementById('ce'), msg = document.getElementById('cm');
    var ok = true;
    [name, mail, msg].forEach(function (f) { f.classList.remove('bad'); });
    if (!name.value.trim()) { name.classList.add('bad'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.value.trim())) { mail.classList.add('bad'); ok = false; }
    if (!msg.value.trim()) { msg.classList.add('bad'); ok = false; }
    if (!ok) {
      showToast({ title: 'Проверь форму', text: 'Заполни имя, почту и сообщение.', time: 3500 });
      return;
    }
    // сервера нет, поэтому сообщение никуда не уходит — просто показываем уведомление
    showToast({ title: 'Спасибо, ' + name.value.trim() + '!', text: 'Это учебный сайт без сервера, поэтому сообщение никуда не отправилось.', time: 5000 });
    forms[0].reset();
  });
  forms[1].addEventListener('submit', function (e) {
    e.preventDefault();
    var sub = document.getElementById('sub');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sub.value.trim())) {
      sub.classList.add('bad');
      showToast({ title: 'Неверная почта', text: 'Введи адрес в формате name@mail.ru', time: 3500 });
      return;
    }
    sub.classList.remove('bad');
    showToast({ title: 'Подписка оформлена', text: 'Учебный режим: письма приходить не будут.', time: 4000 });
    forms[1].reset();
  });
}

/* ---------- перерисовать всё, что зависит от списка ---------- */
function renderAll() {
  renderBadges();
  renderHome();
  renderCatalog();
  renderSeries();
  renderList();
}

/* ---------- запуск ---------- */
if (PAGE === 'catalog') initCatalog();
if (PAGE === 'series') initSeries();
if (PAGE === 'collections') initCollections();
if (PAGE === 'cabinet') initCabinet();
if (PAGE === 'contacts') initContacts();
renderAll();

// всё готово — показываем страницу (см. body:not(.ready) в style.css)
document.body.classList.add('ready');
