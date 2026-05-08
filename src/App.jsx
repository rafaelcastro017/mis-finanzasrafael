import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis } from "recharts";

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
// Grouped categories - {group, icon, items[]}
const DEFAULT_EXP_GROUPS = [
  {group:"Alimentación",  icon:"🍽️", items:["Comestibles","Restaurante","Bar / Cafetería","Alcohol / Tabaco"]},
  {group:"Transporte",    icon:"🚗", items:["Combustible","Taxi / Uber","Transporte público"]},
  {group:"Hogar",         icon:"🏠", items:["Arriendo","Aseo hogar","Aseo personal","Mascotas","Servicios públicos"]},
  {group:"Tecnología",    icon:"📱", items:["Internet","Teléfono","Suscripciones"]},
  {group:"Deudas",        icon:"💳", items:["Préstamos / Cuotas","Arriendo Novaglamp"]},
  {group:"Novaglamp",     icon:"🏪", items:["Insumos Novaglamp","Insumos Batidos","Mantenimiento"]},
  {group:"Personal",      icon:"👤", items:["Ropa y calzado","Salud","Educación","Entretenimiento"]},
  {group:"Otros",         icon:"📦", items:["Donaciones","Otros"]},
];

const DEFAULT_INC_GROUPS = [
  {group:"Trabajo",       icon:"💼", items:["Salario","Hipnoterapia"]},
  {group:"Novaglamp",     icon:"🏪", items:["Hospedaje","Bebidas","Comida","Masajes"]},
  {group:"Batidos",       icon:"🥤", items:["Batidos Saludables"]},
  {group:"Extras",        icon:"💰", items:["Préstamo recibido","Reembolso","Otros ingresos"]},
];

// Helper: flatten grouped cats to simple array
const flatCats = groups => groups.flatMap(g => g.items);
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

// ── NUM INPUT — no pierde foco, muestra formato al salir ─────────────────────
function NumInput({value, onChange, placeholder, style}) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState(value!=null?String(value):"");
  const fmtN = n => n ? new Intl.NumberFormat("es-CO").format(n) : "";
  const handleChange = e => {
    const v = e.target.value.replace(/[^0-9]/g,"");
    setRaw(v);
    onChange(v ? parseInt(v) : 0);
  };
  // sync raw when value changes externally
  useEffect(()=>{ if(!focused) setRaw(value!=null?String(value):""); },[value,focused]);
  return (
    <input style={style} type="text" inputMode="numeric" placeholder={placeholder}
      value={focused ? raw : (value ? fmtN(value) : "")}
      onFocus={()=>{ setFocused(true); setRaw(value!=null?String(value):""); }}
      onBlur={()=>setFocused(false)}
      onChange={handleChange}
    />
  );
}

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

