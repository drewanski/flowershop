import React, { useEffect, useState } from "react";
import { money } from "../storeState";
import CoffeeOptionsEditor from "./CoffeeOptionsEditor";
import AddonRulesEditor from "./AddonRulesEditor";
import "./AdminUserCreator.css";

const icon = (name) => (
  <span className="material-icons-outlined" aria-hidden="true">
    {name}
  </span>
);
function Metrics({ items }) {
  return (
    <div className="admin-data-metrics">
      {items.map(([label, value, symbol]) => (
        <div key={label}>
          {icon(symbol)}
          <span>
            {label}
            <strong>{value}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}
function Search({ value, onChange, label }) {
  return (
    <label className="admin-data-search">
      {icon("search")}
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function EmptyRow({ columns, message }) {
  return (
    <tr>
      <td colSpan={columns}>
        <div className="admin-data-empty">
          {icon("search_off")}
          <strong>{message}</strong>
          <span>Try a different search or filter.</span>
        </div>
      </td>
    </tr>
  );
}
function Pager({ page, total, onChange, size = 10 }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <footer className="admin-data-footer">
      <span>
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total}`
          : "0 records"}
      </span>
      <div>
        <button
          type="button"
          className="admin-secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          type="button"
          className="admin-secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </footer>
  );
}
function useTable(items, query, filter) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [query, filter]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(items.length / 10)));
  return {
    page: safePage,
    setPage,
    visible: items.slice((safePage - 1) * 10, safePage * 10),
  };
}
function Status({ children, muted = false }) {
  return (
    <span className={`admin-status-pill${muted ? " is-muted" : ""}`}>
      {children}
    </span>
  );
}

function ProductFields({ draft, onChange, products, editing = false }) {
  const change = (field, value) => onChange({ ...draft, [field]: value });
  return (
    <>
      <div className="admin-product-form-grid">
        <label>
          Product name
          <input
            required
            maxLength="160"
            placeholder="e.g. House Latte"
            value={draft.name ?? ""}
            onChange={(e) => change("name", e.target.value)}
          />
        </label>
        <label>
          SKU
          <input
            required
            placeholder="e.g. COFFEE-LATTE-001"
            value={draft.sku ?? ""}
            onChange={(e) => change("sku", e.target.value)}
          />
        </label>
        <label>
          Category
          <input
            required
            placeholder="e.g. Signature Coffee"
            value={draft.category ?? ""}
            onChange={(e) => change("category", e.target.value)}
          />
        </label>
        <label>
          Price (PHP)
          <input
            type="number"
            required
            min="0"
            step="0.01"
            placeholder="0.00"
            value={draft.price ?? ""}
            onChange={(e) => change("price", e.target.value)}
          />
        </label>
        <label>
          Stock on hand
          <input
            type="number"
            required
            min="0"
            step="1"
            placeholder="0"
            value={draft.stock ?? ""}
            onChange={(e) => change("stock", e.target.value)}
          />
        </label>
        <label>
          <span>
            Type <small>Optional</small>
          </span>
          <input
            placeholder="e.g. Espresso-based"
            value={draft.type ?? ""}
            onChange={(e) => change("type", e.target.value)}
          />
        </label>
        <label className="admin-field-wide">
          Image URL or asset path
          <input
            required
            placeholder="/images/products/latte.webp"
            value={draft.image ?? ""}
            onChange={(e) => change("image", e.target.value)}
          />
        </label>
        <label className="admin-field-wide">
          Description
          <textarea
            required
            placeholder="Describe the flavor, ingredients and serving style."
            value={draft.description ?? ""}
            onChange={(e) => change("description", e.target.value)}
          />
        </label>
      </div>
      <label className="admin-product-toggle">
        <input
          type="checkbox"
          checked={Boolean(draft.isAddon)}
          onChange={(e) => change("isAddon", e.target.checked)}
        />
        <span>
          Sell as an extra
          <small>An add-on such as oat milk or an espresso shot.</small>
        </span>
      </label>
      {!draft.isAddon && (
        <>
          <CoffeeOptionsEditor
            value={draft.optionGroups || []}
            onChange={(optionGroups) => change("optionGroups", optionGroups)}
          />
          <AddonRulesEditor
            products={products}
            value={editing ? draft.allowedAddons : draft.allowedAddonsJson}
            onChange={(value) =>
              change(editing ? "allowedAddons" : "allowedAddonsJson", value)
            }
          />
        </>
      )}
    </>
  );
}
function StockControl({ product, onStock }) {
  const [value, setValue] = useState(product.stock),
    [busy, setBusy] = useState(false);
  useEffect(() => setValue(product.stock), [product.stock]);
  return (
    <form
      className="admin-stock-control"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onStock(product._id, value);
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        aria-label={`Stock for ${product.name}`}
        type="number"
        required
        min="0"
        step="1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy || Number(value) === Number(product.stock)}
        aria-label={`Save stock for ${product.name}`}
      >
        {icon("check")}
      </button>
    </form>
  );
}
export function AdminCatalog({
  products,
  draft,
  setDraft,
  onCreate,
  editingId,
  editDraft,
  setEditDraft,
  onEdit,
  onSave,
  onCancel,
  onStock,
  onPhaseOut,
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("active"),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false);
  const filtered = products.filter(
    (p) =>
      [p.name, p.sku, p.category]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active"
          ? p.status !== "phased_out"
          : filter === "extras"
            ? p.isAddon && p.status !== "phased_out"
            : filter === "retired"
              ? p.status === "phased_out"
              : !p.isAddon && p.status !== "phased_out")),
  );
  const table = useTable(filtered, query, filter);
  return (
    <div className="admin-data-view">
      <Metrics
        items={[
          [
            "Active products",
            products.filter((p) => p.status !== "phased_out").length,
            "inventory_2",
          ],
          [
            "Coffee & beans",
            products.filter((p) => !p.isAddon && p.status !== "phased_out")
              .length,
            "coffee",
          ],
          [
            "Low stock",
            products.filter(
              (p) => p.status !== "phased_out" && Number(p.stock) <= 5,
            ).length,
            "inventory",
          ],
        ]}
      />
      <section className="admin-data-panel">
        <div className="admin-data-toolbar">
          <div>
            <h2>Your menu, managed.</h2>
            <p>Keep your coffees, extras and inventory up to date.</p>
          </div>
          <button
            className="admin-primary"
            type="button"
            aria-expanded={creating}
            onClick={() => setCreating(!creating)}
          >
            {icon(creating ? "close" : "add")}
            {creating ? "Close form" : "Add product"}
          </button>
        </div>
        {creating && (
          <form
            className="admin-product-editor"
            onSubmit={async (e) => {
              setBusy(true);
              try {
                if (await onCreate(e)) setCreating(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="admin-editor-title">
              <span>NEW MENU ITEM</span>
              <h3>Add coffee or an extra</h3>
              <p>
                Required product details appear first. Add customer choices and
                extras below.
              </p>
            </div>
            <ProductFields
              draft={draft}
              onChange={setDraft}
              products={products}
            />
            <div className="admin-editor-actions">
              <button
                type="button"
                className="admin-secondary"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button className="admin-primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Create product"}
              </button>
            </div>
          </form>
        )}
        <div className="admin-data-filters">
          <Search
            label="Search products or SKU"
            value={query}
            onChange={setQuery}
          />
          <label className="admin-select-filter">
            <span>Show</span>
            <select
              aria-label="Product filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="active">Current menu</option>
              <option value="all">All products</option>
              <option value="coffee">Coffee & beans</option>
              <option value="extras">Extras</option>
              <option value="retired">Phased out</option>
            </select>
          </label>
          <span className="admin-result-count">{filtered.length} items</span>
        </div>
        <div className="admin-data-table-scroll">
          <table className="admin-data-table admin-catalog-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Inventory</th>
                <th>Extras</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length && (
                <EmptyRow columns={6} message="No matching products" />
              )}
              {table.visible.map((product) => (
                <React.Fragment key={product._id}>
                  <tr>
                    <td>
                      <div className="admin-product-cell">
                        <img
                          src={product.image || product.img}
                          alt=""
                          loading="lazy"
                        />
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.sku}</span>
                          <small>
                            {product.isAddon ? "Extra" : "Menu item"}
                            {product.status === "phased_out"
                              ? " · Phased out"
                              : ""}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td className="admin-money">{money(product.price)}</td>
                    <td>
                      <StockControl product={product} onStock={onStock} />
                      <small
                        className={
                          Number(product.stock) <= 5
                            ? "admin-low-stock"
                            : "admin-table-hint"
                        }
                      >
                        {Number(product.stock) === 0
                          ? "Out of stock"
                          : Number(product.stock) <= 5
                            ? "Running low"
                            : "In stock"}
                      </small>
                    </td>
                    <td>{product.allowedAddons?.length || 0} available</td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          className="admin-secondary"
                          type="button"
                          onClick={() => onEdit(product)}
                        >
                          {icon("edit")} Edit
                        </button>
                        {product.status !== "phased_out" && (
                          <button
                            className="admin-danger-text"
                            type="button"
                            onClick={() => onPhaseOut(product)}
                          >
                            Phase out
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingId === product._id && (
                    <tr className="admin-editor-row">
                      <td colSpan="6">
                        <form
                          className="admin-product-editor"
                          onSubmit={async (e) => {
                            setBusy(true);
                            try {
                              await onSave(e, product);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <div className="admin-editor-title">
                            <span>EDIT MENU ITEM</span>
                            <h3>{product.name}</h3>
                          </div>
                          <ProductFields
                            draft={editDraft}
                            onChange={setEditDraft}
                            products={products}
                            editing
                          />
                          <div className="admin-editor-actions">
                            <button
                              className="admin-secondary"
                              type="button"
                              onClick={onCancel}
                            >
                              Cancel
                            </button>
                            <button
                              className="admin-primary"
                              type="submit"
                              disabled={busy}
                            >
                              {busy ? "Saving…" : "Save changes"}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={table.page}
          total={filtered.length}
          onChange={table.setPage}
        />
      </section>
    </div>
  );
}

export function AdminUserCreator({ creatorRole = "manager", onCreate }) {
  const roles =
    creatorRole === "admin"
      ? [
          ["customer", "Customer"],
          ["crew", "Crew"],
          ["delivery", "Delivery"],
          ["manager", "Manager"],
          ["admin", "Administrator"],
        ]
      : [
          ["crew", "Crew"],
          ["delivery", "Delivery"],
        ];
  const initialRole = roles[0][0];
  const [draft, setDraft] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    contactNumber: "",
    username: "",
    email: "",
    password: "",
    homeAddress: "",
    role: initialRole,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(
    () =>
      setDraft((current) => ({
        ...current,
        role: roles.some(([role]) => role === current.role)
          ? current.role
          : initialRole,
      })),
    [creatorRole],
  );
  const change = (field, value) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await onCreate(draft);
      if (result !== false) {
        setDraft({
          firstName: "",
          middleName: "",
          lastName: "",
          contactNumber: "",
          username: "",
          email: "",
          password: "",
          homeAddress: "",
          role: initialRole,
        });
        setMessage(
          "User created successfully. Share the temporary password securely.",
        );
      }
    } catch (error) {
      setMessage(error.message || "Unable to create user.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="admin-data-view admin-data-panel admin-user-creator">
      <div className="admin-data-toolbar">
        <div>
          <h2>Create a user account.</h2>
          <p>
            {creatorRole === "admin"
              ? "Administrators can create any supported account role. If no administrator exists, the backend creates a bootstrap admin at startup and prints its one-time credentials in the server logs."
              : "Managers can create crew and delivery accounts only."}
          </p>
        </div>
        <span className="admin-section-label">NEW ACCOUNT</span>
      </div>
      <form className="admin-customer-editor" onSubmit={submit}>
        <div className="admin-product-form-grid">
          <label>
            Role
            <select
              required
              value={draft.role}
              onChange={(e) => change("role", e.target.value)}
            >
              {roles.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            First name
            <input
              required
              maxLength="50"
              autoComplete="given-name"
              value={draft.firstName}
              onChange={(e) => change("firstName", e.target.value)}
            />
          </label>
          <label>
            Middle name <small>Optional</small>
            <input
              maxLength="50"
              autoComplete="additional-name"
              value={draft.middleName}
              onChange={(e) => change("middleName", e.target.value)}
            />
          </label>
          <label>
            Last name
            <input
              required
              maxLength="50"
              autoComplete="family-name"
              value={draft.lastName}
              onChange={(e) => change("lastName", e.target.value)}
            />
          </label>
          <label>
            Contact number
            <input
              required
              type="tel"
              autoComplete="tel"
              placeholder="09XXXXXXXXX"
              value={draft.contactNumber}
              onChange={(e) => change("contactNumber", e.target.value)}
            />
          </label>
          <label>
            Username
            <input
              required
              minLength="3"
              maxLength="30"
              autoComplete="username"
              value={draft.username}
              onChange={(e) => change("username", e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              value={draft.email}
              onChange={(e) => change("email", e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength="8"
              autoComplete="new-password"
              value={draft.password}
              onChange={(e) => change("password", e.target.value)}
            />
            <small>At least 8 characters</small>
          </label>
          <label className="admin-field-wide">
            Home address <small>Optional</small>
            <input
              maxLength="500"
              autoComplete="street-address"
              value={draft.homeAddress}
              onChange={(e) => change("homeAddress", e.target.value)}
            />
          </label>
        </div>
        {message && (
          <p className="admin-user-create-message" role="status">
            {message}
          </p>
        )}
        <div className="admin-editor-actions">
          <button className="admin-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function AdminCustomers({ customers, onUpdate, onToggle, onDelete }) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [editing, setEditing] = useState(null),
    [draft, setDraft] = useState({}),
    [busy, setBusy] = useState(false);
  const filtered = customers.filter(
    (c) =>
      [c.firstName, c.lastName, c.email, c.contactNumber]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "all" ||
        (filter === "active" ? !c.isDisabled : c.isDisabled)),
  );
  const table = useTable(filtered, query, filter);
  return (
    <div className="admin-data-view">
      <Metrics
        items={[
          ["Customers", customers.length, "groups"],
          [
            "Active accounts",
            customers.filter((c) => !c.isDisabled).length,
            "how_to_reg",
          ],
          [
            "Disabled accounts",
            customers.filter((c) => c.isDisabled).length,
            "person_off",
          ],
        ]}
      />
      <section className="admin-data-panel">
        <div className="admin-data-toolbar">
          <div>
            <h2>A familiar face in every cup.</h2>
            <p>Find customers and manage their account details.</p>
          </div>
          <span className="admin-section-label">CUSTOMER DIRECTORY</span>
        </div>
        <div className="admin-data-filters">
          <Search
            label="Search name, email or phone"
            value={query}
            onChange={setQuery}
          />
          <label className="admin-select-filter">
            <span>Status</span>
            <select
              aria-label="Customer status filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All accounts</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <span className="admin-result-count">
            {filtered.length} customers
          </span>
        </div>
        <div className="admin-data-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact details</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length && (
                <EmptyRow columns={4} message="No matching customers" />
              )}
              {table.visible.map((user) => (
                <React.Fragment key={user._id}>
                  <tr>
                    <td>
                      <div className="admin-customer-cell">
                        <span className="admin-avatar">
                          {(user.firstName?.[0] || "C").toUpperCase()}
                          {(user.lastName?.[0] || "").toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {user.firstName} {user.lastName}
                          </strong>
                          <small>Customer account</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-contact-cell">
                        <span>{user.email}</span>
                        <small>{user.contactNumber || "No phone number"}</small>
                      </div>
                    </td>
                    <td>
                      <Status muted={user.isDisabled}>
                        {user.isDisabled ? "Disabled" : "Active"}
                      </Status>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <button
                          type="button"
                          className="admin-secondary"
                          onClick={() => {
                            setEditing(user._id);
                            setDraft({
                              firstName: user.firstName,
                              lastName: user.lastName,
                              contactNumber: user.contactNumber,
                            });
                          }}
                        >
                          {icon("edit")} Edit
                        </button>
                        <button
                          type="button"
                          className="admin-secondary"
                          onClick={() => onToggle(user)}
                        >
                          {user.isDisabled ? "Enable" : "Disable"}
                        </button>
                        <button
                          type="button"
                          className="admin-danger-text"
                          onClick={() => onDelete(user)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editing === user._id && (
                    <tr className="admin-editor-row">
                      <td colSpan="4">
                        <form
                          className="admin-customer-editor"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setBusy(true);
                            try {
                              const saved = await onUpdate(user, draft);
                              if (saved !== false) setEditing(null);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <h3>Edit customer details</h3>
                          <div className="admin-product-form-grid">
                            {[
                              ["firstName", "First name"],
                              ["lastName", "Last name"],
                              ["contactNumber", "Phone number"],
                            ].map(([field, label]) => (
                              <label key={field}>
                                {label}
                                <input
                                  required
                                  type={
                                    field === "contactNumber" ? "tel" : "text"
                                  }
                                  value={draft[field] || ""}
                                  onChange={(e) =>
                                    setDraft({
                                      ...draft,
                                      [field]: e.target.value,
                                    })
                                  }
                                />
                              </label>
                            ))}
                          </div>
                          <div className="admin-editor-actions">
                            <button
                              className="admin-secondary"
                              type="button"
                              onClick={() => setEditing(null)}
                            >
                              Cancel
                            </button>
                            <button className="admin-primary" disabled={busy}>
                              {busy ? "Saving…" : "Save details"}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={table.page}
          total={filtered.length}
          onChange={table.setPage}
        />
      </section>
    </div>
  );
}

export function AdminEmployeeLogs({ logs }) {
  const [query, setQuery] = useState(""),
    [role, setRole] = useState("all");
  const filtered = logs.filter(
    (log) =>
      [log.email, log.employeeName, log.role, log.type, log.notes]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (role === "all" || (log.role || log.type) === role),
  );
  const table = useTable(filtered, query, role);
  const date = (log) => {
    const value = log.createdAt?.$date || log.createdAt;
    const d = new Date(value);
    return value && !Number.isNaN(d.getTime()) ? d : null;
  };
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
  return (
    <div className="admin-data-view">
      <Metrics
        items={[
          ["Recorded sign-ins", logs.length, "history"],
          [
            "Today",
            logs.filter(
              (log) =>
                date(log)?.toLocaleDateString("en-CA", {
                  timeZone: "Asia/Manila",
                }) === today,
            ).length,
            "today",
          ],
          [
            "Team accounts",
            new Set(logs.map((log) => log.email || log.employeeName)).size,
            "badge",
          ],
        ]}
      />
      <section className="admin-data-panel">
        <div className="admin-data-toolbar">
          <div>
            <h2>Your team's activity.</h2>
            <p>
              Review recorded staff sign-ins. All times are Philippine time.
            </p>
          </div>
          <span className="admin-section-label">ACCESS HISTORY</span>
        </div>
        <div className="admin-data-filters">
          <Search
            label="Search employee or notes"
            value={query}
            onChange={setQuery}
          />
          <label className="admin-select-filter">
            <span>Role</span>
            <select
              aria-label="Employee role filter"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="all">All roles</option>
              {[
                ...new Set(
                  logs.map((log) => log.role || log.type).filter(Boolean),
                ),
              ].map((value) => (
                <option key={value} value={value}>
                  {value === "delivery"
                    ? "Rider"
                    : value.charAt(0).toUpperCase() + value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <span className="admin-result-count">{filtered.length} records</span>
        </div>
        <div className="admin-data-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Signed in · PHT</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length && (
                <EmptyRow columns={4} message="No matching activity" />
              )}
              {table.visible.map((log) => {
                const stamp = date(log);
                return (
                  <tr key={log._id}>
                    <td>
                      <div className="admin-customer-cell">
                        <span className="admin-avatar is-team">
                          {icon("person_outline")}
                        </span>
                        <div>
                          <strong>
                            {log.email ||
                              log.employeeName ||
                              "Unknown employee"}
                          </strong>
                          <small>Staff sign-in</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Status>
                        {(log.role || log.type) === "delivery"
                          ? "Rider"
                          : log.role || log.type || "Staff"}
                      </Status>
                    </td>
                    <td>
                      <div className="admin-contact-cell">
                        <span>
                          {stamp
                            ? stamp.toLocaleDateString("en-PH", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                timeZone: "Asia/Manila",
                              })
                            : "Not recorded"}
                        </span>
                        <small>
                          {stamp
                            ? stamp.toLocaleTimeString("en-PH", {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: "Asia/Manila",
                              })
                            : ""}
                        </small>
                      </div>
                    </td>
                    <td className="admin-log-note">{log.notes || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager
          page={table.page}
          total={filtered.length}
          onChange={table.setPage}
        />
      </section>
    </div>
  );
}
