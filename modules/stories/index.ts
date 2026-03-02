import { ArtefactModuleDefinition } from "../types";
import { StoryGenerator } from "./generator";

const storiesModule: ArtefactModuleDefinition = {
  type: "stories",
  generator: new StoryGenerator(),
};

export default storiesModule;
