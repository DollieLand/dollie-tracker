// ============================================================
// DOLLIELAND MINI APP — ПОЛНАЯ ВЕРСИЯ
// ============================================================

const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
tg.ready();

// ---------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ----------
let allOrders = [];
let currentOrders = [];
let previousStatuses = {};
let isRefreshing = false;
let touchStartY = 0;

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
if (user) {
    document.querySelector('.profile-name').textContent = `👋 Привет, ${user.first_name}`;
    document.querySelector('.profile-id').textContent = `🆔 ID: ${user.id}`;
    updateUserLevel(user.id);
}

// ---------- ТЕМА ----------
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('themeBtn');
    if (body.classList.contains('theme-dark')) {
        body.classList.remove('theme-dark');
        body.classList.add('theme-light');
        btn.textContent = '🌙';
        localStorage.setItem('dollieTheme', 'light');
    } else {
        body.classList.remove('theme-light');
        body.classList.add('theme-dark');
        btn.textContent = '☀️';
        localStorage.setItem('dollieTheme', 'dark');
    }
}

// Загрузка сохранённой темы
const savedTheme = localStorage.getItem('dollieTheme');
if (savedTheme === 'light') {
    document.body.classList.remove('theme-dark');
    document.body.classList.add('theme-light');
    document.getElementById('themeBtn').textContent = '🌙';
}

// ---------- УРОВЕНЬ ПОЛЬЗОВАТЕЛЯ ----------
function updateUserLevel(userId) {
    const levelEl = document.getElementById('userLevel');
    // Уровни зависят от количества заказов
    const orderCount = allOrders.length;
    let level = '🌟 Новичок';
    let emoji = '🌟';
    
    if (orderCount >= 20) { level = '👑 Платиновый'; emoji = '👑'; }
    else if (orderCount >= 10) { level = '💎 Золотой'; emoji = '💎'; }
    else if (orderCount >= 5) { level = '⭐ Серебряный'; emoji = '⭐'; }
    else if (orderCount >= 1) { level = '🌟 Бронзовый'; emoji = '🌟'; }
    
    levelEl.textContent = level;
}

// ---------- СТАТИСТИКА ----------
function updateStats(orders) {
    const statsBar = document.getElementById('stats-bar');
    if (!orders || orders.length === 0) {
        statsBar.style.display = 'none';
        return;
    }
    statsBar.style.display = 'flex';
    
    const total = orders.length;
    const delivered = orders.filter(o => o.status && o.status.includes('Доставлен')).length;
    const inTransit = total - delivered;
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDelivered').textContent = delivered;
    document.getElementById('statInTransit').textContent = inTransit;
    
    // Среднее время доставки (если есть даты)
    let avgDays = 0;
    try {
        const withDates = orders.filter(o => o.created_date);
        if (withDates.length > 0) {
            const totalDays = withDates.reduce((sum, o) => {
                try {
                    const created = new Date(o.created_date);
                    const now = new Date();
                    return sum + Math.floor((now - created) / (1000 * 60 * 60 * 24));
                } catch { return sum; }
            }, 0);
            avgDays = Math.round(totalDays / withDates.length);
        }
    } catch {}
    document.getElementById('statAvgDays').textContent = avgDays || '—';
}

// ---------- ЗАГРУЗКА ЗАКАЗОВ ----------
async function loadOrders() {
    const container = document.getElementById('orders-list');
    const searchContainer = document.getElementById('search-container');
    container.innerHTML = '<div class="loader">⏳ Загрузка заказов...</div>';
    searchContainer.style.display = 'none';
    
    const userId = user?.id;
    
    if (!userId) {
        container.innerHTML = `
            <div class="card empty-state">
                <div class="empty-icon">🔒</div>
                <p class="empty-title">Откройте бота</p>
                <p class="empty-sub">@DollieHelper_bot</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch(`https://api-DollieLand.pythonanywhere.com/api/my-orders?telegram_id=${userId}`);
        
        if (!response.ok) throw new Error('Сервер не отвечает');
        
        const data = await response.json();
        
        if (data.ok && data.orders && data.orders.length > 0) {
            allOrders = data.orders;
            currentOrders = [...allOrders];
            // Проверяем изменения статусов для конфетти
            checkStatusChanges(allOrders);
            renderOrders(allOrders);
            updateStats(allOrders);
            updateUserLevel(userId);
            searchContainer.style.display = 'block';
        } else {
            allOrders = [];
            currentOrders = [];
            renderOrders([]);
            updateStats([]);
            searchContainer.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        const demoOrders = [
            { id: '12345', status: 'Прибыла в Россию', title: 'Monster High', delivery_date: '25.01.2026', created_date: '2026-01-15' },
            { id: '67890', status: 'Отправлена из США', title: 'Barbie', delivery_date: '01.02.2026', created_date: '2026-01-10' },
            { id: '11111', status: 'Доставлен', title: 'Ever After High', delivery_date: '20.01.2026', created_date: '2026-01-05' },
        ];
        allOrders = demoOrders;
        currentOrders = [...demoOrders];
        renderOrders(demoOrders, true);
        updateStats(demoOrders);
        searchContainer.style.display = 'block';
    }
}

// ---------- ПРОВЕРКА ИЗМЕНЕНИЙ СТАТУСОВ (КОНФЕТТИ) ----------
function checkStatusChanges(orders) {
    orders.forEach(order => {
        const oldStatus = previousStatuses[order.id];
        if (oldStatus && oldStatus !== order.status) {
            // Статус изменился!
            if (order.status && order.status.includes('Доставлен')) {
                showConfetti();
            }
        }
        previousStatuses[order.id] = order.status;
    });
}

// ---------- КОНФЕТТИ ----------
function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    
    const colors = ['#f5a8d3', '#c084e0', '#a855f7', '#34d399', '#fbbf24', '#60a5fa', '#fb923c', '#ff6b6b'];
    const shapes = ['■', '●', '▲', '★', '♦'];
    
    for (let i = 0; i < 80; i++) {
        const el = document.createElement('div');
        el.className = 'confetti';
        el.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        el.style.left = Math.random() * 100 + '%';
        el.style.color = colors[Math.floor(Math.random() * colors.length)];
        el.style.fontSize = (Math.random() * 16 + 8) + 'px';
        el.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
        el.style.animationDelay = Math.random() * 1.5 + 's';
        container.appendChild(el);
    }
    
    setTimeout(() => {
        container.remove();
    }, 4000);
}

