import { FormEvent, MouseEvent, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Edit2, FolderKanban, Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import type { Project } from '../db/models';
import { deleteProjectCascade } from '../db/operations';
import { useStore } from '../store/useStore';
import { generateId } from '../utils/id';
import { analytics } from '../services/analytics';

export function Projects() {
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const activeProjectId = useStore((state) => state.activeProjectId);
  const setActiveProject = useStore((state) => state.setActiveProject);
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [objective, setObjective] = useState('');

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setObjective('');
  };

  const openCreate = () => {
    resetForm();
    setIsEditing(true);
  };

  const openEdit = (event: MouseEvent, project: Project) => {
    event.stopPropagation();
    setEditingId(project.id);
    setName(project.name);
    setDescription(project.productDescription);
    setObjective(project.validationObjective);
    setIsEditing(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      await db.projects.update(editingId, {
        name: name.trim(),
        productDescription: description.trim(),
        validationObjective: objective.trim(),
        updatedAt: Date.now(),
      });
      resetForm();
      return;
    }

    const newProject: Project = {
      id: generateId(),
      name: name.trim(),
      productDescription: description.trim(),
      validationObjective: objective.trim(),
      stage: 'idea',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.projects.add(newProject);
    analytics.track('project_created', { project_stage: 'idea' });
    setActiveProject(newProject.id);
    resetForm();
    navigate('/');
  };

  const handleDelete = async (event: MouseEvent, project: Project) => {
    event.stopPropagation();
    if (!window.confirm(`Delete “${project.name}” and all of its sources, evidence, hypotheses, and decisions? This cannot be undone.`)) return;
    await deleteProjectCascade(project.id);
    if (activeProjectId === project.id) setActiveProject(null);
  };

  const handleSelect = (id: string) => {
    setActiveProject(id);
    navigate('/');
  };

  return (
    <div className="page-shell max-w-5xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-description">Keep each validation effort separate so its evidence trail remains auditable.</p>
        </div>
        <button type="button" onClick={isEditing ? resetForm : openCreate} className={isEditing ? 'button-secondary' : 'button-primary'}>
          {isEditing ? <X size={18} /> : <Plus size={18} />}
          {isEditing ? 'Cancel' : 'New Project'}
        </button>
      </header>

      {isEditing ? (
        <section className="panel p-5 sm:p-6">
          <h2 className="text-lg font-bold text-surface-950">{editingId ? 'Edit project' : 'Create project'}</h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label>
              <span className="field-label">Project name</span>
              <input required value={name} onChange={(event) => setName(event.target.value)} className="field-control" placeholder="e.g. Validation Ledger" autoFocus />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="field-label">Product description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} className="field-control min-h-28 resize-y" placeholder="What are you building, and for whom?" />
              </label>
              <label>
                <span className="field-label">Validation objective</span>
                <textarea value={objective} onChange={(event) => setObjective(event.target.value)} className="field-control min-h-28 resize-y" placeholder="What uncertainty are you trying to reduce?" />
              </label>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="button-primary">{editingId ? 'Save Changes' : 'Create Project'}</button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => {
          const isActive = activeProjectId === project.id;
          return (
            <article key={project.id} className={`panel group relative transition-all hover:-translate-y-0.5 hover:shadow-md ${isActive ? 'border-primary-300 ring-2 ring-primary-100' : ''}`}>
              <button type="button" onClick={() => handleSelect(project.id)} className="block w-full p-5 text-left sm:p-6">
                <div className="flex items-start gap-4 pr-16">
                  <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-primary-700 text-white' : 'bg-surface-100 text-surface-600'}`}>
                    <FolderKanban size={21} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-bold text-surface-950">{project.name}</span>
                    <span className="mt-2 line-clamp-2 block text-sm leading-6 text-surface-500">{project.productDescription || 'No product description yet.'}</span>
                    <span className="mt-4 block text-xs font-medium text-surface-500">Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </span>
                </div>
              </button>
              <div className="absolute right-3 top-3 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button type="button" onClick={(event) => openEdit(event, project)} className="icon-button hover:bg-primary-50 hover:text-primary-700" aria-label={`Edit ${project.name}`}><Edit2 size={16} /></button>
                <button type="button" onClick={(event) => void handleDelete(event, project)} className="icon-button hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${project.name}`}><Trash2 size={16} /></button>
              </div>
            </article>
          );
        })}
        {projects.length === 0 ? (
          <div className="panel col-span-full border-dashed px-6 py-14 text-center">
            <FolderKanban className="mx-auto text-surface-300" size={38} />
            <p className="mt-3 font-semibold text-surface-800">No validation projects yet</p>
            <p className="mt-1 text-sm text-surface-500">Create one to start building an evidence trail.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
