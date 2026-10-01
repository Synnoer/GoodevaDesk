"""
GoodevaDesk - Knowledge Base Crawler & NLP Ingestion Tool
Crawls documentation/FAQ websites or parses local documents, chunks text,
and prepares knowledge base entries for LLM grounding / RAG support.
"""

import sys
import json
import re
import argparse
from typing import List, Dict, Any
from urllib.parse import urljoin, urlparse

try:
    import urllib.request
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


class KnowledgeCrawler:
    def __init__(self, base_url: str = None, max_depth: int = 2):
        self.base_url = base_url
        self.max_depth = max_depth
        self.visited = set()
        self.knowledge_entries: List[Dict[str, Any]] = []

    def clean_text(self, text: str) -> str:
        """Removes extra whitespace and cleans raw HTML text."""
        return re.sub(r'\s+', ' ', text).strip()

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
        """Splits long text into overlapping chunks for NLP processing/embeddings."""
        words = text.split()
        chunks = []
        i = 0
        while i < len(words):
            chunk = " ".join(words[i : i + chunk_size])
            chunks.append(chunk)
            i += max(1, chunk_size - overlap)
        return chunks

    def crawl_url(self, url: str, current_depth: int = 0) -> List[Dict[str, Any]]:
        """Crawls a given URL and extracts knowledge items."""
        if current_depth > self.max_depth or url in self.visited:
            return []

        if not BeautifulSoup:
            print("[Warning] beautifulsoup4 not installed. Run 'pip install beautifulsoup4' for web crawling.")
            return []

        self.visited.add(url)
        print(f"[*] Crawling: {url} (depth={current_depth})")

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "GoodevaDesk-KnowledgeCrawler/1.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"[!] Error fetching {url}: {e}")
            return []

        soup = BeautifulSoup(html, 'html.parser')

        # Remove scripts and styles
        for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()

        title = soup.title.string if soup.title else url
        body_text = self.clean_text(soup.get_text())

        chunks = self.chunk_text(body_text, chunk_size=300, overlap=30)
        entry = {
            "source_url": url,
            "title": self.clean_text(title),
            "raw_text_length": len(body_text),
            "chunks": chunks,
        }
        self.knowledge_entries.append(entry)

        # Find internal links if depth allows
        if current_depth < self.max_depth:
            for link in soup.find_all('a', href=True):
                href = link['href']
                full_url = urljoin(url, href)
                # Only crawl same domain
                if urlparse(full_url).netloc == urlparse(url).netloc:
                    self.crawl_url(full_url, current_depth + 1)

        return self.knowledge_entries

    def process_raw_documents(self, documents: List[Dict[str, str]], extract_entities_flag: bool = True) -> List[Dict[str, Any]]:
        """Processes a list of raw support articles/FAQs and extracts entities."""
        results = []
        gliner_analyzer = None
        if extract_entities_flag:
            try:
                from nlp_ticket_pipeline import GLiNERTicketAnalyzer
                gliner_analyzer = GLiNERTicketAnalyzer()
            except Exception:
                gliner_analyzer = None

        for doc in documents:
            content = doc.get("content", "")
            chunks = self.chunk_text(content)
            keywords = self.extract_keywords(content)
            entities = gliner_analyzer.extract_entities(content) if gliner_analyzer else []

            results.append({
                "title": doc.get("title", "Untitled Document"),
                "category": doc.get("category", "general"),
                "chunks": chunks,
                "keywords": keywords,
                "entities": entities,
            })
        return results

    def extract_keywords(self, text: str, top_n: int = 5) -> List[str]:
        """Simple frequency-based keyword extractor for quick NLP filtering."""
        words = re.findall(r'\b[a-zA-Z]{4,}\b', text.lower())
        stopwords = {
            'this', 'that', 'with', 'from', 'have', 'were', 'which', 'your', 'about',
            'untuk', 'yang', 'dengan', 'dari', 'pada', 'adalah', 'kami', 'bisa', 'akan'
        }
        filtered = [w for w in words if w not in stopwords]
        freq: Dict[str, int] = {}
        for w in filtered:
            freq[w] = freq.get(w, 0) + 1
        sorted_keywords = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        return [k for k, _ in sorted_keywords[:top_n]]


def main():
    parser = argparse.ArgumentParser(description="GoodevaDesk Knowledge Base & NLP Ingestion Tool")
    parser.add_argument("--url", type=str, help="Target URL to crawl FAQ / Knowledge Base")
    parser.add_argument("--depth", type=int, default=1, help="Max crawling depth")
    parser.add_argument("--out", type=str, default="knowledge_base.json", help="Output JSON file path")
    args = parser.parse_args()

    crawler = KnowledgeCrawler(max_depth=args.depth)

    if args.url:
        print(f"Starting knowledge base crawler on {args.url}...")
        results = crawler.crawl_url(args.url)
    else:
        print("No URL specified. Processing sample FAQ knowledge base documents...")
        sample_docs = [
            {
                "title": "Cara Mengatasi Masalah Tagihan dan Invoice",
                "category": "billing",
                "content": "Jika invoice tidak dapat diunduh atau status pembayaran belum diperbarui setelah transfer, pengguna dapat mengirimkan bukti transfer ke billing support. Sistem memproses verifikasi otomatis dalam waktu 10-15 menit."
            },
            {
                "title": "Panduan Reset Password dan Autentikasi Akun",
                "category": "account",
                "content": "Untuk mereset kata sandi, silakan klik tombol 'Lupa Password' di halaman login. Tautan reset akan dikirimkan ke email terdaftar dan berlaku selama 60 menit."
            },
            {
                "title": "Integrasi Webhook dan Penanganan Error HTTP 500",
                "category": "technical",
                "content": "Ketika endpoint webhook mengembalikan status HTTP 500, gateway GoodevaDesk akan melakukan retry otomatis sebanyak 3 kali dengan exponential backoff. Pastikan server penerima membalas dengan status 200 OK."
            }
        ]
        results = crawler.process_raw_documents(sample_docs)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    print(f"✅ Ingestion complete. Saved {len(results)} knowledge base items to '{args.out}'.")


if __name__ == "__main__":
    main()
