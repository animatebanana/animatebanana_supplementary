# Gallery module

Self-contained module for the overview page's **“Explore More Examples”**
band. It is deliberately kept in its own folders so it can be worked on
without touching — or conflicting with — any other component:

```
assets/css/gallery/gallery-rail.css     all `.gr-*` + `.gallery-band` styles
assets/js/gallery/gallery-rail.js       <gallery-rail> custom element
assets/js/gallery/preview-media.js      the on-demand media budget
data/gallery/rail_previews.json         the five previews the rail shows
```

The only shared files it reads are `assets/js/lib/data-loader.js` and
`assets/js/lib/lazy-load.js` (read-only reuse, exactly as the README's
“Adding a component” section prescribes), and the generic `.tag-*`,
`.kicker`, `.section-head`, `.hand`, `.hl` and `.reveal` classes from
`base.css`. Everything else — colours, type, spacing, motion — comes
from `tokens.css`.

### Its footprint in `index.html`

Three lines, each fenced by a `GALLERY MODULE` comment:

1. `<link rel="stylesheet" href="assets/css/gallery/gallery-rail.css">`
2. the `<section class="gallery-band">` block, between the §01 demo band
   and the `.page` wrapper
3. `<script type="module" src="assets/js/gallery/gallery-rail.js">`

Nothing else on the page was changed, and no section number was
reassigned (the band uses a wordmark kicker rather than a `§ 0n` one),
so the diff cannot collide with work on the hero, demo studio, stats,
how-it-works or contents sections.

## The five previews, and what is real

One slide per animation style, each carrying **only its style** — no
title, field or complexity. Media paths follow the site's existing
one-folder-per-example convention, the same one
`examples/<id>/diagram.svg` uses:

```
examples/<id>/
  preview.png            gallery card preview (final frame, 640px wide)
  preview-poster.webp    rail poster (final frame, ≤1280px wide)
  preview.webm           rail preview, VP9, no audio
  preview.mp4            rail preview, H.264 + faststart, no audio
```

Everything is generated from `Preprocessed_AnimateBanana/<Style>/<id>/`
and copied in; the site never reads outside its own folder.

| style | id | media |
|---|---|---|
| Progressive Reveal | `ICCV_2023_set5_000010` | video (0:17) + poster |
| Alpha Masking | `SciMMIR_pipe_easy_000000307` | poster only |
| Colour Pop | `Paper2Fig_arch_diff_000000037` | poster only |
| Hopping Box | `Paper2Fig_pipe_diff_000000488` | poster only |
| Sliding Box | `WACV_2022_set5_000021` | poster only |

**Only `Progressive_Reveal` has rendered mp4s in the source tree** (3 of
its 72 examples). The other four styles have frame sequences but no
video, so their slides show the real final frame as a still and their
caption omits the run time. Drop `preview.webm` / `preview.mp4` next to
the poster and list them in that item's `sources` array — nothing else
changes.

### Encoding the rail previews

```bash
VF="setpts=PTS/4,fps=25,scale='min(1280,iw)':-2:flags=lanczos"
ffmpeg -i final_video.mp4 -an -vf "$VF" \
  -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart preview.mp4
ffmpeg -i final_video.mp4 -an -vf "$VF" \
  -c:v libvpx-vp9 -b:v 0 -crf 36 -row-mt 1 -deadline good -cpu-used 3 preview.webm
```

- **`setpts=PTS/4` — 4x the rendered pace.** A full narrative runs over
  a minute, far longer than anyone watches a carousel slide; at 4x it
  becomes a ~17s loop that reads as an animation at a glance. The
  speed-up is baked into the file rather than applied with
  `playbackRate`, so the download shrinks with it and the `duration`
  in the feed stays honest. `fps=25` renormalises the frame rate
  afterwards, otherwise the compressed timestamps leave a 100fps file.
- **`-an`** drops the narration track outright — belt and braces on top
  of the player's `muted`.
- **`-movflags +faststart`** puts the MP4 index at the head of the file
  so the first frame is decodable before the whole thing arrives.

The Progressive Reveal preview comes to **96KB (MP4) / 164KB (WebM)**
for 16.8s — down from 300KB/521KB at 1x.

`"mediaReady": false` in either feed turns every request off again and
falls the frames back to the hatched paper skeleton — useful while new
previews are being produced.

## The loading budget

The whole point of this module is that five videos on the landing page
cost almost nothing until someone actually looks at them.

- **Nothing loads before the band is on screen.** `onVisible()` arms the
  media controller with a 200px root margin; before that, no poster and
  no video byte is requested. The `<img>` carries no `loading="lazy"` on
  purpose — our own observer is the gate, and a second one would only
  delay the image we deliberately asked for.
- **Only the active slide ± 1 holds a video.** Slides outside that
  window have their `<source>` elements removed and the element
  `load()`ed again, which is what actually lets the engine release the
  buffered bytes and the decoder. Scrolling the rail end to end
  therefore never holds more than three.
