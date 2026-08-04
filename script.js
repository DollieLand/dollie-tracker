const tg = window.Telegram.WebApp;
const user = tg.initDataUnsafe?.user;
tg.ready();

if (user) {
    document.getElementById('user-info').innerHTML = `
        <p>👋 Привет, <strong>${user.first_name}</strong>!</p>
        <p style="font-size: 13px; color: #6b5a7a; margin-top: 4px;">Ваш ID: ${user.id}</p>
    `;
}

async function loadOrders() {
    const container = document.getElementById('orders-list');
    container.innerHTML = '<div class="loader">⏳ Загрузка заказов...</div>';
    
    try {
        const response = await fetch('https://dollieland.pythonanywhere.com/api/my-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegram_id: user?.id }),
        });
        
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        renderOrders(data.orders || []);
    } catch (error) {
        console.error('Ошибка:', error);
        const demoOrders = [
            { id: '12345', status: 'Прибыла в Россию', date: '2026-01-15' },
            { id: '67890', status: 'Отправлена из США', date: '2026-01-10' },
            { id: '11111', status: 'Заказ оформлен', date: '2026-01-05' },
        ];
        renderOrders(demoOrders);
    }
}

function renderOrders(orders) {
    const container = document.getElementById('orders-list');
    if (!orders || orders.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: 30px;">
                <p style="font-size: 32px;">📭</p>
                <p>У вас пока нет заказов</p>
            </div>
        `;
        return;
    }
    let html = '<div class="card"><p style="margin-bottom: 12px; font-weight: 500;">📦 Ваши заказы:</p>';
    orders.forEach(order => {
        html += `
            <div class="order-item">
                <div class="order-id">🆔 ${order.id}</div>
                <div class="order-status">${order.status}</div>
                <div class="order-date">📅 ${order.date || '—'}</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function showFaq() {
    tg.showAlert('🌸 Частые вопросы\n\n📦 Доставка из США — 4-5 недель\n📦 Доставка из Китая — 3-4 недели\n💳 Оплата веса — после прибытия на склад\n\nСвязь: @Darielune');
}

function closeApp() {
    tg.close();
}

loadOrders();