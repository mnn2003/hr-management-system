/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// Firebase Messaging Service Worker for background push notifications
// This file MUST be in the public/ directory

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBFHgyqk16_cxG1o7EF2OQ8ksxsjA1ENKk",
  authDomain: "pq-hub-906ed.firebaseapp.com",
  projectId: "pq-hub-906ed",
  storageBucket: "pq-hub-906ed.appspot.com",
  messagingSenderId: "226267686237",
  appId: "1:226267686237:web:6f0583e680ee61cb8534b4",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: payload.data?.tag || 'default',
    data: {
      url: payload.data?.url || '/',
      ...payload.data,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Otherwise open a new window
      return clients.openWindow(urlToOpen);
    })
  );
});
