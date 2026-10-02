import { documentDateLabel, type PsychologicalDocumentContent } from '@thats-life/core';

export function DocumentPreview({ content }: { content: PsychologicalDocumentContent }) {
  return (
    <article aria-label="Prévia do documento" className="border border-gray-200 bg-white p-5 sm:p-10 shadow-sm text-gray-900 break-words [overflow-wrap:anywhere]">
      <header className="border-b border-gray-200 pb-5 text-center">
        <p className="text-sm font-semibold">{content.organizationName}</p>
        {content.demo && <p className="mt-3 text-xs font-bold text-amber-800">DEMONSTRAÇÃO - SEM VALIDADE CLÍNICA</p>}
        <h2 className="mt-5 text-base font-bold uppercase">{content.title}</h2>
      </header>
      <div className="space-y-6 py-8 text-sm leading-7">
        {content.sections.map((section, index) => (
          <section key={index}>
            {section.heading && <h3 className="mb-2 font-bold">{section.heading}</h3>}
            <p className="whitespace-pre-wrap">{section.text}</p>
          </section>
        ))}
      </div>
      <p className="text-right text-sm">{content.location}, {documentDateLabel(content.date)}.</p>
      <footer className="mx-auto mt-16 max-w-sm border-t border-gray-500 pt-3 text-center text-sm">
        <p>{content.professionalName}</p><p>Psicóloga(o) - CRP {content.crp}</p>
      </footer>
    </article>
  );
}
