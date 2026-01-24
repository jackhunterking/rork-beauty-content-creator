/**
 * Projects Domain
 * 
 * Exports all project-related types and services.
 */

// Types
export * from './types';

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
