(function () {
  'use strict';

  var API_BASE = '/api';
  var BOT_USERNAME = 'DollieHelper_bot';

  var SESSION_KEY = 'dollieland_session';
  var PENDING_KEY = 'dollieland_pending_install';
  var DISMISSED_KEY = 'dollieland_install_dismissed';
  var INSTALL_OFFERED_KEY = 'dollieland_install_offered';
  var INSTALL_REQUEST_PARAM = 'install';

  var tg = window.Telegram && window.Telegram.WebApp
    ? window.Telegram.WebApp
    : null;

  var inTelegram = !!tg;
  var session = null;
  var deferredPrompt = null;

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua);
  var isAndroid = /Android/i.test(ua);

  var standalone =
    window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches;

  if (window.navigator.standalone === true) {
    standalone = true;
  }

  try {
    session = localStorage.getItem(SESSION_KEY);
  } catch (_) {
    session = null;
  }

  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (_) {}
  }

  window.DL_PWA = {
    isInstalled: function () {
      return standalone;
    },
    isTelegram: function () {
      return inTelegram;
    },
    openInstall: function () {
      openInstallSheet();
    }
  };

  /*
   * ============================================================
   * SERVICE WORKER
   * ============================================================
   */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/pwa-sw.js')
        .then(function (registration) {
          try {
            registration.update();
          } catch (_) {}
        })
        .catch(function () {});
    });
  }

  /*
   * ============================================================
   * INSTALL PROMPT
   * ============================================================
   */

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;

    /*
     * Если пользователь уже пришёл по специальной ссылке
     * ?install=1, показываем инструкцию сразу.
     */
    if (hasInstallRequest() && !standalone) {
      setTimeout(function () {
        openInstallSheet({
          fromTelegram: true
        });
      }, 100);
    }
  });

  window.addEventListener('appinstalled', function () {
    standalone = true;
    deferredPrompt = null;

    try {
      localStorage.setItem(INSTALL_OFFERED_KEY, '1');
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(INSTALL_REQUEST_PARAM);
    } catch (_) {}

    closeInstallSheet();

    try {
      fetch(API_BASE + '/pwa-install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          installed: true
        })
      }).catch(function () {});
    } catch (_) {}
  });

  /*
   * ============================================================
   * STYLES
   * ============================================================
   */

  function injectStyle() {
    if (document.getElementById('dollie-pwa-style')) {
      return;
    }

    var style = document.createElement('style');
    style.id = 'dollie-pwa-style';

    style.textContent = `
      .dlp-overlay {
        position: fixed;
        inset: 0;
        z-index: 10010;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
        background: rgba(0,0,0,.38);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .dlp-sheet {
        width: min(430px, 100%);
        max-height: min(760px, calc(100vh - 40px));
        overflow-y: auto;
        box-sizing: border-box;
        border-radius: 28px;
        background: #fff;
        box-shadow: 0 25px 80px rgba(0,0,0,.22);
        padding: 24px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
          Roboto, Helvetica, Arial, sans-serif;
        color: #282226;
        position: relative;
      }

      .dlp-close {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 50%;
        background: #f5f1f3;
        color: #5f555a;
        font-size: 22px;
        line-height: 36px;
        text-align: center;
        cursor: pointer;
      }

      .dlp-title {
        margin: 4px 42px 8px 0;
        font-size: 24px;
        line-height: 1.2;
        font-weight: 700;
      }

      .dlp-subtitle {
        margin: 0 0 20px;
        font-size: 14px;
        line-height: 1.5;
        color: #756b70;
      }

      .dlp-step {
        display: flex;
        gap: 13px;
        margin: 15px 0;
        padding: 15px;
        border-radius: 18px;
        background: #faf7f8;
      }

      .dlp-step-number {
        flex: 0 0 30px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #ead1dc;
        color: #49333d;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .dlp-step-content {
        min-width: 0;
        font-size: 14px;
        line-height: 1.5;
      }

      .dlp-step-content strong {
        display: block;
        margin-bottom: 3px;
        font-size: 15px;
      }

      .dlp-button {
        width: 100%;
        border: 0;
        border-radius: 17px;
        padding: 15px 18px;
        font-size: 15px;
        font-weight: 650;
        cursor: pointer;
        margin-top: 10px;
      }

      .dlp-button-primary {
        background: #e8c4d2;
        color: #392832;
      }

      .dlp-button-secondary {
        background: #f4eff1;
        color: #4c4247;
      }

      .dlp-hint {
        margin-top: 14px;
        text-align: center;
        font-size: 12px;
        line-height: 1.45;
        color: #8b8085;
      }

      .dlp-gate {
        position: fixed !important;
        z-index: 10001 !important;
      }
    `;

    document.head.appendChild(style);
  }

  /*
   * ============================================================
   * LOGIN GATE
   * ============================================================
   */

  function showLoginGate() {
    if (document.querySelector('.dlp-gate')) {
      return;
    }

    var gate = document.createElement('div');
    gate.className = 'dlp-gate';

    gate.innerHTML = `
      <div style="
        position:fixed;
        inset:0;
        z-index:10001;
        background:rgba(255,255,255,.97);
        display:flex;
        align-items:center;
        justify-content:center;
        padding:24px;
        box-sizing:border-box;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
      ">
        <div style="
          width:min(420px,100%);
          text-align:center;
        ">
          <div style="
            font-size:22px;
            font-weight:700;
            margin-bottom:10px;
            color:#30272c;
          ">
            DollieLand
          </div>

          <div style="
            font-size:14px;
            line-height:1.5;
            color:#756b70;
          ">
            Для продолжения войдите в свой аккаунт.
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(gate);
  }

  /*
   * ============================================================
   * INSTALL URL
   * ============================================================
   */

  function hasInstallRequest() {
    try {
      return new URLSearchParams(location.search)
        .get(INSTALL_REQUEST_PARAM) === '1';
    } catch (_) {
      return /(?:^|[?&])install=1(?:&|$)/.test(location.search);
    }
  }

  function appUrl() {
    var url = location.origin + location.pathname;

    return url +
      (url.indexOf('?') >= 0 ? '&' : '?') +
      INSTALL_REQUEST_PARAM +
      '=1';
  }

  function canOfferInstall() {
    return !standalone && (
      inTelegram ||
      !!deferredPrompt ||
      isIOS ||
      !!session ||
      hasInstallRequest()
    );
  }

  /*
   * ============================================================
   * INSTALL SHEET
   * ============================================================
   */

  function openInstallSheet(options) {
    options = options || {};

    if (standalone) {
      return;
    }

    var old = document.querySelector('.dlp-overlay');

    if (old) {
      old.remove();
    }

    var overlay = document.createElement('div');
    overlay.className = 'dlp-overlay';

    var sheet = document.createElement('div');
    sheet.className = 'dlp-sheet';

    var close = document.createElement('button');
    close.className = 'dlp-close';
    close.type = 'button';
    close.innerHTML = '×';

    close.addEventListener('click', function () {
      closeInstallSheet();
    });

    sheet.appendChild(close);

    var title = document.createElement('div');
    title.className = 'dlp-title';
    title.textContent = 'Установить DollieLand';

    sheet.appendChild(title);

    var subtitle = document.createElement('div');
    subtitle.className = 'dlp-subtitle';
    subtitle.textContent =
      'Добавьте DollieLand на главный экран, чтобы открывать приложение как обычное приложение.';

    sheet.appendChild(subtitle);

    /*
     * ============================================================
     * TELEGRAM
     * ============================================================
     */

    if (inTelegram && !options.fromTelegram) {
      addStep(
        sheet,
        '1',
        'Откройте DollieLand в браузере',
        'Telegram может не показывать системную установку внутри Mini App.'
      );

      var telegramButton = document.createElement('button');
      telegramButton.className =
        'dlp-button dlp-button-primary';
      telegramButton.textContent = 'Открыть в браузере';

      telegramButton.addEventListener('click', function () {
        var url = appUrl();

        try {
          if (tg && typeof tg.openLink === 'function') {
            tg.openLink(url);
          } else {
            window.open(url, '_blank');
          }
        } catch (_) {
          window.open(url, '_blank');
        }
      });

      sheet.appendChild(telegramButton);

      var telegramHint = document.createElement('div');
      telegramHint.className = 'dlp-hint';
      telegramHint.textContent =
        'После открытия в браузере появится инструкция установки.';

      sheet.appendChild(telegramHint);
    }

    /*
     * ============================================================
     * ANDROID / CHROME
     * ============================================================
     */

    else if (deferredPrompt) {
      addStep(
        sheet,
        '1',
        'Нажмите кнопку установки',
        'Браузер предложит добавить DollieLand на главный экран.'
      );

      var installButton = document.createElement('button');
      installButton.className =
        'dlp-button dlp-button-primary';
      installButton.textContent = 'Установить приложение';

      installButton.addEventListener('click', function () {
        try {
          deferredPrompt.prompt();

          deferredPrompt.userChoice
            .then(function () {
              deferredPrompt = null;
              closeInstallSheet();
            })
            .catch(function () {
              deferredPrompt = null;
            });
        } catch (_) {}
      });

      sheet.appendChild(installButton);

      var androidHint = document.createElement('div');
      androidHint.className = 'dlp-hint';
      androidHint.textContent =
        'Если окно установки не появилось, воспользуйтесь меню браузера.';

      sheet.appendChild(androidHint);
    }

    /*
     * ============================================================
     * IOS
     * ============================================================
     */

    else if (isIOS) {
      addStep(
        sheet,
        '1',
        'Нажмите кнопку «Поделиться»',
        'Она находится в нижней панели Safari.'
      );

      addStep(
        sheet,
        '2',
        'Выберите «На экран Домой»',
        'Пролистайте меню действий, если пункт не виден сразу.'
      );

      addStep(
        sheet,
        '3',
        'Нажмите «Добавить»',
        'После этого DollieLand появится среди приложений на главном экране.'
      );

      var iosHint = document.createElement('div');
      iosHint.className = 'dlp-hint';
      iosHint.textContent =
        'Важно: установка на iPhone выполняется через Safari.';

      sheet.appendChild(iosHint);
    }

    /*
     * ============================================================
     * OTHER BROWSERS
     * ============================================================
     */

    else {
      addStep(
        sheet,
        '1',
        'Откройте меню браузера',
        'Найдите пункт «Установить приложение», «Установить DollieLand» или «Добавить на главный экран».'
      );

      addStep(
        sheet,
        '2',
        'Подтвердите установку',
        'Название пункта может немного отличаться в зависимости от браузера.'
      );

      var genericHint = document.createElement('div');
      genericHint.className = 'dlp-hint';
      genericHint.textContent =
        'На Android обычно это меню ⋮ в правом верхнем углу.';

      sheet.appendChild(genericHint);
    }

    overlay.appendChild(sheet);

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeInstallSheet();
      }
    });

    document.body.appendChild(overlay);

    try {
      localStorage.setItem(INSTALL_OFFERED_KEY, '1');
    } catch (_) {}
  }

  function addStep(parent, number, title, text) {
    var step = document.createElement('div');
    step.className = 'dlp-step';

    var numberEl = document.createElement('div');
    numberEl.className = 'dlp-step-number';
    numberEl.textContent = number;

    var content = document.createElement('div');
    content.className = 'dlp-step-content';

    var strong = document.createElement('strong');
    strong.textContent = title;

    var description = document.createElement('div');
    description.textContent = text;

    content.appendChild(strong);
    content.appendChild(description);

    step.appendChild(numberEl);
    step.appendChild(content);

    parent.appendChild(step);
  }

  function closeInstallSheet() {
    var overlay = document.querySelector('.dlp-overlay');

    if (overlay) {
      overlay.remove();
    }
  }

  /*
   * ============================================================
   * UI BUTTON
   * ============================================================
   */

  function injectUI() {
    if (document.getElementById('dlp-install-button')) {
      return;
    }

    if (!canOfferInstall()) {
      return;
    }

    var button = document.createElement('button');
    button.id = 'dlp-install-button';
    button.type = 'button';

    button.textContent = 'Установить как приложение';

    button.style.cssText = `
      width:100%;
      border:0;
      border-radius:16px;
      padding:14px 18px;
      background:#ead1dc;
      color:#3d3036;
      font-size:14px;
      font-weight:650;
      cursor:pointer;
      margin-top:10px;
    `;

    button.addEventListener('click', function () {
      openInstallSheet();
    });

    /*
     * Сначала пытаемся найти подходящий контейнер.
     */
    var target =
      document.querySelector('[data-pwa-install]') ||
      document.querySelector('.pwa-install') ||
      document.querySelector('#pwa-install');

    if (target) {
      target.appendChild(button);
      return;
    }

    /*
     * Если специального контейнера нет, кнопку не вставляем
     * случайно в середину приложения.
     */
  }

  /*
   * ============================================================
   * STARTUP
   * ============================================================
   */

  document.addEventListener('DOMContentLoaded', function () {
    injectStyle();

    var installRequested = hasInstallRequest();

    /*
     * ВАЖНО:
     *
     * Если пользователь пришёл из Mini App по ссылке
     * ?install=1, инструкция установки должна открыться
     * ДО экрана авторизации.
     *
     * Раньше showLoginGate() перекрывал её своим z-index,
     * а автоматический показ вообще не запускался без session.
     */

    if (!inTelegram && !session && !installRequested) {
      showLoginGate();
    }

    injectUI();

    /*
     * Пользователь пришёл из Mini App:
     *
     * Mini App
     *     ↓
     * Открыть в браузере
     *     ↓
     * ?install=1
     *     ↓
     * автоматически открываем инструкцию
     */

    if (installRequested && !standalone) {
      var opened = false;

      function openRequestedInstall() {
        if (opened || standalone) {
          return;
        }

        opened = true;

        openInstallSheet({
          fromTelegram: true
        });
      }

      /*
       * Если браузер уже передал beforeinstallprompt —
       * показываем сразу.
       */
      if (deferredPrompt) {
        setTimeout(openRequestedInstall, 100);
      }

      /*
       * Если beforeinstallprompt ещё не успел сработать,
       * всё равно показываем инструкцию.
       */
      else {
        setTimeout(openRequestedInstall, 700);
      }
    }
  });

})();
