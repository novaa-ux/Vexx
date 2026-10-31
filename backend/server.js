import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "data.json");
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function readData() { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function writeData(data) {
  const temp = DATA_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(temp, DATA_FILE);
}
function admin(req, res, next) {
  const expected = process.env.ADMIN_PASSWORD || "change-me-now";
  const supplied = req.headers["x-admin-password"];
  if (supplied !== expected) return res.status(401).json({ error: "كلمة مرور الإدارة غير صحيحة" });
  next();
}
function publicProduct(p) {
  const { sizes, ...rest } = p;
  return { ...rest, sizes: sizes || {} };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, store: "VEX" }));
app.get("/api/products", (_req, res) => {
  const data = readData();
  res.json(data.products.filter(p => p.active !== false).map(publicProduct));
});
app.get("/api/admin/overview", admin, (_req, res) => {
  const data = readData();
  const products = data.products;
  const lowStock = products.filter(p => p.active !== false && p.stock <= p.lowStockAt);
  const revenue = data.orders.reduce((sum, o) => sum + o.total, 0);
  res.json({
    products: products.length, orders: data.orders.length, revenue,
    lowStock: lowStock.map(publicProduct),
    orders: data.orders.slice().reverse().slice(0, 30),
    inventory: products.map(publicProduct)
  });
});
app.patch("/api/admin/products/:id", admin, (req, res) => {
  const data = readData();
  const p = data.products.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: "المنتج غير موجود" });
  const allowed = ["price", "compareAt", "discount", "stock", "lowStockAt", "bestSeller", "active", "name", "category", "color"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (["price","compareAt","discount","stock","lowStockAt"].includes(key)) {
        const n = Number(req.body[key]);
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: "قيمة رقمية غير صالحة" });
        if (key === "stock") {
          // Keep size-level inventory consistent with the total stock edited in the dashboard.
          const sizes = p.sizes || (p.sizes = { S: 0, M: 0, L: 0, XL: 0 });
          let current = Object.values(sizes).reduce((a, b) => a + b, 0);
          let delta = n - current;
          const order = ["XL", "L", "M", "S"];
          if (delta > 0) sizes.XL = (sizes.XL || 0) + delta;
          while (delta < 0) {
            let changed = false;
            for (const size of order) {
              const take = Math.min(sizes[size] || 0, -delta);
              if (take > 0) { sizes[size] -= take; delta += take; changed = true; }
              if (delta === 0) break;
            }
            if (!changed) break;
          }
          p.stock = Object.values(sizes).reduce((a, b) => a + b, 0);
        } else p[key] = n;
      } else p[key] = req.body[key];
    }
  }
  writeData(data);
  res.json(publicProduct(p));
});
app.post("/api/orders", (req, res) => {
  const { customer, items } = req.body || {};
  if (!customer?.name || !customer?.phone || !customer?.address || !Array.isArray(items) || !items.length)
    return res.status(400).json({ error: "أكمل بيانات العميل والمنتجات" });
  const data = readData();
  const lines = [];
  for (const item of items) {
    const p = data.products.find(x => x.id === item.productId && x.active !== false);
    const qty = Math.floor(Number(item.quantity));
    const size = String(item.size || "");
    if (!p || !Number.isInteger(qty) || qty < 1 || !p.sizes?.[size] || p.sizes[size] < qty)
      return res.status(409).json({ error: `الكمية أو المقاس غير متاح حاليًا: ${p?.name || "منتج"}` });
    lines.push({ productId: p.id, name: p.name, color: p.color, size, quantity: qty, unitPrice: p.price, lineTotal: p.price * qty });
  }
  for (const line of lines) {
    const p = data.products.find(x => x.id === line.productId);
    p.sizes[line.size] -= line.quantity;
    p.stock = Object.values(p.sizes).reduce((a,b) => a + b, 0);
  }
  const order = {
    id: "VX-" + crypto.randomBytes(3).toString("hex").toUpperCase(),
    createdAt: new Date().toISOString(), status: "New",
    customer: { name: String(customer.name).slice(0,100), phone: String(customer.phone).slice(0,30), address: String(customer.address).slice(0,300) },
    items: lines, total: lines.reduce((s,l) => s + l.lineTotal, 0)
  };
  data.orders.push(order);
  writeData(data);
  res.status(201).json({ message: "تم تسجيل الطلب", order });
});
app.patch("/api/admin/orders/:id", admin, (req, res) => {
  const data = readData();
  const order = data.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  const allowed = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "حالة غير صحيحة" });
  order.status = req.body.status;
  writeData(data);
  res.json(order);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VEX API running on http://localhost:${PORT}`));
