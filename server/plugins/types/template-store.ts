export interface TemplateStore {
  getTemplate(key: string): Promise<string>;
}
