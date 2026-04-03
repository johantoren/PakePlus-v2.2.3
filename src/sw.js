// Alarm Service Worker - handles background alarm scheduling
const scheduledTimeouts = new Map();

function getNextAlarmTime(alarm) {
  const [hours, minutes] = alarm.time.split(':').map(Number);
  const now = new Date();
  const candidate = new Date();
  candidate.setHours(hours, minutes, 0, 0);

  if (candidate <= now) {
    candidate.setDate(candidate.getDate() + 1);
  }

  if (alarm.days && alarm.days.length > 0) {
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(candidate);
      checkDate.setDate(candidate.getDate() + i);
      const dayName = Object.keys(dayMap).find(k => dayMap[k] === checkDate.getDay());
      if (alarm.days.includes(dayName)) {
        return checkDate.getTime();
      }
    }
    return null;
  }

  return candidate.getTime();
}

function scheduleAlarm(alarm) {
  const now = Date.now();
  const alarmTime = getNextAlarmTime(alarm);
  if (!alarmTime) return;

  const delay = alarmTime - now;
  // Only schedule alarms within the next 24 hours
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;

  const timeoutId = setTimeout(() => {
    self.registration.showNotification(alarm.label || '⏰ Alarm', {
      body: `Time: ${alarm.time}`,
      icon: '/icon.png',
      tag: `alarm-${alarm.id}`,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
    });
    scheduledTimeouts.delete(alarm.id);
  }, delay);

  scheduledTimeouts.set(alarm.id, timeoutId);
}

function scheduleTimer(durationSeconds) {
  const delay = durationSeconds * 1000;
  setTimeout(() => {
    self.registration.showNotification("⏱️ Timer", {
      body: "Time's up!",
      icon: '/icon.png',
      tag: 'timer',
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
    });
  }, delay);
}

self.addEventListener('message', (event) => {
  const { type } = event.data;

  if (type === 'SCHEDULE_ALARMS') {
    // Clear existing
    for (const id of scheduledTimeouts.values()) clearTimeout(id);
    scheduledTimeouts.clear();
    // Schedule enabled alarms
    const alarms = event.data.alarms || [];
    alarms.filter(a => a.enabled).forEach(scheduleAlarm);
  }

  if (type === 'SCHEDULE_TIMER') {
    scheduleTimer(event.data.seconds);
  }

  if (type === 'CANCEL_TIMER') {
    self.registration.getNotifications({ tag: 'timer' }).then(notifications => {
      notifications.forEach(n => n.close());
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
