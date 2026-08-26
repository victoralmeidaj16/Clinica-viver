import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { readSessionValue } from '@/server/auth';

// A sessão completa é validada no servidor em cada API. O proxy evita entregar
// páginas internas para visitantes sem cookie; a autorização por perfil
// continua no LayoutShell e, principalmente, nas APIs.
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const persistentApi = [
    '/api/application/',
    '/api/auth/',
    '/api/infra/',
    '/api/pagamento/',
    '/api/agenda/',
    '/api/financeiro/asaas/',
    '/api/certificados/',
    '/api/public/certificados/',
  ].some((prefix) => pathname.startsWith(prefix));

  if (process.env.VERCEL && persistentApi) {
    const backendOrigin =
      process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, '') ||
      'https://app.clinicavivermais.cloud';
    const destination = new URL(`${pathname}${request.nextUrl.search}`, backendOrigin);
    return NextResponse.rewrite(destination);
  }

  // `/agendar/` é o link de marcação do psicólogo e `/pagar/sessao/` é a
  // cobrança de um agendamento específico: quem abre os dois é o paciente, que
  // não tem sessão na plataforma, e é esse o ponto. Sem estar aqui, a VPS
  // redireciona para o login quem abre o link — a Vercel não mostrava o
  // problema porque devolve `next()` antes desta checagem.
  const publicPage =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/ativar-conta' ||
    pathname === '/redefinir-senha' ||
    pathname === '/vitrine' ||
    pathname.startsWith('/pagar/') ||
    pathname.startsWith('/agendar/') ||
    pathname.startsWith('/confirmar-contato/') ||
    // `/validar-certificado` é o endereço impresso no certificado: quem o abre
    // é quem recebeu o documento, sem conta na clínica. Mandá-lo ao login seria
    // transformar a conferência em obstáculo. (O `/validar` das declarações de
    // horas saiu junto com o código de conferência do relatório de estágio.)
    pathname === '/validar-certificado' ||
    pathname.startsWith('/validar-certificado/') ||
    pathname === '/painel-certificados' ||
    pathname.startsWith('/painel-certificados/') ||
    pathname.startsWith('/previa-doc') ||
    pathname.startsWith('/_next') ||
    // Arquivos de `public/` são servidos na raiz e caem neste matcher. Sem
    // esta linha, a VPS mandava a logo e as fotos da vitrine para o login: a
    // resposta ao `<img>` virava um 307, e a página pública abria com as
    // imagens quebradas. A lista é fechada, e não um `.qualquer-coisa`, para
    // que nenhuma rota da aplicação passe por engano — o que é sigiloso não
    // mora em `public/`, mas a trava aqui não depende disso.
    /\.(png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|txt|xml|webmanifest)$/i.test(pathname) ||
    pathname.startsWith('/api/auth');
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
  const adminPage = ['/gestao', '/relatorios', '/convenios', '/configuracoes', '/linha-do-tempo'].some((prefix) => pathname.startsWith(prefix));
  // `/meu-cadastro` é o destino do fluxo de ativação de conta: sem estar nesta
  // lista, o psicólogo que acabava de definir a senha era redirecionado para
  // `/cockpit` no exato momento em que deveria ver o próprio perfil.
  const professionalPage = ['/cockpit', '/pacientes', '/meu-financeiro', '/agenda', '/sessao', '/meu-cadastro', '/linha-do-tempo', '/relatorios'].some((prefix) => pathname.startsWith(prefix));
  const allowed = session.role === 'admin' ? adminPage : professionalPage;
  if (!allowed) return NextResponse.redirect(new URL(session.role === 'admin' ? '/gestao/cockpit' : '/cockpit', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!favicon.ico).*)'] };
