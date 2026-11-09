const STORAGE_KEY = "spendwise-transactions-v1";
const BUDGET_KEY = "spendwise-monthly-budget-v1";
let transactions = loadTransactions();
let monthlyBudget = Number(localStorage.getItem(BUDGET_KEY)) || 2000;
let editingId = null;

const $ = (id) => document.getElementById(id);
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (date) => date.slice(0, 7);

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
}
function currentMonthTransactions() {
  return transactions.filter(t => monthKey(t.date) === monthKey(today()));
}
function render() {
  const monthItems = currentMonthTransactions();
  const income = monthItems.filter(t => t.type === "income").reduce((s,t) => s + t.amount, 0);
  const expenses = monthItems.filter(t => t.type === "expense").reduce((s,t) => s + t.amount, 0);
  $("balanceAmount").textContent = money(income - expenses);
  $("incomeAmount").textContent = money(income);
  $("expenseAmount").textContent = money(expenses);
  $("budgetSpent").textContent = money(expenses);
  $("budgetLimit").textContent = `of ${money(monthlyBudget)}`;
  const percent = monthlyBudget > 0 ? expenses / monthlyBudget * 100 : 0;
  $("budgetProgress").style.width = `${Math.min(percent, 100)}%`;
  $("budgetProgress").classList.toggle("over", percent > 100);
  $("budgetCaption").textContent = percent > 100
    ? `You are ${money(expenses - monthlyBudget)} over your monthly budget.`
    : `You have ${money(monthlyBudget - expenses)} left in your budget.`;
  renderChart(monthItems.filter(t => t.type === "expense"));
  renderTransactions();
}
function renderChart(expenses) {
  const totals = {};
  expenses.forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const entries = Object.entries(totals).sort((a,b) => b[1] - a[1]);
  const container = $("categoryChart");
  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">Add an expense to see your spending breakdown.</p>';
    return;
  }
  const max = entries[0][1];
  container.innerHTML = entries.map(([name,value]) => `
    <div class="category-line">
      <span class="category-name">${escapeHtml(name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${value / max * 100}%"></div></div>
      <span class="category-value">${money(value)}</span>
    </div>`).join("");
}
function renderTransactions() {
  const query = $("searchInput").value.trim().toLowerCase();
  const type = $("filterType").value;
  const filtered = [...transactions]
    .filter(t => (type === "all" || t.type === type))
    .filter(t => `${t.description} ${t.category}`.toLowerCase().includes(query))
    .sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
  const body = $("transactionRows");
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">${transactions.length ? "No matching transactions." : "No transactions yet. Add your first one to get started."}</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map(t => `<tr>
    <td>${escapeHtml(t.description)}</td><td>${escapeHtml(t.category)}</td>
    <td>${new Date(`${t.date}T12:00:00`).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</td>
    <td><span class="type-pill type-${t.type}">${t.type === "income" ? "Income" : "Expense"}</span></td>
    <td class="align-right ${t.type === "income" ? "amount-income" : "amount-expense"}">${t.type === "income" ? "+" : "−"}${money(t.amount)}</td>
    <td><button class="delete-button" data-delete="${t.id}" aria-label="Delete ${escapeHtml(t.description)}" title="Delete">×</button></td>
  </tr>`).join("");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function openTransaction(transaction = null) {
  editingId = transaction?.id ?? null;
  $("dialogTitle").textContent = transaction ? "Edit transaction" : "Add transaction";
  $("description").value = transaction?.description || "";
  $("amount").value = transaction?.amount ?? "";
  $("type").value = transaction?.type || "expense";
  $("category").value = transaction?.category || "Food";
  $("date").value = transaction?.date || today();
  $("formError").textContent = "";
  $("transactionDialog").showModal();
}
$("openAdd").addEventListener("click", () => openTransaction());
$("closeDialog").addEventListener("click", () => $("transactionDialog").close());
$("transactionForm").addEventListener("submit", event => {
  event.preventDefault();
  const description = $("description").value.trim();
  const amount = Number($("amount").value);
  const date = $("date").value;
  if (!description || !Number.isFinite(amount) || amount <= 0 || !date) {
    $("formError").textContent = "Enter a description, a valid amount, and a date.";
    return;
  }
  const record = { id: editingId ?? Date.now(), description, amount, type: $("type").value, category: $("category").value, date };
  if (editingId !== null) transactions = transactions.map(t => t.id === editingId ? record : t);
  else transactions.push(record);
  save(); render(); $("transactionDialog").close();
});
$("transactionRows").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const id = Number(button.dataset.delete);
  const item = transactions.find(t => t.id === id);
  if (item && confirm(`Delete "${item.description}"?`)) {
    transactions = transactions.filter(t => t.id !== id);
    save(); render();
  }
});
$("searchInput").addEventListener("input", renderTransactions);
$("filterType").addEventListener("change", renderTransactions);
$("editBudget").addEventListener("click", () => {
  $("budgetInput").value = monthlyBudget;
  $("budgetDialog").showModal();
});
$("closeBudget").addEventListener("click", () => $("budgetDialog").close());
$("budgetForm").addEventListener("submit", event => {
  event.preventDefault();
  const value = Number($("budgetInput").value);
  if (!Number.isFinite(value) || value <= 0) return;
  monthlyBudget = value; save(); render(); $("budgetDialog").close();
});
$("todayLabel").textContent = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" }).toUpperCase();
render();
// SpendWise Complete Upgrade
(function(){
  const byId = id => document.getElementById(id);
  const existingRender = renderTransactions;

  renderTransactions = function(){
    existingRender();
    byId("transactionRows").querySelectorAll("tr").forEach(row=>{
      const deleteBtn = row.querySelector("[data-delete]");
      if(!deleteBtn || row.querySelector(".upgrade-edit")) return;
      const edit = document.createElement("button");
      edit.className = "upgrade-edit";
      edit.textContent = "Edit";
      edit.type = "button";
      edit.addEventListener("click", ()=>{
        const item = transactions.find(t => t.id === Number(deleteBtn.dataset.delete));
        if(item) openTransaction(item);
      });
      deleteBtn.before(edit);
    });
  };

  function sixMonthChart(){
    const now = new Date();
    const months = [];
    for(let i=5;i>=0;i--){
      const date = new Date(now.getFullYear(),now.getMonth()-i,1);
      const key = date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0");
      const items = transactions.filter(t => t.date.startsWith(key));
      const sum = type => items.filter(t=>t.type===type).reduce((s,t)=>s+t.amount,0);
      months.push({label:date.toLocaleString("en",{month:"short"}),income:sum("income"),expense:sum("expense")});
    }
    const maximum = Math.max(1,...months.flatMap(m=>[m.income,m.expense]));
    const root = byId("monthlyChart");
    if(!root) return;
    root.innerHTML = months.map(m=>`
      <div class="upgrade-month">
        <div class="upgrade-bars">
          <div class="upgrade-bar upgrade-income" title="Income: ${money(m.income)}" style="height:${Math.max(1,m.income/maximum*100)}%"></div>
          <div class="upgrade-bar upgrade-expense" title="Expenses: ${money(m.expense)}" style="height:${Math.max(1,m.expense/maximum*100)}%"></div>
        </div>
        <span class="upgrade-month-label">${m.label}</span>
      </div>`).join("");
  }

  const originalRender = render;
  render = function(){
    originalRender();
    sixMonthChart();
  };

  function download(name,content,type){
    const blob = new Blob([content],{type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;a.download=name;
    document.body.appendChild(a);
    a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  byId("exportCsv").addEventListener("click",()=>{
    if(!transactions.length){alert("No transactions to export.");return;}
    const safe = value=>{
      let s=String(value);
      if(/^[\s]*[=+\-@]/.test(s)) s="'"+s;
      return '"'+s.replace(/"/g,'""')+'"';
    };
    const rows=[
      ["Description","Amount","Type","Category","Date"],
      ...transactions.map(t=>[t.description,t.amount,t.type,t.category,t.date])
    ];
    const csv=rows.map(row=>row.map(safe).join(",")).join("\r\n");
    download("spendwise-transactions.csv","\uFEFF"+csv,"text/csv;charset=utf-8");
  });

  byId("backupJson").addEventListener("click",()=>{
    const data={version:1,transactions,monthlyBudget};
    download("spendwise-backup.json",JSON.stringify(data,null,2),"application/json");
  });

  byId("restoreJson").addEventListener("click",()=>byId("restoreFile").click());

  byId("restoreFile").addEventListener("change",async event=>{
    const file=event.target.files[0];
    if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      if(!Array.isArray(data.transactions) || !data.transactions.every(t=>
        t && Number.isSafeInteger(t.id) &&
        typeof t.description==="string" && t.description.length<=60 &&
        Number.isFinite(t.amount) && t.amount>0 &&
        ["income","expense"].includes(t.type) &&
        typeof t.category==="string" && t.category.length<=50 &&
        typeof t.date==="string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
      )) throw Error("Invalid transaction records");
      if(!Number.isFinite(data.monthlyBudget) || data.monthlyBudget<=0)
        throw Error("Invalid budget");
      if(!confirm("Replace all current transactions with this backup?")) return;
      transactions=data.transactions;
      monthlyBudget=data.monthlyBudget;
      save();render();
      alert("Backup restored successfully.");
    }catch(e){alert("Could not restore backup: "+e.message);}
    finally{event.target.value="";}
  });

  if(localStorage.getItem("spendwise-dark")==="yes")
    document.body.classList.add("spendwise-dark");

  byId("themeToggle").addEventListener("click",()=>{
    document.body.classList.toggle("spendwise-dark");
    localStorage.setItem("spendwise-dark",document.body.classList.contains("spendwise-dark")?"yes":"no");
  });

  render();
})();
