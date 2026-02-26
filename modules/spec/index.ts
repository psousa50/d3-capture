import { ArtefactModuleDefinition } from "../types";
import { SpecGenerator } from "./generator";

const specModule: ArtefactModuleDefinition = {
  type: "spec",
  description: "technical specification document",
  aliases: ["specifications", "specification"],
  generator: new SpecGenerator(),
};

export default specModule;
