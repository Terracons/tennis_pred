# Baseline Tennis

An ATP singles prediction research app prepared for Vercel.

## Run

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3001. A trained model artifact is included. Match lab works without keys; the automatic slip builder requires `ODDSPAPI_KEY`. Set it in `.env.local` for local development or Vercel environment variables for deployment. Never commit the key. The app does not place bets.

## Target-odds slips

**Slip builder** is the home screen. Choose Today, Tomorrow, Next 3 days, Next 7 days, or dates within the next seven days in **Africa/Lagos**. Choose **5, 10, 20, 50, 100**, or custom target odds. Click **Generate Stake slip**. The server automatically fetches upcoming tennis fixtures and Stake match-winner prices from OddsPapi v4. It verifies player identity and court references, applies the trained model including head-to-head, and selects the model favorite from each priced match.

Coverage is ATP main-tour singles only. WTA, doubles, Challenger/ITF, unknown players, unresolved opponents, unsupported surfaces, suspended prices and missing two-sided Stake markets are excluded. Exact normalized full-name matching handles accents and provider short-name variants; ambiguous matches are rejected. Surface comes from the fixture if present, otherwise the latest recorded tournament reference with its date prominently labeled. It is not presented as a current verified court report.

The 16 highest model-probability eligible pairs are shortlisted. Set a maximum of 1 to 8 legs and a minimum model probability per leg. The exhaustive search over that shortlist prefers the highest product of model probabilities within 10% of the target. If that band is impossible, it labels the nearest combination. No repeated players are allowed. This reduces some dependencies but does not establish independence. A requested 100-odds slip is not a guarantee that enough qualifying matches exist.

Combined odds multiply actual provider-reported Stake prices. Combined probability multiplies historical model estimates under an explicit independence assumption. API responses are cached for 60 seconds; generated prices expire five minutes after the provider retrieval began. An old price-change timestamp is displayed separately from the retrieval time because an active price can remain unchanged. Begun fixtures and expired quotes cannot be used in a new slip. The page marks expired slips and disables copy. No other bookmaker is substituted for Stake.

Copy the generated checklist with provider-supplied Stake match links. URLs are accepted only on `https://stake.com`. It is not a Stake booking code and cannot place a bet. The optional stake field calculates a possible total return including stake if every leg wins. Verify availability, price changes, and tennis retirement/void rules on Stake.

Provider usage per uncached date window: one fixture request, one market-catalogue request if supported fixtures exist, then one Stake odds request per four tournaments, capped at 12 tournaments. Coverage limits and exclusion reasons are returned to the UI. The UTC fetch envelope covers the selected Lagos dates; final filtering uses exact Lagos boundaries. No key is returned to the browser or placed in public environment variables. Configure Vercel access protection/rate controls for your provider budget before sharing publicly. Provider subscription/rate-limit failures appear explicitly.

Documentation: https://oddspapi.io/en/docs and https://oddspapi.io/sports/tennis. Tennis sport ID 12 and the winner-market schema were verified against the live API. Catalog definitions are checked at runtime rather than silently interpreting a different market as match winner.

The match lab shows overall and same-surface head-to-head counts, the latest meeting's tournament start date, and both players' last-10 recorded wins. These are dataset records since 2020, not full-career records.

## Vercel deployment

Import `Terracons/tennis_pred` into Vercel. Leave Root Directory at the repository root (`./`). Framework: Next.js. Build: `npm run build`. Use Node.js 22 or newer. Add the existing `ODDSPAPI_KEY` as a server environment variable for Production and redeploy. The key was tested locally without copying it into this repository. Alternatively, from this directory:

```sh
npx vercel login
npx vercel --prod
```

No database or runtime filesystem writes are required. The model is bundled with the deployment. Configure Vercel deployment protection for a personal research deployment. No paid Vercel plan is assumed.

## News

The default source is BBC Sport's public tennis RSS feed at https://feeds.bbci.co.uk/sport/tennis/rss.xml. The app displays up to three dated headline links from the previous 14 days. Headlines matching either player's surname are prioritized. If there are none, general tennis news is explicitly labeled. Surname matching can produce false positives, so users should check relevance. BBC feed reuse terms: https://www.bbc.co.uk/usingthebbc/terms-of-use/#15metadataandrssfeeds.

