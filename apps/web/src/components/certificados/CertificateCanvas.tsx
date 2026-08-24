'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  renderCertificateText,
  type CertificateField,
  type CertificateRecord,
  type CertificateTemplate,
} from '@thats-life/core';

const PREVIEW_SAMPLE: Pick<
  CertificateRecord,
  'studentName' | 'courseTitle' | 'durationHours' | 'issueDate' | 'startDate' | 'completionDate' | 'code' | 'validationUrl'
> = {
  studentName: 'Maria Eduarda da Silva',
  courseTitle: 'Transtornos de Ansiedade na Clínica',
  startDate: '2025-03-10',
  completionDate: '2026-06-24',
  issueDate: '24 de junho de 2026',
  durationHours: '40h',
  code: 'PREVIEW',
  validationUrl: 'www.vivermaispsicologia.com.br',
};

function fieldText(
  field: CertificateField,
  data: Partial<CertificateRecord> | undefined,
  settings: CertificateTemplate
): string {
  const merged = {
    studentName: data?.studentName || PREVIEW_SAMPLE.studentName,
    courseTitle: data?.courseTitle || PREVIEW_SAMPLE.courseTitle,
    startDate: data?.startDate || PREVIEW_SAMPLE.startDate,
    completionDate: data?.completionDate || PREVIEW_SAMPLE.completionDate,
    issueDate: data?.issueDate || PREVIEW_SAMPLE.issueDate,
    durationHours: data?.durationHours || PREVIEW_SAMPLE.durationHours,
    code: data?.code || PREVIEW_SAMPLE.code,
    validationUrl: data?.validationUrl || PREVIEW_SAMPLE.validationUrl,
  };

  const raw = renderCertificateText(field.text, merged, settings);
  return field.uppercase ? raw.toUpperCase() : raw;
}

interface Props {
  template: CertificateTemplate;
  page?: 1 | 2;
  data?: Partial<CertificateRecord>;
  selectedKey?: string | null;
  onFieldDrag?: (id: string, xPct: number, yPct: number) => void;
  onSelectField?: (id: string) => void;
}

export function CertificateCanvas({
  template,
  page = 1,
  data,
  selectedKey,
  onFieldDrag,
  onSelectField,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(template.widthPx || 1123);
  const dragging = useRef<string | null>(null);
  const editable = Boolean(onFieldDrag);

  const backgroundUrl =
    page === 2
      ? template.secondBackgroundUrl || (template.backgroundType === 'pdf' ? template.backgroundUrl : '')
      : template.backgroundUrl;
  const backgroundType =
    page === 2
      ? template.secondBackgroundType || template.backgroundType
      : template.backgroundType;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const pxFor = (pct: number) => (pct / 100) * width;

  const handlePointerMove = (e: React.PointerEvent) => {
    const key = dragging.current;
    if (!key || !onFieldDrag || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    onFieldDrag(
      key,
      Math.min(100, Math.max(0, Number(xPct.toFixed(2)))),
      Math.min(100, Math.max(0, Number(yPct.toFixed(2))))
    );
  };

  return (
    <div
      ref={ref}
      className="relative mx-auto w-full select-none overflow-hidden rounded-2xl bg-white shadow-card border border-psi-soft/50"
      style={{ aspectRatio: `${template.widthPx || 1123} / ${template.heightPx || 794}` }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        dragging.current = null;
      }}
      onPointerLeave={() => {
        dragging.current = null;
      }}
    >
      {backgroundUrl ? (
        backgroundType === 'pdf' ? (
          <iframe
            src={`${backgroundUrl}#page=${page}`}
            title={`Arte em PDF - página ${page}`}
            className="pointer-events-none absolute inset-0 h-full w-full border-0"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={backgroundUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        )
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-psi-soft/20 text-xs font-semibold text-muted">
          Sem arte de fundo definida para a página {page}
        </div>
      )}

      {template.fields
        .filter((f) => (f.page ?? 1) === page)
        .map((f) => {
          const selected = editable && selectedKey === f.id;
          return (
            <div
              key={f.id}
              onPointerDown={(e) => {
                if (!editable) return;
                e.preventDefault();
                dragging.current = f.id;
                onSelectField?.(f.id);
              }}
              className="absolute whitespace-pre-line leading-tight"
              style={{
                left: `${f.xPct}%`,
                top: `${f.yPct}%`,
                transform: 'translate(-50%, -50%)',
                textAlign: f.align,
                color: f.color,
                fontWeight: f.fontWeight,
                fontSize: pxFor(f.fontPct),
                cursor: editable ? 'move' : 'default',
                padding: editable ? '3px 8px' : 0,
                borderRadius: 8,
                outline: selected
                  ? '2px solid #5C397D'
                  : editable
                  ? '1px dashed rgba(92,57,125,.5)'
                  : 'none',
                background: editable ? 'rgba(255,255,255,.6)' : 'transparent',
              }}
            >
              {fieldText(f, data, template)}
            </div>
          );
        })}
    </div>
  );
}