// ── TRANSFER FORM ─────────────────────────────────────────────────────────────
function TransferForm({accounts, onSave, onCancel}) {
  const [tx, setTx] = useState({
    from: accounts[0]?.id||"", to: accounts[1]?.id||"",
    amount:0, description:"", date:new Date().toISOString().split("T")[0]
  });
  const inp = {width:"100%",background:"#08111f",border:"1px solid #1e3a5f",borderRadius:"9px",padding:"12px",color:"#e2e8f0",fontSize:"16px",fontFamily:"'Sora',sans-serif",outline:"none",boxSizing:"border-box",marginBottom:"8px"};
  const btn = (bg="#10b981",tc="#000")=>({background:bg,color:tc,border:"none",borderRadius:"9px",padding:"10px 20px",fontSize:"14px",fontWeight:"600",cursor:"pointer",fontFamily:"'Sora',sans-serif"});

  const fromAcc = accounts.find(a=>a.id===tx.from);
  const toAcc   = accounts.find(a=>a.id===tx.to);

  return (
    <div style={{background:"#0b1930",border:"1px solid #3b82f644",borderRadius:"14px",padding:"14px",marginBottom:"10px"}}>
      <div style={{fontSize:"13px",fontWeight:"700",color:"#3b82f6",marginBottom:"12px"}}>🔄 Transferencia entre cuentas</div>

      {/* From → To visual */}
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px",background:"#08111f",borderRadius:"10px",padding:"10px"}}>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:"20px"}}>{fromAcc?.icon||"🏦"}</div>
          <div style={{fontSize:"12px",fontWeight:"700",color:"#e2e8f0"}}>{fromAcc?.name||"—"}</div>
          <div style={{fontSize:"10px",color:"#ef4444"}}>Sale</div>
        </div>
        <div style={{fontSize:"20px",color:"#3b82f6"}}>→</div>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:"20px"}}>{toAcc?.icon||"🏦"}</div>
          <div style={{fontSize:"12px",fontWeight:"700",color:"#e2e8f0"}}>{toAcc?.name||"—"}</div>
          <div style={{fontSize:"10px",color:"#10b981"}}>Entra</div>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
        <div>
          <div style={{fontSize:"10px",color:"#476282",marginBottom:"4px",fontWeight:"600"}}>CUENTA ORIGEN</div>
          <select style={{...inp,marginBottom:0}} value={tx.from} onChange={e=>setTx(p=>({...p,from:e.target.value}))}>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
        </div>
        <div>
          <div style={{fontSize:"10px",color:"#476282",marginBottom:"4px",fontWeight:"600"}}>CUENTA DESTINO</div>
          <select style={{...inp,marginBottom:0}} value={tx.to} onChange={e=>setTx(p=>({...p,to:e.target.value}))}>
            {accounts.filter(a=>a.id!==tx.from).map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
        </div>
      </div>

      <NumInput style={inp} placeholder="Monto a transferir" value={tx.amount} onChange={v=>setTx(p=>({...p,amount:v}))}/>
      <input style={inp} type="text" placeholder="Descripción (opcional)" value={tx.description} onChange={e=>setTx(p=>({...p,description:e.target.value}))}/>
      <div style={{marginBottom:"8px"}}>
        <CalendarPicker value={tx.date} onChange={d=>setTx(p=>({...p,date:d}))}/>
      </div>

      {tx.from===tx.to&&<div style={{fontSize:"11px",color:"#ef4444",marginBottom:"8px"}}>⚠️ Las cuentas origen y destino deben ser diferentes</div>}

      <div style={{display:"flex",gap:"8px"}}>
        <button style={btn()} onClick={()=>onSave(tx.from,tx.to,tx.amount,tx.description,tx.date)} disabled={tx.from===tx.to||!tx.amount}>Transferir</button>
        <button style={btn("#1a3454","#94a3b8")} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

// ── TRANSACTION FORM ─────────────────────────────────────────────────────────
function TransactionForm({accounts, expGroups, incGroups, onSave, onCancel}) {
  const expFlat = expGroups.flatMap(g=>g.items);
  const incFlat = incGroups.flatMap(g=>g.items);
  const [tx, setTx] = useState({
    user:"Rafael", account: accounts[0]?.id || "finandina",
    type:"expense", category: expFlat[0] || "Otros",
    amount:"", description:"", date:new Date().toISOString().split("T")[0], shared:false
  });

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
        <select style={sel} value={tx.type} onChange={e=>setTx(p=>({...p,type:e.target.value,category:e.target.value==="income"?incFlat[0]:expFlat[0]}))}>
          <option value="expense">💸 Gasto</option>
          <option value="income">💰 Ingreso</option>
        </select>
      </div>
      <select style={sel} value={tx.account} onChange={e=>setTx(p=>({...p,account:e.target.value}))}>
        {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
      </select>
      <select style={sel} value={tx.category} onChange={e=>setTx(p=>({...p,category:e.target.value}))}>
        {(tx.type==="income"?incGroups:expGroups).map(g=>(
          <optgroup key={g.group} label={`${g.icon} ${g.group}`}>
            {g.items.map(c=><option key={c} value={c}>{c}</option>)}
          </optgroup>
        ))}
      </select>
      <NumInput
        style={inp}
        placeholder="Monto en COP"
        value={tx.amount}
        onChange={v=>setTx(p=>({...p,amount:v}))}
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
  const [debts, setDebts] = useState([
    // type: "solo_interes" | "capital_interes" | "solo_capital"
    // ── Deudas personales ──────────────────────────────────────────────────────
    {id:1,  name:"Norbey",           type:"solo_capital",    total:9000000, remaining:9000000, rate:0,  monthly:1000000, dueDay:null, color:"#ef4444"},
    {id:2,  name:"Andrés Mora 2",    type:"solo_interes",    total:8000000, remaining:8000000, rate:7,  monthly:560000,  dueDay:null, color:"#f97316"},
    {id:3,  name:"Carro",            type:"solo_capital",    total:7000000, remaining:7000000, rate:0,  monthly:500000,  dueDay:null, color:"#f59e0b"},
    {id:4,  name:"Cristina",         type:"solo_interes",    total:6000000, remaining:6000000, rate:0,  monthly:400000,  dueDay:null, color:"#ec4899"},
    {id:5,  name:"Danilo 1",         type:"capital_interes", total:5000000, remaining:5000000, rate:0,  monthly:350000,  dueDay:null, color:"#8b5cf6"},
    {id:6,  name:"Andrés Mora 1",    type:"solo_interes",    total:5000000, remaining:5000000, rate:7,  monthly:350000,  dueDay:null, color:"#a78bfa"},
    {id:7,  name:"José Luis 2",      type:"capital_interes", total:3000000, remaining:3000000, rate:0,  monthly:450000,  dueDay:null, color:"#06b6d4"},
    {id:8,  name:"Danilo 2",         type:"solo_interes",    total:3000000, remaining:3000000, rate:0,  monthly:150000,  dueDay:null, color:"#14b8a6"},
    {id:9,  name:"José Luis 1",      type:"solo_interes",    total:1500000, remaining:1500000, rate:5,  monthly:75000,   dueDay:null, color:"#3b82f6"},
    {id:10, name:"Hilda",            type:"capital_interes", total:250000,  remaining:250000,  rate:0,  monthly:50000,   dueDay:null, color:"#84cc16"},
    // ── Créditos virtuales (capital + interés en cuota) ────────────────────────
    {id:11, name:"Banco de Bogotá",  type:"capital_interes", total:2292924, remaining:2292924, rate:0,  monthly:208264,  dueDay:null, color:"#ef4444"},
    {id:12, name:"Addi",             type:"capital_interes", total:1850888, remaining:1850888, rate:0,  monthly:768481,  dueDay:null, color:"#f97316"},
    {id:13, name:"Banco Serfinanza", type:"capital_interes", total:1710189, remaining:1710189, rate:0,  monthly:517774,  dueDay:null, color:"#f59e0b"},
    {id:14, name:"Credimarcas",      type:"capital_interes", total:945384,  remaining:945384,  rate:0,  monthly:118200,  dueDay:null, color:"#8b5cf6"},
    {id:15, name:"Luego Pago",       type:"capital_interes", total:728205,  remaining:728205,  rate:0,  monthly:147584,  dueDay:null, color:"#ec4899"},
    {id:16, name:"Muebles Milenio",  type:"capital_interes", total:624855,  remaining:624855,  rate:0,  monthly:208285,  dueDay:null, color:"#06b6d4"},
    {id:17, name:"Rapicredit",       type:"capital_interes", total:630000,  remaining:630000,  rate:0,  monthly:630000,  dueDay:null, color:"#dc2626"},
    {id:18, name:"Wasticredit",      type:"capital_interes", total:500000,  remaining:500000,  rate:0,  monthly:500000,  dueDay:null, color:"#ea580c"},
    {id:19, name:"Sistecredito KOAJ",type:"capital_interes", total:326978,  remaining:326978,  rate:0,  monthly:163489,  dueDay:null, color:"#3b82f6"},
    {id:20, name:"Toto",             type:"capital_interes", total:263848,  remaining:263848,  rate:0,  monthly:137116,  dueDay:null, color:"#84cc16"},
    {id:21, name:"Sistecredito D&G", type:"capital_interes", total:82134,   remaining:82134,   rate:0,  monthly:41067,   dueDay:null, color:"#14b8a6"},
  ]);
  const [history,      setHistory]      = useState([]);
  const [undoMsg,      setUndoMsg]      = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [savingsGoal,  setSavingsGoal]  = useState(500000);
  const [filterUser,   setFilterUser]   = useState("Todos");
  const [expCats,      setExpCats]      = useState(DEFAULT_EXP_GROUPS);
  const [incCats,      setIncCats]      = useState(DEFAULT_INC_GROUPS);
  const [ready,        setReady]        = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingTx,    setEditingTx]    = useState(null);
  const [showDebtForm, setShowDebtForm] = useState(false);
  const [editingDebt,  setEditingDebt]  = useState(null);
  const [payingDebt,   setPayingDebt]   = useState(null);
  const [showAccForm,  setShowAccForm]  = useState(false);
  const [newTx,   setNewTx]   = useState({user:"Rafael",account:"finandina",type:"expense",category:"Comestibles",amount:"",description:"",date:today(),shared:false});
  const [newDebt, setNewDebt] = useState({name:"",type:"capital_interes",total:"",remaining:"",monthly:"",rate:"",dueDay:"",color:"#ef4444"});
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
        if(d.expCats?.length)setExpCats(d.expCats);
        if(d.incCats?.length)setIncCats(d.incCats);
        if(d.savingsGoal)setSavingsGoal(d.savingsGoal);
      }
      setReady(true);
    })();
  },[]);

  useEffect(()=>{
    if(!ready)return;
    const data = {transactions,budget,debts,accounts,expCats,incCats,savingsGoal};
    fbSave(data);
    (async()=>{try{await window.storage.set("finanzas_v7",JSON.stringify(data));}catch{}})();
  },[transactions,budget,debts,accounts,expCats,incCats,savingsGoal,ready]);

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

  const catData=flatCats(expCats).map(cat=>({name:cat,value:monthTxs.filter(t=>t.type==="expense"&&t.category===cat).reduce((s,t)=>s+t.amount,0)})).filter(d=>d.value>0).sort((a,b)=>b.value-a.value);
  const budgetRows=flatCats(expCats).map(cat=>{const spent=monthTxs.filter(t=>t.type==="expense"&&t.category===cat).reduce((s,t)=>s+t.amount,0);const limit=budget[cat]||0;return{cat,spent,limit,pct:limit>0?Math.min((spent/limit)*100,100):0};});

  // ── ACTIONS ─────────────────────────────────────────────────────────────────
  const addTx=tx=>{
    if(!tx.amount||!tx.description)return;
    const total=typeof tx.amount==="number"?tx.amount:parseInt(tx.amount)||0;
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
  const addDebt=()=>{
    if(!newDebt.name||!newDebt.total)return;
    const total=parseInt(newDebt.total)||0;
    const remaining=parseInt(newDebt.remaining||newDebt.total)||0;
    const rate=parseFloat(newDebt.rate)||0;
    const monthly=parseInt(newDebt.monthly)||(newDebt.type==="solo_interes"?Math.round(remaining*rate/100):0);
    setDebts(p=>[...p,{...newDebt,id:Date.now(),total,remaining,monthly,rate,dueDay:parseInt(newDebt.dueDay)||null}]);
    setNewDebt({name:"",type:"capital_interes",total:"",remaining:"",monthly:"",rate:"",dueDay:"",color:"#ef4444"});
    setShowDebtForm(false);
  };

  const processTransfer = (fromAcc, toAcc, amount, description, date) => {
    if (!fromAcc || !toAcc || !amount || fromAcc===toAcc) return;
    const from = accounts.find(a=>a.id===fromAcc);
    const to   = accounts.find(a=>a.id===toAcc);
    const desc = description || `Transferencia ${from?.name} → ${to?.name}`;
    const ts = Date.now();
    setTransactions(p=>[
      {id:ts,   user:"Rafael", account:fromAcc, type:"expense", category:"Transferencia", description:desc, amount, date},
      {id:ts+1, user:"Rafael", account:toAcc,   type:"income",  category:"Transferencia", description:desc, amount, date},
      ...p
    ]);
  };

  const openPayDialog = id => {
    const d = debts.find(x=>x.id===id);
    if (!d) return;
    const interestAmt = d.rate > 0 ? Math.round(d.remaining * d.rate / 100) : 0;
    setPayingDebt({
      ...d,
      interestAmt,
      capitalAmt: Math.max(0, d.monthly - interestAmt),
      customAmount: d.monthly || interestAmt,
      payType: d.type === "solo_capital" ? "capital" : d.type === "solo_interes" ? "interes" : "ambos",
      account: "finandina",
    });
  };

  const processPayment = () => {
    if (!payingDebt) return;
    const d = payingDebt;
    const pmt = parseInt(d.customAmount) || 0;
    if (!pmt) return;

    let newRemaining = d.remaining;
    let desc = "";

    if (d.payType === "interes") {
      // Solo interés — capital no cambia
      desc = `Interés: ${d.name}`;
    } else if (d.payType === "capital") {
      // Solo capital
      newRemaining = Math.max(0, d.remaining - pmt);
      desc = `Abono capital: ${d.name}`;
    } else if (d.payType === "ambos") {
      // Capital + interés
      const capitalPortion = Math.max(0, pmt - d.interestAmt);
      newRemaining = Math.max(0, d.remaining - capitalPortion);
      desc = `Cuota: ${d.name} (capital ${fmt(capitalPortion)} + interés ${fmt(d.interestAmt)})`;
    } else if (d.payType === "abono") {
      // Abono libre — va a capital
      newRemaining = Math.max(0, d.remaining - pmt);
      desc = `Abono libre: ${d.name}`;
    }

    setDebts(p => p.map(x => x.id === d.id ? {...x, remaining: newRemaining} : x));
    setTransactions(p => [{
      id: Date.now(), user:"Rafael", account: d.account || "finandina",
      type:"expense", category:"Préstamos / Cuotas",
      description: desc, amount: pmt, date: today()
    }, ...p]);
    setPayingDebt(null);
  };
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

  const sendChat=async(msgParam)=>{
    const msg=(msgParam||chatInput).trim();
    if(!msg||chatLoading)return;
    setChatInput("");
    setChatMsgs(p=>[...p,{role:"user",content:msg}]);setChatLoading(true);
    const ctx=`Cuentas: ${JSON.stringify(accBalances.map(a=>({cuenta:a.name,saldo:fmt(a.balance)})))} | Total disponible: ${fmt(totalBalance)} | Ingresos mes: ${fmt(income)} | Gastos mes: ${fmt(expense)} | Deuda total: ${fmt(totalDebt)} | Cuotas/mes: ${fmt(totalMonthly)} | Deudas: ${JSON.stringify(debts.map(d=>({n:d.name,s:fmt(d.remaining),c:fmt(d.monthly)})))} | Top gastos: ${JSON.stringify(catData.slice(0,6).map(d=>({cat:d.name,monto:fmt(d.value)})))}`;
    try{
      const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`Eres asesor financiero personal de Rafael, colombiano. Datos en tiempo real:\n${ctx}\nResponde en español, conciso y práctico. Montos en COP.`,messages:[...chatMsgs.slice(1).map(m=>({role:m.role,content:m.content})),{role:"user",content:msg}]})});
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

      {dueThisWeek.length>0&&(
        <div style={{...s.card,background:"#1a0f00",border:"1px solid #f59e0b",marginBottom:"10px"}}>
          <div style={{fontSize:"12px",color:"#f59e0b",fontWeight:"700",marginBottom:"6px"}}>⏰ Pagos próximos esta semana</div>
          {dueThisWeek.map(d=>(
            <div key={d.id} style={{display:"flex",justifyContent:"space-between",fontSize:"12px",padding:"3px 0"}}>
              <span style={{color:"#e2e8f0"}}>{d.name}</span>
              <span style={{color:"#f59e0b",fontWeight:"700"}}>{fmt(d.monthly)} · día {d.dueDay}</span>
            </div>
          ))}
        </div>
      )}

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
            <NumInput style={s.input} placeholder="Saldo inicial" value={newAcc.initialBalance} onChange={v=>setNewAcc(p=>({...p,initialBalance:v}))}/>
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
                <NumInput value={acc.initialBalance} onChange={v=>setAccounts(p=>p.map(a=>a.id===acc.id?{...a,initialBalance:v}:a))} style={{...s.input,width:"110px",padding:"4px 8px",fontSize:"12px",textAlign:"right"}}/>
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
        <div style={{display:"flex",gap:"6px"}}>
          <button style={s.btn("#1a3454","#3b82f6")} onClick={()=>{setShowTransfer(f=>!f);setShowForm(false);}}>🔄</button>
          <button style={s.btn()} onClick={()=>{setShowForm(f=>!f);setShowTransfer(false);}}>+ Nuevo</button>
        </div>
      </div>

      {showTransfer && (
        <TransferForm
          accounts={accounts}
          onSave={(from,to,amount,desc,date)=>{ processTransfer(from,to,amount,desc,date); setShowTransfer(false); }}
          onCancel={()=>setShowTransfer(false)}
        />
      )}

      {showForm && (
        <TransactionForm
          accounts={accounts}
          expGroups={expCats}
          incGroups={incCats}
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
              {(editingTx.type==="income"?incCats:expCats).map(g=>(
                <optgroup key={g.group} label={`${g.icon} ${g.group}`}>
                  {g.items.map(c=><option key={c} value={c}>{c}</option>)}
                </optgroup>
              ))}
            </select>
            <NumInput style={{...s.input,marginBottom:"8px"}} placeholder="Monto" value={editingTx.amount} onChange={v=>setEditingTx(p=>({...p,amount:v}))}/>
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
                <div style={{width:"32px",height:"32px",borderRadius:"8px",background:tx.category==="Transferencia"?"#3b82f622":tx.type==="income"?"#10b98118":"#ef444418",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0}}>{tx.category==="Transferencia"?"🔄":tx.type==="income"?"💰":"💸"}</div>
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
              <NumInput value={limit} onChange={v=>setBudget(p=>({...p,[cat]:v}))} style={{...s.input,width:"100px",padding:"4px 8px",fontSize:"12px",textAlign:"right"}}/>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const DEBT_TYPE_LABELS = {
    "solo_interes":    {label:"Solo interés",    color:"#f59e0b", desc:"Capital no baja"},
    "capital_interes": {label:"Capital + Interés",color:"#3b82f6", desc:"Cuota cubre ambos"},
    "solo_capital":    {label:"Solo capital",    color:"#10b981", desc:"Sin interés"},
  };

  const Deudas=()=>{
    const inp = {...s.input, marginBottom:"8px"};
    const colors = ["#ef4444","#f97316","#f59e0b","#10b981","#3b82f6","#8b5cf6","#ec4899"];

    return(
    <div>
      {/* ── Payment Dialog ──────────────────────────────────────────── */}
      {payingDebt&&(
        <div style={{position:"fixed",inset:0,background:"#000000cc",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{...s.card,width:"100%",maxWidth:"400px",border:`1px solid ${payingDebt.color}55`}}>
            <div style={{fontSize:"15px",fontWeight:"800",color:payingDebt.color,marginBottom:"4px"}}>💳 Registrar pago</div>
            <div style={{fontSize:"12px",color:"#476282",marginBottom:"14px"}}>{payingDebt.name} · Capital pendiente: {fmt(payingDebt.remaining)}</div>

            {/* Info chips */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginBottom:"14px"}}>
              <div style={{background:"#08111f",borderRadius:"8px",padding:"7px",textAlign:"center"}}>
                <div style={{fontSize:"9px",color:"#476282"}}>Cuota</div>
                <div style={{fontSize:"12px",fontWeight:"700",color:"#e2e8f0"}}>{fmt(payingDebt.monthly)}</div>
              </div>
              <div style={{background:"#1a0f00",borderRadius:"8px",padding:"7px",textAlign:"center"}}>
                <div style={{fontSize:"9px",color:"#476282"}}>Interés</div>
                <div style={{fontSize:"12px",fontWeight:"700",color:"#f59e0b"}}>{fmt(payingDebt.interestAmt)}</div>
              </div>
              <div style={{background:"#071a12",borderRadius:"8px",padding:"7px",textAlign:"center"}}>
                <div style={{fontSize:"9px",color:"#476282"}}>A capital</div>
                <div style={{fontSize:"12px",fontWeight:"700",color:"#10b981"}}>{fmt(payingDebt.payType==="ambos"?Math.max(0,(parseInt(payingDebt.customAmount)||0)-payingDebt.interestAmt):payingDebt.payType==="capital"||payingDebt.payType==="abono"?(parseInt(payingDebt.customAmount)||0):0)}</div>
              </div>
            </div>

            {/* Payment type */}
            <div style={{fontSize:"11px",color:"#476282",marginBottom:"6px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"1px"}}>Tipo de pago</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"12px"}}>
              {[
                {key:"ambos",   label:"💳 Capital + Interés", amount: payingDebt.monthly},
                {key:"interes", label:"📊 Solo Interés",       amount: payingDebt.interestAmt},
                {key:"capital", label:"🏦 Solo Capital",       amount: payingDebt.capitalAmt},
                {key:"abono",   label:"💰 Abono libre",        amount: null},
              ].map(opt=>(
                <div key={opt.key} onClick={()=>setPayingDebt(p=>({...p, payType:opt.key, customAmount: opt.amount||p.customAmount}))}
                  style={{padding:"8px 10px",borderRadius:"9px",border:`1px solid ${payingDebt.payType===opt.key?payingDebt.color:"#1e3a5f"}`,background:payingDebt.payType===opt.key?payingDebt.color+"22":"transparent",cursor:"pointer"}}>
                  <div style={{fontSize:"12px",fontWeight:"600",color:payingDebt.payType===opt.key?payingDebt.color:"#94a3b8"}}>{opt.label}</div>
                  {opt.amount!=null&&<div style={{fontSize:"10px",color:"#476282",marginTop:"2px"}}>{fmt(opt.amount)}</div>}
                </div>
              ))}
            </div>

            {/* Amount */}
            <div style={{fontSize:"11px",color:"#476282",marginBottom:"6px",fontWeight:"600",textTransform:"uppercase",letterSpacing:"1px"}}>Monto a pagar</div>
            <NumInput style={{...s.input,marginBottom:"8px",fontSize:"18px",fontWeight:"700"}}
              placeholder="Monto" value={payingDebt.customAmount}
              onChange={v=>setPayingDebt(p=>({...p,customAmount:v}))}/>

            {/* Account */}
            <select style={{...s.select,marginBottom:"14px"}} value={payingDebt.account||"finandina"} onChange={e=>setPayingDebt(p=>({...p,account:e.target.value}))}>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
            </select>

            {/* New remaining preview */}
            {payingDebt.payType!=="interes"&&(
              <div style={{background:"#071a12",border:"1px solid #10b98133",borderRadius:"8px",padding:"8px",marginBottom:"12px",textAlign:"center"}}>
                <div style={{fontSize:"11px",color:"#476282"}}>Capital restante después del pago</div>
                <div style={{fontSize:"16px",fontWeight:"800",color:"#10b981"}}>
                  {fmt(Math.max(0, payingDebt.remaining - (
                    payingDebt.payType==="capital"||payingDebt.payType==="abono"
                      ? (parseInt(payingDebt.customAmount)||0)
                      : Math.max(0,(parseInt(payingDebt.customAmount)||0)-payingDebt.interestAmt)
                  )))}
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:"8px"}}>
              <button style={s.btn()} onClick={processPayment}>✓ Confirmar pago</button>
              <button style={s.btn("#1a3454","#94a3b8")} onClick={()=>setPayingDebt(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit modal */}
      {editingDebt&&(
        <div style={{position:"fixed",inset:0,background:"#000000bb",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",overflowY:"auto"}}>
          <div style={{...s.card,width:"100%",maxWidth:"400px",border:`1px solid ${editingDebt.color}55`}}>
            <div style={{fontSize:"14px",fontWeight:"700",color:editingDebt.color,marginBottom:"12px"}}>✏️ Editar deuda</div>
            <input style={inp} placeholder="Nombre" value={editingDebt.name} onChange={e=>setEditingDebt(p=>({...p,name:e.target.value}))}/>
            <select style={inp} value={editingDebt.type||"capital_interes"} onChange={e=>setEditingDebt(p=>({...p,type:e.target.value}))}>
              <option value="capital_interes">Capital + Interés (cuota incluye ambos)</option>
              <option value="solo_interes">Solo Interés (capital no baja)</option>
              <option value="solo_capital">Solo Capital (sin interés)</option>
            </select>
            <NumInput style={inp} placeholder="Capital pendiente" value={editingDebt.remaining} onChange={v=>setEditingDebt(p=>({...p,remaining:v}))}/>
            <NumInput style={inp} placeholder="Cuota mensual" value={editingDebt.monthly} onChange={v=>setEditingDebt(p=>({...p,monthly:v}))}/>
            {(editingDebt.type==="solo_interes"||editingDebt.type==="capital_interes")&&(
              <input style={{...inp,marginBottom:"8px"}} type="text" inputMode="decimal" placeholder="Tasa de interés % mensual (ej: 5, 7)" value={editingDebt.rate||""} onChange={e=>setEditingDebt(p=>({...p,rate:parseFloat(e.target.value)||0}))}/>
            )}
            <input style={inp} type="text" inputMode="numeric" placeholder="Día de pago del mes (ej: 5)" value={editingDebt.dueDay||""} onChange={e=>setEditingDebt(p=>({...p,dueDay:parseInt(e.target.value)||null}))}/>
            <div style={{display:"flex",gap:"6px",marginBottom:"10px"}}>
              {colors.map(c=><div key={c} onClick={()=>setEditingDebt(p=>({...p,color:c}))} style={{width:"22px",height:"22px",borderRadius:"50%",background:c,cursor:"pointer",border:editingDebt.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button style={s.btn()} onClick={saveDebtEdit}>Guardar</button>
              <button style={s.btn("#1a3454","#94a3b8")} onClick={()=>setEditingDebt(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
        <div style={{...s.card,background:"#1a0808",border:"1px solid #ef444433"}}>
          <div style={s.label}>Deuda total</div>
          <div style={{fontSize:"16px",fontWeight:"800",color:"#ef4444"}}>{fmt(totalDebt)}</div>
        </div>
        <div style={{...s.card,background:"#1a0f00",border:"1px solid #f59e0b33"}}>
          <div style={s.label}>Cuotas/mes</div>
          <div style={{fontSize:"16px",fontWeight:"800",color:"#f59e0b"}}>{fmt(totalMonthly)}</div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
        <div style={{...s.card,background:"#1a0808",border:"1px solid #ef444433"}}>
          <div style={s.label}>Personales</div>
          <div style={{fontSize:"14px",fontWeight:"800",color:"#ef4444"}}>{fmt(debts.slice(0,10).reduce((s,d)=>s+d.remaining,0))}</div>
        </div>
        <div style={{...s.card,background:"#1a0f00",border:"1px solid #f59e0b33"}}>
          <div style={s.label}>Créditos virtuales</div>
          <div style={{fontSize:"14px",fontWeight:"800",color:"#f59e0b"}}>{fmt(debts.slice(10).reduce((s,d)=>s+d.remaining,0))}</div>
        </div>
      </div>

      {totalMonthly>income&&(
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
          <div style={{fontSize:"13px",fontWeight:"700",color:"#ef4444",marginBottom:"10px"}}>Nueva deuda</div>
          <input style={inp} placeholder="Nombre" value={newDebt.name} onChange={e=>setNewDebt(p=>({...p,name:e.target.value}))}/>
          <select style={inp} value={newDebt.type} onChange={e=>setNewDebt(p=>({...p,type:e.target.value}))}>
            <option value="capital_interes">Capital + Interés (cuota incluye ambos)</option>
            <option value="solo_interes">Solo Interés (capital no baja)</option>
            <option value="solo_capital">Solo Capital (sin interés)</option>
          </select>
          <NumInput style={inp} placeholder="Capital total" value={newDebt.total} onChange={v=>setNewDebt(p=>({...p,total:v,remaining:v}))}/>
          <NumInput style={inp} placeholder="Saldo pendiente hoy" value={newDebt.remaining} onChange={v=>setNewDebt(p=>({...p,remaining:v}))}/>
          <NumInput style={inp} placeholder="Cuota mensual" value={newDebt.monthly} onChange={v=>setNewDebt(p=>({...p,monthly:v}))}/>
          {(newDebt.type==="solo_interes"||newDebt.type==="capital_interes")&&(
            <input style={inp} type="text" inputMode="decimal" placeholder="Tasa % mensual (ej: 5)" value={newDebt.rate} onChange={e=>setNewDebt(p=>({...p,rate:e.target.value}))}/>
          )}
          <input style={inp} type="text" inputMode="numeric" placeholder="Día de pago (ej: 5)" value={newDebt.dueDay} onChange={e=>setNewDebt(p=>({...p,dueDay:e.target.value}))}/>
          <div style={{display:"flex",gap:"6px",marginBottom:"10px"}}>
            {colors.map(c=><div key={c} onClick={()=>setNewDebt(p=>({...p,color:c}))} style={{width:"22px",height:"22px",borderRadius:"50%",background:c,cursor:"pointer",border:newDebt.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button style={s.btn()} onClick={addDebt}>Guardar</button>
            <button style={s.btn("#1a3454","#94a3b8")} onClick={()=>setShowDebtForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {debts.map(debt=>{
        const pct = debt.total>0 ? Math.round(((debt.total-debt.remaining)/debt.total)*100) : 0;
        const interestAmt = debt.rate>0 ? Math.round(debt.remaining*debt.rate/100) : 0;
        const capitalAmt = debt.type==="solo_interes" ? 0 : debt.type==="solo_capital" ? debt.monthly : Math.max(0, debt.monthly - interestAmt);
        const months = debt.type==="solo_interes" ? "∞" : capitalAmt>0 ? Math.ceil(debt.remaining/capitalAmt) : "∞";
        const typeInfo = DEBT_TYPE_LABELS[debt.type||"capital_interes"];
        return(
          <div key={debt.id} style={{...s.card,borderLeft:`3px solid ${debt.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
              <div>
                <div style={{fontSize:"14px",fontWeight:"700",color:debt.color}}>{debt.name}</div>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"}}>
                  <span style={{fontSize:"10px",background:typeInfo.color+"22",color:typeInfo.color,padding:"1px 6px",borderRadius:"8px",fontWeight:"600"}}>{typeInfo.label}</span>
                  {debt.rate>0&&<span style={{fontSize:"10px",color:"#476282"}}>{debt.rate}% mensual</span>}
                  {debt.dueDay&&<span style={{fontSize:"10px",color:"#476282"}}>Día {debt.dueDay}</span>}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"16px",fontWeight:"800",color:"#ef4444"}}>{fmt(debt.remaining)}</div>
                <div style={{fontSize:"10px",color:"#476282"}}>capital pendiente</div>
              </div>
            </div>

            {/* Payment breakdown */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"4px",marginBottom:"8px"}}>
              <div style={{background:"#08111f",borderRadius:"6px",padding:"5px",textAlign:"center"}}>
                <div style={{fontSize:"9px",color:"#476282"}}>Cuota</div>
                <div style={{fontSize:"11px",fontWeight:"700",color:"#e2e8f0"}}>{fmt(debt.monthly)}</div>
              </div>
              <div style={{background:"#1a0808",borderRadius:"6px",padding:"5px",textAlign:"center"}}>
                <div style={{fontSize:"9px",color:"#476282"}}>Interés</div>
                <div style={{fontSize:"11px",fontWeight:"700",color:"#f59e0b"}}>{fmt(interestAmt)}</div>
              </div>
              <div style={{background:"#071a12",borderRadius:"6px",padding:"5px",textAlign:"center"}}>
                <div style={{fontSize:"9px",color:"#476282"}}>A capital</div>
                <div style={{fontSize:"11px",fontWeight:"700",color:"#10b981"}}>{fmt(capitalAmt)}</div>
              </div>
            </div>

            <div style={{background:"#1a3454",borderRadius:"4px",height:"4px",marginBottom:"6px"}}>
              <div style={{background:debt.color,height:"100%",borderRadius:"4px",width:pct+"%"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"11px",color:"#476282"}}>{pct}% pagado · {months!=="∞"?`${months} mes(es)`:debt.type==="solo_interes"?"Solo interés perpetuo":"∞"}</span>
              <div style={{display:"flex",gap:"5px"}}>
                {debt.remaining>0&&<button onClick={()=>openPayDialog(debt.id)} style={{...s.btn("#071a12"),color:"#10b981",border:"1px solid #10b98133",fontSize:"11px",padding:"4px 10px"}}>💳 Pagar</button>}
                {debt.remaining===0&&debt.type!=="solo_interes"&&<span style={{fontSize:"11px",color:"#10b981",fontWeight:"700"}}>🎉 ¡Pagado!</span>}
                <button onClick={()=>setEditingDebt({...debt})} style={{background:"#1a3454",border:"none",borderRadius:"6px",padding:"4px 7px",cursor:"pointer",fontSize:"11px",color:"#94a3b8"}}>✏️</button>
                <button onClick={()=>deleteDebt(debt.id)} style={{background:"#2a1a1a",border:"none",borderRadius:"6px",padding:"4px 7px",cursor:"pointer",fontSize:"11px",color:"#ef4444"}}>🗑️</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    );
  };

  const ChatIA=()=>{
    const endRef=useRef(null);
    const inputRef=useRef(null);
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
          <input
            ref={inputRef}
            style={{...s.input,flex:1,fontSize:"16px"}}
            placeholder="¿Cuánto tengo en Nequi? ¿Cuándo pago Addi?"
            defaultValue=""
            onKeyDown={e=>{
              if(e.key==="Enter"){
                const v=e.target.value.trim();
                if(v){ setChatInput(v); e.target.value=""; sendChat(v); }
              }
            }}
          />
          <button style={{...s.btn(),minWidth:"46px",padding:"9px 14px"}} onClick={()=>{
            const v=inputRef.current?.value?.trim();
            if(v){ setChatInput(v); inputRef.current.value=""; sendChat(v); }
          }} disabled={chatLoading}>➤</button>
        </div>
      </div>
    );
  };

  // ── PAYMENT REMINDERS ────────────────────────────────────────────────────────
  const today2 = new Date();
  const dayOfMonth = today2.getDate();
  const dueThisWeek = debts.filter(d => d.remaining > 0 && d.dueDay && Math.abs(d.dueDay - dayOfMonth) <= 5);

  // ── MONTH COMPARISON DATA ─────────────────────────────────────────────────────
  const last6Months = Array.from({length:6},(_,i)=>{
    const d = new Date(); d.setMonth(d.getMonth()-i);
    return d.toISOString().slice(0,7);
  }).reverse();

  const monthCompData = last6Months.map(m=>{
    const txs = transactions.filter(t=>t.date.startsWith(m));
    return {
      mes: m.slice(5)+"/"+m.slice(2,4),
      ingresos: txs.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),
      gastos: txs.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),
    };
  });

  // ── DEBT PROJECTION ───────────────────────────────────────────────────────────
  const debtProjection = Array.from({length:24},(_,i)=>{
    const totalRemaining = debts.reduce((s,d)=>{
      const remaining = Math.max(0, d.remaining - (d.monthly * i));
      return s + remaining;
    },0);
    const d = new Date(); d.setMonth(d.getMonth()+i);
    return { mes: d.toISOString().slice(5,7)+"/"+d.toISOString().slice(2,4), deuda: totalRemaining };
  });

  const Reportes=()=>(
    <div>
      {/* Meta de ahorro */}
      <div style={s.card}>
        <div style={s.secTitle}>🎯 Meta de ahorro mensual</div>
        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
          <NumInput value={savingsGoal} onChange={v=>setSavingsGoal(v)}
            style={{...s.input,width:"150px",fontSize:"16px",fontWeight:"700"}}/>
          <span style={{fontSize:"12px",color:"#476282"}}>meta/mes</span>
        </div>
        {(() => {
          const saved = income - expense;
          const pct = savingsGoal > 0 ? Math.min((saved/savingsGoal)*100, 100) : 0;
          const onTrack = saved >= savingsGoal;
          return (
            <>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"6px"}}>
                <span style={{fontSize:"13px",color:onTrack?"#10b981":"#f59e0b",fontWeight:"700"}}>{onTrack?"✅ ¡Meta cumplida!":"⚠️ Por debajo de la meta"}</span>
                <span style={{fontSize:"13px",fontWeight:"700",color:onTrack?"#10b981":"#f59e0b"}}>{fmt(saved)} / {fmt(savingsGoal)}</span>
              </div>
              <div style={{background:"#1a3454",borderRadius:"6px",height:"8px"}}>
                <div style={{background:onTrack?"#10b981":"#f59e0b",height:"100%",borderRadius:"6px",width:Math.max(pct,0)+"%"}}/>
              </div>
            </>
          );
        })()}
      </div>

      {/* Reporte mensual */}
      <div style={s.card}>
        <div style={s.secTitle}>📋 Reporte — {thisMonth()}</div>
        {[
          {label:"Ingresos totales", value:income, color:"#10b981"},
          {label:"Gastos totales",   value:expense, color:"#ef4444"},
          {label:"Pagos de deudas",  value:monthTxs.filter(t=>t.type==="expense"&&t.category==="Préstamos / Cuotas").reduce((s,t)=>s+t.amount,0), color:"#f59e0b"},
          {label:"Balance neto",     value:income-expense, color:income-expense>=0?"#10b981":"#ef4444"},
        ].map(r=>(
          <div key={r.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1a345422"}}>
            <span style={{fontSize:"13px",color:"#94a3b8"}}>{r.label}</span>
            <span style={{fontSize:"14px",fontWeight:"700",color:r.color}}>{fmt(r.value)}</span>
          </div>
        ))}
      </div>

      {/* Comparativo de meses */}
      <div style={s.card}>
        <div style={s.secTitle}>📊 Comparativo últimos 6 meses</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthCompData} barSize={16}>
            <XAxis dataKey="mes" tick={{fontSize:10,fill:"#476282"}}/>
            <YAxis tick={{fontSize:9,fill:"#476282"}} tickFormatter={v=>v>=1000000?`$${(v/1000000).toFixed(1)}M`:v>=1000?`$${(v/1000).toFixed(0)}K`:`$${v}`}/>
            <Tooltip formatter={v=>fmt(v)} contentStyle={{background:"#0b1930",border:"1px solid #1a3454",borderRadius:"8px",color:"#e2e8f0",fontSize:"12px"}}/>
            <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" radius={[4,4,0,0]}/>
            <Bar dataKey="gastos"   fill="#ef4444" name="Gastos"   radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{display:"flex",gap:"16px",justifyContent:"center",marginTop:"6px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"11px",color:"#94a3b8"}}><div style={{width:"10px",height:"10px",borderRadius:"2px",background:"#10b981"}}/> Ingresos</div>
          <div style={{display:"flex",alignItems:"center",gap:"4px",fontSize:"11px",color:"#94a3b8"}}><div style={{width:"10px",height:"10px",borderRadius:"2px",background:"#ef4444"}}/> Gastos</div>
        </div>
      </div>

      {/* Proyección de deudas */}
      <div style={s.card}>
        <div style={s.secTitle}>📉 Proyección de deudas (24 meses)</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={debtProjection}>
            <XAxis dataKey="mes" tick={{fontSize:9,fill:"#476282"}} interval={3}/>
            <YAxis tick={{fontSize:9,fill:"#476282"}} tickFormatter={v=>v>=1000000?`$${(v/1000000).toFixed(0)}M`:v>=1000?`$${(v/1000).toFixed(0)}K`:`$${v}`}/>
            <Tooltip formatter={v=>fmt(v)} contentStyle={{background:"#0b1930",border:"1px solid #1a3454",borderRadius:"8px",color:"#e2e8f0",fontSize:"12px"}}/>
            <Area type="monotone" dataKey="deuda" stroke="#ef4444" fill="#ef444422" name="Deuda total"/>
          </AreaChart>
        </ResponsiveContainer>
        <div style={{fontSize:"11px",color:"#476282",textAlign:"center",marginTop:"6px"}}>
          {debtProjection.find(d=>d.deuda===0) ? `✅ Libre de deudas en ${debtProjection.find(d=>d.deuda===0)?.mes}` : "Ajusta las cuotas para acelerar el pago"}
        </div>
      </div>
    </div>
  );

  const Categorias=()=>{
    const [tab,        setTab]        = useState("expense");
    const [newGroup,   setNewGroup]   = useState("");
    const [newItem,    setNewItem]    = useState({group:"", value:""});
    const [editItem,   setEditItem]   = useState(null);
    const [editVal,    setEditVal]    = useState("");

    const groups = tab==="expense" ? expCats : incCats;
    const setGroups = tab==="expense" ? setExpCats : setIncCats;

    const addGroup = () => { if(!newGroup.trim())return; setGroups(p=>[...p,{group:newGroup.trim(),icon:"📦",items:[]}]); setNewGroup(""); };
    const delGroup = g => setGroups(p=>p.filter(x=>x.group!==g));
    const addItem  = g => { if(!newItem.value.trim()||newItem.group!==g)return; setGroups(p=>p.map(x=>x.group===g?{...x,items:[...x.items,newItem.value.trim()]}:x)); setNewItem({group:"",value:""}); };
    const delItem  = (g,item) => setGroups(p=>p.map(x=>x.group===g?{...x,items:x.items.filter(i=>i!==item)}:x));
    const startEdit= (g,item) => { setEditItem({g,item}); setEditVal(item); };
    const saveEdit = () => { if(!editVal.trim())return; setGroups(p=>p.map(x=>x.group===editItem.g?{...x,items:x.items.map(i=>i===editItem.item?editVal.trim():i)}:x)); setEditItem(null); };

    const inp = {width:"100%",background:"#08111f",border:"1px solid #1e3a5f",borderRadius:"9px",padding:"10px 12px",color:"#e2e8f0",fontSize:"14px",fontFamily:"'Sora',sans-serif",outline:"none",boxSizing:"border-box"};

    return(
      <div>
        <div style={{...s.card,background:"#071a12",border:"1px solid #10b98133"}}>
          <div style={{fontSize:"13px",color:"#10b981",fontWeight:"600"}}>🏷️ Categorías agrupadas</div>
          <div style={{fontSize:"11px",color:"#476282",marginTop:"2px"}}>Grupos y subcategorías como en Wallet.</div>
        </div>

        <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
          {["expense","income"].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:"7px 16px",borderRadius:"18px",border:`1px solid ${tab===t?"#10b981":"#1e3a5f"}`,background:tab===t?"#10b981":"transparent",color:tab===t?"#000":"#64748b",fontSize:"12px",fontWeight:"600",cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>
              {t==="expense"?"💸 Gastos":"💰 Ingresos"}
            </button>
          ))}
        </div>

        {/* Add group */}
        <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
          <input style={{...inp,flex:1}} placeholder="Nuevo grupo (ej: Salud)" value={newGroup} onChange={e=>setNewGroup(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGroup()}/>
          <button onClick={addGroup} style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:"9px",padding:"10px 14px",fontSize:"13px",fontWeight:"700",cursor:"pointer",fontFamily:"'Sora',sans-serif"}}>+ Grupo</button>
        </div>

        {groups.map(g=>(
          <div key={g.group} style={{...s.card,marginBottom:"8px"}}>
            {/* Group header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
              <div style={{fontSize:"14px",fontWeight:"700",color:"#e2e8f0"}}>{g.icon} {g.group}</div>
              <button onClick={()=>delGroup(g.group)} style={{background:"#2a1a1a",border:"none",borderRadius:"6px",padding:"4px 8px",cursor:"pointer",fontSize:"11px",color:"#ef4444"}}>🗑️ Grupo</button>
            </div>

            {/* Items */}
            {g.items.map(item=>(
              <div key={item} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0 6px 12px",borderBottom:"1px solid #1a345422"}}>
                {editItem?.g===g.group&&editItem?.item===item ? (
                  <div style={{display:"flex",gap:"6px",flex:1,marginRight:"8px"}}>
                    <input style={{...inp,flex:1,padding:"5px 10px",fontSize:"13px"}} value={editVal} onChange={e=>setEditVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEdit()} autoFocus/>
                    <button onClick={saveEdit} style={{background:"#10b981",color:"#000",border:"none",borderRadius:"6px",padding:"5px 10px",cursor:"pointer",fontSize:"12px",fontWeight:"700"}}>✓</button>
                  </div>
                ) : (
                  <span style={{fontSize:"13px",color:"#94a3b8"}}>• {item}</span>
                )}
                {!(editItem?.g===g.group&&editItem?.item===item)&&(
                  <div style={{display:"flex",gap:"4px"}}>
                    <button onClick={()=>startEdit(g.group,item)} style={{background:"#1a3454",border:"none",borderRadius:"5px",padding:"3px 7px",cursor:"pointer",fontSize:"11px",color:"#94a3b8"}}>✏️</button>
                    <button onClick={()=>delItem(g.group,item)} style={{background:"#2a1a1a",border:"none",borderRadius:"5px",padding:"3px 7px",cursor:"pointer",fontSize:"11px",color:"#ef4444"}}>🗑️</button>
                  </div>
                )}
              </div>
            ))}

            {/* Add item to group */}
            <div style={{display:"flex",gap:"6px",marginTop:"8px"}}>
              <input style={{...inp,flex:1,padding:"7px 10px",fontSize:"12px"}}
                placeholder={`+ Subcategoría en ${g.group}`}
                value={newItem.group===g.group?newItem.value:""}
                onChange={e=>setNewItem({group:g.group,value:e.target.value})}
                onKeyDown={e=>e.key==="Enter"&&addItem(g.group)}/>
              <button onClick={()=>addItem(g.group)} style={{background:"#10b98133",color:"#10b981",border:"1px solid #10b98155",borderRadius:"7px",padding:"7px 12px",cursor:"pointer",fontSize:"12px",fontWeight:"700"}}>+</button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const nav=[
    {id:"dashboard",   label:"📊 Panel"},
    {id:"accounts",    label:"🏦 Cuentas"},
    {id:"transactions",label:"💸 Movimientos"},
    {id:"budget",      label:"🎯 Presupuesto"},
    {id:"debts",       label:"🔴 Deudas"},
    {id:"reportes",    label:"📈 Reportes"},
    {id:"categorias",  label:"🏷️ Categorías"},
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
        {view==="reportes"     && <Reportes/>}
        {view==="categorias"   && <Categorias/>}
        {view==="chat"         && <ChatIA/>}
      </div>
    </div>
  );
}
