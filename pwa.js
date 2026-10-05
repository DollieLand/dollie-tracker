/* =========================================================
DollieLand PWA
Подключается в <head> сразу ПОСЛЕ telegram-web-app.js.

- определяет, где открыто приложение — в Telegram или как сайт/PWA;
- вне Telegram даёт вход «через Telegram» (бот подтверждает вход);
- отдаёт основному скрипту заголовки авторизации (DL_PWA.authHeaders);
- регистрирует service worker;
- при первом входе предлагает установить приложение на телефон
  и показывает пошаговую инструкцию отдельно для iPhone и Android.
========================================================= */
(function () {
'use strict';

var API_BASE = 'https://dollieland.pythonanywhere.com';
var BOT_USERNAME = 'DollieHelper_bot';
var SESSION_KEY = 'dollieland_pwa_session';
var PENDING_KEY = 'dollieland_pwa_pending_login';
var INSTALL_DISMISS_KEY = 'dollieland_pwa_install_dismissed';
// Окно «Установите приложение» при первом входе. Чтобы показать его всем
// ещё раз (например, после редизайна) — просто поменяйте _v1 на _v2.
var INTRO_KEY = 'dollieland_install_intro_v1';

var WebApp = window.Telegram && window.Telegram.WebApp;
var inTelegram = !!(WebApp && WebApp.initData);
var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
var ua = navigator.userAgent || '';
var tgPlatform = inTelegram ? String(WebApp.platform || '') : '';
var isIOS = tgPlatform === 'ios' || /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
var isAndroid = tgPlatform === 'android' || tgPlatform === 'android_x' || /Android/i.test(ua);
var isMobileDevice = isIOS || isAndroid;
var isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS/.test(ua);

function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (_) {} }

function readSession() {
    try {
        var s = JSON.parse(lsGet(SESSION_KEY) || 'null');
        return s && s.token && s.user && s.user.id ? s : null;
    } catch (_) { return null; }
}
var session = inTelegram ? null : readSession();

/* ---------- Публичный интерфейс для основного скрипта ---------- */
window.DL_PWA = {
    inTelegram: inTelegram,
    standalone: standalone,
    tg: inTelegram ? WebApp : null,
    user: session ? session.user : undefined,
    authHeaders: function () {
        if (inTelegram) return { Authorization: 'tma ' + WebApp.initData };
        if (session) return { Authorization: 'pwa ' + session.token };
        return {};
    },
    logout: logout,
    openInstall: function () { openInstallSheet('guide'); },
};

/* ---------- Истёкшая сессия → снова экран входа ---------- */
if (!inTelegram && session && window.fetch) {
    var origFetch = window.fetch.bind(window);
    var checking = false;
    window.fetch = function (input, init) {
        return origFetch(input, init).then(function (res) {
            var url = typeof input === 'string' ? input : (input && input.url) || '';
            var isMeRequest = url.indexOf('/api/pwa/me') !== -1;
            if (res.status === 401 && url.indexOf(API_BASE) === 0 && !checking && !isMeRequest) {
                checking = true;
                origFetch(API_BASE + '/api/pwa/me', { headers: window.DL_PWA.authHeaders() })
                    .then(function (r) { if (r.status === 401) { lsDel(SESSION_KEY); location.reload(); } })
                    .catch(function () {})
                    .then(function () { checking = false; });
            }
            return res;
        });
    };
}

function logout() {
    var headers = window.DL_PWA.authHeaders();
    lsDel(SESSION_KEY);
    fetch(API_BASE + '/api/pwa/logout', { method: 'POST', headers: headers })
        .catch(function () {})
        .then(function () { location.reload(); });
}

/* ---------- Service worker ---------- */
if (!inTelegram && 'serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (e) {
            console.warn('DollieLand: SW не зарегистрирован —', e);
        });
    });
}

