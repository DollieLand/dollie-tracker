const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
tg.ready();

if (user) {
    document.querySelector('.profile-name').textContent = `👋 Привет, ${user.first_name}`;
    document.querySelector('.profile-id').textContent = `ID: ${user.id}`;
}

async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loader">⏳ Загрузка заказов...</div>';
    
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
            renderOrders(data.orders);
        } else {
            renderOrders([]);
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        const demoOrders = [
            { id: '12345', status: 'Прибыла в Россию', title: 'Monster High', delivery_date: '25.01.2026', created_date: '15.01.2026' },
            { id: '67890', status: 'Отправлена из США', title: 'Barbie', delivery_date: '01.02.2026', created_date: '10.01.2026' },
        ];
        renderOrders(demoOrders, true);
    }
}

function renderOrders(orders, isDemo = false) {
    const container = document.getElementById('orders-list');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="card empty-state">
                <div class="empty-icon">📭</div>
                <p class="empty-title">У вас пока нет заказов</p>
                <p class="empty-sub">Оформите заказ через @Darielune</p>
                <button class="btn-primary" onclick="loadOrders()" style="margin-top: 16px; padding: 12px 24px; border: none; border-radius: 12px; background: linear-gradient(135deg, #c084e0, #a855f7); color: #fff; font-weight: 600; cursor: pointer; width: 100%;">
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
        
        if (statusText.includes('Доставлен')) statusClass = 'status-delivered';
        else if (statusText.includes('Россию') || statusText.includes('Таможня')) statusClass = 'status-russia';
        else if (statusText.includes('Оплата')) statusClass = 'status-payment';
        else if (statusText.includes('США') || statusText.includes('Отправлен')) statusClass = 'status-us';
        
        html += `
            <div class="order-item ${statusClass}">
                <div class="order-id">🆔 ${order.id}</div>
                ${order.title ? `<div class="order-title">🏷️ ${order.title}</div>` : ''}
                <div class="order-status">${statusText}</div>
                ${order.delivery_date ? `<div class="order-delivery">📅 ${order.delivery_date}</div>` : ''}
                ${order.created_date ? `<div class="order-date">📆 Создан: ${order.created_date}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function showFaq() {
    tg.showAlert(
        '🌸 Частые вопросы\n\n' +
        '📦 Доставка из США — 4-5 недель\n' +
        '📦 Доставка из Китая — 3-4 недели\n' +
        '💳 Оплата веса — после прибытия на склад\n\n' +
        '📱 Бот: @DollieHelper_bot\n' +
        '💌 Связь: @Darielune'
    );
}

function closeApp() {
    tg.close();
}

loadOrders();
