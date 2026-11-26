# Luna’s Puzzle Lab

Browser puzzles and interactive mathematics. [Open the puzzle desk](https://lunaluteus.github.io/puzzle-lab/).

## Play a puzzle

- **Ring Lamps** lets you edit a board, find the shortest solution, or see a parity explanation when a board is unsolvable. [21-lamp challenge](https://lunaluteus.github.io/puzzle-lab/ring-lamps.html?challenge=21) · [Solvability notes](https://lunaluteus.github.io/puzzle-lab/ring-lamps-notes.html#solvability)
- **Fraction 24** has 16 four-card puzzles that require a fractional intermediate result. [Try 3, 3, 8, 8](https://lunaluteus.github.io/puzzle-lab/fraction-24.html?puzzle=13)
- **Triple Rotate** sorts a permutation by cycling three adjacent tiles at a time. [Try the 14-move challenge](https://lunaluteus.github.io/puzzle-lab/triple-rotate.html?board=87654321)
- **The Tits Cone** explores reflection chambers, Coxeter diagrams, and exact Gram matrices. [Open the (2, 3, 7) triangle in the Poincaré disk](https://lunaluteus.github.io/puzzle-lab/tits-cone.html?model=hurwitz&projection=poincare)

## Run locally

Use Node.js 24 to match the deployment workflow. Run these commands from the repository root, then open the URL printed by Vite.

```sh
npm ci
npm run dev
```

Run the tests, build the static site, and serve the build locally.

```sh
npm test
npm run build
npm run preview
```

The tests check puzzle solvability, shortest hints, and Coxeter geometry and formula rendering. The build writes the site to `dist/`, which the workflow publishes to GitHub Pages. [Pages workflow](.github/workflows/pages.yml)