// ---------- ОТРИСОВКА ЗАКАЗОВ ----------
function renderOrders(orders, isDemo = false) {
    const container = document.getElementById('orders-list');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <div class="empty-icon">📭</div>
                <p class="empty-title">У вас пока нет заказов</p>
                <p class="empty-sub">Оформите заказ через @Darielune</p>
                <button class="btn-primary" onclick="loadOrders()" style="margin-top: 16px; width: 100%;">
                    🔄 Обновить
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    if (isDemo) {
        html += `
            <div class="card" style="border: 1px solid #fbbf24; background: rgba(251, 191, 36, 0.08);">
                <p style="color: #fbbf24; font-size: 13px;">⚠️ Демо-режим (ошибка API)</p>
            </div>
        `;
    }
    
    html += `<div class="card"><p style="margin-bottom: 12px; font-weight: 500; color: #c084e0;">📦 Ваши заказы (${orders.length})</p>`;
    
    orders.forEach(order => {
        const statusText = order.status || 'не определён';
        let statusClass = '';
        let statusIcon = '📦';
        
        if (statusText.includes('Доставлен')) { statusClass = 'status-delivered'; statusIcon = '🎉'; }
        else if (statusText.includes('Россию') || statusText.includes('Таможня')) { statusClass = 'status-russia'; statusIcon = '🇷🇺'; }
        else if (statusText.includes('Оплата')) { statusClass = 'status-payment'; statusIcon = '💳'; }
        else if (statusText.includes('США') || statusText.includes('Отправлен')) { statusClass = 'status-us'; statusIcon = '✈️'; }
        else { statusClass = 'status-initial'; }
        
        // Прогресс (примерный)
        const progress = getProgress(statusText);
        
        html += `
            <div class="order-item ${statusClass}" onclick="toggleOrderDetails('${order.id}')" id="order-${order.id}">
                <div class="order-id">🆔 ${order.id}</div>
                ${order.title ? `<div class="order-title">🏷️ ${order.title}</div>` : ''}
                <div class="order-status">${statusIcon} ${statusText}</div>
                ${order.delivery_date ? `<div class="order-delivery">📅 ${order.delivery_date}</div>` : ''}
                ${order.created_date ? `<div class="order-date">📆 Создан: ${order.created_date}</div>` : ''}
                
                <!-- Прогресс-бар -->
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%;"></div>
                    </div>
                    <div class="progress-text">${progress}% пути</div>
                </div>
                
                <!-- Детали (скрыты по умолчанию) -->
                <div class="order-expanded" id="details-${order.id}" style="display:none;">
                    ${buildTimeline(order)}
                    ${buildOrderActions(order)}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// ---------- ПРОГРЕСС ----------
function getProgress(statusText) {
    const stages = [
        'Заказ оформлен', 'Продавец подготовил', 'Отправлен продавцом',
        'Прибыл на склад в США', 'Требуется оплата', 'Вес оплачен',
        'Обработка на складе', 'Отправлена из США',
        'Прибыла в Россию', 'Таможня РФ', 'Таможня выпустила',
        'Распределительный центр', 'Прибыла в Москву',
        'Передано посреднику', 'Отправлено посредником',
        'В пути к клиенту', 'Доставлено клиенту'
    ];
    
    const idx = stages.findIndex(s => statusText.includes(s));
    if (idx === -1) return 0;
    return Math.round(((idx + 1) / stages.length) * 100);
}

// ---------- ТАЙМЛАЙН ----------
function buildTimeline(order) {
    const stages = [
        { icon: '📝', label: 'Заказ оформлен' },
        { icon: '🎁', label: 'Подготовка к отправке' },
        { icon: '📦', label: 'Отправлен продавцом' },
        { icon: '🇺🇸', label: 'Прибыл на склад в США' },
        { icon: '💳', label: 'Оплата веса' },
        { icon: '✅', label: 'Вес оплачен' },
        { icon: '🔍', label: 'Обработка на складе' },
        { icon: '✈️', label: 'Отправлен из США' },
        { icon: '🇷🇺', label: 'Прибыл в Россию' },
        { icon: '🛃', label: 'Таможня РФ' },
        { icon: '✔️', label: 'Таможня выпустила' },
        { icon: '🏢', label: 'Распределительный центр' },
        { icon: '🏙️', label: 'Прибыл в Москву' },
        { icon: '🤝', label: 'Передан посреднику' },
        { icon: '🚚', label: 'Отправлен посредником' },
        { icon: '🚚', label: 'В пути к клиенту' },
        { icon: '🎉', label: 'Доставлен!' }
    ];
    
    const currentIdx = stages.findIndex(s => order.status && order.status.includes(s.label));
    const displayStages = currentIdx === -1 ? stages.slice(0, 3) : stages.slice(0, currentIdx + 2);
    
    let html = '<div class="timeline">';
    displayStages.forEach((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const iconClass = isCompleted ? 'completed' : (isCurrent ? 'current' : '');
        
        html += `
            <div class="timeline-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}">
                <div class="timeline-icon ${iconClass}">${stage.icon}</div>
                <div class="timeline-text">
                    <div class="timeline-status">${stage.label}</div>
                    <div class="timeline-date">${isCompleted ? '✅ Завершено' : (isCurrent ? '⏳ Текущий' : '⏳ Ожидается')}</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

// ---------- КНОПКИ ЗАКАЗА ----------
function buildOrderActions(order) {
    return `
        <div class="order-actions">
            <button class="order-btn order-btn-remind" onclick="sendRemind('${order.id}')">
                🔔 Напомнить
            </button>
            <button class="order-btn order-btn-chat" onclick="askAboutOrder('${order.id}')">
                💬 Спросить
            </button>
            <button class="order-btn order-btn-photo" onclick="viewPhoto('${order.id}')">
                📸 Фото
            </button>
        </div>
    `;
}

// ---------- ТОГГЛ ДЕТАЛЕЙ ----------
function toggleOrderDetails(orderId) {
    const details = document.getElementById(`details-${orderId}`);
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

// ---------- ДЕЙСТВИЯ С ЗАКАЗАМИ ----------
function sendRemind(orderId) {
    tg.showAlert(`🔔 Напоминание по заказу #${orderId} отправлено администратору!`);
    // Здесь можно отправить уведомление в бот
}

function askAboutOrder(orderId) {
    tg.showAlert(`💬 Напишите вопрос по заказу #${orderId} в бот @DollieHelper_bot`);
    tg.openTelegramLink(`https://t.me/DollieHelper_bot`);
}

function viewPhoto(orderId) {
    tg.showAlert(`📸 Фото для заказа #${orderId} пока нет`);
    // Здесь можно будет показывать фото
}

// ---------- ПОИСК ----------
function filterOrders(query) {
    if (!query || query.trim() === '') {
        renderOrders(allOrders);
        return;
    }
    const q = query.toLowerCase().trim();
    const filtered = allOrders.filter(o => 
        o.id.toLowerCase().includes(q) || 
        (o.title && o.title.toLowerCase().includes(q))
    );
    renderOrders(filtered);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    renderOrders(allOrders);
}

// ---------- FAQ ----------
function showFaq() {
    tg.showAlert(
        '🌸 Частые вопросы\n\n' +
        '✈️ Доставка из США — 4-5 недель\n' +
        '📦 Доставка из Китая — 3-4 недели\n' +
        '💳 Оплата веса — после прибытия на склад\n' +
        '🔐 Бронь — 24 часа бесплатно\n\n' +
        '📱 Бот: @DollieHelper_bot\n' +
        '💌 Связь: @Darielune'
    );
}

// ---------- ЗАКРЫТЬ ----------
function closeApp() {
    tg.close();
}

// ---------- PULL-TO-REFRESH ----------
let startY = 0;
let isDragging = false;

document.addEventListener('touchstart', function(e) {
    if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
        isDragging = true;
    }
});

document.addEventListener('touchmove', function(e) {
    if (!isDragging) return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 60 && !isRefreshing) {
        isRefreshing = true;
        const indicator = document.createElement('div');
        indicator.className = 'pull-indicator';
        indicator.id = 'pullIndicator';
        indicator.textContent = '🔄 Обновление...';
        document.getElementById('orders-list').prepend(indicator);
        loadOrders().then(() => {
            const el = document.getElementById('pullIndicator');
            if (el) el.remove();
            isRefreshing = false;
        });
    }
});

document.addEventListener('touchend', function() {
    isDragging = false;
});

// ---------- АВТОЗАГРУЗКА ----------
loadOrders();