/* ---------- Стили ---------- */
var css = '' +
    '.dlp-gate{position:fixed;inset:0;z-index:10001;background:var(--bg,#FFF9FB);display:flex;align-items:center;justify-content:center;' +
    'padding:calc(24px + env(safe-area-inset-top,0px)) 20px calc(24px + env(safe-area-inset-bottom,0px));overflow-y:auto;}' +
    '.dlp-logo{width:84px;height:84px;border-radius:24px;display:block;margin:0 auto 16px;box-shadow:0 10px 28px rgba(231,142,173,.3);}' +
    '.dlp-status{font-size:12.5px;color:var(--text-secondary);line-height:1.5;margin-top:14px;min-height:1em;}' +
    '.dlp-status b{color:var(--text);}' +
    '.dlp-wait{display:flex;align-items:center;justify-content:center;gap:10px;font-size:13px;font-weight:700;color:var(--text);margin:4px 0 8px;}' +
    '.dlp-spin{width:18px;height:18px;border-radius:50%;border:2.5px solid var(--pink-soft);border-top-color:var(--pink-accent);animation:dlp-spin .9s linear infinite;}' +
    '@keyframes dlp-spin{to{transform:rotate(360deg);}}' +
    '.dlp-steps{display:flex;flex-direction:column;gap:8px;margin:4px 0 14px;text-align:left;}' +
    '.dlp-step{display:flex;gap:10px;align-items:flex-start;background:var(--surface-soft);border:1px solid var(--border);border-radius:14px;padding:11px 12px;font-size:12.5px;line-height:1.5;color:var(--text-secondary);}' +
    '.dlp-step b{color:var(--text);}' +
    '.dlp-num{width:22px;height:22px;border-radius:50%;background:var(--pink-soft);color:var(--pink-accent);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
    '.dlp-ios-share{display:inline-block;vertical-align:-3px;width:16px;height:16px;color:#2F7CF6;}' +
    '.dlp-kbd{display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:7px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-weight:700;white-space:nowrap;}' +
    '#dlp-install-item[hidden],#dlp-install-card[hidden]{display:none !important;}' +
    /* Чтобы не было двух карточек «установить»: старую Telegram-карточку прячем, если видна наша */
    '#dlp-install-card:not([hidden]) ~ #homescreen-card{display:none !important;}' +
    /* Инструкция должна быть видна даже поверх экрана входа в браузере */
    '#sheet-install{z-index:10061;}' +
    '#sheet-overlay:has(~ #sheet-install.open){z-index:10060;}' +
    '.dlp-intro{text-align:center;padding:2px 0 4px;}' +
    '.dlp-intro .dlp-logo{width:76px;height:76px;border-radius:22px;margin:4px auto 14px;}' +
    '.dlp-intro h3{font-family:Fraunces,Georgia,serif;font-style:italic;font-weight:600;font-size:23px;color:var(--text);line-height:1.2;}' +
    '.dlp-intro p{font-size:13.5px;color:var(--text-secondary);line-height:1.5;margin:8px auto 16px;max-width:320px;}' +
    '.dlp-benefits{display:grid;gap:8px;margin:0 0 16px;text-align:left;}' +
    '.dlp-benefit{display:flex;align-items:center;gap:11px;padding:11px 13px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);font-size:13px;font-weight:600;color:var(--text);line-height:1.35;}' +
    '.dlp-benefit .icon{width:18px;height:18px;color:var(--pink-accent);flex-shrink:0;}' +
    '.dlp-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;background:var(--surface-soft);border:1px solid var(--border);border-radius:14px;margin:0 0 14px;}' +
    '.dlp-seg button{min-height:40px;border-radius:10px;font-size:13.5px;font-weight:800;color:var(--text-secondary);}' +
    '.dlp-seg button.on{background:var(--surface);color:var(--pink-accent);box-shadow:var(--shadow-soft);}' +
    '.dlp-lead{font-size:12.5px;color:var(--text-secondary);line-height:1.5;margin:0 0 12px;}' +
    '.dlp-lead b{color:var(--text);}' +
    '.dlp-note{font-size:11.5px;color:var(--text-secondary);line-height:1.45;background:var(--surface-soft);border-radius:12px;padding:10px 12px;margin:0 0 12px;}' +
    '.dlp-note b{color:var(--text);}';

function injectStyle() {
    if (document.getElementById('dlp-style')) return;
    var st = document.createElement('style');
    st.id = 'dlp-style';
    st.textContent = css;
    document.head.appendChild(st);
}

function el(html) {
    var t = document.createElement('div');
    t.innerHTML = html.trim();
    return t.firstChild;
}

/* ======================= ВХОД ======================= */
var pollTimer = null;
var pollInFlight = false;

