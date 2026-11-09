# Baseline Tennis

An ATP singles prediction research app prepared for Vercel.

## Run

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3001. A trained model artifact is included, so the app works without API keys. It does not invent fixtures or make bets. Select a hypothetical or known matchup manually.

## Vercel deployment

Import `Terracons/tennis_pred` into Vercel. Leave Root Directory at the repository root (`./`). Framework: Next.js. Build: `npm run build`. Use Node.js 22 or newer. Alternatively, from this directory:

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

Model features: overall Elo difference, surface Elo difference and last-10 win-rate difference. Regularized logistic regression learns coefficients on the earliest 75% time boundary, excluding training outcomes unavailable at that boundary. Player identities are symmetric and there is no intercept. The remaining period is a chronological holdout with frozen coefficients and rolling ratings. No current-match score, serving stats or outcome enters its own feature vector. Equal probabilities receive half credit in accuracy.

The dataset gives tournament start dates, not exact match timestamps. Results become available only 21 days after event start, preventing overlapping tournaments from leaking future results. This intentionally reduces freshness. Cold-start matches with fewer than 10 prior matches per player are excluded from training and evaluation. No post-test hyperparameter tuning or refitting is performed. Brier score, log loss, reliability bins and an Elo baseline are included. Held-out accuracy does not establish betting profitability, calibration in future matches, or superiority over bookmakers. Best-of-three and best-of-five formats are pooled; fitness, withdrawals, scheduling and news are not model features.

## Data rights and provenance

Source: https://github.com/Tennismylife/TML-Database, based in part on Jeff Sackmann's work. See the source's current usage terms. TennisMyLife permits personal, educational and non-commercial research; commercial model use requires written permission. Raw database redistribution is not authorized under its stated terms. This project includes a derived personal research model, not raw match files. Obtain suitable rights or replace the source before commercial publication. Per-season source URLs and SHA-256 checksums are stored in `data/model.json`.

Stake comparison accepts manually entered decimal odds and removes the two-sided market margin for comparison. There is no Stake API integration, automatic wager placement, live fixture feed, WTA support, or total-games model.

## Verification

`npm test` covers player symmetry, invalid inputs, neutral probabilities, rating updates, learning behavior, metric calculations, CSV parsing, artifact consistency, news matching, freshness filtering and unsafe-link rejection. `npm run build` verifies the production application. The default public news feed has been checked through the running API endpoint. The optional paid provider requires a valid token for an end-to-end check.

The included model snapshot processed 14,430 matches, trained weights on 8,103 eligible early observations and evaluated on 2,873 later observations: 63.3% accuracy and 0.218 Brier score. The latest included tournament starts on January 17, 2026, so the November 9, 2026 snapshot is explicitly marked stale in the UI. Do not mistake the model generation date for the latest match date. Current news does not refresh historical player ratings.
