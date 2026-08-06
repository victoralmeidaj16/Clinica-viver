'use client';
import { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Circle, Plus, Target } from 'lucide-react';
import { addCareTask, completeCareTask, recordMoodCheckIn, type CareAlert, type CarePlan, type MoodCheckIn } from '@thats-life/core';
import { demoCarePlans, patientNames } from '../scheduling/demoScheduling';

export function CarePlanWorkspace() {
  const [plans, setPlans] = useState(demoCarePlans);
  const [selected, setSelected] = useState(plans[0].id);
  const [alerts, setAlerts] = useState<CareAlert[]>([]);
  const [moods, setMoods] = useState<MoodCheckIn[]>([]);

  const plan = plans.length > 0 ? (plans.find((item) => item.id === selected) ?? plans[0]) : null;
  const update = (change: (current: CarePlan) => CarePlan) => {
    if (!plan) return;
    setPlans((items) => items.map((item) => (item.id === plan.id ? change(item) : item)));
  };

  const addTask = () => {
    if (!plan) return;
    update((current) =>
      addCareTask(
        current,
        { id: `task-demo-${current.tasks.length + 1}`, title: 'Realizar uma pausa consciente durante a tarde', dueAt: '2026-08-07T23:59:00.000Z' },
        '2026-07-31T18:00:00.000Z'
      )
    );
  };

  const addMood = (level: 1 | 2 | 3 | 4 | 5) => {
    if (!plan) return;
    const result = recordMoodCheckIn({
      id: `mood-demo-${moods.length + 1}`,
      organizationId: 'org-demo',
      patientId: plan.patientId,
      recordedAt: '2026-07-31T18:00:00.000Z',
      level,
      emotions: level <= 2 ? ['cansaço'] : ['tranquilidade'],
    });
    setMoods((items) => [result.checkIn, ...items]);
    if (result.alert) setAlerts((items) => [result.alert!, ...items]);
  };

  const completed = plan ? plan.tasks.filter((task) => task.status === 'completed').length : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header className="rounded-2xl border border-psi-soft bg-psi-darkest p-8 text-white shadow-contrast">
        <p className="text-[11px] font-black uppercase tracking-[.24em] text-psi-vibrant">Acompanhamento compartilhável</p>
        <h1 className="mt-3 font-bold text-3xl">Pequenos passos, visíveis no tempo.</h1>
        <p className="mt-2 max-w-2xl text-xs text-psi-soft/80">
          Metas, tarefas e humor demonstrativos. Nenhum campo do prontuário aparece nesta área.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {plans.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item.id)}
            className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              item.id === plan?.id ? 'bg-psi-deep text-white shadow-sm' : 'border border-psi-soft bg-white text-muted hover:bg-psi-light'
            }`}
          >
            {patientNames[item.patientId]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-psi-soft bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-psi-deep">Plano ativo</p>
                <h2 className="mt-1 text-xl font-bold text-ink">Metas terapêuticas</h2>
              </div>
              <Target className="h-6 w-6 text-psi-deep" />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {plan?.goals?.map((goal) => (
                <div key={goal.id} className="rounded-xl bg-psi-light/60 p-4 border border-psi-soft/50">
                  <p className="font-bold text-ink text-sm">{goal.title}</p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-psi-vibrant">Em acompanhamento</p>
                </div>
              )) ?? <p className="text-xs text-muted col-span-2">Nenhum plano de cuidado selecionado.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-psi-soft bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-ink">Tarefas no app</h2>
                <p className="text-xs text-muted">
                  {completed} de {plan?.tasks?.length ?? 0} concluídas
                </p>
              </div>
              <button onClick={addTask} disabled={!plan} className="btn-outline px-3 py-2 text-xs disabled:opacity-50">
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
            <div className="mt-5 space-y-2">
              {plan?.tasks?.map((task) => (
                <button
                  disabled={task.status !== 'pending'}
                  onClick={() => update((current) => completeCareTask(current, task.id, '2026-07-31T18:01:00.000Z'))}
                  key={task.id}
                  className="flex w-full items-center gap-3 rounded-xl border border-psi-soft p-3 text-left disabled:opacity-60 hover:bg-psi-light/30 transition-colors"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5 text-psi-deep shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted shrink-0" />
                  )}
                  <span className={`text-xs font-medium ${task.status === 'completed' ? 'line-through text-muted' : 'text-ink'}`}>
                    {task.title}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-psi-darkest p-6 text-white shadow-contrast">
            <Activity className="h-5 w-5 text-psi-vibrant" />
            <h2 className="mt-4 text-xl font-bold">Check-in de humor</h2>
            <p className="mt-1 text-xs text-psi-soft/70">Simule um registro enviado pelo paciente.</p>
            <div className="mt-5 flex justify-between">
              {([1, 2, 3, 4, 5] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => addMood(level)}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-sm font-bold hover:bg-psi-vibrant hover:text-white transition-colors"
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[10px] text-psi-soft/50">1 muito baixo · 5 muito bem</p>
          </section>

          {alerts.length > 0 && (
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <AlertTriangle className="h-5 w-5 text-rose-700" />
              <h3 className="mt-3 font-bold text-rose-950 text-sm">Revisão humana necessária</h3>
              <p className="mt-1 text-xs text-rose-800">Humor muito baixo registrado. Nenhuma conduta foi automatizada.</p>
            </section>
          )}

          <section className="rounded-2xl border border-psi-soft bg-white p-5 shadow-card">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Registros recentes</p>
            <p className="mt-3 text-3xl font-bold text-ink">{moods.length}</p>
            <p className="text-xs text-muted">check-ins nesta demonstração</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
