const socket = io();

const contentDiv = document.getElementById("content");
const homeBtn = document.getElementById("home-btn");
const aboutBtn = document.getElementById("about-btn");
const enablePushBtn = document.getElementById("enable-push");
const disablePushBtn = document.getElementById("disable-push");

function setActiveButton(activeId) {
  [homeBtn, aboutBtn].forEach((button) => button.classList.remove("active"));
  document.getElementById(activeId).classList.add("active");
}

async function loadContent(page) {
  try {
    const response = await fetch(`/content/${page}.html`);
    const html = await response.text();
    contentDiv.innerHTML = html;

    if (page === "home") {
      initNotes();
    }
  } catch (err) {
    contentDiv.innerHTML = "<p>Ошибка загрузки страницы.</p>";
    console.error(err);
  }
}

function getNotes() {
  return JSON.parse(localStorage.getItem("notes") || "[]");
}

function saveNotes(notes) {
  localStorage.setItem("notes", JSON.stringify(notes));
}

function showToast(text) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function initNotes() {
  const form = document.getElementById("note-form");
  const input = document.getElementById("note-input");
  const reminderForm = document.getElementById("reminder-form");
  const reminderText = document.getElementById("reminder-text");
  const reminderTime = document.getElementById("reminder-time");
  const list = document.getElementById("notes-list");

  function loadNotes() {
    const notes = getNotes();
    list.innerHTML = notes
      .map((note) => {
        const reminderInfo = note.reminder
          ? `<small>Напоминание: ${new Date(note.reminder).toLocaleString()}</small>`
          : "";
        return `<li class="note-item">${note.text}${reminderInfo}</li>`;
      })
      .join("");
  }

  function addNote(text, reminderTimestamp = null) {
    const notes = getNotes();
    const newNote = {
      id: Date.now(),
      text,
      reminder: reminderTimestamp,
    };

    notes.push(newNote);
    saveNotes(notes);
    loadNotes();

    if (reminderTimestamp) {
      socket.emit("newReminder", {
        id: newNote.id,
        text,
        reminderTime: reminderTimestamp,
      });
    } else {
      socket.emit("newTask", { text, timestamp: Date.now() });
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();

    if (text) {
      addNote(text);
      input.value = "";
    }
  });

  reminderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = reminderText.value.trim();
    const datetime = reminderTime.value;

    if (!text || !datetime) return;

    const timestamp = new Date(datetime).getTime();

    if (timestamp <= Date.now()) {
      alert("Дата напоминания должна быть в будущем");
      return;
    }

    addNote(text, timestamp);
    reminderText.value = "";
    reminderTime.value = "";
  });

  loadNotes();
}

socket.on("taskAdded", (task) => {
  showToast(`Новая задача: ${task.text}`);
});

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getPublicKey() {
  const response = await fetch("/vapid-public-key");
  const data = await response.json();
  return data.publicKey;
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Push-уведомления не поддерживаются");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    alert("Нужно разрешить уведомления");
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const publicKey = await getPublicKey();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await fetch("/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
}

async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await fetch("/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  }
}

async function initPushButtons(registration) {
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    enablePushBtn.style.display = "none";
    disablePushBtn.style.display = "inline-block";
  }

  enablePushBtn.addEventListener("click", async () => {
    await subscribeToPush();
    enablePushBtn.style.display = "none";
    disablePushBtn.style.display = "inline-block";
  });

  disablePushBtn.addEventListener("click", async () => {
    await unsubscribeFromPush();
    disablePushBtn.style.display = "none";
    enablePushBtn.style.display = "inline-block";
  });
}

homeBtn.addEventListener("click", () => {
  setActiveButton("home-btn");
  loadContent("home");
});

aboutBtn.addEventListener("click", () => {
  setActiveButton("about-btn");
  loadContent("about");
});

loadContent("home");

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("Service Worker registered:", registration.scope);
      await initPushButtons(registration);
    } catch (err) {
      console.error("Service Worker registration failed:", err);
    }
  });
}
