import { ArtefactModuleDefinition } from "../types";
import { SpecGenerator } from "./generator";

const specModule: ArtefactModuleDefinition = {
  type: "spec",
  generator: new SpecGenerator(),
};

export default specModule;
