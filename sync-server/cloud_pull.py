"""Pink Live cloud -> Windows D-drive archive. Python 3.12 stdlib only.
First run: python cloud_pull.py --login
Regular run: python cloud_pull.py
Secrets encrypted using Windows DPAPI for the current Windows user.
"""
import argparse, ctypes, ctypes.wintypes, getpass, json, os, pathlib, sqlite3, sys, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone
BASE=pathlib.Path(r"D:\PinkLive")
DB=BASE/"pink_live.sqlite3"
CREDENTIALS=BASE/"cloud_credentials.dpapi"
API="https://lwufkxqueacijsrsjsui.supabase.co"
KEY="sb_publishable_L5Q4vClg-mkDuZsDL1dmqw_4_BxruEE"
class BLOB(ctypes.Structure):
    _fields_=[("cbData",ctypes.wintypes.DWORD),("pbData",ctypes.POINTER(ctypes.c_byte))]
def blob(raw):
    buf=ctypes.create_string_buffer(raw)
    return BLOB(len(raw),ctypes.cast(buf,ctypes.POINTER(ctypes.c_byte))),buf
def protect(raw,encrypt=True):
    if sys.platform!="win32": raise RuntimeError("This script requires Windows DPAPI")
    crypt=ctypes.windll.crypt32;kernel=ctypes.windll.kernel32
    input_blob,hold=blob(raw);output=BLOB()
    fn=crypt.CryptProtectData if encrypt else crypt.CryptUnprotectData
    if encrypt: ok=fn(ctypes.byref(input_blob),None,None,None,None,0,ctypes.byref(output))
    else: ok=fn(ctypes.byref(input_blob),None,None,None,None,None,0,ctypes.byref(output))
    if not ok: raise ctypes.WinError()
    try:return ctypes.string_at(output.pbData,output.cbData)
    finally:kernel.LocalFree(output.pbData)
def request(path,method="GET",data=None,token=None):
    headers={"apikey":KEY,"Content-Type":"application/json"}
    if token:headers["Authorization"]="Bearer "+token
    payload=json.dumps(data).encode() if data is not None else None
    req=urllib.request.Request(API+path,data=payload,headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=25) as res:return json.load(res)
def save_session(s):
    BASE.mkdir(parents=True,exist_ok=True)
    CREDENTIALS.write_bytes(protect(json.dumps(s).encode()))
def get_session():
    return json.loads(protect(CREDENTIALS.read_bytes(),False).decode())
def authenticate():
    email=input("Supabase sync email: ").strip()
    password=getpass.getpass("Supabase sync password: ")
    s=request("/auth/v1/token?grant_type=password","POST",{"email":email,"password":password})
    save_session(s);print("Login successful. DPAPI credentials saved under D:\\PinkLive.")
def pull():
    s=get_session()
    try:
        s=request("/auth/v1/token?grant_type=refresh_token","POST",{"refresh_token":s["refresh_token"]})
        save_session(s)
        user=request("/auth/v1/user",token=s["access_token"])
        if not user.get("id"):raise RuntimeError("Invalid user session")
        rows=[];offset=0
        while True:
            q=urllib.parse.urlencode({"select":"record_date,amount,conversion_rate,views,note,updated_at","order":"record_date.asc","limit":"1000","offset":str(offset)})
            page=request("/rest/v1/live_records?"+q,token=s["access_token"])
            rows.extend(page)
            if len(page)<1000:break
            offset+=len(page)
        BASE.mkdir(parents=True,exist_ok=True)
        with sqlite3.connect(DB,timeout=30) as db:
            db.execute("PRAGMA busy_timeout=30000")
            db.execute("""CREATE TABLE IF NOT EXISTS cloud_records (
                user_id TEXT NOT NULL, record_date TEXT NOT NULL, amount TEXT NOT NULL,
                conversion_rate TEXT NOT NULL, views INTEGER NOT NULL, note TEXT NOT NULL,
                updated_at TEXT NOT NULL, pulled_at TEXT NOT NULL,
                PRIMARY KEY(user_id,record_date))""")
            db.execute("""CREATE TABLE IF NOT EXISTS cloud_record_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,
                record_date TEXT NOT NULL, payload TEXT NOT NULL, archived_at TEXT NOT NULL)""")
            stamp=datetime.now(timezone.utc).isoformat()
            for r in rows:
                old=db.execute("SELECT amount,conversion_rate,views,note,updated_at FROM cloud_records WHERE user_id=? AND record_date=?",(user["id"],r["record_date"])).fetchone()
                if old and old!=(str(r["amount"]),str(r["conversion_rate"]),int(r["views"]),r["note"],r["updated_at"]):
                    db.execute("INSERT INTO cloud_record_history(user_id,record_date,payload,archived_at) VALUES(?,?,?,?)",
                               (user["id"],r["record_date"],json.dumps(old,ensure_ascii=False),stamp))
                db.execute("""INSERT INTO cloud_records(user_id,record_date,amount,conversion_rate,views,note,updated_at,pulled_at)
                    VALUES(?,?,?,?,?,?,?,?)
                    ON CONFLICT(user_id,record_date) DO UPDATE SET amount=excluded.amount,
                    conversion_rate=excluded.conversion_rate,views=excluded.views,note=excluded.note,
                    updated_at=excluded.updated_at,pulled_at=excluded.pulled_at""",
                    (user["id"],r["record_date"],str(r["amount"]),str(r["conversion_rate"]),int(r["views"]),r["note"],r["updated_at"],stamp))
        print(f"Cloud pull complete: {len(rows)} records saved to {DB}")
    except (urllib.error.URLError,KeyError,ValueError) as e:
        raise RuntimeError("Cloud pull failed; existing local data untouched: "+str(e)) from e
if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--login",action="store_true");args=p.parse_args()
    if args.login:authenticate()
    else:pull()
