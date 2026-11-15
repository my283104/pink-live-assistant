"""Pink Live sync receiver. Python 3.10+, standard library only.
Run only behind an HTTPS tunnel. Never expose this HTTP port directly to the Internet.
Set PINK_LIVE_TOKEN to a long random secret and PINK_LIVE_DB to a D: path.
"""
import json, os, sqlite3, datetime, hmac, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path

HOST="127.0.0.1"
PORT=int(os.getenv("PINK_LIVE_PORT","8765"))
TOKEN=os.environ.get("PINK_LIVE_TOKEN","")
DB=Path(os.environ.get("PINK_LIVE_DB",r"D:\\PinkLive\\pink_live.sqlite3"))
ORIGIN="https://my283104.github.io"
LOCK=threading.RLock()

def connect():
    DB.parent.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(str(DB),timeout=15)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("""CREATE TABLE IF NOT EXISTS records(
      date TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL,
      received_at TEXT NOT NULL)""")
    c.commit()
    return c

def validate(r):
    if not isinstance(r,dict): raise ValueError("record must be an object")
    d=r.get("date")
    if not isinstance(d,str) or len(d)!=10: raise ValueError("invalid date")
    try:
        if datetime.date.fromisoformat(d).isoformat()!=d: raise ValueError("invalid date")
    except ValueError: raise ValueError("invalid date")
    a=r.get("amount"); rate=r.get("conversion_rate"); views=r.get("views")
    if type(a) not in (int,float) or not 0<=a<=1e12: raise ValueError("invalid amount")
    if type(rate) not in (int,float) or not 0<=rate<=100: raise ValueError("invalid rate")
    if type(views)!=int or not 0<=views<=1e12: raise ValueError("invalid views")
    if r.get("platform")!="douyin" or r.get("currency")!="CNY": raise ValueError("invalid platform/currency")
    if not isinstance(r.get("note",""),str) or len(r.get("note",""))>5000: raise ValueError("invalid note")
    ts=r.get("updated_at")
    if not isinstance(ts,str) or len(ts)>40: raise ValueError("invalid timestamp")
    try: datetime.datetime.fromisoformat(ts.replace("Z","+00:00"))
    except ValueError: raise ValueError("invalid timestamp")
    return d,ts

class Handler(BaseHTTPRequestHandler):
    def send_json(self,status,obj):
        data=json.dumps(obj,ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Length",str(len(data)))
        self.send_header("Access-Control-Allow-Origin",ORIGIN)
        self.send_header("Vary","Origin")
        self.send_header("Access-Control-Allow-Headers","Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods","GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(data)
    def do_OPTIONS(self):
        if self.headers.get("Origin")!=ORIGIN:
            return self.send_json(403,{"error":"origin denied"})
        self.send_json(200,{"ok":True})
    def authorized(self):
        if self.headers.get("Origin") not in (None,ORIGIN):
            self.send_json(403,{"error":"origin denied"});return False
        if not hmac.compare_digest(self.headers.get("Authorization",""),"Bearer "+TOKEN):
            self.send_json(401,{"error":"unauthorized"});return False
        return True
    def do_GET(self):
        if not self.authorized():return
        if self.path!="/v1/records":return self.send_json(404,{"error":"not found"})
        with LOCK,connect() as c:
            rows=c.execute("SELECT payload FROM records ORDER BY date").fetchall()
        self.send_json(200,{"records":[json.loads(x[0]) for x in rows]})
    def do_POST(self):
        if not self.authorized():return
        if self.path!="/v1/records":return self.send_json(404,{"error":"not found"})
        try:
            n=int(self.headers.get("Content-Length","0"))
            if n<1 or n>1024*1024:raise ValueError("invalid request size")
            data=json.loads(self.rfile.read(n))
            if not isinstance(data,dict) or not isinstance(data.get("records"),list) or len(data["records"])>1000:
                raise ValueError("invalid batch")
            checked=[(validate(r),r) for r in data["records"]]
        except (ValueError,UnicodeError,TypeError) as e:
            return self.send_json(400,{"error":str(e)})
        accepted=0; conflicts=[]
        with LOCK,connect() as c:
            for (d,ts),r in checked:
                existing=c.execute("SELECT updated_at,payload FROM records WHERE date=?",(d,)).fetchone()
                if existing and existing[1]!=json.dumps(r,ensure_ascii=False,sort_keys=True):
                    # Never silently replace an existing daily record from another device.
                    conflicts.append(d);continue
                if not existing:
                    c.execute("INSERT INTO records VALUES(?,?,?,?)",(d,json.dumps(r,ensure_ascii=False,sort_keys=True),ts,datetime.datetime.now(datetime.timezone.utc).isoformat()))
                    accepted+=1
            c.commit()
        self.send_json(200,{"accepted":accepted,"conflicts":conflicts})
    def log_message(self,fmt,*args):
        print("%s %s"%(self.address_string(),fmt%args))

if __name__=="__main__":
    if len(TOKEN)<32:raise SystemExit("Set PINK_LIVE_TOKEN to a random secret of at least 32 characters")
    connect().close()
    print(f"Pink Live sync receiver on http://{HOST}:{PORT}; database: {DB}")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
