"""Turn each animated SVG export into one self-contained HTML file.

`assets/EXPORTS/<Style>/<id>.html` is the animation as the pipeline renders
it: an SVG document whose rasters sit beside it in `rasters/<id>/`, and whose
narration is drawn into the picture as a band of text along the bottom. Handed
to someone to put on their own page that is three problems - a folder of loose
files, a caption baked into the artwork at 11px, and no way to turn it off.

So this writes `assets/gallery/exports/<id>.html`, which is one file:

  * every raster embedded as a data URI, so nothing is fetched and nothing can
    go missing;
  * the narration band taken out of the drawing and rebuilt underneath it, at
    a readable size, in the site's own yellow;
  * a button that switches the captions off, for anyone who wants the
    animation bare;
  * no external font, script or stylesheet - it renders the same offline, in
    an <iframe>, or opened straight off a disk.

THE CAPTION TIMING IS THE ANIMATION'S OWN - and the renderers write it two
different ways, so this reads both.

  * A LOOPING export binds every line to one shared animation and says, in
    percentages of it, when each is on screen. Those windows are the caption
    track, exactly as authored, and the animation is left alone.

  * A ONE-SHOT export reveals the diagram in steps driven by `animation-delay`
    and holds the finished figure. Those steps are half a second apart - the
    renderer's own pacing, not the narration's - so the whole thing plays out
    in a few seconds and its captions flash past unreadably. Where the step
    count matches the example's beats, every delay in the file is rewritten to
    the second that line is actually spoken, so the reveal keeps pace with the
    narration; where it does not, the steps are scaled to the clip's length
    instead. The captions then come from the feed, which is where the real
    times live.

Either way the page reads the position from the browser's own animation clock
rather than a timer of its own, which is what keeps the words with the picture
over a long run and after a tab has been in the background.

    python tools/build_svg_exports.py            # every example that has one
    python tools/build_svg_exports.py --dry-run
"""
import base64
import io
import json
import mimetypes
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEED = os.path.join(ROOT, 'data/gallery/gallery_items.json')
SRC = 'assets/EXPORTS'
OUT = 'assets/gallery/exports'

STYLE_DIR = {
    'alpha': 'Alpha_Masking',
    'colorpop': 'Colour_Pop',
    'hopping': 'Hopping_BBox',
    'progressive': 'Progressive_Reveal',
    'sliding': 'Sliding_Bbox',
}


ID = r'narr_ts?\d+'          # the renderers spell it narr_ts1 and narr_t1


def keyframes(css):
    """{name: body} for every @keyframes block, read by matching braces.

    A regex cannot do this. The body is itself full of `{ opacity: 1; }`
    rules, so a non-greedy match ends at the first inner brace and the block
    after it is read as part of the wrong one - which silently dropped the
    first and last caption of every looping export.
    """
    out = {}
    for m in re.finditer(r'@keyframes\s+([\w-]+)\s*\{', css):
        i, depth = m.end(), 1
        while i < len(css) and depth:
            if css[i] == '{':
                depth += 1
            elif css[i] == '}':
                depth -= 1
            i += 1
        out[m.group(1)] = css[m.end():i - 1]
    return out


def on_window(body):
    """(from %, to %) - the stretch of the loop this line is at full opacity."""
    on = []
    for sel, decl in re.findall(r'([\d.%,\s]+)\{([^}]*)\}', body):
        if re.search(r'opacity\s*:\s*1', decl):
            on += [float(x) for x in re.findall(r'([\d.]+)%', sel)]
    return (min(on), max(on)) if on else None


def lines_of(svg):
    """{line id: its text}.

    Keyed rather than listed on purpose: a band can hold a `<text>` that is
    empty - a spacer, or a line the renderer left blank - and pairing texts to
    timings by position would then shift every caption after it onto the wrong
    moment. The id is what ties a line to its own window.
    """
    out = {}
    for m in re.finditer(r'<text\s+[^>]*id="(%s)"[^>]*>(.*?)</text>' % ID, svg, re.S):
        text = ' '.join(re.sub(r'<[^>]+>', ' ', m.group(2)).split())
        text = re.sub(r'\s*\[cite:[^\]]*\]', '', text)
        if text:
            out[m.group(1)] = text
    return out


CLASS = r'\.narr(?:ative)?[-_]?text'    # and the class the settings may sit on


