import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ── FIREBASE CONFIG ───────────────────────────────────────────────────────────
const FB_URL = "https://firestore.googleapis.com/v1/projects/mis-finanzas-c93f6/databases/(default)/documents/finanzas/main";

const fbLoad = async () => {
  try {
    const res = await fetch(FB_URL);
    if (!res.ok) return null;
    const doc = await res.json();
    const str = doc.fields?.data?.stringValue;
    return str ? JSON.parse(str) : null;
  } catch { return null; }
};

const fbSave = async (data) => {
  try {
    await fetch(FB_URL + "?updateMask.fieldPaths=data", {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({fields:{data:{stringValue:JSON.stringify(data)}}})
    });
  } catch {}
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const EXP_CATS = ["Comestibles","Restaurante","Bar / Cafetería","Combustible","Aseo hogar","Aseo personal","Mascotas","Ropa y calzado","Alcohol / Tabaco","Internet","Teléfono","Suscripciones","Préstamos / Cuotas","Arriendo Novaglamp","Insumos Novaglamp","Insumos Batidos","Salud","Educación","Donaciones","Otros"];
const INC_CATS = ["Salario","Hipnoterapia","Novaglamp - Hospedaje","Novaglamp - Bebidas","Novaglamp - Comida","Novaglamp - Masajes","Batidos Saludables","Préstamo recibido","Reembolso","Otros ingresos"];
const PALETTE  = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#14b8a6","#a78bfa"];
const USERS    = ["Rafael","Pareja"];
const ACC_COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4"];

const DEFAULT_ACCOUNTS = [
  {id:"finandina", name:"Finandina",  color:"#3b82f6", icon:"🏦", initialBalance:0},
  {id:"nequi",     name:"Nequi",      color:"#ec4899", icon:"📱", initialBalance:0},
  {id:"daviplata", name:"Daviplata",  color:"#f59e0b", icon:"💛", initialBalance:0},
  {id:"efectivo",  name:"Efectivo",   color:"#10b981", icon:"💵", initialBalance:0},
];

const DEFAULT_BUDGET = {
  "Comestibles":600000,"Restaurante":50000,"Bar / Cafetería":20000,
  "Combustible":80000,"Aseo hogar":30000,"Aseo personal":30000,
  "Mascotas":70000,"Ropa y calzado":50000,"Alcohol / Tabaco":30000,
  "Internet":60000,"Teléfono":70000,"Suscripciones":50000,
  "Préstamos / Cuotas":2617000,"Arriendo Novaglamp":2000000,
  "Insumos Novaglamp":300000,"Insumos Batidos":200000,
  "Salud":50000,"Educación":0,"Donaciones":0,"Otros":50000,
};

const SAMPLE_TXS = [];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt      = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n);
const fmtShort = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(n);
const today    = () => new Date().toISOString().split("T")[0];
const thisMonth= () => new Date().toISOString().slice(0,7);

