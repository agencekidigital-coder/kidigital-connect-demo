const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {periodBounds,phoneValue}=require('../assets/pro-families.js');
const {mappingFor,prepareRows,amountCents,activityDate}=require('../assets/family-import.js');
const XLSX=require('xlsx');
const cells=(...values)=>values.map(value=>({value,formula:false,truncated:false}));
test('CRM periods use local calendar dates and exclusive end date',()=>{
 const now=new Date(2026,10,27,13);
 assert.deepEqual(periodBounds('week','','',now),['2026-11-23','2026-11-30']);
 assert.deepEqual(periodBounds('month','','',now),['2026-11-01','2026-12-01']);
 assert.deepEqual(periodBounds('year','','',now),['2026-01-01','2026-11-28']);
 assert.deepEqual(periodBounds('custom','2026-12-31','2027-01-01',now),['2026-12-31','2027-01-02']);
 assert.throws(()=>periodBounds('custom','2026-02-30','2026-03-01',now));
 assert.throws(()=>periodBounds('custom','2026-12-31','2026-01-01',now));
});
test('Import maps headers, detects existing and internal duplicates, rejects invalid or real beta addresses',()=>{
 const matrix=[cells('Prénom','Nom','E-mail','Téléphone','Notes'),cells('Élodie','Test','elodie@example.invalid','0600000000','non importée'),cells('Élodie','Test','ELODIE@example.invalid','0600000000',''),cells('Camille','Test','camille@example.invalid','0600000001',''),cells('Contact','Réel','real@example.com','0600000000',''),cells('Sans','Email','','',''),cells('Formule','Test','f@example.invalid','0600000000','')];matrix[6][2].formula=true;
 const map=mappingFor(matrix[0].map(x=>x.value));assert.equal(map.notes,null);assert.equal(map.email,2);assert.equal(map.phone,3);
 const result=prepareRows(matrix,map,phoneValue,['camille@example.invalid']);
 assert.equal(result.filter(r=>!r.reason).length,1);assert.equal(result.filter(r=>r.duplicate).length,2);assert.equal(result.filter(r=>r.reason&&!r.duplicate).length,3);
 assert.equal(result[0].contact.notes,null);assert.equal(result[0].contact.phone,'+33600000000');
});
function parse(buffer,extension){
 let result;const self={postMessage(v){result=v;}};
 const source=fs.readFileSync(path.join(__dirname,'../assets/family-import-worker.js'),'utf8');
 new Function('self','XLSX','importScripts','TextDecoder',source)(self,XLSX,()=>{},TextDecoder);
 self.onmessage({data:{buffer,extension}});return result;
}
test('Actual workbook fixtures: XLSX, legacy XLS, and French CSV preserve contact fields',()=>{
 const data=[['Prénom','Nom','Email','Téléphone'],['Élodie','Dupont','elodie@example.invalid','0600000001']];
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(data),'Contacts');
 for(const [extension,bookType] of [['xlsx','xlsx'],['xls','biff8']]){
  const buffer=XLSX.write(book,{type:'array',bookType});const result=parse(buffer,extension);assert.equal(result.error,undefined,result.error);
  assert.equal(result.data[1][0].value,'Élodie');assert.equal(result.data[1][3].value,'0600000001');
 }
 const csv=new TextEncoder().encode('Prénom;Nom;Email;Téléphone\r\nÉlodie;Dupont;elodie@example.invalid;0600000001\r\n').buffer;
 const parsed=parse(csv,'csv');assert.equal(parsed.error,undefined,parsed.error);assert.equal(parsed.data[1][3].value,'0600000001');
});
test('Invalid and oversized files are refused',()=>{
 const wrong=new Uint8Array([1,2,3]).buffer;assert.match(parse(wrong,'xlsx').error,/XLSX/);
 const data=[['Email'],...Array.from({length:501},(_,i)=>[i+'@example.invalid'])];
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(data),'Contacts');
 const res=parse(XLSX.write(book,{type:'array',bookType:'xlsx'}),'xlsx');assert.match(res.error,/Maximum 500/);
});

test('Imported revenue, labels and dates are mapped, and existing families may be enriched once',()=>{
 const matrix=[cells('Prénom','Nom','Email','Chiffre d’affaires','Atelier','Accompagnement','Date'),cells('Élodie','Test','elodie@example.invalid','1 234,50 €','Massage bébé','Soutien post-partum','01/11/2026')];
 const map=mappingFor(matrix[0].map(x=>x.value));const r=prepareRows(matrix,map,phoneValue,[{email:'elodie@example.invalid',has_history:false}])[0];
 assert.equal(r.reason,'');assert.equal(r.enrich,true);assert.equal(r.contact.amount_cents,123450);assert.equal(r.contact.workshop_label,'Massage bébé');assert.equal(r.contact.accompaniment_label,'Soutien post-partum');assert.equal(r.contact.activity_date,'2026-11-01');
 assert(prepareRows(matrix,map,phoneValue,[{email:'elodie@example.invalid',has_history:true}])[0].duplicate);
 assert.equal(amountCents('',null),null);assert.equal(amountCents('120,50 €',120.5),12050);assert.equal(amountCents('0'),0);assert.throws(()=>amountCents('-12'));assert.throws(()=>amountCents('12,345'));assert.throws(()=>activityDate('31/02/2026'));
});
