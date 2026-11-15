/* Pink Live optional Supabase sync. No service-role keys. Existing localStorage KEY is unchanged. */
(()=>{"use strict";
const URL="https://lwufkxqueacijsrsjsui.supabase.co";
const KEY="sb_publishable_L5Q4vClg-mkDuZsDL1dmqw_4_BxruEE";
const SESSION_KEY="pinkLive.supabase.session.v1";
const BACKUP_KEY="pinkLive.sync.premerge.v1";
const CONFLICT_KEY="pinkLive.sync.conflicts.v1";
const headers=()=>({"apikey":KEY,"Content-Type":"application/json"});
let session=null,busy=false,timer=null;
try{session=JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch{}
const el=id=>document.getElementById(id);
const status=(s)=>{if(el("syncStatus"))el("syncStatus").textContent=s};
function persist(){if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY)}
async function api(path,opts={}){
 const res=await fetch(URL+path,{...opts,headers:{...headers(),...(opts.headers||{})}});
 const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
 if(!res.ok)throw Error(data?.msg||data?.message||data?.error_description||data?.error||("HTTP "+res.status));
 return data;
}
async function accessToken(){
 if(!session)return null;
 if(session.expires_at && Date.now()<session.expires_at-90000)return session.access_token;
 const r=await api("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:session.refresh_token})});
 session={...r,expires_at:Date.now()+r.expires_in*1000};persist();return session.access_token;
}
function normalize(r){
 if(!r||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.date))return null;
 const a=Number(r.amount),c=Number(r.conversion_rate),v=Number(r.views);
 if(!Number.isFinite(a)||a<0||!Number.isFinite(c)||c<0||c>100||!Number.isSafeInteger(v)||v<0)return null;
 return {date:r.date,amount:a,conversion_rate:c,views:v,note:String(r.note||""),platform:"douyin",currency:"CNY",updated_at:Number.isFinite(Date.parse(r.updated_at))?r.updated_at:"1970-01-01T00:00:00.000Z",schema_version:1};
}
function fingerprint(r){return JSON.stringify([r.amount,r.conversion_rate,r.views,r.note])}
function backup(){
 const snapshots=JSON.parse(localStorage.getItem(BACKUP_KEY)||"[]");
 snapshots.push({at:new Date().toISOString(),records:records});
 localStorage.setItem(BACKUP_KEY,JSON.stringify(snapshots.slice(-3)));
}
async function sync(){
 if(busy||!session||!navigator.onLine)return;
 busy=true;status("☁️ 同步中…");
 try{
 const token=await accessToken();
 const h={Authorization:"Bearer "+token};
 const user=await api("/auth/v1/user",{headers:h});
 if(!user?.id)throw Error("未登录");
 const remote=await api("/rest/v1/live_records?select=record_date,amount,conversion_rate,views,note,updated_at&order=record_date.asc&limit=10000",{headers:h});
 const localMap=new Map(records.map(r=>[r.date,normalize(r)]).filter(x=>x[1]));
 const remoteMap=new Map(remote.map(r=>[r.record_date,normalize({...r,date:r.record_date})]).filter(x=>x[1]));
 const uploads=[],downloads=[],conflicts=[];
 for(const [date,l] of localMap){
   const r=remoteMap.get(date);
   if(!r){uploads.push(l);continue}
   if(fingerprint(l)===fingerprint(r))continue;
   const lt=Date.parse(l.updated_at)||0,rt=Date.parse(r.updated_at)||0;
   conflicts.push({date,local:l,remote:r,detected_at:new Date().toISOString()});
   if(lt>rt)uploads.push(l);else downloads.push(r);
 }
 for(const [date,r] of remoteMap)if(!localMap.has(date))downloads.push(r);
 // Keep a copy of local data before applying any remote changes.
 if(downloads.length||conflicts.length)backup();
 if(conflicts.length){
  let old=[];try{old=JSON.parse(localStorage.getItem(CONFLICT_KEY)||"[]")}catch{}
  localStorage.setItem(CONFLICT_KEY,JSON.stringify([...old,...conflicts].slice(-100)));
 }
 // Upsert only newer local values; avoid a server-side blind overwrite via a conditional update.
 for(const r of uploads){
  const body={user_id:user.id,record_date:r.date,amount:r.amount,conversion_rate:r.conversion_rate,views:r.views,note:r.note,updated_at:r.updated_at};
  if(remoteMap.has(r.date)){
   const existing=remoteMap.get(r.date);
   const params=new URLSearchParams({record_date:"eq."+r.date,updated_at:"eq."+existing.updated_at});
   const changed=await api("/rest/v1/live_records?"+params,{method:"PATCH",headers:{...h,Prefer:"return=representation"},body:JSON.stringify(body)});
   if(!Array.isArray(changed)||changed.length!==1)throw Error("云端数据已变化，请稍后重试");
  }else{
   try{await api("/rest/v1/live_records",{method:"POST",headers:h,body:JSON.stringify(body)})}
   catch(e){if(String(e).includes("duplicate")||String(e).includes("23505"))throw Error("检测到并发修改，请重试同步");throw e}
  }
 }
 if(downloads.length){
  const map=new Map(records.map(r=>[r.date,r]));
  for(const r of downloads)map.set(r.date,r);
  records=[...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
  saveStore();render();
 }
 status("☁️ 已同步"+(conflicts.length?" · 冲突已备份":""));
 }catch(e){status("⚠️ 未同步："+String(e.message||e).slice(0,55))}
 finally{busy=false}
}
async function login(mode){
 const email=el("syncEmail").value.trim(),password=el("syncPassword").value;
 if(!email||password.length<8){status("请输入邮箱和至少8位密码");return}
 status("正在验证账号…");
 try{
  if(mode==="signup"){
   const r=await api("/auth/v1/signup",{method:"POST",body:JSON.stringify({email,password})});
   if(!r.access_token){status("注册成功，请先打开邮箱验证，再点击登录");return}
   session={...r,expires_at:Date.now()+r.expires_in*1000};
  }else{
   const r=await api("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});
   session={...r,expires_at:Date.now()+r.expires_in*1000};
  }
  persist();el("syncPassword").value="";showAuth();sync();
 }catch(e){status("⚠️ "+e.message)}
}
function showAuth(){
 const logged=!!session;
 el("syncLogin").hidden=logged;el("syncLogged").hidden=!logged;
 if(logged)status("已登录 · 等待同步");
}
function init(){
 if(!el("syncLogin"))return;
 el("syncSignIn").onclick=()=>login("login");
 el("syncSignUp").onclick=()=>login("signup");
 el("syncNow").onclick=sync;
 el("syncSignOut").onclick=()=>{session=null;persist();showAuth();status("已退出，手机本地数据保留")};
 showAuth();if(session)sync();
 window.addEventListener("online",sync);
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)sync()});
 timer=setInterval(()=>{if(!document.hidden)sync()},60000);
 const saveButton=el("saveRecord");
 saveButton.addEventListener("click",()=>{if(session)setTimeout(sync,0)});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();