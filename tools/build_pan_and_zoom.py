"""Split each pan-and-zoom animation into a clean picture and its narration.

The rendered animations arrive as self-contained SVG documents (`pz_*.html`)
that carry their narration inside the drawing: a band of `<text
class="narrative_text">` nodes, each faded in and out by a `@keyframes narrN`
rule keyed to a percentage of the loop.

A caption burned into the picture is unreadable at pane size and cannot be
restyled, so this script takes it out:

  * `<style-id>.html` - the same animation with the narration band, its
    keyframes and its bindings removed. It keeps the renders' own .html
    extension, because the stylesheet inside carries bare `&` characters that
    an HTML parser reads happily and an XML one refuses; and it stays in this
    folder so the `rasters/...` paths inside it keep working.
  * `data/benchmark/pan-and-zoom.json` - the narration as data: the loop's
    length and every line with the seconds it runs from and to, which is what
    the page shows under the animation.

Run it from the repository root whenever a `pz_*.html` file changes:

    python tools/build_pan_and_zoom.py
"""
import io
import json
import os
import re

SRC = 'assets/bench/pan_and_zoom'
OUT = 'data/benchmark/pan-and-zoom.json'

# Each file is one Layer 1 style; the id is the one diversity.json uses, so
# the pane can look up the animation for whatever style is selected.
STYLE_ID = {
    'alpha_mask': 'alpha-masking',      # the renders spell this one both ways
    'colour_pop': 'colour-pop',
    'hopping_bounding_box': 'hopping-bbox',
    'progressive_reveal': 'progressive-reveal',
    'sliding_bounding_box': 'sliding-bbox',
    'alpha_masking': 'alpha-masking',
}


SHEET = ('<style>html,body{margin:0;padding:0;height:100%;background:#fff;overflow:hidden}'
         'svg{display:block;width:100%;height:100%}</style>\n')


def seconds(svg):
    """The loop's length, from the narration layer's own animation."""
    m = re.search(r'\.narrative_text\s*\{[^}]*animation-duration:\s*([\d.]+)s', svg, re.S)
    if m:
        return float(m.group(1))
    m = re.search(r'animation:\s*cameraPan\s+([\d.]+)s', svg)
    return float(m.group(1)) if m else 0.0


def windows(svg):
    """{keyframe name: (from %, to %)} - when each line is on screen.

    The renders spell their keyframe names differently (`narr3` in one,
    `narr_anim_ts3` in another), so the name is whatever the binding rule
    points at rather than a fixed spelling."""
    out = {}
    for name, body in re.findall(
            r'@keyframes\s+(narr[\w-]*)\s*\{(.*?)\}\s*(?=@keyframes|\n\s*[#.]|\Z)', svg, re.S):
        on = []
        for sel, decl in re.findall(r'([\d.%,\s]+)\{([^}]*)\}', body):
            if re.search(r'opacity:\s*1', decl):
                on += [float(p) for p in re.findall(r'([\d.]+)%', sel)]
        if on:
            out[name] = (min(on), max(on))
    return out


def lines(svg):
    """[(element id, keyframe name, text)] in the order the lines are drawn."""
    bound = dict(re.findall(r'#(narr_ts\d+)\s*\{\s*animation-name:\s*([\w-]+)', svg))
    out = []
    for tag, body in re.findall(r'<text\s+([^>]*class="narrative_text"[^>]*)>(.*?)</text>', svg, re.S):
        m = re.search(r'id="(narr_ts\d+)"', tag)
        if not m:
            continue
        text = ' '.join(re.sub(r'<[^>]+>', ' ', body).split())
        text = re.sub(r'\s*\[cite:[^\]]*\]', '', text)   # a stray note from the render
        out.append((m.group(1), bound.get(m.group(1)), text))
    return out


