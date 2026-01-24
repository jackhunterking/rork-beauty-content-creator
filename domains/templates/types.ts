import { Template, TemplateFormat, ContentType } from '@/types';

/**
 * Template context state
 */
export interface TemplateState {
  templates: Template[];
  selectedFormat: TemplateFormat;
  contentType: ContentType;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Template context actions
 */
export interface TemplateActions {
  setFormat: (format: TemplateFormat) => void;
  setContentType: (type: ContentType) => void;
  toggleFavourite: (templateId: string) => Promise<void>;
  refetchTemplates: () => Promise<void>;
}

/**
 * Filter templates by format and content type
 */
export function filterTemplates(
  templates: Template[],
  format: TemplateFormat,
  contentType: ContentType
): Template[] {
  return templates.filter(t => {
    const matchesFormat = t.format === format;
    const matchesContentType = t.supports.includes(contentType);
    return matchesFormat && matchesContentType;
  });
}

/**
 * Get favourite templates
 */
export function getFavouriteTemplates(templates: Template[]): Template[] {
  return templates.filter(t => t.isFavourite);
}
