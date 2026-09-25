"""Build a stratum's silent preview.mp4 (and captions.vtt) from its frames.

A stratum folder may arrive as a `preview/` folder of frames instead of a
clip. The frames carry their own timing: either a mapping_log.txt written
beside them (frame -> timestamp -> narration) or a captions.vtt with one cue
per frame. Either way the result is the same pair the other strata already
have - preview.mp4 and captions.vtt - so nothing else on the page changes.

Timing: a caption is held at least as long as it takes to read. Where the log
runs faster than that, the caption's LAST frame is stretched, so transition
frames stay as quick as they were rendered and only the held frame waits.

Run it from the repository root, with ffmpeg on the PATH:

    python tools/build_preview_from_frames.py               # every stratum
    python tools/build_preview_from_frames.py assets/bench/density/strata/connectivity/few

A folder is picked up when it holds a `preview/` folder of frames. The frames
are left in place: they are the source the clip is rebuilt from.
"""
import os
import re
import subprocess
import sys

ROOT = 'assets/bench/density/strata'
FPS = 12                 # what the other previews run at
WPS = 2.7                # reading speed, words per second
MIN_CUE, MAX_CUE = 2.6, 9.0
TAIL = 2.5               # a frame left over after the last caption


def read_time(text):
    n = len([w for w in text.split() if w.strip()])
    return max(MIN_CUE, min(MAX_CUE, n / WPS + 0.9))


def parse_log(path):
    """[(frame, start, narration)] from a mapping log."""
    out, cur = [], {}
    for line in open(path, encoding='utf-8', errors='replace'):
        m = re.match(r'\s*Frame Image\s*:\s*(\S+)', line)
        if m:
            if cur.get('f'):
                out.append(cur)
            cur = {'f': m.group(1), 't': None, 'n': ''}
            continue
        m = re.match(r'\s*Timestamp\s*:\s*([0-9.]+)\s*s', line)
        if m and cur:
            cur['t'] = float(m.group(1))
            continue
        m = re.match(r'\s*Narration\s*:\s*(.*)', line)
        if m and cur:
            cur['n'] = m.group(1).strip()
    if cur.get('f'):
        out.append(cur)
    return [(c['f'], c['t'], c['n']) for c in out if c['t'] is not None]


def parse_vtt(path):
    """[(start, end, text)] from a WebVTT file."""
    def sec(s):
        p = s.strip().replace(',', '.').split(':')
        p = [float(x) for x in p]
        return p[0] * 3600 + p[1] * 60 + p[2] if len(p) == 3 else p[0] * 60 + p[1]

    txt = open(path, encoding='utf-8-sig', errors='replace').read().replace('\r', '')
    cues = []
    for block in txt.split('\n\n'):
        m = re.search(r'([\d:.]+)\s+-->\s+([\d:.]+)', block)
        if not m:
            continue
        body = block.split(m.group(0), 1)[1].strip()
        cues.append((sec(m.group(1)), sec(m.group(2)), ' '.join(body.split())))
    return cues


def stamp(t):
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return '%02d:%02d:%06.3f' % (h, m, s)


