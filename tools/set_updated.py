#!/usr/bin/env python3
"""
Refresh the "Last updated ..." date written into the site footer.

The date shown to a reader is normally worked out in the browser, by
`assets/js/components/last-updated.js`, from the modification times of the files
the page actually loaded. What is in the markup is its fallback: the answer for
a reader with no JavaScript, and the starting point the component only ever
replaces with something newer. This keeps that fallback honest.

    python tools/set_updated.py              # today, in AOE
    python tools/set_updated.py 2026-09-24   # a specific day, as given
    python tools/set_updated.py --check      # report, change nothing

AOE is UTC-12, so "today in AOE" is not today in the local zone for the first
half of the day: at 09:00 UTC on the 25th it is still the 24th anywhere on
Earth. The component applies the same rule, and the two must agree or the
footer would visibly jump when the script finished running.

The two pipeline pages carry no footer line and are left alone.
"""
import re
import sys
import datetime
import pathlib

PATTERN = re.compile(r'(Last updated )(.+?)( \(AOE\))')
ROOT = pathlib.Path(__file__).resolve().parent.parent

# Anywhere on Earth is UTC-12: the AOE date is the UTC date twelve hours back.
AOE_OFFSET = datetime.timedelta(hours=12)


def today_aoe():
    return (datetime.datetime.now(datetime.timezone.utc) - AOE_OFFSET).date()


def format_date(d):
    """'25 September 2026' -- no zero padding, which %-d cannot do portably."""
    return '%d %s %d' % (d.day, d.strftime('%B'), d.year)


def main(argv):
    check = '--check' in argv
    args = [a for a in argv if not a.startswith('-')]

    if args:
        try:
            stamp = format_date(datetime.date.fromisoformat(args[0]))
        except ValueError:
            sys.exit('not a date (expected YYYY-MM-DD): %s' % args[0])
    else:
        stamp = format_date(today_aoe())

    pages = sorted(ROOT.glob('*.html'))
    hits = changed = 0

    for page in pages:
        text = page.read_text(encoding='utf-8')
        found = PATTERN.search(text)
        if not found:
            continue                      # the pipeline pages have no footer line
        hits += 1
        current = found.group(2)
        if current == stamp:
            print('  %-22s %s' % (page.name, current))
            continue
        changed += 1
        if check:
            print('  %-22s %s  ->  %s' % (page.name, current, stamp))
            continue
        page.write_text(PATTERN.sub(r'\g<1>%s\g<3>' % stamp, text), encoding='utf-8')
        print('  %-22s %s  ->  %s' % (page.name, current, stamp))

    verb = 'would change' if check else 'changed'
    print('\n%d page(s) carry the line, %s %d.' % (hits, verb, changed))
    if not hits:
        sys.exit('no footer line found -- has the markup changed?')


if __name__ == '__main__':
    main(sys.argv[1:])
