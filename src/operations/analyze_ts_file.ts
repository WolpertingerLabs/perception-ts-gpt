import BaseOperation, { OperationFormat } from "./base_operation";
import fs from "fs";
import * as ts from "typescript";
//import { Project } from "ts-morph";

export type TSVariable = {
	name: string;
	type?: string;
	exported?: boolean;
};

export type TSFunction = {
	name: string;
	inputs: TSVariable[];
	output: string;
	visibility?: "public" | "private" | "protected";
	exported?: boolean;
};

export type TSInterface = {
	name: string;
	properties: TSVariable[];
	methods: TSFunction[];
	exported?: boolean;
};

export type TSType = TSInterface;
export type TSClass = TSInterface;

export type TSFileStructure = {
	types: TSType[];
	classes: TSClass[];
	functions: TSFunction[];
	variables: TSVariable[];
	interfaces: TSInterface[];
};

export default class AnalyzeTSFile extends BaseOperation {
	//private project: Project;

	public static getName(): string {
		return "Analytze TypeScript File";
	}

	public static getDescription(): string {
		return "Summarize Typescript file's public methods";
	}

	public static getOperations(): OperationFormat[] {
		return [];
	}

	public static analyzeTSFile(tsFilepath: string): TSFileStructure {
		const fileStructure: TSFileStructure = {
			types: [],
			classes: [],
			functions: [],
			variables: [],
			interfaces: [],
		};

		try {
			const sourceCode: string = fs.readFileSync(tsFilepath, "utf8");

			const sourceFile: ts.Node = ts.createSourceFile("temp.ts", sourceCode, ts.ScriptTarget.ES2020, true);

			this.processNode(fileStructure, sourceFile);

			// TODO: Use ts-morph instead, since this captures all of the exports that we're missing
			//this.project = new Project({
			//	compilerOptions: {
			//		target: ts.ScriptTarget.ES2020,
			//	  },
			//});
			//
			///*
			//this.project = new Project({
			//	tsConfigFilePath: `${process.cwd}/tsconfig.json`,
			//	skipAddingFilesFromTsConfig: true,
			//});
			//*/
			//
			//this.project.addSourceFileAtPath(tsFilepath);
			//
			//for (const [name, declarations] of this.project.getSourceFileOrThrow(tsFilepath).getExportedDeclarations()) {
			//	console.log(declarations.map(d => d.getName()));
			//	console.log(`${name}: ${declarations.map(d => d.getText()).join(", ")}`);
			//}

			return fileStructure;
		} catch (error) {
			console.error(error);
			throw error;
		}
	}

	private static processNode(fileStructure: TSFileStructure, node: ts.Node): void {
		if (ts.isTypeAliasDeclaration(node)) {
			fileStructure.types.push(this.getInterfaceStructure(node));
		} else if (ts.isClassDeclaration(node)) {
			fileStructure.classes.push(this.getInterfaceStructure(node));
		} else if (ts.isVariableDeclaration(node)) {
			fileStructure.variables.push(this.getVariableStructure(node));
		} else if (ts.isFunctionDeclaration(node)) {
			fileStructure.functions.push(this.getMethodStructure(node));
		} else if (ts.isInterfaceDeclaration(node)) {
			fileStructure.interfaces.push(this.getInterfaceStructure(node));
		}

		ts.forEachChild(node, this.processNode.bind(this, fileStructure));
	}

	private static isExport(node: ts.Node): boolean {
		// TODO: This does not identify exported global variables that are declared and assigned an anonymous function
		return (
			("modifiers" in node && (node?.modifiers as any)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) || false
		);
	}

	private static getVariableStructure(
		node: ts.VariableDeclaration | ts.ParameterDeclaration | ts.PropertyDeclaration | ts.PropertySignature,
	): TSVariable {
		// If the variable is assigned a function, return the function structure
		if ("initializer" in node && ts.isFunctionLike(node?.initializer)) {
			console.log(node?.parent?.parent?.parent?.getText());

			return {
				name: "escapedText" in node?.name && (node?.name?.escapedText as string),
				type: this.printFunction(node?.initializer, node?.type?.getText()),
				exported: this.isExport(node),
			};
		}

		return {
			name: "escapedText" in node?.name && (node?.name?.escapedText as string),
			type: node?.type?.getText() as string,
			exported: this.isExport(node),
		};
	}

	private static printFunction(childNode: ts.FunctionLikeDeclaration, outputType?: string): string {
		// Get the method structure
		const methodStructure = this.getMethodStructure(childNode);

		// Return (...input) => output format
		return `(${methodStructure.inputs.map((input) => input.name + (input.type && " : " + input.type)).join(", ")}) => ${
			outputType || methodStructure.output || "void"
		}`;
	}

	private static getMethodStructure(childNode: ts.FunctionLikeDeclaration): TSFunction {
		const methodStructure = {
			name: "escapedText" in childNode?.name && (childNode?.name?.escapedText as string),
			inputs: [],
			output: childNode?.type?.getText() as string,
			visibility: (childNode?.modifiers as any)?.reduce(
				(mod: ts.ModifierLike, current: ts.ModifierLike) =>
					["public", "private", "protected"].includes(current?.getText()) ? current?.getText() : mod,
				"public", // Default visibility for typescript methods is public
			) as "public" | "private" | "protected" | undefined,
			exported: this.isExport(childNode),
		};

		ts.forEachChild(childNode, (childChildNode) => {
			if (ts.isParameter(childChildNode)) {
				methodStructure.inputs.push(this.getVariableStructure(childChildNode));
			}
		});

		return methodStructure;
	}

	private static getInterfaceStructure(node: ts.InterfaceDeclaration | ts.ClassDeclaration | ts.TypeAliasDeclaration): TSInterface {
		const interfaceStructure = {
			name: node?.name?.escapedText as string,
			properties: [],
			methods: [],
			exported: this.isExport(node),
		};

		ts.forEachChild(node, (childNode) => {
			if (ts.isTypeLiteralNode(childNode)) {
				ts.forEachChild(childNode, (childChildNode) => {
					if (ts.isPropertySignature(childChildNode) || ts.isPropertyDeclaration(childChildNode)) {
						interfaceStructure.properties.push(this.getVariableStructure(childChildNode));
					}
				});
			} else if (ts.isMethodSignature(childNode) || ts.isMethodDeclaration(childNode)) {
				interfaceStructure.methods.push(this.getMethodStructure(childNode as ts.MethodDeclaration));
			}
		});

		return interfaceStructure;
	}
}
