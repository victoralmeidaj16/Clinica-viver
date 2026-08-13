import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readSessionValue } from '@/server/auth';

// A sessão completa é validada no servidor em cada API. O proxy evita entregar
// páginas internas para visitantes sem cookie; a autorização por perfil
// continua no LayoutShell e, principalmente, nas APIs.
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const persistentApi = ['/api/application/', '/api/auth/', '/api/infra/'].some(
    (prefix) => pathname.startsWith(prefix)
  );

  if (process.env.VERCEL && persistentApi) {
    const backendOrigin =
      process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, '') ||
      'https://app.clinicavivermais.cloud';
    const destination = new URL(`${pathname}${request.nextUrl.search}`, backendOrigin);
    return NextResponse.rewrite(destination);
  }

  // `/pagar/` é o link permanente de cobrança: o paciente não tem sessão, e é
  // esse o ponto. Sem estar aqui, a VPS redireciona para o login quem recebeu
  // o link no WhatsApp — a Vercel não mostrava o problema porque devolve
  // `next()` antes desta checagem.
  const publicPage = pathname === '/' || pathname === '/login' || pathname === '/ativar-conta' || pathname === '/vitrine' || pathname.startsWith('/pagar/') || pathname.startsWith('/_next') || pathname.startsWith('/api/auth');
  if (publicPage || pathname.startsWith('/api/')) return NextResponse.next();
  // Na Vercel o domínio público é apenas um proxy para a VPS. A sessão é
  // assinada e validada pelo backend da VPS; tentar validá-la novamente com
  // o segredo local do Vercel faria páginas internas redirecionarem ao login,
  // mesmo quando `/api/auth/me` já confirma a sessão na origem.
  if (process.env.VERCEL) return NextResponse.next();
  const session = readSessionValue(request.cookies.get('viver_mais_session')?.value);
  if (!session) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }
  const adminPage = ['/gestao', '/relatorios', '/convenios', '/retencao', '/configuracoes'].some((prefix) => pathname.startsWith(prefix));
  // `/meu-cadastro` é o destino do fluxo de ativação de conta: sem estar nesta
  // lista, o psicólogo que acabava de definir a senha era redirecionado para
  // `/cockpit` no exato momento em que deveria ver o próprio perfil.
  const professionalPage = ['/cockpit', '/pacientes', '/meu-financeiro', '/agenda', '/sessao', '/meu-cadastro'].some((prefix) => pathname.startsWith(prefix));
  const allowed = session.role === 'admin' ? adminPage : professionalPage;
  if (!allowed) return NextResponse.redirect(new URL(session.role === 'admin' ? '/gestao/cockpit' : '/cockpit', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!favicon.ico).*)'] };
