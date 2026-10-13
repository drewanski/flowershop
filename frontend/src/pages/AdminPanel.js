import React, { useState, useEffect, useRef } from "react";
import ApexCharts from "apexcharts";
import "../pages/AdminPanel.css";
import bg from "../assets/background.png";
import logo from "../assets/logo_a.png";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api";

export default function AdminPanel() {
  const barChartRef = useRef(null);
  const areaChartRef = useRef(null);
const navigate = useNavigate();

  // Counts
  const [flowerCount, setFlowerCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  // Data
  const [flowers, setFlowers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employeeLogs, setEmployeeLogs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [productDraft, setProductDraft] = useState({ sku: '', name: '', description: '', price: '', image: '', category: '', type: '', stock: '' });

  // View states
  const [activeView, setActiveView] = useState("dashboard"); // 'dashboard', 'products', 'customers', 'employeeLogs'

  // Fetch counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const { data } = await apiRequest('/products');
        const items = data?.payload || data || [];
        const products = Array.isArray(items) ? items : [];

        setFlowers(products);
        setFlowerCount(products.length);
        setCategoryCount(new Set(products.map((item) => item.category).filter(Boolean)).size);
        const customersResult = await apiRequest('/admin/customers');
        const customerItems = customersResult.data?.payload || [];
        setCustomers(Array.isArray(customerItems) ? customerItems : []);
        setCustomerCount(Array.isArray(customerItems) ? customerItems.length : 0);
        const ordersResult = await apiRequest('/orders');
        const orderItems = ordersResult.data?.payload || [];
        setOrders(Array.isArray(orderItems) ? orderItems : []);
      } catch (err) {
        console.error('Failed to fetch counts:', err);
      }
    };
    fetchCounts();
  }, []);

  // Fetch flowers
  useEffect(() => {
    const fetchFlowers = async () => {
      try {
        const { data } = await apiRequest('/products');
        const items = data?.payload || data || [];
        setFlowers(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error('Failed to fetch flowers:', err);
      }
    };
    fetchFlowers();
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

  // ApexCharts for dashboard
  useEffect(() => {
    if (activeView === "dashboard") {
      const categories = [...new Set(flowers.map((product) => product.category).filter(Boolean))];
      const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return date;
      });
      const barOptions = {
        series: [{ name: "Products", data: categories.map((category) => flowers.filter((product) => product.category === category).length) }],
        chart: { type: "bar", background: "transparent", height: 350, toolbar: { show: false } },
        colors: ["#2962ff", "#d50000", "#2e7d32", "#ff6d00", "#9c27b0"],
        plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: "45%" } },
        dataLabels: { enabled: false },
        grid: { borderColor: "#2b3946", yaxis: { lines: { show: true } } },
        xaxis: { categories, labels: { style: { colors: "#aeb6c0" } } },
        yaxis: { labels: { style: { colors: "#aeb6c0" } } },
        tooltip: { theme: "dark" },
      };
      const barChart = new ApexCharts(barChartRef.current, barOptions);
      barChart.render();

      const areaOptions = {
        series: [
          { name: "Orders", data: days.map((date) => orders.filter((order) => new Date(order.createdAt).toDateString() === date.toDateString()).length) },
          { name: "Sales", data: days.map((date) => orders.filter((order) => new Date(order.createdAt).toDateString() === date.toDateString()).reduce((sum, order) => sum + (Number(order.grandTotal) || 0), 0)) },
        ],
        chart: { type: "area", height: 350, background: "transparent", toolbar: { show: false } },
        colors: ["#2e7d32", "#d50000"],
        dataLabels: { enabled: false },
        stroke: { curve: "smooth", width: 3 },
        fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0.05 } },
        xaxis: { categories: days.map((date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })), labels: { style: { colors: "#aeb6c0" } } },
        yaxis: { labels: { style: { colors: "#aeb6c0" } } },
        grid: { borderColor: "#2b3946" },
        tooltip: { theme: "dark" },
      };
      const areaChart = new ApexCharts(areaChartRef.current, areaOptions);
      areaChart.render();

      return () => {
        barChart.destroy();
        areaChart.destroy();
      };
    }
  }, [activeView, flowers, orders]);

  // Update stock
  const updateStock = async (id, stock) => {
    try {
      const { ok, data } = await apiRequest(`/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ stock: Number(stock) }),
      });
      if (!ok) throw new Error(data?.message || 'Stock update failed');
      const updated = data?.payload;
      setFlowers(flowers.map(f => (f._id === id ? updated : f)));
      alert("Stock updated!");
    } catch (err) {
      console.error("Failed to update stock:", err);
      alert("Error updating stock");
    }
  };

  const createProduct = async (event) => {
    event.preventDefault();
    try {
      const product = {
        ...productDraft,
        price: Number(productDraft.price),
        stock: Number(productDraft.stock),
      };
      const { ok, data } = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
      if (!ok) throw new Error(data?.message || 'Product creation failed.');
      const created = data.payload;
      setFlowers((current) => [...current, created]);
      setFlowerCount((count) => count + 1);
      setCategoryCount(new Set([...flowers.map((item) => item.category), created.category]).size);
      setProductDraft({ sku: '', name: '', description: '', price: '', image: '', category: '', type: '', stock: '' });
      alert('Product created.');
    } catch (error) {
      alert(error.message || 'Unable to create product.');
    }
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
    } catch (err) {
      console.error(err);
      alert("Error updating user");
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
  // Clear everything related to user/admin session
  localStorage.clear(); // clears all localStorage items, safer for "old admin" reset

  // Redirect to login or landing page
  navigate("/"); // adjust if your login page is different

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
          <li onClick={() => setActiveView("dashboard")} style={{ cursor: "pointer" }}>
            <span className="material-icons-outlined">dashboard</span> Dashboard
          </li>
          <li onClick={() => setActiveView("products")} style={{ cursor: "pointer" }}>
            <span className="material-icons-outlined">inventory_2</span> Products
          </li>
          <li onClick={() => setActiveView("customers")} style={{ cursor: "pointer" }}>
            <span className="material-icons-outlined">groups</span> Customers
          </li>
          <li onClick={() => setActiveView("employeeLogs")} style={{ cursor: "pointer" }}>
            <span className="material-icons-outlined">badge</span> Employee Logs
          </li>
<li style={{ cursor: "pointer" }} onClick={logoutAdmin}>
  <span className="material-icons-outlined">logout</span> Logout
</li>
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
            <span className="material-icons-outlined">search</span>
          </div>
          <div className="adminpanel-header-right">
            <span className="material-icons-outlined">notifications</span>
            <span className="material-icons-outlined">mail</span>
            <span className="material-icons-outlined">account_circle</span>
          </div>
        </header>

        <section className="adminpanel-content">
          <h1>
            {activeView === "dashboard" && "DASHBOARD"}
            {activeView === "products" && "Products Table"}
            {activeView === "customers" && "Customers Table"}
            {activeView === "employeeLogs" && "Employee Logs"}
          </h1>

          {/* Dashboard */}
          {activeView === "dashboard" && (
            <>
              <div className="adminpanel-cards">
                <div className="adminpanel-card blue">
                  <div className="adminpanel-card-header">
                    <h3>PRODUCTS</h3>
                    <span className="material-icons-outlined">inventory_2</span>
                  </div>
                  <h2>{flowerCount}</h2>
                </div>
                <div className="adminpanel-card orange">
                  <div className="adminpanel-card-header">
                    <h3>CATEGORIES</h3>
                    <span className="material-icons-outlined">category</span>
                  </div>
                  <h2>{categoryCount}</h2>
                </div>
                <div className="adminpanel-card green">
                  <div className="adminpanel-card-header">
                    <h3>CUSTOMERS</h3>
                    <span className="material-icons-outlined">groups</span>
                  </div>
                  <h2>{customerCount}</h2>
                </div>
                <div className="adminpanel-card red">
                  <div className="adminpanel-card-header">
                    <h3>ALERTS</h3>
                    <span className="material-icons-outlined">notification_important</span>
                  </div>
                  <h2>{flowers.filter((product) => product.stock <= 5 || product.status === 'out_of_stock').length}</h2>
                </div>
              </div>

              <div className="adminpanel-charts">
                <div className="adminpanel-chart">
                  <h2>Products by Category</h2>
                  <div ref={barChartRef}></div>
                </div>
                <div className="adminpanel-chart">
                  <h2>Purchase and Sales Orders</h2>
                  <div ref={areaChartRef}></div>
                </div>
              </div>
            </>
          )}

          {/* Products Table */}
          {activeView === "products" && (
            <>
            <form className="adminpanel-tables" onSubmit={createProduct}>
              <h2>Add Product</h2>
              <input aria-label="SKU" placeholder="SKU" required value={productDraft.sku} onChange={(event) => setProductDraft({ ...productDraft, sku: event.target.value })} />
              <input aria-label="Name" placeholder="Name" required value={productDraft.name} onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })} />
              <input aria-label="Description" placeholder="Description" required value={productDraft.description} onChange={(event) => setProductDraft({ ...productDraft, description: event.target.value })} />
              <input aria-label="Image URL" placeholder="Image URL" required value={productDraft.image} onChange={(event) => setProductDraft({ ...productDraft, image: event.target.value })} />
              <input aria-label="Category" placeholder="Category" required value={productDraft.category} onChange={(event) => setProductDraft({ ...productDraft, category: event.target.value })} />
              <input aria-label="Type" placeholder="Type" value={productDraft.type} onChange={(event) => setProductDraft({ ...productDraft, type: event.target.value })} />
              <input aria-label="Price" type="number" min="0" step="0.01" placeholder="Price" required value={productDraft.price} onChange={(event) => setProductDraft({ ...productDraft, price: event.target.value })} />
              <input aria-label="Stock" type="number" min="0" step="1" placeholder="Stock" required value={productDraft.stock} onChange={(event) => setProductDraft({ ...productDraft, stock: event.target.value })} />
              <button type="submit">Add Product</button>
            </form>
            <div className="adminpanel-tables">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Price</th>
                    <th>Type</th>
                    <th>Category</th>
                    <th>Stock</th>
                    <th>Description</th>
                    <th>Add-on Rules</th>
                    <th>SKU</th>
                    <th>Update Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {flowers.map(flower => (
                    <tr key={flower._id}>
                      <td><img src={flower.image || flower.img} alt={flower.name} width={80} /></td>
                      <td>{flower.name}</td>
                      <td>₱ {(Number(flower.price) || 0).toLocaleString()}</td>
                      <td>{flower.isAddon ? 'Add-on' : 'Product'}</td>
                      <td>{flower.category}</td>
                      <td>{flower.stock}</td>
                      <td>{flower.description}</td>
                      <td>{flower.allowedAddons?.length || 0}</td>
                      <td>{flower.sku}</td>
                      <td>
                        <div className="update-stock">
                          <input type="number" defaultValue={flower.stock} min="0" id={`stock-${flower._id}`} />
                          <button onClick={() => updateStock(flower._id, document.getElementById(`stock-${flower._id}`).value)}>
                            Update
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Customers Table */}
          {activeView === "customers" && (
            <div className="adminpanel-tables">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(user => (
                    <tr key={user._id}>
                      <td>{user.firstName} {user.lastName}</td>
                      <td>{user.email}</td>
                      <td>{user.contactNumber}</td>
                      <td>{user.isDisabled ? "Disabled" : "Active"}</td>
                      <td>
                        <button onClick={() => {
                          const firstName = prompt("First Name:", user.firstName) || user.firstName;
                          const lastName = prompt("Last Name:", user.lastName) || user.lastName;
                          const contactNumber = prompt("Contact Number:", user.contactNumber) || user.contactNumber;
                          updateUser(user, { firstName, lastName, contactNumber });
                        }}>Edit</button>
                        <button onClick={() => toggleUserStatus(user)}>
                          {user.isDisabled ? "Enable" : "Disable"}
                        </button>
                        <button onClick={() => deleteUser(user)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Employee Logs Table */}
          {activeView === "employeeLogs" && (
            <div className="adminpanel-tables">
              <table>
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Log Type</th>
                    <th>Time</th>
                    <th>Notes</th>
                  </tr>
                </thead>
<tbody>
  {employeeLogs.map(log => {
    // Safely extract the date string from loginAt
    const loginTime = log.createdAt ? (log.createdAt.$date ? log.createdAt.$date : log.createdAt) : null;
    return (
      <tr key={log._id}>
        <td>{log.email || log.employeeName}</td>
        <td>{log.role || log.type}</td>
        <td>{loginTime ? new Date(loginTime).toLocaleString() : "N/A"}</td>
        <td>{log.notes || "-"}</td>
      </tr>
    );
  })}
</tbody>

              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
