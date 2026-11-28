import assert from 'node:assert/strict';
import fs from 'node:fs';

const models = [
  { file:'public/models/penalty-shooter.glb', clips:['idle','walk','run','shootfootball','cheer'] },
  { file:'public/models/penalty-keeper.glb', clips:['idle','walk','run','goalkeeperready','goalkeepercatch','goalkeeperdiveleft','goalkeeperdiveright','goalkeeperlowdiveleft','goalkeeperlowdiveright'] }
];
const normalize = value => String(value || '').split('|').pop().replace(/[^a-z0-9]/gi,'').toLowerCase();

function readGlb(file) {
  const data=fs.readFileSync(file);
  assert.ok(data.length>20,file+' must not be empty');
  assert.equal(data.toString('ascii',0,4),'glTF',file+' must be a binary glTF');
  assert.equal(data.readUInt32LE(8),data.length,file+' must have a valid GLB length');
  let offset=12;
  while(offset+8<=data.length) {
    const length=data.readUInt32LE(offset), type=data.readUInt32LE(offset+4);
    offset+=8;
    assert.ok(offset+length<=data.length,file+' must not contain a truncated chunk');
    if(type===0x4e4f534a) return JSON.parse(data.toString('utf8',offset,offset+length).replace(/\0+$/g,'').trim());
    offset+=length;
  }
  throw new Error(file+' has no JSON glTF chunk');
}
for(const model of models) {
  const doc=readGlb(model.file);
  const primitives=(doc.meshes||[]).flatMap(mesh=>mesh.primitives||[]);
  assert.ok((doc.skins||[]).length,model.file+' must contain a humanoid skin');
  assert.ok(primitives.some(p=>p.attributes?.JOINTS_0!==undefined&&p.attributes?.WEIGHTS_0!==undefined),model.file+' must contain a skinned human mesh');
  assert.ok((doc.materials||[]).length>=10,model.file+' must contain detailed character materials');
  assert.ok((doc.textures||[]).length&&(doc.images||[]).length,model.file+' must contain embedded texture maps');
  const nodes=(doc.nodes||[]).map(node=>normalize(node.name));
  assert.ok(nodes.includes('head'),model.file+' must contain a named head bone');
  assert.ok(nodes.includes('jaw'),model.file+' must contain a named jaw bone');
  assert.ok(nodes.some(name=>name.includes('eye')),model.file+' must contain facial eye bones');
  const clips=(doc.animations||[]).map(clip=>normalize(clip.name));
  for(const required of model.clips) assert.ok(clips.includes(required),model.file+' is missing animation clip '+required);
  console.log(model.file+': '+(fs.statSync(model.file).size/1048576).toFixed(2)+' MB; '+clips.length+' clips; skinned mesh, face rig and textures verified.');
}
console.log('Penalty GLB human-character asset validation passed.');
