// Pink Live HTTPS relay for Supabase Auth + PostgREST. No service-role key.
const UPSTREAM = "https://lwufkxqueacijsrsjsui.supabase.co";
const ALLOWED_ORIGINS = new Set(["https://my283104.github.io"]);
const ALLOWED_PATHS = [/^\/auth\/v1\/(signup|token|user|logout|recover|verify)(?:\/|$)/, /^\/rest\/v1\/live_records$/];
export default {
 async fetch(request) {
  const origin=request.headers.get("Origin")||"";
  const cors={"Access-Control-Allow-Origin":ALLOWED_ORIGINS.has(origin)?origin:"null","Vary":"Origin","Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS","Access-Control-Allow-Headers":"apikey,authorization,content-type,prefer,x-client-info","Access-Control-Max-Age":"600"};
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
  if(origin&&!ALLOWED_ORIGINS.has(origin))return new Response("Origin not allowed",{status:403});
  const url=new URL(request.url);
  if(!ALLOWED_PATHS.some(re=>re.test(url.pathname)))return new Response("Path not allowed",{status:404,headers:cors});
  if(!["GET","POST","PATCH","DELETE"].includes(request.method))return new Response("Method not allowed",{status:405,headers:cors});
  const upstream=new URL(url.pathname+url.search,UPSTREAM);
  const headers=new Headers();
  for(const name of ["apikey","authorization","content-type","prefer","x-client-info"])if(request.headers.has(name))headers.set(name,request.headers.get(name));
  const response=await fetch(upstream,{method:request.method,headers,body:["GET","HEAD"].includes(request.method)?undefined:request.body,redirect:"manual"});
  const outHeaders=new Headers(cors);
  for(const name of ["content-type","content-range","location"])if(response.headers.has(name))outHeaders.set(name,response.headers.get(name));
  outHeaders.set("Cache-Control","no-store");
  return new Response(response.body,{status:response.status,headers:outHeaders});
 }
};
