# Baseline Tennis

An ATP singles prediction research app prepared for Vercel.

## Run

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3001. A trained model artifact is included. Match lab needs internet access to the public history feed but no key; the automatic slip builder also requires `ODDSPAPI_KEY`. Set it in `.env.local` for local development or Vercel environment variables for deployment. Never commit the key. The app does not place bets.

## Target-odds slips

**Slip builder** is the home screen. Choose Today, Tomorrow, Next 3 days, Next 7 days, or dates within the next seven days in **Africa/Lagos**. Choose **5, 10, 20, 50, 100**, or custom target odds. Click **Generate Stake slip**. The server automatically fetches upcoming tennis fixtures and Stake match-winner prices from OddsPapi v4. It verifies player identity and court references, applies the trained model including head-to-head, and selects the model favorite from each priced match.

Coverage is ATP main-tour singles only. WTA, doubles, Challenger/ITF, unknown players, unresolved opponents, unsupported surfaces, suspended prices and missing two-sided Stake markets are excluded. Exact normalized full-name matching handles accents and provider short-name variants; ambiguous matches are rejected. Surface comes from the fixture if present, otherwise the latest recorded tournament reference with its date prominently labeled. It is not presented as a current verified court report.

The 16 highest model-probability eligible pairs are shortlisted. Set a maximum of 1 to 8 legs and a minimum model probability per leg. The exhaustive search over that shortlist prefers the highest product of model probabilities within 10% of the target. If that band is impossible, it labels the nearest combination. No repeated players are allowed. This reduces some dependencies but does not establish independence. A requested 100-odds slip is not a guarantee that enough qualifying matches exist.

Combined odds multiply actual provider-reported Stake prices. Combined probability multiplies historical model estimates under an explicit independence assumption. API responses are cached for 60 seconds; generated prices expire five minutes after the provider retrieval began. An old price-change timestamp is displayed separately from the retrieval time because an active price can remain unchanged. Begun fixtures and expired quotes cannot be used in a new slip. The page marks expired slips and disables copy. No other bookmaker is substituted for Stake.

Copy the generated checklist with provider-supplied Stake match links. URLs are accepted only on `https://stake.com`. It is not a Stake booking code and cannot place a bet. The optional stake field calculates a possible total return including stake if every leg wins. Verify availability, price changes, and tennis retirement/void rules on Stake.

Provider usage per uncached date window: one fixture request, one market-catalogue request if supported fixtures exist, then one Stake odds request per four tournaments, capped at 12 tournaments. Coverage limits and exclusion reasons are returned to the UI. The UTC fetch envelope covers the selected Lagos dates; final filtering uses exact Lagos boundaries. No key is returned to the browser or placed in public environment variables. Configure Vercel access protection/rate controls for your provider budget before sharing publicly. Provider subscription/rate-limit failures appear explicitly.

Documentation: https://oddspapi.io/en/docs and https://oddspapi.io/sports/tennis. Tennis sport ID 12 and the winner-market schema were verified against the live API. Catalog definitions are checked at runtime rather than silently interpreting a different market as match winner.

The match lab and automatic fixture table show the latest five available head-to-head meetings, newest first, with source dates, surfaces and winners. Fewer than five meetings are explicitly labeled; missing meetings are never invented. The model uses this recent-meeting signal alongside overall and same-surface head-to-head and both players' last-10 recorded results. Coverage starts in 2020, so these are not full-career records. Retirements and walkovers are excluded.

## Vercel deployment

Import `Terracons/tennis_pred` into Vercel. Leave Root Directory at the repository root (`./`). Framework: Next.js. Build: `npm run build`. Use Node.js 22 or newer. Add the existing `ODDSPAPI_KEY` as a server environment variable for Production and redeploy. The key was tested locally without copying it into this repository. Alternatively, from this directory:

```sh
npx vercel login
npx vercel --prod
```

No database or runtime filesystem writes are required. The trained coefficients are bundled with the deployment. Current histories are fetched server-side with a 15-minute in-memory cache; cold serverless instances fetch again. Page and board functions allow up to 60 seconds. Configure Vercel deployment protection for a personal research deployment. No paid Vercel plan is assumed.

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

