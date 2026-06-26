import { LabToolType } from "../types";

const GEMINI_API_KEY = "AIzaSyAqerEOmKp1MpGpNUV6wWGmhPnIdVaSX_s";
const MODEL_NAME = "gemini-2.5-flash"; // extremely fast and accurate current-generation flash model

function stripHtml(html: string): string {
  if (!html) return "";
  if (!html.includes("<") && !html.includes(">")) {
    return html;
  }
  let doc = html.replace(/<[^>]*>/g, " ");
  doc = doc
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return doc.replace(/\s+/g, " ").trim();
}

export async function callGeminiDirect(
  tool: LabToolType,
  noteContent: string,
  additionalInput?: string
): Promise<any> {
  const cleanNoteContent = stripHtml(noteContent);
  if (!cleanNoteContent || cleanNoteContent.trim() === "") {
    throw new Error("Note content is empty. Please type something in your note first!");
  }

  let prompt = "";
  let systemInstruction = "";
  let isJson = true;

  switch (tool) {
    case "writer":
      systemInstruction =
        "You are an expert copywriter. Refine the provided text into 5 distinct tones: Professional, Creative, Concise, Casual, and Academic. Return a single JSON object where the keys are the tone names and the values are the refined text segments. Do not include any markdown format tags around the JSON; output ONLY valid, raw JSON.";
      prompt = `Refine the following note content into 5 tones:\n\n${cleanNoteContent}`;
      break;

    case "summary":
      systemInstruction =
        "You are a professional research analyst. Extract key information from the provided text. Return a single JSON object with these keys: 'summary' (a concise 2-3 sentence overview), 'bulletPoints' (an array of 3-5 key takeaways), 'keyDates' (an array of objects containing 'date' and 'event' strings), 'names' (an array of objects containing 'name' and 'role' strings), and 'checklist' (an array of objects containing 'task' as a string and 'completed' as a boolean defaulting to false). Output ONLY valid, raw JSON without markdown formatting wrappers.";
      prompt = `Analyze the following note content:\n\n${cleanNoteContent}`;
      break;

    case "tree":
      systemInstruction =
        "You are a cognitive mapping assistant. Parse the text to extract core concepts and structure them recursively as a hierarchical tree. Return a single JSON object representing the root node, containing 'name' (string) and optionally 'children' (array of identical node objects). Keep it nested up to 3 levels deep if appropriate. Do not output markdown backticks; output ONLY valid raw JSON.";
      prompt = `Generate a hierarchical concept tree for the following content:\n\n${cleanNoteContent}`;
      break;

    case "mindmap":
      systemInstruction =
        "You are a visual design assistant. Structure the concepts in the text as a flat network graph. Return a single JSON object containing: 'nodes' (an array of objects with 'id' [string], 'label' [string], and 'type' [string, which can be 'root', 'main', or 'detail']), and 'edges' (an array of objects with 'source' [string, matches node id] and 'target' [string, matches node id]). Output ONLY raw valid JSON.";
      prompt = `Generate node and edge data for a mind map representing the following content:\n\n${cleanNoteContent}`;
      break;

    case "roadmap":
      systemInstruction =
        "You are an operations manager. Convert the note content into a chronological project roadmap or timeline. Return a single JSON object containing a 'phases' array. Each item in 'phases' must have 'phase' (name of phase, e.g. Phase 1: Research), 'duration' (estimated duration, e.g. Weeks 1-2), 'details' (description of tasks/goals), and 'status' (one of: 'Not Started', 'In Progress', 'Completed'). Output ONLY raw valid JSON.";
      prompt = `Formulate an operational roadmap from this note content:\n\n${cleanNoteContent}`;
      break;

    case "kanban":
      systemInstruction =
        "You are an agile project manager. Extract actionable tasks from the text and categorize them into 3 Kanban columns: 'todo', 'inprogress', and 'done'. Return a JSON object with 'todo' (array of strings), 'inprogress' (array of strings), and 'done' (array of strings). Do not use markdown tags; output ONLY raw valid JSON.";
      prompt = `Generate Kanban tasks based on the following content:\n\n${cleanNoteContent}`;
      break;

    case "study":
      systemInstruction =
        "You are an academic study assistant. Transform the text into a study suite. Return a single JSON object containing: 'summaryGuide' (a comprehensive summary study guide), 'flashcards' (an array of objects with 'front' [term/question] and 'back' [definition/explanation]), and 'quiz' (an array of 3 distinct multiple choice questions, each having 'question' [string], 'options' [array of 4 strings], 'answerIndex' [integer, 0-3], and 'explanation' [string explaining the correct answer]). Output ONLY raw valid JSON.";
      prompt = `Convert this note content into a study suite with guide, flashcards, and a quiz:\n\n${cleanNoteContent}`;
      break;

    case "decision":
      systemInstruction =
        "You are a strategic decision consultant. Identify options and evaluate them quantitatively based on evaluation criteria extracted from the content. Return a single JSON object containing: 'criteria' (an array of 3-4 string evaluation criteria) and 'options' (an array of 2-3 evaluated options. Each option object must have 'name' [string], 'scores' [array of integers between 1 and 10 corresponding to the criteria order], 'total' [integer, sum of scores], and 'analysis' [string summarizing pros and cons]). Output ONLY raw valid JSON.";
      prompt = `Create a decision matrix to evaluate options based on the following content:\n\n${cleanNoteContent}`;
      break;

    case "chat":
      isJson = false;
      systemInstruction = `You are a helpful contextual workspace assistant. You must answer the user's questions STRICTLY and ONLY based on the active note content provided below. If the answer cannot be inferred or related to the note, politely state that you are restricted to discussing the note's contents.\n\nACTIVE NOTE CONTENT:\n\"\"\"\n${cleanNoteContent}\n\"\"\"`;
      prompt = additionalInput || "Explain the main points of this note.";
      break;

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

  const requestBody: any = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: systemInstruction,
        },
      ],
    },
    generationConfig: {
      temperature: 0.7,
    },
  };

  if (isJson) {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError;
    try {
      parsedError = JSON.parse(errorText);
    } catch {
      // Ignored
    }
    const errMsg = parsedError?.error?.message || `API error (${response.status}): ${response.statusText}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (isJson) {
    let cleanedText = textOutput.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.substring(7);
    }
    if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.substring(3);
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.substring(0, cleanedText.length - 3);
    }
    cleanedText = cleanedText.trim();
    try {
      return JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON parse failure on response:", textOutput, parseError);
      throw new Error("Failed to parse response. The model did not output structural JSON. Please retry.");
    }
  } else {
    return { response: textOutput };
  }
}
