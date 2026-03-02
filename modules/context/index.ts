import { ArtefactModuleDefinition } from "../types";
import { ContextGenerator } from "./generator";

const contextModule: ArtefactModuleDefinition = {
  type: "context",
  description: "project context document describing vision, goals, scope, and domain",
  aliases: ["project-context", "project context", "project overview"],
  generator: new ContextGenerator(),
};

export default contextModule;
