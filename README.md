# SmoothLife 3D (Web)

A browser-based **3D adaptation** of [duckythescientist/SmoothLife](https://github.com/duckythescientist/SmoothLife), built so it can be deployed as a static site (for example on Netlify), similar to https://smooth-life.netlify.app/.

This version keeps the SmoothLife idea of continuous state values and smooth transitions, but extends the neighborhood sampling into **3D volumes**:

- `m`: local aliveness sampled from an inner sphere.
- `n`: neighbor aliveness sampled from an outer spherical shell.
- Smooth birth/survival interpolation using logistic transitions.

## Live-style deployment

Because the app is plain static assets (`index.html`, `styles.css`, `src/main.js`), you can deploy with:

- **Netlify Drop**: drag the repository folder into Netlify Drop.
- **Netlify Git deploy**: connect your fork, set build command to empty, publish directory to `.`.
- **Any static host**: GitHub Pages, Vercel static, Cloudflare Pages, etc.


### One-click GitHub Pages

This repo includes a workflow at `.github/workflows/pages.yml` that deploys automatically to GitHub Pages on every push to `main`.

To enable it:

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main` (or run the workflow manually from **Actions**).

## Local run

From repository root:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Controls

- **Mouse drag**: orbit camera
- **Scroll**: zoom
- **Space**: pause/resume
- **Randomize** button: reseed state

## Project files

- `index.html`: UI shell and canvas.
- `styles.css`: HUD + page styling.
- `src/main.js`: self-contained 3D simulation + canvas renderer (no external runtime dependencies).
- `smoothlife.py`: original 2D Python implementation from upstream kept for reference.

## Legacy notes from upstream

The original project and paper references are still applicable:

- Paper: https://arxiv.org/abs/1111.1567
- Explanation: https://0fps.net/2012/11/19/conways-game-of-life-for-curved-surfaces-part-1/

License remains the original project license (`LICENSE.txt`).
