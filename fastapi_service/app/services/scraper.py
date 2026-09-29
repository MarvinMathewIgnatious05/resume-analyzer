import re
import logging
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("fastapi_service")

class JobScraper:
    @staticmethod
    def scrape(url: str) -> dict:
        """
        Fetches and extracts job title, company, and raw job description requirements from a target URL.
        """
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }

        try:
            logger.info(f"Fetching job listing URL: {url}")
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "html.parser")

            # Extract Title via OpenGraph / Twitter / Title tag
            title = None
            og_title = soup.find("meta", attrs={"property": "og:title"}) or soup.find("meta", attrs={"name": "twitter:title"})
            if og_title and og_title.get("content"):
                title = og_title["content"].strip()
            elif soup.title and soup.title.string:
                title = soup.title.string.strip()
            elif soup.find("h1"):
                title = soup.find("h1").get_text(strip=True)

            # Clean up title if it contains common site suffixes
            if title:
                title = re.split(r'\s*[-|–•]\s*(?:LinkedIn|Indeed|Glassdoor|Careers|Job|Apply)', title, flags=re.IGNORECASE)[0].strip()

            # Extract Company Name
            company = None
            og_site = soup.find("meta", attrs={"property": "og:site_name"})
            if og_site and og_site.get("content"):
                company = og_site["content"].strip()

            # Remove scripts, styles, header, footer, nav tags
            for tag in soup(["script", "style", "nav", "header", "footer", "iframe", "noscript", "svg", "form"]):
                tag.decompose()

            # Search main article or job container, fallback to body
            container = (
                soup.find("article") or
                soup.find("main") or
                soup.find("div", class_=re.compile(r'job|description|details|content|posting', re.I)) or
                soup.body
            )

            text_content = ""
            if container:
                lines = (line.strip() for line in container.get_text(separator="\n").splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text_content = "\n".join(chunk for chunk in chunks if chunk)

            # Truncate if excessively long
            if len(text_content) > 15000:
                text_content = text_content[:15000]

            return {
                "job_title": title or "Target Job Posting",
                "company": company or "Target Company",
                "raw_text": text_content or "No readable job description text could be extracted.",
                "source_url": url
            }

        except Exception as e:
            logger.error(f"Error scraping job URL {url}: {str(e)}")
            raise ValueError(f"Failed to fetch job URL: {str(e)}")
