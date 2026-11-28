#!/usr/bin/env python3
"""Optimize Penalty Lakay GLB characters for mobile GPUs.

Removes unused morph targets, compacts indexed vertex buffers, quantizes skin
weights/joints and downsizes embedded textures. Bone rigging and animation clips
are retained. Usage: python3 scripts/optimize-glb.py file1.glb [file2.glb ...]
"""
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    data = Path(path).read_bytes()
    magic, version, length = struct.unpack('<4sII', data[:12])
    assert magic == b'glTF' and version == 2 and length == len(data), 'not a valid GLB 2.0'
    jlen, jtype = struct.unpack('<I4s', data[12:20])
    assert jtype == b'JSON'
    gltf = json.loads(data[20:20 + jlen])
    off = 20 + jlen
    blen, btype = struct.unpack('<I4s', data[off:off + 8])
    assert btype == b'BIN\\x00'
    return gltf, data[off + 8:off + 8 + blen]


def read_accessor(gltf, binb, idx):
    acc = gltf['accessors'][idx]
    assert 'sparse' not in acc, f'sparse accessor {idx} cannot be read directly'
    view = gltf['bufferViews'][acc['bufferView']]
    n = NCOMP[acc['type']]
    dtype = np.dtype(COMP[acc['componentType']])
    start = view.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = view.get('byteStride')
    if stride and stride != n * dtype.itemsize:
        raw = np.frombuffer(binb, dtype=np.uint8, count=stride * acc['count'], offset=start)
        raw = raw.reshape(acc['count'], stride)[:, :n * dtype.itemsize].copy()
        return np.frombuffer(raw.tobytes(), dtype=dtype).reshape(acc['count'], n)
    arr = np.frombuffer(binb, dtype=dtype, count=acc['count'] * n, offset=start)
    return arr.reshape(acc['count'], n)


