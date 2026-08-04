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
    container.innerHTML = '<div class="loader">⏳ Загрузка заказов...</div>';
    
    const userId = user?.id;
    
    if (!userId) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 30px;">
                <p style="font-size: 32px;">🔒</p>
                <p>Откройте бота @DollieHelper_bot</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch('https://api-DollieLand.pythonanywhere.com/api/my-orders?token=dollie_secret_2024', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                telegram_id: userId
            })
        });
        
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
            { id: '12345', status: 'Прибыла в Россию', title: 'Monster High', delivery_date: '25.01.2026' },
            { id: '67890', status: 'Отправлена из США', title: 'Barbie', delivery_date: '01.02.2026' },
        ];
        renderOrders(demoOrders, true);
    }
}

function renderOrders(orders, isDemo = false) {
    const container = document.getElementById('orders-list');
    
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 30px;">
                <p style="font-size: 32px;">📭</p>
                <p>У вас пока нет заказов</p>
                <button class="btn-primary" onclick="loadOrders()" style="margin-top: 15px; width: 100%;">
                    🔄 Обновить
                </button>
            </div>
        `;
        return;
    }
    
    let html = '';
    if (isDemo) {
        html += `
            <div class="card" style="border: 1px solid #fbbf24; background: rgba(251, 191, 36, 0.1);">
                <p style="color: #fbbf24; font-size: 13px;">⚠️ Демо-режим</p>
            </div>
        `;
    }
    
    html += `<div class="card"><p style="margin-bottom: 12px; font-weight: 500;">📦 Ваши заказы:</p>`;
    
    orders.forEach(order => {
        html += `
            <div class="order-item">
                <div class="order-id">🆔 ${order.id}</div>
                ${order.title ? `<div class="order-title">🏷️ ${order.title}</div>` : ''}
                <div class="order-status">${order.status || 'не определён'}</div>
                ${order.delivery_date ? `<div class="order-delivery">📅 ${order.delivery_date}</div>` : ''}
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

loadOrders();
