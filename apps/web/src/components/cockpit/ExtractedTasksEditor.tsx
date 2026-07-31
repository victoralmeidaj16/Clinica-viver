'use client';

import { useState } from 'react';
import { Plus, Smartphone, Trash2 } from 'lucide-react';

interface ExtractedTasksEditorProps {
  tasks: readonly string[];
  onAdd: (task: string) => void;
  onRemove: (index: number) => void;
}

export default function ExtractedTasksEditor({
  tasks,
  onAdd,
  onRemove,
}: ExtractedTasksEditorProps) {
  const [newTask, setNewTask] = useState('');

  const handleAdd = () => {
    const normalizedTask = newTask.trim();
    if (!normalizedTask) return;
    onAdd(normalizedTask);
    setNewTask('');
  };

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-canvas/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-capri" />
          <h3 className="text-xs font-bold text-ink">Tarefas sugeridas pela IA</h3>
        </div>
        <span className="text-[11px] text-muted">{tasks.length} atividades</span>
      </div>

      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div
            key={`${task}-${index}`}
            className="flex items-center justify-between rounded-xl border border-line bg-white p-2.5 text-xs"
          >
            <span className="font-medium text-ink">{task}</span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-1 text-muted transition-colors hover:text-coral"
              aria-label={`Remover tarefa: ${task}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newTask}
          onChange={(event) => setNewTask(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleAdd();
          }}
          placeholder="Adicionar tarefa terapêutica personalizada..."
          className="input py-2 text-xs"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="btn-outline px-3 py-2 text-xs"
          aria-label="Adicionar tarefa"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
