const express = require("express");
const cors = require("cors");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { nanoid } = require("nanoid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();
const port = 3000;

const ACCESS_SECRET = "frontback2_access_secret";
const REFRESH_SECRET = "frontback2_refresh_secret";
const ACCESS_EXPIRES_IN = "15m";
const REFRESH_EXPIRES_IN = "7d";
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const CERTS_DIR = path.join(__dirname, "certs");
const HTTPS_PFX_FILE = path.join(CERTS_DIR, "localhost.pfx");
const HTTPS_PFX_PASSWORD = process.env.HTTPS_PFX_PASSWORD || "frontback31";
const roles = ["user", "seller", "admin"];

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3001", "https://localhost:3001"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const defaultUsers = [
  {
    id: "admin1",
    email: "admin@shop.ru",
    first_name: "Иван",
    last_name: "Админов",
    role: "admin",
    blocked: false,
    passwordHash: bcrypt.hashSync("admin123", 10),
  },
  {
    id: "seller1",
    email: "seller@shop.ru",
    first_name: "Ольга",
    last_name: "Продавцова",
    role: "seller",
    blocked: false,
    passwordHash: bcrypt.hashSync("seller123", 10),
  },
  {
    id: "user1",
    email: "user@shop.ru",
    first_name: "Петр",
    last_name: "Покупатель",
    role: "user",
    blocked: false,
    passwordHash: bcrypt.hashSync("user123", 10),
  },
];

function loadUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
      return [...defaultUsers];
    }

    const savedUsers = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    return Array.isArray(savedUsers) && savedUsers.length > 0 ? savedUsers : [...defaultUsers];
  } catch (err) {
    console.error("Failed to load users:", err);
    return [...defaultUsers];
  }
}

function saveUsers() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

let refreshTokens = new Set();

const defaultProducts = [
  {
    id: nanoid(6),
    image: "1.jpg",
    title: "Игровая мышь Logitech G502 HERO",
    category: "Мышь",
    description: "Проводная игровая мышь с сенсором HERO 25K и RGB-подсветкой.",
    price: 5990,
    stock: 15,
    rating: 4.8,
  },
  {
    id: nanoid(6),
    image: "111808992.jpg",
    title: "Механическая клавиатура HyperX Alloy Origins",
    category: "Клавиатура",
    description: "Компактная механическая клавиатура с переключателями HyperX Red.",
    price: 8990,
    stock: 10,
    rating: 4.7,
  },
  {
    id: nanoid(6),
    image: "2.jpg",
    title: "Игровая гарнитура Razer BlackShark V2",
    category: "Гарнитура",
    description: "Легкая гарнитура с шумоподавлением и съемным микрофоном.",
    price: 7490,
    stock: 7,
    rating: 4.6,
  },
  {
    id: nanoid(6),
    image: "3.jpg",
    title: "Игровой коврик SteelSeries QcK Heavy Large",
    category: "Коврик для мыши",
    description: "Толстый тканевый коврик большого размера для точного управления мышью.",
    price: 2990,
    stock: 20,
    rating: 4.9,
  },
  {
    id: nanoid(6),
    image: "4.jpg",
    title: "Веб-камера Logitech C920 HD Pro",
    category: "Веб-камера",
    description: "Веб-камера Full HD 1080p с автофокусом и стереомикрофонами.",
    price: 8990,
    stock: 12,
    rating: 4.5,
  },
  {
    id: nanoid(6),
    image: "5.jpg",
    title: "Xbox Wireless Controller",
    category: "Геймпад",
    description: "Беспроводной контроллер Xbox с поддержкой Bluetooth.",
    price: 6990,
    stock: 9,
    rating: 4.8,
  },
  {
    id: nanoid(6),
    image: "6.jpg",
    title: "USB-хаб Ugreen 4-port USB 3.0",
    category: "USB-хаб",
    description: "Компактный USB-хаб на 4 порта для подключения периферии.",
    price: 2490,
    stock: 25,
    rating: 4.4,
  },
  {
    id: nanoid(6),
    image: "7.jpg",
    title: "Внешний SSD Samsung T7 1 TB",
    category: "Накопитель",
    description: "Портативный SSD с интерфейсом USB-C и скоростью до 1050 МБ/с.",
    price: 14990,
    stock: 6,
    rating: 4.9,
  },
  {
    id: nanoid(6),
    image: "8.jpg",
    title: "Игровая мышь Razer DeathAdder Essential",
    category: "Мышь",
    description: "Классическая игровая мышь с сенсором 6400 DPI.",
    price: 2990,
    stock: 18,
    rating: 4.6,
  },
  {
    id: nanoid(6),
    image: "9.jpg",
    title: "Микрофон Fifine K669B",
    category: "Микрофон",
    description: "USB-микрофон конденсаторного типа для стриминга и звонков.",
    price: 4590,
    stock: 11,
    rating: 4.7,
  },
];