def clean(svg):
    """The same drawing without the narration band, cropped to what is left.

    The band is a group of its own at the foot of the drawing - a panel and
    the lines on it - so taking it out leaves a strip of empty canvas behind.
    The viewBox is trimmed back to where the band began, which is what lets
    the animation fill its frame on the page."""
    top = None
    band = re.search(r'<g[^>]*id="narration[^"]*"[^>]*>.*?</g>', svg, re.S)
    if band:
        rect = re.search(r'<rect[^>]*\sy="([\d.]+)"', band.group(0))
        if rect:
            top = float(rect.group(1))
        svg = svg.replace(band.group(0), '')
    svg = re.sub(r'\s*<text\s+[^>]*class="narrative_text"[^>]*>.*?</text>', '', svg, flags=re.S)
    svg = re.sub(r'\s*@keyframes\s+narr[\w-]*\s*\{[^{}]*(\{[^}]*\}[^{}]*)*\}', '', svg)
    svg = re.sub(r'\s*#narr_ts\d+\s*\{[^}]*\}', '', svg)
    svg = re.sub(r'\s*\.narrative_text\s*\{[^}]*\}', '', svg)

    if top:
        m = re.search(r'viewBox="([\d.\-]+)\s+([\d.\-]+)\s+([\d.]+)\s+([\d.]+)"', svg)
        if m and top - 4 < float(m.group(4)):
            svg = svg.replace(m.group(0), 'viewBox="%s %s %s %g"'
                                          % (m.group(1), m.group(2), m.group(3), round(top - 4)))

    # The file is served on its own, in a frame of its own, so it gets the
    # page rules a standalone document needs: no default body margin holding
    # the drawing off the edges, and white behind it.
    svg = SHEET + re.sub(r'\n\s*\n\s*\n+', '\n\n', svg)
    return svg


styles = {}
for fn in sorted(os.listdir(SRC)):
    if not (fn.startswith('pz_') and fn.endswith('.html')):
        continue
    path = os.path.join(SRC, fn)
    svg = io.open(path, encoding='utf-8').read()

    key = fn[3:-5]                       # pz_<case>_<style>.html
    style = next((s for s in STYLE_ID if key.endswith(s)), None)
    if not style:
        print('! %s: no style in the name' % fn)
        continue
    case = key[: -len(style) - 1]

    dur = seconds(svg)
    win = windows(svg)
    cues = []
    for _id, frame, text in lines(svg):
        w = win.get(frame)
        if not w or not text:
            continue
        cues.append({'start': round(w[0] / 100 * dur, 2),
                     'end': round(w[1] / 100 * dur, 2),
                     'text': text})
    cues.sort(key=lambda c: c['start'])

    out_name = '%s.html' % STYLE_ID[style]
    io.open(os.path.join(SRC, out_name), 'w', encoding='utf-8', newline='\n').write(clean(svg))
    styles[STYLE_ID[style]] = {
        'file': '%s/%s' % (SRC, out_name),
        'source': '%s/%s' % (SRC, fn),
        'case': case,
        'duration': dur,
        'cues': cues,
    }
    print('%-20s %5.1fs  %2d lines -> %s' % (STYLE_ID[style], dur, len(cues), out_name))

data = {
    '_comment': ("PAN AND ZOOM, the Layer 2 camera move in the Narrative Diversity pane. Generated by "
                 "tools/build_pan_and_zoom.py from the pz_*.html renders in assets/bench/pan_and_zoom/ - "
                 "do not edit by hand. Each entry is keyed by the Layer 1 style it composes on top of, "
                 "and holds the cleaned SVG (narration removed) plus that narration as timed cues, which "
                 "the page shows in the panel under the animation. A style with no entry has no pan and "
                 "zoom render yet, and the pane says so rather than offering it."),
    'label': 'Pan and Zoom',
    'note': 'Layer 2 pan and zoom composes on top of any of them',
    'styles': styles,
}
io.open(OUT, 'w', encoding='utf-8', newline='\n').write(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
print('wrote %s (%d styles)' % (OUT, len(styles)))