function readPending() {
    try {
        var p = JSON.parse(lsGet(PENDING_KEY) || 'null');
        return p && p.nonce && p.expires_at > Date.now() ? p : null;
    } catch (_) { return null; }
}

function tgLink(nonce) { return 'tg://resolve?domain=' + BOT_USERNAME + '&start=pwa_' + nonce; }
function webLink(nonce) { return 'https://t.me/' + BOT_USERNAME + '?start=pwa_' + nonce; }

function renderLogin(state, message) {
    var gate = document.getElementById('dlp-gate');
    if (!gate) return;
    var body = gate.querySelector('#dlp-body');
    if (!body) return;
    var pending = readPending();

    if (state === 'waiting' && pending) {
        body.innerHTML =
            '<div class="dlp-wait"><span class="dlp-spin"></span>Ждём подтверждения…</div>' +
            '<div class="dlp-steps">' +
            '<div class="dlp-step"><span class="dlp-num">1</span><span>В Telegram откроется чат с <b>@' + BOT_USERNAME + '</b>. Нажмите <b>«Запустить»</b>, если бот попросит.</span></div>' +
            '<div class="dlp-step"><span class="dlp-num">2</span><span>Нажмите в сообщении бота <b>«Да, это я — войти»</b>.</span></div>' +
            '<div class="dlp-step"><span class="dlp-num">3</span><span>Вернитесь сюда — вход выполнится сам.</span></div>' +
            '</div>' +
            '<button type="button" class="btn btn-primary btn-block" id="dlp-open-tg">Открыть Telegram</button>' +
            '<a class="btn btn-tertiary btn-block" id="dlp-open-web" href="' + webLink(pending.nonce) + '" target="_blank" rel="noopener">Не открывается? Ссылка t.me</a>' +
            '<button type="button" class="btn btn-tertiary btn-block" id="dlp-cancel">Отмена</button>';

        var openTg = body.querySelector('#dlp-open-tg');
        if (openTg) openTg.onclick = function () { location.href = tgLink(pending.nonce); };
        var cancel = body.querySelector('#dlp-cancel');
        if (cancel) cancel.onclick = function () { stopPolling(); lsDel(PENDING_KEY); renderLogin('idle'); };
    } else {
        body.innerHTML =
            '<button type="button" class="btn btn-primary btn-block" id="dlp-login-btn">' +
            '<svg class="icon"><use href="#icon-send"/></svg> Войти через Telegram</button>' +
            (standalone ? '' :
            '<button type="button" class="btn btn-secondary btn-block" id="dlp-gate-install">' +
            '<svg class="icon"><use href="#icon-house"/></svg> Как установить приложение</button>') +
            '<div class="dlp-status" id="dlp-status">' + (message || 'Мы не узнаём ваш пароль и номер телефона — вход подтверждается кнопкой в нашем боте.') + '</div>';

        var loginBtn = body.querySelector('#dlp-login-btn');
        if (loginBtn) loginBtn.onclick = startLogin;
        var instBtn = body.querySelector('#dlp-gate-install');
        if (instBtn) instBtn.onclick = function () { openInstallSheet('guide'); };
    }
}

function startLogin() {
    var btn = document.getElementById('dlp-login-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Секунду…'; }
    fetch(API_BASE + '/api/pwa/login/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    })
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (!d || !d.ok || !d.nonce) throw new Error((d && d.error) || 'start_failed');
            lsSet(PENDING_KEY, JSON.stringify({
                nonce: d.nonce,
                expires_at: Date.now() + (Number(d.expires_in) || 300) * 1000
            }));
            renderLogin('waiting');
            startPolling();
            location.href = tgLink(d.nonce);
        })
        .catch(function (e) {
            renderLogin('idle', e && e.message === 'too_many_attempts'
                ? 'Слишком много попыток. Подождите несколько минут.'
                : 'Не удалось начать вход. Проверьте интернет и попробуйте ещё раз.');
        });
}

