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
- **Your own cover:** in a notebook's cover options, upload any picture; it is cropped to the cover's shape and used on the desk, shelf and spine (remove it to go back to the generated cover).
- **Generated covers.** Every notebook gets a random cover (cosmic, leather, linen, marble or geometric) painted on a canvas from seeded noise: no AI. Use the dice button to reroll one, or fix a style in settings.
- **Scene layout (default):** a brick-wall shelf of illustrated storybook covers across the top (progress bars, ribbons, a brass globe, a little astronaut, plants), and below it your open book lying on the desk in perspective with a leather hardcover, ribbon and coloured index tabs. A **Notebook Info** card (dates, progress, quick appearance controls), pen and highlighter cups, a sticky-note legend and warm sunset lighting (daylight in light mode) complete the scene. Pick a cover and it slides off the shelf onto the desk and opens. The notebook list and outline are slide-out drawers (via the "..." menu); fold the shelf away for more room; press `/` to search every note. Prefer sidebars? Choose **Classic** in settings.
- **A realistic desk:** photographic desks (lighter wood in light mode, darker in dark mode) and shelf planks, glossy ceramic cups, detailed shaded pens, highlighters and markers, a pencil and paper clips. Following a web link swaps the desk for the version with a laptop, with the page shown on its screen. Prefer a generated wood desk (walnut, oak, cherry, teak, birch or ebony)? Choose one in settings.
- **Hide the shelf** from the "..." menu or settings for a bigger desk.
- **One tool rack**, on whichever side you choose (settings or the "..." menu): writing tools and highlighters lie together, and the legend note moves to the other side.
- **Light pages in dark mode**, if you like dark chrome but want paper to stay paper.
- **Custom margins:** top, bottom, spine side and outer, each as a percentage of the default; the text re-flows.
- **Closing the laptop:** a "Close laptop, back to notebook" button appears while it is up (click the tucked-away notebook, press Esc, or use the browser's x as well).
- **Little extras:** Home/End jump to the first/last note, an optional mouse-wheel page turn, "~N min to read" on the info card, and "Resume where you left off" to reopen your last page.
- **Frameless mode:** press F (or use the "..." menu) to hide every panel, toolbar, shelf and prop so only the notebook on the desk is left, bigger. Esc or F brings the controls back; move the mouse to the top edge for a "Show controls" button.
- **Quick keys:** F frameless, T handwritten/text, B bookmark this page, Home/End first/last note, / search.
- **Warm page tint** for night reading (settings).
- **Tilt the notebook** to your liking with the slider in the "..." menu or settings (0 = flat towards you).
- **Short notes share a spread:** two one-page notes in a row sit side by side instead of each leaving a blank page (switch off in settings). Ink and highlights on the second note's page are made when you open that note on its own.
- **Maths:** equations render through Obsidian in text view, and handwritten view understands fractions, roots, matrices, cases, `align`, `\text{...}`, binomials, big operators and many more symbols.
- **Edit a note's text** from the pencil button in the navigation bar, in either view. Front matter is left alone; Save (or Ctrl/Cmd+Enter) writes it back to the note.
- **Shelf mode:** see every notebook as a spine on a wall shelf (wall and shelf colours follow light/dark). Click one and it slides out, swings round to show its cover, and lies down on the desk. Spine designs, covers and progress show on the spines.
- **Index page** at the front of every notebook: clickable note titles, page numbers, sections, last-edited (and created) dates, read status and bookmark stars. Choose what it shows in settings.
- **Reading progress:** tracks which notes you've opened, a recently read list, bookmarks and a ribbon, and a progress ring/bar/count on each notebook (list, cover, shelf). All optional and configurable; stored in plugin data, never in your notes.
- **Write in the book** (handwritten or text view; ink is kept separately for each view): pen, pencil and marker for freehand ink, a text tool for typed handwriting, and an eraser. Stored in plugin data, not in your notes.
- **Highlights:** double-click one to recolour it, add a margin note, or remove it.
- **Margin notes and realistic pages:** `> [!margin] text` callouts and highlight notes appear in the outer margin; page layouts have a wider gutter, running heads and outer page numbers; handwriting has slightly uneven line spacing (words stay on the line on ruled paper).
- **More ways to customise the physical book:** illustrated storybook covers plus 17 other cover materials, cover colour, spine designs, elastic straps (vertical, horizontal, cross), ribbon colour, paper colours, page textures, per-notebook overrides. None of it touches your notes.
- **20 handwriting fonts** including several cursive scripts.
- **Outline panel** on the right: reorder notes by dragging, add **separator pages** between notes, add smaller **sub-separators** under them (the corner-arrow button; they show indented in the contents and outline, without their own edge tab), jump to headings and highlights.
- **Handwriting extras:** cursive fonts, small-caps handwritten headings (configurable), maths and code written out by hand, and on ruled/grid/dotted paper words sit on the line.
- **Highlighters** on the desk (any number, any colour) with a draggable sticky-note **legend**. Highlights are saved per note.
- **Links work inside the book:** a link to a note flips to it (or moves to that note's notebook); a web link opens on a laptop on the desk while the notebook slides aside. Ctrl/Cmd-click opens the real note or your browser instead.
- **Choose how pages turn:** click a page, pull a page corner (drag it like a real page), or use only the navigation bar.
- **Sound effects** (synthesised, adjustable or off): page flips, cover open/close, pen clicks, marker squeaks.
- **Rename notebooks** without touching your folders or properties, and pick a cover style, colour and label per notebook (leather, plain cloth, kraft, gradient, watercolour, terrazzo, waves, ...).
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
- The laptop uses Obsidian's embedded browser (an isolated session) on desktop and an iframe elsewhere. Sites that refuse to be embedded show a note with an "Open in your browser" button.
- On narrow panes the sidebar becomes an overlay, but the two-page spread simply scales down. It is best on desktop-size panes.
- Fonts (Caveat, Kalam, Patrick Hand, Reenie Beanie, Indie Flower, Shadows Into Light, Playfair Display) are bundled under the SIL Open Font License (see `assets/fonts/LICENSE-OFL.txt`).
