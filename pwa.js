/* =========================================================
   DollieLand PWA
   Подключается в <head> сразу ПОСЛЕ telegram-web-app.js.

   Что делает:
   • определяет, где открыто приложение — в Telegram или как обычный сайт/PWA;
   • вне Telegram даёт вход «через Telegram»: бот присылает кнопку
     подтверждения, после неё сайт получает собственную сессию;
   • отдаёт основному скрипту готовые заголовки авторизации (DL_PWA.authHeaders);
   • регистрирует service worker и показывает «Установить приложение».
   ========================================================= */
(function () {
  'use strict';

  var API_BASE = 'https://dollieland.pythonanywhere.com';
  var BOT_USERNAME = 'DollieHelper_bot';

  var SESSION_KEY = 'dollieland_pwa_session';
  var PENDING_KEY = 'dollieland_pwa_pending_login';

  /* Пользователь уже отказался от установки / скрыл карточку */
  var INSTALL_DISMISS_KEY = 'dollieland_pwa_install_dismissed';

  /* Автоматическое предложение уже показывалось хотя бы один раз */
  var INSTALL_OFFERED_KEY = 'dollieland_pwa_install_offer_shown';

  var WebApp = window.Telegram && window.Telegram.WebApp;

  var inTelegram = !!(WebApp && WebApp.initData);

  var standalone =
    (window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;

  var ua = navigator.userAgent || '';

  var isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  /* =========================================================
     LOCAL STORAGE
     ========================================================= */

  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }

  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (_) {}
  }

  function lsDel(k) {
    try {
      localStorage.removeItem(k);
    } catch (_) {}
  }

  /* =========================================================
     SESSION
     ========================================================= */

  function readSession() {
    try {
      var s = JSON.parse(lsGet(SESSION_KEY) || 'null');

      return s && s.token && s.user && s.user.id ? s : null;
    } catch (_) {
      return null;
    }
  }

  var session = inTelegram ? null : readSession();

  /* =========================================================
     ПУБЛИЧНЫЙ ИНТЕРФЕЙС
     ========================================================= */

  window.DL_PWA = {
    inTelegram: inTelegram,

    standalone: standalone,

    tg: inTelegram ? WebApp : null,

    user: session ? session.user : undefined,

    authHeaders: function () {
      if (inTelegram) {
        return {
          Authorization: 'tma ' + WebApp.initData
        };
      }

      if (session) {
        return {
          Authorization: 'pwa ' + session.token
        };
      }

      return {};
    },

    logout: logout,

    openInstall: openInstallSheet
  };

  /* =========================================================
     ИСТЁКШАЯ СЕССИЯ
     ========================================================= */

  if (!inTelegram && session && window.fetch) {
    var origFetch = window.fetch.bind(window);
    var checking = false;

    window.fetch = function (input, init) {
      return origFetch(input, init).then(function (res) {
        var url =
          typeof input === 'string'
            ? input
            : (input && input.url) || '';

        if (
          res.status === 401 &&
          url.indexOf(API_BASE) === 0 &&
          !checking
        ) {
          checking = true;

          origFetch(API_BASE + '/api/pwa/me', {
            headers: window.DL_PWA.authHeaders()
          })
            .then(function (r) {
              if (r.status === 401) {
                lsDel(SESSION_KEY);
                location.reload();
              }
            })
            .catch(function () {})
            .then(function () {
              checking = false;
            });
        }

        return res;
      });
    };
  }

  /* =========================================================
     LOGOUT
     ========================================================= */

  function logout() {
    var headers = window.DL_PWA.authHeaders();

    lsDel(SESSION_KEY);

    fetch(API_BASE + '/api/pwa/logout', {
      method: 'POST',
      headers: headers
    })
      .catch(function () {})
      .then(function () {
        location.reload();
      });
  }

  /* =========================================================
     SERVICE WORKER
     ========================================================= */

  if (
    !inTelegram &&
    'serviceWorker' in navigator &&
    location.protocol === 'https:'
  ) {
    window.addEventListener('load', function () {
      navigator.serviceWorker
        .register('sw.js')
        .catch(function (e) {
          console.warn(
            'DollieLand: SW не зарегистрирован —',
            e
          );
        });
    });
  }

  /* =========================================================
     СТИЛИ
     ========================================================= */

  var css = '' +

    '.dlp-gate{' +
      'position:fixed;' +
      'inset:0;' +
      'z-index:10001;' +
      'background:var(--bg,#FFF9FB);' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:center;' +
      'padding:' +
        'calc(24px + env(safe-area-inset-top,0px)) ' +
        '20px ' +
        'calc(24px + env(safe-area-inset-bottom,0px));' +
      'overflow-y:auto' +
    '}' +

    '.dlp-logo{' +
      'width:84px;' +
      'height:84px;' +
      'border-radius:24px;' +
      'display:block;' +
      'margin:0 auto 16px;' +
      'box-shadow:0 10px 28px rgba(231,142,173,.3)' +
    '}' +

    '.dlp-status{' +
      'font-size:12.5px;' +
      'color:var(--text-secondary);' +
      'line-height:1.5;' +
      'margin-top:14px;' +
      'min-height:1em' +
    '}' +

    '.dlp-status b{' +
      'color:var(--text)' +
    '}' +

    '.dlp-wait{' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:center;' +
      'gap:10px;' +
      'font-size:13px;' +
      'font-weight:700;' +
      'color:var(--text);' +
      'margin:4px 0 8px' +
    '}' +

    '.dlp-spin{' +
      'width:18px;' +
      'height:18px;' +
      'border-radius:50%;' +
      'border:2.5px solid var(--pink-soft);' +
      'border-top-color:var(--pink-accent);' +
      'animation:spin .9s linear infinite' +
    '}' +

    '.dlp-steps{' +
      'display:grid;' +
      'gap:8px;' +
      'margin:4px 0 14px;' +
      'text-align:left' +
    '}' +

    '.dlp-step{' +
      'display:flex;' +
      'gap:10px;' +
      'align-items:flex-start;' +
      'background:var(--surface-soft);' +
      'border:1px solid var(--border);' +
      'border-radius:14px;' +
      'padding:11px 12px;' +
      'font-size:12.5px;' +
      'line-height:1.45;' +
      'color:var(--text-secondary)' +
    '}' +

    '.dlp-step b{' +
      'color:var(--text)' +
    '}' +

    '.dlp-num{' +
      'width:22px;' +
      'height:22px;' +
      'border-radius:50%;' +
      'background:var(--pink-soft);' +
      'color:var(--pink-accent);' +
      'font-size:11px;' +
      'font-weight:800;' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:center;' +
      'flex-shrink:0' +
    '}' +

    '.dlp-ios-share{' +
      'display:inline-block;' +
      'vertical-align:-3px;' +
      'width:16px;' +
      'height:16px' +
    '}' +

    '#dlp-install-item[hidden],' +
    '#dlp-install-card[hidden]{' +
      'display:none!important' +
    '}';

  function injectStyle() {
    var st = document.createElement('style');

    st.textContent = css;

    document.head.appendChild(st);
  }

  function el(html) {
    var t = document.createElement('div');

    t.innerHTML = html.trim();

    return t.firstChild;
  }

  /* =========================================================
     ВХОД ЧЕРЕЗ TELEGRAM
     ========================================================= */

  var pollTimer = null;
  var pollInFlight = false;

  function readPending() {
    try {
      var p = JSON.parse(lsGet(PENDING_KEY) || 'null');

      return (
        p &&
        p.nonce &&
        p.expires_at > Date.now()
      )
        ? p
        : null;
    } catch (_) {
      return null;
    }
  }

  function tgLink(nonce) {
    return (
      'tg://resolve?domain=' +
      BOT_USERNAME +
      '&start=pwa_' +
      nonce
    );
  }

  function webLink(nonce) {
    return (
      'https://t.me/' +
      BOT_USERNAME +
      '?start=pwa_' +
      nonce
    );
  }

  function renderLogin(state, message) {
    var gate = document.getElementById('dlp-gate');

    if (!gate) return;

    var body = gate.querySelector('#dlp-body');

    var pending = readPending();

    if (state === 'waiting' && pending) {
      body.innerHTML =

        '<div class="dlp-wait">' +
          '<span class="dlp-spin"></span>' +
          'Ждём подтверждения…' +
        '</div>' +

        '<div class="dlp-steps">' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">1</span>' +
            '<span>' +
              'В Telegram откроется чат с ' +
              '<b>@' + BOT_USERNAME + '</b>. ' +
              'Нажмите <b>«Запустить»</b>, если бот попросит.' +
            '</span>' +
          '</div>' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">2</span>' +
            '<span>' +
              'Нажмите в сообщении бота ' +
              '<b>«Да, это я — войти»</b>.' +
            '</span>' +
          '</div>' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">3</span>' +
            '<span>' +
              'Вернитесь сюда — вход выполнится сам.' +
            '</span>' +
          '</div>' +

        '</div>' +

        '<button type="button" ' +
          'class="btn btn-primary btn-block" ' +
          'id="dlp-open-tg">' +
          'Открыть Telegram' +
        '</button>' +

        '<a class="btn btn-tertiary btn-block" ' +
          'id="dlp-open-web" ' +
          'href="' + webLink(pending.nonce) + '"' +
          ' target="_blank" rel="noopener">' +
          'Не открывается? Ссылка t.me' +
        '</a>' +

        '<button type="button" ' +
          'class="btn btn-tertiary btn-block" ' +
          'id="dlp-cancel">' +
          'Отмена' +
        '</button>';

      body.querySelector('#dlp-open-tg').onclick =
        function () {
          location.href = tgLink(pending.nonce);
        };

      body.querySelector('#dlp-cancel').onclick =
        function () {
          stopPolling();

          lsDel(PENDING_KEY);

          renderLogin('idle');
        };

    } else {

      body.innerHTML =

        '<button type="button" ' +
          'class="btn btn-primary btn-block" ' +
          'id="dlp-login-btn">' +

          '<svg class="icon">' +
            '<use href="#icon-send"/>' +
          '</svg>' +

          ' Войти через Telegram' +

        '</button>' +

        '<div class="dlp-status" id="dlp-status">' +
          (
            message ||
            'Мы не узнаём ваш пароль и номер телефона — вход подтверждается кнопкой в нашем боте.'
          ) +
        '</div>';

      body.querySelector('#dlp-login-btn').onclick =
        startLogin;
    }
  }

  function startLogin() {
    var btn =
      document.getElementById('dlp-login-btn');

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Секунду…';
    }

    fetch(API_BASE + '/api/pwa/login/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: '{}'
    })

      .then(function (r) {
        return r.json();
      })

      .then(function (d) {

        if (!d || !d.ok || !d.nonce) {
          throw new Error(
            (d && d.error) || 'start_failed'
          );
        }

        lsSet(
          PENDING_KEY,
          JSON.stringify({
            nonce: d.nonce,
            expires_at:
              Date.now() +
              (Number(d.expires_in) || 300) * 1000
          })
        );

        renderLogin('waiting');

        startPolling();

        location.href = tgLink(d.nonce);
      })

      .catch(function (e) {

        renderLogin(
          'idle',

          e && e.message === 'too_many_attempts'
            ? 'Слишком много попыток. Подождите несколько минут.'
            : 'Не удалось начать вход. Проверьте интернет и попробуйте ещё раз.'
        );

      });
  }

  function startPolling() {
    stopPolling();

    pollTimer = setInterval(
      pollLogin,
      2500
    );

    pollLogin();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
    }

    pollTimer = null;
  }

  function pollLogin() {

    var pending = readPending();

    if (!pending) {

      stopPolling();

      lsDel(PENDING_KEY);

      renderLogin(
        'idle',
        'Время на подтверждение вышло. Нажмите «Войти через Telegram» ещё раз.'
      );

      return;
    }

    if (pollInFlight) return;

    pollInFlight = true;

    fetch(
      API_BASE +
      '/api/pwa/login/poll?nonce=' +
      encodeURIComponent(pending.nonce)
    )

      .then(function (r) {
        return r.json();
      })

      .then(function (d) {

        if (!d) return;

        if (
          d.status === 'confirmed' &&
          d.token &&
          d.user
        ) {

          stopPolling();

          lsDel(PENDING_KEY);

          lsSet(
            SESSION_KEY,
            JSON.stringify({
              token: d.token,
              user: d.user,
              created_at: Date.now()
            })
          );

          location.reload();

        } else if (
          d.status === 'rejected'
        ) {

          stopPolling();

          lsDel(PENDING_KEY);

          renderLogin(
            'idle',
            'Вход отменён в Telegram.'
          );

        } else if (
          d.status === 'expired'
        ) {

          stopPolling();

          lsDel(PENDING_KEY);

          renderLogin(
            'idle',
            'Время на подтверждение вышло. Нажмите «Войти через Telegram» ещё раз.'
          );
        }

      })

      .catch(function () {})

      .then(function () {
        pollInFlight = false;
      });
  }

  function showLoginGate() {

    if (
      document.getElementById('dlp-gate')
    ) {
      return;
    }

    var gate = el(

      '<div class="dlp-gate" ' +
        'id="dlp-gate" ' +
        'role="dialog" ' +
        'aria-modal="true" ' +
        'aria-label="Вход в DollieLand">' +

        '<div class="consent-card">' +

          '<img ' +
            'class="dlp-logo" ' +
            'src="icons/icon-192.png" ' +
            'alt="">' +

          '<h2>DollieLand</h2>' +

          '<p class="consent-text">' +
            'Ваши заказы, Dollies и Фортуна — те же, что в Telegram. ' +
            'Чтобы их показать, войдите через свой аккаунт Telegram.' +
          '</p>' +

          '<div id="dlp-body"></div>' +

        '</div>' +

      '</div>'
    );

    document.body.appendChild(gate);

    if (readPending()) {
      renderLogin('waiting');

      startPolling();
    } else {
      renderLogin('idle');
    }

    document.addEventListener(
      'visibilitychange',
      function () {

        if (
          document.visibilityState === 'visible' &&
          readPending()
        ) {

          if (!pollTimer) {
            startPolling();
          } else {
            pollLogin();
          }
        }
      }
    );
  }

  /* =========================================================
     УСТАНОВКА PWA
     ========================================================= */

  var deferredPrompt = null;

  window.addEventListener(
    'beforeinstallprompt',
    function (e) {

      e.preventDefault();

      deferredPrompt = e;

      refreshInstallUI();
    }
  );

  window.addEventListener(
    'appinstalled',
    function () {

      deferredPrompt = null;

      lsSet(
        INSTALL_DISMISS_KEY,
        '1'
      );

      markInstallOfferShown();

      refreshInstallUI();

      closeInstallSheet();
    }
  );

  function appUrl() {
    return (
      location.origin +
      location.pathname
    );
  }

  function canOfferInstall() {

    return (
      !standalone &&
      (
        inTelegram ||
        !!deferredPrompt ||
        isIOS ||
        !!session
      )
    );
  }

  /* =========================================================
     INSTALL MODAL
     ========================================================= */

  function ensureInstallSheet() {

    var ov =
      document.getElementById(
        'dlp-install'
      );

    if (ov) return ov;

    ov = el(

      '<div ' +
        'class="review-prompt-overlay" ' +
        'id="dlp-install" ' +
        'style="z-index:85">' +

        '<div ' +
          'class="review-prompt-card" ' +
          'role="dialog" ' +
          'aria-modal="true">' +

          '<img ' +
            'class="dlp-logo" ' +
            'src="icons/icon-192.png" ' +
            'alt="" ' +
            'style="' +
              'width:64px;' +
              'height:64px;' +
              'border-radius:18px;' +
              'margin:0 0 12px' +
            '">' +

          '<h2>DollieLand как приложение</h2>' +

          '<div id="dlp-install-body"></div>' +

        '</div>' +

      '</div>'
    );

    ov.addEventListener(
      'click',
      function (e) {

        if (e.target === ov) {
          closeInstallSheet();
        }

      }
    );

    document.body.appendChild(ov);

    return ov;
  }

  function closeInstallSheet() {

    var ov =
      document.getElementById(
        'dlp-install'
      );

    if (ov) {
      ov.classList.remove('open');
    }
  }

  /* =========================================================
     ПЕРВЫЙ ПОКАЗ
     ========================================================= */

  function markInstallOfferShown() {

    lsSet(
      INSTALL_OFFERED_KEY,
      '1'
    );
  }

  function hasInstallOfferBeenShown() {

    return (
      lsGet(INSTALL_OFFERED_KEY) === '1'
    );
  }

  /* =========================================================
     ОКНО УСТАНОВКИ
     ========================================================= */

  function openInstallSheet(options) {

    options = options || {};

    /*
     Если окно открыто автоматически при первом входе,
     сразу запоминаем факт показа.
    */
    if (options.auto) {
      markInstallOfferShown();
    }

    var ov =
      ensureInstallSheet();

    var body =
      ov.querySelector(
        '#dlp-install-body'
      );

    var later =
      '<button type="button" ' +
        'class="btn btn-tertiary btn-block" ' +
        'id="dlp-inst-close">' +
        'Позже' +
      '</button>';

    /* =====================================================
       TELEGRAM
       ===================================================== */

    if (inTelegram) {

      body.innerHTML =

        '<p class="review-prompt-order">' +
          'Своя иконка на экране телефона и вход без Telegram-чата.' +
        '</p>' +

        '<div class="dlp-steps">' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">1</span>' +
            '<span>' +
              'Откройте DollieLand в браузере — кнопка ниже. ' +
              'На iPhone выберите <b>Safari</b>.' +
            '</span>' +
          '</div>' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">2</span>' +
            '<span>' +
              'Нажмите там <b>«Установить приложение»</b> ' +
              'и войдите через Telegram.' +
            '</span>' +
          '</div>' +

        '</div>' +

        '<button type="button" ' +
          'class="btn btn-primary btn-block" ' +
          'id="dlp-inst-go">' +
          'Открыть в браузере' +
        '</button>' +

        later;

      body.querySelector(
        '#dlp-inst-go'
      ).onclick = function () {

        try {

          WebApp.openLink(
            appUrl()
          );

        } catch (_) {

          window.open(
            appUrl(),
            '_blank'
          );

        }

      };

    }

    /* =====================================================
       CHROME / ANDROID / DESKTOP
       ===================================================== */

    else if (deferredPrompt) {

      body.innerHTML =

        '<p class="review-prompt-order">' +
          'Иконка появится на главном экране, а DollieLand ' +
          'будет открываться в своём окне — как обычное приложение.' +
        '</p>' +

        '<button type="button" ' +
          'class="btn btn-primary btn-block" ' +
          'id="dlp-inst-go">' +
          'Установить' +
        '</button>' +

        later;

      body.querySelector(
        '#dlp-inst-go'
      ).onclick = function () {

        var p =
          deferredPrompt;

        deferredPrompt = null;

        p.prompt();

        p.userChoice.then(
          function (c) {

            /*
             Даже если пользователь нажал
             «Отмена», автоматическое окно больше
             не показываем.
            */
            markInstallOfferShown();

            if (
              c &&
              c.outcome === 'accepted'
            ) {

              lsSet(
                INSTALL_DISMISS_KEY,
                '1'
              );
            }

            closeInstallSheet();

            refreshInstallUI();
          }
        );
      };

    }

    /* =====================================================
       IOS
       ===================================================== */

    else if (isIOS) {

      var share =
        '<svg ' +
          'class="dlp-ios-share" ' +
          'viewBox="0 0 24 24" ' +
          'fill="none" ' +
          'stroke="currentColor" ' +
          'stroke-width="2" ' +
          'stroke-linecap="round" ' +
          'stroke-linejoin="round">' +

          '<path d="M12 3v12"/>' +
          '<path d="M8 7l4-4 4 4"/>' +
          '<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>' +

        '</svg>';

      body.innerHTML =

        '<p class="review-prompt-order">' +
          'На iPhone это делается в Safari за три касания.' +
        '</p>' +

        '<div class="dlp-steps">' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">1</span>' +
            '<span>' +
              'Нажмите <b>«Поделиться»</b> ' +
              share +
              ' внизу Safari.' +
            '</span>' +
          '</div>' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">2</span>' +
            '<span>' +
              'Выберите <b>«На экран «Домой»»</b>.' +
            '</span>' +
          '</div>' +

          '<div class="dlp-step">' +
            '<span class="dlp-num">3</span>' +
            '<span>' +
              'Нажмите <b>«Добавить»</b>, ' +
              'откройте DollieLand с новой иконки ' +
              'и войдите через Telegram.' +
            '</span>' +
          '</div>' +

        '</div>' +

        later;
    }

    /* =====================================================
       ДРУГИЕ БРАУЗЕРЫ
       ===================================================== */

    else {

      body.innerHTML =

        '<p class="review-prompt-order">' +
          'Откройте меню браузера (⋮) и выберите ' +
          '<b>«Установить приложение»</b> или ' +
          '<b>«Добавить на главный экран»</b>.' +
        '</p>' +

        later;
    }

    var closeButton =
      body.querySelector(
        '#dlp-inst-close'
      );

    if (closeButton) {
      closeButton.onclick =
        closeInstallSheet;
    }

    requestAnimationFrame(
      function () {
        ov.classList.add('open');
      }
    );
  }

  /* =========================================================
     АВТОМАТИЧЕСКОЕ ПРЕДЛОЖЕНИЕ ТОЛЬКО ОДИН РАЗ
     ========================================================= */

  function offerInstallOnce() {

    /*
     Если приложение уже установлено —
     ничего не показываем.
    */
    if (standalone) {
      return;
    }

    /*
     Если автоматическое предложение уже
     когда-либо показывалось — больше не показываем.
    */
    if (hasInstallOfferBeenShown()) {
      return;
    }

    /*
     Если пользователь ранее явно отказался
     от установки в старой версии — тоже
     больше ничего автоматически не показываем.
    */
    if (
      lsGet(INSTALL_DISMISS_KEY) === '1'
    ) {

      markInstallOfferShown();

      return;
    }

    /*
     Если браузер сейчас не позволяет
     предложить установку — выходим.
    */
    if (!canOfferInstall()) {
      return;
    }

    /*
     Первое автоматическое открытие.
     После него INSTALL_OFFERED_KEY
     сохраняется навсегда в localStorage.
    */
    openInstallSheet({
      auto: true
    });
  }

  /* =========================================================
     ОБНОВЛЕНИЕ КНОПОК УСТАНОВКИ
     ========================================================= */

  function refreshInstallUI() {

    var item =
      document.getElementById(
        'dlp-install-item'
      );

    if (item) {

      item.hidden =
        !canOfferInstall();
    }

    var card =
      document.getElementById(
        'dlp-install-card'
      );

    if (card) {

      card.hidden =
        !(
          canOfferInstall() &&
          !inTelegram &&
          lsGet(INSTALL_DISMISS_KEY) !== '1'
        );
    }
  }

  /* =========================================================
     UI В ПРОФИЛЕ
     ========================================================= */

  function injectUI() {

    var lists =
      document.querySelectorAll(
        '#tab-profile .menu-list'
      );

    var lastList =
      lists[lists.length - 1];

    /*
     Кнопка «Установить как приложение»
     */

    if (
      lastList &&
      !document.getElementById(
        'dlp-install-item'
      )
    ) {

      var item = el(

        '<button type="button" ' +
          'class="menu-item" ' +
          'id="dlp-install-item" ' +
          'hidden>' +

          '<svg class="icon">' +
            '<use href="#icon-house"/>' +
          '</svg>' +

          '<span class="label">' +
            'Установить как приложение' +
          '</span>' +

          '<svg class="icon chev">' +
            '<use href="#icon-chevron-right"/>' +
          '</svg>' +

        '</button>'
      );

      item.onclick =
        openInstallSheet;

      lastList.appendChild(item);
    }

    /*
     Кнопка выхода
     */

    if (
      !inTelegram &&
      session &&
      lastList &&
      !document.getElementById(
        'dlp-logout-item'
      )
    ) {

      var out = el(

        '<button type="button" ' +
          'class="menu-item" ' +
          'id="dlp-logout-item">' +

          '<svg class="icon">' +
            '<use href="#icon-x"/>' +
          '</svg>' +

          '<span class="label">' +
            'Выйти из аккаунта' +
          '</span>' +

        '</button>'
      );

      out.onclick = function () {

        if (
          confirm(
            'Выйти из DollieLand на этом устройстве?'
          )
        ) {
          logout();
        }

      };

      lastList.appendChild(out);
    }

    /*
     Карточка установки на главной
     */

    var anchor =
      document.getElementById(
        'orders-summary-card'
      );

    if (
      !inTelegram &&
      anchor &&
      !document.getElementById(
        'dlp-install-card'
      )
    ) {

      var card = el(

        '<button type="button" ' +
          'class="orders-summary-card homescreen-card" ' +
          'id="dlp-install-card" ' +
          'hidden>' +

          '<div class="orders-summary-icon">' +
            '<svg class="icon">' +
              '<use href="#icon-house"/>' +
            '</svg>' +
          '</div>' +

          '<div class="orders-summary-text hs-text">' +

            '<span class="hs-title">' +
              'Установить DollieLand' +
            '</span>' +

            '<span class="hs-sub">' +
              'Своя иконка на экране телефона' +
            '</span>' +

          '</div>' +

          '<span ' +
            'class="hs-close" ' +
            'role="button" ' +
            'aria-label="Скрыть">' +

            '<svg class="icon">' +
              '<use href="#icon-x"/>' +
            '</svg>' +

          '</span>' +

        '</button>'
      );

      card.onclick =
        openInstallSheet;

      card.querySelector(
        '.hs-close'
      ).onclick = function (e) {

        e.stopPropagation();

        lsSet(
          INSTALL_DISMISS_KEY,
          '1'
        );

        refreshInstallUI();
      };

      anchor.insertAdjacentElement(
        'afterend',
        card
      );
    }

    refreshInstallUI();
  }

  /* =========================================================
     ЗАПУСК
     ========================================================= */

  document.addEventListener(
    'DOMContentLoaded',
    function () {

      injectStyle();

      /*
       В обычном браузере без сессии
       сначала показываем вход.
      */
      if (
        !inTelegram &&
        !session
      ) {
        showLoginGate();
      }

      injectUI();

      /*
       ПЕРВЫЙ ЗАХОД:
       
       Telegram:
       → окно установки через 450 мс.

       Обычный браузер с уже существующей
       сессией:
       → окно установки через 450 мс.

       Обычный браузер без сессии:
       → сначала вход через Telegram,
       → после успешного входа страница перезагрузится,
       → после этого окно установки появится один раз.
      */

      if (
        inTelegram ||
        session
      ) {

        setTimeout(
          function () {

            offerInstallOnce();

          },
          450
        );
      }

    }
  );

})();
