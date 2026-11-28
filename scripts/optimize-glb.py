#!/usr/bin/env python3
"""Optimize GLB character files for mobile GPUs while preserving skeletal animation."""
import io, json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image

COMP={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}

def accessor(doc, binary, index):
    a=doc['accessors'][index]
    if 'sparse' in a: raise ValueError('Sparse accessors are not supported')
    v=doc['bufferViews'][a['bufferView']]
    n=WIDTH[a['type']]; dt=np.dtype(COMP[a['componentType']])
    start=v.get('byteOffset',0)+a.get('byteOffset',0); stride=v.get('byteStride')
    if stride and stride != n*dt.itemsize:
        raw=np.frombuffer(binary,dtype=np.uint8,count=stride*a['count'],offset=start)
        raw=raw.reshape(a['count'],stride)[:,:n*dt.itemsize].copy()
        return np.frombuffer(raw.tobytes(),dtype=dt).reshape(a['count'],n)
    return np.frombuffer(binary,dtype=dt,count=a['count']*n,offset=start).reshape(a['count'],n)

class Builder:
    def __init__(self): self.binary=bytearray(); self.views=[]; self.accessors=[]
    def view(self, raw, target=None):
        while len(self.binary)%4: self.binary.append(0)
        v={'buffer':0,'byteOffset':len(self.binary),'byteLength':len(raw)}
        if target: v['target']=target
        self.binary.extend(raw); self.views.append(v); return len(self.views)-1
    def acc(self, arr, typ, component, target=None, normalized=False, minmax=False):
        arr=np.ascontiguousarray(arr); vi=self.view(arr.tobytes(),target)
        a={'bufferView':vi,'componentType':component,'count':int(arr.shape[0]),'type':typ}
        if normalized: a['normalized']=True
        if minmax: a.update(min=[float(x) for x in arr.min(axis=0)],max=[float(x) for x in arr.max(axis=0)])
        self.accessors.append(a); return len(self.accessors)-1

def image_bytes(name, raw, mime):
    im=Image.open(io.BytesIO(raw)); lower=(name or '').lower(); longest=max(im.size)
    limit=256 if ('teeth' in lower or 'tongue' in lower) else 512 if ('eye' in lower or lower.endswith('_n.png')) else 1024
    if longest>limit:
        scale=limit/longest
        im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.LANCZOS)
    out=io.BytesIO(); alpha=im.mode in ('RGBA','LA','P') and (im.mode!='P' or 'transparency' in im.info)
    if lower.endswith('_n.png') and not alpha:
        im.convert('RGB').save(out,'JPEG',quality=90,optimize=True); return out.getvalue(),'image/jpeg'
    if mime=='image/jpeg' or (not alpha and im.mode=='RGB' and longest>=1024 and 'skin' in lower):
        im.convert('RGB').save(out,'JPEG',quality=88,optimize=True); return out.getvalue(),'image/jpeg'
    im.save(out,'PNG',optimize=True); return out.getvalue(),'image/png'