function startPolling() {
    stopPolling();
    pollTimer = setInterval(pollLogin, 2500);
    pollLogin();
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

function pollLogin() {
    var pending = readPending();
    if (!pending) {
        stopPolling();
        lsDel(PENDING_KEY);
        renderLogin('idle', 'Время на подтверждение вышло. Нажмите «Войти через Telegram» ещё раз.');
        return;
    }
    if (pollInFlight) return;
    pollInFlight = true;
    fetch(API_BASE + '/api/pwa/login/poll?nonce=' + encodeURIComponent(pending.nonce))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            if (!d) return;
            if (d.status === 'confirmed' && d.token && d.user) {
                stopPolling();
                lsDel(PENDING_KEY);
                lsSet(SESSION_KEY, JSON.stringify({ token: d.token, user: d.user, created_at: Date.now() }));
                location.reload();
            } else if (d.status === 'rejected') {
                stopPolling(); lsDel(PENDING_KEY);
                renderLogin('idle', 'Вход отменён в Telegram.');
            } else if (d.status === 'expired') {
                stopPolling(); lsDel(PENDING_KEY);
                renderLogin('idle', 'Время на подтверждение вышло. Нажмите «Войти через Telegram» ещё раз.');
            }
        })
        .catch(function () {})
        .then(function () { pollInFlight = false; });
}

var visibilityHandlerAttached = false;

function showLoginGate() {
    if (document.getElementById('dlp-gate')) return;
    var gate = el(
        '<div class="dlp-gate" id="dlp-gate" role="dialog" aria-modal="true" aria-label="Вход в DollieLand">' +
        '<div class="consent-card">' +
        '<img class="dlp-logo" src="icons/icon-192.png" alt="">' +
        '<h2>DollieLand</h2>' +
        '<p class="consent-text">Ваши заказы, Dollies и Фортуна — те же, что в Telegram. Чтобы их показать, войдите через свой аккаунт Telegram.</p>' +
        '<div id="dlp-body"></div>' +
        '</div></div>');
    document.body.appendChild(gate);

    if (readPending()) { renderLogin('waiting'); startPolling(); }
    else renderLogin('idle');

    if (!visibilityHandlerAttached) {
        visibilityHandlerAttached = true;
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && readPending()) {
                if (!pollTimer) startPolling();
                else pollLogin();
            }
        });
    }
}

/* ======================= УСТАНОВКА ======================= */
var deferredPrompt = null;
var guideTab = isAndroid ? 'android' : 'ios';
var installPage = 'intro';

window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    refreshInstallUI();
    if (installSheetOpen()) renderInstallSheet();
});

window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    lsSet(INSTALL_DISMISS_KEY, '1');
    refreshInstallUI();
    closeInstallSheet();
});

function appUrl() { return location.origin + location.pathname; }
function installUrl() { return appUrl() + '?install=1'; }
function canOfferInstall() { return !standalone; }

var SHARE_SVG = '<svg class="dlp-ios-share" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
var I = function (id) { return '<svg class="icon"><use href="#icon-' + id + '"/></svg>'; };

function stepsHTML(list) {
    return '<div class="dlp-steps">' + list.map(function (t, i) {
        return '<div class="dlp-step"><span class="dlp-num">' + (i + 1) + '</span><span>' + t + '</span></div>';
    }).join('') + '</div>';
}

function iosGuideHTML() {
    var s = [];
    var html = '';
    if (inTelegram) {
        html += '<p class="dlp-lead">Установка делается через браузер <b>Safari</b> — это займёт меньше минуты.</p>';
        s.push('Нажмите кнопку <b>«Открыть в браузере»</b> ниже.');
        s.push('Если страница открылась внутри Telegram, нажмите значок <b>компаса</b> или <span class="dlp-kbd">⋯</span> и выберите <b>«Открыть в Safari»</b>.');
    } else if (!isSafari && isIOS) {
        html += '<div class="dlp-note">Удобнее всего установить в <b>Safari</b>. Скопируйте ссылку ниже и откройте её в Safari, если в этом браузере нет пункта «На экран «Домой»».</div>';
    }
    s.push('Внизу Safari нажмите <b>«Поделиться»</b> ' + SHARE_SVG + ' (квадрат со стрелкой вверх). Если панели не видно — прокрутите страницу чуть вверх.');
    s.push('Пролистайте список вниз и выберите <b>«На экран «Домой»»</b>.');
    s.push('Нажмите <b>«Добавить»</b> в правом верхнем углу.');
    s.push('Откройте DollieLand с новой иконки на экране и войдите через Telegram — один раз.');
    html += stepsHTML(s);
    return html;
}

