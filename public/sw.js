self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'Arreglos del colegio';
  event.waitUntil(self.registration.showNotification(title, {
    body: payload.body || 'Hay novedades en una ficha de arreglo.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: payload.url || '/' },
    tag: payload.notificationId || undefined,
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(client => client?.focus());
    return clients.openWindow(target);
  }));
});
