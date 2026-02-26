import { DiagramModuleDefinition } from "../types";
import { planDiagrams, generateDiagram, getDiagramProvider } from "./generator";
import { postProcessDiagram } from "./post-process";

const diagramModule: DiagramModuleDefinition = {
  type: "diagram",
  description:
    "technical diagrams (architecture, ER, sequence, flowcharts, wireframes)",
  aliases: ["diagrams"],
  planDiagrams,
  generateDiagram,
  postProcess: postProcessDiagram,
  getProvider: getDiagramProvider,
};

export default diagramModule;