def optimize(path):
    path=Path(path); data=path.read_bytes()
    magic,version,length=struct.unpack('<4sII',data[:12])
    if magic!=b'glTF' or version!=2 or length!=len(data): raise ValueError(f'{path} is not a valid GLB 2.0')
    jlen,jtype=struct.unpack('<I4s',data[12:20])
    if jtype!=b'JSON': raise ValueError('GLB JSON chunk is missing')
    doc=json.loads(data[20:20+jlen]); off=20+jlen
    blen,btype=struct.unpack('<I4s',data[off:off+8])
    if btype!=b'BIN\x00': raise ValueError('GLB binary chunk is missing')
    binary=data[off+8:off+8+blen]; b=Builder(); before=len(data)
    for mesh in doc.get('meshes',[]):
        mesh.pop('weights',None)
        if isinstance(mesh.get('extras'),dict):
            mesh['extras'].pop('targetNames',None)
            if not mesh['extras']: mesh.pop('extras')
        for prim in mesh.get('primitives',[]):
            prim.pop('targets',None); idx=accessor(doc,binary,prim['indices']).reshape(-1)
            used=np.unique(idx); remap=np.zeros(int(idx.max())+1,dtype=np.uint32)
            remap[used]=np.arange(len(used),dtype=np.uint32); attrs={}
            for name,ai in prim['attributes'].items():
                arr=accessor(doc,binary,ai)[used]; old=doc['accessors'][ai]
                if name=='POSITION': attrs[name]=b.acc(arr.astype(np.float32),'VEC3',5126,34962,minmax=True)
                elif name in ('NORMAL','TANGENT'): attrs[name]=b.acc(arr.astype(np.float32),old['type'],5126,34962)
                elif name.startswith('TEXCOORD'): attrs[name]=b.acc(arr.astype(np.float32),'VEC2',5126,34962)
                elif name.startswith('JOINTS'):
                    c=5121 if arr.max()<256 else 5123; attrs[name]=b.acc(arr.astype(np.uint8 if c==5121 else np.uint16),'VEC4',c,34962)
                elif name.startswith('WEIGHTS'):
                    w=arr.astype(np.float64); w/=np.maximum(w.sum(axis=1,keepdims=True),1e-9)
                    q=np.round(w*65535).astype(np.int64); diff=65535-q.sum(axis=1)
                    q[np.arange(len(q)),q.argmax(axis=1)]+=diff
                    attrs[name]=b.acc(q.astype(np.uint16),'VEC4',5123,34962,normalized=True)
                else: attrs[name]=b.acc(arr,old['type'],old['componentType'],34962,normalized=old.get('normalized',False))
            ic,idt=(5123,np.uint16) if len(used)<65535 else (5125,np.uint32)
            prim['attributes']=attrs; prim['indices']=b.acc(remap[idx].astype(idt).reshape(-1,1),'SCALAR',ic,34963)
    for skin in doc.get('skins',[]):
        if 'inverseBindMatrices' in skin:
            m=accessor(doc,binary,skin['inverseBindMatrices']).astype(np.float32)
            skin['inverseBindMatrices']=b.acc(m,'MAT4',5126)
    for anim in doc.get('animations',[]):
        channels=[c for c in anim['channels'] if c['target'].get('path')!='weights']
        used=sorted({c['sampler'] for c in channels}); mapping={old:new for new,old in enumerate(used)}; samplers=[]
        for old in used:
            s=anim['samplers'][old]; inp=accessor(doc,binary,s['input']).astype(np.float32)
            oa=doc['accessors'][s['output']]; out=accessor(doc,binary,s['output']).astype(np.float32)
            ns=dict(s); ns['input']=b.acc(inp,'SCALAR',5126,minmax=True); ns['output']=b.acc(out,oa['type'],5126); samplers.append(ns)
        for c in channels: c['sampler']=mapping[c['sampler']]
        anim['channels']=channels; anim['samplers']=samplers
    for img in doc.get('images',[]):
        v=doc['bufferViews'][img['bufferView']]
        raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
        raw,mime=image_bytes(img.get('name') or img.get('uri'),raw,img.get('mimeType'))
        img['bufferView']=b.view(raw); img['mimeType']=mime
    while len(b.binary)%4: b.binary.append(0)
    doc['accessors']=b.accessors; doc['bufferViews']=b.views; doc['buffers']=[{'byteLength':len(b.binary)}]
    for k in ('extensionsUsed','extensionsRequired'):
        if k in doc and not doc[k]: doc.pop(k)
    js=json.dumps(doc,separators=(',',':')).encode(); js+=b' ' *((4-len(js)%4)%4)
    while len(b.binary)%4: b.binary.append(0)
    total=12+8+len(js)+8+len(b.binary)
    out=bytearray(struct.pack('<4sII',b'glTF',2,total))
    out+=struct.pack('<I4s',len(js),b'JSON')+js
    out+=struct.pack('<I4s',len(b.binary),b'BIN\x00')+b.binary
    path.write_bytes(out)
    print(f'{path}: {before/1048576:.2f} MB -> {len(out)/1048576:.2f} MB')

if __name__=='__main__':
    if len(sys.argv)<2: raise SystemExit(__doc__)
    for item in sys.argv[1:]: optimize(item)
