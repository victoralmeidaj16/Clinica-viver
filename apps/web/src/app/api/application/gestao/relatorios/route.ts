import { NextResponse } from 'next/server';
import { exigirGestaoComAutor } from '@/server/application/autorGestao';
import { falhaGestao } from '@/server/application/respostaGestao';
import { ApplicationError } from '@/server/application/http';
import { montarRelatorio } from '@/server/reports/relatorios/relatoriosArea';
import { arquivoDoRelatorio } from '@/server/reports/relatorios/relatorioArquivo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPO = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

/**
 * Relatórios por área da Gestão (13.05): `area`, filtros da área e
 * `formato` (`json`, `xlsx` ou `pdf`). Só dados administrativos (13.03).
 */
export async function GET(request: Request) {
  try {
    const { sessao } = await exigirGestaoComAutor();
    const params = new URL(request.url).searchParams;
    const relatorio = await montarRelatorio(sessao.organizationId, params.get('area') ?? '', params);
    const formato = params.get('formato') ?? 'json';
    if (formato === 'json') {
      return NextResponse.json({ success: true, data: relatorio }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (formato !== 'xlsx' && formato !== 'pdf') throw new ApplicationError('INVALID_INPUT', 'Formato inválido.', 400);
    const arquivo = await arquivoDoRelatorio(relatorio, formato);
    const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    return new Response(new Uint8Array(arquivo), {
      headers: {
        'Content-Type': TIPO[formato],
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="relatorio-${relatorio.area.id}-${dia}.${formato}"`,
      },
    });
  } catch (error) {
    return falhaGestao(error, 'Erro ao gerar relatório', 'Falha ao gerar o relatório.');
  }
}