function androidGuideHTML() {
    var s = [];
    var html = '';
    if (!inTelegram && deferredPrompt) {
        html += '<p class="dlp-lead">Ваш браузер умеет устанавливать приложение в одно нажатие:</p>' +
            '<button type="button" class="btn btn-primary btn-block" data-act="install-now" style="margin:0 0 14px">' + I('house') + ' Установить сейчас</button>' +
            '<p class="dlp-lead" style="margin-top:4px">Или вручную:</p>';
    } else if (inTelegram) {
        html += '<p class="dlp-lead">Установка делается через браузер <b>Chrome</b> — это займёт меньше минуты.</p>';
        s.push('Нажмите кнопку <b>«Открыть в браузере»</b> ниже.');
        s.push('Если страница открылась внутри Telegram, нажмите <span class="dlp-kbd">⋮</span> в правом верхнем углу и выберите <b>«Открыть в Chrome»</b> (или «Открыть в браузере»).');
    }
    s.push('В Chrome нажмите <span class="dlp-kbd">⋮</span> в правом верхнем углу.');
    s.push('Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.');
    s.push('Подтвердите — нажмите <b>«Установить»</b>.');
    s.push('Откройте DollieLand с новой иконки на экране и войдите через Telegram — один раз.');
    html += stepsHTML(s);
    html += '<div class="dlp-note">В <b>Samsung Internet</b>: <span class="dlp-kbd">≡</span> → <b>«Добавить страницу на»</b> → <b>«Главный экран»</b>.</div>';
    return html;
}

function introHTML() {
    return '' +
        '<div class="sheet-header"><h2>Новое в DollieLand</h2>' +
        '<button class="sheet-close-btn" data-act="close" aria-label="Закрыть">' + I('x') + '</button></div>' +
        '<div class="dlp-intro">' +
        '<img class="dlp-logo" src="icons/icon-192.png" alt="">' +
        '<h3>Установите DollieLand на телефон</h3>' +
        '<p>Теперь DollieLand можно поставить как обычное приложение — со своей иконкой на экране.</p>' +
        '<div class="dlp-benefits">' +
        '<div class="dlp-benefit">' + I('house') + 'Своя иконка на главном экране</div>' +
        '<div class="dlp-benefit">' + I('clock') + 'Открывается в одно касание — без поиска чата</div>' +
        '<div class="dlp-benefit">' + I('heart') + 'Те же заказы, Dollies и Фортуна, что в Telegram</div>' +
        '</div>' +
        '<button type="button" class="btn btn-primary btn-block" data-act="guide">Как установить</button>' +
        '<button type="button" class="btn btn-tertiary btn-block" data-act="close">Позже</button>' +
        '</div>';
}

function guideHTML() {
    var tabBody = guideTab === 'android' ? androidGuideHTML() : iosGuideHTML();
    var bottom = '';
    if (inTelegram) {
        bottom += '<button type="button" class="btn btn-primary btn-block" data-act="open-browser">' + I('share') + ' Открыть в браузере</button>';
    }
    bottom += '<button type="button" class="btn btn-secondary btn-block" data-act="copy" id="dlp-copy-btn">' + I('copy') + ' Скопировать ссылку</button>';
    bottom += '<button type="button" class="btn btn-tertiary btn-block" data-act="close">Готово</button>';
    var desktopNote = !isMobileDevice
        ? '<div class="dlp-note">Похоже, вы сейчас не на телефоне. Скопируйте ссылку и откройте её на телефоне — там и установите приложение.</div>'
        : '';
    return '' +
        '<div class="sheet-header"><h2>Как установить</h2>' +
        '<button class="sheet-close-btn" data-act="close" aria-label="Закрыть">' + I('x') + '</button></div>' +
        '<div class="dlp-seg" role="tablist">' +
        '<button type="button" role="tab" data-act="tab-ios" class="' + (guideTab === 'ios' ? 'on' : '') + '">iPhone</button>' +
        '<button type="button" role="tab" data-act="tab-android" class="' + (guideTab === 'android' ? 'on' : '') + '">Android</button>' +
        '</div>' + desktopNote + tabBody + bottom;
}

function ensureInstallSheet() {
    var s = document.getElementById('sheet-install');
    if (s) return s;
    s = el('<div class="bottom-sheet" id="sheet-install">' +
        '<div class="sheet-handle-area"><div class="sheet-handle"></div></div>' +
        '<div class="sheet-content" id="dlp-install-body"></div></div>');
    document.body.appendChild(s);
    if (typeof setupSheetDrag === 'function') setupSheetDrag(s);
    s.addEventListener('click', onInstallSheetClick);
    return s;
}

