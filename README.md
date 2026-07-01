# Kcal

A chat-style calorie and macro tracker. Type what you ate the way you'd text a friend — `2 eggs`, `1 cucumber`, `30 gr whey protein, 150gr blueberries` — and the day's kcal/protein/carbs/fat bars update instantly. Hit **Complete the day** and it rolls into your history.

No account, no ads, no backend. Everything lives in your browser's localStorage.

**Stack:** vanilla HTML/CSS/JS, zero build step, zero dependencies. Nutrition comes from a built-in table of ~85 staples (`foods.js`), your own custom foods (saved once, remembered forever), and an [Open Food Facts](https://world.openfoodfacts.org/) search fallback for anything unknown.

## Run locally

```bash
cd kcal
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly via `file://` also works, except the service worker (offline support) won't register — everything else does.

## Test the parser

```bash
node parser.test.js
```

## Deploy to GitHub Pages

1. On github.com (logged in as **i-trenchevski**), create a new **empty** repo named `kcal` — no README, no .gitignore, nothing.
2. From this folder:

```bash
git remote add origin https://github.com/i-trenchevski/kcal.git
git push -u origin main
```

3. On the repo page: **Settings → Pages → Source: Deploy from a branch → Branch: main, / (root) → Save**.
4. After a minute the app is live at **https://i-trenchevski.github.io/kcal/**.

## Add to Home Screen

- **iOS Safari:** open the URL → Share button → **Add to Home Screen**.
- **Android Chrome:** open the URL → ⋮ menu → **Add to Home screen** (or accept the install prompt).

It launches full-screen like a native app and works offline after the first visit.

## Git identity (personal vs work)

This repo's **local** git config is already set to the personal identity:

```bash
git config user.name   # Ines Trenchevski
git config user.email  # inestrenchevski@gmail.com
```

so commits made inside this folder are authored correctly regardless of your global config. Two things to verify before pushing:

1. **Commit author ≠ push credentials.** The push will use whatever SSH key or credential helper your machine has for github.com, which may be tied to the work account. Check with:

   ```bash
   ssh -T git@github.com    # if using SSH
   gh auth status           # if using GitHub CLI
   ```

   If it greets you as the work account, push over HTTPS and sign in as i-trenchevski when prompted, or add a personal SSH key.

2. **Future personal repos.** To make the personal identity automatic for everything under e.g. `~/personal/`, add to `~/.gitconfig`:

   ```ini
   [includeIf "gitdir:~/personal/"]
       path = ~/.gitconfig-personal
   ```

   with `~/.gitconfig-personal` containing the personal `[user]` block.

## Editing the food table

`foods.js` is a plain array. Each entry:

```js
{ name: 'lentils', per100: { kcal: 116, p: 9, c: 20, f: 0.4 },
  aliases: ['lentil', 'lekja'], piece: null }
```

- `per100` — values per 100 g (cooked, where it matters).
- `piece` — grams for one countable unit (`1 apple` → 180 g). Leave `null` if it only makes sense by weight.
- `aliases` — extra names, including Dutch/Macedonian ones.

Foods you add through the in-app resolver ("Add it myself" / Open Food Facts pick) are stored in localStorage, not in this file.

## Releasing a new version

Bump `SW_VERSION` in `sw.js` (e.g. `kcal-v2`) so installed home-screen apps drop the old cache and pick up your changes on next launch.

## Data & attribution

- All personal data stays in localStorage under the key `kcal-v1`. **Settings → Export JSON** to back up, Import to restore. Clearing site data wipes it.
- Fallback nutrition search uses the Open Food Facts database, © Open Food Facts contributors, available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).

## Known limitations (by design, for now)

- Natural-language logging has a real accuracy ceiling (~±15–25%). Every bubble shows the grams it assumed so you can correct course.
- `kcal` targets and the 4/4/9 macro math aren't force-reconciled; if you hand-enter targets they're taken as-is.
- Changing targets doesn't rewrite history — past days keep the numbers they were logged under.
- "rice", "pasta" etc. mean **cooked** weight. Log `dry rice` explicitly if you weigh dry.
- Unknown counted items ("2 things") assume 100 g each and say so in the bubble.
- One device = one dataset. Sync would need a backend; deliberately out of scope.