// ── CALENDAR PICKER ───────────────────────────────────────────────────────────
function CalendarPicker({value, onChange}) {
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState(()=>{
    const d = value ? new Date(value+"T12:00:00") : new Date();
    return {year:d.getFullYear(), month:d.getMonth()};
  });
  const DAYS = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];
  const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  const firstDay = new Date(viewing.year, viewing.month, 1).getDay();
  const daysInMonth = new Date(viewing.year, viewing.month+1, 0).getDate();
  const cells = Array(firstDay).fill(null).concat(Array.from({length:daysInMonth},(_,i)=>i+1));

  const selected = value ? new Date(value+"T12:00:00") : null;
  const isSelected = d => selected && selected.getFullYear()===viewing.year && selected.getMonth()===viewing.month && selected.getDate()===d;
  const isToday = d => { const t=new Date(); return t.getFullYear()===viewing.year && t.getMonth()===viewing.month && t.getDate()===d; };

  const prevMonth = (e) => { e.stopPropagation(); setViewing(p => p.month===0?{year:p.year-1,month:11}:{year:p.year,month:p.month-1}); };
  const nextMonth = (e) => { e.stopPropagation(); setViewing(p => p.month===11?{year:p.year+1,month:0}:{year:p.year,month:p.month+1}); };
  const select = d => { const m=String(viewing.month+1).padStart(2,"0"); const dd=String(d).padStart(2,"0"); onChange(`${viewing.year}-${m}-${dd}`); setOpen(false); };

  const displayDate = value ? new Date(value+"T12:00:00").toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"}) : "Seleccionar fecha";

  return (
    <div style={{position:"relative"}}>
      {/* Trigger */}
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#08111f",border:`1px solid ${open?"#10b981":"#1e3a5f"}`,borderRadius:"9px",padding:"10px 12px",cursor:"pointer",fontSize:"13px",color:value?"#e2e8f0":"#476282"}}>
        <span>📅 {displayDate}</span>
        <span style={{color:"#476282",fontSize:"10px"}}>{open?"▲":"▼"}</span>
      </div>

      {/* Dropdown calendar */}
      {open && (
        <div style={{position:"absolute",top:"44px",left:0,right:0,zIndex:100,background:"#0b1930",border:"1px solid #1e3a5f",borderRadius:"12px",padding:"10px",boxShadow:"0 8px 32px #00000088"}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
            <button onClick={prevMonth} style={{background:"#1a3454",border:"none",borderRadius:"6px",padding:"3px 9px",cursor:"pointer",color:"#94a3b8",fontSize:"14px"}}>‹</button>
            <span style={{fontSize:"12px",fontWeight:"700",color:"#e2e8f0"}}>{MONTHS[viewing.month]} {viewing.year}</span>
            <button onClick={nextMonth} style={{background:"#1a3454",border:"none",borderRadius:"6px",padding:"3px 9px",cursor:"pointer",color:"#94a3b8",fontSize:"14px"}}>›</button>
          </div>
          {/* Grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"2px"}}>
            {DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:"9px",color:"#476282",fontWeight:"600",padding:"3px 0"}}>{d}</div>)}
            {cells.map((d,i)=>(
              <div key={i} onClick={()=>d&&select(d)} style={{textAlign:"center",fontSize:"12px",padding:"5px 2px",borderRadius:"6px",cursor:d?"pointer":"default",background:isSelected(d)?"#10b981":isToday(d)?"#10b98122":"transparent",color:isSelected(d)?"#000":isToday(d)?"#10b981":d?"#e2e8f0":"transparent",fontWeight:isSelected(d)||isToday(d)?"700":"400"}}>
                {d||""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TRANSACTION FORM ─────────────────────────────────────────────────────────
function TransactionForm({accounts, onSave, onCancel}) {
  const [tx, setTx] = useState({
    user:"Rafael", account: accounts[0]?.id || "finandina",
    type:"expense", category:"Comestibles",
    amount:"", description:"", date:new Date().toISOString().split("T")[0], shared:false
  });

  const EXP = ["Comestibles","Restaurante","Bar / Cafetería","Combustible","Aseo hogar","Aseo personal","Mascotas","Ropa y calzado","Alcohol / Tabaco","Internet","Teléfono","Suscripciones","Préstamos / Cuotas","Arriendo Novaglamp","Insumos Novaglamp","Insumos Batidos","Salud","Educación","Donaciones","Otros"];
  const INC = ["Salario","Hipnoterapia","Novaglamp - Hospedaje","Novaglamp - Bebidas","Novaglamp - Comida","Novaglamp - Masajes","Batidos Saludables","Préstamo recibido","Reembolso","Otros ingresos"];

  const inp = {width:"100%",background:"#08111f",border:"1px solid #1e3a5f",borderRadius:"9px",padding:"12px",color:"#e2e8f0",fontSize:"16px",fontFamily:"'Sora',sans-serif",outline:"none",boxSizing:"border-box",marginBottom:"8px"};
  const sel = {...inp};
  const btn = (bg="#10b981",tc="#000")=>({background:bg,color:tc,border:"none",borderRadius:"9px",padding:"10px 20px",fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"'Sora',sans-serif"});

  const save = () => {
    if(!tx.amount||!tx.description) return;
    onSave(tx);
  };

  return (
    <div style={{background:"#0b1930",border:"1px solid #10b98133",borderRadius:"14px",padding:"14px",marginBottom:"10px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
        <select style={sel} value={tx.user} onChange={e=>setTx(p=>({...p,user:e.target.value}))}>
          {["Rafael","Pareja"].map(u=><option key={u}>{u}</option>)}
        </select>
        <select style={sel} value={tx.type} onChange={e=>setTx(p=>({...p,type:e.target.value,category:e.target.value==="income"?INC[0]:EXP[0]}))}>
          <option value="expense">💸 Gasto</option>
          <option value="income">💰 Ingreso</option>
        </select>
      </div>
      <select style={sel} value={tx.account} onChange={e=>setTx(p=>({...p,account:e.target.value}))}>
        {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
      </select>
      <select style={sel} value={tx.category} onChange={e=>setTx(p=>({...p,category:e.target.value}))}>
        {(tx.type==="income"?INC:EXP).map(c=><option key={c}>{c}</option>)}
      </select>
      <input
        style={inp}
        type="number"
        inputMode="numeric"
        placeholder="Monto en COP"
        value={tx.amount}
        onChange={e=>setTx(p=>({...p,amount:e.target.value}))}
      />
      <input
        style={inp}
        type="text"
        inputMode="text"
        placeholder="Descripción"
        value={tx.description}
        onChange={e=>setTx(p=>({...p,description:e.target.value}))}
      />
      <div style={{marginBottom:"8px"}}>
        <div style={{fontSize:"11px",color:"#476282",marginBottom:"6px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"1px"}}>Fecha</div>
        <CalendarPicker value={tx.date} onChange={d=>setTx(p=>({...p,date:d}))}/>
      </div>
      {tx.type==="expense"&&(
        <div onClick={()=>setTx(p=>({...p,shared:!p.shared}))} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"9px",border:`1px solid ${tx.shared?"#10b981":"#1e3a5f"}`,background:tx.shared?"#071a12":"transparent",cursor:"pointer",marginBottom:"10px"}}>
          <div style={{width:"18px",height:"18px",borderRadius:"5px",background:tx.shared?"#10b981":"#1a3454",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px"}}>{tx.shared?"✓":""}</div>
          <div>
            <div style={{fontSize:"12px",fontWeight:"500",color:tx.shared?"#10b981":"#94a3b8"}}>Gasto compartido 50/50</div>
            {tx.amount&&<div style={{fontSize:"10px",color:"#476282"}}>
              Rafael: {new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(Math.round(parseInt(tx.amount||0)/2))} · Pareja: {new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(parseInt(tx.amount||0)-Math.round(parseInt(tx.amount||0)/2))}
            </div>}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:"8px"}}>
        <button style={btn()} onClick={save}>Guardar</button>
        <button style={btn("#1a3454","#94a3b8")} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view,         setView]         = useState("dashboard");
  const [accounts,     setAccounts]     = useState(DEFAULT_ACCOUNTS);
  const [transactions, setTransactions] = useState(SAMPLE_TXS);
  const [budget,       setBudget]       = useState(DEFAULT_BUDGET);
  const [debts,        setDebts]        = useState([
    // ── Deudas personales ──────────────────────────────────────
    {id:1,  name:"Norbey",           total:9000000,  remaining:9000000,  monthly:1000000, color:"#ef4444"},
    {id:2,  name:"Andrés Mora 2",    total:8000000,  remaining:8000000,  monthly:560000,  color:"#f97316"},
    {id:3,  name:"Carro",            total:7000000,  remaining:7000000,  monthly:500000,  color:"#f59e0b"},
    {id:4,  name:"Cristina",         total:6000000,  remaining:6000000,  monthly:300000,  color:"#ec4899"},
    {id:5,  name:"Danilo 1",         total:5000000,  remaining:5000000,  monthly:350000,  color:"#8b5cf6"},
    {id:6,  name:"Andrés Mora 1",    total:5000000,  remaining:5000000,  monthly:350000,  color:"#a78bfa"},
    {id:7,  name:"José Luis 2",      total:3000000,  remaining:3000000,  monthly:450000,  color:"#06b6d4"},
    {id:8,  name:"Danilo 2",         total:3000000,  remaining:3000000,  monthly:150000,  color:"#14b8a6"},
    {id:9,  name:"José Luis 1",      total:1500000,  remaining:1500000,  monthly:75000,   color:"#3b82f6"},
    {id:10, name:"Hilda",            total:250000,   remaining:250000,   monthly:50000,   color:"#84cc16"},
    // ── Créditos virtuales ─────────────────────────────────────
    {id:11, name:"Banco de Bogotá",  total:2292924,  remaining:2292924,  monthly:208264,  color:"#ef4444"},
    {id:12, name:"Addi",             total:1850888,  remaining:1850888,  monthly:768481,  color:"#f97316"},
    {id:13, name:"Banco Serfinanza", total:1710189,  remaining:1710189,  monthly:517774,  color:"#f59e0b"},
    {id:14, name:"Credimarcas",      total:945384,   remaining:945384,   monthly:118200,  color:"#8b5cf6"},
    {id:15, name:"Luego Pago",       total:728205,   remaining:728205,   monthly:147584,  color:"#ec4899"},
    {id:16, name:"Muebles Milenio",  total:624855,   remaining:624855,   monthly:208285,  color:"#06b6d4"},
    {id:17, name:"Rapicredit",       total:630000,   remaining:630000,   monthly:630000,  color:"#ef4444"},
    {id:18, name:"Wasticredit",      total:500000,   remaining:500000,   monthly:500000,  color:"#f97316"},
    {id:19, name:"Sistecredito KOAJ",total:326978,   remaining:326978,   monthly:163489,  color:"#3b82f6"},
    {id:20, name:"Toto",             total:263848,   remaining:263848,   monthly:137116,  color:"#84cc16"},
    {id:21, name:"Sistecredito D&G", total:82134,    remaining:82134,    monthly:41067,   color:"#14b8a6"},
  ]);
  const [history,      setHistory]      = useState([]);
  const [undoMsg,      setUndoMsg]      = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterUser,   setFilterUser]   = useState("Todos");
  const [ready,        setReady]        = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [editingTx,    setEditingTx]    = useState(null);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingDebt,  setEditingDebt]  = useState(null);
  const [showAccForm,  setShowAccForm]  = useState(false);
  const [newTx,   setNewTx]   = useState({user:"Rafael",account:"finandina",type:"expense",category:"Comestibles",amount:"",description:"",date:today(),shared:false});
  const [newDebt, setNewDebt] = useState({name:"",total:"",remaining:"",monthly:"",color:"#ef4444"});
  const [newAcc,  setNewAcc]  = useState({name:"",icon:"🏦",color:"#3b82f6",initialBalance:""});
  const [chatMsgs,    setChatMsgs]    = useState([{role:"assistant",content:"¡Hola Rafael! 👋 Soy tu asesor financiero. Tengo acceso a tus cuentas, transacciones y deudas en tiempo real. ¿En qué te ayudo?"}]);
  const [chatInput,   setChatInput]   = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(()=>{
    const l=document.createElement("link");l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&display=swap";
    document.head.appendChild(l);return()=>document.head.removeChild(l);
  },[]);

  useEffect(()=>{
    (async()=>{
      // Intentar Firebase primero, luego storage de Claude como respaldo
      let d = await fbLoad();
      if (!d) {
        try {
          const r = await window.storage.get("finanzas_v7");
          if (r) d = JSON.parse(r.value);
        } catch {}
      }
      if (d) {
        if(d.transactions?.length)setTransactions(d.transactions);
        if(d.budget)setBudget(d.budget);
        if(d.debts?.length)setDebts(d.debts);
        if(d.accounts?.length)setAccounts(d.accounts);
      }
      setReady(true);
    })();
  },[]);

  useEffect(()=>{
    if(!ready)return;
    const data = {transactions,budget,debts,accounts};
    // Guardar en Firebase (nube) y en storage de Claude (respaldo)
    fbSave(data);
    (async()=>{try{await window.storage.set("finanzas_v7",JSON.stringify(data));}catch{}})();
  },[transactions,budget,debts,accounts,ready]);

  // ── DERIVED ─────────────────────────────────────────────────────────────────
  const filtered   = filterUser==="Todos"?transactions:transactions.filter(t=>t.user===filterUser);
  const monthTxs   = filtered.filter(t=>t.date.startsWith(thisMonth()));
  const income     = monthTxs.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense    = monthTxs.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const totalDebt  = debts.reduce((s,d)=>s+d.remaining,0);
  const totalMonthly=debts.reduce((s,d)=>s+d.monthly,0);

  const accBalances = accounts.map(acc=>{
    const txs=transactions.filter(t=>t.account===acc.id);
    return{...acc,balance:acc.initialBalance+txs.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0)-txs.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0)};
  });
  const totalBalance=accBalances.reduce((s,a)=>s+a.balance,0);

  const catData=EXP_CATS.map(cat=>({name:cat,value:monthTxs.filter(t=>t.type==="expense"&&t.category===cat).reduce((s,t)=>s+t.amount,0)})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
  const budgetRows=EXP_CATS.map(cat=>{const spent=monthTxs.filter(t=>t.type==="expense"&&t.category===cat).reduce((s,t)=>s+t.amount,0);const limit=budget[cat]||0;return{cat,spent,limit,pct:limit>0?Math.min((spent/limit)*100,100):0};});

  // ── ACTIONS ─────────────────────────────────────────────────────────────────
  const addTx=tx=>{
    if(!tx.amount||!tx.description)return;
    const total=parseInt(tx.amount);
    if(tx.shared&&tx.type==="expense"){
      const half=Math.round(total/2);
      const base={category:tx.category,description:tx.description+" (compartido)",date:tx.date,type:"expense",account:tx.account,shared:true};
      setTransactions(p=>[{...base,id:Date.now(),user:"Rafael",amount:half},{...base,id:Date.now()+1,user:"Pareja",amount:total-half},...p]);
    }else{
      setTransactions(p=>[{...tx,id:Date.now(),amount:total},...p]);
    }
  };
  const saveHistory = (msg) => {
    setHistory(p=>[{accounts,transactions,debts,msg}, ...p.slice(0,9)]);
    setUndoMsg(msg);
    setTimeout(()=>setUndoMsg(""),4000);
  };

  const undo = () => {
    if(!history.length)return;
    const prev=history[0];
    setAccounts(prev.accounts);
    setTransactions(prev.transactions);
    setDebts(prev.debts);
    setHistory(p=>p.slice(1));
    setUndoMsg("");
  };

  const deleteTx=id=>{saveHistory("Transacción eliminada");setTransactions(p=>p.filter(t=>t.id!==id));};
  const saveEdit=()=>{if(!editingTx.amount||!editingTx.description)return;setTransactions(p=>p.map(t=>t.id===editingTx.id?{...editingTx,amount:parseInt(editingTx.amount)}:t));setEditingTx(null);};
  const addDebt=()=>{if(!newDebt.name||!newDebt.total)return;setDebts(p=>[...p,{...newDebt,id:Date.now(),total:parseInt(newDebt.total),remaining:parseInt(newDebt.remaining||newDebt.total),monthly:parseInt(newDebt.monthly||0)}]);setNewDebt({name:"",total:"",remaining:"",monthly:"",color:"#ef4444"});setShowDebtForm(false);};
  const payDebt=id=>{const d=debts.find(x=>x.id===id);if(!d)return;const pmt=Math.min(d.monthly,d.remaining);setDebts(p=>p.map(x=>x.id===id?{...x,remaining:Math.max(0,x.remaining-pmt)}:x));setTransactions(p=>[{id:Date.now(),user:"Rafael",account:"finandina",type:"expense",category:"Préstamos / Cuotas",description:`Pago: ${d.name}`,amount:pmt,date:today()},...p]);};
  const deleteDebt=id=>{saveHistory("Deuda eliminada");setDebts(p=>p.filter(d=>d.id!==id));};
  const saveDebtEdit=()=>{
    if(!editingDebt.name)return;
    setDebts(p=>p.map(d=>d.id===editingDebt.id?{...editingDebt,monthly:parseInt(editingDebt.monthly)||0,remaining:parseInt(editingDebt.remaining)||0,total:parseInt(editingDebt.total)||0}:d));
    setEditingDebt(null);
  };
  const addAccount=()=>{if(!newAcc.name)return;setAccounts(p=>[...p,{id:`acc_${Date.now()}`,name:newAcc.name,icon:newAcc.icon||"🏦",color:newAcc.color,initialBalance:parseInt(newAcc.initialBalance)||0}]);setNewAcc({name:"",icon:"🏦",color:"#3b82f6",initialBalance:""});setShowAccForm(false);};
  const deleteAccount=id=>{saveHistory("Cuenta eliminada");setAccounts(p=>p.filter(a=>a.id!==id));};

  const importCSV=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{const lines=ev.target.result.split("\n").slice(1).filter(l=>l.trim());const imported=lines.map((line,i)=>{const[date,description,amount,category,type,user,account]=line.split(",").map(s=>s?.trim().replace(/"/g,""));return{id:Date.now()+i,user:user||"Rafael",account:account||"efectivo",type:type||"expense",category:category||"Otros",amount:Math.abs(parseFloat(amount)||0),description:description||"",date:date?.split(" ")[0]||today()};}).filter(t=>t.amount>0);setTransactions(p=>[...imported,...p]);};reader.readAsText(file);e.target.value="";};
  const exportCSV=()=>{const header="fecha,descripcion,monto,categoria,tipo,usuario,cuenta";const rows=transactions.map(t=>`${t.date},"${t.description}",${t.amount},${t.category},${t.type},${t.user},${t.account||""}`);const csv=[header,...rows].join("\n");const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`MisFinanzas_${thisMonth()}.csv`;a.click();URL.revokeObjectURL(url);};

  const sendChat=async()=>{
    if(!chatInput.trim()||chatLoading)return;
    const msg=chatInput.trim();setChatInput("");
    setChatMsgs(p=>[...p,{role:"user",content:msg}]);setChatLoading(true);
    const ctx=`Cuentas: ${JSON.stringify(accBalances.map(a=>({cuenta:a.name,saldo:fmt(a.balance)})))} | Total disponible: ${fmt(totalBalance)} | Ingresos mes: ${fmt(income)} | Gastos mes: ${fmt(expense)} | Deuda total: ${fmt(totalDebt)} | Cuotas/mes: ${fmt(totalMonthly)} | Deudas: ${JSON.stringify(debts.map(d=>({n:d.name,s:fmt(d.remaining),c:fmt(d.monthly)})))} | Top gastos: ${JSON.stringify(catData.slice(0,6).map(d=>({cat:d.name,monto:fmt(d.value)})))}`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`Eres asesor financiero personal de Rafael, colombiano. Datos en tiempo real:\n${ctx}\nResponde en español, conciso y práctico. Montos en COP.`,messages:[...chatMsgs.slice(1).map(m=>({role:m.role,content:m.content})),{role:"user",content:msg}]})});
      const data=await res.json();
      setChatMsgs(p=>[...p,{role:"assistant",content:data.content?.[0]?.text||"Error."}]);
    }catch{setChatMsgs(p=>[...p,{role:"assistant",content:"Error de conexión."}]);}
    setChatLoading(false);
  };

  // ── STYLES ───────────────────────────────────────────────────────────────────
  const s={
    root:    {fontFamily:"'Sora',sans-serif",background:"#060d1c",minHeight:"100vh",color:"#e2e8f0"},
    header:  {background:"linear-gradient(135deg,#0a1628,#0d1f3c)",borderBottom:"1px solid #1e3a5f55",padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
    nav:     {display:"flex",gap:"4px",padding:"10px 14px",background:"#08111f",borderBottom:"1px solid #1e3a5f44",overflowX:"auto"},
    navBtn:  a=>({padding:"7px 13px",borderRadius:"18px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:a?"600":"400",fontFamily:"'Sora',sans-serif",background:a?"#10b981":"transparent",color:a?"#000":"#64748b",whiteSpace:"nowrap"}),
    page:    {padding:"14px",maxWidth:"680px",margin:"0 auto"},
    card:    {background:"#0b1930",border:"1px solid #1a3454",borderRadius:"14px",padding:"14px",marginBottom:"10px"},
    label:   {fontSize:"10px",color:"#476282",textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:"3px",fontWeight:"600"},
    bigNum:  {fontSize:"22px",fontWeight:"800",letterSpacing:"-1px"},
    secTitle:{fontSize:"11px",fontWeight:"700",color:"#476282",textTransform:"uppercase",letterSpacing:"1px",marginBottom:"10px"},
    input:   {width:"100%",background:"#08111f",border:"1px solid #1e3a5f",borderRadius:"9px",padding:"10px 12px",color:"#e2e8f0",fontSize:"13px",fontFamily:"'Sora',sans-serif",outline:"none",boxSizing:"border-box"},
    select:  {width:"100%",background:"#08111f",border:"1px solid #1e3a5f",borderRadius:"9px",padding:"10px 12px",color:"#e2e8f0",fontSize:"13px",fontFamily:"'Sora',sans-serif",outline:"none",boxSizing:"border-box"},
    btn:     (bg="#10b981",tc="#000")=>({background:bg,color:tc,border:"none",borderRadius:"9px",padding:"9px 18px",fontSize:"13px",fontWeight:"600",cursor:"pointer",fontFamily:"'Sora',sans-serif"}),
    fRow:    {display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"},
    fBtn:    a=>({padding:"5px 13px",borderRadius:"18px",border:`1px solid ${a?"#10b981":"#1e3a5f"}`,cursor:"pointer",fontSize:"11px",fontWeight:"500",fontFamily:"'Sora',sans-serif",background:a?"#10b981":"transparent",color:a?"#000":"#64748b"}),
    txRow:   {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #1a345422"},
    bubble:  u=>({maxWidth:"84%",padding:"10px 14px",borderRadius:u?"16px 16px 3px 16px":"16px 16px 16px 3px",background:u?"#10b981":"#0b1930",color:u?"#000":"#e2e8f0",fontSize:"13px",lineHeight:"1.55",marginBottom:"6px",alignSelf:u?"flex-end":"flex-start",border:u?"none":"1px solid #1a3454"}),
  };

  // ── VIEWS ────────────────────────────────────────────────────────────────────
  const Dashboard=()=>(
    <div>
      <div style={s.fRow}>
        {["Todos","Rafael","Pareja"].map(u=><button key={u} style={s.fBtn(filterUser===u)} onClick={()=>setFilterUser(u)}>{u}</button>)}
      </div>

      {/* Total disponible */}
      <div style={{...s.card,background:"linear-gradient(135deg,#071a30,#0d2545)",border:"1px solid #10b98144"}}>
        <div style={s.label}>Dinero disponible total</div>
        <div style={{...s.bigNum,fontSize:"28px",color:totalBalance>=0?"#10b981":"#ef4444"}}>{fmt(totalBalance)}</div>
        <div style={{fontSize:"11px",color:"#476282",marginTop:"4px"}}>Suma de todas tus cuentas</div>
      </div>

      {/* Cuentas */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
        {accBalances.map(acc=>(
          <div key={acc.id} style={{...s.card,borderLeft:`3px solid ${acc.color}`,padding:"12px",marginBottom:0}}>
            <div style={{fontSize:"18px",marginBottom:"2px"}}>{acc.icon}</div>
            <div style={{fontSize:"11px",color:"#476282",fontWeight:"600"}}>{acc.name}</div>
            <div style={{fontSize:"16px",fontWeight:"800",color:acc.balance>=0?acc.color:"#ef4444",marginTop:"2px"}}>{fmtShort(acc.balance)}</div>
          </div>
        ))}
      </div>

      {/* Mes */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"10px"}}>
        <div style={s.card}>
          <div style={s.label}>Ingresos</div>
          <div style={{fontSize:"15px",fontWeight:"800",color:"#10b981"}}>{fmtShort(income)}</div>
        </div>
        <div style={s.card}>
          <div style={s.label}>Gastos</div>
          <div style={{fontSize:"15px",fontWeight:"800",color:"#ef4444"}}>{fmtShort(expense)}</div>
        </div>
        <div style={{...s.card,background:income-expense>=0?"#071a12":"#1a0808",border:`1px solid ${income-expense>=0?"#10b98133":"#ef444433"}`}}>
          <div style={s.label}>Balance</div>
          <div style={{fontSize:"15px",fontWeight:"800",color:income-expense>=0?"#10b981":"#ef4444"}}>{fmtShort(income-expense)}</div>
        </div>
      </div>

      {totalDebt>0&&(
        <div style={{...s.card,background:"#1a0808",border:"1px solid #ef444433"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:"12px",color:"#ef4444",fontWeight:"700"}}>🔴 Deuda total activa</div>
              <div style={{fontSize:"11px",color:"#476282",marginTop:"2px"}}>Cuotas este mes: {fmt(totalMonthly)}</div>
            </div>
            <div style={{fontSize:"18px",fontWeight:"800",color:"#ef4444"}}>{fmtShort(totalDebt)}</div>
          </div>
        </div>
      )}

      {catData.length>0&&(
        <div style={s.card}>
          <div style={s.secTitle}>Gastos del mes</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart><Pie data={catData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} dataKey="value" paddingAngle={3}>
              {catData.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
            </Pie>
            <Tooltip formatter={v=>fmt(v)} contentStyle={{background:"#0b1930",border:"1px solid #1a3454",borderRadius:"8px",color:"#e2e8f0",fontSize:"12px",fontFamily:"'Sora',sans-serif"}}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginTop:"4px"}}>
            {catData.slice(0,6).map((d,i)=>(
              <div key={d.name} style={{display:"flex",alignItems:"center",gap:"3px",fontSize:"10px",color:"#94a3b8"}}>
                <div style={{width:"6px",height:"6px",borderRadius:"50%",background:PALETTE[i%PALETTE.length]}}/>
                {d.name}: {fmtShort(d.value)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={s.card}>
        <div style={s.secTitle}>Últimos movimientos</div>
        {filtered.slice(0,5).map(tx=>{
          const acc=accounts.find(a=>a.id===tx.account);
          return(
            <div key={tx.id} style={s.txRow}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"32px",height:"32px",borderRadius:"8px",background:tx.type==="income"?"#10b98118":"#ef444418",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>
                  {tx.type==="income"?"💰":"💸"}
                </div>
                <div>
                  <div style={{fontSize:"13px",fontWeight:"500"}}>{tx.description}</div>
                  <div style={{fontSize:"10px",color:"#476282"}}>{tx.category} · {acc?.icon} {acc?.name||"—"} · {tx.date}</div>
                </div>
              </div>
              <div style={{color:tx.type==="income"?"#10b981":"#ef4444",fontWeight:"700",fontSize:"13px",whiteSpace:"nowrap",marginLeft:"8px"}}>
                {tx.type==="income"?"+":"-"}{fmtShort(tx.amount)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const Cuentas=()=>(
    <div>
      <div style={{...s.card,background:"linear-gradient(135deg,#071a30,#0d2545)",border:"1px solid #10b98144"}}>
        <div style={s.label}>Total disponible en todas las cuentas</div>
        <div style={{...s.bigNum,color:totalBalance>=0?"#10b981":"#ef4444"}}>{fmt(totalBalance)}</div>
      </div>

      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"10px"}}>
        <button style={s.btn()} onClick={()=>setShowAccForm(f=>!f)}>+ Nueva cuenta</button>
      </div>

      {showAccForm&&(
        <div style={{...s.card,border:"1px solid #10b98133",marginBottom:"10px"}}>
          <div style={{fontSize:"13px",fontWeight:"700",color:"#10b981",marginBottom:"10px"}}>Nueva cuenta</div>
          <input style={{...s.input,marginBottom:"8px"}} placeholder="Nombre (ej: Bancolombia)" value={newAcc.name} onChange={e=>setNewAcc(p=>({...p,name:e.target.value}))}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:"8px",marginBottom:"8px"}}>
            <input style={s.input} placeholder="Emoji" value={newAcc.icon} onChange={e=>setNewAcc(p=>({...p,icon:e.target.value}))}/>
            <input style={s.input} type="number" placeholder="Saldo inicial" value={newAcc.initialBalance} onChange={e=>setNewAcc(p=>({...p,initialBalance:e.target.value}))}/>
          </div>
          <div style={{display:"flex",gap:"6px",marginBottom:"10px"}}>
            {ACC_COLORS.map(c=><div key={c} onClick={()=>setNewAcc(p=>({...p,color:c}))} style={{width:"22px",height:"22px",borderRadius:"50%",background:c,cursor:"pointer",border:newAcc.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button style={s.btn()} onClick={addAccount}>Guardar</button>
            <button style={s.btn("#1a3454","#94a3b8")} onClick={()=>setShowAccForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {accBalances.map(acc=>{
        const accTxs=transactions.filter(t=>t.account===acc.id);
        const accIn=accTxs.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
        const accOut=accTxs.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
        return(
          <div key={acc.id} style={{...s.card,borderLeft:`4px solid ${acc.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"42px",height:"42px",borderRadius:"12px",background:acc.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px"}}>{acc.icon}</div>
                <div>
                  <div style={{fontSize:"15px",fontWeight:"700"}}>{acc.name}</div>
                  <div style={{fontSize:"11px",color:"#476282"}}>{accTxs.length} movimientos</div>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"20px",fontWeight:"800",color:acc.balance>=0?acc.color:"#ef4444"}}>{fmt(acc.balance)}</div>
                <div style={{fontSize:"10px",color:"#476282"}}>saldo actual</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginBottom:"10px"}}>
              <div style={{background:"#08111f",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <div style={{fontSize:"10px",color:"#476282"}}>Saldo inicial</div>
                <div style={{fontSize:"12px",fontWeight:"700",color:"#94a3b8"}}>{fmtShort(acc.initialBalance)}</div>
              </div>
              <div style={{background:"#071a12",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <div style={{fontSize:"10px",color:"#476282"}}>Ingresos</div>
                <div style={{fontSize:"12px",fontWeight:"700",color:"#10b981"}}>+{fmtShort(accIn)}</div>
              </div>
              <div style={{background:"#1a0808",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <div style={{fontSize:"10px",color:"#476282"}}>Gastos</div>
                <div style={{fontSize:"12px",fontWeight:"700",color:"#ef4444"}}>-{fmtShort(accOut)}</div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontSize:"11px",color:"#476282"}}>Saldo inicial:</div>
              <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                <input type="number" value={acc.initialBalance} onChange={e=>setAccounts(p=>p.map(a=>a.id===acc.id?{...a,initialBalance:parseInt(e.target.value)||0}:a))} style={{...s.input,width:"110px",padding:"4px 8px",fontSize:"12px",textAlign:"right"}}/>
                <button onClick={()=>deleteAccount(acc.id)} style={{background:"#2a1a1a",border:"none",borderRadius:"6px",padding:"5px 8px",cursor:"pointer",fontSize:"12px",color:"#ef4444"}}>🗑️</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const Transacciones=()=>(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px",gap:"8px"}}>
        <div style={s.fRow}>
          {["Todos","Rafael","Pareja"].map(u=><button key={u} style={s.fBtn(filterUser===u)} onClick={()=>setFilterUser(u)}>{u}</button>)}
        </div>
        <button style={s.btn()} onClick={()=>setShowForm(f=>!f)}>+ Nuevo</button>
      </div>

      {showForm && (
        <TransactionForm
          accounts={accounts}
          onSave={tx => { addTx(tx); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editingTx&&(
        <div style={{position:"fixed",inset:0,background:"#000000bb",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{...s.card,width:"100%",maxWidth:"400px",border:"1px solid #10b98155"}}>
            <div style={{fontSize:"14px",fontWeight:"700",color:"#10b981",marginBottom:"12px"}}>✏️ Editar</div>
            <select style={{...s.select,marginBottom:"8px"}} value={editingTx.account||"finandina"} onChange={e=>setEditingTx(p=>({...p,account:e.target.value}))}>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
              <select style={s.select} value={editingTx.user} onChange={e=>setEditingTx(p=>({...p,user:e.target.value}))}>
                {USERS.map(u=><option key={u}>{u}</option>)}
              </select>
              <select style={s.select} value={editingTx.type} onChange={e=>setEditingTx(p=>({...p,type:e.target.value}))}>
                <option value="expense">💸 Gasto</option><option value="income">💰 Ingreso</option>
              </select>
            </div>
            <select style={{...s.select,marginBottom:"8px"}} value={editingTx.category} onChange={e=>setEditingTx(p=>({...p,category:e.target.value}))}>
              {(editingTx.type==="income"?INC_CATS:EXP_CATS).map(c=><option key={c}>{c}</option>)}
            </select>
            <input style={{...s.input,marginBottom:"8px"}} type="number" value={editingTx.amount} onChange={e=>setEditingTx(p=>({...p,amount:e.target.value}))}/>
            <input style={{...s.input,marginBottom:"8px"}} type="text" value={editingTx.description} onChange={e=>setEditingTx(p=>({...p,description:e.target.value}))}/>
            <div style={{marginBottom:"12px"}}>
              <div style={{fontSize:"11px",color:"#476282",marginBottom:"6px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"1px"}}>Fecha</div>
              <CalendarPicker value={editingTx.date} onChange={d=>setEditingTx(p=>({...p,date:d}))}/>
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button style={s.btn()} onClick={saveEdit}>Guardar</button>
              <button style={s.btn("#1a3454","#94a3b8")} onClick={()=>setEditingTx(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{...s.card,marginBottom:"10px"}}>
        <div style={s.secTitle}>Importar / Exportar</div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <label style={{...s.btn("#1a3454","#94a3b8"),cursor:"pointer",display:"inline-block"}}>📂 Importar CSV<input type="file" accept=".csv" style={{display:"none"}} onChange={importCSV}/></label>
          <button style={s.btn("#0d2e1a","#10b981")} onClick={exportCSV}>⬇️ Exportar</button>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.secTitle}>{filtered.length} transacciones</div>
        {filtered.map(tx=>{
          const acc=accounts.find(a=>a.id===tx.account);
          return(
            <div key={tx.id} style={s.txRow}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",flex:1,minWidth:0}}>
                <div style={{width:"32px",height:"32px",borderRadius:"8px",background:tx.type==="income"?"#10b98118":"#ef444418",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0}}>{tx.type==="income"?"💰":"💸"}</div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:"13px",fontWeight:"500",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.description}</div>
                  <div style={{fontSize:"10px",color:"#476282"}}>{tx.category} · {acc?.icon} {acc?.name||"—"} · {tx.date}{tx.shared?" 🔀":""}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"5px",marginLeft:"8px",flexShrink:0}}>
                <div style={{color:tx.type==="income"?"#10b981":"#ef4444",fontWeight:"700",fontSize:"13px",whiteSpace:"nowrap"}}>{tx.type==="income"?"+":"-"}{fmtShort(tx.amount)}</div>
                <button onClick={()=>setEditingTx({...tx})} style={{background:"#1a3454",border:"none",borderRadius:"6px",padding:"4px 6px",cursor:"pointer",fontSize:"11px",color:"#94a3b8"}}>✏️</button>
                {confirmDelete===tx.id ? (
                  <div style={{display:"flex",gap:"4px"}}>
                    <button onClick={()=>{deleteTx(tx.id);setConfirmDelete(null);}} style={{background:"#ef4444",border:"none",borderRadius:"6px",padding:"4px 8px",cursor:"pointer",fontSize:"11px",color:"#fff",fontWeight:"700"}}>Sí</button>
                    <button onClick={()=>setConfirmDelete(null)} style={{background:"#1a3454",border:"none",borderRadius:"6px",padding:"4px 8px",cursor:"pointer",fontSize:"11px",color:"#94a3b8"}}>No</button>
                  </div>
                ) : (
                  <button onClick={()=>setConfirmDelete(tx.id)} style={{background:"#2a1a1a",border:"none",borderRadius:"6px",padding:"4px 6px",cursor:"pointer",fontSize:"11px",color:"#ef4444"}}>🗑️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const Presupuesto=()=>(
    <div>
      <div style={{...s.card,background:"#071a12",border:"1px solid #10b98133"}}>
        <div style={{fontSize:"13px",color:"#10b981",fontWeight:"600"}}>🎯 Presupuesto — {thisMonth()}</div>
      </div>
      {budgetRows.map(({cat,spent,limit,pct})=>(
        <div key={cat} style={s.card}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
            <span style={{fontSize:"13px",fontWeight:"500"}}>{cat}</span>
            <span style={{fontSize:"12px",fontWeight:"700",color:pct>90?"#ef4444":pct>70?"#f59e0b":"#10b981"}}>{Math.round(pct)}%</span>
          </div>
          <div style={{background:"#1a3454",borderRadius:"4px",height:"5px",marginBottom:"7px"}}>
            <div style={{background:pct>90?"#ef4444":pct>70?"#f59e0b":"#10b981",height:"100%",borderRadius:"4px",width:pct+"%"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:"11px",color:"#476282"}}>{fmt(spent)}</span>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <span style={{fontSize:"11px",color:"#476282"}}>Límite:</span>
              <input type="number" value={limit} onChange={e=>setBudget(p=>({...p,[cat]:parseInt(e.target.value)||0}))} style={{...s.input,width:"100px",padding:"4px 8px",fontSize:"12px",textAlign:"right"}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const Deudas=()=>(
    <div>
      {/* Edit modal */}
      {editingDebt&&(
        <div style={{position:"fixed",inset:0,background:"#000000bb",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{...s.card,width:"100%",maxWidth:"400px",border:`1px solid ${editingDebt.color}55`}}>
            <div style={{fontSize:"14px",fontWeight:"700",color:editingDebt.color,marginBottom:"12px"}}>✏️ Editar deuda</div>
            <input style={{...s.input,marginBottom:"8px"}} placeholder="Nombre" value={editingDebt.name} onChange={e=>setEditingDebt(p=>({...p,name:e.target.value}))}/>
            <input style={{...s.input,marginBottom:"8px"}} type="number" placeholder="Saldo pendiente" value={editingDebt.remaining} onChange={e=>setEditingDebt(p=>({...p,remaining:e.target.value}))}/>
            <input style={{...s.input,marginBottom:"8px"}} type="number" placeholder="Cuota mensual" value={editingDebt.monthly} onChange={e=>setEditingDebt(p=>({...p,monthly:e.target.value}))}/>
            <div style={{fontSize:"11px",color:"#476282",marginBottom:"6px"}}>
              {editingDebt.monthly>0&&editingDebt.remaining>0&&`Meses restantes: ${Math.ceil(parseInt(editingDebt.remaining)/parseInt(editingDebt.monthly))}`}
            </div>
            <div style={{display:"flex",gap:"6px",marginBottom:"10px"}}>
              {["#ef4444","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"].map(c=><div key={c} onClick={()=>setEditingDebt(p=>({...p,color:c}))} style={{width:"22px",height:"22px",borderRadius:"50%",background:c,cursor:"pointer",border:editingDebt.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button style={s.btn()} onClick={saveDebtEdit}>Guardar</button>
              <button style={s.btn("#1a3454","#94a3b8")} onClick={()=>setEditingDebt(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
        <div style={{...s.card,background:"#1a0808",border:"1px solid #ef444433"}}>
          <div style={s.label}>Deuda total</div>
          <div style={{...s.bigNum,color:"#ef4444",fontSize:"20px"}}>{fmtShort(totalDebt)}</div>
        </div>
        <div style={{...s.card,background:"#1a0f00",border:"1px solid #f59e0b33"}}>
          <div style={s.label}>Cuotas/mes</div>
          <div style={{...s.bigNum,color:"#f59e0b",fontSize:"20px"}}>{fmtShort(totalMonthly)}</div>
        </div>
      </div>
      {/* Resumen por grupo */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
        <div style={{...s.card,background:"#1a0808",border:"1px solid #ef444433"}}>
          <div style={s.label}>Deudas personales</div>
          <div style={{fontSize:"16px",fontWeight:"800",color:"#ef4444"}}>{new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(debts.slice(0,10).reduce((s,d)=>s+d.remaining,0))}</div>
        </div>
        <div style={{...s.card,background:"#1a0f00",border:"1px solid #f59e0b33"}}>
          <div style={s.label}>Créditos virtuales</div>
          <div style={{fontSize:"16px",fontWeight:"800",color:"#f59e0b"}}>{new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0}).format(debts.slice(10).reduce((s,d)=>s+d.remaining,0))}</div>
        </div>
      </div>
        <div style={{...s.card,background:"#1a0808",border:"1px solid #ef4444",marginBottom:"10px"}}>
          <div style={{fontSize:"12px",color:"#ef4444",fontWeight:"700"}}>⚠️ Cuotas superan ingresos registrados</div>
          <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"3px"}}>Déficit: {fmt(totalMonthly-income)}</div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"10px"}}>
        <button style={s.btn()} onClick={()=>setShowDebtForm(f=>!f)}>+ Nueva deuda</button>
      </div>
      {showDebtForm&&(
        <div style={{...s.card,marginBottom:"10px",border:"1px solid #ef444433"}}>
          <input style={{...s.input,marginBottom:"8px"}} placeholder="Nombre (ej: Addi)" value={newDebt.name} onChange={e=>setNewDebt(p=>({...p,name:e.target.value}))}/>
          <input style={{...s.input,marginBottom:"8px"}} type="number" placeholder="Saldo que debes hoy" value={newDebt.remaining} onChange={e=>setNewDebt(p=>({...p,remaining:e.target.value,total:e.target.value}))}/>
          <input style={{...s.input,marginBottom:"8px"}} type="number" placeholder="Cuota mensual" value={newDebt.monthly} onChange={e=>setNewDebt(p=>({...p,monthly:e.target.value}))}/>
          <div style={{display:"flex",gap:"6px",marginBottom:"10px"}}>
            {["#ef4444","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"].map(c=><div key={c} onClick={()=>setNewDebt(p=>({...p,color:c}))} style={{width:"22px",height:"22px",borderRadius:"50%",background:c,cursor:"pointer",border:newDebt.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button style={s.btn()} onClick={addDebt}>Guardar</button>
            <button style={s.btn("#1a3454","#94a3b8")} onClick={()=>setShowDebtForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {debts.map(debt=>{
        const pct=debt.total>0?Math.round(((debt.total-debt.remaining)/debt.total)*100):0;
        const months=debt.monthly>0?Math.ceil(debt.remaining/debt.monthly):"∞";
        return(
          <div key={debt.id} style={{...s.card,borderLeft:`3px solid ${debt.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
              <div>
                <div style={{fontSize:"14px",fontWeight:"700",color:debt.color}}>{debt.name}</div>
                <div style={{fontSize:"11px",color:"#476282",marginTop:"2px"}}>{fmt(debt.monthly)}/mes · {months} {months!=="∞"?"mes(es)":""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"16px",fontWeight:"800",color:"#ef4444"}}>{fmt(debt.remaining)}</div>
                <div style={{fontSize:"10px",color:"#476282"}}>pendiente</div>
              </div>
            </div>
            <div style={{background:"#1a3454",borderRadius:"4px",height:"5px",marginBottom:"8px"}}>
              <div style={{background:debt.color,height:"100%",borderRadius:"4px",width:pct+"%"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"11px",color:"#476282"}}>{pct}% pagado</span>
              <div style={{display:"flex",gap:"6px"}}>
                {debt.remaining>0&&<button onClick={()=>payDebt(debt.id)} style={{...s.btn("#071a12"),color:"#10b981",border:"1px solid #10b98133",fontSize:"12px",padding:"5px 12px"}}>✓ Pagar</button>}
                {debt.remaining===0&&<span style={{fontSize:"12px",color:"#10b981",fontWeight:"700"}}>🎉 ¡Pagada!</span>}
                <button onClick={()=>setEditingDebt({...debt})} style={{background:"#1a3454",border:"none",borderRadius:"6px",padding:"5px 8px",cursor:"pointer",fontSize:"12px",color:"#94a3b8"}}>✏️</button>
                <button onClick={()=>deleteDebt(debt.id)} style={{background:"#2a1a1a",border:"none",borderRadius:"6px",padding:"5px 8px",cursor:"pointer",fontSize:"12px",color:"#ef4444"}}>🗑️</button>              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const ChatIA=()=>{
    const endRef=useRef(null);
    useEffect(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),[chatMsgs,chatLoading]);
    return(
      <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 190px)",minHeight:"300px"}}>
        <div style={{...s.card,background:"#071a12",border:"1px solid #10b98133",marginBottom:"10px"}}>
          <div style={{fontSize:"12px",color:"#10b981",fontWeight:"600"}}>🤖 Asesor Financiero IA</div>
          <div style={{fontSize:"11px",color:"#476282",marginTop:"2px"}}>Ve tus cuentas, gastos y deudas en tiempo real.</div>
        </div>
        <div style={{flex:1,overflowY:"auto"}}>
          {chatMsgs.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",marginBottom:"2px"}}>
              <div style={s.bubble(m.role==="user")}>{m.content}</div>
            </div>
          ))}
          {chatLoading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={s.bubble(false)}><span style={{color:"#64748b"}}>Analizando...</span></div></div>}
          <div ref={endRef}/>
        </div>
        <div style={{display:"flex",gap:"8px",padding:"10px 0 4px",borderTop:"1px solid #1a3454"}}>
          <input style={{...s.input,flex:1}} placeholder="¿Cuánto tengo en Nequi? ¿Cuándo pago Addi?" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()}/>
          <button style={{...s.btn(),minWidth:"46px",padding:"9px 14px"}} onClick={sendChat} disabled={chatLoading}>➤</button>
        </div>
      </div>
    );
  };

  const nav=[
    {id:"dashboard",   label:"📊 Panel"},
    {id:"accounts",    label:"🏦 Cuentas"},
    {id:"transactions",label:"💸 Movimientos"},
    {id:"budget",      label:"🎯 Presupuesto"},
    {id:"debts",       label:"🔴 Deudas"},
    {id:"chat",        label:"🤖 Chat IA"},
  ];

  return(
    <div style={s.root}>
      <style>{`::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#060d1c}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:4px}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}`}</style>
      
      {/* UNDO TOAST */}
      {undoMsg&&(
        <div style={{position:"fixed",bottom:"24px",left:"50%",transform:"translateX(-50%)",zIndex:300,background:"#0e2a1a",border:"1px solid #10b981",borderRadius:"12px",padding:"10px 16px",display:"flex",alignItems:"center",gap:"12px",boxShadow:"0 4px 24px #00000066",whiteSpace:"nowrap"}}>
          <span style={{fontSize:"13px",color:"#94a3b8"}}>{undoMsg}</span>
          <button onClick={undo} style={{background:"#10b981",color:"#000",border:"none",borderRadius:"7px",padding:"5px 14px",fontSize:"13px",fontWeight:"700",cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>↩ Deshacer</button>
        </div>
      )}
      <div style={s.header}>
        <div style={{fontSize:"17px",fontWeight:"800",color:"#10b981",letterSpacing:"-0.5px"}}>💚 MisFinanzas</div>
        <div style={{fontSize:"11px",background:"#10b98122",color:"#10b981",padding:"3px 10px",borderRadius:"20px",border:"1px solid #10b98144"}}>Rafael &amp; Pareja</div>
      </div>
      <div style={s.nav}>
        {nav.map(v=><button key={v.id} style={s.navBtn(view===v.id)} onClick={()=>setView(v.id)}>{v.label}</button>)}
      </div>
      <div style={s.page}>
        {view==="dashboard"    && <Dashboard/>}
        {view==="accounts"     && <Cuentas/>}
        {view==="transactions" && <Transacciones/>}
        {view==="budget"       && <Presupuesto/>}
        {view==="debts"        && <Deudas/>}
        {view==="chat"         && <ChatIA/>}
      </div>
    </div>
  );
}