function installSheetOpen() {
    var s = document.getElementById('sheet-install');
    return !!(s && s.classList.contains('open'));
}

function renderInstallSheet() {
    var body = document.getElementById('dlp-install-body');
    if (!body) return;
    body.innerHTML = installPage === 'intro' ? introHTML() : guideHTML();
    var sheet = document.getElementById('sheet-install');
    if (sheet) sheet.scrollTop = 0;
}

function openInstallSheet(page) {
    installPage = page || 'guide';
    var sheet = ensureInstallSheet();
    renderInstallSheet();
    if (installSheetOpen()) return;
    if (typeof openSheet === 'function') {
        openSheet('install');
    } else {
        sheet.classList.add('open', 'expanded');
        var ov = document.getElementById('sheet-overlay');
        if (ov) ov.classList.add('open');
    }
}

function closeInstallSheet() {
    if (!installSheetOpen()) return;
    if (typeof closeSheet === 'function') closeSheet();
    else {
        var s = document.getElementById('sheet-install');
        if (s) s.classList.remove('open', 'expanded');
        var ov = document.getElementById('sheet-overlay');
        if (ov) ov.classList.remove('open');
    }
}

function copyLink() {
    var url = appUrl();
    var done = function () {
        var b = document.getElementById('dlp-copy-btn');
        if (b) b.innerHTML = I('check') + ' Ссылка скопирована';
        try { WebApp && WebApp.HapticFeedback && WebApp.HapticFeedback.notificationOccurred('success'); } catch (_) {}
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(fallback);
    } else fallback();
    function fallback() {
        try {
            var ta = document.createElement('textarea');
            ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.focus(); ta.select();
            document.execCommand('copy'); ta.remove(); done();
        } catch (_) { prompt('Скопируйте ссылку:', url); }
    }
}

function onInstallSheetClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    try { WebApp && WebApp.HapticFeedback && WebApp.HapticFeedback.selectionChanged(); } catch (_) {}
    if (act === 'close') { closeInstallSheet(); return; }
    if (act === 'guide') { installPage = 'guide'; renderInstallSheet(); return; }
    if (act === 'tab-ios') { guideTab = 'ios'; renderInstallSheet(); return; }
    if (act === 'tab-android') { guideTab = 'android'; renderInstallSheet(); return; }
    if (act === 'copy') { copyLink(); return; }
    if (act === 'open-browser') {
        try { WebApp.openLink(installUrl(), { try_instant_view: false }); }
        catch (_) { window.open(installUrl(), '_blank'); }
        return;
    }
    if (act === 'install-now' && deferredPrompt) {
        var p = deferredPrompt; deferredPrompt = null;
        p.prompt();
        p.userChoice.then(function (c) {
            if (c && c.outcome === 'accepted') lsSet(INSTALL_DISMISS_KEY, '1');
            closeInstallSheet();
            refreshInstallUI();
        });
    }
}

function refreshInstallUI() {
    var item = document.getElementById('dlp-install-item');
    if (item) item.hidden = !canOfferInstall();
    var card = document.getElementById('dlp-install-card');
    if (card) card.hidden = !(canOfferInstall() && isMobileDevice && lsGet(INSTALL_DISMISS_KEY) !== '1');
}

/* ---------- Окно при первом входе (один раз для каждого пользователя) ---------- */
function cloudAvailable() {
    try { return !!(inTelegram && WebApp.CloudStorage && WebApp.isVersionAtLeast && WebApp.isVersionAtLeast('6.9')); }
    catch (_) { return false; }
}
function introAlreadyShown(cb) {
    if (lsGet(INTRO_KEY) === '1') { cb(true); return; }
    if (!cloudAvailable()) { cb(false); return; }
    var answered = false;
    var finish = function (v) { if (!answered) { answered = true; cb(v); } };
    try {
        WebApp.CloudStorage.getItem(INTRO_KEY, function (err, val) { finish(!err && val === '1'); });
    } catch (_) { finish(false); }
    setTimeout(function () { finish(false); }, 2500);
}
function markIntroShown() {
    lsSet(INTRO_KEY, '1');
    if (cloudAvailable()) { try { WebApp.CloudStorage.setItem(INTRO_KEY, '1'); } catch (_) {} }
}

