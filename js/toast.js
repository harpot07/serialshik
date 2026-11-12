/* =========================================================
   toast.js — уведомления в правом верхнем углу
   showToast({ title, text, from, extra, time })
   ========================================================= */
function showToast(o) {
  var box = document.getElementById('toasts');
  var t = document.createElement('div');
  var time = o.time || 6000;

  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML =
    '<div class="t-ico"><svg class="i"><use href="#i-mail"/></svg></div>' +
    '<div class="t-body">' +
      '<div class="t-top"><span>' + (o.from || 'Сериальщик') + '</span><span>сейчас</span></div>' +
      '<b>' + o.title + '</b>' +
      '<div class="t-text">' + o.text + '</div>' +
      (o.extra || '') +
    '</div>' +
    '<button type="button" class="t-x" aria-label="Закрыть уведомление">×</button>';

  box.prepend(t); // новые сверху

  function close() {
    if (!t.parentNode) return;
    t.remove();
  }

  t.querySelector('.t-x').onclick = close;
  var timer = setTimeout(close, time);

  // пока мышка на уведомлении — оно не исчезает
  t.addEventListener('mouseenter', function () { clearTimeout(timer); });
  t.addEventListener('mouseleave', function () { timer = setTimeout(close, 2500); });

  return { el: t, close: close };
}
