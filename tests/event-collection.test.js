import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { readEvents } from '../lib/content.js';
test('canonical collection preserves migrated events and stable URLs',()=>{
  const events=readEvents();
  assert.deepEqual(events.map(e=>e.slug).sort(),['christmas-songs','community-lunch','saturday-walk']);
  assert.equal(events.length,new Set(events.map(e=>e.slug)).size);
  assert.equal(events.every(e=>e.published && e.title.zh && e.title.en),true);
});
test('empty collections are valid; malformed versions, duplicates and invalid events fail the build',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pcbc-events-'));
  const file=path.join(dir,'events.yml');
  try {
    const event=readEvents()[0];
    for(const value of [{version:2,items:[]},{version:1,items:[event,event]},{version:1,items:[{slug:'invalid'}]},{version:1,items:[],extra:true}]){
      fs.writeFileSync(file,yaml.dump(value));assert.throws(()=>readEvents(file));
    }
    fs.writeFileSync(file,yaml.dump({version:1,items:[]}));assert.deepEqual(readEvents(file),[]);
  } finally {fs.rmSync(dir,{recursive:true});}
});
