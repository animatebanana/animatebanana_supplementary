# AnimateBanana — Supplementary Website

This folder is a self-contained, offline copy of the AnimateBanana companion
website. It is anonymized for double-blind review. Everything the pages show
(animations, videos, intermediate pipeline outputs, benchmark samples,
evaluation results, and user-study material) is included locally. The only
exception is the download buttons on the Downloadable Baseline Outputs page:
the output archives are not bundled in this folder, so they are fetched from
the anonymous companion website when clicked, which **requires an internet
connection**.

---

## 1. Quick start (about 1 minute)

The site is static HTML, CSS, and JavaScript, but it loads its data with
`fetch()` and ES modules. Browsers block these on `file://` URLs, so
**double-clicking `index.html` will not work**. Serve the folder over a local
HTTP server instead.

**Requirements:** Python 3.7 or newer (standard library only, no `pip install`),
plus any recent desktop browser (Chrome, Edge, Firefox, or Safari).

1. Unzip the archive and open a terminal **in this folder** (the one that
   contains `index.html`).
2. Start the bundled local server:

   | OS | Command |
   |---|---|
   | Windows | `python tools/serve.py` &nbsp;(or `py tools/serve.py`) |
   | macOS / Linux | `python3 tools/serve.py` |

3. Open **<http://127.0.0.1:8330>** in your browser.
4. Press `Ctrl+C` in the terminal to stop the server.

To use a different port, pass it as an argument, for example
`python tools/serve.py 8080`.

### Alternatives

Any static file server works if you run it from this folder:

```bash
python -m http.server 8330
```

```bash
npx serve -l 8330
```

We recommend `tools/serve.py`. It answers HTTP Range requests, which browsers
need to seek inside videos. With `python -m http.server`, dragging a video's
scrub bar past what has already loaded may do nothing.

### Troubleshooting

| Symptom | Fix |
|---|---|
| Blank sections or "failed to load" messages | You opened the page via `file://`. Use the server above. |
| `Address already in use` | Pick another port: `python tools/serve.py 8080`. |
| `python` not found (Windows) | Use `py tools/serve.py`, or install Python from python.org. |
| Stale content after an update | Hard-refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`). |

### Privacy note

The site makes **no external network requests** apart from the optional
archive downloads described above. All code, data, media, and fonts are
bundled, so it works fully offline. There are no analytics, tracking
scripts, cookies, or beacons. The only browser storage used is `localStorage`,
which remembers your video playback speed and mute preference in the gallery.

---

## 2. What to look at

Every page is reachable from the **Menu** button (top right).

| Page | File | What it shows |
|---|---|---|
| Overview | `index.html` | Landing page: live animation showcase, pipeline preview, an editability example, gallery rail, and AnimateBench summary. |
| Pipeline Walkthrough | `pipeline.html` | Animated, narrated walkthrough of the three-stage pipeline (Diagram Transmuter → Animation Planner → Diagram Animator), including agents, critics, and intermediate artifacts. |
| Editability and Controllability | `editability.html` | Before/after edits to the intermediate representations (diagram code and animation sequence) and their effect on the final animation. |
| Example Gallery | `gallery.html` | Curated animations in all five styles (Progressive Reveal, Alpha Masking, Colour Pop, Hopping and Sliding Bounding Box), with downloadable PPTX, standalone HTML, and animated PDF exports. |
| Generalization to Unseen Domains | `generalization.html` | AnimateBanana on diagrams from outside AnimateBench (chemistry, physics, school science, infographics): a domain-filtered gallery of the animations and per-diagram scores on every metric. |
| AnimateBench | `animatebench.html` | The benchmark: figure sources, diversity, complexity strata, annotations, pan-and-zoom examples, and a human-presented reference talk. |
| Evaluation | `evaluation.html` | The evaluation scheme replayed step by step on individual samples, for AnimateBanana and each baseline. |
| Downloadable Baseline Outputs | `baseline-outputs.html` | Complete outputs of the closed-source baselines and of the open-source backbones on AnimateBanana for representative examples, one archive per example and model. |
| Metrics and Evaluation Strategy | `metrics.html` | The validity gates, the sequence-level assessment of the visual narratives, and the rationale for a reference-free evaluation design. |
| Prompts | `prompts.html` | The generation prompts given to the closed-source baselines and the evaluation prompts for the judge. |
| Ablations | `ablations.html` | Component ablations (critics, context, XML, image input) and results stratified by diagram complexity. |
| Failure cases | `failures.html` | Representative failures at each pipeline stage, with analysis. |
| User study | `user-study.html` | Study design, participant pool, interface screenshots, and results. |
| Latency and Costs | `costs.html` | Per-stage latency and API cost of AnimateBanana compared with baselines. |

---

## 3. Directory tour

```
.
├── README.md                ← this file
├── index.html               ← entry point (Overview)
├── pipeline.html            ┐
├── editability.html         │
├── gallery.html             │
├── generalization.html      │
├── animatebench.html        │  one HTML file per page listed above
├── evaluation.html          │
├── baseline-outputs.html    │
├── metrics.html             │
├── prompts.html             │
├── ablations.html           │
├── failures.html            │
├── user-study.html          │
├── costs.html               ┘
├── pipeline_animated.html   ← standalone animated SVG of the pipeline figure
│
├── assets/                  ← site code and shared media
│   ├── css/                 ·  stylesheets (tokens.css = design tokens, base.css = shared styles)
│   ├── js/                  ·  ES-module web components, grouped by page / module
│   ├── fonts/               ·  bundled typefaces (fonts.css + WOFF2 files, SIL OFL 1.1 licences)
│   ├── img/, icons/         ·  logo, pipeline overview figure, favicon
│   ├── bench/               ·  AnimateBench media (strata samples, annotations, reference talk)
│   ├── gallery/             ·  gallery media, previews, PPTX / HTML / PDF exports
│   ├── ood/                 ·  frames and source figures for the Generalization page, by domain
│   ├── editability/         ·  before/after animations for the editability page
│   ├── ablations/           ·  pipeline diagram used by the ablation walkthroughs
│   ├── evaluation/          ·  evaluation-scheme figure
│   └── shared/              ·  source figures, frames, and clips reused across pages
│
├── data/                    ← JSON content that drives every page (text, results, media manifests)
│   ├── benchmark/           ·  AnimateBench page data
│   ├── gallery/             ·  gallery and rail manifests
│   ├── ood/                 ·  Generalization page gallery manifest and per-diagram scores
│   └── stratified/          ·  stratified-results data (Ablations page)
│
├── MAIN_PAGE/               ← raw pipeline outputs for the Overview showcase, by animation style
├── ABLATIONS_PAGE/          ← raw outputs per ablation (full pipeline vs. ablated variant)
├── EVALUATIONS_PAGE/        ← frames and judge results per system (AnimateBanana and baselines)
├── FAILURES_PAGE/           ← raw outputs for the failure-case walkthroughs, by stage
├── USER_STUDY_PAGE/         ← user-study interface screenshots
│
├── pipeline/                ← the Pipeline Walkthrough (walkthrough.html, video, captions, crops)
├── rasters/                 ← raster crops for pipeline_animated.html and the ablation / failure walkthroughs
│
└── tools/
    └── serve.py             ·  local server with video seeking support (see Quick start)
