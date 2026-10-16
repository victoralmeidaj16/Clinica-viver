import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { BookingReceipt } from './BookingReceipt';
it('mantém o protocolo e explica a falha sem afirmar entrega', () => {
  const html = renderToStaticMarkup(<BookingReceipt protocolo="VM-123456" whatsappEnviado={false} />);
  expect(html).toContain('VM-123456');
  expect(html).toContain('não conseguimos confirmar o envio');
  expect(html).not.toContain('foi enviado');
});
it('distingue acolhimento de orientações após confirmação', () => {
  const html = renderToStaticMarkup(<BookingReceipt whatsappEnviado />);
  expect(html).toContain('aviso de recebimento foi enviado');
  expect(html).toContain('após a confirmação do profissional');
});