def looping(svg):
    """A shared loop and a window per line, or None if this is a one-shot.

    Some renderers put the loop on each line (`animation: name 24s infinite`),
    others put the name on the line and the duration and the repeat on the
    class every line shares. Both say the same thing, so both are read.
    """
    shared = ' '.join(re.findall(r'%s\s*\{([^}]*)\}' % CLASS, svg))
    if not re.search(r'#(?:%s)\s*\{[^}]*infinite' % ID, svg) and 'infinite' not in shared:
        return None
    bound, seconds = {}, []
    m = (re.search(r'animation-duration:\s*([\d.]+)s', shared)
         or re.search(r'animation:\s*[\w-]+\s+([\d.]+)s', shared))
    if m:
        seconds.append(float(m.group(1)))
    for who, rest in re.findall(r'#(%s)\s*\{([^}]*)\}' % ID, svg):
        m = re.search(r'animation(?:-name)?\s*:\s*([\w-]+)', rest)
        if m:
            bound[who] = m.group(1)
        m = re.search(r'animation\s*:[^;]*?([\d.]+)s', rest) or \
            re.search(r'animation-duration:\s*([\d.]+)s', rest)
        if m:
            seconds.append(float(m.group(1)))
    if not seconds:
        return None

    windows = {n: w for n, w in ((n, on_window(b)) for n, b in keyframes(svg).items()) if w}

    loop = max(seconds)
    cues = []
    texts = lines_of(svg)
    for who in sorted(bound, key=lambda k: int(re.findall(r'\d+', k)[-1])):
        win = windows.get(bound[who])
        if win and texts.get(who):
            cues.append({'start': round(win[0] / 100 * loop, 2),
                         'end': round(win[1] / 100 * loop, 2), 'text': texts[who]})
    cues.sort(key=lambda c: c['start'])
    return (cues, loop) if cues else None


def steps_of(svg):
    """Every delay the reveal steps on, smallest first."""
    found = [float(x) for x in re.findall(r'animation-delay:\s*([\d.]+)s', svg)]
    found += [float(d) for _n, _d, d in
              re.findall(r'animation:\s*([\w-]+)\s+([\d.]+)s\s+([\d.]+)s', svg)]
    return sorted(set(found))


def retime(svg, mapping):
    """Rewrite every delay in the file to the second it should now happen."""
    def one(m):
        return '%s%gs' % (m.group(1), mapping.get(float(m.group(2)), float(m.group(2))))

    svg = re.sub(r'(animation-delay:\s*)([\d.]+)s', one, svg)

    def short(m):
        head, dur, delay = m.group(1), m.group(2), float(m.group(3))
        return '%s%ss %gs' % (head, dur, mapping.get(delay, delay))

    return re.sub(r'(animation:\s*[\w-]+\s+)([\d.]+)s\s+([\d.]+)s', short, svg)


def narration(svg, beats, clip):
    """The caption track, the loop's length, and the drawing - retimed if needed.

    A looping export is left exactly as authored. A one-shot export is stepped
    onto the narration's own clock, because at half a second a step neither the
    reveal nor its captions can be followed.
    """
    got = looping(svg)
    if got:
        return got[0], got[1], svg

    texts = lines_of(svg)
    steps = steps_of(svg)
    if not steps:
        return [], 0, svg

    if beats and len(steps) == len(beats):
        mapping = {old: b['t'] for old, b in zip(steps, beats)}
        cues = [{'start': b['t'], 'end': (beats[i + 1]['t'] if i + 1 < len(beats) else clip),
                 'text': b['text']} for i, b in enumerate(beats)]
        loop = clip
    else:
        # no one-to-one reading of it: keep the shape, stretch it to the clip
        span = (max(steps) or 1) + 0.5
        k = (clip / span) if clip else 1
        mapping = {old: round(old * k, 2) for old in steps}
        loop = round(span * k, 2)
        ordered = [texts[k] for k in sorted(texts, key=lambda k: int(re.findall(r'\d+', k)[-1]))]
        cues = [{'start': mapping[s], 'end': loop, 'text': t}
                for s, t in zip(steps, ordered)]
        for i in range(len(cues) - 1):
            cues[i]['end'] = cues[i + 1]['start']
    return cues, loop, retime(svg, mapping)


