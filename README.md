# Vlad's Site: Article Engine + SEO Machine

Justin Welsh style personal site. Static HTML (fast, fully indexable by Google), with a full dashboard at `/admin` where you write articles, create pages, and control every site setting without touching code.

## Your dashboard at /admin

Three sections:

**Articles**: write, edit, draft, and publish. Live preview shows the article in your actual site design while you write.

**Pages**: create any new page from the dashboard. Give it a title, write the content, and choose:
- whether it shows in the navigation menu (and in what order)
- its menu label
- whether it gets the community CTA at the bottom

The page goes live at `yourdomain.com/your-page-title/`, enters the sitemap and llms.txt automatically, and gets full SEO treatment. The About page is built this way, so open it in the dashboard to see the pattern.

**Site settings**: your name, hero text, community URL (powers every CTA on the site), social links, analytics IDs, UTM defaults, and your three brand colors with color pickers. Change the orange once, the whole site follows.

## The CTA system

Every article and page ends with a CTA block, and the homepage has a CTA band. They all work on one rule:

**Global CTA** (Site settings > Global CTA heading / text / button label / button link): this is the default. Edit it once and it changes on the homepage and on every article and page ever created, past and future, on the next publish.

**Per-page custom CTA**: every article and page has four optional fields (heading, text, button label, button link). Fill any of them and that page uses your custom version instead of the global one. Leave them empty and the page keeps inheriting the global CTA. You can also switch the CTA off entirely per page with the toggle.

Useful pattern: point an article's CTA button link at a specific product (your Color Grading Manual sales page for a color grading article) instead of the community. The UTM engine tags those links too, as long as they point to your community domain; for other domains add UTMs manually in the link.

The sample article "Your first digital product" ships with a custom CTA filled in so you can see the override in action. Open it in the dashboard, clear those fields, and watch it fall back to the global one.

## How publishing works

You open `yourdomain.com/admin`, log in, write an article in a clean editor (with a link button for your community hyperlinks), hit Publish. That commits a markdown file to your GitHub repo, Netlify rebuilds the site in about 30 seconds, and the article is live as a real static page with meta description, Open Graph tags, JSON-LD schema, sitemap entry, and RSS entry. Everything Google wants.

## One-time setup (about 15 minutes)

### 1. Push this folder to GitHub

Create a new repo (private is fine), then from inside this folder:

```
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### 2. Connect to Netlify

In Netlify: Add new project > Import from GitHub > pick the repo. Build settings are auto-detected from `netlify.toml` (build command `npm run build`, publish folder `_site`). Deploy.

### 3. Connect your domain

Netlify > Domain management > add your domain, follow the DNS steps. Wait for HTTPS to activate.

### 4. Set up the editor login (DecapBridge)

Netlify Identity is deprecated, so we use DecapBridge (free):

1. Go to https://decapbridge.com and sign up
2. Add your site, install their GitHub app on your repo when asked
3. DecapBridge gives you a `repo` value and an `identity_url`
4. Open `src/admin/config.yml`, replace the two placeholders at the top, also set `site_url` to your domain
5. Commit and push. Netlify rebuilds.
6. Invite yourself as a user in the DecapBridge dashboard, set your password from the email

Now `yourdomain.com/admin` is your writing desk.

### 5. Make it yours

In `/admin` under "Site settings" (or directly in `src/_data/site.json`) update:

- `url`: your real domain
- `community_url`: your Skool / Circle link (this powers every CTA button and callout on the site)
- Hero headline, subtext, social links

Also put your real domain in `src/robots.txt` (the Sitemap line).

The two sample articles are there so you can see the structure. Edit or delete them from `/admin`.

## Writing articles that pull SEO traffic

- The **Description** field is your Google meta description. Write it like a hook.
- Use the link button in the editor to hyperlink phrases to your community page inside the article body. Every article also gets an automatic community callout at the bottom, no work needed.
- Toggle **Draft** on to save without publishing.
- Slugs come from your title, so titles with your keywords become URLs with your keywords.

## Analytics: see where people come from

1. Create a free Google Analytics 4 property at https://analytics.google.com and copy the Measurement ID (looks like `G-XXXXXXXXXX`)
2. In `/admin` > Site settings, paste it in the GA4 field, publish
3. Done. GA4 now shows you traffic sources (Google, Instagram, YouTube, direct), which articles get read, and every inbound UTM campaign under Reports > Acquisition > Traffic acquisition

If you prefer Plausible (paid, prettier, cookie-free), put your domain in the Plausible field instead. Both can run at the same time during a transition.

## UTM tracking, both directions

**Inbound:** put UTMs on any link you share, for example your Instagram bio link or Meta Ads:
`https://yourdomain.com/articles/some-article/?utm_source=instagram&utm_medium=bio&utm_campaign=story-july`
GA4 reads these automatically and shows the campaign in Traffic acquisition.

**Outbound (built into the site):** every link to your community gets automatically tagged when clicked:
- `utm_source` and `utm_medium`: your defaults from Site settings
- `utm_content`: the slug of the article that sent the click
- `utm_campaign`: the campaign that originally brought the visitor to your site (remembered for 30 days), or `organic` if they came from search
- `first_source`: the original traffic source, so you can trace ad-to-member journeys

So when someone lands on the community page, the URL tells you: this person came from the Meta ad "story-july", read the wedding article, and clicked from there. Check these in Skool/Circle referrer data or by making the community URL a GA4-tracked page.

## AI search optimization (ChatGPT, Claude, Perplexity)

The site is built to be found and cited by AI systems:

- **`/llms.txt`**: the emerging standard file AI systems read to understand a site. It regenerates automatically on every build, always listing your current articles with descriptions. Nothing to maintain.
- **robots.txt explicitly allows** GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, and the other major AI crawlers, so your articles can appear in AI answers with links back to you.
- **Structured data everywhere**: Article, BreadcrumbList, WebSite, and Person schema on every relevant page. Semantic HTML, clean headings, descriptive URLs. This is what both Google and AI retrieval systems parse best.

Practical tip for AI visibility: write articles that answer specific questions in the first two paragraphs (like "how do photographers sell presets"), because AI systems quote sections that directly answer a query.

## Local preview (optional)

```
npm install
npm start
```

Site runs at http://localhost:8080

## Design system

Fraunces (display) + DM Sans (body). Palette lives at the top of `src/css/style.css` as CSS variables: deep green `#16342a`, orange `#e8622c`, cream `#f8f4ec`. Change once, changes everywhere.