function loadProductsData() {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(defaultProducts, null, 2));
      return [...defaultProducts];
    }

    const savedProducts = JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
    return Array.isArray(savedProducts) && savedProducts.length > 0 ? savedProducts : [...defaultProducts];
  } catch (err) {
    console.error("Failed to load products:", err);
    return [...defaultProducts];
  }
}

function saveProducts() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
}

let products = loadProductsData();

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    blocked: user.blocked,
  };
}

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

function issueTokens(user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.add(refreshToken);
  return { accessToken, refreshToken };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    const user = users.find((item) => item.id === payload.sub);

    if (!user || user.blocked) {
      return res.status(401).json({ error: "User is blocked or not found" });
    }

    req.user = payload;
    req.currentUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.currentUser || !allowedRoles.includes(req.currentUser.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

function findProduct(id) {
  return products.find((product) => product.id === id);
}

function parseOptionalNumber(value, fallback = 0) {
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "FrontBack2 Shop API",
      version: "2.0.0",
      description: "API интернет-магазина с авторизацией, JWT, refresh-токенами и ролями.",
    },
    servers: [{ url: `http://localhost:${port}`, description: "Локальный сервер" }],
  },
  apis: ["./app.js"],
};

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerJsdoc(swaggerOptions)));

/**
 * @swagger
 * tags:
 *   - name: Auth
 *   - name: Users
 *   - name: Products
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         email:
 *           type: string
 *         first_name:
 *           type: string
 *         last_name:
 *           type: string
 *         role:
 *           type: string
 *           enum: [user, seller, admin]
 *         blocked:
 *           type: boolean
 *     Product:
 *       type: object
 *       required: [title, category, description, price]
 *       properties:
 *         id:
 *           type: string
 *         title:
 *           type: string
 *         category:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация пользователя
 *     tags: [Auth]
 */