def strip_band(svg):
    """The drawing without its caption band, trimmed to what is left."""
    top = None
    band = re.search(r'\s*<g[^>]*id="narration[^"]*"[^>]*>.*?</g>', svg, re.S)
    if band:
        rect = re.search(r'<rect[^>]*\sy="([\d.]+)"', band.group(0))
        if rect:
            top = float(rect.group(1))
        svg = svg.replace(band.group(0), '')
    svg = re.sub(r'\s*<text\s+[^>]*id="(?:%s)"[^>]*>.*?</text>' % ID, '', svg, flags=re.S)
    svg = re.sub(r'\s*@keyframes\s+(?:anim_narr_\w+|narr[\w-]*)\s*\{[^{}]*(\{[^}]*\}[^{}]*)*\}', '', svg)
    svg = re.sub(r'\s*#(?:%s)\s*\{[^}]*\}' % ID, '', svg)
    svg = re.sub(r'\s*\.narr-text\s*\{[^}]*\}', '', svg)
    svg = re.sub(r'\s*\.narrative_text\s*\{[^}]*\}', '', svg)
    if top:
        m = re.search(r'viewBox="([\d.\-]+)\s+([\d.\-]+)\s+([\d.]+)\s+([\d.]+)"', svg)
        if m and top - 6 < float(m.group(4)):
            svg = svg.replace(m.group(0), 'viewBox="%s %s %s %g"' % (
                m.group(1), m.group(2), m.group(3), round(top - 6)))
    # the wrapper sizes the picture; fixed width/height on the root would fight it
    svg = re.sub(r'(<svg\b[^>]*?)\s+width="[\d.]+"\s+height="[\d.]+"', r'\1', svg, count=1)
    return svg


def embed_rasters(svg, base):
    """Every raster the drawing points at, carried inside it - once.

    The renderers write both `href` and the legacy `xlink:href` on each image,
    at the same file. Embedding both would carry every picture twice; browsers
    have read plain `href` on an SVG image for years, so the legacy copy goes.
    """
    svg = re.sub(r'(<image\b[^>]*?)\s+xlink:href="([^"]*)"([^>]*?)\s+href="\2"', r'\1\3 href="\2"', svg)
    svg = re.sub(r'(<image\b[^>]*?)\s+href="([^"]*)"([^>]*?)\s+xlink:href="\2"', r'\1 href="\2"\3', svg)
    missing = []

    def swap(m):
        attr, path = m.group(1), m.group(2)
        full = os.path.join(base, path.replace('/', os.sep))
        if not os.path.exists(full):
            missing.append(path)
            return m.group(0)
        kind = mimetypes.guess_type(full)[0] or 'image/png'
        data = base64.b64encode(io.open(full, 'rb').read()).decode('ascii')
        return '%s="data:%s;base64,%s"' % (attr, kind, data)

    svg = re.sub(r'(xlink:href|href)="((?!data:|https?:|#)[^"]+\.(?:png|jpe?g|gif|webp))"', swap, svg)
    return svg, missing


PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(title)s</title>
<!--
  %(title)s
  An animated visual narrative produced by the AnimateBanana pipeline.

  This file is self-contained: the animation, its images, its narration and its
  controls are all inside it. Drop it on a server, open it from a disk, or put
  it in an <iframe> - it needs nothing else and fetches nothing.

  The animation is CSS. The controls drive it through the browser's animation
  API - pause holds every keyframe at once, the bar scrubs them all to the same
  moment, speed sets their rate together - and the caption is read from a clock
  of the page's own that is driven alongside them. It has to be its own clock:
  the drawing is made of hundreds of short animations that each stop when they
  are done, so reading the time off any one of them gives a watch that stopped
  half a second in.