def plan(folder, frames):
    """[(frame, seconds)] and [(start, end, text)], in step with each other."""
    log = os.path.join(folder, 'mapping_log.txt')
    vtt = os.path.join(folder, 'captions.vtt')

    if os.path.exists(log):
        rows = parse_log(log)
        names = {f for f, _, _ in rows}
        missing = [f for f in frames if f not in names]
        if missing:
            print('   ! %d frame(s) missing from the log, e.g. %s' % (len(missing), missing[0]))
        rows = [r for r in rows if r[0] in set(frames)]
        # each frame runs until the next one starts; the last holds a beat
        spans = []
        for i, (f, t, n) in enumerate(rows):
            nxt = rows[i + 1][1] if i + 1 < len(rows) else None
            spans.append([f, (nxt - t) if nxt else None, n])
        known = [d for _, d, _ in spans if d]
        typical = sorted(known)[len(known) // 2] if known else 1.0
        for s in spans:
            if not s[1] or s[1] <= 0:
                s[1] = typical
        # one caption per run of identical narration
        groups, i = [], 0
        while i < len(spans):
            j = i
            while j + 1 < len(spans) and spans[j + 1][2] == spans[i][2]:
                j += 1
            groups.append(spans[i:j + 1])
            i = j + 1
        # hold each caption long enough to read, by stretching its longest frame
        for g in groups:
            need = read_time(g[0][2]) - sum(s[1] for s in g)
            if need > 0:
                k = max(range(len(g)), key=lambda x: g[x][1])
                g[k][1] += need
        shots, cues, t = [], [], 0.0
        for g in groups:
            start = t
            for f, d, _ in g:
                shots.append((f, d))
                t += d
            if g[0][2]:
                cues.append((start, t, g[0][2]))
        return shots, cues

    if os.path.exists(vtt):
        cues = parse_vtt(vtt)
        if not cues:
            return None, None
        shots, t = [], 0.0
        for i, f in enumerate(frames):
            if i < len(cues):
                d = max(0.4, cues[i][1] - cues[i][0])
            else:                       # frames past the last caption: the end state
                d = TAIL / max(1, len(frames) - len(cues))
            shots.append((f, d))
        if len(cues) > len(frames):
            print('   ! %d captions for %d frames' % (len(cues), len(frames)))
        return shots, cues

    print('   ! neither mapping_log.txt nor captions.vtt')
    return None, None


def build(folder):
    fdir = os.path.join(folder, 'preview')
    frames = sorted(f for f in os.listdir(fdir) if f.lower().endswith(('.png', '.jpg')))
    if not frames:
        print('   ! no frames')
        return
    shots, cues = plan(folder, frames)
    if not shots:
        return

    size = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=width,height',
         '-of', 'csv=p=0', os.path.join(fdir, frames[0])],
        capture_output=True, text=True).stdout.strip().split(',')
    w, h = (int(size[0]) // 2) * 2, (int(size[1]) // 2) * 2

    lst = os.path.join(folder, '_frames.txt')
    with open(lst, 'w', encoding='utf-8', newline='\n') as fh:
        for f, d in shots:
            fh.write("file '%s'\n" % ('preview/' + f))
            fh.write('duration %.3f\n' % d)
        fh.write("file '%s'\n" % ('preview/' + shots[-1][0]))   # concat needs it twice

    out = os.path.join(folder, 'preview.mp4')
    total = sum(d for _, d in shots)
    # the frames carry alpha; lay them on white, as the diagrams are drawn
    chain = ('[0:v]scale=%d:%d:force_original_aspect_ratio=decrease,'
             'pad=%d:%d:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p[v]' % (w, h, w, h))
    # ffmpeg runs in the folder, so the list and the frames it names agree
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
           '-i', os.path.basename(lst), '-filter_complex', chain, '-map', '[v]',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '23',
           '-r', str(FPS), '-t', '%.3f' % total,
           '-movflags', '+faststart', '-an', os.path.basename(out)]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=folder)
    os.remove(lst)
    if r.returncode:
        print('   ! ffmpeg: %s' % r.stderr.strip()[:300])
        return

    if os.path.exists(os.path.join(folder, 'mapping_log.txt')):
        with open(os.path.join(folder, 'captions.vtt'), 'w', encoding='utf-8', newline='\n') as fh:
            fh.write('WEBVTT\n\n')
            for i, (a, b, text) in enumerate(cues, 1):
                fh.write('%d\n%s --> %s\n%s\n\n' % (i, stamp(a), stamp(b), text))

    print('   built preview.mp4  %d frames, %d captions, %.1fs, %.0f KB'
          % (len(shots), len(cues), total, os.path.getsize(out) / 1024))


targets = sys.argv[1:]
if not targets:
    targets = []
    for axis in sorted(os.listdir(ROOT)):
        for st in sorted(os.listdir(os.path.join(ROOT, axis))):
            d = os.path.join(ROOT, axis, st)
            if os.path.isdir(os.path.join(d, 'preview')):
                targets.append(d)
for t in targets:
    print('== %s' % os.path.relpath(t, ROOT).replace('\\', '/'))
    build(t)
