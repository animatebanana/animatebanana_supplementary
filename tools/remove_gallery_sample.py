"""Take an example out of the gallery: its feed entry, its media, its exports.

    python tools/remove_gallery_sample.py <id> [<id> ...] --dry-run
    python tools/remove_gallery_sample.py <id> [<id> ...]

Only the gallery is touched. The same id can appear in other data files on the
site - the benchmark strata, the showcase, the latency tables - and those are
left alone, because an example being dropped from the gallery says nothing
about the run it came from.
"""
import io
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEED = os.path.join(ROOT, 'data/gallery/gallery_items.json')


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if not ids:
        print(__doc__)
        return

    feed = json.load(io.open(FEED, encoding='utf-8'))
    before = len(feed['items'])

    for sample_id in ids:
        entry = next((i for i in feed['items'] if i['id'] == sample_id), None)
        if not entry:
            print('%-32s not in the feed' % sample_id)
            continue

        doomed = [os.path.join(ROOT, 'assets/gallery/media', sample_id)]
        exports = os.path.join(ROOT, 'assets/gallery/exports')
        if os.path.isdir(exports):
            doomed += [os.path.join(exports, f) for f in os.listdir(exports)
                       if f == sample_id + '.pptx' or f.startswith(sample_id + '-')]

        print('%-32s %s (%s)' % (sample_id, entry['style'], '%.0fs' % (entry.get('narrative') or {}).get('seconds', 0)))
        for p in doomed:
            if os.path.exists(p):
                print('    %s %s' % ('would remove' if dry else 'removing', os.path.relpath(p, ROOT)))
                if not dry:
                    shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
        if not dry:
            feed['items'] = [i for i in feed['items'] if i['id'] != sample_id]

    if dry:
        print('\ndry run: nothing written')
        return
    io.open(FEED, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(feed, indent=1, ensure_ascii=False) + '\n')
    print('\nfeed: %d items (was %d)' % (len(feed['items']), before))


main()