app.post("/api/auth/register", async (req, res) => {
  const { email, first_name, last_name, password } = req.body;

  if (!email || !first_name || !last_name || !password) {
    return res.status(400).json({ error: "email, first_name, last_name and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const exists = users.some((user) => user.email === normalizedEmail);

  if (exists) {
    return res.status(409).json({ error: "email already exists" });
  }

  const user = {
    id: nanoid(6),
    email: normalizedEmail,
    first_name: String(first_name).trim(),
    last_name: String(last_name).trim(),
    role: "user",
    blocked: false,
    passwordHash: await bcrypt.hash(password, 10),
  };

  users.push(user);
  saveUsers();
  res.status(201).json(publicUser(user));
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     tags: [Auth]
 */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = users.find((item) => item.email === String(email).trim().toLowerCase());

  if (!user || user.blocked) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ ...issueTokens(user), user: publicUser(user) });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление пары токенов
 *     tags: [Auth]
 */
app.post("/api/auth/refresh", (req, res) => {
  const refreshToken = req.body.refreshToken || req.headers["x-refresh-token"];

  if (!refreshToken) {
    return res.status(400).json({ error: "refreshToken is required" });
  }

  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({ error: "Invalid refresh token" });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.find((item) => item.id === payload.sub);

    if (!user || user.blocked) {
      return res.status(401).json({ error: "User not found or blocked" });
    }

    refreshTokens.delete(refreshToken);
    res.json(issueTokens(user));
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получение текущего пользователя
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json(publicUser(req.currentUser));
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Получить список пользователей
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
app.get("/api/users", authMiddleware, roleMiddleware(["admin"]), (req, res) => {
  res.json(users.map(publicUser));
});

app.get("/api/users/:id", authMiddleware, roleMiddleware(["admin"]), (req, res) => {
  const user = users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(publicUser(user));
});

app.put("/api/users/:id", authMiddleware, roleMiddleware(["admin"]), (req, res) => {
  const user = users.find((item) => item.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const { first_name, last_name, role, blocked } = req.body;

  if (first_name !== undefined) user.first_name = String(first_name).trim();
  if (last_name !== undefined) user.last_name = String(last_name).trim();
  if (role !== undefined && roles.includes(role)) user.role = role;
  if (blocked !== undefined) user.blocked = Boolean(blocked);

  saveUsers();
  res.json(publicUser(user));
});

app.delete("/api/users/:id", authMiddleware, roleMiddleware(["admin"]), (req, res) => {
  if (req.currentUser.id === req.params.id) {
    return res.status(400).json({ error: "Current admin cannot be deleted" });
  }

  const userIndex = users.findIndex((item) => item.id === req.params.id);
  if (userIndex === -1) return res.status(404).json({ error: "User not found" });

  users.splice(userIndex, 1);
  saveUsers();
  res.status(204).send();
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список товаров
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 */
app.get("/api/products", authMiddleware, (req, res) => {
  res.json(products);
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Создать товар
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 */
app.post("/api/products", authMiddleware, roleMiddleware(["seller", "admin"]), (req, res) => {
  const { title, name, category, description, price, stock, rating, image } = req.body;
  const productTitle = title || name;

  if (!productTitle || !category || !description || price === undefined) {
    return res.status(400).json({ error: "title, category, description and price are required" });
  }

  const productPrice = Number(price);
  const productStock = parseOptionalNumber(stock);
  const productRating = parseOptionalNumber(rating);

  if (!Number.isFinite(productPrice) || productPrice <= 0) {
    return res.status(400).json({ error: "Price must be a positive number" });
  }

  if (productStock === null || productStock < 0 || productRating === null || productRating < 0) {
    return res.status(400).json({ error: "Stock and rating must be valid positive numbers" });
  }

  const product = {
    id: nanoid(6),
    image: image || "",
    title: String(productTitle).trim(),
    category: String(category).trim(),
    description: String(description).trim(),
    price: productPrice,
    stock: productStock,
    rating: productRating,
  };

  products.push(product);
  saveProducts();
  res.status(201).json(product);
});

app.get("/api/products/:id", authMiddleware, (req, res) => {
  const product = findProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(product);
});

function updateProductHandler(req, res) {
  const product = findProduct(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });

  const { title, name, category, description, price, stock, rating, image } = req.body;
  const productTitle = title || name;

  if (price !== undefined) {
    const productPrice = Number(price);
    if (!Number.isFinite(productPrice) || productPrice <= 0) {
      return res.status(400).json({ error: "Price must be a positive number" });
    }
    product.price = productPrice;
  }

  if (stock !== undefined) {
    const productStock = parseOptionalNumber(stock);
    if (productStock === null || productStock < 0) {
      return res.status(400).json({ error: "Stock must be a valid positive number" });
    }
    product.stock = productStock;
  }

  if (rating !== undefined) {
    const productRating = parseOptionalNumber(rating);
    if (productRating === null || productRating < 0) {
      return res.status(400).json({ error: "Rating must be a valid positive number" });
    }
    product.rating = productRating;
  }

  if (productTitle !== undefined) product.title = String(productTitle).trim();
  if (category !== undefined) product.category = String(category).trim();
  if (description !== undefined) product.description = String(description).trim();
  if (image !== undefined) product.image = String(image).trim();

  saveProducts();
  res.json(product);
}

app.put("/api/products/:id", authMiddleware, roleMiddleware(["seller", "admin"]), updateProductHandler);

app.patch("/api/products/:id", authMiddleware, roleMiddleware(["seller", "admin"]), updateProductHandler);

app.delete("/api/products/:id", authMiddleware, roleMiddleware(["admin"]), (req, res) => {
  const exists = products.some((product) => product.id === req.params.id);
  if (!exists) return res.status(404).json({ error: "Product not found" });

  products = products.filter((product) => product.id !== req.params.id);
  saveProducts();
  res.status(204).send();
});

app.get("/", (req, res) => {
  res.send("FrontBack2 API запущено. Документация: /api-docs");
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const useHttps = process.env.HTTPS === "true";
const server = useHttps && fs.existsSync(HTTPS_PFX_FILE)
  ? https.createServer(
      {
        pfx: fs.readFileSync(HTTPS_PFX_FILE),
        passphrase: HTTPS_PFX_PASSWORD,
      },
      app
    )
  : http.createServer(app);

const protocol = useHttps && fs.existsSync(HTTPS_PFX_FILE) ? "https" : "http";

server.listen(port, () => {
  console.log(`Сервер запущен на ${protocol}://localhost:${port}`);
  console.log(`Swagger UI доступен по адресу ${protocol}://localhost:${port}/api-docs`);
  if (useHttps && !fs.existsSync(HTTPS_PFX_FILE)) {
    console.log("HTTPS включен, но сертификат не найден. Запустите npm run cert в backend.");
  }
});
