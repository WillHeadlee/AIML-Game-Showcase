"""
prune_frames.py — Remove near-identical (stationary) frames from enemy walking sequences.

Usage:
  python prune_frames.py            # dry run — shows what would be removed
  python prune_frames.py --apply    # actually deletes frames, renumbers, updates assets.js

Two frames are considered "stationary" if their mean absolute pixel difference
is below THRESHOLD (0–255 scale). Adjust if too aggressive or too conservative.
"""

import os
import sys
import re
import shutil
import numpy as np
from PIL import Image

THRESHOLD = 3.0  # mean absolute pixel diff to consider frames identical

BASE = os.path.dirname(os.path.abspath(__file__))

WALK_DIRS = [
    'assets/Boar/boar-walking-png',
    'assets/Mammoth/mammoth-walking-png',
    'assets/Saber Tooth Tiger/saber-tooth-tiger-walking-png',
    'assets/Witch/witch-walking-png',
    'assets/Vampire/vampire-walking-png',
    'assets/Ghost/ghost-walking-png',
    'assets/Sword Pirate/sword-pirate-walking-png',
    'assets/Flintlock Pirate/flintlock-pirate-walking-png',
    'assets/Bomb Pirate/bomb-pirate-walking-png',
    'assets/Grunt Zombie/grunt-zombie-walking-png',
    'assets/Necro Zombie/necro-zombie-walking-png',
    'assets/Vombie/vombie-walking-png',
    'assets/Mech Alien/mech-alien-walking-png',
    'assets/Saucer Alien/saucer-alien-walking-png',
]

ASSETS_JS = os.path.join(BASE, 'js', 'assets.js')
DRY_RUN = '--apply' not in sys.argv


def frame_diff(a: np.ndarray, b: np.ndarray) -> float:
    """Mean absolute difference across all channels."""
    return float(np.mean(np.abs(a.astype(np.int16) - b.astype(np.int16))))


def analyze_dir(dirpath: str):
    """Return sorted list of frame paths and set of indices (0-based) to remove."""
    frames = sorted(f for f in os.listdir(dirpath) if f.lower().endswith('.png'))
    if len(frames) < 2:
        return frames, set()

    arrays = []
    for f in frames:
        img = Image.open(os.path.join(dirpath, f)).convert('RGBA')
        arrays.append(np.array(img))

    to_remove = set()
    for i in range(1, len(arrays)):
        diff = frame_diff(arrays[i - 1], arrays[i])
        if diff < THRESHOLD:
            to_remove.add(i)  # remove the duplicate (keep the first of the pair)

    return frames, to_remove


def prune_dir(dirpath: str, frames: list, to_remove: set):
    """Delete flagged frames and renumber remaining ones sequentially."""
    kept = [f for i, f in enumerate(frames) if i not in to_remove]

    # Delete removed frames
    for i in to_remove:
        os.remove(os.path.join(dirpath, frames[i]))

    # Renumber kept frames into a temp name first (avoid collisions)
    tmp_names = []
    for idx, fname in enumerate(kept):
        tmp = f'_tmp_{idx+1:04d}.png'
        os.rename(os.path.join(dirpath, fname), os.path.join(dirpath, tmp))
        tmp_names.append(tmp)

    # Rename to final names
    for idx, tmp in enumerate(tmp_names):
        final = f'{idx+1:04d}.png'
        os.rename(os.path.join(dirpath, tmp), os.path.join(dirpath, final))

    return len(kept)


def update_assets_js(dir_key: str, new_count: int):
    """Update the count for a given dir in assets.js."""
    with open(ASSETS_JS, 'r', encoding='utf-8') as f:
        content = f.read()

    # Match the line containing this dir and replace its count
    pattern = r"(dir:'" + re.escape(dir_key) + r"'[^}]*?count:)\d+"
    replacement = r'\g<1>' + str(new_count)
    new_content = re.sub(pattern, replacement, content)

    if new_content == content:
        print(f'  WARNING: could not update count for {dir_key} in assets.js')
        return

    with open(ASSETS_JS, 'w', encoding='utf-8') as f:
        f.write(new_content)


def main():
    print(f"{'DRY RUN' if DRY_RUN else 'APPLYING'} — threshold={THRESHOLD}\n")
    total_before = 0
    total_after = 0

    for rel_dir in WALK_DIRS:
        dirpath = os.path.join(BASE, rel_dir.replace('/', os.sep))
        if not os.path.isdir(dirpath):
            print(f'  SKIP (not found): {rel_dir}')
            continue

        frames, to_remove = analyze_dir(dirpath)
        before = len(frames)
        after = before - len(to_remove)
        total_before += before
        total_after += after

        label = os.path.basename(rel_dir)
        print(f'{label}: {before} frames -> {after} kept, {len(to_remove)} removed')

        if not DRY_RUN and to_remove:
            final_count = prune_dir(dirpath, frames, to_remove)
            update_assets_js(rel_dir, final_count)

    print(f'\nTotal: {total_before} -> {total_after} frames ({total_before - total_after} removed)')
    if DRY_RUN:
        print('\nRun with --apply to actually prune the frames.')


if __name__ == '__main__':
    main()
