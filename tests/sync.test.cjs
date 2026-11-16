// Run with: node --test tests/sync.test.cjs
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"..","sync.js"),"utf8");
function harness({local=[],remote=[],logged=true}={}){
 const db=new Map(remote.map(r=>[r.record_date,r]));
 const store=new Map([["pinkLive.douyin.daily.v1",JSON.stringify(local)]]);
 if(logged)store.set("pinkLive.supabase.session.v1",JSON.stringify({access_token:"token",refresh_token:"refresh",expires_at:Date.now()+3600000}));
 const nodes=new Map(),get=id=>nodes.get(id)||nodes.set(id,{textContent:"",value:"",hidden:false,onclick:null,addEventListener(){}}).get(id);
 let records=structuredClone(local);
 const requests=[];
 const fetch=async(url,options={})=>{
   const u=new URL(url),method=options.method||"GET";
   requests.push({path:u.pathname,method});
   let result,status=200;
   if(u.pathname==="/auth/v1/user")result={id:"test-user"};
   else if(u.pathname==="/rest/v1/live_records"){
     if(method==="GET")result=[...db.values()];
     else if(method==="POST"){
       const body=JSON.parse(options.body);
       if(db.has(body.record_date)){status=409;result={message:"duplicate"}}else{db.set(body.record_date,body);result=null}
     }else if(method==="PATCH"){
       const body=JSON.parse(options.body),old=db.get(body.record_date);
       const stamp=u.searchParams.get("updated_at")?.slice(3);
       if(old&&old.updated_at===stamp){db.set(body.record_date,body);result=[body]}else result=[];
     }
   }else throw Error("unexpected "+u.pathname);
   return {ok:status<400,status,text:async()=>JSON.stringify(result)};
 };
 const context={URL,URLSearchParams,Date,JSON,Map,Number,String,Array,Error,Set,Promise,console,fetch,
  navigator:{onLine:true},document:{readyState:"complete",getElementById:get,addEventListener(){}},
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
  window:{addEventListener(){}},location:{origin:"https://example.com",pathname:"/"},
  setInterval(){},setTimeout(){},render(){},saveStore(){store.set("pinkLive.douyin.daily.v1",JSON.stringify(records))}
 };
 Object.defineProperty(context,"records",{get:()=>records,set:v=>{records=v}});
 vm.createContext(context);vm.runInContext(source,context);
 return {get,db,store,requests,read:()=>records,async sync(){get("syncNow").onclick();await new Promise(resolve=>setTimeout(resolve,20))}};
}
const row=(date,amount,updated_at="2026-11-15T00:00:00.000Z")=>({record_date:date,date,amount,conversion_rate:3.68,views:100,note:"",updated_at});
test("uploads existing local-only records without erasing them",async()=>{
 const h=harness({local:[row("2026-11-01",12)]});await h.sync();
 assert.equal(h.db.get("2026-11-01").amount,12);assert.equal(h.read().length,1);
 assert.ok(h.store.get("pinkLive.sync.lastSuccessful.v1"));
});
test("downloads cloud-only records",async()=>{
 const h=harness({remote:[row("2026-11-02",20)]});await h.sync();
 assert.equal(h.read().length,1);assert.equal(h.read()[0].amount,20);
 assert.ok(h.store.get("pinkLive.sync.premerge.v1"));
});
test("preserves newer local edits and snapshots conflicts",async()=>{
 const h=harness({local:[row("2026-11-03",50,"2026-11-15T10:00:00Z")],
 remote:[row("2026-11-03",30,"2026-11-15T09:00:00Z")]});
 await h.sync();assert.equal(h.db.get("2026-11-03").amount,50);
 assert.ok(h.store.get("pinkLive.sync.conflicts.v1"));
});
test("refuses malformed local records instead of losing them",async()=>{
 const h=harness({local:[{date:"2026-11-04",amount:-10,conversion_rate:3,views:5}]});
 await h.sync();assert.match(h.get("syncStatus").textContent,/无效记录/);
 assert.equal(h.db.size,0);assert.equal(h.read().length,1);
});
test("does not upload before login",async()=>{
 const h=harness({logged:false,local:[row("2026-11-05",10)]});
 await h.sync();assert.equal(h.requests.length,0);
});
test("round trips video account amounts and rest days",async()=>{
 const r={...row("2026-11-06",12),wechat_amount:34.56,is_rest:true};
 const h=harness({local:[r]});await h.sync();
 assert.equal(h.db.get(r.date).wechat_amount,34.56);assert.equal(h.db.get(r.date).is_rest,true);
 const d=harness({remote:[h.db.get(r.date)]});await d.sync();
 assert.equal(d.read()[0].wechat_amount,34.56);assert.equal(d.read()[0].is_rest,true);
});
test("video account only edits participate in conflict detection",async()=>{
 const h=harness({local:[{...row("2026-11-07",10,"2026-11-16T10:00:00Z"),wechat_amount:50}],remote:[row("2026-11-07",10)]});
 await h.sync();assert.equal(h.db.get("2026-11-07").wechat_amount,50);
 assert.ok(h.store.get("pinkLive.sync.conflicts.v1"));
});


