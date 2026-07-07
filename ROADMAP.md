# Maroon — Roadmap & Backlog

Living plan for the game. Origin of this doc: a multi-agent assessment (2026-06-16) that mapped what's
actually shipped vs the README, then a run of focused features. Pick up any **Deferred** (near-term
hygiene + features) or **Vision** (the elite, keep-the-magic-alive bets) item below — each has a why and
a starting point.

## Shipped

The best-of-three **series** system is the product's spine (despite CLAUDE.md still listing parts of it
as "deferred"): `src/series/**` — seeded form/injury carryover, club-round conditioning, stakes/wrap
logic, three venues, validated `localStorage`. The engine purity invariant holds (`src/engine/**` has
zero React/DOM imports; `simulateMatch(setup, seed)` is a pure deterministic function).

Recent feature work:

- **Home-ground edge** — a per-side effective-attr nudge folded into the form map, scaled by each
  venue's `homeAdvantage` (Suncorp fortress → MCG near-neutral). `TUNING.homeEdge` in `ratings.ts`,
  `homeEdgeBySide()`, applied in `simulate.ts buildFormMap`. Pure, no rng.
- **Series integration test** — `src/series/__tests__/seriesIntegration.test.ts` round-trips real
  `simulateMatch` → `applyGameResult` → `advanceConditions` → next game, + determinism. Pins the
  engine↔series carryover contract.
- **Shareable result card** — Wordle-style copy-to-clipboard block on the hub (`series/shareCard.ts`,
  `ui/components/ShareCard.tsx`).
- **Career ledger** — completed series archived under a 2nd key `maroon.career.v1`
  (`series/career.ts` + `careerPersist.ts`); hub shows all-time shields / series / games W-L + a
  series-MVP hall of fame (`ui/components/CareerLedger.tsx`). IDs + score tally only, never attributes.
- **Scoped UX + a11y pass** — selection screen floats natural-fit players to the top of the pool when a
  slot is active (+ scroll-to-pool); full keyboard operability + global `:focus-visible`; a global
  `prefers-reduced-motion` guard; squad-count copy reconciled to "19 + 2 reserves".
- **Named callers + TV cadence** — play-by-play uses surnames; two callers wired via `callerFor()`
  (lead Thommo = the moments, co Petero = the grind), shown on speaker-change in the feed.
- **Deepened analyst color** — `colorCommentary.ts` pools doubled to 4-6 in-voice lines per
  persona/moment.
- **NSW opponent variety** — three zone-varied Blues sides (`src/data/bluesVariants.ts`): the canonical
  right-edge side, a left-edge side (Latrell/Martin run at your right), and a middle-bashing forward
  pack. One is drawn deterministically per series from `rootSeed` (`bluesForSeed`), fixed across all
  three games, revealed in the scouting report — the player never picks the opponent. Each side ships
  its own `edgeThreats`; the booth pre-game now reads the drawn side's threat zone + playmaker
  (opponent-aware `derivePreGameFacts` + `{yourEdge}`/`{threatPhrase}`/`{theirHalf}` tokens, no
  hardcoded "left edge"). Persisted via `SeriesState.opponentId` (schema v2→v3, validated). Built to
  equal strength / different shape — balance guard in `bluesVariants.test.ts` keeps avg margins within
  ~one converted try. The engine was already opponent-agnostic, so `simulate.ts` is untouched.
- **Difficulty dial** (Casual / Origin / Hard) — `src/series/difficulty.ts`: a uniform NSW effective-attr
  nudge (`DIFFICULTY_TUNING` ±6, Origin = 0) folded into the form map at the `App.tsx` kickoff boundary,
  so the engine never learns "difficulty" and Origin stays byte-identical. Chosen on the game-1 selection
  screen (segmented keycap control), locked once game 1 is played, persisted as optional
  `SeriesState.difficulty` (no schema bump — a pre-dial save reads as Origin). Composes additively with
  form, the home edge, and the drawn Blues side. Recorded on the share card ("⚙️ Difficulty: Hard").
  Behavioural guard in `difficulty.test.ts` proves it bites monotonically through the engine.
