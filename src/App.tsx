/// <reference types="vite/client" />
import {useEffect,useMemo,useRef,useState} from "react";
type Paper={id:string;title:string;authors:string;topic:string;session:string;poster:string;url:string;focus?:{rank:number;tier:string;score:number;area:string;relation:string;why:string}|null};
type Circle={name:string;paperIds:string[];title:string;degree:string;affiliation:string;verification:string};
type Professor={id:string;name:string;institution:string;title:string;lab:string;department:string;country:string;priority:string;score:number;relevance:string;overlap:string;mention:string;action:string;paperIds:string[];circle:Circle[];url:string;scholar:string;dblp:string;confidence:string;identityEvidence:string;notes:string;csRank?:number;cvRank?:number};
type Institution={name:string;professorIds:string[];paperIds:string[];counts:Record<string,number>};
type Data={meta:{paperCount:number;professorCount:number;institutionCount:number;source:string;attendanceAssumption:string;degreeCaveat:string};professors:Professor[];papers:Paper[];institutions:Institution[]};
type Tracker={stage:string;bookmarked:boolean;notes:string;lastTouched:string}; type View="professors"|"papers"|"institutions"|"circles"|"tracker";
type UserId="hrithik"|"madhu"|"swaroopa";
const USERS:Record<UserId,{name:string;pass:string}>={hrithik:{name:"Hrithik",pass:"Sagar@21"},madhu:{name:"Madhu",pass:"Madhu@00"},swaroopa:{name:"Swaroopa",pass:"Swaroopa@00"}};
const USER_KEY="eccv-user-id";
const CLOUD_TOKEN_KEY="eccv-cloud-token";
type AllNotes=Record<UserId,Record<string,Tracker>>;
type SyncState="loading"|"synced"|"saving"|"offline";
const GIST_ID="3ad9041534cb5fe977d17717196bf5a2";
const GIST_FILE="eccv-notes.json";
const gistHeaders=(token?:string)=>({...(token?{Authorization:`Bearer ${token}`}:{}),Accept:"application/vnd.github+json","Content-Type":"application/json"});
const cleanGitHubError=(message:string)=>message.includes("Bad credentials")?"Cloud key is invalid or expired":message;
async function fetchNotes(token?:string):Promise<AllNotes>{
 const r=await fetch(`https://api.github.com/gists/${GIST_ID}`,{headers:gistHeaders(token)});
 if(!r.ok)throw new Error(`gist read failed: HTTP ${r.status} ${(await r.text()).slice(0,120)}`);
 const d=await r.json();
 return JSON.parse(d.files[GIST_FILE]?.content||"{}");
}
async function saveNotes(all:AllNotes,token:string){
 if(!token)throw new Error("Cloud key required to save across devices");
 const r=await fetch(`https://api.github.com/gists/${GIST_ID}`,{method:"PATCH",headers:gistHeaders(token),body:JSON.stringify({files:{[GIST_FILE]:{content:JSON.stringify(all)}}})});
 if(!r.ok)throw new Error(`gist write failed: HTTP ${r.status} ${(await r.text()).slice(0,120)}`);
}
async function saveUserNotes(user:UserId,next:Record<string,Tracker>,token:string){
 const latest=await fetchNotes(token);
 const merged={...latest,[user]:next};
 await saveNotes(merged,token);
 return merged;
}
const newerTracker=(a?:Tracker,b?:Tracker)=>{
 if(!a)return b;
 if(!b)return a;
 return (a.lastTouched||"")>=(b.lastTouched||"")?a:b;
};
const mergeTrackers=(local:Record<string,Tracker>,remote:Record<string,Tracker>)=>{
 const merged:Record<string,Tracker>={};
 for(const id of new Set([...Object.keys(remote),...Object.keys(local)]))merged[id]=newerTracker(local[id],remote[id])!;
 return merged;
};
const sameTracker=(a:Record<string,Tracker>,b:Record<string,Tracker>)=>JSON.stringify(a)===JSON.stringify(b);
const stages=["Not reviewed","Bookmark","Want to talk","Email before ECCV","Meeting planned","Talked","Follow up"];
const priorityClass=(p:string)=>`priority priority-${p.toLowerCase()}`;
const orbitStyle=(i:number,total:number)=>({"--i":i,"--total":total} as React.CSSProperties);
function Icon({name}:{name:string}){const paths:Record<string,React.ReactNode>={people:<><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M15 6.5a3 3 0 0 1 0 5.8M16.5 13.3c2.5.6 3.8 2.5 4 5.7"/></>,papers:<><path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/></>,building:<><path d="M4 21h16M6 21V6l6-3 6 3v15M9 9h1M14 9h1M9 13h1M14 13h1M11 21v-4h2v4"/></>,network:<><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="18" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="m10.8 7.2-4.5 8M13.2 7.2l4.5 8M7.5 18h9"/></>,target:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M22 12h-3"/></>,search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></>,star:<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>,arrow:<path d="M5 12h14M14 7l5 5-5 5"/>,close:<path d="m6 6 12 12M18 6 6 18"/>};return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>}
function Workspace({user,onLogout}:{user:UserId;onLogout:()=>void}){
 const [data,setData]=useState<Data|null>(null),[view,setView]=useState<View>("professors"),[query,setQuery]=useState(""),[priority,setPriority]=useState("All"),[institutions,setInstitutions]=useState<string[]>([]),[instOpen,setInstOpen]=useState(false),[selected,setSelected]=useState<Professor|null>(null),[tracker,setTracker]=useState<Record<string,Tracker>>({}),[paperFocus,setPaperFocus]=useState("Relevant 90");
 const [sync,setSync]=useState<SyncState>("loading");
 const [syncError,setSyncError]=useState("");
 const [cloudToken,setCloudToken]=useState(()=>localStorage.getItem(CLOUD_TOKEN_KEY)||"");
 const [tokenDraft,setTokenDraft]=useState("");
 const [showCloudKey,setShowCloudKey]=useState(false);
 const trackerKey=`eccv-tracker-v1-${user}`;
 const allNotes=useRef<AllNotes>({} as AllNotes);
 const saveTimer=useRef<number|undefined>(undefined);
 useEffect(()=>{fetch(`${import.meta.env.BASE_URL}eccv-data.json`).then(r=>r.json()).then(setData)},[]);
 useEffect(()=>{
  let cancelled=false;
  const cached=localStorage.getItem(trackerKey);
  const local=cached?JSON.parse(cached) as Record<string,Tracker>:{};
  if(cached)setTracker(local);
  fetchNotes(cloudToken).then(all=>{
   if(cancelled)return;
   allNotes.current=all;
   const remote=all[user]||{};
   const merged=mergeTrackers(local,remote);
   setTracker(merged);
   localStorage.setItem(trackerKey,JSON.stringify(merged));
   if(cloudToken&&!sameTracker(merged,remote)){
    setSync("saving");
    saveUserNotes(user,merged,cloudToken).then(saved=>{if(cancelled)return;allNotes.current=saved;setSyncError("");setSync("synced")}).catch(e=>{if(cancelled)return;setSync("offline");setSyncError(cleanGitHubError(String(e?.message||e)));setShowCloudKey(true)});
   }else{
    setSyncError("");
    setSync("synced");
   }
  }).catch(e=>{
   if(cancelled)return;
   setSync("offline");
   setSyncError(cleanGitHubError(String(e?.message||e)));
  });
  return ()=>{cancelled=true};
 },[trackerKey,user,cloudToken]);
 useEffect(()=>()=>window.clearTimeout(saveTimer.current),[]);
 const saveCloudKey=(e:React.FormEvent)=>{
  e.preventDefault();
  const next=tokenDraft.trim();
  if(!next)return;
  localStorage.setItem(CLOUD_TOKEN_KEY,next);
  setCloudToken(next);
  setTokenDraft("");
  setShowCloudKey(false);
  setSync("loading");
 };
 const save=(next:Record<string,Tracker>)=>{
  setTracker(next);localStorage.setItem(trackerKey,JSON.stringify(next));
  allNotes.current={...allNotes.current,[user]:next};
  setSync("saving");
  window.clearTimeout(saveTimer.current);
  saveTimer.current=window.setTimeout(()=>{saveUserNotes(user,next,cloudToken).then(all=>{allNotes.current=all;setSyncError("");setSync("synced")}).catch(e=>{setSync("offline");setSyncError(cleanGitHubError(String(e?.message||e)));setShowCloudKey(true)})},450);
 };
 const exportData=()=>{const blob=new Blob([JSON.stringify(tracker,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`eccv-notes-${user}.json`;a.click();URL.revokeObjectURL(url)};
 const importData=(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{save({...tracker,...JSON.parse(String(reader.result))})}catch{alert("That file doesn't look like an exported notes file.")}};reader.readAsText(file);e.target.value=""};
 const track=(id:string,patch:Partial<Tracker>)=>{const current=tracker[id]||{stage:"Not reviewed",bookmarked:false,notes:"",lastTouched:""};save({...tracker,[id]:{...current,...patch,lastTouched:new Date().toISOString()}})};
 const paperMap=useMemo(()=>new Map(data?.papers.map(p=>[p.id,p])||[]),[data]); const institutionList=useMemo(()=>data?.institutions.map(i=>i.name).sort()||[],[data]);
 const filteredProfessors=useMemo(()=>{if(!data)return[];const q=query.toLowerCase();return data.professors.filter(p=>(priority==="All"||p.priority===priority)&&(institutions.length===0||institutions.includes(p.institution))&&(!q||[p.name,p.institution,p.lab,p.overlap,p.title,...p.paperIds.map(id=>paperMap.get(id)?.title||"")].join(" ").toLowerCase().includes(q))).sort((a,b)=>a.priority.localeCompare(b.priority)||b.score-a.score)},[data,query,priority,institutions,paperMap]);
 const toggleInstitution=(x:string)=>setInstitutions(s=>s.includes(x)?s.filter(y=>y!==x):[...s,x]);
 const filteredPapers=useMemo(()=>{if(!data)return[];const q=query.toLowerCase();return data.papers.filter(p=>(paperFocus==="All 2,864"||p.focus)&&(!q||[p.title,p.authors,p.topic].join(" ").toLowerCase().includes(q))).sort((a,b)=>(a.focus?.rank||9999)-(b.focus?.rank||9999))},[data,query,paperFocus]);
 const tracked=data?.professors.filter(p=>tracker[p.id]&&(tracker[p.id].bookmarked||tracker[p.id].stage!=="Not reviewed"||tracker[p.id].notes))||[];
 if(!data)return <main className="loading"><div className="loader"/><p>Assembling your ECCV research map…</p></main>;
 const metrics=[{n:data.meta.professorCount,label:"target professors",sub:"31 selected institutions"},{n:data.meta.paperCount.toLocaleString(),label:"accepted papers",sub:"90 deeply prioritized"},{n:tracked.length,label:"people tracked",sub:sync==="synced"?"saved to your account":sync==="saving"?"saving to cloud":"saved locally only"},{n:data.professors.filter(p=>p.priority==="S"||p.priority==="A").length,label:"high-priority fits",sub:"S + A research matches"}];
 return <main><header className="topbar"><div className="brand"><span className="brand-mark">E</span><div><b>ECCV Navigator</b><small>Malmö · 2026</small></div></div><div className="conference-note"><span className="live-dot"/>Research & networking workspace</div><div className="account-box"><span className="account-name">{USERS[user].name}</span><small className={`sync-pill sync-${sync}`} title={syncError}>{sync==='loading'?'Loading…':sync==='saving'?'Saving…':sync==='synced'?'Cloud synced':`Offline${syncError?': '+syncError:''}`}</small><button onClick={()=>setShowCloudKey(x=>!x)}>{cloudToken?'Cloud key':'Set cloud key'}</button><button onClick={exportData}>Export</button><label className="file-btn">Import<input type="file" accept="application/json" onChange={importData}/></label><button onClick={onLogout}>Switch</button></div></header>
 {showCloudKey&&<form className="cloud-key-panel" onSubmit={saveCloudKey}><div><b>Cloud sync needs a GitHub key</b><p>Paste a token with Gist access. It stays in this browser and lets your outreach save to the shared cloud file.</p></div><input type="password" value={tokenDraft} onChange={e=>setTokenDraft(e.target.value)} placeholder="GitHub token with gist permission" autoFocus/><button type="submit">Save key</button></form>}
 <section className="hero"><div><p className="eyebrow">HRITHIK SAGAR · PERSONAL RESEARCH INTELLIGENCE</p><h1>Turn a 2,864-paper conference<br/>into <em>your</em> opportunity map.</h1><p className="hero-copy">Explore aligned professors, their accepted work, labs and ECCV coauthor circles. Build a deliberate meeting plan around DoCoG, M3Grounder and Patram.</p></div><div className="hero-card"><span>YOUR RESEARCH SIGNAL</span><b>Grounded Document VLMs</b><p>Mask / pixel grounding · grounded CoT · Document QA · multimodal reasoning · large-scale VLM training</p><div className="signal-bars"><i/><i/><i/><i/><i/></div></div></section>
 <section className="metric-row">{metrics.map((m,i)=><article key={m.label}><span>0{i+1}</span><strong>{m.n}</strong><div><b>{m.label}</b><small>{m.sub}</small></div></article>)}</section>
 <nav className="views">{([['professors','people','Professors'],['papers','papers','Papers'],['institutions','building','Institutions'],['circles','network','Collaboration circles'],['tracker','target','My outreach']] as [View,string,string][]).map(([v,ic,l])=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}><Icon name={ic}/>{l}{v==='tracker'&&tracked.length>0?<span>{tracked.length}</span>:null}</button>)}</nav>
 <section className="workspace"><div className="workspace-head"><div><p className="section-kicker">{view==='tracker'?'ACTION BOARD':view.toUpperCase()}</p><h2>{view==='professors'?'Who is worth your time?':view==='papers'?'What should you read and attend?':view==='institutions'?'Where are your strongest clusters?':view==='circles'?'Who publishes together?':'Plan every conversation.'}</h2></div>{view!=='institutions'&&<div className="searchbox"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={view==='papers'?'Search title, author, topic…':'Search professor, lab, paper…'}/></div>}</div>
 {view==='professors'&&<><div className="filters"><div className="segmented">{['All','S','A','B','C'].map(p=><button key={p} className={priority===p?'on':''} onClick={()=>setPriority(p)}>{p==='All'?'All priorities':p}</button>)}</div><div className="multi-select" tabIndex={-1} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setInstOpen(false)}}><button type="button" className="multi-select-toggle" onClick={()=>setInstOpen(o=>!o)}>{institutions.length===0?'All institutions':`${institutions.length} institution${institutions.length>1?'s':''}`}</button>{instOpen&&<div className="multi-select-panel">{institutions.length>0&&<button type="button" className="multi-select-clear" onClick={()=>setInstitutions([])}>Clear selection</button>}{institutionList.map(x=><label key={x}><input type="checkbox" checked={institutions.includes(x)} onChange={()=>toggleInstitution(x)}/>{x}</label>)}</div>}</div><span className="result-count">{filteredProfessors.length} people</span></div><div className="prof-grid">{filteredProfessors.map(p=><ProfessorCard key={p.id} p={p} state={tracker[p.id]} onSelect={()=>setSelected(p)} onTrack={track}/>)}</div></>}
 {view==='papers'&&<><div className="filters"><div className="segmented"><button className={paperFocus==='Relevant 90'?'on':''} onClick={()=>setPaperFocus('Relevant 90')}>Relevant 90</button><button className={paperFocus==='All 2,864'?'on':''} onClick={()=>setPaperFocus('All 2,864')}>All 2,864</button></div><span className="result-count">{filteredPapers.length} papers</span></div><div className="paper-list">{filteredPapers.slice(0,300).map(p=><article key={p.id}><div className="paper-rank">{p.focus?<><b>#{p.focus.rank}</b><span className={priorityClass(p.focus.tier)}>{p.focus.tier}</span></>:<span>—</span>}</div><div className="paper-main"><p>{p.topic}</p><h3>{p.title}</h3><small>{p.authors}</small><div><span>{p.session}</span>{p.poster&&<span>Poster {p.poster}</span>}</div></div><a href={p.url} target="_blank"><Icon name="arrow"/></a></article>)}</div>{filteredPapers.length>300&&<p className="limit-note">Showing first 300 matches. Narrow your search to find a specific paper.</p>}</>}
 {view==='institutions'&&<InstitutionView data={data} tracker={tracker} onOpen={setSelected}/>} {view==='circles'&&<CircleView professors={filteredProfessors.slice(0,80)} paperMap={paperMap}/>} {view==='tracker'&&<TrackerView professors={tracked} tracker={tracker} onTrack={track} onOpen={setSelected}/>}</section>
 <footer><div><b>ECCV Navigator</b><p>Built from your verified research workbooks and the ECCV 2026 catalogue.</p></div><p>{data.meta.attendanceAssumption}<br/>{data.meta.degreeCaveat}</p></footer>{selected&&<ProfessorDrawer p={selected} state={tracker[selected.id]} paperMap={paperMap} onClose={()=>setSelected(null)} onTrack={track}/>}</main>}
function ProfessorCard({p,state,onSelect,onTrack}:{p:Professor;state?:Tracker;onSelect:()=>void;onTrack:(id:string,x:Partial<Tracker>)=>void}){return <article className="prof-card"><div className="card-top"><span className={priorityClass(p.priority)}>{p.priority}</span><button className={`star ${state?.bookmarked?'saved':''}`} onClick={()=>onTrack(p.id,{bookmarked:!state?.bookmarked})}><Icon name="star"/></button></div><button className="card-body" onClick={onSelect}><div className="avatar">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><h3>{p.name}</h3><p>{p.title}</p><strong>{p.institution}</strong><div className="fit"><span><i style={{width:`${p.score}%`}}/></span><b>{p.score}</b><small>fit</small></div><p className="overlap">{p.overlap}</p><div className="tags"><span>{p.paperIds.length} ECCV paper{p.paperIds.length!==1?'s':''}</span><span>{p.circle.length} coauthors</span></div></button><select value={state?.stage||'Not reviewed'} onChange={e=>onTrack(p.id,{stage:e.target.value})}>{stages.map(x=><option key={x}>{x}</option>)}</select></article>}
function ProfessorDrawer({p,state,paperMap,onClose,onTrack}:{p:Professor;state?:Tracker;paperMap:Map<string,Paper>;onClose:()=>void;onTrack:(id:string,x:Partial<Tracker>)=>void}){return <div className="drawer-wrap" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><aside className="drawer"><button className="drawer-close" onClick={onClose}><Icon name="close"/></button><div className="drawer-hero"><span className={priorityClass(p.priority)}>{p.priority} PRIORITY</span><div className="avatar large">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><h2>{p.name}</h2><p>{p.title}</p><b>{p.institution}</b><small>{p.department}{p.lab!=='Lab not listed'?` · ${p.lab}`:''}</small></div><div className="drawer-score"><div><strong>{p.score}</strong><span>/100 research fit</span></div><p>{p.overlap}</p></div><section><h3>Your conversation angle</h3><div className="callout"><b>Lead with</b><p>{p.mention}</p></div><p className="action">{p.action}</p></section><section><h3>Accepted ECCV work</h3>{p.paperIds.map(id=>{const x=paperMap.get(id);return x?<a className="drawer-paper" key={id} href={x.url} target="_blank"><div><b>{x.title}</b><small>{x.topic} · {x.session}</small></div><Icon name="arrow"/></a>:null})}</section><section><h3>ECCV collaboration circle <span>{p.circle.length}</span></h3><p className="caveat">Degree labels are evidence-based; unknown roles stay unverified.</p><div className="people-list">{p.circle.slice(0,18).map(c=><div key={c.name}><span>{c.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><p><b>{c.name}</b><small>{c.degree} · {c.title}</small></p><em>{c.paperIds.length}×</em></div>)}</div></section><section className="tracker-panel"><h3>My outreach</h3><select value={state?.stage||'Not reviewed'} onChange={e=>onTrack(p.id,{stage:e.target.value})}>{stages.map(x=><option key={x}>{x}</option>)}</select><textarea placeholder="Private notes: what to ask, where you met, follow-up…" value={state?.notes||''} onChange={e=>onTrack(p.id,{notes:e.target.value})}/><button onClick={()=>onTrack(p.id,{bookmarked:!state?.bookmarked})}><Icon name="star"/>{state?.bookmarked?'Bookmarked':'Bookmark professor'}</button></section><div className="links">{p.url&&<a href={p.url} target="_blank">Faculty / lab page</a>}{p.scholar&&<a href={p.scholar} target="_blank">Google Scholar</a>}{p.dblp&&<a href={p.dblp} target="_blank">DBLP</a>}</div></aside></div>}
function InstitutionView({data,tracker,onOpen}:{data:Data;tracker:Record<string,Tracker>;onOpen:(p:Professor)=>void}){const pm=new Map(data.professors.map(p=>[p.id,p]));return <div className="institution-grid">{data.institutions.map((i,idx)=>{const ps=i.professorIds.map(id=>pm.get(id)!).filter(Boolean).sort((a,b)=>a.priority.localeCompare(b.priority)||b.score-a.score);return <article key={i.name}><header><span>{String(idx+1).padStart(2,'0')}</span><div><h3>{i.name}</h3><p>{ps.length} professors · {i.paperIds.length} linked papers</p></div></header><div className="inst-bars">{['S','A','B','C'].map(x=><span key={x} className={`bar-${x.toLowerCase()}`} style={{flex:i.counts[x]||.2}}><b>{i.counts[x]||0}</b><small>{x}</small></span>)}</div><div className="inst-people">{ps.slice(0,6).map(p=><button key={p.id} onClick={()=>onOpen(p)}><span className={priorityClass(p.priority)}>{p.priority}</span><p><b>{p.name}</b><small>{p.score} fit · {tracker[p.id]?.stage||'Not reviewed'}</small></p></button>)}</div>{ps.length>6&&<small className="more">+{ps.length-6} more professors</small>}</article>})}</div>}
function CircleView({professors,paperMap}:{professors:Professor[];paperMap:Map<string,Paper>}){const [open,setOpen]=useState<string|null>(null);return <div className="circle-list">{professors.map(p=><article key={p.id} className={open===p.id?'expanded':''}><button className="circle-head" onClick={()=>setOpen(open===p.id?null:p.id)}><div className="avatar">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><span className={priorityClass(p.priority)}>{p.priority}</span><h3>{p.name}</h3><p>{p.institution} · {p.lab}</p></div><div className="circle-stats"><b>{p.circle.length}</b><small>coauthors</small><b>{p.paperIds.length}</b><small>papers</small></div></button>{open===p.id&&<div className="circle-body"><div className="network-core"><span>{p.name}</span>{p.circle.slice(0,12).map((c,i)=><div key={c.name} className="orbit" style={orbitStyle(i,Math.min(12,p.circle.length))}><b>{c.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</b><small>{c.name}<br/>{c.degree}</small></div>)}</div><div className="circle-papers"><h4>Shared ECCV papers</h4>{p.paperIds.map(id=><p key={id}>{paperMap.get(id)?.title}</p>)}</div></div>}</article>)}</div>}
function TrackerView({professors,tracker,onTrack,onOpen}:{professors:Professor[];tracker:Record<string,Tracker>;onTrack:(id:string,x:Partial<Tracker>)=>void;onOpen:(p:Professor)=>void}){return <div className="kanban">{stages.slice(1).map(stage=><section key={stage}><header><h3>{stage}</h3><span>{professors.filter(p=>tracker[p.id]?.stage===stage||(stage==='Bookmark'&&tracker[p.id]?.bookmarked&&tracker[p.id]?.stage==='Not reviewed')).length}</span></header>{professors.filter(p=>tracker[p.id]?.stage===stage||(stage==='Bookmark'&&tracker[p.id]?.bookmarked&&tracker[p.id]?.stage==='Not reviewed')).map(p=><article key={p.id} onClick={()=>onOpen(p)}><span className={priorityClass(p.priority)}>{p.priority}</span><h4>{p.name}</h4><p>{p.institution}</p>{tracker[p.id]?.notes&&<small>{tracker[p.id].notes}</small>}<select onClick={e=>e.stopPropagation()} value={tracker[p.id]?.stage||'Not reviewed'} onChange={e=>onTrack(p.id,{stage:e.target.value})}>{stages.map(x=><option key={x}>{x}</option>)}</select></article>)}</section>)}</div>}
function Login({onLogin}:{onLogin:(id:UserId)=>void}){
 const [id,setId]=useState<UserId|"">(""),[pass,setPass]=useState(""),[error,setError]=useState("");
 const submit=(e:React.FormEvent)=>{e.preventDefault();if(!id){setError("Pick your name");return}if(USERS[id].pass!==pass){setError("Wrong password");return}localStorage.setItem(USER_KEY,id);onLogin(id)};
 return <main className="login-screen"><form className="login-card" onSubmit={submit}><span className="brand-mark">E</span><h1>ECCV Navigator</h1><p>Sign in to load your own bookmarks and notes.</p><div className="login-names">{(Object.keys(USERS) as UserId[]).map(u=><button type="button" key={u} className={id===u?'on':''} onClick={()=>{setId(u);setError("")}}>{USERS[u].name}</button>)}</div><input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} autoFocus/>{error&&<small className="login-error">{error}</small>}<button className="login-submit" type="submit">Continue</button></form></main>}
export default function App(){
 const [user,setUser]=useState<UserId|null>(()=>{const saved=localStorage.getItem(USER_KEY);return saved&&saved in USERS?saved as UserId:null});
 if(!user)return <Login onLogin={setUser}/>;
 return <Workspace user={user} onLogout={()=>{localStorage.removeItem(USER_KEY);setUser(null)}}/>;
}
