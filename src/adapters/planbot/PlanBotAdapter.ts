import { PromptCLI } from "@src/classes/prompt";
import { BaseBotAdapter } from "@src/adapters/BaseBotAdapter";
import { OpenAI } from "@src/classes/llm";
import { RequestMessage } from "@src/classes/request";
import { config as cfg } from "@src/config";

export default class PlanBotAdapter extends BaseBotAdapter {
	public static getName(): string {
		return "Plan Bot";
	}

	public static getDescription(): string {
		return "Construct a plan to accomplish a goal or solve a problem.";
	}

	public static async run(): Promise<void> {
		// Initalize OpenAI helper and the request message
		const openAI = new OpenAI({
			apiKey: cfg.OPENAI_API_KEY,
		});

		const requestMessage = new RequestMessage();

		// Ask the user what file or URL they want to summarize
		const prompt: string = await PromptCLI.text("Detail the problem or the goal that you'd like to create a plan for:");

		// Construct the request message based on history
		requestMessage.addUserPrompt(
			`Construct a list of tasks to accomplish in order to solve the problem or achieve the following goal. Be as explicit and detailed as possible: ${prompt}`,
		);

		// Submit the request to OpenAI, and cycle back to handle the response
		const messages = requestMessage.generateMessages();

		// Get the response and handle it
		const response = await openAI.getCompletion({
			messages,
			model: cfg.SMART_LLM_MODEL,
			onMessageCallback: (response) => {
				process.stdout.write(response);
			},
		});

		// Store GPT's reponse
		requestMessage.addGPTResponse(response);

		// And again
		this.run();
	}
}
