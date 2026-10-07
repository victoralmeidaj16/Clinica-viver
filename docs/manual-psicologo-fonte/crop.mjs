import {createRequire} from 'node:module';
const sharp=createRequire('/Users/victoralmeidaj16/Downloads/Clinica Viver Mais/package.json')('sharp');
const out=process.argv[2];
const cortes={'cad-topo':[0,22],'cad-base':[70,0],'agendar-topo':[16,20],'agendar-base':[16,20]}; // [topo, base] em px
for(const [n,[t,b]] of Object.entries(cortes)){
  const m=await sharp(`shots/${n}.png`).metadata();
  await sharp(`shots/${n}.png`).extract({left:0,top:t,width:m.width,height:m.height-t-b}).webp({quality:82}).toFile(`${out}/${n}.webp`);
  console.log(n,m.width,m.height-t-b);
}
