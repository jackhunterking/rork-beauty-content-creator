/**
 * Projects Domain
 * 
 * Exports all project-related types, services, and context.
 */

// Types
export * from './types';

// Context
export { ProjectProvider, useProjects } from './ProjectContext';

// Service
export {
  fetchProjects,
  fetchProject,
  loadProject,
  saveProject,
  deleteProject,
  renameProject,
  duplicateProject,
  getProjectCount,
} from './projectService';
