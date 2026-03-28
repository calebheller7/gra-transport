import { useState, useEffect, useRef } from "react";

// ─── THEME ───────────────────────────────────────────────────────
const C = {
  cream:"#FAF6EF", parchment:"#F2EAD8", gold:"#B8832A", goldLight:"#D4A44C",
  goldBg:"#FDF3E0", brown:"#3D2910", brownMid:"#6B4423", brownLight:"#A07040",
  green:"#2A5C42", greenLight:"#3D7A5A", greenBg:"#EAF4EE",
  red:"#B03020", redBg:"#FDECEA", blue:"#1A4A7A", blueBg:"#E8F0FA",
  gray:"#7A6E62", grayLight:"#E8E0D4", white:"#FFFFFF",
};
const shadow = "0 2px 16px rgba(61,41,16,0.10)";
const shadowLg = "0 8px 40px rgba(61,41,16,0.18)";
const font = "'DM Sans', sans-serif";
const serif = "'Lora', serif";

// ─── SEED DATA ────────────────────────────────────────────────────
const SEED_DRIVERS = [
  {id:"d1",name:"Deacon James",phone:"555-0101",seats:5,available:true,zones:["North","East"]},
  {id:"d2",name:"Sister Ruth", phone:"555-0102",seats:4,available:true, zones:["South","West"]},
  {id:"d3",name:"Brother Paul",phone:"555-0103",seats:6,available:false,zones:["East","Central"]},
];
const SEED_MEMBERS = [
  {id:"mb1",name:"Mother Agnes",    phone:"555-0111",address:"42 Oak Lane, Essex, MD",   zone:"North",rides:18},
  {id:"mb2",name:"Elder Thomas",    phone:"555-0122",address:"7 Birch Rd, Essex, MD",    zone:"East", rides:24},
  {id:"mb3",name:"Patricia Williams",phone:"555-0199",address:"91 Cedar Blvd, Essex, MD",zone:"West", rides:9},
  {id:"mb4",name:"Johnson Family",  phone:"555-0133",address:"18 Maple Ave, Essex, MD",  zone:"South",rides:6},
];
const SEED_REQUESTS = [
  {id:"r1",name:"Mother Agnes",   phone:"555-0111",type:"Sunday Morning Service",date:"2026-03-29",zone:"North",address:"42 Oak Lane, Essex, MD",   passengers:"1",notes:"Needs boarding help",status:"assigned",driverId:"d1"},
  {id:"r2",name:"Johnson Family", phone:"555-0133",type:"Youth Program",         date:"2026-03-29",zone:"South",address:"18 Maple Ave, Essex, MD",   passengers:"3",notes:"3 children ages 7-12",status:"pending", driverId:null},
  {id:"r3",name:"Elder Thomas",   phone:"555-0122",type:"Sunday Morning Service",date:"2026-03-29",zone:"East", address:"7 Birch Rd, Essex, MD",    passengers:"1",notes:"",status:"assigned",driverId:"d1"},
  {id:"r4",name:"Williams Family",phone:"555-0199",type:"Special Event / Trip",  date:"2026-04-05",zone:"West", address:"91 Cedar Blvd, Essex, MD",  passengers:"4",notes:"Family of 4",status:"pending",driverId:null},
];
const SEED_ADMINS = [
  {email:"admin@grace.org",password:"grace2024",name:"Coordinator Sandra"},
  {email:"pastor@grace.org",password:"grace2024",name:"Pastor Michael"},
];

// ─── STORAGE ─────────────────────────────────────────────────────
function ls(key,seed){ try{const d=localStorage.getItem(key);return d?JSON.parse(d):JSON.parse(JSON.stringify(seed));}catch{return JSON.parse(JSON.stringify(seed));} }
function ss(key,val){ try{localStorage.setItem(key,JSON.stringify(val));}catch{} }

// ─── HELPERS ─────────────────────────────────────────────────────
const ZONE_COLORS = {North:"#185fa5",South:"#993556",East:"#2A5C42",West:"#B8832A",Central:"#555","Not sure":"#888"};
const avatarColors = ["#B8832A","#2A5C42","#1A4A7A","#993556","#3D2910","#6B4423"];
function av(name,i){ return {bg:avatarColors[i%avatarColors.length]+"22",col:avatarColors[i%avatarColors.length],initials:name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}; }

