const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const webpush = require("web-push");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const port = Number(process.env.PORT || 3013);
const publicDir = path.join(__dirname, "public");

const vapidKeys = {
  publicKey:
    "BK1cMqOMX4VGV-KgaDB9WUtDOnP5frkRhKsrbYV3cA8o9v7pH9gqBPGDNgoBJQR4wwpZmhkCJH9QMfTZfV9_VGM",
  privateKey: "13fqXXAzUm2sVXxExv9mg1q-170Aha50Fyy3_UOPwYQ",
};

webpush.setVapidDetails(
  "mailto:student@example.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const subscriptions = new Map();
const reminders = new Map();

app.use(express.json());
app.use(express.static(publicDir));

app.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  if (!subscription?.endpoint) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  subscriptions.set(subscription.endpoint, subscription);
  res.status(201).json({ message: "Subscription saved" });
});

app.post("/unsubscribe", (req, res) => {
  const { endpoint } = req.body;

  if (endpoint) {
    subscriptions.delete(endpoint);
  }

  res.json({ message: "Subscription removed" });
});

app.post("/snooze", (req, res) => {
  const reminderId = Number(req.query.reminderId);

  if (!reminderId || !reminders.has(reminderId)) {
    return res.status(404).json({ error: "Reminder not found" });
  }

  const reminder = reminders.get(reminderId);
  clearTimeout(reminder.timeoutId);

  const newDelay = 5 * 60 * 1000;
  const timeoutId = setTimeout(() => {
    sendPushToAll({
      title: "Напоминание отложено",
      body: reminder.text,
      reminderId,
    });
    reminders.delete(reminderId);
  }, newDelay);

  reminders.set(reminderId, {
    timeoutId,
    text: reminder.text,
    reminderTime: Date.now() + newDelay,
  });

  res.json({ message: "Reminder snoozed for 5 minutes" });
});

function sendPushToAll(payload) {
  const data = JSON.stringify(payload);

  subscriptions.forEach((subscription, endpoint) => {
    webpush.sendNotification(subscription, data).catch((err) => {
      console.error("Push error:", err.message);
      if (err.statusCode === 404 || err.statusCode === 410) {
        subscriptions.delete(endpoint);
      }
    });
  });
}

function scheduleReminder({ id, text, reminderTime }) {
  const delay = Number(reminderTime) - Date.now();

  if (!id || !text || delay <= 0) {
    return;
  }

  if (reminders.has(id)) {
    clearTimeout(reminders.get(id).timeoutId);
  }

  const timeoutId = setTimeout(() => {
    sendPushToAll({
      title: "Напоминание",
      body: text,
      reminderId: id,
    });
    reminders.delete(id);
  }, delay);

  reminders.set(id, { timeoutId, text, reminderTime });
}

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("newTask", (task) => {
    socket.broadcast.emit("taskAdded", task);
    sendPushToAll({
      title: "Новая задача",
      body: task.text || "Добавлена новая заметка",
    });
  });

  socket.on("newReminder", (reminder) => {
    scheduleReminder(reminder);
    socket.broadcast.emit("taskAdded", {
      text: `${reminder.text} (с напоминанием)`,
      timestamp: Date.now(),
    });
  });
});

server.listen(port, () => {
  console.log(`PWA notes server started on http://localhost:${port}`);
});