- **Only the active slide plays.** Neighbours sit at
  `preload="metadata"`, paused at `t=0`, so an arrow press is instant
  without them ever decoding frames.
- **Posters reach one slide further** than videos, so an arrow press
  lands on an image rather than an empty frame.
- **Playback follows visibility.** Scrolling the band away, or hiding
  the tab, pauses everything; `prefers-reduced-motion` suppresses
  autoplay entirely and leaves the poster and play badge in place.
- **JSON is fetched through `loadJSON()`**, so it shares the site's
  request cache with anything else that wants the same file.
- **A 404 or decode error is remembered per item** and never retried;
  that slide simply keeps its paper skeleton.
- **Scroll work is rAF-coalesced**: one layout read per frame writes
  each slide's `--p` (0→1 closeness to centre) and the stylesheet
  interpolates scale/opacity/shadow from it, so a fling costs one pass
  rather than one per slide per event.

## Why it is a real scroll container

The track is `overflow-x: auto` with `scroll-snap-type: x mandatory`;
the arrows only call `scrollTo()`. That keeps trackpad, touch,
shift-wheel and keyboard scrolling working without re-implementing any
of it, and it degrades to a plain scroller if JS never runs.

Clicking an off-centre slide centres it. Clicking the **centred** one
plays or pauses its preview in place — a frame is a `<button>`, not a
link, so a click on a video never navigates away. The band's CTA is the
only route into the gallery.

A user play beats the `prefers-reduced-motion` autoplay gate (they asked
for it) and a user pause holds its position and survives until they move
to another slide. A style with no rendered video yet gets no play badge
and no pointer cursor rather than a dead affordance.

Two flags drive the frame, and they are deliberately separate:
`[data-media]` is what is on screen (`skeleton` → `loading` → `poster` →
`video`) and stays `video` while paused, so pausing freezes on the
current frame instead of snapping back to the poster; `[data-playing]`
is the element's real play state and is what the badge's play/pause
icons key off, so the badge can never disagree with the frame.

### Letterboxing

Source figures range from portrait to 850x260 strips, so previews are
`object-fit: contain` rather than cropped — cropping a process diagram
loses the thing it is showing. As soon as real media is in, the frame
(and the gallery card's thumb) drops its dot-paper background for plain
white and fades the hatched skeleton out, so the bars either side of a
short or narrow figure read as more of its own page rather than as
exposed scaffolding.

---

# The full gallery page (`gallery.html`)

The page the rail's CTA and the nav's **Examples** tab open. Same
module, same rules — its files are:

```
gallery.html                             the page itself
assets/css/gallery/gallery-page.css      `.gp-*` shell + `.gb-*` browser styles
assets/js/gallery/gallery-browser.js     <gallery-browser>
assets/js/gallery/pages/gallery.js       page glue (card click → deep link)
data/gallery/gallery_items.json          16 examples across 7 fields and all 5 styles
```

It reuses `<site-nav>` and `<doodle-field>` as drop-ins (no edits to
either) and inherits `.page`, `.kicker`, `.hl`, `.tag-*` and
`.site-footer` from `base.css`, so it reads as the same sketchbook lab
as the overview: dotted paper, ink outlines, hard offset shadows, banana
as the single loud accent.

### Filtering

**Style is the only axis.** The five styles plus **All** sit in one chip
row and that is the entire control surface — no field, diagram type or
complexity selects, no result count. The chosen style is mirrored into
the query string (`gallery.html?style=Colour+Pop`), so a filtered view
is shareable and the overview rail links straight into one.

### Cards

A card is a static PNG preview and its style tag. Nothing else — no
title, no field, no duration. Previews are letterboxed
(`object-fit: contain`) onto the dot paper rather than cropped, because
the source figures run from portrait to 850×260 strips and cropping a
process diagram loses the thing it is showing.

The grid runs edge to edge (a ~24px gutter, not the site's `--gap-page`)
and is **five across** on a normal desktop, stepping to 4 / 3 / 2 and
finally one up on a phone, where two columns would put a diagram's
labels below legibility.

144 cards, all real: one per example folder in the source tree, ordered
by style. Previews load one at a time as each card comes within 400px of
the viewport, so the grid costs nothing above the fold.

### Route changes this page required

Three edits outside the module:

- `assets/js/nav-config.js` — the tab is now `{ id: 'gallery', label:
  'Gallery', href: 'gallery.html' }`.
- `index.html` — the hero's "Browse the gallery" button and the §03
  contents card point at `gallery.html`.
- `examples.html` and `assets/js/pages/examples.js` are **deleted** —
  superseded by this page. `<gallery-grid>` and `<example-viewer>`
  themselves are untouched and still used by animatebench.html and
  controls.html; the root `README.md` table was updated to drop the
  retired page.

### Still to come

Clicking a card currently deep-links to `gallery.html#<id>` and marks
the card selected. The full animated viewer hangs off the same
`galleryselect` event — see the `TODO` in
`assets/js/gallery/pages/gallery.js`.