-->
<style>
  :root {
    --ink: #1A1815;
    --paper: #FFFEF9;
    --banana: #FFD43B;
    --banana-deep: #F2B200;
    --banana-soft: #FFF2B8;
    --mute: #6b6558;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--paper); color: var(--ink); }
  body {
    font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    padding: 16px;
  }
  .ab { margin: 0 auto; max-width: 1400px; }
  .ab-stage {
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 14px;
    padding: 10px;
    overflow: hidden;
  }
  .ab-stage svg { display: block; width: 100%%; height: auto; }

  /* ---- Transport ----
     Every control is the same height and centred on the same line, so the bar
     reads as one object rather than a row of parts that happen to be adjacent. */
  .ab-bar {
    --h: 40px;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 8px 12px;
    background: var(--paper);
    border: 2px solid var(--ink);
    border-radius: calc(var(--h) / 2 + 8px);
  }
  .ab-bar > * { flex: 0 0 auto; height: var(--h); }

  .ab-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 16px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    line-height: 1;
    color: var(--ink);
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 999px;
    cursor: pointer;
  }
  .ab-btn:hover { background: var(--banana-soft); }
  .ab-btn:active { transform: translateY(1px); }

  .ab-play { width: var(--h); padding: 0; border-radius: 50%%; background: var(--ink); color: var(--paper); }
  .ab-play:hover { background: var(--ink); }
  .ab-play svg { width: 14px; height: 14px; fill: currentColor; display: block; }
  .ab-play .ab-ic-play { display: none; margin-left: 2px; }
  .ab.is-paused .ab-play .ab-ic-play { display: block; }
  .ab.is-paused .ab-play .ab-ic-pause { display: none; }

  /* the rail is drawn; the range input laid over it is what you actually grab */
  .ab-scrub { position: relative; flex: 1 1 180px !important; min-width: 120px;
              display: flex; align-items: center; }
  .ab-rail {
    position: absolute; inset-inline: 0; height: 9px;
    background: #fff; border: 1.5px solid var(--ink); border-radius: 999px;
    overflow: hidden; pointer-events: none;
  }
  .ab-rail i { display: block; width: 0; height: 100%%; background: var(--banana); }
  .ab-seek {
    position: relative; width: 100%%; height: var(--h); margin: 0;
    background: none; -webkit-appearance: none; appearance: none; cursor: pointer;
  }
  .ab-seek::-webkit-slider-runnable-track { height: var(--h); background: transparent; }
  .ab-seek::-moz-range-track { height: var(--h); background: transparent; }
  .ab-seek::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 18px; height: 18px; border-radius: 50%%;
    border: 2.5px solid var(--ink); background: var(--banana);
  }
  .ab-seek::-moz-range-thumb {
    width: 16px; height: 16px; border-radius: 50%%;
    border: 2.5px solid var(--ink); background: var(--banana);
  }
  .ab-seek:focus-visible { outline: none; }
  .ab-scrub:focus-within .ab-rail { box-shadow: 0 0 0 3px var(--banana); }

  .ab-time {
    display: inline-flex;
    align-items: center;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--mute);
    white-space: nowrap;
  }
  .ab-time b { color: var(--ink); }

  .ab-speed {
    display: inline-flex;
    align-items: stretch;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 999px;
    overflow: hidden;
  }
  .ab-speed button {
    display: grid;
    place-items: center;
    width: 34px;
    padding: 0;
    font-size: 1.05rem;
    font-weight: 700;
    line-height: 1;
    color: var(--ink);
    background: #fff;
    border: 0;
    cursor: pointer;
  }
  .ab-speed button:hover { background: var(--banana-soft); }
  .ab-speed button[disabled] { opacity: 0.35; cursor: default; background: #fff; }
  .ab-rate {
    display: grid;
    place-items: center;
    min-width: 56px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.74rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    border-inline: 2px solid var(--ink);
  }
  .ab.is-fast .ab-rate { background: var(--banana); }

  /* Captions on or off, said in words rather than left to be inferred */
  .ab-toggle .ab-led {
    width: 11px; height: 11px; border-radius: 50%%;
    border: 2px solid var(--ink); background: var(--banana);
  }
  .ab-toggle[aria-pressed="false"] { color: var(--mute); }
  .ab-toggle[aria-pressed="false"] .ab-led { background: #fff; }

  /* ---- The line being narrated ---- */
  .ab-cap {
    display: flex;
    align-items: center;
    min-height: 3.4em;
    margin: 10px 0 0;
    padding: 12px 16px;
    font-size: clamp(0.95rem, 0.9rem + 0.3vw, 1.15rem);
    font-weight: 600;
    font-style: italic;
    line-height: 1.5;
    background: var(--banana-soft);
    border: 1.5px solid var(--banana);
    border-left: 5px solid var(--banana-deep);
    border-radius: 10px;
    transition: opacity .18s ease;
  }
  .ab-cap.is-swap { opacity: 0; }
  .ab.is-off .ab-cap { display: none; }
  @media (prefers-reduced-motion: reduce) { .ab-cap { transition: none; } }

  /* Narrow: the bar wraps to two rows and squares off, rather than squeezing
     the scrub bar down to nothing. */
  @media (max-width: 720px) {
    .ab-bar { flex-wrap: wrap; border-radius: 20px; }
    .ab-scrub { order: 3; flex-basis: 100%% !important; }
    .ab-time { order: 2; margin-left: auto; }
  }
</style>
</head>
<body>
<figure class="ab">
  <div class="ab-stage">
%(svg)s
  </div>

  <div class="ab-bar">
    <button type="button" class="ab-btn ab-play" aria-label="Pause">
      <svg class="ab-ic-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5l11 6.5-11 6.5z"/></svg>
      <svg class="ab-ic-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 5.5h3.6v13H7.5zM12.9 5.5h3.6v13h-3.6z"/></svg>
    </button>

    <div class="ab-scrub">
      <span class="ab-rail" aria-hidden="true"><i class="ab-played"></i></span>
      <input type="range" class="ab-seek" min="0" max="1000" value="0" step="1"
             aria-label="Scrub through the animation">
    </div>

    <span class="ab-time"><b>0:00</b>&nbsp;/&nbsp;<span class="ab-total">0:00</span></span>

    <div class="ab-speed" role="group" aria-label="Playback speed">
      <button type="button" class="ab-slower" aria-label="Slower">&#8722;</button>
      <span class="ab-rate" aria-live="polite">1&#215;</span>
      <button type="button" class="ab-faster" aria-label="Faster">+</button>
    </div>

    <button type="button" class="ab-btn ab-toggle" aria-pressed="true">
      <span class="ab-led" aria-hidden="true"></span>
      <span class="ab-word">Captions on</span>
    </button>
  </div>

  <figcaption class="ab-cap" aria-live="polite"></figcaption>
</figure>

<script>
(function () {
  var CUES = %(cues)s;
  var LOOP = %(loop)s;
  var REPEATS = %(repeat)s;
  var RATES = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

  var fig = document.querySelector('.ab');
  var cap = document.querySelector('.ab-cap');
  var play = document.querySelector('.ab-play');
  var seek = document.querySelector('.ab-seek');
  var played = document.querySelector('.ab-played');
  var nowEl = document.querySelector('.ab-time b');
  var totalEl = document.querySelector('.ab-total');
  var rateEl = document.querySelector('.ab-rate');
  var slower = document.querySelector('.ab-slower');
  var faster = document.querySelector('.ab-faster');
  var toggle = document.querySelector('.ab-toggle');
  var word = toggle.querySelector('.ab-word');

  var at = -1, swap = null, rate = 3, paused = false, scrubbing = false;

  // THE CLOCK. The drawing is hundreds of short animations that each stop when
  // they are done, so none of them can be asked what time it is. This one runs
  // the length of the whole piece, does nothing visible, and is driven by the
  // same controls - so the caption, the bar and the picture cannot disagree.
  var master = null;
  try {
    master = document.documentElement.animate(
      [{ opacity: 1 }, { opacity: 1 }],
      { duration: (LOOP || 1) * 1000, iterations: REPEATS }
    );
  } catch (e) {}
  var t0 = performance.now();

  function others() {
    try {
      var runs = document.getAnimations ? document.getAnimations() : [];
      return runs.filter(function (a) { return a !== master; });
    } catch (e) { return []; }
  }
  function clock() {
    var t;
    if (master && master.currentTime != null) t = master.currentTime / 1000;
    else t = (performance.now() - t0) / 1000;
    return REPEATS === 1 ? Math.min(t, LOOP) : (t %% (LOOP || 1));
  }
  function each(fn) {
    if (master) { try { fn(master); } catch (e) {} }
    others().forEach(function (a) { try { fn(a); } catch (e) {} });
  }
  function clip(t) {
    t = Math.max(0, t || 0);
    return Math.floor(t / 60) + ':' + ('0' + Math.floor(t %% 60)).slice(-2);
  }

  play.addEventListener('click', function () {
    paused = !paused;
    // Restarting a finished piece rather than leaving Play doing nothing
    if (!paused && REPEATS === 1 && clock() >= LOOP - 0.05) each(function (a) { a.currentTime = 0; });
    each(function (a) { paused ? a.pause() : a.play(); });
    if (!paused) t0 = performance.now() - clock() * 1000;
    fig.classList.toggle('is-paused', paused);
    play.setAttribute('aria-label', paused ? 'Play' : 'Pause');
  });

  function setRate(i) {
    rate = Math.max(0, Math.min(RATES.length - 1, i));
    var r = RATES[rate];
    each(function (a) { a.playbackRate = r; });
    rateEl.textContent = r + '\u00D7';
    fig.classList.toggle('is-fast', r !== 1);
    slower.disabled = rate === 0;
    faster.disabled = rate === RATES.length - 1;
  }
  slower.addEventListener('click', function () { setRate(rate - 1); });
  faster.addEventListener('click', function () { setRate(rate + 1); });

  seek.addEventListener('pointerdown', function () { scrubbing = true; });
  seek.addEventListener('input', function () {
    var t = (Number(seek.value) / 1000) * LOOP;
    each(function (a) { a.currentTime = t * 1000; });
    t0 = performance.now() - t * 1000;
    paint(true);
  });
  seek.addEventListener('change', function () { scrubbing = false; });

  toggle.addEventListener('click', function () {
    var on = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(on));
    word.textContent = on ? 'Captions on' : 'Captions off';
    fig.classList.toggle('is-off', !on);
  });

  function paint(force) {
    var t = clock();
    nowEl.textContent = clip(t);
    if (!scrubbing) seek.value = String(Math.round((t / (LOOP || 1)) * 1000));
    played.style.width = ((t / (LOOP || 1)) * 100) + '%%';

    var k = -1;
    for (var i = 0; i < CUES.length; i++) { if (t >= CUES[i].start - 0.05) k = i; }
    if (k !== at || force === true) {
      at = k;
      var text = k >= 0 ? CUES[k].text : '';
      if (text !== cap.textContent) {
        cap.classList.add('is-swap');
        clearTimeout(swap);
        swap = setTimeout(function () {
          cap.textContent = text;
          cap.classList.remove('is-swap');
        }, 150);
      }
    }
  }

  // Two ways round, on purpose. requestAnimationFrame gives a smooth bar while
  // the page is on screen, and stops dead in a background tab or an embed the
  // browser considers hidden - where the animation itself keeps running, so the
  // caption would be left behind. The slow timer covers exactly that case.
  function frame() { paint(); requestAnimationFrame(frame); }

  totalEl.textContent = clip(LOOP);
  setRate(3);
  if (!CUES.length) { fig.classList.add('is-off'); toggle.style.display = 'none'; }
  requestAnimationFrame(frame);
  setInterval(paint, 250);
})();
</script>
</body>
</html>
"""


def main():
    dry = '--dry-run' in sys.argv
    feed = json.load(io.open(FEED, encoding='utf-8'))
    built = skipped = 0

    for item in feed['items']:
        style_dir = STYLE_DIR.get(item['styleId'])
        src = os.path.join(ROOT, SRC, style_dir or '', item['id'] + '.html')
        if not style_dir or not os.path.exists(src):
            print('%-34s no export to wrap' % item['id'][:33])
            skipped += 1
            continue

        svg = io.open(src, encoding='utf-8', errors='replace').read()
        repeats = looping(svg) is not None
        cues, loop, svg = narration(svg, item.get('beats') or [],
                                    (item.get('narrative') or {}).get('seconds') or 0)
        svg = strip_band(svg)
        svg, missing = embed_rasters(svg, os.path.dirname(src))

        out_rel = '%s/%s.html' % (OUT, item['id'])
        note = 'The animation as one self-contained HTML file: rasters embedded, captions you can switch off.'
        if dry:
            print('%-34s %2d captions, %ss loop, %d raster(s)%s' % (
                item['id'][:33], len(cues), loop, len(re.findall(r'data:image', svg)),
                '  MISSING %d' % len(missing) if missing else ''))
            built += 1
            continue

        page = PAGE % {
            'title': 'AnimateBanana — %s — %s' % (item['style'], item['id']),
            'svg': svg,
            'cues': json.dumps(cues, ensure_ascii=False),
            'loop': loop or 0,
            # a looping export runs for ever; a retimed one-shot plays once and
            # holds the finished figure, and its clock has to do the same
            'repeat': 'Infinity' if repeats else 1,
        }
        io.open(os.path.join(ROOT, out_rel), 'w', encoding='utf-8', newline='\n').write(page)
        item.setdefault('downloads', {})['svg'] = {
            'href': out_rel,
            'name': '%s_%s.html' % (item['id'], item['styleId']),
            'note': note,
        }
        print('%-34s %2d captions, %5ss loop, %2d raster(s), %4d KB%s' % (
            item['id'][:33], len(cues), loop, len(re.findall(r'data:image', svg)),
            os.path.getsize(os.path.join(ROOT, out_rel)) / 1024,
            '  MISSING %d' % len(missing) if missing else ''))
        built += 1

    if dry:
        print('\ndry run: nothing written (%d would be built, %d have no export)' % (built, skipped))
        return
    io.open(FEED, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(feed, indent=1, ensure_ascii=False) + '\n')
    print('\nbuilt %d wrappers; %d examples have no export to wrap' % (built, skipped))


main()
