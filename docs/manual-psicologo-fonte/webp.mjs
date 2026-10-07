import {createRequire} from 'node:module';
const req=createRequire('/Users/victoralmeidaj16/Downloads/Clinica Viver Mais/package.json');
const sharp=req('sharp'); import fs from 'node:fs';
const out=process.argv[2];
const names=['login','menu','painel-topo','painel-sessoes','cad-topo','cad-base','agenda-grade','agenda-bloqueios','agenda-calendario','agenda-link','pacientes-card','agendar-topo','agendar-base','agenda-sessoes','pront-topo','pront-form','docs','financeiro','header','sino'];
for(const n of names){ const i=await sharp(`shots/${n}.png`).metadata(); await sharp(`shots/${n}.png`).webp({quality:82}).toFile(`${out}/${n}.webp`); console.log(n,i.width,i.height); }
