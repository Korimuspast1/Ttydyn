# TTYDYN — 2D Impact Physics Sandbox

A particle-based material/impact sandbox in the browser, inspired by armorsandbox.com.
**Nothing is a canned animation.** Plates dent, shatter, spall, melt and detonate because
thousands of particles carry real material properties (density, strength, hardness,
melting/boiling point, brittleness, detonation energy) and are joined by breakable bonds.

## Run
No build step. Serve the folder statically and open it:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or: npx serve .
```

Works on desktop & mobile browsers (ES modules + Canvas 2D, nearest-neighbour pixel scaling).

## Controls
| Input | Action |
|---|---|
| FIRE button / `Space` | Fire selected projectile at selected target |
| Velocity / Angle sliders | Muzzle velocity 50–2500 m/s, angle −25…+25° |
| Speed | ×0.25 slo-mo … ×4 |
| Overlay | Material / Temperature / Damage / Velocity / Bonds (debug) |
| Mouse wheel, Shift/right-drag, WASD/arrows | Camera zoom (stepped) & pan |
| Follow projectile | Camera tracks the shot |
| `P` / `R` | Pause / Reset |
| Hover | Inspect a particle's material, temperature, damage, phase |

## Content (all generated from `js/library.js` generators)
- **84 materials** (`js/materials.js`) — metals, ceramics, polymers/composites, explosives,
  fluids, construction, organics, special armour systems. Each has density, tensile strength,
  hardness, melt/boil, brittleness, thermal conductivity and (for energetics) detonation
  energy + ignition temperature.
- **64 projectiles** — APFSDS long/short rods (W, DU, steel…), AP/APCR/APCBC, HEAT, HESH,
  HE-frag, incendiary, RPG, ATGM, bullets, slug, flechettes, artillery, mine, mortar.
- **64 targets** — single plates (16 materials × thicknesses), ceramic/Kevlar & ceramic/UHMWPE
  arrays, ERA & NERA sandwiches, spaced armour, laminates, sandbags, fuel drum, ammo crate…
- **16 vehicle cutaways** — MBT/IFV/APC-like side sections with glacis, turret, engine, fuel,
  ammunition rack and crew simulant (shoot the ammo rack!).
- **48 experiments** — preset projectile/target/velocity/angle scenarios.

## Architecture (`js/`)
| Module | Responsibility |
|---|---|
| `main.js` | Game loop (fixed 60 Hz tick decoupled from rAF), pixel renderer, camera, GUI |
| `physics.js` | SoA particle store, bond spring-damper model, contact, thermal, detonation, sub-stepping |
| `materials.js` | The 84-material property table + temperature colour mapping |
| `library.js` | Procedural generators for projectiles, targets, vehicles, experiments |
| `editor.js` | Pixel editor: pencil/eraser/fill/line/rect, mirror, outline, swap, undo/redo, JSON import/export |

Data layout is Structure-of-Arrays (`posX[]…` as typed arrays) with a spatial-hash broad
phase — the design scales toward WASM/workers (Roadmap Phase 8) without changing the model.

## Physics model
1. **Bonds** — neighbours are joined by spring-dampers. Strain past a material limit breaks
   the bond (brittle = low strain limit → shatter; ductile = plasticity: rest length creeps,
   plastic work becomes heat). Heat softens bonds → thermal weakening.
2. **Contact** — spatial hash + penalty repulsion + friction for non-bonded particles.
   Hard impacts deposit heat, accumulate damage and launch shock (detonation trigger).
3. **Thermal** — conduction along bonds, ambient cooling, melt (bonds dissolve → flow) and
   vaporisation (gas expands, rises, cools, dissipates). Temperature tints particles to glow.
4. **Detonation** — explosives ignite by heat/cook-off or shock > threshold, with a short
   randomised fuse. Detonation flashes the particle to ~2500 °C gas and delivers a radial
   impulse + heat + shock, so ERA, ammo racks and fuel cook off in chains.
5. **Integration** — semi-implicit Euler, fixed 1/60 s tick, **velocity-adaptive sub-stepping**
   (a 2000 m/s rod moves < 0.4 lattice spacings per sub-step, so it cannot tunnel).
6. **Failure modes that emerge**: penetration & erosion, plugging, petaling, brittle shatter,
   back-face spall/bulge, melting, cook-off and sympathetic detonation.

## Editor
Draw any design cell-by-cell (40×24 default) from the full palette, with mirror, outline and
material-swap tools. Save designs in-browser, export/import portable JSON
`{app:"ttydyn-design", w, h, cells[]}`, then fire them as projectiles or shoot them as targets.

## Extending
- **New material**: add one row to `RAW` in `js/materials.js`.
- **New projectile/target**: add a generator in `js/library.js` (grids are `Int16Array` cells).
- **New experiment**: add a seed to `EXP_SEEDS` or an entry in `EXPERIMENTS`.

## Tests
```bash
node tests/smoke.mjs   # library counts, material sanity, headless penetration check
```