The active source is https://stats.tennismylife.org/api/data-files, using annual files from 2020 through the current UTC year plus `ongoing_tourneys.csv`. The old archived GitHub downloads are no longer used. Both training and live history refresh filter completed ATP main-tour singles (ATP 250, ATP 500, Masters, Grand Slams and Finals), exclude incomplete scores, retirements/walkovers, and deduplicate annual/ongoing overlaps. `DATA_AS_OF=YYYY-MM-DD` can fix a training cutoff. A failed training download preserves the existing artifact.

Live inference refreshes Elo, surface ratings, last-10 form, overall H2H and latest-five H2H from published completed results without retraining or redeploying. The server cache lasts 15 minutes; an open dashboard requests refreshes at that interval and blocks new manual predictions if its history has expired. Each board shows a history-check timestamp and the latest result's source date. If a fresh download fails, no stale prediction is substituted: the page shows the saved snapshot only for reference, and board requests fail explicitly. A freshly checked source may still contain older results during gaps in play. Coefficients remain fixed until `npm run train` and a redeployment.

Six model features: overall Elo difference, surface Elo difference, last-10 win-rate difference, recency-weighted overall H2H advantage, same-surface H2H advantage, and latest-five H2H advantage. The three H2H signals are `(weighted A wins - weighted B wins) / (weighted meetings + 6)`, with a two-year half-life and six neutral prior observations. Latest-five uses only the five most recent eligible meetings across surfaces. Missing history is neutral. All coefficients are learned. The artifact contains derived ratings, aggregate pair records, and limited recent meeting summaries, not raw CSV files. Regularized logistic regression learns coefficients on the earliest 75% time boundary, excluding training outcomes unavailable at that boundary. Player identities are symmetric and there is no intercept. The remaining period is a chronological holdout with frozen coefficients and rolling ratings and head-to-head records. No current-match score, serving stats or outcome enters its own feature vector. Equal probabilities receive half credit in accuracy.

Source dates may describe tournament starts rather than exact match timestamps. Historical training and evaluation therefore delay outcomes by 21 days to guard against overlapping-tournament leakage. This delay does not apply to live inference, which can use results already published as complete. Cold-start matches with fewer than 10 prior matches per player are excluded from training and evaluation. No post-test hyperparameter tuning or refitting is performed. Brier score, log loss, reliability bins and an Elo baseline are included. Held-out accuracy does not establish betting profitability, calibration in future matches, or superiority over bookmakers. Best-of-three and best-of-five formats are pooled; fitness, withdrawals, scheduling and news are not model features.

## Data rights and provenance

Source and usage terms: https://stats.tennismylife.org/tennis-match-database. TennisMyLife permits personal, educational and non-commercial research; commercial model use requires written permission. Raw database redistribution is not authorized under its stated terms. This project includes a derived personal research model, not raw match files. Obtain suitable rights or replace the source before commercial publication. Source URLs, modification dates and SHA-256 checksums are stored in `data/model.json` and refreshed with runtime histories.

The automatic slip builder integrates Stake prices through OddsPapi. Match lab also permits manual odds comparison. There is no automatic wager placement, booking-code generation, WTA support, or total-games model. Upcoming fixtures, odds and published result histories are retrieved independently from their respective providers.

## Verification

`npm test` covers player symmetry, invalid inputs, neutral probabilities, rating updates, learning behavior, metric calculations, CSV parsing, artifact consistency, news matching, freshness filtering and unsafe-link rejection. `npm run build` verifies the production application. The default public news feed has been checked through the running API endpoint. The optional paid provider requires a valid token for an end-to-end check.

The version 3 artifact processed 16,743 matches with source dates through November 11, 2026, trained on 9,610 observations and evaluated on 3,260 later observations: 64.4% accuracy, 0.219 Brier score. The evaluation period partly overlaps previous versions, so this is development evidence, not fresh independent validation. Tests cover latest-five ordering and truncation, reversed player identities, small samples, completed-score filtering, annual/ongoing deduplication, immediate live updates, history-provider failures, provenance, and slip behavior.
