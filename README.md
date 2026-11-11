# Flip View

View your Obsidian vault as a shelf of notebooks sitting on a desk. Click a cover and it flips open
in 3D; turn pages to read your notes either as **handwriting** or as **formatted text** in your own fonts.

## Features

- **Notebooks from folders or properties.** Choose in settings:
  - *Folder*: every top-level folder (or every folder with notes) becomes a notebook.
  - *Property*: notes sharing a frontmatter value (default property `notebook`) are grouped. List values put a note in several notebooks, and `tags` works too.
- **3D cover flip and page turns**, with a desk background for light and dark mode.
- **Handwritten / Text toggle.** Text view renders through Obsidian itself, so your note font, theme and plugins' post-processing apply.
  Handwriting view re-sets the same note in a handwriting font with per-word jitter. Messiness, font, size, ink colour and paper (plain, lined, grid, dotted) are configurable. It is seeded per note, so a note always looks the same.
- **Generated covers.** Every notebook gets a random cover (cosmic, leather, linen, marble or geometric) painted on a canvas from seeded noise: no AI. Use the dice button to reroll one, or fix a style in settings.
- Contents list, keyboard navigation (←/→, Esc), full-screen mode, "last edited" badge, live updates when notes change.

Commands: *Open notebook view*, *Show current note in its notebook*, *Toggle handwritten / text preview*.

## Install with BRAT

1. Install and enable **BRAT** (Obsidian42 - BRAT) from Community plugins.
2. Run *BRAT: Add a beta plugin for testing* and enter `mkdogs25/flip-view`.
3. Enable **Flip View** under Community plugins. BRAT will keep it updated.

BRAT installs from GitHub releases, so a release must exist (see below).

### Publishing a release (maintainers)

Releases are automatic. Every push to `main` runs the `Release` workflow, which builds the plugin and, if the
version in `manifest.json` has no release yet, publishes one with `main.js`, `manifest.json` and `styles.css` attached.

To ship new changes:

```bash
npm run bump          # patch; or: npm run bump minor | major | 1.2.3
git commit -am "Release x.y.z" && git push
```

Pushes that don't change the version still build and test the plugin but don't create a release. Versions with a
hyphen (e.g. `0.2.0-beta.1`) are published as pre-releases.

## Install (manual)

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/flip-view/`, then enable **Flip View**.

## Development

`npm run dev` rebuilds on change. Obsidian can't run in CI, so there is a browser harness with a mock vault:

```bash
npm run harness        # bundles dev/harness.ts into dev/dist
node dev/shots.cjs     # needs Playwright; writes screenshots to dev/shots
```

## Notes and limits

- Pages are laid out with CSS columns, so long notes paginate automatically. Embeds that load lazily (some plugins' code blocks) may need a moment; edit/save a note to re-render it.
- On narrow panes the sidebar becomes an overlay, but the two-page spread simply scales down. It is best on desktop-size panes.
- Fonts (Caveat, Kalam, Patrick Hand, Reenie Beanie, Indie Flower, Shadows Into Light, Playfair Display) are bundled under the SIL Open Font License (see `assets/fonts/LICENSE-OFL.txt`).
