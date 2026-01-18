import { Draft } from '@/types';

/**
 * Get the display name for a project/draft
 * 
 * If the user has set a custom project name, return that.
 * Otherwise, return the formatted creation date as a fallback.
 * 
 * @param draft - The draft object
 * @returns Display name string (e.g., "Sarah's Makeup" or "Jan 18, 2026")
 */
export function getProjectDisplayName(draft: Draft): string {
  if (draft.projectName) {
    return draft.projectName;
  }
  
  // Format date as fallback: "Jan 18, 2026"
  return new Date(draft.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Check if a draft has a custom project name set
 * 
 * @param draft - The draft object
 * @returns true if the user has set a custom name
 */
export function hasCustomProjectName(draft: Draft): boolean {
  return !!draft.projectName && draft.projectName.trim().length > 0;
}

/**
 * Validate a project name
 * 
 * @param name - The proposed project name
 * @returns Object with isValid boolean and optional error message
 */
export function validateProjectName(name: string): { isValid: boolean; error?: string } {
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    // Empty is valid - will show date as fallback
    return { isValid: true };
  }
  
  if (trimmed.length > 50) {
    return { isValid: false, error: 'Name must be 50 characters or less' };
  }
  
  return { isValid: true };
}

/**
 * Generate a copy name for duplicated projects
 * 
 * @param originalName - The original project name (or null)
 * @param createdAt - The creation date of the original draft
 * @returns New name with " (Copy)" suffix
 */
export function getDuplicateProjectName(originalName: string | null | undefined, createdAt: string): string {
  if (originalName && originalName.trim().length > 0) {
    // If name already ends with "(Copy)", add a number
    if (originalName.endsWith('(Copy)')) {
      return `${originalName.slice(0, -6).trim()} (Copy 2)`;
    }
    
    // Check for existing copy numbers
    const copyMatch = originalName.match(/\(Copy (\d+)\)$/);
    if (copyMatch) {
      const num = parseInt(copyMatch[1], 10) + 1;
      return `${originalName.slice(0, copyMatch.index).trim()} (Copy ${num})`;
    }
    
    return `${originalName} (Copy)`;
  }
  
  // No original name - use formatted date with (Copy)
  const dateStr = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${dateStr} (Copy)`;
}
