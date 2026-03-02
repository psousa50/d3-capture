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
