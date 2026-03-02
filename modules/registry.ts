import {
  ModuleDefinition,
  ArtefactModuleDefinition,
  DiagramModuleDefinition,
  isDiagramModule,
} from "./types";
import contextModule from "./context";
import specModule from "./spec";
import storiesModule from "./stories";
import diagramModule from "./diagram";

const modules: Map<string, ModuleDefinition> = new Map();

function register(module: ModuleDefinition) {
  modules.set(module.type, module);
}

register(contextModule);
register(specModule);
register(storiesModule);
register(diagramModule);

export function getModule(type: string): ModuleDefinition | undefined {
  return modules.get(type);
}

export function getAllModules(): ModuleDefinition[] {
  return Array.from(modules.values());
}

export function getTextModules(): ArtefactModuleDefinition[] {
  return getAllModules().filter(
    (m): m is ArtefactModuleDefinition => !isDiagramModule(m),
  );
}

export function getDiagramModule(): DiagramModuleDefinition | undefined {
  return getAllModules().find((m): m is DiagramModuleDefinition =>
    isDiagramModule(m),
  );
}

const TRIAGE_EXCLUDED = new Set(["stories"]);

export function getTriageDescriptions(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of modules.values()) {
    if (TRIAGE_EXCLUDED.has(m.type)) continue;
    result[m.type] = m.description;
  }
  return result;
}

const TRIAGE_REMAP: Record<string, string> = {
  stories: "spec",
  "user stories": "spec",
  "user-stories": "spec",
};

export function getNormaliseMap(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const m of modules.values()) {
    if (TRIAGE_EXCLUDED.has(m.type)) continue;
    result[m.type] = m.type;
    for (const alias of m.aliases) {
      result[alias] = m.type;
    }
  }
  Object.assign(result, TRIAGE_REMAP);
  return result;
}
