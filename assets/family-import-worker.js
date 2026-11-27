/* Local-only spreadsheet parser. No data leaves this worker until the user confirms the mapped import. */
'use strict';
importScripts('/assets/vendor/xlsx.full.min.js');
const MAX_BYTES=5*1024*1024,MAX_ROWS=501,MAX_COLS=64;
function zipBounds(buffer){
 const view=new DataView(buffer);let end=-1;
 for(let p=buffer.byteLength-22;p>=Math.max(0,buffer.byteLength-65557);p--)if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===buffer.byteLength){end=p;break;}
 if(end<0)throw Error('Classeur XLSX invalide.');
 const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true),size=view.getUint32(end+12,true);
 if(count>1000||offset+size>end)throw Error('Classeur trop complexe.');
 let p=offset,total=0;
 for(let i=0;i<count;i++){if(p+46>offset+size||view.getUint32(p,true)!==0x02014b50)throw Error('Classeur invalide.');total+=view.getUint32(p+24,true);if(total>40*1024*1024)throw Error('Classeur décompressé trop volumineux.');p+=46+view.getUint16(p+28,true)+view.getUint16(p+30,true)+view.getUint16(p+32,true);}
}
self.onmessage=e=>{
 try{
  const {buffer,extension}=e.data;
  if(!(buffer instanceof ArrayBuffer)||!buffer.byteLength||buffer.byteLength>MAX_BYTES||!['csv','xlsx','xls'].includes(extension))throw Error('Fichier invalide ou supérieur à 5 Mo.');
  let source=buffer,options={type:'array',sheetRows:MAX_ROWS+1,sheets:0,cellFormula:true,cellHTML:false,cellStyles:false,cellText:true,raw:true};
  const bytes=new Uint8Array(buffer);
  if(extension==='xlsx'){if(bytes[0]!==0x50||bytes[1]!==0x4b)throw Error('Format XLSX invalide.');zipBounds(buffer);}
  if(extension==='xls'&&!(bytes[0]===0xd0&&bytes[1]===0xcf&&bytes[2]===0x11&&bytes[3]===0xe0))throw Error('Format XLS non reconnu. Enregistre-le en XLSX ou CSV.');
  if(extension==='csv'){
   try{source=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}catch{source=new TextDecoder('windows-1252').decode(buffer);}
   if(source.includes('\u0000'))throw Error('Encodage CSV non pris en charge. Enregistre-le en CSV UTF-8.');options={...options,type:'string'};
  }
  const book=XLSX.read(source,options),sheetName=book.SheetNames[0],sheet=book.Sheets[sheetName];
  if(!sheet||!sheet['!ref'])throw Error('Le premier onglet est vide.');
  const full=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']);
  if(full.e.r-full.s.r+1>MAX_ROWS||full.e.c-full.s.c+1>MAX_COLS)throw Error('Maximum 500 contacts + une ligne de titres et 64 colonnes par fichier.');
  const range=XLSX.utils.decode_range(sheet['!ref']),data=[];
  for(let r=range.s.r;r<=range.e.r;r++){
   const row=[];for(let c=range.s.c;c<=range.e.c;c++){
    const cell=sheet[XLSX.utils.encode_cell({r,c})];const formula=!!cell?.f;const value=cell?String(cell.w??cell.v??''):'';
    row.push({value:value.slice(0,2001),formula,truncated:value.length>2000});
   }
   if(data.length===0||row.some(cell=>cell.value.trim()||cell.formula))data.push(row);
  }
  if(data.length<2)throw Error('Ajoute une ligne de titres et au moins un contact.');
  self.postMessage({data,sheetName,sheetCount:book.SheetNames.length});
 }catch(err){self.postMessage({error:err?.message&&err.message.length<180?err.message:'Impossible de lire ce fichier. Vérifie son format.'});}
};
