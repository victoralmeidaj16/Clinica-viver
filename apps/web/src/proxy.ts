import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readSessionValue } from '@/server/auth';

// A sessão completa é validada no servidor em cada API. O proxy evita entregar
// páginas internas para visitantes sem cookie; a autorização por perfil
// continua no LayoutShell e, principalmente, nas APIs.
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicPage = pathname === '/' || pathname === '/login' || pathname === '/ativar-conta' || pathname === '/vitrine' || pathname.startsWith('/_next') || pathname.startsWith('/api/auth');
  if (publicPage || pathname.startsWith('/api/')) return NextResponse.next();
  // No Vercel the domínio público é apenas um proxy para a VM OCI. A sessão
  // é assinada e validada pelo backend da VM; tentar validá-la novamente com
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
  const professionalPage = ['/cockpit', '/pacientes', '/prontuarios', '/meu-financeiro', '/agenda', '/avaliacoes', '/sessao'].some((prefix) => pathname.startsWith(prefix));
  const allowed = session.role === 'admin' ? adminPage : professionalPage;
  if (!allowed) return NextResponse.redirect(new URL(session.role === 'admin' ? '/gestao/cockpit' : '/cockpit', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!favicon.ico).*)'] };
