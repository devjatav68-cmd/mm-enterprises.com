const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found" });
}

async function readJson(filePath, fallback) {
  try {
    const file = await fs.readFile(filePath, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function parseBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function getProductIdFromReferer(request) {
  const referer = request.headers.referer || "";
  const fileName = path.basename(new URL(referer || "http://localhost/").pathname);
  return fileName.replace(/\.html$/i, "");
}

async function handleApi(request, response, url) {
  const products = await readJson(PRODUCTS_FILE, []);

  if (request.method === "GET" && url.pathname === "/api/products") {
    sendJson(response, 200, { products });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/search") {
    const query = cleanText(url.searchParams.get("q"), 80).toLowerCase();
    const results = products.filter((product) => {
      const haystack = `${product.name} ${product.description}`.toLowerCase();
      return !query || haystack.includes(query);
    });

    sendJson(response, 200, { query, results });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/cart") {
    const body = await parseBody(request);
    const productId = cleanText(body.productId || getProductIdFromReferer(request), 80);
    const product = products.find((item) => item.id === productId);

    if (!product) {
      sendJson(response, 400, { error: "Product not found" });
      return;
    }

    const quantity = Math.max(1, Math.min(Number(body.quantity) || 1, 20));
    const size = cleanText(body.size || "M", 8).toUpperCase();

    if (!product.sizes.includes(size)) {
      sendJson(response, 400, { error: "Selected size is not available" });
      return;
    }

    sendJson(response, 200, {
      item: {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity,
        size,
        subtotal: product.price * quantity
      }
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    const body = await parseBody(request);
    const productId = cleanText(body.productId || getProductIdFromReferer(request), 80);
    const product = products.find((item) => item.id === productId);

    if (!product) {
      sendJson(response, 400, { error: "Product not found" });
      return;
    }

    const quantity = Math.max(1, Math.min(Number(body.quantity) || 1, 20));
    const size = cleanText(body.size || "M", 8).toUpperCase();

    if (!product.sizes.includes(size)) {
      sendJson(response, 400, { error: "Selected size is not available" });
      return;
    }

    const orders = await readJson(ORDERS_FILE, []);
    const order = {
      id: `MM-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      productId: product.id,
      productName: product.name,
      price: product.price,
      quantity,
      size,
      total: product.price * quantity,
      status: "new",
      createdAt: new Date().toISOString()
    };

    orders.push(order);
    await writeJson(ORDERS_FILE, orders);
    sendJson(response, 201, { order });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/contact") {
    const body = await parseBody(request);
    const message = {
      id: crypto.randomUUID(),
      name: cleanText(body.name, 80),
      email: cleanText(body.email, 120),
      phone: cleanText(body.phone, 30),
      message: cleanText(body.message, 1000),
      createdAt: new Date().toISOString()
    };

    const messages = await readJson(MESSAGES_FILE, []);
    messages.push(message);
    await writeJson(MESSAGES_FILE, messages);
    sendJson(response, 201, { message });
    return;
  }

  notFound(response);
}

async function serveStatic(response, url) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.resolve(ROOT, `.${requestedPath}`);

  if (!filePath.startsWith(ROOT)) {
    notFound(response);
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
    });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      notFound(response);
      return;
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    sendJson(response, statusCode, {
      error: statusCode === 500 ? "Server error" : error.message
    });
  }
});

server.listen(PORT, () => {
  console.log(`M&M Enterprises backend running at http://localhost:${PORT}`);
});
