const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
tg.ready();

if (user) {
    document.getElementById('user-info').innerHTML = `
        <p>👋 Привет, <strong>${user.first_name}</strong>!</p>
        <p style="font-size: 13px; color: #6b5a7a; margin-top: 4px;">
            Ваш ID: ${user.id}
        </p>
    `;
}

async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loader">⏳ Загрузка...</div>';
    
    const userId = user?.id;
    if (!userId) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:30px;">
                <p>🔒 Откройте бота @DollieHelper_bot</p>
            </div>
        `;
        return;
    }
    
    try {
        // ===== GET-ЗАПРОС (как в твоём API) =====
        const response = await fetch(
            `https://api-DollieLand.pythonanywhere.com/api/my-orders?telegram_id=${userId}`
        );
        
        if (!response.ok) throw new Error('Ошибка сервера');
        
        const data = await response.json();
        console.log('Ответ API:', data);
        
        if (data.ok && data.orders && data.orders.length > 0) {
            renderOrders(data.orders);
        } else {
            renderOrders([]);
        }
        
    } catch (error) {
        console.error('Ошибка:', error);
        // Показываем демо только если реальная ошибка
        const demo = [
            { id: '12345', status: 'Прибыла в Россию', title: 'Monster High', delivery_date: '25.01.2026' },
            { id: '67890', status: 'Отправлена из США', title: 'Barbie', delivery_date: '01.02.2026' },
        ];
        renderOrders(demo, true);
    }
}

function renderOrders(orders, isDemo = false) {
    const container = document.getElementById('orders-list');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:30px;">
                <p>📭 У вас пока нет заказов</p>
                <button onclick="loadOrders()" style="margin-top:15px;padding:10px 20px;background:#a855f7;color:#fff;border:none;border-radius:10px;cursor:pointer;">
                    🔄 Обновить
                </button>
            </div>
        `;
        return;
    }
    
    let html = '<div class="card">';
    if (isDemo) {
        html += `<p style="color:#fbbf24;">⚠️ Демо-режим</p>`;
    }
    html += `<p style="margin-bottom:12px;font-weight:500;">📦 Ваши заказы (${orders.length}):</p>`;
    
    orders.forEach(order => {
        html += `
            <div class="order-item" style="background:rgba(255,255,255,0.04);border-radius:12px;padding:14px 16px;margin-bottom:10px;border-left:3px solid #a855f7;">
                <div style="font-weight:600;">🆔 ${order.id}</div>
                ${order.title ? `<div style="font-size:13px;color:#f5a8d3;">🏷️ ${order.title}</div>` : ''}
                <div style="font-size:13px;color:#a882b5;">${order.status || 'не определён'}</div>
                ${order.delivery_date ? `<div style="font-size:12px;color:#6b5a7a;">📅 ${order.delivery_date}</div>` : ''}
                ${order.created_date ? `<div style="font-size:12px;color:#6b5a7a;">📆 ${order.created_date}</div>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function showFaq() {
    tg.showAlert('🌸 Частые вопросы\n\n📦 Доставка из США — 4-5 недель\n📦 Доставка из Китая — 3-4 недели');
}

function closeApp() {
    tg.close();
}

// Автоматическая загрузка
loadOrders();
