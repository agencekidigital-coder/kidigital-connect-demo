const {test}=require('node:test');
const assert=require('node:assert/strict');
const {coverPath,dimensions}=require('../assets/pro-workshops.js');
test('private cover path is bound to owner and workshop UUIDs',()=>{
 const owner='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
 assert.equal(coverPath(owner,id),owner+'/'+id+'.jpg');
 for(const value of ['../other','/file.jpg','a/b','',null])assert.throws(()=>coverPath(owner,value));
 assert.throws(()=>coverPath('../other',id));
});
test('compression dimensions preserve proportions and never enlarge',()=>{
 assert.deepEqual(dimensions(3200,1600),[1600,800]);
 assert.deepEqual(dimensions(800,1200),[800,1200]);
 assert.deepEqual(dimensions(1000,4000),[400,1600]);
 assert.throws(()=>dimensions(10000,10000));
 assert.throws(()=>dimensions(0,1));
});

const {cropRect}=require('../assets/pro-workshops.js');
test('16:9 crop respects zoom and positioning',()=>{
 assert.deepEqual(cropRect(1600,900),[0,0,1600,900]);
 assert.deepEqual(cropRect(1600,1600,1,50,0),[0,0,1600,900]);
 assert.deepEqual(cropRect(1600,1600,1,50,100),[0,700,1600,900]);
 assert.deepEqual(cropRect(1600,900,2,100,100),[800,450,800,450]);
});
test('baby reflexology categories are selectable',()=>{const {categories}=require('../assets/platform-tools.js');for(const label of ['Réflexologie plantaire bébé','Réflexologie émotionnelle bébé'])assert(categories['Premiers mois avec bébé'].includes(label));});
