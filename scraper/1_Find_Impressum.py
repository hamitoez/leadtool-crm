import pandas as pd
import requests
from bs4 import BeautifulSoup
import time
from urllib.parse import urljoin
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os

# Logging-Konfiguration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# ==========================
# Konfiguration
# ==========================
CACHE_FILE = "impressum_cache.json"  # Datei zum Speichern der Cache-Daten
DEEPSEEK_API_KEY = "sk-"  # <--- Hier deinen Deepseek API-Key einfügen
DEEPSEEK_MODEL = "deepseek-reasoner"  # Beispiel: Name des Deepseek-Modells
DEEPSEEK_API_BASE = "https://api.deepseek.com"  # Beispiel: Endpoint von Deepseek

# Rate Limit (optional)
    #MAX_CALLS_PER_MINUTE = 14
    #WINDOW_SIZE = 60
    #API_CALLS = []

# ==========================
# Hilfsfunktionen
# ==========================

def load_cache():
    """Lädt den Cache aus einer JSON-Datei."""
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {}

def save_cache(cache):
    """Speichert den Cache in einer JSON-Datei."""
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)

#def check_rate_limit():
#    """Überprüft das Rate Limit und wartet, falls nötig."""
#    now = time.time()
#    global API_CALLS
#    API_CALLS = [t for t in API_CALLS if now - t < WINDOW_SIZE]
#    if len(API_CALLS) >= MAX_CALLS_PER_MINUTE:
#        wait_time = WINDOW_SIZE - (now - API_CALLS[0])
#        logging.info(f"Rate Limit erreicht. Warte {wait_time:.1f} Sekunden...")
#        time.sleep(wait_time)
#    API_CALLS.append(time.time())

def scrape_homepage(url, retries=3):
    """Ruft den HTML-Inhalt einer Webseite ab."""
    headers = {"User-Agent": "Mozilla/5.0"}
    for attempt in range(retries):
        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            return response.text
        except requests.exceptions.Timeout:
            logging.warning(f"Timeout bei {url}. Neuer Versuch ({attempt+1}/{retries})...")
        except requests.exceptions.RequestException as e:
            logging.error(f"Fehler beim Abrufen der Webseite {url}: {e}")
            break
    return ""

def find_impressum_locally(homepage_html, base_url):
    """Sucht das Impressum lokal im HTML-Inhalt."""
    soup = BeautifulSoup(homepage_html, "html.parser")
    keywords = ["impressum", "imprint"]
    for keyword in keywords:
        links = soup.find_all("a", href=True, text=lambda t: t and keyword.lower() in t.lower())
        if not links:
            links = soup.find_all("a", href=lambda href: href and keyword.lower() in href.lower())
        if links:
            impressum_url = links[0]["href"]
            if impressum_url.startswith("/"):
                impressum_url = urljoin(base_url, impressum_url)
            logging.info(f"Lokal gefundene Impressum-URL: {impressum_url}")
            return impressum_url
    return ""

def deepseek_find_impressum(homepage_html, base_url):
    """Nutzt die Deepseek-API, um das Impressum zu finden."""
   # check_rate_limit()
    try:
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "model": DEEPSEEK_MODEL,
            "messages": [
                {"role": "system", "content": "Du bist ein Experte für Web Scraping."},
                {"role": "user", "content": f"Finde das Impressum im folgenden HTML:\n{homepage_html}"}
            ],
            "max_tokens": 4000,
            "temperature": 0.2
        }
        response = requests.post(f"{DEEPSEEK_API_BASE}/chat/completions", headers=headers, json=data)
        response.raise_for_status()
        impressum_url = response.json()["choices"][0]["message"]["content"].strip()
        if impressum_url.lower() == "keine gefunden":
            return ""
        if impressum_url.startswith("/"):
            impressum_url = urljoin(base_url, impressum_url)
        logging.info(f"Deepseek gefundene Impressum-URL: {impressum_url}")
        return impressum_url
    except Exception as e:
        logging.error(f"Fehler bei Deepseek API: {e}")
        return ""

def process_single_website(row, index, df, cache):
    """Verarbeitet eine einzelne Website und gibt die Impressum-URL zurück."""
    website = str(row.get("website", "")).strip()
    if not website:
        return ""

    if website in cache:
        logging.info(f"Cache-Treffer für {website}: {cache[website]}")
        return cache[website]

    logging.info(f"Scrape Homepage: {website}")
    homepage_html = scrape_homepage(website)
    if not homepage_html:
        logging.warning(f"Keine Inhalte für {website}, überspringe...")
        return ""

    # Lokale Suche zuerst
    impressum_url = find_impressum_locally(homepage_html, website)
    if not impressum_url:
        # Falls lokal nichts gefunden wurde, Deepseek-API verwenden
        logging.info("Lokale Suche erfolglos. Verwende Deepseek-API...")
        impressum_url = deepseek_find_impressum(homepage_html, website)

    cache[website] = impressum_url
    return impressum_url

def process_websites(input_file, output_file):
    """Verarbeitet alle Websites in der CSV-Datei."""
    cache = load_cache()
    df = pd.read_csv(input_file, delimiter=",", keep_default_na=False)
    if "website" not in df.columns:
        logging.error("Die CSV-Datei muss eine Spalte 'website' enthalten.")
        return

    df["Impressum_URL"] = ""

    with ThreadPoolExecutor(max_workers=5) as executor:  # 5 Threads gleichzeitig
        futures = {
            executor.submit(process_single_website, row, index, df, cache): (row, index)
            for index, row in df.iterrows()
        }

        for future in as_completed(futures):
            row, index = futures[future]
            try:
                impressum_url = future.result()
                df.at[index, "Impressum_URL"] = impressum_url
            except Exception as e:
                logging.error(f"Fehler bei der Verarbeitung von {row['website']}: {e}")

    df.to_csv(output_file, index=False)
    save_cache(cache)
    logging.info(f"Ergebnisse gespeichert in {output_file}")

# ==========================
# Hauptprogramm
# ==========================
if __name__ == "__main__":
    df_path = "leads.csv"  # Datei mit Spalte "website"
    output_path = "leads_impressum.csv"
    process_websites(df_path, output_path)
