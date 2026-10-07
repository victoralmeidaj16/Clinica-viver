import { chromium } from 'playwright-core';
export const BASE='http://localhost:3100';
export async function open(vp={width:1366,height:820}) {
  const b = await chromium.launch({executablePath:process.env.HOME+'/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
  const ctx = await b.newContext({viewport:vp, deviceScaleFactor:2, timezoneId:'America/Sao_Paulo', locale:'pt-BR'});
  const p = await ctx.newPage();
  return {b,ctx,p};
}
export async function login(p){
  await p.goto(BASE+'/login',{waitUntil:'networkidle',timeout:120000});
  await p.fill('input[type=email],input[name=email]','manual@exemplo.test');
  await p.fill('input[type=password]','manual-local-1');
  await Promise.all([p.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:120000}), p.click('button[type=submit]')]);
}
export async function clean(p){ await p.addStyleTag({content:'nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}'}); }