function appIsFree() {
    var pre = document.getElementById('preloader');
    if (pre && !pre.classList.contains('hidden')) return false;
    if (document.getElementById('dlp-gate')) return false;
    var cg = document.getElementById('consent-gate');
    if (cg && cg.classList.contains('open')) return false;
    if (document.querySelector('.bottom-sheet.open')) return false;
    if (document.querySelector('.review-prompt-overlay.open, .photo-lightbox.open, .sr-modal.open')) return false;
    var a = document.activeElement;
    if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) return false;
    var search = document.getElementById('tab-search');
    if (search && search.classList.contains('active')) return false;
    return true;
}

function scheduleInstallIntro() {
    if (standalone || !isMobileDevice) return;
    if (!inTelegram && !session) return;   // в браузере без входа — сначала экран входа
    introAlreadyShown(function (shown) {
        if (shown) return;
        var tries = 0;
        var timer = setInterval(function () {
            tries++;
            if (tries > 60) { clearInterval(timer); return; }   // ~45 секунд ожидания максимум
            if (!appIsFree()) return;
            clearInterval(timer);
            markIntroShown();
            openInstallSheet('intro');
        }, 750);
    });
}

/* Приходим из Telegram по ссылке ?install=1 — сразу показываем инструкцию */
function handleInstallParam() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (_) { return false; }
    if (params.get('install') !== '1') return false;
    params.delete('install');
    var rest = params.toString();
    try { history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash); } catch (_) {}
    if (standalone) return false;
    markIntroShown();
    setTimeout(function () { openInstallSheet('guide'); }, 400);
    return true;
}

function injectUI() {
    var lists = document.querySelectorAll('#tab-profile .menu-list');
    var lastList = lists[lists.length - 1];

    if (lastList && !document.getElementById('dlp-install-item')) {
        var item = el(
            '<button type="button" class="menu-item" id="dlp-install-item" hidden>' +
            '<svg class="icon"><use href="#icon-house"/></svg>' +
            '<span class="label">Установить приложение на телефон</span>' +
            '<svg class="icon chev"><use href="#icon-chevron-right"/></svg></button>');
        item.onclick = function () { openInstallSheet('guide'); };
        lastList.appendChild(item);
    }

    if (!inTelegram && session && lastList && !document.getElementById('dlp-logout-item')) {
        var out = el(
            '<button type="button" class="menu-item" id="dlp-logout-item">' +
            '<svg class="icon"><use href="#icon-x"/></svg>' +
            '<span class="label">Выйти из аккаунта</span></button>');
        out.onclick = function () {
            if (confirm('Выйти из DollieLand на этом устройстве?')) logout();
        };
        lastList.appendChild(out);
    }

    // Карточка на главной — и в Telegram, и в браузере, пока не установлено и не скрыто
    var anchor = document.getElementById('orders-summary-card');
    if (anchor && !document.getElementById('dlp-install-card')) {
        var card = el(
            '<button type="button" class="orders-summary-card homescreen-card" id="dlp-install-card" hidden>' +
            '<div class="orders-summary-icon"><svg class="icon"><use href="#icon-house"/></svg></div>' +
            '<div class="orders-summary-text hs-text"><span class="hs-title">Установите DollieLand</span>' +
            '<span class="hs-sub">Своя иконка на экране телефона</span></div>' +
            '<span class="hs-close" role="button" aria-label="Скрыть"><svg class="icon"><use href="#icon-x"/></svg></span></button>');
        card.onclick = function () { openInstallSheet('guide'); };
        var hsClose = card.querySelector('.hs-close');
        if (hsClose) hsClose.onclick = function (e) {
            e.stopPropagation();
            lsSet(INSTALL_DISMISS_KEY, '1');
            refreshInstallUI();
        };
        anchor.insertAdjacentElement('afterend', card);
    }

    refreshInstallUI();
}

/* ---------- Старт ---------- */
document.addEventListener('DOMContentLoaded', function () {
    injectStyle();
    if (!inTelegram && !session) showLoginGate();
    injectUI();
    if (!handleInstallParam()) setTimeout(scheduleInstallIntro, 1500);
});
})();
