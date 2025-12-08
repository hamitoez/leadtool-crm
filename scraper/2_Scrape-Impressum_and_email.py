import os
import pandas as pd
import requests
import time
import json
import re
import logging
import threading
import concurrent.futures
from concurrent.futures import ThreadPoolExecutor

# Logging-Konfiguration
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Globaler ChromeDriver-Download (nur einmal)
CHROME_DRIVER_PATH = ChromeDriverManager().install()

# ==========================
# Selenium-Funktion
# ==========================
def scrape_impressum_with_browser(url, retries=2):
    options = Options()
    options.add_argument("--headless=new")     # moderner Headless-Modus
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    # options.add_argument("--single-process")  # ← entfernen!

    service = Service(CHROME_DRIVER_PATH)

    for attempt in range(retries):
        driver = None
        try:
            driver = webdriver.Chrome(service=service, options=options)
            driver.set_page_load_timeout(25)
            driver.get(url)
            time.sleep(2)
            return driver.page_source
        except Exception as e:
            logging.error(f"Selenium-Fehler bei {url} (Versuch {attempt+1}/{retries}): {e}")
            time.sleep(1.5)
        finally:
            if driver:
                try: driver.quit()
                except: pass
    return ""

# ==========================
# Deepseek-Konfiguration
# ==========================
CACHE_FILE = "impressum_cache.json"
DEEPSEEK_API_KEY = "sk-"  # <--- Deinen API-Key hier einfügen
DEEPSEEK_MODEL = "deepseek-chat"   # statt reasoner
DEEPSEEK_API_BASE = "https://api.deepseek.com"
MAX_CALLS_PER_MINUTE = 14
WINDOW_SIZE = 60
API_CALLS = []
API_LOCK = threading.Lock()

def check_rate_limit():
    with API_LOCK:
        now = time.time()
        global API_CALLS
        API_CALLS = [t for t in API_CALLS if now - t < WINDOW_SIZE]
        if len(API_CALLS) >= MAX_CALLS_PER_MINUTE:
            wait = WINDOW_SIZE - (now - API_CALLS[0])
            logging.info(f"Rate Limit erreicht. Warte {wait:.1f}s...")
            time.sleep(wait)
            API_CALLS = []
        API_CALLS.append(now)

def call_deepseek(prompt, field):
    check_rate_limit()
    headers = {"Authorization": f"Bearer {DEEPSEEK_API_KEY}",
               "Content-Type": "application/json"}
    data = {
        "model": DEEPSEEK_MODEL,
        "messages": [
            {"role": "system", "content": "Du bist ein Experte für Web Scraping."},
            {"role": "user",   "content": prompt}
        ],
        "max_tokens": 300,
        "temperature": 0.3
    }
    resp = requests.post(f"{DEEPSEEK_API_BASE}/chat/completions", headers=headers, json=data)
    resp.raise_for_status()
    j = resp.json()
    try:
        return j["choices"][0]["message"]["content"].strip()
    except KeyError:
        return j.get("output", j.get("output_text", "")).strip()

def deepseek_find_contacts(html):
    prompt = (
        "Gehe auf die Seite Impressum und gib mir nur den Vornamen und Nachnamen der ersten Person in der Geschäftsführung zurück. "
        "Mögliche Bezeichnungen: Geschäftsführer, Geschäftsführerin, Inhaber, Verantwortlicher für die Inhalte, Vertreten durch. "
        "Output: nur ‚Vorname Nachname‘. Keine Erklärungen.\n\n"
        f"HTML:\n---\n{html}\n---\n"
    )
    try:
        name = call_deepseek(prompt, "Name")
        logging.info(f"✅ Name via Deepseek: {name}")
        return name
    except Exception as e:
        logging.error(f"Deepseek Name-Error: {e}")
        return ""

def deepseek_find_emails(html):
    prompt = (
        "Lies das Impressum-HTML und extrahiere nur die **erste** E‑Mail-Adresse. "
        "Output zum Beispiel: max@mustermann.de <– exakt nur die Adresse, keine Erklärungen.\n\n"
        f"HTML:\n---\n{html}\n---\n"
    )
    try:
        email = call_deepseek(prompt, "E-Mail")
        logging.info(f"✅ E‑Mail via Deepseek: {email}")
        return email
    except Exception as e:
        logging.error(f"Deepseek E-Mail-Error: {e}")
        return ""

# Fallback via Regex
def fallback_find_email(html):
    match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", html)
    if match:
        email = match.group(0)
        logging.info(f"🔁 Fallback-E-Mail gefunden via Regex: {email}")
        return email
    return ""

def clean_domain(url):
    if not url: return ""
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    parts = url.split("/")
    domain = parts[2] if len(parts) > 2 else parts[0]
    return domain.split(":")[0]

def ci_get(row: pd.Series, name: str, default: str = "") -> str:
    for col in row.index:
        if col.lower() == name.lower():
            return str(row[col]).strip()
    return default

def fetch_html_fast(url: str) -> str:
    try:
        r = requests.get(url, timeout=12, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        return r.text
    except Exception:
        return ""

def process_row(args):
    index, row, df = args
    imp_url  = ci_get(row, "Impressum_URL")
    website  = ci_get(row, "website")
    existing = ci_get(row, "E-Mail")

    if existing or not imp_url:
        return None

    # relative Impressum-URL fixen
    if imp_url.startswith(("/", "?")) or not imp_url.startswith("http"):
        dom = clean_domain(website)
        if dom:
            imp_url = f"http://{dom}{imp_url}"
            imp_url = re.sub(r"(?<!:)/{2,}", "/", imp_url)

    logging.info(f"➡️ Scrape URL: {imp_url}")

    html = fetch_html_fast(imp_url)
    if len(html) < 800:  # zu wenig / JS-lastig
        html = scrape_impressum_with_browser(imp_url)

    if not html.strip():
        logging.warning(f"Kein HTML bei {imp_url}")
        return None

    name  = deepseek_find_contacts(html)
    email = deepseek_find_emails(html) or fallback_find_email(html)

    return (index, name, email)


def process_impressum_csv(input_file, output_file, checkpoint_interval=20, max_workers=2):
    df = pd.read_csv(output_file if os.path.exists(output_file) else input_file,
                     keep_default_na=False)

    for col in ["Geschäftsführer", "E-Mail"]:
        if col not in df.columns:
            df[col] = ""

    tasks = [(i, row, df) for i, row in df.iterrows() if not str(row.get("E-Mail", "")).strip()]

    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = [ex.submit(process_row, t) for t in tasks]
        for ct, future in enumerate(concurrent.futures.as_completed(futures), 1):
            try:
                res = future.result()
            except Exception:
                logging.exception("❌ Ungefangene Exception in Thread:")
                continue

            if res:
                idx, nm, em = res
                if nm: df.at[idx, "Geschäftsführer"] = nm
                if em: df.at[idx, "E-Mail"] = em

            if ct % checkpoint_interval == 0:
                df.to_csv(output_file, index=False)
                logging.info(f"💾 Zwischenspeicher bei {ct} verarbeitet")

    df.to_csv(output_file, index=False)
    logging.info(f"🛑 Fertig! Gespeichert in {output_file}")


if __name__ == "__main__":
    process_impressum_csv("leads_impressum.csv", "leads_angereichert.csv")
