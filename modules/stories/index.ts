import { ArtefactModuleDefinition } from "../types";
import { StoryGenerator } from "./generator";

const storiesModule: ArtefactModuleDefinition = {
  type: "stories",
  description: "user stories with acceptance criteria",
  aliases: ["user stories", "user-stories"],
  generator: new StoryGenerator(),
};

export default storiesModule;
