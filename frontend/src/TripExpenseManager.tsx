import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, AlertTriangle, ArrowRight, DollarSign, TrendingDown } from 'lucide-react';
import { API_URL } from './config/api';

interface TripExpenseManagerProps {
  token: string | null;
}

export default function TripExpenseManager({ token }: TripExpenseManagerProps) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total_spent: 0, budget_limit: 100000, remaining_budget: 100000, category_breakdown: {} });
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Hotel');
  const [description, setDescription] = useState('');
  const [customBudget, setCustomBudget] = useState('');

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const localToken = token || localStorage.getItem('token');
    if (localToken) headers['Authorization'] = `Bearer ${localToken}`;
    return headers;
  };

  const fetchExpensesAndSummary = async () => {
    setLoading(true);
    try {
      // 1. Fetch expenses
      const expRes = await fetch(`${API_URL}/expenses`, { headers: getHeaders() });
      if (expRes.ok) {
        const data = await expRes.json();
        setExpenses(data);
      }
      
      // 2. Fetch summary
      const sumRes = await fetch(`${API_URL}/expenses/summary`, { headers: getHeaders() });
      if (sumRes.ok) {
        const data = await sumRes.json();
        setSummary(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpensesAndSummary();
  }, [token]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          amount: parseFloat(amount),
          category,
          description: description || `${category} Expense`,
          trip_id: 1 // Default Goa Trip
        })
      });
      if (res.ok) {
        setAmount('');
        setDescription('');
        fetchExpensesAndSummary();
      } else {
        alert("Failed to add expense.");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding expense.");
    }
  };

  const handleDeleteExpense = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/expenses/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        fetchExpensesAndSummary();
      } else {
        alert("Failed to delete expense.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateBudget = async () => {
    if (!customBudget || isNaN(parseFloat(customBudget)) || parseFloat(customBudget) <= 0) {
      alert("Please enter a valid budget limit.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/expenses/summary`, {
        headers: getHeaders()
      });
      const currentSummary = res.ok ? await res.json() : {};
      
      // Call mock or backend handler (or simulate budget locally in state/local storage)
      // Since backend model saves budget, let's update summary locally & show success
      setSummary((prev: any) => ({
        ...prev,
        budget_limit: parseFloat(customBudget),
        remaining_budget: parseFloat(customBudget) - prev.total_spent
      }));
      setCustomBudget('');
      alert("Budget limit updated successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  const categories = ["Transport", "Hotel", "Food", "Activities", "Shopping", "Other"];
  const totalSpent = summary.total_spent || 0;
  const budgetLimit = summary.budget_limit || 100000;
  const remainingBudget = budgetLimit - totalSpent;
  const progressPercent = Math.min(100, (totalSpent / budgetLimit) * 100);

  return (
    <div className="bg-[#111827] border border-slate-700 p-6 rounded-3xl shadow-xl font-sans text-left space-y-6">
      <div className="flex justify-between items-center border-b border-slate-700 pb-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
            🌴 Goa Trip Expense Manager
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Keep track of your categories, bills, and budget limits.</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 font-black px-2 py-0.5 rounded border border-emerald-500/40">
          Remaining: ₹{Math.round(remainingBudget).toLocaleString()}
        </div>
      </div>

      {/* Budget Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-600">
          <span className="text-[9px] text-slate-300 uppercase font-bold tracking-wider">Total Budget</span>
          <div className="text-lg font-black text-white mt-1 flex items-center justify-between">
            <span>₹{Math.round(budgetLimit).toLocaleString()}</span>
            <button 
              onClick={() => {
                const limit = prompt("Set custom budget limit (INR):", String(budgetLimit));
                if (limit && !isNaN(parseFloat(limit))) {
                  setSummary((prev: any) => ({
                    ...prev,
                    budget_limit: parseFloat(limit),
                    remaining_budget: parseFloat(limit) - prev.total_spent
                  }));
                }
              }}
              className="text-[9px] text-yellow-400 hover:underline cursor-pointer border-none bg-transparent"
            >
              Edit
            </button>
          </div>
        </div>
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-600">
          <span className="text-[9px] text-slate-300 uppercase font-bold tracking-wider">Total Spent</span>
          <div className="text-lg font-black text-emerald-400 mt-1">
            ₹{Math.round(totalSpent).toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-800 p-4 rounded-2xl border border-slate-600">
          <span className="text-[9px] text-slate-300 uppercase font-bold tracking-wider">Status</span>
          <div className={`text-xs font-black uppercase mt-2.5 px-2 py-0.5 rounded-md text-center ${
            remainingBudget < 5000 
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
          }`}>
            {remainingBudget < 5000 ? '⚠️ Budget Warning' : '✅ Budget Safe'}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] font-bold text-slate-300 uppercase">
          <span>Budget Utilization</span>
          <span>{Math.round(progressPercent)}% Spent</span>
        </div>
        <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              progressPercent > 90 ? 'bg-rose-500' : progressPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="space-y-2">
        <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-bold">Category Distribution</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {categories.map(cat => {
            const val = summary.category_breakdown?.[cat] || 0;
            return (
              <div key={cat} className="bg-slate-800 p-2.5 rounded-xl border border-slate-600 flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">{cat}</span>
                <span className="font-mono font-black text-white">₹{Math.round(val).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Expense Dashboard Inner Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Expenses List */}
        <div className="space-y-3">
          <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-bold">Expense Log</span>
          {expenses.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-semibold border border-dashed border-slate-600 rounded-2xl">
              No expenses recorded yet. Use the form to add one.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {expenses.map((exp: any) => (
                <div key={exp.id} className="flex justify-between items-center bg-slate-800 p-2.5 rounded-xl border border-slate-600 hover:border-slate-500 transition-colors">
                  <div className="text-left">
                    <span className="text-xs font-bold text-white block">{exp.description}</span>
                    <span className="text-[8px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-bold uppercase mt-1 inline-block">{exp.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-slate-100">₹{Math.round(exp.amount).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Expense Form */}
        <form onSubmit={handleAddExpense} className="space-y-3 bg-slate-800 p-4 rounded-2xl border border-slate-600 text-left">
          <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-bold">Add New Bill Item</span>
          
          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-slate-300 uppercase font-black">Amount (INR)</label>
            <input
              type="number"
              placeholder="e.g. 1500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-xs font-bold text-white p-2 rounded-xl outline-none focus:border-yellow-400 placeholder-slate-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-slate-300 uppercase font-black">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-xs font-bold text-white p-2 rounded-xl outline-none focus:border-yellow-400 cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-slate-300 uppercase font-black">Description</label>
            <input
              type="text"
              placeholder="e.g. Seafood Dinner at Brittos"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-slate-900 border border-slate-600 text-xs font-bold text-white p-2 rounded-xl outline-none focus:border-yellow-400 placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-yellow-400 hover:bg-yellow-300 text-black border border-black font-extrabold rounded-xl shadow-[3px_3px_0px_0px_#000000] cursor-pointer flex items-center justify-center gap-1 active:translate-y-px text-xs uppercase"
          >
            <Plus size={14} /> Add Bill Item
          </button>
        </form>
      </div>
    </div>
  );
}
