import { DiagramModuleDefinition } from "../types";
import { generateDiagram, getDiagramProvider } from "./generator";
import { postProcessDiagram } from "./post-process";

const diagramModule: DiagramModuleDefinition = {
  type: "diagram",
  generateDiagram,
  postProcess: postProcessDiagram,
  getProvider: getDiagramProvider,
};

export default diagramModule;
