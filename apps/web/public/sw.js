// PRD S-10.12 — browser push notification service worker. Deliberately
// minimal: this app has no other service-worker needs (no offline cache,
// no PWA install prompt is in scope), so this file exists solely to
// receive `push` events and handle notification clicks.

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const { title, body, link } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Spine", {
      body,
      icon: "/spine-logo-horizontal.png",
      data: { link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link;
  const targetPath = link || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && "focus" in client) {
          client.focus();
          if (link) client.navigate(targetPath);
          return;
        }
      }
      return self.clients.openWindow(targetPath);
    }),
  );
});
