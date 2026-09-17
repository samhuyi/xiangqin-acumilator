#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""压缩美术资源。

role  : 职业头像，游戏中最大展示约 140px，压到 360px 足够（含 2~3x 屏）。
scene : 约会场景背景，最大展示约屏幕宽（375~430），压到 640px。

用法：
    python tools/compress-assets.py            # 压缩全部
    python tools/compress-assets.py --dry-run  # 只看压缩后体积，不落盘

注意：图片文件名必须是 ASCII（英文 / 数字 / - _），不要用中文——
      中文文件名在打包与真机取图时可能因编码不一致而加载失败，
      表现为「图片全都不显示」。
"""

import os
import sys
import glob

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, 'assets', 'images')

# (源目录, 目标边长, 输出格式, 质量)
# 说明：role 是头像（游戏中最大约 140px，360px 足够 2~3x 屏）；
#       scene 是场景背景（最大约一屏宽，640px）；
#       '' 表示 assets/images 根目录的主包图（标题页背景 + 行动页头部背景，
#          最大一屏，按宽 750 压）；
#       end 是结局页头部背景（同上，按宽 750 压）。
JOBS = [
    ('role', 360, 'PNG', None),
    ('scene', 640, 'JPEG', 82),
    ('', 750, 'JPEG', 82),
    ('end', 750, 'JPEG', 82),
]


def size_kb(n):
    return n / 1024.0


def main():
    dry = '--dry-run' in sys.argv
    total_before = 0
    total_after = 0
    renamed = []

    for folder, edge, fmt, quality in JOBS:
        src_dir = os.path.join(IMG_DIR, folder)
        if not os.path.isdir(src_dir):
            print('跳过（目录不存在）:', src_dir)
            continue
        print('\n=== %s → %dpx %s ===' % (folder, edge, fmt))
        # png / jpg 都要收：第一次跑会把 PNG 转成 JPG，再跑时得能继续处理
        srcs = []
        for pat in ('*.png', '*.jpg', '*.jpeg', '*.PNG', '*.JPG'):
            srcs.extend(glob.glob(os.path.join(src_dir, pat)))
        for src in sorted(set(srcs)):
            # 非 ASCII 文件名直接拦下：真机可能加载不到
            name = os.path.basename(src)
            if not name.isascii():
                print('  ✗ 跳过（文件名含非 ASCII，请改成英文）: %s' % name)
                continue
            # 已经是目标格式、且没超过目标边长，就不重复压（保持幂等）
            if os.path.splitext(src)[1].lower() == ('.jpg' if fmt == 'JPEG' else '.png'):
                try:
                    if max(Image.open(src).size) <= edge:
                        continue
                except Exception:
                    pass
            before = os.path.getsize(src)
            total_before += before
            im = Image.open(src)
            has_alpha = im.mode in ('RGBA', 'LA') or (
                im.mode == 'P' and 'transparency' in im.info)

            # 等比缩放到目标边长（正方形源图，直接 resize）
            im2 = im.convert('RGBA' if has_alpha else 'RGB')
            im2.thumbnail((edge, edge), Image.LANCZOS)

            # JPEG 不支持透明，有 alpha 时仍走 PNG
            out_fmt = fmt
            if has_alpha and fmt == 'JPEG':
                out_fmt = 'PNG'

            import io
            base = os.path.splitext(src)[0]
            if out_fmt == 'JPEG':
                dst = base + '.jpg'
                if dry:
                    buf = io.BytesIO()
                    im2.save(buf, 'JPEG', quality=quality, optimize=True,
                             progressive=True)
                    after = buf.tell()
                else:
                    im2.save(dst, 'JPEG', quality=quality, optimize=True,
                             progressive=True)
                    if dst != src:
                        os.remove(src)
                        renamed.append(os.path.basename(dst))
                    after = os.path.getsize(dst)
            else:
                dst = base + '.png'
                if dry:
                    buf = io.BytesIO()
                    im2.save(buf, 'PNG', optimize=True)
                    after = buf.tell()
                else:
                    im2.save(dst, 'PNG', optimize=True)
                    after = os.path.getsize(dst)

            total_after += after
            print('  %-24s %7.0fKB → %6.0fKB  (%.0f%%)' % (
                os.path.basename(src), size_kb(before), size_kb(after),
                after / before * 100 if before else 0))

    print('\n合计: %.1fMB → %.1fMB' % (total_before / 1048576.0,
                                       total_after / 1048576.0))
    if dry:
        print('（dry-run，未落盘）')
    if renamed:
        print('格式已转为 JPG:', ', '.join(renamed))


if __name__ == '__main__':
    main()
