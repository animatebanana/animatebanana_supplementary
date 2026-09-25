"""Time the walkthrough's closing video from its own narration audio.

`pipeline/final_video.captions.json` carries the 25 lines the caption track on
the right shows while the finished video plays. Their times were written
against whichever render of the video existed at the time, so re-rendering the
clip - even at the same content, a few seconds shorter - leaves every line
landing late and the last one firing after the clip has ended.

The clip narrates one line at a time with a clear pause between them, so the
times do not have to be guessed: ffmpeg's silence detector finds the gaps, and
the speech that follows each gap is the next line. Where the number of speech
runs matches the number of lines, each line is given the second its own speech
starts. Where it does not, nothing is written - a wrong time is worse than an
old one, and the mismatch is worth looking at by hand.

    python tools/time_final_video_captions.py            # measure and report
    python tools/time_final_video_captions.py --write    # write the times back
"""
import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIDEO = os.path.join(ROOT, 'pipeline/final_video.mp4')
CAPS = os.path.join(ROOT, 'pipeline/final_video.captions.json')
NOISE = '-33dB'          # anything quieter than this is a gap
GAP = 0.35               # and it has to last this long to count as one


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(out.stdout.strip() or 0)


def speech_starts(path, total):
    """The second each run of speech begins, the first being zero.

    The clip ends on silence, and the detector closes that last gap at the end
    of the file - which looks like one more line starting exactly as the video
    stops. There is nothing after it to say, so it is dropped.
    """
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-v', 'info', '-i', path,
         '-af', 'silencedetect=noise=%s:d=%s' % (NOISE, GAP), '-f', 'null', '-'],
        capture_output=True, text=True).stderr
    ends = [float(m) for m in re.findall(r'silence_end:\s*([\d.]+)', out)]
    return [0.0] + [e for e in ends if e < total - 0.25]


def main():
    write = '--write' in sys.argv
    data = json.load(io.open(CAPS, encoding='utf-8'))
    caps = data['captions']
    real = duration(VIDEO)
    starts = speech_starts(VIDEO, real)

    print('video      %.2fs' % real)
    print('manifest   %.2fs   (%s)' % (data.get('duration', 0), 'agrees' if
          abs(data.get('duration', 0) - real) <= 0.2 else 'DISAGREES with the file'))
    print('captions   %d      speech runs found: %d' % (len(caps), len(starts)))

    if len(starts) != len(caps):
        print('\nnot writing: %d speech runs for %d captions. Check the clip, or tune'
              ' NOISE/GAP at the top of this script.' % (len(starts), len(caps)))
        return

    drift = max(abs(c['t'] - s) for c, s in zip(caps, starts))
    print('largest drift from where each line is actually spoken: %.2fs' % drift)
    print('\n  %-8s %-8s %s' % ('was', 'now', 'line'))
    for c, s in zip(caps, starts):
        print('  %-8.2f %-8.2f %s' % (c['t'], s, c['text'][:56]))

    if not write:
        print('\nnothing written; pass --write to set these times')
        return

    for c, s in zip(caps, starts):
        c['t'] = round(s, 2)
    data['duration'] = round(real, 2)
    data['_readme'] = (data.get('_readme', '').split(' Times measured')[0].rstrip() +
                       ' Times measured from the clip\'s own narration audio by '
                       'tools/time_final_video_captions.py - re-run it after re-rendering '
                       'the video, or every line drifts.')
    io.open(CAPS, 'w', encoding='utf-8', newline='\n').write(
        json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print('\nwritten: %d times, duration %.2fs' % (len(caps), real))


main()
