// ============================================================
// DOLLIELAND — НЕЖНО-РОЗОВАЯ ВЕРСИЯ С ПРЕМИУМ-ЭМОДЗИ
// ============================================================

const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
tg.ready();

// ---------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ----------
let allOrders = [];
let previousStatuses = {};

// ---------- ИНИЦИАЛИЗАЦИЯ ----------
if (user) {
    document.querySelector('.profile-name').textContent = `👋 Привет, ${user.first_name}!`;
    document.querySelector('.profile-id').textContent = `ID: ${user.id}`;
    document.getElementById('modalName').textContent = `👋 ${user.first_name}`;
    document.getElementById('modalId').textContent = `ID: ${user.id}`;
}

// ---------- ВКЛАДКИ ----------
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    if (tab === 'stats') {
        updateStats(allOrders);
        updateLevel(allOrders);
    }
}

// ---------- ПРОФИЛЬ ----------
function showProfile() {
    document.getElementById('profile-modal').classList.add('open');
    document.getElementById('modalTotal').textContent = allOrders.length || '0';
    updateLevel(allOrders);
}

function closeProfile(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('profile-modal').classList.remove('open');
}

// ---------- УРОВЕНЬ ----------
function updateLevel(orders) {
    const count = orders ? orders.length : 0;
    let level = 'Новичок';
    let emoji = '🌟';
    let next = 5;
    
    if (count >= 20) { level = 'Платиновый'; emoji = '👑'; next = 0; }
    else if (count >= 10) { level = 'Золотой'; emoji = '💎'; next = 20; }
    else if (count >= 5) { level = 'Серебряный'; emoji = '⭐'; next = 10; }
    else if (count >= 1) { level = 'Бронзовый'; emoji = '🌟'; next = 5; }
    
    document.getElementById('levelEmoji').innerHTML = `<tg-emoji emoji-id="5195337293308652456">${emoji}</tg-emoji>`;
    document.getElementById('levelName').textContent = level;
    document.getElementById('modalLevel').textContent = `${emoji} ${level}`;
    
    const progress = next > 0 ? (count / next) * 100 : 100;
    document.getElementById('levelFill').style.width = Math.min(progress, 100) + '%';
    document.getElementById('levelNext').textContent = next > 0 
        ? `До следующего уровня: ${next - count} заказов` 
        : '🏆 Максимальный уровень!';
}

// ---------- СТАТИСТИКА ----------
function updateStats(orders) {
    if (!orders || orders.length === 0) {
        document.getElementById('statTotal').textContent = '0';
        document.getElementById('statDelivered').textContent = '0';
        document.getElementById('statInTransit').textContent = '0';
        document.getElementById('statAvgDays').textContent = '—';
        return;
    }
    
    const total = orders.length;
    const delivered = orders.filter(o => o.status && o.status.includes('Доставлен')).length;
    const inTransit = total - delivered;
    
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statDelivered').textContent = delivered;
    document.getElementById('statInTransit').textContent = inTransit;
    
    let avgDays = '—';
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
            avgDays = Math.round(totalDays / withDates.length) + ' дн.';
        }
    } catch {}
    document.getElementById('statAvgDays').textContent = avgDays;
}

