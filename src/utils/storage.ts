import { BackgroundPattern, WhiteboardProject } from '../types/whiteboard';
import { generateProjectThumbnail } from './exportUtils';

const PROJECTS_KEY = 'smart_whiteboard_projects_v1';
const ACTIVE_ID_KEY = 'smart_whiteboard_active_project_v1';

export function createId(prefix = 'obj'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankProject(
  title = 'Untitled Whiteboard',
  backgroundColor = '#FFFFFF',
  backgroundPattern: BackgroundPattern = 'dots'
): WhiteboardProject {
  const now = Date.now();
  return {
    id: createId('proj'),
    title,
    createdAt: now,
    updatedAt: now,
    backgroundColor,
    backgroundPattern,
    objects: [],
  };
}

export function loadAllProjects(): WhiteboardProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  } catch {
    return [];
  }
}

export function saveAllProjects(projects: WhiteboardProject[]): boolean {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    return true;
  } catch {
    // Fallback: strip thumbnails from older projects if quota is exceeded
    try {
      const trimmed = projects.map((p, idx) =>
        idx === 0 ? p : { ...p, thumbnail: undefined }
      );
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(trimmed));
      return true;
    } catch {
      return false;
    }
  }
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  } catch {
    // ignore
  }
}

export function saveProjectSnapshot(project: WhiteboardProject): WhiteboardProject[] {
  const existing = loadAllProjects();
  let withThumb = project;
  try {
    const thumbnail = generateProjectThumbnail(
      project.objects,
      project.backgroundColor,
      project.backgroundPattern
    );
    withThumb = { ...project, thumbnail };
  } catch {
    // Keep existing thumbnail if generation fails
  }

  const idx = existing.findIndex((p) => p.id === project.id);
  const updated =
    idx >= 0
      ? existing.map((p) => (p.id === project.id ? withThumb : p))
      : [withThumb, ...existing];

  updated.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  saveAllProjects(updated);
  setActiveProjectId(project.id);
  return updated;
}

export function deleteProjectById(id: string): WhiteboardProject[] {
  const existing = loadAllProjects().filter((p) => p.id !== id);
  saveAllProjects(existing);
  return existing;
}
