# Admission World — Nationwide College Catalogue Backend

## Backend files
- `api/colleges.js`: Vercel serverless GET endpoint for the catalogue.
- `package.json`: includes Cheerio, an open-source HTML parser.
- `index.html`: searchable catalogue UI; requests all pages of catalogue data.

## Data source
The backend consumes the community-maintained open-source dataset/API:
- Repository: https://github.com/anburocky3/indian-colleges-data
- API: https://indian-colleges-list.vercel.app/api/institutions

The upstream dataset describes AICTE-derived institution and course records. The API normalizes records and prefers those with engineering/B.Tech-related programme information. Coverage and freshness depend on the upstream dataset; it is not an official guarantee of current approval or exhaustive B.Tech coverage.

## API examples
- `GET /api/colleges` — first 250 matching records.
- `GET /api/colleges?limit=500&offset=500` — next page.
- `GET /api/colleges?q=computer%20science` — search institution and programme text.
- `GET /api/colleges?state=Maharashtra` — filter by state.
- `GET /api/colleges?private=true` — filter to records identified as private/self-financing by upstream metadata.

Response records include institution name, location, university, institution type, matching engineering programmes, intake (where available), and source attribution. Fees, eligibility, entrance exams, official website and placements are left unknown unless sourced; the UI points users to official sources rather than making up figures.

## Deploy and test
1. Ensure the repository is connected to Vercel and deploy the latest `main` branch.
2. Test `/api/colleges?limit=10` and `/api/colleges?q=computer%20science&limit=10`.
3. Check Vercel function logs if the upstream API times out or changes its response schema.

## Data quality and responsible crawling
Verify a college's current AICTE approval, programme availability, admission eligibility, fee schedule, entrance requirements and placement reports from official sources before publishing those details as confirmed. Respect source terms, robots.txt and reasonable request rates. The current backend caches results for six hours.


## Mandatory login and Firecrawl setup

The homepage now has a Supabase email/password login and signup gate. The catalogue API and Firecrawl endpoint validate the bearer token against Supabase Auth. This requires configuration before users can enter the site.

Add these variables in Vercel → Project → Settings → Environment Variables, then redeploy:
- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_ANON_KEY`: the Supabase publishable/anon key (safe for browser use; do not use a service-role key).
- `FIRECRAWL_API_KEY`: secret API key from your Firecrawl account.

Then in Supabase:
1. Create a project at https://supabase.com.
2. Open Authentication → Providers → Email and enable email/password sign-in.
3. Configure the site's production URL and allowed redirect URLs in Authentication → URL Configuration.
4. Decide whether email confirmation should be enabled. If enabled, new users must confirm their email before logging in.
5. Keep `FIRECRAWL_API_KEY` server-side only. Never place it in HTML or any `NEXT_PUBLIC_*`/browser variable.

Endpoints:
- `GET /api/config` returns only the public Supabase URL and anon key needed by the login UI.
- `GET /api/colleges` requires `Authorization: Bearer <Supabase access token>`.
- `POST /api/scrape` requires a signed-in user and JSON body such as `{"url":"https://example.edu/admissions"}`; it returns extracted markdown from Firecrawl.

Important: Firecrawl is a hosted scraping API, so a Firecrawl API key/account and applicable usage quota are required. Installing the SDK alone does not provide free scraping capacity. The login gate is enforced in the browser and catalogue/scraper APIs validate tokens server-side; any other private API route should also validate the Supabase token.
