export interface Folder {
  id: string;
  name: string;
  icon: string; // lucide icon name or emoji
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  noteType?: "text" | "canvas"; // 'text' (Standard Editor) or 'canvas' (Nodes Map Whiteboard)
  fontStyle?: string; // e.g. 'font-inter', 'font-playfair'
  textColor?: string;  // e.g. '#6366f1' or hex color
  dir?: "ltr" | "rtl";
  cachedAI?: {
    writer?: Record<string, string>; // { Professional: "...", Creative: "...", ... }
    summary?: {
      summary: string;
      bulletPoints: string[];
      keyDates: { date: string; event: string }[];
      names: { name: string; role: string }[];
      checklist: { task: string; completed: boolean }[];
    };
    tree?: {
      name: string;
      children?: any[];
    };
    mindmap?: {
      nodes: { id: string; label: string; type: string; x?: number; y?: number }[];
      edges: { source: string; target: string }[];
    };
    roadmap?: {
      phases: { phase: string; duration: string; details: string; status: string }[];
    };
    kanban?: {
      todo: string[];
      inprogress: string[];
      done: string[];
    };
    study?: {
      summaryGuide: string;
      flashcards: { front: string; back: string }[];
      quiz: { question: string; options: string[]; answerIndex: number; explanation: string }[];
    };
    decision?: {
      criteria: string[];
      options: { name: string; scores: number[]; total: number; analysis: string }[];
    };
  };
}

export type LabToolType =
  | "writer"
  | "summary"
  | "tree"
  | "mindmap"
  | "roadmap"
  | "kanban"
  | "study"
  | "decision"
  | "chat";