// ─── SHARED COMPONENTS ───────────────────────────────────────────
function Topbar({logo,name,role,right,onBack}){
  return(
    <div style={{background:C.brown,padding:"0 1.5rem",height:54,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{width:32,height:32,borderRadius:"50%",background:C.goldBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:C.brown}}>{logo}</div>
        <div><div style={{fontFamily:serif,fontSize:15,color:C.goldLight}}>{name}</div><div style={{fontSize:11,color:"#8A7060",textTransform:"uppercase",letterSpacing:"0.08em"}}>{role}</div></div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {right}
        {onBack&&<button onClick={onBack} style={{background:"transparent",border:"1px solid #5A3A1A",color:"#9A7A5A",fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer"}}>← Back</button>}
      </div>
    </div>
  );
}
function Badge({type}){
  const styles={pending:{bg:"#FEF3C7",col:"#92400E"},assigned:{bg:C.greenBg,col:C.green},completed:{bg:C.grayLight,col:C.gray},available:{bg:C.greenBg,col:C.green},unavailable:{bg:C.redBg,col:C.red}};
  const s=styles[type]||styles.pending;
  return <span style={{display:"inline-block",fontSize:11,padding:"2px 9px",borderRadius:20,background:s.bg,color:s.col,fontWeight:500}}>{type}</span>;
}
function Alert({type,children}){
  const s=type==="warn"?{bg:"#FEF3C7",col:"#92400E",border:"#F59E0B"}:{bg:C.blueBg,col:C.blue,border:C.blue};
  return <div style={{background:s.bg,color:s.col,border:`1px solid ${s.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,marginBottom:12}}>{children}</div>;
}
function Card({children,style}){ return <div style={{background:C.white,borderRadius:14,boxShadow:shadow,overflow:"hidden",...style}}>{children}</div>; }
function Btn({children,onClick,style,disabled}){
  return <button onClick={onClick} disabled={disabled} style={{padding:"8px 16px",borderRadius:9,fontSize:13,cursor:disabled?"not-allowed":"pointer",border:`1.5px solid ${C.grayLight}`,background:C.white,color:C.brown,fontFamily:font,transition:"all 0.15s",...style}}>{children}</button>;
}
function Input({label,type="text",value,onChange,placeholder,style}){
  return(
    <div style={{marginBottom:14}}>
      {label&&<label style={{display:"block",fontSize:12,color:C.gray,marginBottom:5,fontWeight:500}}>{label}</label>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{width:"100%",padding:"10px 13px",border:`1.5px solid ${C.grayLight}`,borderRadius:10,fontSize:14,color:C.brown,background:C.white,outline:"none",fontFamily:font,...style}}/>
    </div>
  );
}
function Select({label,value,onChange,children,style}){
  return(
    <div style={{marginBottom:14}}>
      {label&&<label style={{display:"block",fontSize:12,color:C.gray,marginBottom:5,fontWeight:500}}>{label}</label>}
      <select value={value} onChange={onChange} style={{width:"100%",padding:"10px 13px",border:`1.5px solid ${C.grayLight}`,borderRadius:10,fontSize:14,color:C.brown,background:C.white,outline:"none",fontFamily:font,...style}}>{children}</select>
    </div>
  );
}
function Tabs({tabs,active,onSelect}){
  return(
    <div style={{display:"flex",gap:4,marginBottom:"1.25rem",background:C.parchment,padding:4,borderRadius:10,width:"fit-content",flexWrap:"wrap"}}>
      {tabs.map(t=>(
        <button key={t.id} onClick={()=>onSelect(t.id)} style={{padding:"6px 16px",borderRadius:7,border:"none",background:active===t.id?C.white:"transparent",color:active===t.id?C.brown:C.gray,fontWeight:active===t.id?500:400,cursor:"pointer",fontFamily:font,fontSize:13,boxShadow:active===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
          {t.label}{t.badge?<span style={{background:C.red,color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:11,marginLeft:4}}>{t.badge}</span>:null}
        </button>
      ))}
    </div>
  );
}

// ─── MAP COMPONENT (Leaflet / OpenStreetMap) ──────────────────────
function LeafletMap({markers,center=[39.308,-76.476],zoom=12,height=280}){
  const ref=useRef(null); const mapRef=useRef(null);
  useEffect(()=>{
    if(!ref.current||mapRef.current) return;
    const L=window.L; if(!L) return;
    const m=L.map(ref.current).setView(center,zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"© OpenStreetMap"}).addTo(m);
    mapRef.current=m;
    return()=>{ if(mapRef.current){mapRef.current.remove();mapRef.current=null;} };
  },[]);
  useEffect(()=>{
    const L=window.L; if(!L||!mapRef.current) return;
    mapRef.current.eachLayer(l=>{ if(l._url||l.options?.attribution) return; try{mapRef.current.removeLayer(l);}catch{} });
    markers.forEach(mk=>{
      const icon=L.divIcon({className:"",html:`<div style="width:30px;height:30px;border-radius:50%;background:${mk.color||C.gold};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;border:2px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.3)">${mk.label||"•"}</div>`,iconSize:[30,30],iconAnchor:[15,15],popupAnchor:[0,-18]});
      L.marker(mk.pos,{icon}).addTo(mapRef.current).bindPopup(mk.popup||"");
    });
  },[markers]);
  return <div ref={ref} style={{height,borderRadius:14,overflow:"hidden",boxShadow:shadow}}/>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("landing");
  const [requests,setRequests]=useState(()=>ls("grace_requests",SEED_REQUESTS));
  const [drivers,setDrivers]=useState(()=>ls("grace_drivers",SEED_DRIVERS));
  const [members,setMembers]=useState(()=>ls("grace_members",SEED_MEMBERS));
  const [notifs,setNotifs]=useState(()=>ls("grace_notifs",[]));
  const [driver,setDriver]=useState(null);
  const [admin,setAdmin]=useState(null);

  const saveReqs=r=>{setRequests(r);ss("grace_requests",r);};
  const saveDrvs=d=>{setDrivers(d);ss("grace_drivers",d);};
  const saveMembs=m=>{setMembers(m);ss("grace_members",m);};
  const addNotif=(msg,type)=>{ const n=[...notifs,{ts:Date.now(),msg,type}]; setNotifs(n);ss("grace_notifs",n); };

  const goto=s=>setScreen(s);

  // ── LANDING ──────────────────────────────────────────────────
  if(screen==="landing") return(
    <div style={{minHeight:"100vh",background:C.brown,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <div style={{background:C.white,borderRadius:20,padding:"2.5rem 2rem",maxWidth:420,width:"100%",boxShadow:shadowLg,textAlign:"center"}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:C.brown,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 1.25rem",fontSize:28,color:C.goldLight}}>✝</div>
        <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Grace Fellowship</h1>
        <p style={{fontSize:13,color:C.gray,marginBottom:"2rem"}}>Transportation Ministry Portal</p>
        {[
          {icon:"🚌",title:"I need a ride",sub:"Submit a ride request — no account needed",action:()=>goto("member"),primary:true},
          {icon:"🚗",title:"I'm a driver",sub:"Log in to see your assigned pickups",action:()=>goto("driver-login"),primary:false},
          {icon:"⚙️",title:"Coordinator / Admin",sub:"Manage requests, drivers, and members",action:()=>goto("admin-login"),primary:false},
        ].map(b=>(
          <button key={b.title} onClick={b.action} style={{display:"block",width:"100%",padding:"1rem 1.25rem",borderRadius:12,border:`1.5px solid ${b.primary?C.brown:C.grayLight}`,background:b.primary?C.brown:C.white,textAlign:"left",cursor:"pointer",marginBottom:10,fontFamily:font,transition:"all 0.18s"}}>
            <div style={{fontFamily:serif,fontSize:15,fontWeight:600,color:b.primary?C.goldLight:C.brown}}>{b.icon}&nbsp;&nbsp;{b.title}</div>
            <div style={{fontSize:12,color:b.primary?"#9A8070":C.gray,marginTop:2}}>{b.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── MEMBER REQUEST ────────────────────────────────────────────
  if(screen==="member") return <MemberScreen onBack={()=>goto("landing")} onSubmit={req=>{const r=[...requests,req];saveReqs(r);}}/>;

  // ── DRIVER LOGIN ──────────────────────────────────────────────
  if(screen==="driver-login") return(
    <DriverLogin onBack={()=>goto("landing")} drivers={drivers} onLogin={d=>{setDriver(d);goto("driver");}}/>
  );

  // ── DRIVER DASHBOARD ──────────────────────────────────────────
  if(screen==="driver"&&driver) return(
    <DriverDash driver={driver} drivers={drivers} requests={requests}
      onSaveReqs={saveReqs} onSaveDrvs={saveDrvs} addNotif={addNotif}
      onLogout={()=>{setDriver(null);goto("landing");}}/>
  );

  // ── ADMIN LOGIN ───────────────────────────────────────────────
  if(screen==="admin-login") return(
    <AdminLogin onBack={()=>goto("landing")} onLogin={a=>{setAdmin(a);goto("admin");}}/>
  );

  // ── ADMIN DASHBOARD ───────────────────────────────────────────
  if(screen==="admin"&&admin) return(
    <AdminDash admin={admin} requests={requests} drivers={drivers} members={members} notifs={notifs}
      onSaveReqs={saveReqs} onSaveDrvs={saveDrvs} onSaveMembs={saveMembs}
      onLogout={()=>{setAdmin(null);goto("landing");}}/>
  );

  return null;
}

// ─── MEMBER SCREEN ────────────────────────────────────────────────
function MemberScreen({onBack,onSubmit}){
  const [done,setDone]=useState(false);
  const [form,setForm]=useState({name:"",phone:"",passengers:"1",type:"Sunday Morning Service",date:new Date().toISOString().slice(0,10),zone:"North",address:"",city:"Essex",zip:"",notes:""});
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const submit=()=>{
    if(!form.name||!form.phone||!form.address){alert("Please fill in all required fields.");return;}
    onSubmit({id:"r"+Date.now(),...form,address:`${form.address}, ${form.city}, MD ${form.zip}`.trim(),status:"pending",driverId:null});
    setDone(true);
  };
  return(
    <div style={{minHeight:"100vh",background:C.cream,display:"flex",flexDirection:"column",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      <Topbar logo="✝" name="Grace Fellowship" role="Ride Request" onBack={onBack}/>
      <div style={{flex:1,maxWidth:540,width:"100%",margin:"0 auto",padding:"2rem 1.25rem"}}>
        {done?(
          <div>
            <div style={{background:C.greenBg,border:`1.5px solid ${C.green}`,borderRadius:16,padding:"2rem",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:12}}>🙏</div>
              <h2 style={{fontFamily:serif,fontSize:20,color:C.green,marginBottom:8}}>Request Received!</h2>
              <p style={{fontSize:14,color:C.greenLight,lineHeight:1.6}}>The transportation team will confirm your ride within 24 hours. God bless you!</p>
            </div>
            <Btn onClick={()=>setDone(false)} style={{width:"100%",marginTop:12,padding:12,justifyContent:"center"}}>Submit another request</Btn>
          </div>
        ):(
          <div>
            <h2 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Request a Ride</h2>
            <p style={{fontSize:13,color:C.gray,marginBottom:"1.25rem"}}>Fill out the form below. Our team will confirm within 24 hours.</p>
            <SectionCard label="Your Information">
              <Input label="Full Name *" value={form.name} onChange={e=>f("name",e.target.value)} placeholder="e.g. Patricia Williams"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Input label="Phone Number *" value={form.phone} onChange={e=>f("phone",e.target.value)} placeholder="555-0000"/>
                <Select label="Passengers" value={form.passengers} onChange={e=>f("passengers",e.target.value)}>
                  {["1","2","3","4","5","6+"].map(n=><option key={n}>{n}</option>)}
                </Select>
              </div>
            </SectionCard>
            <SectionCard label="Trip Details">
              <Select label="Type of Trip *" value={form.type} onChange={e=>f("type",e.target.value)}>
                {["Sunday Morning Service","Sunday Evening Service","Youth Program","Special Event / Trip","Other"].map(t=><option key={t}>{t}</option>)}
              </Select>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Input label="Date Needed *" type="date" value={form.date} onChange={e=>f("date",e.target.value)}/>
                <Select label="Zone / Area" value={form.zone} onChange={e=>f("zone",e.target.value)}>
                  {["North","South","East","West","Central","Not sure"].map(z=><option key={z}>{z}</option>)}
                </Select>
              </div>
            </SectionCard>
            <SectionCard label="Pickup Location">
              <Input label="Street Address *" value={form.address} onChange={e=>f("address",e.target.value)} placeholder="123 Main Street"/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Input label="City" value={form.city} onChange={e=>f("city",e.target.value)}/>
                <Input label="ZIP" value={form.zip} onChange={e=>f("zip",e.target.value)} placeholder="21221"/>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:12,color:C.gray,marginBottom:5,fontWeight:500}}>Special Notes <span style={{fontWeight:400}}>(optional)</span></label>
                <textarea value={form.notes} onChange={e=>f("notes",e.target.value)} placeholder="Wheelchair access, young children, etc." style={{width:"100%",padding:"10px 13px",border:`1.5px solid ${C.grayLight}`,borderRadius:10,fontSize:14,color:C.brown,background:C.white,outline:"none",fontFamily:font,resize:"vertical",minHeight:70}}/>
              </div>
            </SectionCard>
            <button onClick={submit} style={{width:"100%",padding:14,background:C.brown,color:C.goldLight,border:"none",borderRadius:12,fontFamily:serif,fontSize:16,fontWeight:600,cursor:"pointer"}}>Submit Ride Request →</button>
          </div>
        )}
      </div>
    </div>
  );
}
function SectionCard({label,children}){
  return(
    <div style={{background:C.white,borderRadius:14,padding:"1.5rem",boxShadow:shadow,marginBottom:12}}>
      <div style={{fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.1em",color:C.gold,marginBottom:"1rem",display:"flex",alignItems:"center",gap:8}}>
        {label}<div style={{flex:1,height:1,background:C.grayLight}}/>
      </div>
      {children}
    </div>
  );
}

// ─── DRIVER LOGIN ─────────────────────────────────────────────────
function DriverLogin({onBack,drivers,onLogin}){
  const [name,setName]=useState(""); const [phone,setPhone]=useState(""); const [err,setErr]=useState(false);
  const login=()=>{
    const d=drivers.find(x=>x.name.toLowerCase()===name.trim().toLowerCase()&&x.phone.replace(/\D/g,"")===(phone.replace(/\D/g,"")));
    if(!d){setErr(true);return;} setErr(false); onLogin(d);
  };
  return(
    <div style={{minHeight:"100vh",background:C.parchment,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      <button onClick={onBack} style={{background:"transparent",border:"none",color:C.gray,fontSize:13,cursor:"pointer",marginBottom:"1rem"}}>← Back to home</button>
      <div style={{background:C.white,borderRadius:20,padding:"2.5rem 2rem",maxWidth:380,width:"100%",boxShadow:shadowLg}}>
        <div style={{fontSize:32,textAlign:"center",marginBottom:"1rem"}}>🚗</div>
        <h2 style={{fontFamily:serif,fontSize:20,color:C.brown,marginBottom:4}}>Driver Login</h2>
        <p style={{fontSize:13,color:C.gray,marginBottom:"1.5rem"}}>Enter your name and phone exactly as the coordinator has on file.</p>
        {err&&<div style={{background:C.redBg,border:`1px solid ${C.red}`,color:C.red,fontSize:13,padding:"8px 12px",borderRadius:8,marginBottom:12}}>Name or phone not found. Check with your coordinator.</div>}
        <Input label="Your Full Name" value={name} onChange={e=>setName(e.target.value)} placeholder="Deacon James"/>
        <Input label="Phone Number" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="555-0101"/>
        <p style={{fontSize:11,color:C.gray,marginBottom:10}}>Demo: "Deacon James" / "555-0101"</p>
        <button onClick={login} style={{width:"100%",padding:12,background:C.green,color:C.white,border:"none",borderRadius:10,fontFamily:serif,fontSize:15,fontWeight:600,cursor:"pointer"}}>Sign In →</button>
      </div>
    </div>
  );
}

// ─── DRIVER DASHBOARD ─────────────────────────────────────────────
function DriverDash({driver,drivers,requests,onSaveReqs,onSaveDrvs,addNotif,onLogout}){
  const [tab,setTab]=useState("mine");
  const myRides=requests.filter(r=>r.driverId===driver.id&&r.status==="assigned");
  const done=requests.filter(r=>r.driverId===driver.id&&r.status==="completed").length;
  const seats=myRides.reduce((a,r)=>a+parseInt(r.passengers||1),0);
  const openPool=requests.filter(r=>r.status==="pending");
  const myZoneOpen=openPool.filter(r=>driver.zones.includes(r.zone)||driver.zones.includes("Any"));

  const claim=rid=>{
    const r=requests.map(x=>x.id===rid?{...x,driverId:driver.id,status:"assigned"}:x);
    onSaveReqs(r); addNotif(`${driver.name} claimed a ride for ${requests.find(x=>x.id===rid)?.name}.`,"claim");
    setTab("mine");
  };
  const decline=rid=>{
    if(!window.confirm("Return this ride to the open pool?")) return;
    const nm=requests.find(x=>x.id===rid)?.name;
    onSaveReqs(requests.map(x=>x.id===rid?{...x,driverId:null,status:"pending"}:x));
    addNotif(`${driver.name} declined the ride for ${nm}. Needs a new driver.`,"decline");
  };
  const markDone=rid=>{ onSaveReqs(requests.map(x=>x.id===rid?{...x,status:"completed"}:x)); };
  const goUnavail=()=>{
    if(!window.confirm("This will return all your rides to the open pool and mark you unavailable. Continue?")) return;
    const r=requests.map(x=>x.driverId===driver.id&&x.status==="assigned"?{...x,driverId:null,status:"pending"}:x);
    const d=drivers.map(x=>x.id===driver.id?{...x,available:false}:x);
    onSaveReqs(r); onSaveDrvs(d);
    addNotif(`${driver.name} is unavailable. Rides returned to open pool.`,"unavail");
    alert("You've been marked unavailable. Your rides are back in the open pool. Thank you!");
  };

  const CHURCH=[39.308,-76.476];
  const OFFSETS={North:[0.025,0.005],South:[-0.025,0.005],East:[0.005,0.03],West:[0.005,-0.03],Central:[0,0],"Not sure":[0.01,0.01]};
  const rideMarkers=[
    {pos:CHURCH,color:C.green,label:"✝",popup:"<b>Grace Fellowship Church</b>"},
    ...myRides.map((r,i)=>{ const o=OFFSETS[r.zone]||[0,0]; return {pos:[CHURCH[0]+o[0]+(Math.random()-0.5)*0.005,CHURCH[1]+o[1]+(Math.random()-0.5)*0.005],color:C.gold,label:i+1,popup:`<b>${r.name}</b><br>${r.address}<br>📅 ${r.date}`}; })
  ];

  const tabs=[
    {id:"mine",label:"My Rides"},
    {id:"open",label:"Open Pool",badge:openPool.length||null},
    {id:"team",label:"Team Schedule"},
    {id:"map",label:"Route Map"},
  ];

  return(
    <div style={{minHeight:"100vh",background:C.cream,display:"flex",flexDirection:"column",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>
      <Topbar logo="🚗" name={driver.name} role="Driver Portal" right={<button onClick={onLogout} style={{background:"transparent",border:"1px solid #5A3A1A",color:"#9A7A5A",fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer"}}>Sign Out</button>}/>
      <div style={{flex:1,maxWidth:640,width:"100%",margin:"0 auto",padding:"1.5rem 1.25rem"}}>
        <h2 style={{fontFamily:serif,fontSize:20,color:C.brown,marginBottom:2}}>Welcome, {driver.name} 🙏</h2>
        <p style={{fontSize:13,color:C.gray,marginBottom:"1.25rem"}}>{driver.zones.join(", ")} zone(s) · {driver.seats} seats</p>

        {myZoneOpen.length>0&&tab==="mine"&&
          <Alert type="warn">⚠️ <b>{myZoneOpen.length} ride(s) in your zone</b> still need a driver. <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={()=>setTab("open")}>View open pool →</span></Alert>
        }

        <Tabs tabs={tabs} active={tab} onSelect={setTab}/>

        {/* MY RIDES */}
        {tab==="mine"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:"1.25rem"}}>
              {[{v:myRides.length,l:"My rides"},{v:`${seats}/${driver.seats}`,l:"Seats used"},{v:done,l:"Completed"}].map(s=>(
                <div key={s.l} style={{background:C.white,borderRadius:12,padding:"1rem",boxShadow:shadow,textAlign:"center"}}>
                  <div style={{fontFamily:serif,fontSize:28,fontWeight:600,color:C.brown}}>{s.v}</div>
                  <div style={{fontSize:11,color:C.gray,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>
            {myRides.length===0?(
              <div style={{textAlign:"center",padding:"2rem",color:C.gray}}>
                <div style={{fontSize:32,marginBottom:8}}>🙌</div>
                <div style={{fontSize:14}}>No rides assigned yet.</div>
                <div style={{fontSize:12,marginTop:4}}>Check the <b>Open Pool</b> tab to claim rides in your zone.</div>
              </div>
            ):myRides.map((r,i)=>(
              <RideCard key={r.id} r={r} num={i+1} borderColor={C.green} actions={
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  <Btn onClick={()=>markDone(r.id)} style={{background:C.greenBg,color:C.green,border:`1px solid ${C.green}`,fontSize:12,padding:"5px 12px"}}>✓ Done</Btn>
                  <Btn onClick={()=>decline(r.id)} style={{background:C.redBg,color:C.red,border:`1px solid ${C.red}`,fontSize:12,padding:"5px 12px"}}>✗ Decline</Btn>
                </div>
              }/>
            ))}
            <div style={{background:C.white,borderRadius:14,padding:"1.1rem 1.25rem",boxShadow:shadow,marginTop:10}}>
              <h3 style={{fontFamily:serif,fontSize:15,color:C.brown,marginBottom:6}}>Can't drive this week?</h3>
              <p style={{fontSize:13,color:C.gray,marginBottom:10}}>Your rides return to the open pool so another driver can claim them.</p>
              <button onClick={goUnavail} style={{padding:"8px 16px",background:"transparent",border:`1.5px solid ${C.red}`,color:C.red,borderRadius:8,fontSize:13,cursor:"pointer",fontFamily:font}}>Mark myself as unavailable</button>
            </div>
          </div>
        )}

        {/* OPEN POOL */}
        {tab==="open"&&(
          <div>
            <Alert type="info">These rides have no driver yet. Claim any that fit your zone and capacity.</Alert>
            {openPool.length===0?(
              <div style={{textAlign:"center",padding:"2rem",color:C.gray,fontSize:14}}>🎉 All rides have been claimed!</div>
            ):openPool.map(r=>{
              const inZone=driver.zones.includes(r.zone)||driver.zones.includes("Any");
              const seatsUsed=myRides.reduce((a,x)=>a+parseInt(x.passengers||1),0);
              const canFit=parseInt(r.passengers||1)<=(driver.seats-seatsUsed);
              return(
                <RideCard key={r.id} r={r} num="?" borderColor={inZone?C.gold:C.grayLight} tag={inZone?"Your zone":null}
                  note={!canFit?"⚠ Not enough seats remaining":null}
                  actions={<Btn onClick={()=>claim(r.id)} disabled={!canFit} style={{background:C.greenBg,color:C.green,border:`1px solid ${C.green}`,fontSize:12,padding:"5px 14px",opacity:canFit?1:0.5}}>Claim</Btn>}
                />
              );
            })}
          </div>
        )}

        {/* TEAM SCHEDULE */}
        {tab==="team"&&(
          <div>
            <Alert type="info">See all drivers' schedules. Contact a driver directly to coordinate a swap.</Alert>
            {drivers.map((d,i)=>{
              const rides=requests.filter(r=>r.driverId===d.id&&r.status!=="completed");
              const isMe=d.id===driver.id;
              const a=av(d.name,i);
              return(
                <Card key={d.id} style={{marginBottom:12,border:isMe?`2px solid ${C.gold}`:"none"}}>
                  <div style={{padding:"1rem 1.25rem",borderBottom:`1px solid ${C.grayLight}`,display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:a.bg,color:a.col,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:14}}>{a.initials}</div>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:serif,fontSize:14,fontWeight:600,color:C.brown}}>{d.name}{isMe&&<span style={{fontSize:11,color:C.gold,marginLeft:6}}>(you)</span>}</div>
                      <div style={{fontSize:11,color:C.gray}}>{d.seats} seats · {d.zones.join(", ")} · <span style={{color:d.available?C.green:C.red}}>{d.available?"Available":"Unavailable"}</span></div>
                    </div>
                    <span style={{fontSize:12,color:C.gray}}>{rides.length} ride(s)</span>
                  </div>
                  {rides.length?(
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{background:C.cream}}>{["Member","Date","Type","Zone"].map(h=><th key={h} style={{padding:"7px 14px",textAlign:"left",color:C.gray,fontWeight:500,fontSize:11,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                      <tbody>{rides.map(r=>(
                        <tr key={r.id} style={{borderTop:`0.5px solid ${C.grayLight}`}}>
                          <td style={{padding:"9px 14px",color:C.brown}}>{r.name}</td>
                          <td style={{padding:"9px 14px",color:C.gray}}>{r.date}</td>
                          <td style={{padding:"9px 14px",color:C.gray,fontSize:11}}>{r.type}</td>
                          <td style={{padding:"9px 14px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:C.goldBg,color:C.gold}}>{r.zone}</span></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ):<div style={{padding:"12px 14px",fontSize:13,color:C.gray}}>No rides assigned.</div>}
                </Card>
              );
            })}
          </div>
        )}

        {/* MAP */}
        {tab==="map"&&(
          <div>
            <LeafletMap markers={rideMarkers} height={320}/>
            <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
              <LegendDot color={C.green} label="Church"/>
              <LegendDot color={C.gold} label="Your pickups"/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RideCard({r,num,borderColor,actions,tag,note}){
  return(
    <div style={{background:C.white,borderRadius:14,padding:"1.1rem 1.25rem",marginBottom:10,boxShadow:shadow,borderLeft:`4px solid ${borderColor||C.gold}`,display:"flex",gap:12,alignItems:"flex-start"}}>
      <div style={{width:28,height:28,borderRadius:"50%",background:`${borderColor}22`,color:borderColor,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:13,flexShrink:0}}>{num}</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:500,fontSize:15,color:C.brown,display:"flex",alignItems:"center",gap:6}}>
          {r.name}
          {tag&&<span style={{fontSize:11,background:C.goldBg,color:C.gold,padding:"1px 7px",borderRadius:20}}>{tag}</span>}
        </div>
        <div style={{fontSize:12,color:C.gray,marginTop:3}}>📅 {r.date} · 🚌 {r.type}</div>
        <div style={{fontSize:12,color:C.gray}}>📍 {r.address}</div>
        <div style={{fontSize:12,color:C.gray}}>👥 {r.passengers} passenger(s) · 🗺 {r.zone} zone</div>
        {r.notes&&<div style={{fontSize:12,color:C.brownMid,marginTop:4,fontStyle:"italic"}}>"{r.notes}"</div>}
        {note&&<div style={{fontSize:11,color:C.red,marginTop:4}}>{note}</div>}
      </div>
      {actions&&<div style={{flexShrink:0}}>{actions}</div>}
    </div>
  );
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────
function AdminLogin({onBack,onLogin}){
  const [email,setEmail]=useState("admin@grace.org"); const [pass,setPass]=useState("grace2024"); const [err,setErr]=useState(false);
  const ADMINS=ls("grace_admins",SEED_ADMINS);
  const login=()=>{ const a=ADMINS.find(x=>x.email.toLowerCase()===email.trim().toLowerCase()&&x.password===pass); if(!a){setErr(true);return;} setErr(false); onLogin(a); };
  return(
    <div style={{minHeight:"100vh",background:C.brown,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      <button onClick={onBack} style={{background:"transparent",border:"none",color:"#7A6050",fontSize:13,cursor:"pointer",marginBottom:"1rem"}}>← Back to home</button>
      <div style={{background:"#2A1A08",border:"1px solid #5A3A1A",borderRadius:20,padding:"2.5rem 2rem",maxWidth:380,width:"100%",boxShadow:shadowLg}}>
        <div style={{fontSize:32,textAlign:"center",marginBottom:"1rem"}}>⚙️</div>
        <h2 style={{fontFamily:serif,fontSize:20,color:C.goldLight,marginBottom:4}}>Coordinator Login</h2>
        <p style={{fontSize:13,color:"#7A6050",marginBottom:"1.5rem"}}>Admin access only.</p>
        {err&&<div style={{background:C.redBg,border:`1px solid ${C.red}`,color:C.red,fontSize:13,padding:"8px 12px",borderRadius:8,marginBottom:12}}>Incorrect email or password.</div>}
        <Input label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="coordinator@gracefellowship.org" style={{background:"#1A0E04",borderColor:"#5A3A1A",color:C.parchment}}/>
        <Input label="Password" type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" style={{background:"#1A0E04",borderColor:"#5A3A1A",color:C.parchment}}/>
        <p style={{fontSize:11,color:"#7A6050",marginBottom:10}}>Demo: admin@grace.org / grace2024</p>
        <button onClick={login} style={{width:"100%",padding:12,background:C.gold,color:C.brown,border:"none",borderRadius:10,fontFamily:serif,fontSize:15,fontWeight:600,cursor:"pointer"}}>Sign In →</button>
      </div>
    </div>
  );
}

// ─── ADMIN DASHBOARD ──────────────────────────────────────────────
function AdminDash({admin,requests,drivers,members,notifs,onSaveReqs,onSaveDrvs,onSaveMembs,onLogout}){
  const [panel,setPanel]=useState("dashboard");
  const [reqFilter,setReqFilter]=useState("all");

  const pending=requests.filter(r=>r.status==="pending");
  const assigned=requests.filter(r=>r.status==="assigned");
  const avail=drivers.filter(d=>d.available);
  const seats=avail.reduce((a,d)=>{ const used=requests.filter(r=>r.driverId===d.id&&r.status==="assigned").reduce((s,r)=>s+parseInt(r.passengers||1),0); return a+Math.max(0,d.seats-used); },0);

  const assignDriver=(reqId,driverId)=>{
    onSaveReqs(requests.map(r=>r.id===reqId?{...r,driverId:driverId||null,status:driverId?"assigned":"pending"}:r));
  };
  const removeReq=id=>{ if(!window.confirm("Remove this request?")) return; onSaveReqs(requests.filter(r=>r.id!==id)); };
  const toggleDriver=id=>{ onSaveDrvs(drivers.map(d=>d.id===id?{...d,available:!d.available}:d)); };
  const addDriver=(nd)=>{ onSaveDrvs([...drivers,{id:"d"+Date.now(),...nd,available:true}]); };
  const addMember=(nm)=>{ onSaveMembs([...members,{id:"mb"+Date.now(),...nm,rides:0}]); };

  const CHURCH=[39.308,-76.476];
  const OFFSETS={North:[0.025,0.005],South:[-0.025,0.005],East:[0.005,0.03],West:[0.005,-0.03],Central:[0,0],"Not sure":[0.01,0.01]};

  const pickupMarkers=[
    {pos:CHURCH,color:C.gold,label:"✝",popup:"<b>Grace Fellowship Church</b>"},
    ...requests.filter(r=>r.status!=="completed").map(r=>{ const o=OFFSETS[r.zone]||[0,0]; const d=drivers.find(x=>x.id===r.driverId); return {pos:[CHURCH[0]+o[0]+(Math.random()-0.5)*0.008,CHURCH[1]+o[1]+(Math.random()-0.5)*0.008],color:r.status==="assigned"?C.green:C.red,label:r.status==="assigned"?"✓":"!",popup:`<b>${r.name}</b><br>${r.type}<br>📅 ${r.date}<br>Driver: ${d?d.name:"<span style='color:red'>None</span>"}`}; })
  ];
  const memberMarkers=[
    {pos:CHURCH,color:C.gold,label:"✝",popup:"<b>Grace Fellowship Church</b>"},
    ...members.map(m=>{ const o=OFFSETS[m.zone]||[0,0]; return {pos:[CHURCH[0]+o[0]+(Math.random()-0.5)*0.01,CHURCH[1]+o[1]+(Math.random()-0.5)*0.01],color:ZONE_COLORS[m.zone]||"#555",label:m.name[0],popup:`<b>${m.name}</b><br>📍 ${m.address}<br>📞 ${m.phone}<br>Zone: ${m.zone}<br>Rides: ${m.rides}`}; })
  ];

  const navItems=[
    {id:"dashboard",icon:"📊",label:"Dashboard",section:"Overview"},
    {id:"requests",icon:"📋",label:"Ride Requests",section:"Manage"},
    {id:"drivers",icon:"🚗",label:"Drivers",section:null},
    {id:"members",icon:"👥",label:"Members",section:null},
    {id:"map-pickup",icon:"📍",label:"Pickup Map",section:"Maps"},
    {id:"map-members",icon:"🗺️",label:"Member Map",section:null},
    {id:"activity",icon:"🔔",label:"Driver Activity",section:"Activity"},
  ];

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",fontFamily:font}}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"/>
      <Topbar logo="✝" name="Grace Fellowship" role="Coordinator Portal"
        right={<><span style={{fontSize:12,color:"#8A7060"}}>{admin.name}</span><button onClick={onLogout} style={{background:"transparent",border:"1px solid #5A3A1A",color:"#9A7A5A",fontSize:12,padding:"5px 12px",borderRadius:8,cursor:"pointer"}}>Sign Out</button></>}/>
      <div style={{flex:1,display:"flex",overflow:"hidden",background:C.cream}}>
        {/* SIDEBAR */}
        <div style={{width:200,background:C.white,borderRight:`1px solid ${C.grayLight}`,padding:"1.25rem 0",flexShrink:0,overflowY:"auto"}}>
          {navItems.map((n,i)=>(
            <div key={n.id}>
              {n.section&&<div style={{fontSize:10,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.1em",color:C.gold,padding:"0 1.25rem",margin:"1rem 0 6px"}}>{n.section}</div>}
              <div onClick={()=>setPanel(n.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 1.25rem",fontSize:13,color:panel===n.id?C.brown:C.gray,cursor:"pointer",borderLeft:`3px solid ${panel===n.id?C.gold:"transparent"}`,background:panel===n.id?C.goldBg:"transparent",fontWeight:panel===n.id?500:400,transition:"all 0.15s"}}>
                <span style={{width:18,textAlign:"center",fontSize:15}}>{n.icon}</span>{n.label}
              </div>
            </div>
          ))}
        </div>

        {/* CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"1.75rem"}}>

          {/* DASHBOARD */}
          {panel==="dashboard"&&(
            <div>
              <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Dashboard</h1>
              <p style={{fontSize:13,color:C.gray,marginBottom:"1.5rem"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:"1.5rem"}}>
                {[{icon:"⏳",v:pending.length,l:"Pending",col:C.red},{icon:"✅",v:assigned.length,l:"Assigned",col:C.green},{icon:"🚗",v:avail.length,l:"Drivers available",col:C.brown},{icon:"💺",v:seats,l:"Open seats",col:C.blue}].map(m=>(
                  <div key={m.l} style={{background:C.white,borderRadius:14,padding:"1.1rem",boxShadow:shadow}}>
                    <div style={{fontSize:20,marginBottom:6}}>{m.icon}</div>
                    <div style={{fontFamily:serif,fontSize:30,fontWeight:600,color:m.col,lineHeight:1}}>{m.v}</div>
                    <div style={{fontSize:12,color:C.gray,marginTop:4}}>{m.l}</div>
                  </div>
                ))}
              </div>
              {pending.length>0&&<Alert type="warn">⚠️ <b>{pending.length} request(s)</b> are waiting for a driver. <span style={{textDecoration:"underline",cursor:"pointer"}} onClick={()=>setPanel("requests")}>Assign now →</span></Alert>}
              <Card>
                <div style={{padding:"1rem 1.25rem",borderBottom:`1px solid ${C.grayLight}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontFamily:serif,fontSize:16,color:C.brown}}>Needs Driver Assignment</span>
                  <Btn onClick={()=>setPanel("requests")} style={{fontSize:12,padding:"5px 12px"}}>View all →</Btn>
                </div>
                <AdminTable rows={pending} drivers={drivers} onAssign={assignDriver} mini/>
              </Card>
            </div>
          )}

          {/* REQUESTS */}
          {panel==="requests"&&(
            <div>
              <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>All Ride Requests</h1>
              <p style={{fontSize:13,color:C.gray,marginBottom:"1.25rem"}}>Manage, filter, and assign all requests submitted by members.</p>
              <Tabs tabs={[{id:"all",label:"All"},{id:"pending",label:"Pending"},{id:"assigned",label:"Assigned"},{id:"completed",label:"Completed"}]} active={reqFilter} onSelect={setReqFilter}/>
              <Card>
                <AdminTable rows={requests.filter(r=>reqFilter==="all"||r.status===reqFilter)} drivers={drivers} onAssign={assignDriver} onRemove={removeReq}/>
              </Card>
            </div>
          )}

          {/* DRIVERS */}
          {panel==="drivers"&&<DriversPanel drivers={drivers} requests={requests} onToggle={toggleDriver} onAdd={addDriver}/>}

          {/* MEMBERS */}
          {panel==="members"&&<MembersPanel members={members} onAdd={addMember}/>}

          {/* MAPS */}
          {panel==="map-pickup"&&(
            <div>
              <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Pickup Map</h1>
              <p style={{fontSize:13,color:C.gray,marginBottom:"1rem"}}>Colored by assignment status. Red = needs a driver, green = covered.</p>
              {pending.length>0&&<Alert type="warn">⚠️ {pending.length} ride(s) still unassigned.</Alert>}
              <LeafletMap markers={pickupMarkers} height={420}/>
              <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
                <LegendDot color={C.red} label="Unassigned"/><LegendDot color={C.green} label="Assigned"/><LegendDot color={C.gold} label="Church"/>
              </div>
            </div>
          )}
          {panel==="map-members"&&(
            <div>
              <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Member Map</h1>
              <p style={{fontSize:13,color:C.gray,marginBottom:"1rem"}}>Where your members live — use this to plan zones and recruit drivers.</p>
              <LeafletMap markers={memberMarkers} height={420}/>
              <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
                {Object.entries(ZONE_COLORS).slice(0,5).map(([z,col])=><LegendDot key={z} color={col} label={z}/>)}
              </div>
            </div>
          )}

          {/* ACTIVITY */}
          {panel==="activity"&&(
            <div>
              <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Driver Activity Log</h1>
              <p style={{fontSize:13,color:C.gray,marginBottom:"1.25rem"}}>Claims, declines, and availability changes — logged automatically.</p>
              <Card style={{padding:"1rem 1.25rem"}}>
                {notifs.length===0?(
                  <p style={{fontSize:13,color:C.gray,padding:"1rem 0"}}>No driver activity yet. Actions will appear here as drivers claim or decline rides.</p>
                ):[...notifs].reverse().map((n,i)=>{
                  const icons={claim:"✅",decline:"⚠️",unavail:"🔴"};
                  const d=new Date(n.ts);
                  const time=d.toLocaleDateString("en-US",{month:"short",day:"numeric"})+" · "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});
                  return(
                    <div key={i} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.grayLight}`,alignItems:"flex-start"}}>
                      <span style={{fontSize:18}}>{icons[n.type]||"📌"}</span>
                      <div style={{flex:1}}><div style={{fontSize:13,color:C.brown}}>{n.msg}</div><div style={{fontSize:11,color:C.gray,marginTop:3}}>{time}</div></div>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function AdminTable({rows,drivers,onAssign,onRemove,mini}){
  if(!rows.length) return <div style={{padding:"1rem 1.25rem",fontSize:13,color:C.gray}}>No requests here. {!mini&&"🎉"}</div>;
  return(
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,tableLayout:"fixed"}}>
      <thead>
        <tr style={{background:C.cream}}>
          {["Member","Type","Date","Zone","Status","Driver"].map(h=>(
            <th key={h} style={{padding:"8px 14px",textAlign:"left",fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.06em",color:C.gray}}>{h}</th>
          ))}
          {!mini&&<th style={{padding:"8px 14px"}}/>}
        </tr>
      </thead>
      <tbody>
        {rows.map(r=>{
          const d=drivers.find(x=>x.id===r.driverId);
          return(
            <tr key={r.id} style={{borderTop:`0.5px solid ${C.grayLight}`}}>
              <td style={{padding:"10px 14px",color:C.brown,fontWeight:500}}>{r.name}<br/><span style={{fontSize:11,color:C.gray,fontWeight:400}}>{r.phone}</span></td>
              <td style={{padding:"10px 14px",color:C.gray,fontSize:12}}>{r.type}</td>
              <td style={{padding:"10px 14px",color:C.gray}}>{r.date}</td>
              <td style={{padding:"10px 14px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:C.goldBg,color:C.gold}}>{r.zone}</span></td>
              <td style={{padding:"10px 14px"}}><Badge type={r.status}/></td>
              <td style={{padding:"10px 14px"}}>
                {d?<span style={{fontSize:13,color:C.green}}>{d.name}</span>:(
                  <select onChange={e=>onAssign(r.id,e.target.value)} value={r.driverId||""} style={{fontSize:12,padding:"5px 8px",border:`1px solid ${C.grayLight}`,borderRadius:7,background:C.white,color:C.brown,fontFamily:font,width:"100%"}}>
                    <option value="">Assign driver…</option>
                    {drivers.filter(x=>x.available).map(x=><option key={x.id} value={x.id}>{x.name} ({x.seats} seats)</option>)}
                  </select>
                )}
              </td>
              {!mini&&<td style={{padding:"10px 14px"}}><Btn onClick={()=>onRemove(r.id)} style={{fontSize:11,padding:"4px 10px",color:C.red,borderColor:C.red}}>Remove</Btn></td>}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DriversPanel({drivers,requests,onToggle,onAdd}){
  const [form,setForm]=useState({name:"",phone:"",seats:"4",zones:[]});
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggleZone=z=>setForm(p=>({...p,zones:p.zones.includes(z)?p.zones.filter(x=>x!==z):[...p.zones,z]}));
  const submit=()=>{ if(!form.name||!form.phone){alert("Name and phone required.");return;} onAdd({...form,seats:parseInt(form.seats),zones:form.zones.length?form.zones:["Any"]}); setForm({name:"",phone:"",seats:"4",zones:[]}); };
  return(
    <div>
      <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Driver Roster</h1>
      <p style={{fontSize:13,color:C.gray,marginBottom:"1.25rem"}}>Manage volunteer drivers, availability, and zone coverage.</p>
      <Card style={{padding:"1.25rem",marginBottom:"1.25rem"}}>
        <div style={{fontFamily:serif,fontSize:16,color:C.brown,marginBottom:"1rem"}}>Add New Driver</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
          <Input label="Full Name" value={form.name} onChange={e=>f("name",e.target.value)} placeholder="Deacon Smith"/>
          <Input label="Phone" value={form.phone} onChange={e=>f("phone",e.target.value)} placeholder="555-0000"/>
          <Select label="Seats Available" value={form.seats} onChange={e=>f("seats",e.target.value)}>
            {["3","4","5","6","7","8"].map(n=><option key={n}>{n}</option>)}
          </Select>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:12,color:C.gray,display:"block",marginBottom:5,fontWeight:500}}>Zones</label>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {["North","South","East","West","Central"].map(z=>(
              <label key={z} style={{fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                <input type="checkbox" checked={form.zones.includes(z)} onChange={()=>toggleZone(z)}/>{z}
              </label>
            ))}
          </div>
        </div>
        <Btn onClick={submit} style={{background:C.gold,color:C.white,border:"none"}}>Add Driver</Btn>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:12}}>
        {drivers.map((d,i)=>{
          const a=av(d.name,i); const myRides=requests.filter(r=>r.driverId===d.id&&r.status==="assigned").length;
          return(
            <Card key={d.id} style={{padding:"1.1rem 1.25rem",border:d.available?`0.5px solid ${C.grayLight}`:`1.5px solid ${C.redBg}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:a.bg,color:a.col,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:600,fontSize:15}}>{a.initials}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:500,fontSize:14,color:C.brown}}>{d.name}</div>
                  <div style={{fontSize:12,color:C.gray}}>📞 {d.phone} · {d.seats} seats</div>
                </div>
                <span onClick={()=>onToggle(d.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:d.available?C.greenBg:C.redBg,color:d.available?C.green:C.red,cursor:"pointer",fontWeight:500}}>{d.available?"Available":"Unavail."}</span>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {d.zones.map(z=><span key={z} style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:C.goldBg,color:C.gold}}>{z}</span>)}
              </div>
              {myRides>0&&<div style={{marginTop:8,fontSize:12,color:C.green}}>{myRides} ride(s) assigned this week</div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MembersPanel({members,onAdd}){
  const [form,setForm]=useState({name:"",phone:"",address:"",zone:"North"});
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const submit=()=>{ if(!form.name||!form.phone){alert("Name and phone required.");return;} onAdd(form); setForm({name:"",phone:"",address:"",zone:"North"}); };
  return(
    <div>
      <h1 style={{fontFamily:serif,fontSize:22,color:C.brown,marginBottom:4}}>Member Directory</h1>
      <p style={{fontSize:13,color:C.gray,marginBottom:"1.25rem"}}>All members who use the transportation ministry.</p>
      <Card style={{padding:"1.25rem",marginBottom:"1.25rem"}}>
        <div style={{fontFamily:serif,fontSize:16,color:C.brown,marginBottom:"1rem"}}>Add Member</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,alignItems:"end"}}>
          <Input label="Full Name" value={form.name} onChange={e=>f("name",e.target.value)} placeholder="Mother Agnes"/>
          <Input label="Phone" value={form.phone} onChange={e=>f("phone",e.target.value)} placeholder="555-0000"/>
          <Input label="Address" value={form.address} onChange={e=>f("address",e.target.value)} placeholder="42 Oak Lane, Essex"/>
          <Select label="Zone" value={form.zone} onChange={e=>f("zone",e.target.value)}>
            {["North","South","East","West","Central"].map(z=><option key={z}>{z}</option>)}
          </Select>
        </div>
        <Btn onClick={submit} style={{background:C.gold,color:C.white,border:"none",marginTop:10}}>Add Member</Btn>
      </Card>
      <Card>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,tableLayout:"fixed"}}>
          <thead><tr style={{background:C.cream}}>
            {["Name","Phone","Address","Zone","Rides"].map(h=><th key={h} style={{padding:"8px 14px",textAlign:"left",fontSize:11,fontWeight:500,textTransform:"uppercase",color:C.gray}}>{h}</th>)}
          </tr></thead>
          <tbody>{members.map(m=>(
            <tr key={m.id} style={{borderTop:`0.5px solid ${C.grayLight}`}}>
              <td style={{padding:"10px 14px",fontWeight:500,color:C.brown}}>{m.name}</td>
              <td style={{padding:"10px 14px",color:C.gray}}>{m.phone}</td>
              <td style={{padding:"10px 14px",color:C.gray,fontSize:12}}>{m.address}</td>
              <td style={{padding:"10px 14px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:C.goldBg,color:C.gold}}>{m.zone}</span></td>
              <td style={{padding:"10px 14px",color:C.gray}}>{m.rides}</td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

function LegendDot({color,label}){
  return <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.gray}}><span style={{width:12,height:12,borderRadius:"50%",background:color,display:"inline-block"}}/>{label}</div>;
}