Optionally create a token at https://www.thenewsapi.com/ and add `THENEWSAPI_TOKEN` in Vercel's environment variables, then redeploy to use player-name searches instead. Locally copy `.env.example` to `.env.local` and set the token. Never place tokens in public variables or commit them. Requests are limited to known players, request three articles from the previous 14 days, and use a 30-minute server cache. Provider quota limits still apply. Enable appropriate Vercel firewall/rate limits before exposing paid provider access publicly.

The app handles empty results and provider failures explicitly. Headlines are source-linked context and never silently adjust probabilities. There is no LLM or OpenAI key requirement: the AI component is a trained logistic regression model.

## Refresh the model

```sh
npm run train
npm test
npm run build
```

The trainer downloads 2020 through the current UTC year from TennisMyLife, filters completed ATP main-tour singles (including ATP 250, ATP 500, Masters, Grand Slams and Finals), excludes retirements/walkovers and deduplicates matches. `DATA_AS_OF=YYYY-MM-DD` can fix the requested cutoff. A failed download preserves the existing model. Rebuild/redeploy to publish updated ratings. An unchanged or archived upstream data source cannot supply current form; inspect the displayed latest tournament date.

Model features: overall Elo difference, surface Elo difference, last-10 win-rate difference, recency-weighted head-to-head advantage and recency-weighted same-surface head-to-head advantage. The last two signals are `(weighted A wins - weighted B wins) / (weighted meetings + 6)`, with a two-year half-life and six neutral prior observations. Missing history is neutral. Their coefficients are learned, not hand-added to the final probability. Aggregate pair records are included in the model artifact; individual raw match rows are not redistributed. Regularized logistic regression learns coefficients on the earliest 75% time boundary, excluding training outcomes unavailable at that boundary. Player identities are symmetric and there is no intercept. The remaining period is a chronological holdout with frozen coefficients and rolling ratings and head-to-head records. No current-match score, serving stats or outcome enters its own feature vector. Equal probabilities receive half credit in accuracy.

The dataset gives tournament start dates, not exact match timestamps. Results become available only 21 days after event start, preventing overlapping tournaments from leaking future results. This intentionally reduces freshness. Cold-start matches with fewer than 10 prior matches per player are excluded from training and evaluation. No post-test hyperparameter tuning or refitting is performed. Brier score, log loss, reliability bins and an Elo baseline are included. Held-out accuracy does not establish betting profitability, calibration in future matches, or superiority over bookmakers. Best-of-three and best-of-five formats are pooled; fitness, withdrawals, scheduling and news are not model features.

## Data rights and provenance

Source: https://github.com/Tennismylife/TML-Database, based in part on Jeff Sackmann's work. See the source's current usage terms. TennisMyLife permits personal, educational and non-commercial research; commercial model use requires written permission. Raw database redistribution is not authorized under its stated terms. This project includes a derived personal research model, not raw match files. Obtain suitable rights or replace the source before commercial publication. Per-season source URLs and SHA-256 checksums are stored in `data/model.json`.

The automatic slip builder integrates Stake prices through OddsPapi. Match lab also permits manual odds comparison. There is no automatic wager placement, booking-code generation, WTA support, or total-games model. Upcoming fixtures and odds are live API data; model histories remain the explicitly dated training snapshot.

## Verification

`npm test` covers player symmetry, invalid inputs, neutral probabilities, rating updates, learning behavior, metric calculations, CSV parsing, artifact consistency, news matching, freshness filtering and unsafe-link rejection. `npm run build` verifies the production application. The default public news feed has been checked through the running API endpoint. The optional paid provider requires a valid token for an end-to-end check.

The version 2 model snapshot processed 14,430 matches, trained weights on 8,103 eligible early observations and evaluated on 2,873 later observations: 63.4% accuracy and 0.218 Brier score. The same evaluation period was viewed in version 1, so this is a development comparison, not a fresh independent validation. The latest included tournament starts on January 17, 2026, so the November 9, 2026 snapshot is explicitly marked stale in the UI. Do not mistake the model generation date for the latest match date. Current news does not refresh historical player ratings. H2H and slip-builder tests cover missing history, symmetry, recency decay, future-result rejection, odds multiplication, target matching, repeated-player exclusion, expired inputs and invalid settings.