```

### How the pieces fit together

- Each **HTML page** is a thin shell. It loads styles from `assets/css/`,
  components from `assets/js/`, and its content from `data/*.json`.
- The **`*_PAGE/` folders** contain the actual pipeline artifacts behind each
  page: animated SVG/HTML, MP4 renders, caption JSON, raster crops, critic
  feedback, and judge outputs. They are kept as generated so you can inspect
  them directly.
- Sample IDs such as `CVPR_2025_arch01488` or `Paper2Fig_pipe_diff_000000492`
  name the source dataset or venue and the figure index. The same ID refers to
  the same source figure across all folders.

---

## 4. Notes

- **Size:** about 124 MB (2,082 files), mostly MP4 and PNG media.
- **Last updated:** the footer of each page shows when that page or the data it
  loads last changed, in AOE (UTC−12).
- **Anonymity:** the site carries no author, affiliation, contact or repository
  identity.
- **Source figures:** the input diagrams come from publicly available papers
  and datasets (CVPR, ICCV, WACV, arXiv, Paper2Fig, SciMMIR, FigureBench, and
  others). They are reproduced only to show the method's inputs and outputs.
- **Standalone exports:** each file in `assets/gallery/exports/*.html` is a
  single self-contained file that can be opened directly, even without the
  server. The matching `.pptx` files open in PowerPoint, Keynote, or
  LibreOffice Impress.
- **PDF exports:** `assets/gallery/exports/*.pdf` carry the animation inside the
  document rather than as a video track, so they play only in **Adobe Acrobat
  Reader** and **Foxit PDF Reader** — every other viewer, a browser's built-in
  one included, shows the first frame and an inert control bar. The gallery says
  so before it hands the file over, and points at
  <https://get.adobe.com/reader/> and <https://www.foxit.com/pdf-reader/>.
  Playback is driven by the control bar drawn on the page itself: play/pause,
  a minus and plus pair for speed, and single-frame steps.
