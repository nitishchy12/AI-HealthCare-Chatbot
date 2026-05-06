self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'HealthBot';
  const options = {
    body:  data.body  || '',
    icon:  '/logo192.png',
    badge: '/logo192.png',
    data:  { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.notification.data?.url || '/';
      const existing = clientList.find((c) => c.url.includes(self.location.origin) && 'focus' in c);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
