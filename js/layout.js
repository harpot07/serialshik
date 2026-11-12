/* =========================================================
   layout.js — поведение общих частей страницы
   (сама шапка, меню и подвал уже есть в HTML каждой страницы,
   поэтому при переходах они не «перерисовываются» и не дёргаются)
   ========================================================= */
(function () {
  // страховка: если какой-то скрипт ниже упадёт, страница всё равно покажется через секунду
  setTimeout(function () { document.body.classList.add('ready'); }, 1000);

  // бургер на телефоне
  document.getElementById('burger').addEventListener('click', function () {
    document.body.classList.toggle('menu');
  });

  // поиск в шапке: Enter -> каталог с запросом, Ctrl+K -> фокус на поиск
  var top = document.getElementById('topSearch');
  top.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      location.href = 'catalog.html?q=' + encodeURIComponent(top.value.trim());
    }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      top.focus();
    }
  });
})();
