# Admission World — College Catalogue Backend

## What is included
- `api/colleges.js`: Vercel serverless GET endpoint for the catalogue.
- `cheerio`: open-source HTML parser used to extract table rows from the official NIRF Engineering ranking page.
- `index.html`: searchable college catalogue UI which calls `/api/colleges`.

## API
- `GET /api/colleges` — return up to 250 source records.
- `GET /api/colleges?q=vellore` — filter by college, city or state.
- `GET /api/colleges?state=Tamil%20Nadu&limit=100` — filter by state and limit results.

Responses include the source URL, source year, retrieval timestamp, ranking (when parsed), and a source field for each record. Results are cached for six hours at the edge and in-process where the serverless runtime allows it.

## Deploy
1. Import this repository into Vercel (or let the existing Vercel project deploy the `main` branch).
2. Ensure the project uses a Node.js runtime supported by the current Cheerio release.
3. Deploy. Vercel automatically exposes JavaScript files in `/api` as serverless endpoints.
4. Test `/api/colleges` and `/api/colleges?q=VIT` on the deployed domain.

## Data quality and scope
This is an initial source importer, not a comprehensive or verified list of all Indian private B.Tech colleges. NIRF publishes participating/ranked institutions, including public institutions, and its list is not a complete private-college register. Fees, branch-level eligibility, entrance exams and placement statistics must be collected from the relevant college's official admissions, fee and placement pages and should include a reporting year. The API deliberately leaves those fields empty instead of inventing them.

Before expanding crawling to more domains, check each site's terms and robots.txt, use a clear user-agent, keep request rates low, and avoid login-only or personal data. Do not treat scraped pages as authoritative when an official notice is available.
