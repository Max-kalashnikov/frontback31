import { useEffect, useMemo, useState } from "react";
import "./App.scss";
import { api, clearTokens, getTokens } from "./api";

const productFormInitial = {
  title: "",
  category: "",
  description: "",
  price: "",
  stock: "",
  rating: "",
  image: "",
};

const authInitial = {
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  role: "user",
};

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createNoteFormInitial() {
  return {
    text: "",
    reminderDate: getDateInputValue(),
    reminderTime: "",
  };
}

const snoozeFormInitial = {
  amount: "5",
  unit: "minutes",
};

const snoozeUnitLabels = {
  minutes: "минут",
  hours: "часов",
};

const snoozeUnitMs = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
};

const roleLabels = {
  user: "Пользователь",
  seller: "Продавец",
  admin: "Администратор",
};

const ADMIN_NOTES_KEY = "frontback31AdminNotes";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(authInitial);
  const [activeAdminTab, setActiveAdminTab] = useState("notes");
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(productFormInitial);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteForm, setNoteForm] = useState(createNoteFormInitial);
  const [notificationStatus, setNotificationStatus] = useState("");
  const [snoozeTargetId, setSnoozeTargetId] = useState(null);
  const [snoozeForm, setSnoozeForm] = useState(snoozeFormInitial);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const canEditProducts = currentUser?.role === "seller" || currentUser?.role === "admin";
  const canDeleteProducts = currentUser?.role === "admin";
  const canManageUsers = currentUser?.role === "admin";
  const activeProductsCount = products.filter((product) => Number(product.stock) > 0).length;
  const pendingNotesCount = notes.filter((note) => !note.done).length;
  const plannedNotesCount = notes.filter((note) => note.reminder && !note.done).length;

  const userTitle = useMemo(() => {
    if (!currentUser) return "";
    return `${currentUser.first_name} ${currentUser.last_name}`;
  }, [currentUser]);

  useEffect(() => {
    const { accessToken } = getTokens();
    if (accessToken) {
      restoreSession();
    }

    if ("Notification" in window) {
      setNotificationStatus(Notification.permission);
    }
    // restoreSession intentionally runs only once on app start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      loadNotes();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role !== "admin") return undefined;

    const timers = notes
      .filter((note) => note.reminder && !note.done)
      .map((note) => {
        const delay = Number(note.reminder) - Date.now();
        if (delay <= 0) return null;

        return window.setTimeout(() => {
          showReminder(note);
        }, delay);
      })
      .filter(Boolean);

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [notes, currentUser]);

  async function restoreSession() {
    try {
      const user = await api.me();
      setCurrentUser(user);
      await loadProducts();
      if (user.role === "admin") await loadUsers();
    } catch (err) {
      clearTokens();
      setCurrentUser(null);
    }
  }

  async function afterLogin(user) {
    setCurrentUser(user);
    setMessage("");
    await loadProducts();
    if (user.role === "admin") await loadUsers();
  }

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      setMessage("Не удалось загрузить товары");
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setMessage("Не удалось загрузить пользователей");
    }
  }

  function handleAuthChange(e) {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setMessage("");

    try {
      if (authMode === "register") {
        await api.register(authForm);
        setAuthMode("login");
        setMessage("Пользователь создан. Теперь можно войти.");
        return;
      }

      const result = await api.login({
        email: authForm.email,
        password: authForm.password,
      });
      await afterLogin(result.user);
    } catch (err) {
      setMessage(authMode === "login" ? "Ошибка входа" : "Ошибка регистрации");
    }
  }

  function logout() {
    clearTokens();
    setCurrentUser(null);
    setProducts([]);
    setUsers([]);
    setNotes([]);
    setSelectedProduct(null);
  }

  function loadNotes() {
    const savedNotes = JSON.parse(localStorage.getItem(ADMIN_NOTES_KEY) || "[]");
    setNotes(savedNotes);
  }

  function saveNotes(nextNotes) {
    localStorage.setItem(ADMIN_NOTES_KEY, JSON.stringify(nextNotes));
    setNotes(nextNotes);
  }

  function showReminder(note) {
    const text = `Напоминание: ${note.text}`;

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Админка магазина", {
        body: text,
      });
    } else {
      setMessage(text);
    }
  }

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotificationStatus("unsupported");
      setMessage("Браузер не поддерживает уведомления");
      return;
    }

    if (Notification.permission === "denied") {
      setNotificationStatus("denied");
      setMessage("Уведомления запрещены в браузере. Разрешите их в настройках сайта для localhost.");
      return;
    }

    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setNotificationStatus(permission);

      if (permission === "granted") {
        new Notification("Уведомления включены", {
          body: "Напоминания из админки теперь будут всплывать в браузере.",
        });
        setMessage("Уведомления включены. Тестовое уведомление отправлено.");
        return;
      }

      setMessage("Уведомления пока не разрешены, напоминания будут показываться сообщением на странице");
    } catch (err) {
      setMessage("Не получилось запросить уведомления. Проверьте разрешения сайта в браузере.");
    }
  }

  function handleNoteChange(e) {
    const { name, value } = e.target;
    setNoteForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleNoteSubmit(e) {
    e.preventDefault();
    const text = noteForm.text.trim();

    if (!text) {
      setMessage("Введите текст заметки");
      return;
    }

    const reminderTimestamp = noteForm.reminderTime
      ? new Date(`${noteForm.reminderDate || getDateInputValue()}T${noteForm.reminderTime}`).getTime()
      : null;

    if (reminderTimestamp && (Number.isNaN(reminderTimestamp) || reminderTimestamp <= Date.now())) {
      setMessage("Дата и время напоминания должны быть в будущем");
      return;
    }

    const nextNotes = [
      ...notes,
      {
        id: Date.now(),
        text,
        reminder: reminderTimestamp,
        done: false,
        createdAt: Date.now(),
      },
    ];

    saveNotes(nextNotes);
    setNoteForm(createNoteFormInitial());
    setMessage("");
  }

  function toggleNote(id) {
    saveNotes(notes.map((note) => (note.id === id ? { ...note, done: !note.done } : note)));
  }

  function openSnoozeNote(id) {
    setSnoozeTargetId(id);
    setSnoozeForm(snoozeFormInitial);
  }

  function closeSnoozeModal() {
    setSnoozeTargetId(null);
    setSnoozeForm(snoozeFormInitial);
  }

  function handleSnoozeChange(e) {
    const { name, value } = e.target;
    setSnoozeForm((prev) => ({ ...prev, [name]: value }));
  }

  function snoozeNote(e) {
    e.preventDefault();

    const amount = Number(snoozeForm.amount);
    const unitMs = snoozeUnitMs[snoozeForm.unit] || snoozeUnitMs.minutes;

    if (!snoozeTargetId || !Number.isFinite(amount) || amount <= 0) {
      setMessage("Укажите, на сколько отложить напоминание");
      return;
    }

    saveNotes(
      notes.map((note) =>
        note.id === snoozeTargetId ? { ...note, reminder: Date.now() + amount * unitMs, done: false } : note
      )
    );
    setMessage(`Напоминание отложено на ${amount} ${snoozeUnitLabels[snoozeForm.unit] || "минут"}`);
    closeSnoozeModal();
  }

  function deleteNote(id) {
    saveNotes(notes.filter((note) => note.id !== id));
  }

  function openCreateProduct() {
    setEditingProduct(null);
    setProductForm(productFormInitial);
    setIsProductModalOpen(true);
  }

  function openEditProduct(product) {
    setEditingProduct(product);
    setProductForm({
      title: product.title ?? "",
      category: product.category ?? "",
      description: product.description ?? "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      rating: String(product.rating ?? ""),
      image: product.image ?? "",
    });
    setIsProductModalOpen(true);
  }

  function closeProductModal() {
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductForm(productFormInitial);
  }

  function handleProductChange(e) {
    const { name, value } = e.target;
    setProductForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleProductSubmit(e) {
    e.preventDefault();

    const payload = {
      ...productForm,
      price: Number(productForm.price),
      stock: Number(productForm.stock || 0),
      rating: Number(productForm.rating || 0),
    };

    if (!payload.title || !payload.category || !payload.description || !Number.isFinite(payload.price)) {
      setMessage("Заполните название, категорию, описание и цену");
      return;
    }

    try {
      if (editingProduct) {
        const updated = await api.updateProduct(editingProduct.id, payload);
        setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setSelectedProduct(updated);
      } else {
        const created = await api.createProduct(payload);
        setProducts((prev) => [...prev, created]);
      }

      closeProductModal();
      setMessage("");
    } catch (err) {
      setMessage("Нет прав или не удалось сохранить товар");
    }
  }

  async function showProductDetails(id) {
    try {
      const product = await api.getProduct(id);
      setSelectedProduct(product);
    } catch (err) {
      setMessage("Не удалось открыть товар");
    }
  }

  async function handleDeleteProduct(id) {
    if (!window.confirm("Удалить товар?")) return;

    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((item) => item.id !== id));
      if (selectedProduct?.id === id) setSelectedProduct(null);
    } catch (err) {
      setMessage("Удалять товары может только администратор");
    }
  }

  async function handleUserChange(id, field, value) {
    const original = users.find((item) => item.id === id);
    if (!original) return;

    const payload = {
      first_name: original.first_name,
      last_name: original.last_name,
      role: original.role,
      blocked: original.blocked,
      [field]: field === "blocked" ? value === "true" : value,
    };

    try {
      const updated = await api.updateUser(id, payload);
      setUsers((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (err) {
      setMessage("Не удалось обновить пользователя");
    }
  }

  async function handleDeleteUser(id) {
    const user = users.find((item) => item.id === id);
    if (!user) return;

    if (id === currentUser.id) {
      setMessage("Нельзя удалить текущего администратора");
      return;
    }

    const fullName = `${user.first_name} ${user.last_name}`.trim() || user.email;
    if (!window.confirm(`Удалить пользователя ${fullName}?`)) return;

    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((item) => item.id !== id));
      setMessage("Пользователь удален");
    } catch (err) {
      setMessage("Не удалось удалить пользователя");
    }
  }

  if (!currentUser) {
    return (
      <div className="auth-page">
        <form className="auth-card" onSubmit={handleAuthSubmit}>
          <div>
            <div className="brand">Peripherals Shop</div>
            <p className="auth-card__lead">Панель магазина компьютерной периферии</p>
          </div>
          <h1>{authMode === "login" ? "Вход" : "Регистрация"}</h1>

          {message && <div className="notice">{message}</div>}

          <input
            className="input"
            name="email"
            type="email"
            placeholder="Email"
            value={authForm.email}
            onChange={handleAuthChange}
          />

          {authMode === "register" && (
            <>
              <div className="form__row">
                <input
                  className="input"
                  name="first_name"
                  placeholder="Имя"
                  value={authForm.first_name}
                  onChange={handleAuthChange}
                />
                <input
                  className="input"
                  name="last_name"
                  placeholder="Фамилия"
                  value={authForm.last_name}
                  onChange={handleAuthChange}
                />
              </div>
              <select className="input" name="role" value={authForm.role} onChange={handleAuthChange}>
                <option value="user">Пользователь</option>
                <option value="seller">Продавец</option>
                <option value="admin">Администратор</option>
              </select>
            </>
          )}

          <input
            className="input"
            name="password"
            type="password"
            placeholder="Пароль"
            value={authForm.password}
            onChange={handleAuthChange}
          />

          <button className="btn btn--primary" type="submit">
            {authMode === "login" ? "Войти" : "Создать аккаунт"}
          </button>

          <button
            className="link-button"
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setMessage("");
            }}
          >
            {authMode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
          </button>

          <div className="demo-users">
            <span>Тестовые аккаунты:</span>
            <code>admin@shop.ru / admin123</code>
            <code>seller@shop.ru / seller123</code>
            <code>user@shop.ru / user123</code>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <div className="header__inner">
          <div>
            <div className="brand">Peripherals Shop</div>
            <div className="header__right">
              {userTitle} · {roleLabels[currentUser.role]}
            </div>
          </div>
          <button className="btn" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {message && <div className="notice">{message}</div>}

          <section className="summary">
            <div className="summary__item">
              <span>Товаров</span>
              <strong>{products.length}</strong>
            </div>
            <div className="summary__item">
              <span>В наличии</span>
              <strong>{activeProductsCount}</strong>
            </div>
            {canManageUsers && (
              <>
                <div className="summary__item">
                  <span>Пользователей</span>
                  <strong>{users.length}</strong>
                </div>
                <div className="summary__item">
                  <span>Напоминаний</span>
                  <strong>{plannedNotesCount}</strong>
                </div>
              </>
            )}
          </section>

          <div className="toolbar">
            <div>
              <h1 className="title">Каталог</h1>
              <p className="section-note">Товары, остатки и быстрые действия по магазину.</p>
            </div>
            {canEditProducts && (
              <button className="btn btn--primary" onClick={openCreateProduct}>
                + Новый товар
              </button>
            )}
                        </div>
                      )))
          {selectedProduct && (
            <section className="details">
              <button className="link-button" type="button" onClick={() => setSelectedProduct(null)}>
                Закрыть детали
              </button>
              <h2>{selectedProduct.title}</h2>
              <p>{selectedProduct.description}</p>
              <div className="meta">
                <span>{selectedProduct.category}</span>
                <span>{selectedProduct.price} ₽</span>
                <span>На складе: {selectedProduct.stock} шт.</span>
                <span>Рейтинг: {selectedProduct.rating}</span>
              </div>
            </section>
          )}

          {loading ? (
            <div className="empty">Загрузка...</div>
          ) : (
            <div className="cards">
              {products.map((product) => (
                <article key={product.id} className="product-card">
                  {product.image && <img src={product.image} alt={product.title} />}
                  <div className="product-card__body">
                    <h2 className="product-card__title">{product.title}</h2>
                    <div className="product-card__category">{product.category}</div>
                    <p className="product-card__description">{product.description}</p>
                    <div className="product-card__footer">
                      <span className="product-card__price">{product.price} ₽</span>
                      <span className="product-card__stock">{product.stock} шт.</span>
                    </div>
                  </div>
                  <div className="product-card__actions">
                    <button className="btn" onClick={() => showProductDetails(product.id)}>
                      Подробнее
                    </button>
                    {canEditProducts && (
                      <button className="btn" onClick={() => openEditProduct(product)}>
                        Редактировать
                      </button>
                    )}
                    {canDeleteProducts && (
                      <button className="btn btn--danger" onClick={() => handleDeleteProduct(product.id)}>
                        Удалить
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {canManageUsers && (
            <section className="admin-panel">
              <div className="admin-panel__header">
                <div>
                  <h2 className="title">Админка</h2>
                  <p className="section-note">Пользователи, рабочие заметки и напоминания.</p>
                </div>
                <div className="tabs">
                  <button
                    className={activeAdminTab === "notes" ? "tab tab--active" : "tab"}
                    type="button"
                    onClick={() => setActiveAdminTab("notes")}
                  >
                    Заметки <span>{pendingNotesCount}</span>
                  </button>
                  <button
                    className={activeAdminTab === "users" ? "tab tab--active" : "tab"}
                    type="button"
                    onClick={() => setActiveAdminTab("users")}
                  >
                    Пользователи <span>{users.length}</span>
                  </button>
                </div>
              </div>

              {activeAdminTab === "users" && (
                <div className="panel-surface">
                  <div className="panel-surface__top">
                    <h3>Пользователи</h3>
                    <button className="btn" onClick={loadUsers}>
                      Обновить
                    </button>
                  </div>
                  <div className="users-list">
                    {users.map((user) => (
                      <div className="user-row" key={user.id}>
                        <div>
                          <strong>{user.first_name} {user.last_name}</strong>
                          <span>{user.email}</span>
                        </div>
                        <select
                          className="input"
                          value={user.role}
                          onChange={(e) => handleUserChange(user.id, "role", e.target.value)}
                        >
                          <option value="user">Пользователь</option>
                          <option value="seller">Продавец</option>
                          <option value="admin">Администратор</option>
                        </select>
                        <select
                          className="input"
                          value={String(user.blocked)}
                          onChange={(e) => handleUserChange(user.id, "blocked", e.target.value)}
                        >
                          <option value="false">Активен</option>
                          <option value="true">Заблокирован</option>
                        </select>
                        <button
                          className="btn btn--danger"
                          disabled={user.id === currentUser.id}
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          Удалить
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeAdminTab === "notes" && (
                <div className="panel-surface">
                  <div className="panel-surface__top">
                    <h3>Заметки и напоминания</h3>
                    <div className="notification-actions">
                      <button className="btn" type="button" onClick={requestNotifications}>
                        Включить уведомления
                      </button>
                      {notificationStatus && (
                        <span className="notification-status">
                          {notificationStatus === "granted"
                            ? "Разрешены"
                            : notificationStatus === "denied"
                              ? "Запрещены"
                              : notificationStatus === "unsupported"
                                ? "Не поддерживаются"
                                : "Не выбраны"}
                        </span>
                      )}
                    </div>
                  </div>

                  <form className="note-form" onSubmit={handleNoteSubmit}>
                    <input
                      className="input"
                      name="text"
                      placeholder="Что нужно не забыть?"
                      value={noteForm.text}
                      onChange={handleNoteChange}
                    />
                    <input
                      className="input"
                      name="reminderDate"
                      type="date"
                      value={noteForm.reminderDate}
                      onChange={handleNoteChange}
                    />
                    <input
                      className="input"
                      name="reminderTime"
                      type="time"
                      value={noteForm.reminderTime}
                      onChange={handleNoteChange}
                    />
                    <button className="btn btn--primary" type="submit">
                      Добавить
                    </button>
                  </form>

                  <div className="notes-list">
                    {notes.length === 0 ? (
                      <div className="empty">Заметок пока нет</div>
                    ) : (
                      notes.map((note) => (
                        <div className={note.done ? "note-row note-row--done" : "note-row"} key={note.id}>
                          <div>
                            <strong>{note.text}</strong>
                            {note.reminder && (
                              <span>Напоминание: {new Date(note.reminder).toLocaleString()}</span>
                            )}
                          </div>
                          <button className="btn" onClick={() => toggleNote(note.id)}>
                            {note.done ? "Вернуть" : "Готово"}
                          </button>
                          {note.reminder && (
                            <button className="btn" onClick={() => openSnoozeNote(note.id)}>
                              Отложить
                            </button>
                          )}
                          <button className="btn btn--danger" onClick={() => deleteNote(note.id)}>
                            Удалить
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      {isProductModalOpen && (
        <div className="backdrop" onMouseDown={closeProductModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal__header">
              <div className="modal__title">{editingProduct ? "Редактирование товара" : "Новый товар"}</div>
              <button type="button" className="btn" onClick={closeProductModal}>
                Закрыть
              </button>
            </div>
            <form className="form" onSubmit={handleProductSubmit}>
              <input className="input" name="title" placeholder="Название" value={productForm.title} onChange={handleProductChange} />
              <input className="input" name="category" placeholder="Категория" value={productForm.category} onChange={handleProductChange} />
              <textarea className="input input--textarea" name="description" placeholder="Описание" value={productForm.description} onChange={handleProductChange} />
              <div className="form__row">
                <input className="input" name="price" placeholder="Цена" value={productForm.price} onChange={handleProductChange} />
                <input className="input" name="stock" placeholder="Остаток" value={productForm.stock} onChange={handleProductChange} />
              </div>
              <div className="form__row">
                <input className="input" name="rating" placeholder="Рейтинг" value={productForm.rating} onChange={handleProductChange} />
                <input className="input" name="image" placeholder="Фото, например 1.jpg" value={productForm.image} onChange={handleProductChange} />
              </div>
              <div className="modal__footer">
                <button type="button" className="btn" onClick={closeProductModal}>
                  Отмена
                </button>
                <button className="btn btn--primary" type="submit">
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {snoozeTargetId && (
        <div className="backdrop" onMouseDown={closeSnoozeModal}>
          <div className="modal modal--small" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="modal__header">
              <div className="modal__title">Отложить напоминание</div>
              <button type="button" className="btn" onClick={closeSnoozeModal}>
                Закрыть
              </button>
            </div>
            <form className="form" onSubmit={snoozeNote}>
              <div className="form__row">
                <input
                  className="input"
                  name="amount"
                  type="number"
                  min="1"
                  value={snoozeForm.amount}
                  onChange={handleSnoozeChange}
                />
                <select className="input" name="unit" value={snoozeForm.unit} onChange={handleSnoozeChange}>
                  <option value="minutes">Минут</option>
                  <option value="hours">Часов</option>
                </select>
              </div>
              <div className="modal__footer">
                <button type="button" className="btn" onClick={closeSnoozeModal}>
                  Отмена
                </button>
                <button className="btn btn--primary" type="submit">
                  Отложить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
