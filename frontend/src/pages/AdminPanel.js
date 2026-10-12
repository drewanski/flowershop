import React, { useState, useEffect, useRef } from "react";
import ApexCharts from "apexcharts";
import "../pages/AdminPanel.css";
import bg from "../assets/background.png";
import logo from "../assets/logo_a.png";
import { useNavigate } from "react-router-dom";

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

  // View states
  const [activeView, setActiveView] = useState("dashboard"); // 'dashboard', 'products', 'customers', 'employeeLogs'

  // Fetch counts
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [resFlowers, resCategories, resCustomers] = await Promise.all([
          fetch("http://localhost:5001/api/flowers/count"),
          fetch("http://localhost:5001/api/flowers/categories/count"),
          fetch("http://localhost:5001/api/users/count")
        ]);

        const dataFlowers = await resFlowers.json();
        const dataCategories = await resCategories.json();
        const dataCustomers = await resCustomers.json();

        setFlowerCount(dataFlowers.count);
        setCategoryCount(dataCategories.count);
        setCustomerCount(dataCustomers.count);
      } catch (err) {
        console.error("Failed to fetch counts:", err);
      }
    };
    fetchCounts();
  }, []);

  // Fetch flowers
  useEffect(() => {
    const fetchFlowers = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/flowers");
        const data = await res.json();
        setFlowers(data);
      } catch (err) {
        console.error("Failed to fetch flowers:", err);
      }
    };
    fetchFlowers();
  }, []);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await fetch("http://localhost:5001/api/users");
        const data = await res.json();
        setCustomers(data);
      } catch (err) {
        console.error("Failed to fetch customers:", err);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch employee logs when view is active
  useEffect(() => {
    if (activeView === "employeeLogs") {
      const fetchEmployeeLogs = async () => {
        try {
          const res = await fetch("http://localhost:5001/api/employeelogs");
          const data = await res.json();
          setEmployeeLogs(data);
        } catch (err) {
          console.error("Failed to fetch employee logs:", err);
        }
      };
      fetchEmployeeLogs();
    }
  }, [activeView]);

  // ApexCharts for dashboard
  useEffect(() => {
    if (activeView === "dashboard") {
      const barOptions = {
        series: [{ name: "Count", data: [9, 7, 5, 4, 2] }],
        chart: { type: "bar", background: "transparent", height: 350, toolbar: { show: false } },
        colors: ["#2962ff", "#d50000", "#2e7d32", "#ff6d00", "#9c27b0"],
        plotOptions: { bar: { distributed: true, borderRadius: 6, columnWidth: "45%" } },
        dataLabels: { enabled: false },
        grid: { borderColor: "#2b3946", yaxis: { lines: { show: true } } },
        xaxis: { categories: ["Laptop", "Phone", "Monitor", "Headphones", "Camera"], labels: { style: { colors: "#aeb6c0" } } },
        yaxis: { labels: { style: { colors: "#aeb6c0" } } },
        tooltip: { theme: "dark" },
      };
      const barChart = new ApexCharts(barChartRef.current, barOptions);
      barChart.render();

      const areaOptions = {
        series: [
          { name: "Purchase Orders", data: [30, 25, 40, 35, 50, 55, 48] },
          { name: "Sales Orders", data: [20, 45, 60, 38, 45, 65, 53] },
        ],
        chart: { type: "area", height: 350, background: "transparent", toolbar: { show: false } },
        colors: ["#2e7d32", "#d50000"],
        dataLabels: { enabled: false },
        stroke: { curve: "smooth", width: 3 },
        fill: { type: "gradient", gradient: { opacityFrom: 0.45, opacityTo: 0.05 } },
        xaxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"], labels: { style: { colors: "#aeb6c0" } } },
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
  }, [activeView]);

  // Update stock
  const updateStock = async (id, stock) => {
    try {
      const res = await fetch(`http://localhost:5001/api/flowers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: Number(stock) }),
      });
      const updated = await res.json();
      setFlowers(flowers.map(f => (f._id === id ? updated : f)));
      alert("Stock updated!");
    } catch (err) {
      console.error("Failed to update stock:", err);
      alert("Error updating stock");
    }
  };

  // Update user
  const updateUser = async (user, newData) => {
    try {
      const res = await fetch(`http://localhost:5001/api/users/${user._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newData),
      });
      const updated = await res.json();
      setCustomers(customers.map(u => (u._id === updated._id ? updated : u)));
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
      await fetch(`http://localhost:5001/api/users/${user._id}`, { method: "DELETE" });
      setCustomers(customers.filter(u => u._id !== user._id));
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
                  <h2>56</h2>
                </div>
              </div>

              <div className="adminpanel-charts">
                <div className="adminpanel-chart">
                  <h2>Tally of Sales</h2>
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
                    <th>Fillers</th>
                    <th>Focal Flowers</th>
                    <th>Update Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {flowers.map(flower => (
                    <tr key={flower._id}>
                      <td><img src={flower.img} alt={flower.name} width={80} /></td>
                      <td>{flower.name}</td>
                      <td>₱ {flower.price.toLocaleString()}</td>
                      <td>{flower.type}</td>
                      <td>{flower.category}</td>
                      <td>{flower.stock}</td>
                      <td>{flower.description}</td>
                      <td>{flower.fillers}</td>
                      <td>{flower.focalFlowers}</td>
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
                    <th>Address</th>
                    <th>Sign-in Method</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(user => (
                    <tr key={user._id}>
                      <td>{user.firstName} {user.lastName}</td>
                      <td>{user.email}</td>
                      <td>{user.phoneNumber}</td>
                      <td>{user.homeAddress}</td>
                      <td>{user.signInMethod}</td>
                      <td>{user.isDisabled ? "Disabled" : "Active"}</td>
                      <td>
                        <button onClick={() => {
                          const firstName = prompt("First Name:", user.firstName) || user.firstName;
                          const lastName = prompt("Last Name:", user.lastName) || user.lastName;
                          const phoneNumber = prompt("Phone Number:", user.phoneNumber) || user.phoneNumber;
                          const homeAddress = prompt("Home Address:", user.homeAddress) || user.homeAddress;
                          updateUser(user, { firstName, lastName, phoneNumber, homeAddress });
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
    const loginTime = log.loginAt ? (log.loginAt.$date ? log.loginAt.$date : log.loginAt) : null;
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
