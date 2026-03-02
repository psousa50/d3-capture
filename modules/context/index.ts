import { ArtefactModuleDefinition } from "../types";
import { ContextGenerator } from "./generator";

const contextModule: ArtefactModuleDefinition = {
  type: "context",
  generator: new ContextGenerator(),
};

export default contextModule;
