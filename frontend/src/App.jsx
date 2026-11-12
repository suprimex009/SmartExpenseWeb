import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Ellipsis,
  Filter,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const COLORS = ["#8df0c2", "#99a8ff", "#ffbd7a", "#f18cae", "#8dd8f2", "#c5a5ff"];
const NAV_ITEMS = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: WalletCards },
  { id: "budgets", label: "Budgets", icon: Target },
  { id: "analytics", label: "Insights", icon: BarChart3 },
];

const money = (value, compact = false) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? "compact" : "standard",
  }).format(Number(value || 0));

const localDateToday = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};
const monthToday = () => localDateToday().slice(0, 7);
const monthName = (value) =>
  new Date(`${value}-02T12:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the API. Check that the backend is running on port 8000.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      message = typeof body.detail === "string" ? body.detail : message;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function useRemoteData(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-[2rem]">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-200">
      <span>{message}</span>
      {onRetry && <button className="font-semibold hover:text-white" onClick={onRetry}>Try again</button>}
    </div>
  );
}

function LoadingPanel({ label = "Loading your finances…" }) {
  return (
    <div className="panel flex min-h-44 items-center justify-center gap-3 text-sm text-muted">
      <span className="spinner" /> {label}
    </div>
  );
}

function EmptyState({ icon: Icon = Sparkles, title, detail }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
      <span className="mb-3 rounded-2xl bg-white/[0.045] p-3 text-mint"><Icon size={20} /></span>
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-muted">{detail}</p>
    </div>
  );
}

function Sidebar({ active, onChange, open, onClose, email, onLogout }) {
  return (
    <>
      {open && <button className="mobile-backdrop lg:hidden" aria-label="Close menu" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="flex items-center justify-between px-6 pb-8 pt-7">
          <div className="flex items-center gap-3">
            <div className="brand-mark"><WalletCards size={21} strokeWidth={2.2} /></div>
            <div>
              <p className="font-display text-[17px] font-extrabold tracking-tight text-white">moneta<span className="text-mint">.</span></p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">Personal finance</p>
            </div>
          </div>
          <button className="icon-button lg:hidden" onClick={onClose} aria-label="Close menu"><X size={18} /></button>
        </div>

        <p className="nav-caption">Workspace</p>
        <nav className="space-y-1 px-3">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { onChange(id); onClose(); }} className={`nav-link ${active === id ? "nav-link-active" : ""}`}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {active === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="mb-3 inline-flex rounded-xl bg-mint/10 p-2 text-mint"><Sparkles size={16} /></span>
            <p className="font-semibold text-white">Small steps add up.</p>
            <p className="mt-1.5 text-xs leading-5 text-slate-400">A clearer view of your money starts with knowing where it goes.</p>
            <button className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-mint hover:text-white" onClick={() => { onChange("analytics"); onClose(); }}>Explore insights <ArrowUpRight size={13} /></button>
          </div>
          <div className="flex items-center gap-3 border-t border-white/[0.07] px-3 pt-5">
            <div className="avatar">S</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">My account</p>
              <p className="truncate text-xs text-slate-500">{email}</p>
            </div>
            <button className="icon-button" onClick={onLogout} aria-label="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenu, onLogout }) {
  const [today] = useState(() => new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long",
  }));
  return (
    <header className="topbar">
      <button className="icon-button lg:hidden" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <div className="hidden items-center gap-2 text-sm text-muted sm:flex"><CalendarDays size={15} />{today}</div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1.5 text-xs text-slate-400 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-mint shadow-glow" /> Local database connected</span>
        <span className="icon-button relative cursor-default" aria-hidden="true"><Bell size={18} /><span className="notification-dot" /></span>
        <button className="button-secondary hidden !min-h-8 !px-2.5 sm:inline-flex" onClick={onLogout}>Sign out</button>
        <div className="avatar avatar-small">S</div>
      </div>
    </header>
  );
}

function MetricCard({ title, value, note, icon: Icon, tone, trend }) {
  return (
    <div className="panel metric-card group">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-slate-400">{title}</p>
        <span className={`metric-icon ${tone}`}><Icon size={18} strokeWidth={1.8} /></span>
      </div>
      <p className="mt-5 font-display text-[1.75rem] font-bold tracking-tight text-white sm:text-[2rem]">{money(value, true)}</p>
      <div className="mt-3 flex items-center gap-2">
        {trend && <span className={`trend-pill ${trend === "up" ? "trend-good" : "trend-neutral"}`}>{trend === "up" ? <TrendingUp size={12} /> : <Clock3 size={12} />} {note}</span>}
        {!trend && <span className="text-xs text-slate-500">{note}</span>}
        {trend && <span className="text-xs text-slate-500">this month</span>}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, prefix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="mb-2 text-xs text-slate-400">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center gap-2 text-xs font-semibold text-white">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          {item.name}: {prefix}{money(item.value)}
        </p>
      ))}
    </div>
  );
}

function DashboardPage({ onNavigate }) {
  const { data: summary, error, loading, refresh } = useRemoteData(
    () => request(`/api/dashboard?month=${monthToday()}`), [],
  );
  const { data: trends, error: trendError, refresh: refreshTrends } = useRemoteData(() => request("/api/analytics?period=last12"), []);
  const chartData = trends?.months?.slice(-7) || [];
  const maxCategory = Math.max(1, ...(summary?.recent_transactions || []).map((item) => item.amount));

  if (loading && !summary) return <LoadingPanel />;
  return (
    <>
      <PageHeading
        eyebrow="YOUR MONEY, IN FOCUS"
        title="Good to see you."
        description="Here’s a thoughtful snapshot of your financial life."
        action={<button className="button-primary" onClick={() => onNavigate("transactions")}><Plus size={16} /> New transaction</button>}
      />
      <ErrorBanner message={error} onRetry={refresh} />
      <ErrorBanner message={trendError} onRetry={refreshTrends} />
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <MetricCard title="Total balance" value={summary?.balance} note="Across all time" icon={WalletCards} tone="tone-mint" />
        <MetricCard title="Income" value={summary?.income} note={`${money(summary?.monthly_income)} this month`} icon={ArrowDownLeft} tone="tone-blue" trend="up" />
        <MetricCard title="Expenses" value={summary?.expenses} note={`${money(summary?.monthly_expenses)} this month`} icon={ArrowUpRight} tone="tone-orange" trend="down" />
        <div className="panel metric-card budget-teaser">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-400">Monthly budget</p>
            <span className="metric-icon tone-violet"><Target size={18} /></span>
          </div>
          {summary?.monthly_budget ? (
            <>
              <div className="mt-5 flex items-baseline gap-1.5"><span className="font-display text-[1.75rem] font-bold text-white">{Math.min(100, Math.round((summary.monthly_expenses / summary.monthly_budget) * 100))}%</span><span className="text-xs text-slate-500">used</span></div>
              <div className="progress-track mt-3"><span className="progress-fill" style={{ width: `${Math.min(100, (summary.monthly_expenses / summary.monthly_budget) * 100)}%` }} /></div>
              <button onClick={() => onNavigate("budgets")} className="mt-3 text-xs font-semibold text-mint hover:text-white">View budget <ArrowRight size={13} className="ml-1 inline" /></button>
            </>
          ) : (
            <>
              <p className="mt-5 font-display text-xl font-bold text-white">A plan for this month?</p>
              <button onClick={() => onNavigate("budgets")} className="mt-2 text-xs font-semibold text-mint hover:text-white">Set a budget <ArrowRight size={13} className="ml-1 inline" /></button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <section className="panel p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><p className="section-title">Cash flow</p><p className="mt-1 text-xs text-slate-500">Income & spending over the last months</p></div>
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-xs text-slate-400">Last 7 months <ChevronDown size={13} /></span>
          </div>
          {chartData.length ? (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8df0c2" stopOpacity={0.24} /><stop offset="100%" stopColor="#8df0c2" stopOpacity={0} /></linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#99a8ff" stopOpacity={0.18} /><stop offset="100%" stopColor="#99a8ff" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(value) => value.slice(5)} tickLine={false} axisLine={false} tick={{ fill: "#738097", fontSize: 11 }} dy={9} />
                  <YAxis tickFormatter={(value) => money(value, true)} tickLine={false} axisLine={false} tick={{ fill: "#738097", fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#8df0c2" strokeWidth={2.5} fill="url(#incomeFill)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#99a8ff" strokeWidth={2.5} fill="url(#expenseFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState title="Your cash flow will appear here" detail="Add a few transactions to reveal your monthly patterns." />}
          <div className="mt-2 flex items-center gap-5 text-xs text-slate-400">
            <span className="inline-flex items-center gap-2"><i className="legend-dot bg-mint" />Income</span>
            <span className="inline-flex items-center gap-2"><i className="legend-dot bg-indigo-300" />Expenses</span>
          </div>
        </section>

        <section className="panel p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><p className="section-title">Recent activity</p><p className="mt-1 text-xs text-slate-500">Your latest transactions</p></div>
            <button onClick={() => onNavigate("transactions")} className="text-xs font-semibold text-mint hover:text-white">See all <ArrowRight size={13} className="ml-1 inline" /></button>
          </div>
          {summary?.recent_transactions?.length ? (
            <div className="space-y-1">
              {summary.recent_transactions.slice(0, 6).map((transaction) => (
                <TransactionLine key={transaction.id} item={transaction} max={maxCategory} />
              ))}
            </div>
          ) : <EmptyState icon={WalletCards} title="Nothing here yet" detail="Your transactions will show up as soon as you add one." />}
        </section>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint/10 bg-mint/[0.035] px-5 py-4">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-mint/10 p-2 text-mint"><Sparkles size={17} /></span><div><p className="text-sm font-semibold text-white">A little clarity goes a long way.</p><p className="mt-0.5 text-xs text-slate-400">Your activity stays in your local SQLite database.</p></div></div>
        <button onClick={() => { refresh(); refreshTrends(); }} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 transition hover:text-mint"><Clock3 size={14} /> Refresh overview</button>
      </div>
    </>
  );
}

function TransactionLine({ item, max = 1, compact = false, onEdit }) {
  const expense = item.transaction_type === "Expense";
  const categoryIcons = { Food: "🍵", Travel: "✈️", Shopping: "🛍️", Bills: "⌂", Salary: "↗", Health: "✚" };
  return (
    <div className={`transaction-line group ${compact ? "transaction-line-compact" : ""}`}>
      <span className={`transaction-symbol ${expense ? "symbol-expense" : "symbol-income"}`}>{categoryIcons[item.category] || (expense ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-slate-100">{item.description || item.category}</p><span className="hidden rounded-md bg-white/[0.045] px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">{item.category}</span></div>
        <p className="mt-1 text-[11px] text-slate-500">{new Date(`${item.transaction_date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {item.transaction_type}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-semibold ${expense ? "text-slate-100" : "text-mint"}`}>{expense ? "−" : "+"}{money(item.amount)}</p>
        {!compact && <div className="mt-1 flex justify-end"><span className="h-1 w-14 overflow-hidden rounded-full bg-white/[0.06]"><span className={`block h-full rounded-full ${expense ? "bg-orange-300/70" : "bg-mint/70"}`} style={{ width: `${Math.min(100, (item.amount / max) * 100)}%` }} /></span></div>}
      </div>
      {onEdit && <button onClick={() => onEdit(item)} className="icon-button ml-1 opacity-0 transition group-hover:opacity-100" aria-label="Edit transaction"><Ellipsis size={17} /></button>}
    </div>
  );
}

const emptyForm = () => ({
  transaction_type: "Expense",
  category: "Food",
  amount: "",
  transaction_date: localDateToday(),
  description: "",
});

function TransactionModal({ item, categories, onClose, onSaved }) {
  const [form, setForm] = useState(() => item ? {
    transaction_type: item.transaction_type,
    category: item.category,
    amount: String(item.amount),
    transaction_date: item.transaction_date,
    description: item.description || "",
  } : emptyForm());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    if (!form.transaction_date || Number.isNaN(Date.parse(form.transaction_date))) {
      setError("Choose a valid transaction date.");
      return;
    }
    if (!form.category.trim()) {
      setError("Choose or enter a category.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, amount, category: form.category.trim(), description: form.description.trim() || null };
      await request(item ? `/api/transactions/${item.id}` : "/api/transactions", {
        method: item ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal-card" onSubmit={submit}>
        <div className="mb-6 flex items-start justify-between">
          <div><p className="eyebrow mb-1">YOUR MONEY, YOUR WAY</p><h2 className="font-display text-xl font-bold text-white">{item ? "Edit transaction" : "Add transaction"}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-1">
          {["Expense", "Income"].map((kind) => <button key={kind} type="button" className={`type-toggle ${form.transaction_type === kind ? (kind === "Expense" ? "type-expense" : "type-income") : ""}`} onClick={() => update("transaction_type", kind)}>{kind}</button>)}
        </div>
        <label className="field-label">Amount</label>
        <div className="amount-input mb-4"><span>₹</span><input autoFocus type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={(event) => update("amount", event.target.value)} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="transaction-category">Category</label><input id="transaction-category" className="field-input" list="category-options" maxLength="100" value={form.category} onChange={(event) => update("category", event.target.value)} required /><datalist id="category-options">{categories.map((category) => <option key={category} value={category} />)}</datalist></div>
          <div><label className="field-label" htmlFor="transaction-date">Date</label><input id="transaction-date" className="field-input" type="date" value={form.transaction_date} onChange={(event) => update("transaction_date", event.target.value)} required /></div>
        </div>
        <div className="mt-4"><label className="field-label" htmlFor="transaction-note">Description <span className="font-normal text-slate-500">(optional)</span></label><input id="transaction-note" className="field-input" maxLength="500" placeholder="What was this for?" value={form.description} onChange={(event) => update("description", event.target.value)} /></div>
        {error && <p className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/[0.08] px-3 py-2 text-sm text-rose-200">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary" disabled={saving}>{saving ? "Saving…" : item ? "Save changes" : "Add transaction"}</button></div>
      </form>
    </div>
  );
}

function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [transactionType, setTransactionType] = useState("All");
  const [category, setCategory] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [modalItem, setModalItem] = useState(undefined);
  const [toast, setToast] = useState("");
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (transactionType !== "All") params.set("transaction_type", transactionType);
    if (category !== "All") params.set("category", category);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    return params.toString();
  }, [search, transactionType, category, startDate, endDate]);
  const { data, error, loading, refresh, setData } = useRemoteData(
    () => request(`/api/transactions?${query}`), [query],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function saveAndRefresh() {
    await refresh();
    setToast("Transaction saved");
  }
  async function remove(item) {
    if (!window.confirm(`Delete “${item.description || item.category}”? This cannot be undone.`)) return;
    try {
      await request(`/api/transactions/${item.id}`, { method: "DELETE" });
      setData((current) => current ? { ...current, items: current.items.filter((row) => row.id !== item.id), total: current.total - 1 } : current);
      setToast("Transaction deleted");
    } catch (deleteError) {
      setToast(deleteError.message);
    }
  }
  async function exportCsv() {
    try {
      const response = await fetch(`${API_BASE}/api/transactions/export.csv${query ? `?${query}` : ""}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("CSV export failed. Please try again.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions-${monthToday()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setToast("CSV export downloaded");
    } catch (exportError) {
      setToast(exportError.message);
    }
  }

  return (
    <>
      <PageHeading eyebrow="THE DETAILS" title="Transactions" description="Every little thing, thoughtfully organized." action={<button className="button-primary" onClick={() => setModalItem(null)}><Plus size={16} /> Add transaction</button>} />
      <ErrorBanner message={error} onRetry={refresh} />
      <section className="panel mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="search-field flex-1"><Search size={17} /><input placeholder="Search descriptions, categories, dates…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <label className="filter-control"><Filter size={14} /><select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}><option>All</option><option>Expense</option><option>Income</option></select><ChevronDown size={13} /></label>
            <label className="filter-control"><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="All">All categories</option>{data?.categories?.map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={13} /></label>
            <label className="date-filter"><CalendarDays size={14} /><input aria-label="Start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <label className="date-filter"><span className="text-slate-600">to</span><input aria-label="End date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
            <button className="button-secondary !px-3" title="Export filtered CSV" onClick={exportCsv}><Download size={16} /><span className="hidden sm:inline">Export</span></button>
          </div>
        </div>
      </section>
      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.055] px-5 py-4">
          <div><p className="section-title">All activity</p><p className="mt-1 text-xs text-slate-500">{loading ? "Updating…" : `${data?.total ?? 0} transactions`}</p></div>
          <button className="icon-button" title="Refresh transactions" onClick={refresh}><Clock3 size={16} /></button>
        </div>
        {loading && !data ? <LoadingPanel /> : !data?.items?.length ? <EmptyState icon={Search} title="No transactions found" detail="Try changing your search or filters, or add your first transaction." /> : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="transaction-table w-full">
                <thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Type</th><th className="text-right">Amount</th><th /></tr></thead>
                <tbody>{data.items.map((item) => <tr key={item.id}>
                  <td><div className="flex items-center gap-3"><span className={`transaction-symbol ${item.transaction_type === "Expense" ? "symbol-expense" : "symbol-income"}`}>{item.transaction_type === "Expense" ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}</span><div><p className="font-semibold text-slate-100">{item.description || item.category}</p><p className="mt-0.5 text-xs text-slate-500">ID #{item.id}</p></div></div></td>
                  <td><span className="category-chip">{item.category}</span></td>
                  <td className="text-slate-400">{new Date(`${item.transaction_date}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td><span className={`type-chip ${item.transaction_type === "Expense" ? "type-chip-expense" : "type-chip-income"}`}>{item.transaction_type}</span></td>
                  <td className={`text-right font-semibold ${item.transaction_type === "Expense" ? "text-white" : "text-mint"}`}>{item.transaction_type === "Expense" ? "−" : "+"}{money(item.amount)}</td>
                  <td><div className="flex justify-end gap-1"><button className="icon-button" onClick={() => setModalItem(item)} title="Edit"><Settings2 size={15} /></button><button className="icon-button hover:!text-rose-300" onClick={() => remove(item)} title="Delete"><X size={15} /></button></div></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="divide-y divide-white/[0.045] px-4 md:hidden">{data.items.map((item) => <div key={item.id} className="py-1"><TransactionLine item={item} compact /><div className="-mt-2 mb-2 flex justify-end gap-1"><button className="icon-button" onClick={() => setModalItem(item)} title="Edit"><Settings2 size={15} /></button><button className="icon-button hover:!text-rose-300" onClick={() => remove(item)} title="Delete"><X size={15} /></button></div></div>)}</div>
          </>
        )}
      </section>
      {toast && <div className="toast"><Check size={15} />{toast}</div>}
      {modalItem !== undefined && <TransactionModal item={modalItem} categories={data?.categories || []} onClose={() => setModalItem(undefined)} onSaved={saveAndRefresh} />}
    </>
  );
}

function BudgetPage() {
  const [month, setMonth] = useState(monthToday);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { data, error, loading, refresh } = useRemoteData(
    () => request(`/api/budgets?month=${month}`), [month],
  );
  useEffect(() => setAmount(data?.budget ? String(data.budget) : ""), [data]);
  function shiftMonth(delta) {
    const [year, value] = month.split("-").map(Number);
    const shifted = new Date(year, value - 1 + delta, 1);
    setMonth(`${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`);
    setMessage("");
  }
  async function save(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setErrorMessage("Enter a budget amount greater than zero.");
      return;
    }
    setErrorMessage("");
    try {
      await request(`/api/budgets/${month}`, { method: "PUT", body: JSON.stringify({ amount: value }) });
      setMessage("Budget saved successfully.");
      await refresh();
    } catch (saveError) {
      setErrorMessage(saveError.message);
    }
  }
  const progress = data?.progress || 0;
  const progressColor = progress >= 1 ? "bg-rose-300" : progress >= 0.8 ? "bg-orange-300" : "bg-mint";
  return (
    <>
      <PageHeading eyebrow="MAKE ROOM FOR WHAT MATTERS" title="Monthly budgets" description="Set a gentle limit and keep your goals in sight." />
      <ErrorBanner message={error} onRetry={refresh} />
      <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 sm:px-5">
        <button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={19} /></button>
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Your plan for</p><p className="mt-1 font-display text-lg font-bold text-white">{monthName(month)}</p></div>
        <button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={19} /></button>
      </div>
      {loading && !data ? <LoadingPanel /> : (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
          <section className="panel p-6 sm:p-8">
            <div className="flex items-start justify-between"><div><p className="section-title">Your spending plan</p><p className="mt-1 text-sm text-slate-500">Give your money a little direction.</p></div><span className="metric-icon tone-mint"><Target size={19} /></span></div>
            <form onSubmit={save} className="mt-7">
              <label className="field-label" htmlFor="monthly-budget">Monthly spending limit</label>
              <div className="amount-input max-w-md"><span>₹</span><input id="monthly-budget" type="number" min="0.01" step="0.01" placeholder="Set your budget" value={amount} onChange={(event) => setAmount(event.target.value)} /></div>
              {errorMessage && <p className="mt-3 text-sm text-rose-200">{errorMessage}</p>}
              {message && <p className="mt-3 text-sm text-mint">{message}</p>}
              <button className="button-primary mt-4" type="submit"><Check size={16} /> Save budget</button>
            </form>
            <div className="mt-9 border-t border-white/[0.07] pt-6">
              <div className="mb-3 flex items-end justify-between"><div><p className="text-sm font-semibold text-white">Budget used</p><p className="mt-1 text-xs text-slate-500">{Math.round(progress * 100)}% of your plan</p></div><p className="font-display text-2xl font-bold text-white">{money(data?.spent)}</p></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
              <div className="mt-3 flex justify-between text-xs text-slate-500"><span>₹0</span><span>{data?.budget ? money(data.budget) : "No budget set"}</span></div>
            </div>
          </section>
          <section className="panel flex flex-col p-6 sm:p-8">
            <span className="mb-5 inline-flex w-fit rounded-2xl bg-mint/10 p-3 text-mint"><Gauge size={22} /></span>
            <p className="font-display text-xl font-bold text-white">{!data?.budget ? "Start with a simple goal." : progress >= 1 ? "You’ve reached your budget." : progress >= 0.8 ? "You’re getting close." : "You’re right on track."}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{!data?.budget ? "Choose an amount that feels comfortable. You can adjust it any time." : data.remaining >= 0 ? `${money(data.remaining)} left to spend this month. Keep checking in as you go.` : `You've spent ${money(Math.abs(data.remaining))} beyond your monthly plan so far.`}</p>
            <div className="mt-auto pt-8"><div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4"><span className="rounded-lg bg-indigo-300/10 p-2 text-indigo-200"><Sparkles size={15} /></span><p className="text-xs leading-5 text-slate-400">Budgets are a guide, not a judgment. Make room for the things that matter.</p></div></div>
          </section>
        </div>
      )}
    </>
  );
}

function AnalyticsPage() {
  const [period, setPeriod] = useState("all");
  const periodLabel = { all: "All time", last12: "Last 12 months", year: "This year" }[period];
  const { data, error, loading, refresh } = useRemoteData(
    () => request(`/api/analytics?period=${period}`), [period],
  );
  const categories = data?.categories || [];
  const monthly = data?.months || [];
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
  const topCategory = categories[0];
  return (
    <>
      <PageHeading eyebrow="PATTERNS, NOT PRESSURE" title="Your insights" description="Notice the patterns. Make the next move yours." action={<label className="filter-control"><CalendarDays size={15} /><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">All time</option><option value="last12">Last 12 months</option><option value="year">This year</option></select><ChevronDown size={13} /></label>} />
      <ErrorBanner message={error} onRetry={refresh} />
      {loading && !data ? <LoadingPanel /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="panel p-5"><p className="text-xs font-semibold uppercase tracking-[.13em] text-slate-500">Tracked period</p><p className="mt-3 font-display text-xl font-bold text-white">{periodLabel}</p><p className="mt-1 text-xs text-slate-500">{monthly.length} active months</p></div>
            <div className="panel p-5"><p className="text-xs font-semibold uppercase tracking-[.13em] text-slate-500">Total expenses</p><p className="mt-3 font-display text-xl font-bold text-white">{money(total, true)}</p><p className="mt-1 text-xs text-slate-500">Across {categories.length} categories</p></div>
            <div className="panel p-5"><p className="text-xs font-semibold uppercase tracking-[.13em] text-slate-500">Top category</p><p className="mt-3 truncate font-display text-xl font-bold text-white">{topCategory?.category || "—"}</p><p className="mt-1 text-xs text-slate-500">{topCategory ? `${money(topCategory.amount)} in ${periodLabel.toLowerCase()}` : "No expense data yet"}</p></div>
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.4fr]">
            <section className="panel p-5 sm:p-6">
              <div className="mb-2"><p className="section-title">Spending by category</p><p className="mt-1 text-xs text-slate-500">Where your expenses find their way</p></div>
              {categories.length ? (
                <>
                  <div className="relative h-[260px]">
                    <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="amount" nameKey="category" innerRadius={72} outerRadius={103} paddingAngle={4} stroke="none">{categories.map((item, index) => <Cell key={item.category} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => money(value)} contentStyle={{ background: "#151e2f", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, color: "#fff" }} /></PieChart></ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] uppercase tracking-[.16em] text-slate-500">Spent</span><span className="mt-1 font-display text-xl font-bold text-white">{money(total, true)}</span></div>
                  </div>
                  <div className="mt-2 space-y-3">{categories.slice(0, 5).map((item, index) => <div key={item.category} className="flex items-center gap-2 text-xs"><i className="legend-dot" style={{ background: COLORS[index % COLORS.length] }} /><span className="flex-1 text-slate-300">{item.category}</span><span className="font-semibold text-white">{money(item.amount)}</span><span className="w-10 text-right text-slate-500">{total ? Math.round((item.amount / total) * 100) : 0}%</span></div>)}</div>
                </>
              ) : <EmptyState title="No expenses to break down" detail="Add expense transactions to see your spending mix." />}
            </section>
            <section className="panel p-5 sm:p-6">
              <div className="mb-5"><p className="section-title">Income & expenses</p><p className="mt-1 text-xs text-slate-500">A monthly view of your money in and out</p></div>
              {monthly.length ? <div className="h-[370px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthly} margin={{ top: 10, right: 5, left: -14, bottom: 16 }} barGap={5}><CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} /><XAxis dataKey="month" tickFormatter={(value) => value.slice(2)} tickLine={false} axisLine={false} tick={{ fill: "#738097", fontSize: 10 }} angle={-30} textAnchor="end" /><YAxis tickFormatter={(value) => money(value, true)} tickLine={false} axisLine={false} tick={{ fill: "#738097", fontSize: 10 }} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="income" name="Income" fill="#8df0c2" radius={[5, 5, 0, 0]} maxBarSize={24} /><Bar dataKey="expenses" name="Expenses" fill="#99a8ff" radius={[5, 5, 0, 0]} maxBarSize={24} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No monthly activity yet" detail="Your income and spending comparisons will appear here." />}
              <div className="mt-1 flex items-center gap-5 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><i className="legend-dot bg-mint" />Income</span><span className="inline-flex items-center gap-2"><i className="legend-dot bg-indigo-300" />Expenses</span></div>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function AuthScreen({ onAuthenticated, backendStatus, initialError }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(initialError || "");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    if (mode === "register" && password.length < 12) {
      setError("Choose a password with at least 12 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const account = await request(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onAuthenticated(account);
    } catch (authError) {
      setError(authError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <header className="auth-brand">
        <div className="brand-mark"><WalletCards size={21} strokeWidth={2.2} /></div>
        <div><p className="font-display text-[17px] font-extrabold tracking-tight text-white">moneta<span className="text-mint">.</span></p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-[.2em] text-slate-500">Personal finance</p></div>
      </header>
      <main className="auth-card">
        <span className="mb-5 inline-flex rounded-xl border border-mint/10 bg-mint/[0.07] p-2.5 text-mint"><Sparkles size={18} /></span>
        <p className="eyebrow mb-2">A LITTLE MORE CLARITY</p>
        <h1 className="font-display text-[27px] font-bold tracking-tight text-white">{mode === "register" ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{mode === "register" ? "Your finances stay private to your account." : "Sign in to your private financial space."}</p>
        {backendStatus === "offline" && <div className="mt-5 rounded-xl border border-orange-300/20 bg-orange-300/[0.06] px-3 py-2.5 text-sm text-orange-100">{initialError || "The secure API is unavailable. Please try again later."}</div>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-3 py-2.5 text-sm text-rose-200">{error}</div>}
        <form className="mt-6" onSubmit={submit}>
          <label className="field-label" htmlFor="account-email">Email address</label>
          <input className="field-input" id="account-email" type="email" autoComplete="email" maxLength="254" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          <label className="field-label mt-4" htmlFor="account-password">Password</label>
          <input className="field-input" id="account-password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 12 : 1} maxLength="128" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 12 characters" : "Your password"} required />
          {mode === "register" && <>
            <label className="field-label mt-4" htmlFor="account-confirm">Confirm password</label>
            <input className="field-input" id="account-confirm" type="password" autoComplete="new-password" minLength="12" maxLength="128" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter your password again" required />
          </>}
          <button type="submit" className="button-primary mt-6 w-full" disabled={submitting || backendStatus === "offline"}>{submitting ? "Please wait…" : mode === "register" ? "Create private account" : "Sign in"}<ArrowRight size={15} /></button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">{mode === "register" ? "Already have an account?" : "New to Moneta?"} <button className="font-semibold text-mint hover:text-white" onClick={() => { setError(""); setMode(mode === "register" ? "login" : "register"); }}>{mode === "register" ? "Sign in" : "Create an account"}</button></p>
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-white/[0.055] bg-white/[0.02] p-3 text-[11px] leading-5 text-slate-500"><CircleHelp size={15} className="mt-0.5 shrink-0 text-mint/80" />Each account has separate transactions, budgets, and analytics. Never reuse another person’s password.</div>
      </main>
      <p className="auth-footer">Private by design · your financial data belongs to you.</p>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let activeEffect = true;
    async function checkSession() {
      try {
        await request("/api/health");
        const account = await request("/api/auth/me");
        if (activeEffect) {
          setCurrentUser(account);
          setBackendStatus("connected");
        }
      } catch (error) {
        if (activeEffect) {
          if (error.status === 401) {
            setBackendStatus("connected");
          } else {
            setBackendStatus("offline");
            setAuthError(error.message);
          }
        }
      } finally {
        if (activeEffect) setAuthChecked(true);
      }
    }
    checkSession();
    return () => { activeEffect = false; };
  }, []);

  async function signOut() {
    setAuthError("");
    try {
      await request("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setActive("dashboard");
    } catch (error) {
      setAuthError(error.message);
    }
  }

  if (!authChecked) return <div className="min-h-screen bg-canvas p-6"><LoadingPanel label="Opening your private space…" /></div>;
  if (!currentUser) {
    return <AuthScreen backendStatus={backendStatus} initialError={authError} onAuthenticated={(account) => { setCurrentUser(account); setBackendStatus("connected"); setAuthError(""); }} />;
  }

  const page = {
    dashboard: <DashboardPage onNavigate={setActive} />,
    transactions: <TransactionsPage />,
    budgets: <BudgetPage />,
    analytics: <AnalyticsPage />,
  }[active];

  return (
    <div className="min-h-screen bg-canvas text-white">
      <Sidebar active={active} onChange={setActive} open={menuOpen} onClose={() => setMenuOpen(false)} email={currentUser.email} onLogout={signOut} />
      <div className="app-content">
        <TopBar onMenu={() => setMenuOpen(true)} onLogout={signOut} />
        <main className="page-content animate-page" key={active}>
          {backendStatus === "offline" && <div className="mb-5 flex items-center gap-2 rounded-xl border border-orange-300/20 bg-orange-300/[0.06] px-4 py-3 text-sm text-orange-100"><CircleHelp size={16} /> Backend is offline or the database is unavailable. Start the FastAPI server and refresh.</div>}
          {authError && <ErrorBanner message={authError} />}
          {page}
          <footer className="mt-9 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.055] py-5 text-[11px] text-slate-600"><span>MONETA · A little more clarity, every day.</span><span>Private by design · Your data stays on this device.</span></footer>
        </main>
      </div>
    </div>
  );
}