- **The Daily Origin** (2026-07-06 — Vision bet #2, shipped first as planned) — `src/daily/**`: a
  date-seeded, one-attempt-per-day one-shot match with a Wordle-style **win streak**. The local date key
  FNV-hashes to a seed (`dailyChallenge.ts`) that draws the Blues side (`bluesForSeed`), the ground (all
  three venues rotate — away days included), and a **twist** from a 7-strong catalog (`twists.ts`: The
  Full 80 / Blues at career best / five-day turnaround / depleted spine / decimated pack / hostile
  cauldron / blood-the-kids). Twists compose at the App kickoff boundary exactly like the difficulty
  dial (uniform form-map deltas + a ruled-out set derived from the LIVE squad + an optional forced
  venue) — the engine never learns "daily". The full pool is fit in the Daily (a what-if — Coates and
  Dearden are pickable) unless the twist says otherwise. Ledger (`dailyLedger.ts`) stores one immutable
  result per date key under `maroon.daily.v1` (`dailyPersist.ts`, defensive validation); streak = wins on
  consecutive days, snapped by a loss/draw/missed day, best preserved (`summariseDaily`). Share card
  (`dailyShareCard.ts`) brags day + twist + score + fire. UI: gold `DailyPanel` on the hub (unplayed
  pitch / played lock-in + midnight countdown), a teaser strip on the game-1 selection screen (a fresh
  save never sees the hub, so the Daily must be discoverable there), `DailySelectionScreen` +
  `DailyResultScreen` reusing the picker/result kit, pre-game/live screens reused verbatim. 20 tests
  across three suites incl. a twist-viability guard (every twist leaves a fillable 19+2) and an
  engine-contract pin (App's composition mirrored in `dailyIntegration.test.ts`).

- **Deployed to GitHub Pages** (2026-07-06) — live at https://tuulieteam.github.io/maroon/
  (repo `TuulieTeam/maroon`, public, mates-only by obscurity). `.github/workflows/deploy.yml`: push
  to `main` → pnpm install (pinned via `packageManager`) → typecheck → full test suite (the deploy
  gate) → build → Pages. `base: '/maroon/'` for builds only; dev stays at `/:3001`. Both share cards
  end with the game URL (`src/gameUrl.ts`). Work lands on `origin-series`; ship = push to `main`.
- **The Trophy Cabinet** (2026-07-06 — chase layer, feats v1) — `src/feats/**`: a pure predicate
  catalog (18 launch feats across series shape / difficulty chase / Blues variants / match stat
  lines / the Daily) judged at the App boundary at three moments (match result, daily result, series
  completion — the completion judgement folds the game through the pure reducer at the call site, no
  effects). Earns persist under `maroon.feats.v1` (facts only: first date + count + detail string).
  **Career ledger v2** in a single upgrade-not-discard migration: archives `difficulty` +
  `opponentId`, reserves `iconicMoment`/`nemesis`/`year` slots for the rest of the chase layer.
  Retro-mint back-fills daily + scoreline-shape feats from existing archives; stat feats stay
  earn-forward (stats were never archived — the price of IDs-only saves, kept honest). UI: earn
  toasts on both result screens, hub trophy cabinet (locked feats = silhouettes with hint text),
  `🏅 First:` share-card line for new mints only.

- **The Back Page** (2026-07-06 — coach pillar, drop 2) — `src/coach/**`: the media reacts to YOUR
  team sheet. `storylines.ts` derives the bold calls at lock-in (picked 19 vs the media-expected
  side — last game's XVII mid-series, form-aware auto side for an opener): axed-star /
  recalled-outcast / blooded-rookie / kept-faith / gamble-doubtful / positional-shock, one story per
  man, boldest first. `headlines.ts`: the paper takes a POSITION on the splash pre-game
  (backs/savages, seeded) and the result settles it — vindication or the pile-on. Slater fronts a
  seeded post-game press conference (`pressConference.ts`) whose tone shifts with the hot-seat band.
  `pressure.ts`: 0–100 index persisted under `maroon.coach.v1`, moved by series results (lost
  deciders burn, sweeps are a crisis, shields buy air) + settled takes; bands Untouchable → Dead Man
  Walking on a hub gauge. **The sack (era end) lands with the Dynasty** — CoachState reserves the
  shape. UI: newsprint-inverted `BackPagePanel` on pre-game + result, `HotSeat` on the hub. All at
  the App boundary; zero engine changes; the Daily stays media-free (arcade).

- **THE DYNASTY, foundation** (2026-07-06 — flagship, drops 3a–3d = plan M0+M1) — `src/dynasty/**` +
  `src/data/ages.ts` (authored birth years for the QLD 32). **Aging is a resolved roster, not a form
  delta**: `resolveRoster(base, overlay, year, startYear)` = base minus retirees, attrs = clamp(base
  + cumulative delta, 30..99), statuses cleared + dynasty notes from year 2 — selection, auto-fill,
  conditions, storylines, and the engine consume the resolved `Player[]` unchanged (zero engine
  edits). The overlay (deltas + retired ids) is **stored** under `maroon.dynasty.v1` so history
  hardens while base-data rebalances still propagate. `runOffseason` is the one deterministic
  transition (offseasonSeed(dynastySeed, year); fixed 7 draws/player, sorted ids): aging curves
  (growth ≤25, peak 26–28, decline steepening; speed decays ×1.6, craft grows through 30; bolters
  burn bright), retirement rising to a hard 100% at 36, **viability-capped in M1** (probabilistic:
  squad ≥24 + every natural position keeps 2 fits; forced 36+: absolute floor 22 — "goes around one
  more year" until the M2 rookie class refills the pool). The dynasty ADOPTS the live series as year
  one (`dynastySeriesSeed(seed, start, start) === seed`), hands each new year its deterministic seed
  + neutral-start conditions (`initSeries(..., qldPool, neutralStart)`), labels career entries with
  `year`, and shows the year strip on the hub. `OffseasonScreen`: farewells (authored pools), summer
  movers, the era line ("Year 2 of the dynasty · 1 shield"). **M0 roster seam**: `squad: Player[]`
  parameterised through useSquadSelection / SelectionScreen / ClubFormReport /
  initSeries / applyGameResult / useSeries with behaviour-preserving defaults. The Daily deliberately
  stays on the base 2026 squad — same challenge for every mate regardless of dynasty year. 310 tests
  (17 new: determinism twins, aging-shape statistics, no-immortals-above-the-floor, 15-year
  viability, DCE-retires-first, persist garbage tolerance, roster resolution).

- **The Moment** (2026-07-06 — chase layer, drop 4) — `src/engine/iconicMoment.ts`: the plan's ONE
  deliberate engine touch, a pure **zero-rng post-hoc scan** of the completed events array inside
  `simulateMatch` (play stream byte-identical, determinism-pinned). Priority ladder: last-ten field
  goal dagger in a one-score game → the last lead-taking try the winner never trailed after
  (conversion-led leads crown their try) → the second-half back-breaker in wire-to-wire blowouts →
  the POTM's best play (draws included). Crowned regardless of side. `result.iconicMoment` + Thommo
  closes every post-game wrap with the rendered line (seed×minute arithmetic pick; postGame band pin
  5→6). Result screens show the ⭐ Moment card; the career archives **one frozen line per series** —
  the shield-deciding game's (`decidingGame()` in `summary.ts`) — onto `LedgerEntry.iconicMoment`,
  surfaced as epigraphs on the hub's career ledger with year/decider tags. Scarcity is deliberate:
  one remembered moment per series is what makes it legend.

- **The Hot Seat goes live** (2026-07-06 — coach pillar, drop 5) — `src/coach/coaches.ts` +
  `board.ts`: the board meets at every season close (the off-season click) and acts on two public
  triggers: **Dead Man Walking (≥80) whatever the result**, or **Under Siege (≥60) + a second
  straight lost series**. A sacking closes the era into an immutable `CoachEra` archive (seasons,
  shields, the board's frozen verdict line) and installs the next legend from the authored
  succession (Slater → Smith → Thurston → Lockyer → Langer → Meninga), each with a media
  temperament setting his honeymoon pressure (beloved 25 / measured 30 / combative 35). All media
  surfaces (back pages, pressers, hub gauge) speak about the current clipboard-holder via coach
  tokens. Era tallies (seasons/shields/lostStreak) ride `maroon.coach.v1` with normalise-on-load, so
  drop-2 saves upgrade in place. Verified live: pressure 90 at season close → "⚫ THE BOARD HAS
  ACTED", the Slater era 2026–2026 archived, Cameron Smith incoming.
- **The Rookie Class** (2026-07-06 — Dynasty M2, drop 6) — `src/dynasty/rookies.ts`: generated
  Queenslanders refill the pool. Seeded from a decorrelated stream (`rookieSeed`), positional
  archetypes (outsideBack/fullback/half/hooker/middle/edge), overall 58–74 with a 5% generational
  talent (75–82), debut age 19–21, ids `dyn-q-{year}-{n}`, surname pool curated against every real
  Maroon surname (test-pinned). Classes are **stored verbatim** in the overlay (`Player.birthYear`
  added for generated men) so generator edits can never rewrite an existing class. Intake is
  need-driven (cover every starting position to 2 natural fits, then top toward 28, ≤6/summer) and
  the **M1 viability floors are gone**: 36 is now absolutely the end (no immortals across 20 seeds ×
  15 seasons) while squad strength holds within ±6 of the 2026 baseline over 15 years (the
  calibration guard). `loadSeries(extraValidIds)` keeps mid-series saves with rookies in the XVII
  alive across reloads; drop-3 dynasty saves normalise the empty class in. Scouting reports on the
  off-season screen; a debutant's scout note survives his first season on the picker.

- **The Grudge** (2026-07-06 — chase layer, drop 7) — `src/series/nemesis.ts`: per-NSW-player
  damage accrues in the pure reducer as optional `SeriesState.nswDamage` (**8×tries + 4×lineBreaks +
  1×tackleBreaks, +8 for an NSW-side iconic moment**; pre-drop-7 saves start counting from their
  next game). At archive time `crownNemesis` names the max-damage man iff damage ≥ 24 (~two
  converted tries — a series-long problem) into the `LedgerEntry.nemesis` v2 slot; the share card
  gets the `☠️ Nemesis:` line (a named villain beats a bland loss in the group chat). The payoff:
  `returningNemesis` matches archived nemeses **by NAME** against the newly drawn Blues sheet (the
  same man wears different ids across the three variants) and the hub + selection scouting report
  open with the threat: "☠️ Payne Haas owned you in ’25 — 4 tries, 3 line breaks. He’s back."
  Verified live with a seeded archive. Post-launch feat noted in the catalog: **Silenced** (beat a
  returning nemesis while holding him under half his prior damage).

- **The World Ages** (2026-07-06 — Dynasty M3, drop 8) — `src/dynasty/nsw.ts`: NSW identity is
  **canonical by name** (`nswKey`): a man in multiple Blues sheets ages/retires ONCE, everywhere.
  Birth years hash each name into its tag band (stable world facts). The off-season runs a
  fixed-draw NSW pass; retirees are replaced by generated Blues of the same positional shape at
  92–98% quality (own decorrelated stream, stored verbatim in `overlay.nswReplacements`, chains
  resolve), so each variant keeps its identity — balance guard: resolved sheets within ±7 of base
  mean after 12 years. Sheets resolve through the overlay everywhere NSW is read (match setup, live
  lineups, scouting, matchup, grudge scan, conditions via `NswResolver` on
  initSeries/applyGameResult/useSeries); scouting danger-man names swap to replacements; the kicker
  hands over the tee. The nemesis tally now carries **names at fold time** (a generated Blue can be
  crowned). Sydney's coaching carousel: two straight losses to QLD and their coach walks (off-season
  "Across the border" section). Year one is byte-identical (replayed in-browser to the exact same
  match). Old dynasty/coach saves normalise in.

- **The Ritual** (2026-07-06 — drop 9, closes the mates loop) — **PWA**: `vite-plugin-pwa`
  (autoUpdate, full precache = offline-capable; 8-bit gold-M icons generated by
  `scripts/makeIcons.mjs`, a zero-dep PNG encoder; `__BUILD_STAMP__` in the hub footer so mates can
  compare drops). **The Gauntlet**: `?g=<seed>` deep links (`daily/gauntlet.ts`) build the EXACT
  match a mate played via `challengeFromSeed` (the Daily is now just `challengeFromSeed(dateHash)`),
  reuse the daily screens (`mode="gauntlet"`), and stay deliberately ephemeral — nothing persisted,
  the share card is the scoreboard and carries the link onward. Every daily result offers the ⚔️
  challenge card. **The week**: last-7-days square strip on the hub daily panel + a Mon–Sun week
  card (`daily/week.ts`, ISO Mondays, future days blanked honestly).
- **The Era** (2026-07-06 — drop 10, closes the approved 11-drop Legend Plan) — `DynastyTimeline`
  on the hub (year chips + coaching-era chapters: "Slater · 2026–2028 · 3 seasons · 2 🛡");
  completed-series share cards carry the long arc via `eraCardLine` ("🏆 Year 6 of the dynasty · 4
  shields · 4 straight"); three final feats close the **21-trophy cabinet**: *Survived the Siege*
  (shield won at pressure ≥60, judged via `pressureNow()` before the result cools the seat), *Faith
  Rewarded* (an under-fire selection — recall/kept-faith/rookie/gamble — takes Player of the
  Series), *Silenced* (a returning nemesis who actually ran out, held under half his old damage;
  the resolved sheet's names keep the predicate honest).

- **The Addiction Pass** (2026-07-07 — five drops, post-Legend-Plan retention work from a fresh
  audit of where freshness runs thin and what blocks the chase loop):
  1. *Twists 7 → 14* — the MCG exhibition, a QLD gift day, origin-eve chaos, two club call-backs
     (Dolphins/Cowboys), the four leaders gone, the back five wiped out. Expanding the catalog
     re-rolls the `% N` twist draw for future dailies and old gauntlet links (accepted — the Daily
     makes no forward promises, the Gauntlet is ephemeral). `full-deck` reads the catalog length.
  2. **Scenarios — "This Day in Origin"** (Vision #4, the last unshipped bet) — `src/scenarios/**`:
     ten hand-authored, PINNED, retryable challenges across four tiers (easy → legendary), each an
     explicit seed + Blues side + ground + constraint (the twist vocabulary) + a WIN CONDITION
     beyond winning ("hold NSW under 12", "a rookie scores", "keep them tryless"). Same match every
     retry — learnable like a puzzle; the only variable is your 19. Conquests persist under
     `maroon.scenarios.v1` (attempts tick, first conquest write-once). `buildScenarioSetup` is
     SHARED by App and the tests, and the **winnability guard** proves a reference side passes every
     pinned seed through the real engine — an unwinnable scenario cannot ship. ScenarioBrowser on
     the hub, verdict-keyed result screen ("WON — BUT NOT LIKE THAT") with "Run it back", share
     card, two feats (Off the Script / The Historian).
  3. *The Chase surface* — `src/feats/nearMiss.ts` scans every judged context for quantifiable
     almost-theres ("Hamiso: 2 tries — one short of Hat-Trick Hero"); a near-miss REVEALS the locked
     feat's name (the cabinet silhouette stays ?????). Best-ever approaches persist as an additive
     `approaches` field on `maroon.feats.v1` (lenient validation, retired on mint). "SO CLOSE" strip
     on every result screen, THE CHASE hub panel ranks the nearest locked trophies, the cabinet is
     shelved by category, and once the season is done + today's daily spent the chase surfaces float
     above the daily panel (`hubSpotlight`) — the hub always names a next deed.
  4. *The Eight* — `src/dynasty/streak.ts`: the shield streak, with the record book's cruelty (only
     OUTRIGHT wins extend it; a drawn retain keeps the shield but snaps the run; Casual can't carry
     a legend — `eraCardLine` and the off-season era line now agree). Hub strip of eight squares
     filling gold toward the 2006–2013 record. Three retro-mintable long-arc feats close the cabinet
     at 26: Three-Peat, The Eight, Decade of Origin.
  5. *Content deepening* — color commentary thin cells to ~20 lines each (JT joins the late drama),
     pressers 9 → 21 openers + doubled follow-ups, back-page thin kinds to 4 takes, farewells 5 → 12,
     movers to 6/6, rookie name pools 30×30 → 50×52 and NSW replacements 12×12 → 24×24 (stored
     classes are verbatim, so shifted draws never rewrite history). Pool floors + no-duplicate
     guards in `contentPools.test.ts`.

- **The Great Rebalance** (2026-07-07) — QLD almost never won and losses were blowouts (5% win rate
  in Sydney, avg −26; 0% on Hard). Root cause: the NSW starting 13 was authored ~7.6 overall points
  stronger than QLD's best 13 (81.7 vs 74.1), Cleary's boot dwarfed every Maroon kicker, NSW carried
  +4 stamina, and no test had ever fielded the REAL squad (calibration runs synthetic fixtures). The
  fix, to the user-chosen "Maroon-tinted" target (~60% at Suncorp / ~50% away at Origin, close losses,
  Hard ~35%, Casual comfortable):
  - **`qldSquad.ts` re-authored to parity+** — all 32 players lifted preserving relative order and
    positional shape (weak links stay exploitable: Walsh D62, HTF D65, Nanai D66, D. Fifita D62);
    stars 84–88 (Munster 87, Grant 86, Ponga 85.6), rookies ~74; Ponga GK 80→88 (the natural
    first-choice boot), Holmes GK→90 (a real recall dilemma), stamina to NSW's level.
  - **`realBalance.test.ts`** — the missing guard: the auto-picked best legal 19+2 from the real
    squad vs all three Blues sheets × all three venues × 50 seeds, plus Hard/Casual cells, with a
    printed per-cell report and TIGHT pins on win rate / margin / closeness / blowout rate. Tuned
    result: Suncorp 61% (+4.7, median |m| 8), Accor 43%, MCG 47%, Hard 30%, Casual 88%.
  - **The win curve is steep** (~7–13pp per uniform effective-attr point once squads are at parity),
    so `TUNING.homeEdge` compressed 2.5/1.5 → 1.0/0.5, Accor `homeAdvantage` 0.8 → 0.5, and the Hard
    dial +6 → +3 (Casual −6 unchanged).
  - **Knock-ons swept**: dynasty `ROOKIE_TUNING` lifted (65–80, generational 81–88) so the 15-year
    strength guard holds; `CONDITIONS_TUNING.roleBaseline` re-derived from a 120-match parity run
    (back 1015/550, forward 848/290, half 842/341) so an average game reads as average again;
    scenario constraints re-tuned + seeds re-pinned at tier rarity for the stronger squad (easy ~55%,
    origin ~33%, hard 9–13%, legendary 0.7–3.3% for the reference side; hold-the-cauldron re-tiered
    hard, kids-crusade re-tiered legendary, Immortal Territory now NSW +8).

## Deferred backlog

Paused 2026-06-16 — no committed dates. Roughly highest-leverage first.

1. **Break up `simulate.ts`** (~1,350 LOC) — extract the bench-rotation/runtime subsystem and the
   HIA/foul-play drama bookkeeping into pure modules. Safe now that the integration test guards the
   contract.
2. **Theme-token + spacing/type-scale sweep → alternate skin** — add `--space-*`/`--text-*` tokens,
   replace the ~40 raw `rgba()` literals, then a `data-theme` terminal/8-bit skin to cash in the
   swappable-surface promise.
3. **Editable-squad / JSON import layer** + a data-consistency test (status/form/injury tables agree).
   `persist.ts` stores IDs only, so an attribute overlay drops in without save migrations. (Would also
   make new Blues sides + difficulty curves authorable without a redeploy.)
4. **Polish** — expand the 3 "pressure" Gus speeches (`speeches.ts`); replace the stock-Vite
   `README.md`; optionally flip analyst color lines to surnames (`renderColorLine`) to match the callers;
   surface the beaten Blues side + difficulty on the career ledger ("beat the Big Blue Wall on Hard").

## Vision — making it elite (keeping the magic alive year-round)

Added 2026-06-18. The game is an elite *single series*; these are the bets that make it one you can't put
down between real Origin campaigns. The gap is two things: **cadence** (a reason to come back tomorrow)
and **the long arc** (a reason a run matters beyond its own shield). These are product bets, not the
hygiene in the backlog above. Recommended sequence: ship the **Daily** first (small, reuses what's
built), then commit to the **Dynasty** as the flagship, with the **chase layer** threaded through both.

1. **The Dynasty (north star).** Don't "start a new series" — start the *next year*. Players age, peak,
   decline, and retire; bolters debut; past results harden into history. You chase your own era — the
   8-in-a-row is Queensland's holy grail. Turns "I won a shield" into "I'm four years in, Munster just
   retired, rebuild the spine around a 21-year-old." The deepest retention well; the biggest build.
   *Fit:* the engine is squad-agnostic and `persist.ts` stores IDs + tallies only, so a per-year
   age/attribute overlay drops in without save migrations — the **editable-squad seam (deferred #3)
   evolved into progression**. New state: a multi-season ledger (years, rosters, retirements, your
   record), generated rookies, and aging curves on the data layer — never frozen into the live save.
2. **The Daily Origin — ✅ SHIPPED 2026-07-06** (see Shipped above). Wordle for Origin: date-seeded
   Blues side + venue + twist, one attempt, shareable score + streak. Natural follow-ons now live in
   the chase layer below: daily-specific feats ("win blood-the-kids at Accor"), a last-7-days square
   strip on the hub, and folding daily results into the career ledger's story.
3. **The chase layer (texture — threads through both).** What makes a run worth *retelling*:
   - *Feats* — 3–0 on Hard, win a decider away at Accor, win with no recognised halfback, hold NSW
     try-less. Derived from results + difficulty + opponent into a persisted badge set; self-imposed
     reasons to replay differently.
   - *The iconic moment* — the booth crowns a match's defining play and the career *remembers* it ("the
     Cobbo try that won the '26 decider"). An engine/broadcast pick + a career field. Cashes in the
     "iconic moment / cauldron / legacy weight" essence gaps noted in the 2026-06-18 design chat.
   - *A nemesis* — a Blues danger man who owns you across a series and that you're gunning to shut down
     next time. Track NSW per-player damage across games.
4. **Scenarios — "This Day in Origin" — ✅ SHIPPED 2026-07-07** (see the Addiction Pass above).
   Hand-authored what-if challenges with constraints + a win condition, pinned seeds, retryable.

## Invariants to protect

- **Engine purity** — `src/engine/**` stays free of React/DOM/`localStorage`. New levers go in `TUNING`
  + effective-attr math or at the `App.tsx` kickoff boundary, never by crossing the boundary.
- **Determinism** — any new stochastic lever must be pure arithmetic or draw a *fixed* rng count, or it
  desyncs replays and breaks `simulate.test.ts`.
- **Calibration drift** — adding strength scalars shifts distributions; re-check `calibration.test.ts`
  and re-derive `conditions.ts` baselines rather than assuming the bands hold.
- **Saves store IDs + immutable tallies only** — never freeze squad attributes into `localStorage`.
- **Data staleness** — 2026 squads/form/injuries are hand-kept across `src/data/*`; add the
  consistency test (item 5) before heavy roster edits.