class Builder:
    def __init__(self):
        self.bin, self.views, self.accessors = bytearray(), [], []

    def add_view(self, raw, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(raw)}
        if target:
            view['target'] = target
        self.bin += raw
        self.views.append(view)
        return len(self.views) - 1

    def add_accessor(self, arr, atype, ctype, target=None, normalized=False, minmax=False):
        arr = np.ascontiguousarray(arr)
        view = self.add_view(arr.tobytes(), target)
        acc = {'bufferView': view, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': atype}
        if normalized:
            acc['normalized'] = True
        if minmax:
            acc['min'] = [float(x) for x in arr.min(axis=0)]
            acc['max'] = [float(x) for x in arr.max(axis=0)]
        self.accessors.append(acc)
        return len(self.accessors) - 1


def shrink_image(name, raw, mime):
    img = Image.open(io.BytesIO(raw))
    lower = (name or '').lower()
    longest = max(img.size)
    limit = 256 if ('teeth' in lower or 'tongue' in lower) else 512 if ('eye' in lower or lower.endswith('_n.png')) else 1024
    if longest > limit:
        scale = limit / longest
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    has_alpha = img.mode in ('RGBA', 'LA', 'P') and (img.mode != 'P' or 'transparency' in img.info)
    if lower.endswith('_n.png') and not has_alpha:
        img.convert('RGB').save(out, 'JPEG', quality=90, optimize=True)
        return out.getvalue(), 'image/jpeg'
    if mime == 'image/jpeg' or (not has_alpha and img.mode == 'RGB' and longest >= 1024 and 'skin' in lower):
        img.convert('RGB').save(out, 'JPEG', quality=88, optimize=True)
        return out.getvalue(), 'image/jpeg'
    img.save(out, 'PNG', optimize=True)
    return out.getvalue(), 'image/png'


def optimize(src):
    gltf, binb = read_glb(src)
    b = Builder()
    old_size = Path(src).stat().st_size
    for mesh in gltf.get('meshes', []):
        mesh.pop('weights', None)
        extras = mesh.get('extras')
        if isinstance(extras, dict):
            extras.pop('targetNames', None)
            if not extras:
                mesh.pop('extras', None)
        for prim in mesh.get('primitives', []):
            prim.pop('targets', None)
            idx = read_accessor(gltf, binb, prim['indices']).reshape(-1)
            used = np.unique(idx)
            remap = np.zeros(int(idx.max()) + 1, dtype=np.uint32)
            remap[used] = np.arange(len(used), dtype=np.uint32)
            attrs = {}
            for name, acc_idx in prim['attributes'].items():
                arr = read_accessor(gltf, binb, acc_idx)[used]
                src_acc = gltf['accessors'][acc_idx]
                if name == 'POSITION':
                    attrs[name] = b.add_accessor(arr.astype(np.float32), 'VEC3', 5126, 34962, minmax=True)
                elif name in ('NORMAL', 'TANGENT'):
                    attrs[name] = b.add_accessor(arr.astype(np.float32), 'VEC3' if name == 'NORMAL' else 'VEC4', 5126, 34962)
                elif name.startswith('TEXCOORD'):
                    attrs[name] = b.add_accessor(arr.astype(np.float32), 'VEC2', 5126, 34962)
                elif name.startswith('JOINTS'):
                    attrs[name] = b.add_accessor(arr.astype(np.uint8 if arr.max() < 256 else np.uint16), 'VEC4', 5121 if arr.max() < 256 else 5123, 34962)
                elif name.startswith('WEIGHTS'):
                    w = arr.astype(np.float64)
                    w /= np.maximum(w.sum(axis=1, keepdims=True), 1e-9)
                    q = np.round(w * 65535).astype(np.int64)
                    q[np.arange(len(q)), 65535 - q.sum(axis=1) + q.sum(axis=1)] = q[np.arange(len(q)), 65535 - q.sum(axis=1) + q.sum(axis=1)] if False else q[np.arange(len(q)), q.argmax(axis=1)]
                    diff = 65535 - q.sum(axis=1)
                    q[np.arange(len(q)), q.argmax(axis=1)] += diff
                    attrs[name] = b.add_accessor(q.astype(np.uint16), 'VEC4', 5123, 34962, normalized=True)
                else:
                    attrs[name] = b.add_accessor(arr, src_acc['type'], src_acc['componentType'], 34962, normalized=src_acc.get('normalized', False))
            ictype, idtype = (5123, np.uint16) if len(used) < 65535 else (5125, np.uint32)
            prim['attributes'] = attrs
            prim['indices'] = b.add_accessor(remap[idx].astype(idtype).reshape(-1, 1), 'SCALAR', ictype, 34963)
    for skin in gltf.get('skins', []):
        if 'inverseBindMatrices' in skin:
            ibm = read_accessor(gltf, binb, skin['inverseBindMatrices']).astype(np.float32)
            skin['inverseBindMatrices'] = b.add_accessor(ibm, 'MAT4', 5126)
    for anim in gltf.get('animations', []):
        channels = [c for c in anim['channels'] if c['target'].get('path') != 'weights']
        used_samplers = sorted({c['sampler'] for c in channels})
        mapping = {old: new for new, old in enumerate(used_samplers)}
        samplers = []
        for old in used_samplers:
            s = anim['samplers'][old]
            inp = read_accessor(gltf, binb, s['input']).astype(np.float32)
            out_acc = gltf['accessors'][s['output']]
            out = read_accessor(gltf, binb, s['output']).astype(np.float32)
            ns = dict(s)
            ns['input'] = b.add_accessor(inp, 'SCALAR', 5126, minmax=True)
            ns['output'] = b.add_accessor(out, out_acc['type'], 5126)
            samplers.append(ns)
        for channel in channels:
            channel['sampler'] = mapping[channel['sampler']]
        anim['channels'], anim['samplers'] = channels, samplers
    for img in gltf.get('images', []):
        view = gltf['bufferViews'][img['bufferView']]
        raw = binb[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        new_raw, mime = shrink_image(img.get('name') or img.get('uri'), raw, img.get('mimeType'))
        img['bufferView'] = b.add_view(new_raw)
        img['mimeType'] = mime
    while len(b.bin) % 4:
        b.bin.append(0)
    gltf['accessors'], gltf['bufferViews'], gltf['buffers'] = b.accessors, b.views, [{'byteLength': len(b.bin)}]
    for key in ('extensionsUsed', 'extensionsRequired'):
        if key in gltf and not gltf[key]:
            gltf.pop(key)
    jbytes = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    jbytes += b' ' * ((4 - len(jbytes) % 4) % 4)
    total = 12 + 8 + len(jbytes) + 8 + len(b.bin)
    out = bytearray(struct.pack('<4sII', b'glTF', 2, total))
    out += struct.pack('<I4s', len(jbytes), b'JSON') + jbytes
    out += struct.pack('<I4s', len(b.bin), b'BIN\\x00') + bytes(b.bin)
    Path(src).write_bytes(out)
    print(f'{src}: {old_size / 1048576:.2f} MB -> {len(out) / 1048576:.2f} MB')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    for filename in sys.argv[1:]:
        optimize(Path(filename))