// ---------- ЗАГРУЗКА ЗАКАЗОВ ----------
async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loader">⏳ Загрузка заказов...</div>';
    
    const userId = user?.id;
    
    if (!userId) {
        container.innerHTML = `
            <div class="card empty-state">
                <div class="empty-icon"><tg-emoji emoji-id="5197199582538263659">🔒</tg-emoji></div>
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
            checkStatusChanges(allOrders);
            renderOrders(allOrders);
            updateStats(allOrders);
            updateLevel(allOrders);
        } else {
            allOrders = [];
            renderOrders([]);
            updateStats([]);
            updateLevel([]);
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        const demoOrders = [
            { id: '12345', status: 'Прибыла в Россию', title: 'Monster High', delivery_date: '25.01.2026', created_date: '2026-01-15' },
            { id: '67890', status: 'Отправлена из США', title: 'Barbie', delivery_date: '01.02.2026', created_date: '2026-01-10' },
            { id: '11111', status: 'Доставлен', title: 'Ever After High', delivery_date: '20.01.2026', created_date: '2026-01-05' },
        ];
        allOrders = demoOrders;
        renderOrders(demoOrders, true);
        updateStats(demoOrders);
        updateLevel(demoOrders);
    }
}

// ---------- КОНФЕТТИ ----------
function checkStatusChanges(orders) {
    orders.forEach(order => {
        const oldStatus = previousStatuses[order.id];
        if (oldStatus && oldStatus !== order.status) {
            if (order.status && order.status.includes('Доставлен')) {
                showConfetti();
            }
        }
        previousStatuses[order.id] = order.status;
    });
}

function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    
    const colors = ['#f8a4c8', '#d4739e', '#ffc8dd', '#86d9b0', '#f7c948', '#7ab7e8', '#f9a86a'];
    const shapes = ['■', '●', '▲', '★', '♦', '♥'];
    
    for (let i = 0; i < 60; i++) {
        const el = document.createElement('div');
        el.className = 'confetti';
        el.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        el.style.left = Math.random() * 100 + '%';
        el.style.color = colors[Math.floor(Math.random() * colors.length)];
        el.style.fontSize = (Math.random() * 14 + 6) + 'px';
        el.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
        el.style.animationDelay = Math.random() * 1.5 + 's';
        container.appendChild(el);
    }
    
    setTimeout(() => container.remove(), 4000);
}

// ---------- ОТРИСОВКА ЗАКАЗОВ ----------
function renderOrders(orders, isDemo = false) {
    const container = document.getElementById('orders-list');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <div class="empty-icon"><tg-emoji emoji-id="5197199582538263659">📭</tg-emoji></div>
                <p class="empty-title">У вас пока нет заказов</p>
                <p class="empty-sub">Оформите заказ через @Darielune</p>
                <button class="btn-primary" onclick="loadOrders()" style="margin-top:16px;width:100%;">
                    <tg-emoji emoji-id="5197336179678146423">🔄</tg-emoji>
                    Обновить
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    if (isDemo) {
        html += `
            <div class="card" style="border:1px solid #f7c948;background:rgba(247,201,72,0.06);">
                <p style="color:#c9a020;font-size:12px;">⚠️ Демо-режим</p>
            </div>
        `;
    }
    
    html += `<div class="card" style="padding-bottom:12px;">
        <p style="font-size:13px;color:#b88aa0;font-weight:500;">
            <tg-emoji emoji-id="5197647100950637442">📦</tg-emoji>
            Ваши заказы (${orders.length})
        </p>
    </div>`;
    
    orders.forEach(order => {
        const statusText = order.status || 'не определён';
        let statusClass = '';
        let statusIcon = '📦';
        
        if (statusText.includes('Доставлен')) { statusClass = 'status-delivered'; statusIcon = '🎉'; }
        else if (statusText.includes('Россию') || statusText.includes('Таможня')) { statusClass = 'status-russia'; statusIcon = '🇷🇺'; }
        else if (statusText.includes('Оплата')) { statusClass = 'status-payment'; statusIcon = '💳'; }
        else if (statusText.includes('США') || statusText.includes('Отправлен')) { statusClass = 'status-us'; statusIcon = '✈️'; }
        else { statusClass = 'status-initial'; }
        
        const progress = getProgress(statusText);
        
        html += `
            <div class="order-item ${statusClass}" onclick="toggleOrderDetails('${order.id}')" id="order-${order.id}">
                <div class="order-id">🆔 ${order.id}</div>
                ${order.title ? `<div class="order-title">🏷️ ${order.title}</div>` : ''}
                <div class="order-status"><tg-emoji emoji-id="5195385478546747284">${statusIcon}</tg-emoji> ${statusText}</div>
                ${order.delivery_date ? `<div class="order-delivery"><tg-emoji emoji-id="5195283816670850617">📅</tg-emoji> ${order.delivery_date}</div>` : ''}
                
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width:${progress}%;"></div>
                    </div>
                    <div class="progress-text">${progress}% пути</div>
                </div>
                
                <div class="order-expanded" id="details-${order.id}" style="display:none;">
                    ${buildTimeline(order)}
                    <div class="order-actions">
                        <button class="order-btn order-btn-remind" onclick="event.stopPropagation();sendRemind('${order.id}')">
                            <tg-emoji emoji-id="5197336179678146423">🔔</tg-emoji>
                            Напомнить
                        </button>
                        <button class="order-btn order-btn-chat" onclick="event.stopPropagation();askAboutOrder('${order.id}')">
                            <tg-emoji emoji-id="5195019659002275787">💬</tg-emoji>
                            Спросить
                        </button>
                        <button class="order-btn order-btn-photo" onclick="event.stopPropagation();viewPhoto('${order.id}')">
                            <tg-emoji emoji-id="5197300467025079106">📸</tg-emoji>
                            Фото
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
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

// ---------- ДЕЙСТВИЯ ----------
function toggleOrderDetails(orderId) {
    const details = document.getElementById(`details-${orderId}`);
    if (details) {
        details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }
}

function sendRemind(orderId) {
    tg.showAlert(`🔔 Напоминание по заказу #${orderId} отправлено!`);
}

function askAboutOrder(orderId) {
    tg.showAlert(`💬 Напишите вопрос по заказу #${orderId} в бот @DollieHelper_bot`);
    tg.openTelegramLink(`https://t.me/DollieHelper_bot`);
}

function viewPhoto(orderId) {
    tg.showAlert(`📸 Фото для заказа #${orderId} пока нет`);
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

// ---------- PULL-TO-REFRESH ----------
let startY = 0;
let isDragging = false;
let isRefreshing = false;

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
