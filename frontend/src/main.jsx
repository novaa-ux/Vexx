import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ShoppingBag, Search, Menu, X, ArrowRight, Instagram, Plus, Minus, ShieldCheck, Truck, RotateCcw, LayoutDashboard, LockKeyhole, AlertTriangle, Check, ChevronDown } from "lucide-react";
import "./style.css";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const money = n => `${Number(n).toLocaleString("en-EG")} EGP`;
const img = p => p?.image || "/images/vex-black-front.jpg";

function App() {
  const [products,setProducts] = useState([]);
  const [cart,setCart] = useState([]);
  const [category,setCategory] = useState("All");
  const [query,setQuery] = useState("");
  const [cartOpen,setCartOpen] = useState(false);
  const [selected,setSelected] = useState(null);
  const [size,setSize] = useState("M");
  const [qty,setQty] = useState(1);
  const [notice,setNotice] = useState("");
  const [checkout,setCheckout] = useState(false);
  const [customer,setCustomer] = useState({name:"",phone:"",address:""});
  const [adminOpen,setAdminOpen] = useState(false);
  const [adminPassword,setAdminPassword] = useState("");
  const [adminData,setAdminData] = useState(null);
  const [adminError,setAdminError] = useState("");
  const [mobileMenu,setMobileMenu] = useState(false);

  async function loadProducts() {
    try {
      const r = await fetch(`${API}/api/products`);
      if (!r.ok) throw new Error(`Products API returned ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data)) throw new Error("استجابة المنتجات غير صحيحة");
      setProducts(data);
      if (data.length === 0) setNotice("مفيش منتجات مفعّلة حاليًا. راجع حالة المنتجات من لوحة الإدارة.");
    } catch (err) {
      // Keep the complete catalogue visible if the API is temporarily unavailable.
      // Cart interactions still work; order submission correctly requires the backend.
      try {
        const fallback = await fetch("/catalog.json");
        if (!fallback.ok) throw new Error("catalog.json unavailable");
        const catalogue = await fallback.json();
        setProducts(catalogue.filter(p => p.active !== false));
        setNotice("عرض المنتجات بوضع المعاينة. لتسجيل الطلبات شغّل الـ Backend أو اربط عنوانه.");
      } catch {
        setProducts([]);
        setNotice("تعذر تحميل كتالوج المنتجات. راجع ملفات المشروع.");
      }
      console.error("VEX products API unavailable:", err);
    }
  }
  useEffect(()=>{loadProducts();},[]);
  const filtered = useMemo(()=>products.filter(p=>(category==="All"||p.category===category)&&(`${p.name} ${p.color}`).toLowerCase().includes(query.toLowerCase())),[products,category,query]);
  const cartCount=cart.reduce((s,x)=>s+x.quantity,0);
  const total=cart.reduce((s,x)=>s+x.quantity*x.price,0);
  const lowProducts=products.filter(p=>p.stock<=p.lowStockAt);

  function addToCart(p, chosenSize="M", quantity=1) {
    const available = Number(p.sizes?.[chosenSize] || 0);
    if (available < 1 || available < quantity) {
      setNotice("المقاس أو الكمية دي خلصت. اختار مقاس تاني.");
      return;
    }
    setCart(old => {
      const found = old.find(x => x.id === p.id && x.size === chosenSize);
      if (found) {
        if (found.quantity + quantity > available) {
          setNotice(`المتاح من مقاس ${chosenSize} هو ${available} قطعة فقط.`);
          return old;
        }
        return old.map(x => x.id === p.id && x.size === chosenSize ? {...x, quantity:x.quantity+quantity} : x);
      }
      return [...old, {id:p.id,name:p.name,color:p.color,size:chosenSize,quantity,price:p.price,image:p.image,available}];
    });
    setSelected(null);
    setCartOpen(true);
    setNotice("");
  }
  function quickAdd(p) {
    const preferred = ["M", "L", "S", "XL"].find(s => Number(p.sizes?.[s] || 0) > 0);
    if (!preferred) { setNotice("المنتج نفد من المخزون حاليًا."); return; }
    addToCart(p, preferred, 1);
  }
  function changeCart(i,delta){setCart(old=>old.map((x,j)=>j===i?{...x,quantity:Math.max(1,Math.min(x.available,x.quantity+delta))}:x));}
  async function placeOrder(e){
    e.preventDefault();
    try{
      const r=await fetch(`${API}/api/orders`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customer,items:cart.map(x=>({productId:x.id,size:x.size,quantity:x.quantity}))})});
      const data=await r.json(); if(!r.ok)throw Error(data.error||"حصلت مشكلة");
      setCart([]);setCheckout(false);setCustomer({name:"",phone:"",address:""});setNotice(`تم استلام طلبك بنجاح — رقم الطلب ${data.order.id}`);setCartOpen(false);await loadProducts();
    }catch(err){setNotice(err.message);}
  }
  async function adminLogin(e){
    e.preventDefault();setAdminError("");
    try{const r=await fetch(`${API}/api/admin/overview`,{headers:{"x-admin-password":adminPassword}});const d=await r.json();if(!r.ok)throw Error(d.error);setAdminData(d);}
    catch(err){setAdminError(err.message||"تعذر الاتصال بالسيرفر");}
  }
  async function saveProduct(id,patch){
    try{const r=await fetch(`${API}/api/admin/products/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json","x-admin-password":adminPassword},body:JSON.stringify(patch)});const d=await r.json();if(!r.ok)throw Error(d.error);const r2=await fetch(`${API}/api/admin/overview`,{headers:{"x-admin-password":adminPassword}});setAdminData(await r2.json());await loadProducts();}
    catch(e){setAdminError(e.message);}
  }
  async function setOrderStatus(id,status){
    const r=await fetch(`${API}/api/admin/orders/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json","x-admin-password":adminPassword},body:JSON.stringify({status})});
    if(r.ok){const r2=await fetch(`${API}/api/admin/overview`,{headers:{"x-admin-password":adminPassword}});setAdminData(await r2.json());}
  }

  return <div className="site">
    <div className="announcement">MOVE WITH PURPOSE — FREE SHIPPING ON ORDERS OVER 1,500 EGP</div>
    <header className="header">
      <button className="icon-btn mobile-only" onClick={()=>setMobileMenu(!mobileMenu)}><Menu/></button>
      <a className="logo" href="#">VEX<span>.</span></a>
      <nav className={mobileMenu?"nav open":"nav"}><a href="#new">NEW ARRIVALS</a><a href="#bestsellers">BEST SELLERS</a><a href="#shop">SHOP MEN</a><a href="#story">OUR STANDARD</a></nav>
      <div className="header-actions"><button className="icon-btn search-toggle" onClick={()=>document.getElementById("search")?.focus()}><Search/></button><button className="bag-btn" onClick={()=>setCartOpen(true)}><ShoppingBag/><span>BAG ({cartCount})</span></button></div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-image"></div><div className="hero-shade"></div>
        <div className="hero-copy"><p className="eyebrow">BUILT FOR THE WORK</p><h1>TRAIN<br/><em>BEYOND</em><br/>LIMITS.</h1><p>Performance essentials. No distractions.<br/>Just you, your discipline, and the next rep.</p><a className="light-cta" href="#shop">SHOP THE COLLECTION <ArrowRight size={17}/></a></div>
        <div className="hero-index">01 / 03</div><div className="hero-vertical">VEX PERFORMANCE DIVISION</div>
      </section>
      <div className="ticker"><span>DISCIPLINE OVER MOTIVATION</span><b>✳</b><span>ENGINEERED TO MOVE</span><b>✳</b><span>NO DAYS WASTED</span><b>✳</b><span>DISCIPLINE OVER MOTIVATION</span></div>
      {lowProducts.length>0&&<div className="stock-strip"><AlertTriangle size={16}/> LOW STOCK ALERT: {lowProducts.map(p=>`${p.color} ${p.name} (${p.stock} left)`).join("  •  ")}</div>}
      <section className="section" id="new"><div className="section-head"><div><p className="eyebrow">THE LATEST DROP</p><h2>NEW ARRIVALS<span>.</span></h2></div><a href="#shop" className="text-link">VIEW ALL <ArrowRight size={16}/></a></div>
        <div className="product-grid feature-grid">{products.slice(0,4).map(p=><ProductCard key={p.id} p={p} onSelect={()=>{setSelected(p);setSize(["M","L","S","XL"].find(s=>p.sizes?.[s]>0)||"M");setQty(1);}} onQuick={()=>quickAdd(p)}/>)}</div>
      </section>
      <section className="best-section" id="bestsellers"><div className="best-image"><img src="/images/vex-black-angle.jpg"/><div className="best-stamp">VEX<br/>01</div></div><div className="best-copy"><p className="eyebrow">THE ONE THEY COME BACK FOR</p><h2>THE<br/><em>BEST</em><br/>SELLER.</h2><p>Our VEX Core Compression Tee in Black. A sharp fit, a clean finish, and built to stay in rotation.</p><div className="best-meta"><span>01 — CORE SERIES</span><span>BLACK / COMPRESSION</span></div><button className="dark-cta" onClick={()=>{const p=products.find(x=>x.bestSeller);if(p){setSelected(p);setSize(["M","L","S","XL"].find(s=>p.sizes?.[s]>0)||"M");setQty(1);}else setNotice("Best Seller مش متاح حاليًا.");}}>SHOP BEST SELLER <ArrowRight size={17}/></button></div></section>
      <section className="section shop-section" id="shop"><div className="section-head"><div><p className="eyebrow">FIND YOUR UNIFORM</p><h2>SHOP THE DROP<span>.</span></h2></div><div className="filters"><input id="search" placeholder="Search products..." value={query} onChange={e=>setQuery(e.target.value)}/><select value={category} onChange={e=>setCategory(e.target.value)}><option>All</option><option>Compressions</option><option>Bottoms</option></select></div></div>
        <div className="product-grid">{filtered.map(p=><ProductCard key={p.id} p={p} onSelect={()=>{setSelected(p);setSize(["M","L","S","XL"].find(s=>p.sizes?.[s]>0)||"M");setQty(1);}} onQuick={()=>quickAdd(p)}/>)}</div>{filtered.length===0&&<p className="empty">No products found.</p>}
      </section>
      <section className="values" id="story"><div><ShieldCheck/><h3>BUILT TO PERFORM</h3><p>Purposeful fits for every session.</p></div><div><Truck/><h3>DELIVERY ACROSS EGYPT</h3><p>Your next essential, on its way.</p></div><div><RotateCcw/><h3>STRAIGHTFORWARD SUPPORT</h3><p>We're here when you need us.</p></div></section>
    </main>
    <footer><a className="logo" href="#">VEX<span>.</span></a><p>WHERE DISCIPLINE MEETS DESIGN.</p><div className="footer-bottom"><span>© 2026 VEX PERFORMANCE. ALL RIGHTS RESERVED.</span><button onClick={()=>{setAdminOpen(true);setAdminData(null);setAdminError("");}}>ADMIN ACCESS</button><a href="#top"><Instagram size={17}/></a></div></footer>
    {notice&&<div className="toast" onClick={()=>setNotice("")}>{notice}<button><X size={15}/></button></div>}
    {selected&&<div className="overlay" onClick={()=>setSelected(null)}><div className="product-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}><X/></button><div className="modal-photo"><img src={img(selected)}/></div><div className="modal-info"><p className="eyebrow">{selected.category} / {selected.color}</p><h2>{selected.name}</h2><div className="price">{money(selected.price)} {selected.compareAt>selected.price&&<del>{money(selected.compareAt)}</del>}</div><p>{selected.description}</p><p className="field-label">SELECT SIZE</p><div className="sizes">{["S","M","L","XL"].map(s=><button key={s} disabled={!selected.sizes?.[s]} className={size===s?"chosen":""} onClick={()=>{setSize(s);setQty(1);}}>{s}</button>)}</div><div className="qty-row"><span>QUANTITY</span><div><button onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={14}/></button>{qty}<button onClick={()=>setQty(Math.min(selected.sizes?.[size]||1,qty+1))}><Plus size={14}/></button></div></div><button className="dark-cta full" disabled={!selected.sizes?.[size] || qty > selected.sizes?.[size]} onClick={()=>addToCart(selected,size,qty)}>ADD TO BAG — {money(selected.price*qty)}</button><small>{selected.stock<=selected.lowStockAt?`Only ${selected.stock} left in stock`:"In stock — ready to move"}</small></div></div></div>}
    {cartOpen&&<div className="overlay drawer-overlay" onClick={()=>setCartOpen(false)}><aside className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><h2>YOUR BAG <span>({cartCount})</span></h2><button className="close" onClick={()=>setCartOpen(false)}><X/></button></div>{cart.length===0?<div className="empty">Your bag is waiting.<br/><a href="#shop" onClick={()=>setCartOpen(false)}>CONTINUE SHOPPING</a></div>:!checkout?<><div className="cart-lines">{cart.map((x,i)=><div className="cart-line" key={`${x.id}-${x.size}`}><img src={x.image}/><div className="cart-desc"><b>{x.name}</b><span>{x.color} / Size {x.size}</span><strong>{money(x.price)}</strong><div className="qty-control"><button onClick={()=>changeCart(i,-1)}><Minus size={13}/></button>{x.quantity}<button onClick={()=>changeCart(i,1)}><Plus size={13}/></button><button className="remove" onClick={()=>setCart(old=>old.filter((_,j)=>j!==i))}>REMOVE</button></div></div></div>)}</div><div className="drawer-total"><div><span>SUBTOTAL</span><b>{money(total)}</b></div><small>Shipping is calculated after order confirmation.</small><button className="dark-cta full" onClick={()=>setCheckout(true)}>CHECKOUT <ArrowRight size={16}/></button></div></>:<form className="checkout-form" onSubmit={placeOrder}><button type="button" className="back-link" onClick={()=>setCheckout(false)}>← BACK TO BAG</button><h3>DELIVERY DETAILS</h3><label>Full name<input required value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})}/></label><label>Phone number<input required type="tel" value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})}/></label><label>Full address<input required value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})}/></label><div className="checkout-total">TOTAL <b>{money(total)}</b></div><button className="dark-cta full">PLACE ORDER — CASH ON DELIVERY</button><small>Demo checkout: orders are saved in your local backend. Connect a payment provider before accepting online payments.</small></form>}</aside></div>}
    {adminOpen&&<div className="overlay admin-overlay" onClick={()=>setAdminOpen(false)}><div className="admin-panel" onClick={e=>e.stopPropagation()}><div className="admin-top"><div><p className="eyebrow">VEX CONTROL ROOM</p><h2>STORE DASHBOARD</h2></div><button className="close" onClick={()=>setAdminOpen(false)}><X/></button></div>{!adminData?<form className="admin-login" onSubmit={adminLogin}><LockKeyhole size={28}/><h3>ADMIN SIGN IN</h3><p>Enter your store password to manage stock, prices and orders.</p><input type="password" placeholder="Admin password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} required/><button className="dark-cta full">OPEN DASHBOARD</button>{adminError&&<p className="error">{adminError}</p>}<small>First login password: <b>change-me-now</b>. Change it before publishing.</small></form>:<div className="admin-content"><div className="stats"><div><span>PRODUCTS</span><b>{adminData.products}</b></div><div><span>ORDERS</span><b>{adminData.orders.length}</b></div><div><span>ORDER VALUE</span><b>{money(adminData.revenue)}</b></div><div className={adminData.lowStock.length?"warn-stat":""}><span>LOW STOCK</span><b>{adminData.lowStock.length}</b></div></div>{adminData.lowStock.length>0&&<div className="admin-warning"><AlertTriangle/> <div><b>Stock needs attention</b><p>{adminData.lowStock.map(p=>`${p.color}: ${p.stock} left`).join(" • ")}</p></div></div>}<h3>PRODUCT CONTROL</h3><p className="admin-hint">غيّر السعر أو الخصم أو حد التنبيه، واضغط Save. الخصم بيتحسب تلقائيًا من السعر الأصلي.</p><div className="admin-products">{adminData.inventory.map(p=><AdminProduct key={p.id} p={p} onSave={patch=>saveProduct(p.id,patch)}/>)}</div><h3>RECENT ORDERS</h3>{adminData.orders.length===0?<p className="admin-hint">لسه مفيش طلبات.</p>:<div className="orders">{adminData.orders.map(o=><div className="order-row" key={o.id}><div><b>{o.id} — {o.customer.name}</b><span>{o.customer.phone} · {money(o.total)}</span></div><select value={o.status} onChange={e=>setOrderStatus(o.id,e.target.value)}>{["New","Confirmed","Shipped","Delivered","Cancelled"].map(s=><option>{s}</option>)}</select></div>)}</div>}{adminError&&<p className="error">{adminError}</p>}<button className="logout" onClick={()=>setAdminData(null)}>LOCK DASHBOARD</button></div>}</div></div>}
  </div>
}
function ProductCard({p,onSelect,onQuick}) {
 return <article className="product-card"><button className="product-image" onClick={onSelect}><img src={img(p)} alt={`${p.name} ${p.color}`}/>{p.bestSeller&&<span className="tag best-tag">BEST SELLER</span>}{p.discount>0&&<span className="tag sale-tag">-{p.discount}%</span>}<span className="quick">QUICK ADD <Plus size={14}/></span></button><div className="product-info"><div><h3>{p.name}</h3><p>{p.color} · {p.category}</p></div><div className="product-price"><b>{money(p.price)}</b>{p.compareAt>p.price&&<del>{money(p.compareAt)}</del>}</div></div><button className="quick-mobile" onClick={onQuick}>ADD TO BAG <Plus size={14}/></button>{p.stock<=p.lowStockAt&&<div className="stock-note"><span/> ONLY {p.stock} LEFT — MOVING FAST</div>}</article>
}
function AdminProduct({p,onSave}) {
 const [price,setPrice]=useState(p.price),[compareAt,setCompareAt]=useState(p.compareAt),[stock,setStock]=useState(p.stock),[lowStockAt,setLowStockAt]=useState(p.lowStockAt),[bestSeller,setBestSeller]=useState(p.bestSeller),[saved,setSaved]=useState(false);
 const discount=compareAt>0?Math.max(0,Math.round((1-price/compareAt)*100)):0;
 return <div className="admin-product"><div className="admin-product-title"><img src={img(p)}/><div><b>{p.name}</b><span>{p.color} · {p.id}</span></div><span className={stock<=lowStockAt?"stock-pill danger":"stock-pill"}>{stock} IN STOCK</span></div><div className="edit-grid"><label>Sale price<input type="number" min="0" value={price} onChange={e=>setPrice(+e.target.value)}/></label><label>Original price<input type="number" min="0" value={compareAt} onChange={e=>setCompareAt(+e.target.value)}/></label><label>Stock<input type="number" min="0" value={stock} onChange={e=>setStock(+e.target.value)}/></label><label>Alert at<input type="number" min="0" value={lowStockAt} onChange={e=>setLowStockAt(+e.target.value)}/></label></div><div className="admin-save-row"><label className="check-label"><input type="checkbox" checked={bestSeller} onChange={e=>setBestSeller(e.target.checked)}/> Best seller</label><span>{discount}% discount</span><button onClick={()=>{onSave({price,compareAt,stock,lowStockAt,bestSeller,discount});setSaved(true);setTimeout(()=>setSaved(false),1800)}}>{saved?<><Check size={14}/> SAVED</>:"SAVE CHANGES"}</button></div></div>
}
createRoot(document.getElementById("root")).render(<App/>);
