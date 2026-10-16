import OrderQueue from '../components/OrderQueue';
import { clearStaffSession } from '../staffSession';
import { summarizeOrders, todayInManila } from '../orderWorkflow';
import { money } from '../storeState';
import { AdminCatalog, AdminCustomers, AdminEmployeeLogs } from '../components/AdminDataViews';
import React, { useState, useEffect, useRef } from "react";
import ApexCharts from "apexcharts";
import "../pages/AdminPanel.css";
import '../components/AdminDataViews.css';
import bg from "../assets/coffee-background.svg";
import logo from "../assets/coffee-logo.png";
import { useNavigate, useLocation } from "react-router-dom";
import { apiRequest } from "../api";

const localDateTime = (value) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const createVoucherDraft = () => {
  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  return { code: '', name: '', description: '', termsAndConditions: '', discountType: 'percentage', discountValue: '', minOrderValue: '0', maxDiscountValue: '', startDate: localDateTime(start), endDate: localDateTime(end), usageLimitPublic: '0', usageLimitPerUser: '1', newCustomersOnly: false, allowedProducts: [] };
};

export default function AdminPanel() {
  const barChartRef = useRef(null);
  const areaChartRef = useRef(null);
const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user_currentUser') || 'null');
  const canManagePeople = ['admin', 'manager'].includes(currentUser?.role);

  // Counts
  const [productCount, setProductCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  // Data
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employeeLogs, setEmployeeLogs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const orderMetrics = summarizeOrders(orders);
  const refreshStaffOrders = async () => {
    setOrdersLoading(true);
    try { const {ok,data}=await apiRequest('/orders'); if(!ok || !Array.isArray(data?.payload))throw new Error(data?.message || 'Unable to load orders.'); setOrders(data.payload); setOrdersError(''); }
    catch(error){setOrdersError(error.message || 'Unable to reach the order service.');}
    finally{setOrdersLoading(false);}
  };
  useEffect(()=>{refreshStaffOrders();const timer=setInterval(()=>{if(document.visibilityState==='visible')refreshStaffOrders();},30000);return()=>clearInterval(timer);},[]);
  const [productDraft, setProductDraft] = useState({ sku: '', name: '', description: '', price: '', image: '', category: '', type: '', stock: '', isAddon: false, optionGroups: [], allowedAddonsJson: '[]' });
  const [editingProductId, setEditingProductId] = useState(null);
  const [productEditDraft, setProductEditDraft] = useState({});
  const [vouchers, setVouchers] = useState([]);
  const [voucherDraft, setVoucherDraft] = useState(createVoucherDraft);
  const [editingVoucherId, setEditingVoucherId] = useState(null);
  const [voucherMessage, setVoucherMessage] = useState('');

  // View states
  const notificationLocation = useLocation();
  const notificationOrder = new URLSearchParams(notificationLocation.search).get('order') || '';
  const [activeView, setActiveView] = useState("dashboard");
  useEffect(() => { if (notificationOrder) { setActiveView('orders'); refreshStaffOrders(); } }, [notificationOrder]);

  // Fetch counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data } = await apiRequest('/products');
        const items = data?.payload || data || [];
        const products = Array.isArray(items) ? items : [];

        setProducts(products);
        setProductCount(products.length);
        setCategoryCount(new Set(products.map((item) => item.category).filter(Boolean)).size);
        if (canManagePeople) {
          const customersResult = await apiRequest('/admin/customers');
          const customerItems = customersResult.data?.payload || [];
          setCustomers(Array.isArray(customerItems) ? customerItems : []);
          setCustomerCount(Array.isArray(customerItems) ? customerItems.length : 0);
        }
      } catch (err) {
        console.error('Failed to fetch counts:', err);
      }
    };
    fetchCounts();
  }, [canManagePeople]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data } = await apiRequest('/products');
        const items = data?.payload || data || [];
        setProducts(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      }
    };
    fetchProducts();
  }, []);

  // Fetch employee logs when view is active
  useEffect(() => {
    if (activeView === "employeeLogs") {
      apiRequest('/admin/employee-logs')
        .then(({ ok, data }) => {
          const items = data?.payload || [];
          setEmployeeLogs(ok && Array.isArray(items) ? items : []);
        })
        .catch((err) => console.error('Failed to fetch employee logs:', err));
    }
  }, [activeView]);

  useEffect(() => {
    if (activeView !== 'vouchers') return;
    apiRequest('/vouchers').then(({ ok, data }) => {
      if (ok && Array.isArray(data?.payload)) setVouchers(data.payload);
      else setVoucherMessage(data?.message || 'Unable to load vouchers.');
    }).catch(() => setVoucherMessage('Unable to reach the voucher service.'));
  }, [activeView]);

  // ApexCharts for dashboard
  useEffect(() => {
    if (activeView === "dashboard") {
      const currentProducts = products.filter((product) => product.status !== 'phased_out');
      const categories = [...new Set(currentProducts.map((product) => product.category).filter(Boolean))];
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return date;
      });
      const barOptions = {
        series: [{ name: "Products", data: categories.map((category) => currentProducts.filter((product) => product.category === category).length) }],
        chart: { type: "bar", background: "transparent", height: 350, toolbar: { show: false } },
        colors: ["#553725", "#a6825a", "#43513d", "#c7b394", "#8d7058"],
        plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: "45%" } },
        dataLabels: { enabled: false },
        grid: { borderColor: "#e9dfd1", yaxis: { lines: { show: true } } },
        xaxis: { categories, labels: { style: { colors: "#827164" } } },
        yaxis: { labels: { style: { colors: "#827164" } } },
        tooltip: { theme: "light" },
      };
      const barChart = new ApexCharts(barChartRef.current, barOptions);
      barChart.render();

      const areaOptions = {
        series: [
          { name: "Orders", data: days.map((date) => orders.filter((order) => todayInManila(order.createdAt) === todayInManila(date)).length) },
          { name: "Paid sales (PHP)", data: days.map((date) => orders.filter((order) => order.paymentStatus === 'paid' && order.status !== 'cancelled' && order.paidAt && todayInManila(order.paidAt) === todayInManila(date)).reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0)) },
        ],
        chart: { type: "area", height: 350, background: "transparent", toolbar: { show: false } },
        yaxis: [{ title: { text: "Orders" }, decimalsInFloat: 0 }, { opposite: true, title: { text: "Paid sales (PHP)" } }],
        colors: ["#43513d", "#a6825a"],
        dataLabels: { enabled: false },
        stroke: { curve: "smooth", width: 3 },
        fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0.05 } },
        xaxis: { categories: days.map((date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), labels: { style: { colors: "#827164" } } },
        grid: { borderColor: "#e9dfd1" },
        tooltip: { theme: "light" },
      };
      const areaChart = new ApexCharts(areaChartRef.current, areaOptions);
      areaChart.render();

      return () => {
        barChart.destroy();
        areaChart.destroy();
      };
    }
  }, [activeView, products, orders]);

  // Update stock
  const updateStock = async (id, stock) => {
    try {
      const { ok, data } = await apiRequest(`/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: Number(stock) }),
      });
      if (!ok) throw new Error(data?.message || 'Stock update failed');
      const updated = data?.payload;
      setProducts(products.map(f => (f._id === id ? updated : f)));
      alert("Stock updated!");
    } catch (err) {
      console.error("Failed to update stock:", err);
      alert("Error updating stock");
    }
  };

  const updateOrderStatus = async (order, status, reason) => {
    const {ok,data}=await apiRequest(`/orders/${order._id}/status`,{method:'PATCH',body:JSON.stringify({status,reason})});
    if(!ok){await refreshStaffOrders();throw new Error(data?.message || 'Order changed or could not be updated. Refresh and try again.');}
    await refreshStaffOrders();
    if(status==='cancelled'){const response=await apiRequest('/products');if(response.ok&&Array.isArray(response.data?.payload))setProducts(response.data.payload);}
  };
  const markCashPaymentReceived = async (order, paymentAmount, paymentChange) => {
    const {ok,data}=await apiRequest(`/orders/${order._id}/payment`,{method:'PATCH',body:JSON.stringify({paymentStatus:'paid',paymentAmount,paymentChange})});
    if(!ok)throw new Error(data?.message || 'Unable to record cash collection.');
    await refreshStaffOrders();
  };

  const createProduct = async (event) => {
    event.preventDefault();
    try {
      const product = {
        ...productDraft,
        price: Number(productDraft.price),
        stock: Number(productDraft.stock),
        isAddon: productDraft.isAddon,
        allowedAddons: JSON.parse(productDraft.allowedAddonsJson || '[]'),
      };
      delete product.allowedAddonsJson;
      const { ok, data } = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
      if (!ok) throw new Error(data?.message || 'Product creation failed.');
      const created = data.payload;
      setProducts((current) => [...current, created]);
      setProductCount((count) => count + 1);
      setCategoryCount(new Set([...products.map((item) => item.category), created.category]).size);
      setProductDraft({ sku: '', name: '', description: '', price: '', image: '', category: '', type: '', stock: '', isAddon: false, optionGroups: [], allowedAddonsJson: '[]' });
      alert('Product created.');
      return true;
    } catch (error) {
      alert(error.message || 'Unable to create product.');
      return false;
    }
  };

  const beginProductEdit = (product) => {
    setEditingProductId(product._id);
    setProductEditDraft({ sku: product.sku, name: product.name, description: product.description, price: String(product.price), image: product.image, category: product.category, type: product.type || '', stock: String(product.stock), isAddon: Boolean(product.isAddon), optionGroups: JSON.parse(JSON.stringify(product.optionGroups || [])), allowedAddons: JSON.stringify((product.allowedAddons || []).map(rule => ({ ...rule, addon: rule.addon?._id || rule.addon }))) });
  };

  const saveProductEdit = async (event, product) => {
    event.preventDefault();
    let allowedAddons;
    try {
      allowedAddons = JSON.parse(productEditDraft.allowedAddons || '[]');
    } catch (error) {
      alert('Add-on rules must be valid JSON.');
      return;
    }
    const updates = { ...productEditDraft, price: Number(productEditDraft.price), stock: Number(productEditDraft.stock), allowedAddons };
    delete updates.allowedAddonsJson;
    const { ok, data } = await apiRequest(`/products/${product._id}`, { method: 'PATCH', body: JSON.stringify(updates) });
    if (!ok) {
      alert(data?.message || 'Unable to update product.');
      return;
    }
    setProducts((current) => current.map((item) => item._id === product._id ? data.payload : item));
    setEditingProductId(null);
  };

  const phaseOutProduct = async (product) => {
    if (!window.confirm(`Phase out ${product.name}? It will no longer appear in the shop.`)) return;
    const { ok, data } = await apiRequest(`/products/${product._id}`, { method: 'DELETE' });
    if (!ok) {
      alert(data?.message || 'Unable to phase out product.');
      return;
    }
    setProducts((current) => current.map((item) => item._id === product._id ? data.payload : item));
  };

  const saveVoucher = async (event) => {
    event.preventDefault();
    const payload = {
      voucher: {
        code: voucherDraft.code.trim().toUpperCase(), name: voucherDraft.name.trim(), description: voucherDraft.description.trim(), termsAndConditions: voucherDraft.termsAndConditions.trim(),
        discountType: voucherDraft.discountType, discountValue: Number(voucherDraft.discountValue), minOrderValue: Number(voucherDraft.minOrderValue), maxDiscountValue: Number(voucherDraft.maxDiscountValue),
        newCustomersOnly: voucherDraft.newCustomersOnly,
        allowedProducts: voucherDraft.allowedProducts.map((product) => ({ product, minQuantity: 1, addons: [] })),
      },
      startDate: new Date(voucherDraft.startDate).toISOString(), endDate: new Date(voucherDraft.endDate).toISOString(),
      usageLimitPublic: Number(voucherDraft.usageLimitPublic), usageLimitPerUser: Number(voucherDraft.usageLimitPerUser),
    };
    try {
      const { ok, data } = await apiRequest(editingVoucherId ? `/vouchers/${editingVoucherId}` : '/vouchers', { method: editingVoucherId ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      if (!ok) throw new Error(data?.message || 'Unable to save voucher.');
      setVoucherMessage(data?.message || 'Voucher saved.');
      setVoucherDraft(createVoucherDraft());
      setEditingVoucherId(null);
      const refreshed = await apiRequest('/vouchers');
      if (refreshed.ok && Array.isArray(refreshed.data?.payload)) setVouchers(refreshed.data.payload);
    } catch (error) { setVoucherMessage(error.message || 'Unable to save voucher.'); }
  };

  const editVoucher = (template) => {
    setEditingVoucherId(template._id);
    setVoucherMessage('Editing voucher. Changes apply to new claims; already claimed vouchers keep their original terms.');
    setVoucherDraft({
      code: template.voucher.code, name: template.voucher.name, description: template.voucher.description, termsAndConditions: template.voucher.termsAndConditions,
      discountType: template.voucher.discountType, discountValue: String(template.voucher.discountValue), minOrderValue: String(template.voucher.minOrderValue), maxDiscountValue: String(template.voucher.maxDiscountValue),
      startDate: localDateTime(template.startDate), endDate: localDateTime(template.endDate), usageLimitPublic: String(template.usageLimitPublic), usageLimitPerUser: String(template.usageLimitPerUser), newCustomersOnly: Boolean(template.voucher.newCustomersOnly),
      allowedProducts: (template.voucher.allowedProducts || []).map((rule) => String(rule.product?._id || rule.product)),
    });
    document.querySelector('.adminpanel-main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteVoucher = async (template) => {
    if (!window.confirm(`Retire voucher ${template.voucher.code}? Customers who already claimed it can still use it until it expires.`)) return;
    const { ok, data } = await apiRequest(`/vouchers/${template._id}`, { method: 'DELETE' });
    if (!ok) { setVoucherMessage(data?.message || 'Unable to retire voucher.'); return; }
    setVouchers((current) => current.filter((voucher) => voucher._id !== template._id));
    setVoucherMessage('Voucher retired. Existing claimed copies remain valid.');
  };

  const voucherStatus = (template) => {
    const now = Date.now();
    if (now < new Date(template.startDate).getTime()) return 'Scheduled';
    if (now >= new Date(template.endDate).getTime()) return 'Expired';
    if (template.usageLimitPublic > 0 && template.usageCountPublic >= template.usageLimitPublic) return 'Claim limit reached';
    return 'Active';
  };

  // Update user
  const updateUser = async (user, newData) => {
    try {
      const { ok, data } = await apiRequest(`/admin/customers/${user._id}`, {
        method: "PATCH",
        body: JSON.stringify(newData),
      });
      if (!ok) throw new Error(data?.message || 'Unable to update customer.');
      const updated = data.payload;
      setCustomers(customers.map(u => (u._id === updated._id ? updated : u)));
      setCustomerCount(customers.length);
      alert("User updated!");
      return true;
    } catch (err) {
      console.error(err);
      alert("Error updating user");
      return false;
    }
  };

  const toggleUserStatus = user => updateUser(user, { isDisabled: !user.isDisabled });

  const deleteUser = async user => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const { ok, data } = await apiRequest(`/admin/customers/${user._id}`, { method: "DELETE" });
      if (!ok) throw new Error(data?.message || 'Unable to delete customer.');
      const updatedCustomers = customers.filter(u => u._id !== user._id);
      setCustomers(updatedCustomers);
      setCustomerCount(updatedCustomers.length);
      alert("User deleted!");
    } catch (err) {
      console.error(err);
      alert("Error deleting user");
    }
  };

  const logoutAdmin = () => {
  // Sign out without deleting this browser's shopping bag and delivery draft.
  clearStaffSession();

  // Redirect to login or landing page
  navigate("/login");

  // Reload to reset app state
  window.location.reload();
};

  return (
    <div className="adminpanel-dashboard">
      {/* Sidebar */}
      <aside className="adminpanel-sidebar">
        <div className="adminpanel-sidebar-header">
          <img src={logo} alt="Store Logo" className="adminpanel-logo" />
        </div>

        <ul className="adminpanel-nav">
          {[['dashboard','dashboard','Dashboard'],['products','inventory_2','Products'],['orders','receipt_long','Orders'],['vouchers','confirmation_number','Vouchers'],...(canManagePeople ? [['customers','groups','Customers'],['employeeLogs','badge','Employee logs']] : [])].map(([view,symbol,label]) => <li key={view}><button type="button" aria-current={activeView===view?'page':undefined} className={activeView===view?'is-active':''} onClick={()=>setActiveView(view)}><span className="material-icons-outlined" aria-hidden="true">{symbol}</span>{label}</button></li>)}
          <li className="admin-nav-logout"><button type="button" onClick={logoutAdmin}><span className="material-icons-outlined" aria-hidden="true">logout</span>Sign out</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main
        className="adminpanel-main"
        style={{
          backgroundImage: `url(${bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <header className="adminpanel-header">
          <div className="adminpanel-header-left">
            <span className="admin-workspace-label">WORKSPACE <span>/</span> {currentUser?.role === 'crew' ? 'Coffee team' : 'Store management'}</span>
          </div>
          <div className="adminpanel-header-right">
            <button type="button" aria-label="Open notifications" onClick={() => window.dispatchEvent(new Event('coffee-open-notifications'))}><span className="material-icons-outlined">notifications</span></button>
            <div className="admin-current-user"><span className="admin-user-initial">{currentUser?.firstName?.[0] || 'K'}</span><span>{currentUser?.firstName || 'Team member'}<small>{currentUser?.role}</small></span></div>
          </div>
        </header>

        <section className="adminpanel-content">
          <p className="admin-page-eyebrow">SAMPAGUITA / OPERATIONS</p>
          <h1>
            {activeView === "dashboard" && "Overview"}
            {activeView === "products" && "Products"}
            {activeView === "orders" && "Orders"}
            {activeView === "vouchers" && "Voucher Management"}
            {activeView === "customers" && "Customers"}
            {activeView === "employeeLogs" && "Employee activity"}
          </h1>

          {['products','customers','employeeLogs'].includes(activeView) && <p className="admin-page-description">{activeView==='products'?'A well-stocked menu starts here. Manage every coffee, bean and little extra.':activeView==='customers'?'Keep customer details organized and account access in your hands.':'A clear record of who signed in, and when.'}</p>}
          {/* Dashboard */}
          {activeView === "dashboard" && (
            <>
              <div className="staff-dashboard-toolbar"><p>Live service overview / refreshes every 30 seconds</p><button type="button" onClick={refreshStaffOrders} disabled={ordersLoading}>Refresh overview</button><button type="button" onClick={()=>setActiveView('orders')}>Open order queue</button></div>{ordersError&&<p role="alert">{ordersError}</p>}<div className="adminpanel-cards">
                <div className="adminpanel-card blue">
                  <div className="adminpanel-card-header">
                    <h3>ORDERS TODAY</h3>
                    <span className="material-icons-outlined">inventory_2</span>
                  </div>
                  <h2>{orderMetrics.today}</h2>
                </div>
                <div className="adminpanel-card orange">
                  <div className="adminpanel-card-header">
                    <h3>ACTIVE ORDERS</h3>
                    <span className="material-icons-outlined">category</span>
                  </div>
                  <h2>{orderMetrics.active}</h2>
                </div>
                <div className="adminpanel-card green">
                  <div className="adminpanel-card-header">
                    <h3>COLLECTED TODAY</h3>
                    <span className="material-icons-outlined">groups</span>
                  </div>
                  <h2>{money(orderMetrics.collected)}</h2>
                </div>
                <div className="adminpanel-card red">
                  <div className="adminpanel-card-header">
                    <h3>LOW STOCK</h3>
                    <span className="material-icons-outlined">notification_important</span>
                  </div>
                  <h2>{products.filter((product) => product.status !== 'phased_out' && (product.stock <= 5 || product.status === 'out_of_stock')).length}</h2>
                </div>
              </div>

              <div className="adminpanel-charts">
                <div className="adminpanel-chart">
                  <h2>Products by Category</h2>
                  <div ref={barChartRef}></div>
                </div>
                <div className="adminpanel-chart">
                  <h2>Orders and paid sales</h2>
                  <div ref={areaChartRef}></div>
                </div>
              </div>
            </>
          )}

          {activeView === "vouchers" && <>
            <form className="voucher-admin-form" onSubmit={saveVoucher}>
              <div className="voucher-admin-heading"><div><p>CAMPAIGN SETUP</p><h2>{editingVoucherId ? 'Edit voucher' : 'Create a voucher'}</h2></div><span>Manage customer claims, spend rules, and product eligibility.</span></div>
              <div className="voucher-admin-grid">
                <label>Voucher code<input required maxLength="32" pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" title="Use 3–32 letters, numbers, dashes, or underscores." value={voucherDraft.code} onChange={(event) => setVoucherDraft({ ...voucherDraft, code: event.target.value.toUpperCase() })} placeholder="e.g. BREW10" /></label>
                <label>Customer-facing name<input required value={voucherDraft.name} onChange={(event) => setVoucherDraft({ ...voucherDraft, name: event.target.value })} placeholder="Your morning coffee offer" /></label>
                <label>Description<input required value={voucherDraft.description} onChange={(event) => setVoucherDraft({ ...voucherDraft, description: event.target.value })} placeholder="A short description for customers" /></label>
                <label>Terms and conditions<input required value={voucherDraft.termsAndConditions} onChange={(event) => setVoucherDraft({ ...voucherDraft, termsAndConditions: event.target.value })} placeholder="One use per customer. While stocks last." /></label>
                <label>Discount type<select value={voucherDraft.discountType} onChange={(event) => setVoucherDraft({ ...voucherDraft, discountType: event.target.value })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount (₱)</option></select></label>
                <label>Discount value<input required type="number" min="0.01" max={voucherDraft.discountType === 'percentage' ? '100' : undefined} step="0.01" value={voucherDraft.discountValue} onChange={(event) => setVoucherDraft({ ...voucherDraft, discountValue: event.target.value })} /></label>
                <label>Minimum order (₱)<input required type="number" min="0" step="0.01" value={voucherDraft.minOrderValue} onChange={(event) => setVoucherDraft({ ...voucherDraft, minOrderValue: event.target.value })} /></label>
                <label>Maximum discount (₱)<input required type="number" min="0.01" step="0.01" value={voucherDraft.maxDiscountValue} onChange={(event) => setVoucherDraft({ ...voucherDraft, maxDiscountValue: event.target.value })} /></label>
                <label>Starts at<input required type="datetime-local" value={voucherDraft.startDate} onChange={(event) => setVoucherDraft({ ...voucherDraft, startDate: event.target.value })} /></label>
                <label>Ends at<input required type="datetime-local" value={voucherDraft.endDate} onChange={(event) => setVoucherDraft({ ...voucherDraft, endDate: event.target.value })} /></label>
                <label>Total claims limit<input required type="number" min="0" step="1" value={voucherDraft.usageLimitPublic} onChange={(event) => setVoucherDraft({ ...voucherDraft, usageLimitPublic: event.target.value })} /><small>Set 0 for unlimited claims.</small></label>
                <label>Claims per customer<input required type="number" min="0" step="1" value={voucherDraft.usageLimitPerUser} onChange={(event) => setVoucherDraft({ ...voucherDraft, usageLimitPerUser: event.target.value })} /><small>Set 0 for unlimited claims.</small></label>
                <label className="voucher-new-customer-option"><input type="checkbox" checked={voucherDraft.newCustomersOnly} onChange={(event) => setVoucherDraft({ ...voucherDraft, newCustomersOnly: event.target.checked })} /><span>New customers only<small>Customers with a previous non-cancelled order cannot claim or use this voucher.</small></span></label>
              </div>
              <fieldset className="voucher-product-scope"><legend>Eligible products</legend><p>Leave all boxes unchecked to apply to every product in the cart. If selected, the discount applies only to the selected products.</p><div>{products.filter((product) => !product.isAddon && product.status === 'available').map((product) => <label key={product._id}><input type="checkbox" checked={voucherDraft.allowedProducts.includes(product._id)} onChange={(event) => setVoucherDraft({ ...voucherDraft, allowedProducts: event.target.checked ? [...voucherDraft.allowedProducts, product._id] : voucherDraft.allowedProducts.filter((id) => id !== product._id) })} />{product.name}</label>)}</div></fieldset>
              <div className="voucher-admin-actions"><button type="submit">{editingVoucherId ? 'Save changes' : 'Create voucher'}</button>{editingVoucherId && <button type="button" className="voucher-cancel" onClick={() => { setEditingVoucherId(null); setVoucherDraft(createVoucherDraft()); setVoucherMessage(''); }}>Cancel edit</button>}</div>
              {voucherMessage && <p className="voucher-admin-message" role="status">{voucherMessage}</p>}
            </form>
            <div className="voucher-admin-list"><div className="voucher-admin-list-heading"><h2>Voucher campaigns</h2><button type="button" onClick={() => apiRequest('/vouchers').then(({ ok, data }) => { if (ok && Array.isArray(data?.payload)) setVouchers(data.payload); })}>Refresh</button></div>
              {vouchers.length ? <div className="voucher-admin-cards">{vouchers.map((template) => <article className="voucher-admin-card" key={template._id}>
                <div className="voucher-admin-card-top"><div><span className="voucher-admin-code">{template.voucher.code}</span><h3>{template.voucher.name}</h3></div><span className={`voucher-state voucher-state-${voucherStatus(template).toLowerCase().replaceAll(' ', '-')}`}>{voucherStatus(template)}</span></div>
                <p>{template.voucher.description}</p><p className="voucher-admin-offer">{template.voucher.discountType === 'percentage' ? `${template.voucher.discountValue}% off` : `₱${Number(template.voucher.discountValue).toLocaleString()} off`} · max ₱{Number(template.voucher.maxDiscountValue).toLocaleString()} · min spend ₱{Number(template.voucher.minOrderValue).toLocaleString()}</p>
                <div className="voucher-admin-meta"><span>Claims {template.usageCountPublic || 0} / {template.usageLimitPublic || '∞'}</span><span>Per customer {template.usageLimitPerUser || '∞'}</span>{template.voucher.newCustomersOnly && <span>New customers only · first order</span>}<span>{new Date(template.startDate).toLocaleDateString()} – {new Date(template.endDate).toLocaleDateString()}</span></div>
                <div className="voucher-admin-card-actions"><button type="button" onClick={() => editVoucher(template)}>Edit</button><button type="button" className="voucher-retire" onClick={() => deleteVoucher(template)}>Retire voucher</button></div>
              </article>)}</div> : <p className="voucher-empty-state">No voucher campaigns created yet.</p>}
            </div>
          </>}

          {activeView === 'products' && <AdminCatalog products={products} draft={productDraft} setDraft={setProductDraft} onCreate={createProduct} editingId={editingProductId} editDraft={productEditDraft} setEditDraft={setProductEditDraft} onEdit={beginProductEdit} onSave={saveProductEdit} onCancel={() => setEditingProductId(null)} onStock={updateStock} onPhaseOut={phaseOutProduct} />}

          {/* Customers Table */}
          {activeView === "orders" && <OrderQueue focusOrder={notificationOrder} orders={orders} loading={ordersLoading} error={ordersError} onRefresh={refreshStaffOrders} onStatus={updateOrderStatus} onPayment={markCashPaymentReceived} />}


          {activeView === 'customers' && <AdminCustomers customers={customers} onUpdate={updateUser} onToggle={toggleUserStatus} onDelete={deleteUser} />}
          {activeView === 'employeeLogs' && <AdminEmployeeLogs logs={employeeLogs} />}
        </section>
      </main>
    </div>
  );
}
