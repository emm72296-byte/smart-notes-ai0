import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import Editor from "./components/Editor";
import AILaboratory from "./components/AILaboratory";
import NodeCanvas from "./components/NodeCanvas";
import { Folder, Note, LabToolType } from "./types";
import { callGeminiDirect } from "./utils/geminiClient";
import { Sparkles, FileText, Bot, Menu, X, Layers, Edit3 } from "lucide-react";

// --- START SEED DATA TEMPLATES ---
const DEFAULT_FOLDERS: Folder[] = [
  { id: "f-launch", name: "Launch Roadmap", icon: "🚀" },
  { id: "f-research", name: "Research & Concepts", icon: "🔬" },
  { id: "f-study", name: "Study Prep Suite", icon: "🎓" },
  { id: "f-scratchpad", name: "General Scratchpad", icon: "📁" },
];

const DEFAULT_NOTES: Note[] = [
  {
    id: "n-orbital",
    title: "SpaceX Orbital Mission Plan",
    folderId: "f-launch",
    tags: ["aerospace", "launch", "roadmap"],
    content: `Mission: Project Starship Alpha Launch.
Key Targets:
1. Complete system checklists by July 15, 2026.
2. Perform full engine wet dress rehearsal on August 10, 2026.
3. Official orbital launch window is October 24, 2026.

Key Personnel:
- Elon Musk (Mission Commander)
- Dr. Sarah Jenkins (Chief Propulsion Engineer)
- Colonel Thomas Vance (Launch Director)

Core Objectives:
- Validate thermal protection shield system tiles on reentry.
- Successfully perform hot-staging ring separation maneuver.
- Catch Booster 12 safely using the Mechazilla launch tower arms.`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cachedAI: {
      summary: {
        summary: "Project Starship Alpha Launch is a high-profile aerospace initiative with a target orbital launch date of October 24, 2026. Key preparatory events include finishing system checklists in July and conducting wet dress rehearsals in August.",
        bulletPoints: [
          "Orbital launch is scheduled for October 24, 2026",
          "Wet dress rehearsal of engines on August 10, 2026",
          "Booster 12 recovery will be attempted using launch tower mechanical arms",
          "Hot-staging ring separation will undergo vital structural testing"
        ],
        keyDates: [
          { date: "July 15, 2026", event: "Complete system checklists" },
          { date: "August 10, 2026", event: "Engine wet dress rehearsal" },
          { date: "October 24, 2026", event: "Official launch window" }
        ],
        names: [
          { name: "Elon Musk", role: "Mission Commander" },
          { name: "Dr. Sarah Jenkins", role: "Chief Propulsion Engineer" },
          { name: "Colonel Thomas Vance", role: "Launch Director" }
        ],
        checklist: [
          { task: "Perform engine wet dress rehearsal", completed: false },
          { task: "Validate thermal protection shield tiles", completed: true },
          { task: "Prepare Booster 12 Mechazilla catch catch routine", completed: false }
        ]
      },
      kanban: {
        todo: ["Complete final system checklists", "Conduct wet dress rehearsal"],
        inprogress: ["Validate thermal protection shield tiles"],
        done: ["Design Booster Mechazilla catch sequence"]
      },
      roadmap: {
        phases: [
          { phase: "Phase 1: Pre-Launch Checklists", duration: "June - July 2026", details: "Review safety clearances and complete sub-system checklists.", status: "In Progress" },
          { phase: "Phase 2: Rehearsals & Testing", duration: "August 2026", details: "Execute dry/wet rehearsals and test structural thermal tiles.", status: "Not Started" },
          { phase: "Phase 3: Launch Window", duration: "October 24, 2026", details: "Orbital flight launch with hot staging ring maneuvers.", status: "Not Started" }
        ]
      },
      tree: {
        name: "Project Starship Alpha",
        children: [
          {
            name: "Milestones",
            children: [
              { name: "July 15: Checklists" },
              { name: "August 10: Dress Rehearsal" },
              { name: "October 24: Launch Window" }
            ]
          },
          {
            name: "Personnel Roles",
            children: [
              { name: "Elon Musk (Commander)" },
              { name: "Dr. Sarah Jenkins (Propulsion)" },
              { name: "Colonel Thomas Vance (Launch Director)" }
            ]
          }
        ]
      }
    }
  },
  {
    id: "n-quantum",
    title: "Quantum Computing Principles",
    folderId: "f-research",
    tags: ["physics", "computing", "research"],
    content: `Quantum computing leverages quantum mechanical phenomena like superposition and entanglement.
Superposition allows qubits to exist in multiple states simultaneously (both 0 and 1), exponentially scaling processing power.
Entanglement links qubits, enabling instantaneous state synchronization.

Key Applications:
- Cryptographic decryption (Shor's Algorithm)
- Chemical structure simulation (molecular modeling for medicine)
- Machine learning and optimizations

Challenges:
- Decoherence: Environmental noise destroys fragile quantum states. Keep temperatures close to absolute zero (0.015 Kelvin) using dilution refrigerators.`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cachedAI: {
      tree: {
        name: "Quantum Computing Concepts",
        children: [
          {
            name: "Core Phenomena",
            children: [
              { name: "Superposition (simultaneous multi-state qubits)" },
              { name: "Entanglement (instant state links)" }
            ]
          },
          {
            name: "Strategic Applications",
            children: [
              { name: "Shor's Algorithm (cryptography)" },
              { name: "Molecular Modeling (medical simulations)" },
              { name: "Optimization models" }
            ]
          },
          {
            name: "Environmental Roadblocks",
            children: [
              { name: "Decoherence (loss of fragile state)" },
              { name: "Extremely low temperature needs (0.015K)" }
            ]
          }
        ]
      }
    }
  }
];
// --- END SEED DATA TEMPLATES ---

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Layout View Mode: 'editor' (Vast Text area) | 'canvas' (Whiteboard mapping canvas)
  const [viewMode, setViewMode] = useState<"editor" | "canvas">("editor");

  // AI Cognitive overlay modal trigger
  const [isAILabOpen, setIsAILabOpen] = useState(false);

  // Autosave Engine states
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile navigation tab states
  const [mobileTab, setMobileTab] = useState<"folders" | "editor" | "canvas">("folders");

  // Load initial state from LocalStorage on mount
  useEffect(() => {
    const storedFolders = localStorage.getItem("smartnotes_folders");
    const storedNotes = localStorage.getItem("smartnotes_notes");

    if (storedFolders) {
      setFolders(JSON.parse(storedFolders));
    } else {
      setFolders(DEFAULT_FOLDERS);
      localStorage.setItem("smartnotes_folders", JSON.stringify(DEFAULT_FOLDERS));
    }

    if (storedNotes) {
      setNotes(JSON.parse(storedNotes));
    } else {
      setNotes(DEFAULT_NOTES);
      localStorage.setItem("smartnotes_notes", JSON.stringify(DEFAULT_NOTES));
    }

    // Default active note selection
    if (storedNotes) {
      const parsedNotes = JSON.parse(storedNotes);
      if (parsedNotes.length > 0) {
        setActiveNoteId(parsedNotes[0].id);
      }
    } else {
      setActiveNoteId(DEFAULT_NOTES[0].id);
    }
  }, []);

  // Listen for custom LocalStorage notes reloads (for whiteboard spawning blank notes)
  useEffect(() => {
    const handleNotesReload = () => {
      const storedNotes = localStorage.getItem("smartnotes_notes");
      if (storedNotes) {
        setNotes(JSON.parse(storedNotes));
      }
    };
    window.addEventListener("localstorage-notes-updated", handleNotesReload);

    const handleSwitchStudio = () => {
      setViewMode("canvas");
      setMobileTab("canvas");
    };
    window.addEventListener("switch-to-canvas-studio", handleSwitchStudio);

    return () => {
      window.removeEventListener("localstorage-notes-updated", handleNotesReload);
      window.removeEventListener("switch-to-canvas-studio", handleSwitchStudio);
    };
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId) || null;

  // Real-time debounced autosave trigger
  const handleUpdateNote = (updatedNote: Note) => {
    // Instantly update React local state
    const nextNotes = notes.map((n) => (n.id === updatedNote.id ? updatedNote : n));
    setNotes(nextNotes);

    setAutosaveState("saving");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      // Write to localStorage after 800ms debounce
      localStorage.setItem("smartnotes_notes", JSON.stringify(nextNotes));
      setAutosaveState("saved");

      // Transition state back to idle after a visual delay
      setTimeout(() => {
        setAutosaveState("idle");
      }, 1500);
    }, 800);
  };

  // Create Folder handler
  const handleCreateFolder = (name: string, icon: string) => {
    const newFolder: Folder = {
      id: "f-" + Date.now(),
      name,
      icon,
    };
    const nextFolders = [...folders, newFolder];
    setFolders(nextFolders);
    localStorage.setItem("smartnotes_folders", JSON.stringify(nextFolders));
    setActiveFolderId(newFolder.id);
  };

  // Delete Folder handler
  const handleDeleteFolder = (folderId: string) => {
    if (confirm("Are you sure you want to delete this folder? All notes inside will be unassigned.")) {
      const nextFolders = folders.filter((f) => f.id !== folderId);
      setFolders(nextFolders);
      localStorage.setItem("smartnotes_folders", JSON.stringify(nextFolders));

      // Move notes inside to General scratchpad
      const nextNotes = notes.map((note) => {
        if (note.folderId === folderId) {
          return { ...note, folderId: "f-scratchpad", updatedAt: new Date().toISOString() };
        }
        return note;
      });
      setNotes(nextNotes);
      localStorage.setItem("smartnotes_notes", JSON.stringify(nextNotes));

      if (activeFolderId === folderId) {
        setActiveFolderId(null);
      }
    }
  };

  // Create Note handler
  const handleCreateNote = (type: "text" | "canvas" = "text") => {
    const isCanvas = type === "canvas";
    const newNote: Note = {
      id: "n-" + Date.now(),
      title: isCanvas ? "New Concept Map" : "New Note Title",
      folderId: activeFolderId || "f-scratchpad", // defaults to Scratchpad if "All Notes" selected
      tags: isCanvas ? ["canvas"] : [],
      noteType: type,
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextNotes = [newNote, ...notes];
    setNotes(nextNotes);
    localStorage.setItem("smartnotes_notes", JSON.stringify(nextNotes));
    setActiveNoteId(newNote.id);

    // Switch view mode instantly
    setViewMode(isCanvas ? "canvas" : "editor");
    setMobileTab(isCanvas ? "canvas" : "editor");
  };

  // Delete Note handler
  const handleDeleteNote = (noteId: string) => {
    if (confirm("Are you sure you want to delete this note permanently?")) {
      const nextNotes = notes.filter((n) => n.id !== noteId);
      setNotes(nextNotes);
      localStorage.setItem("smartnotes_notes", JSON.stringify(nextNotes));

      if (activeNoteId === noteId) {
        setActiveNoteId(nextNotes.length > 0 ? nextNotes[0].id : null);
      }
    }
  };

  // 100% Client-Side API call handler (calls direct Gemini fetching with API key)
  const handleTriggerAILab = async (tool: LabToolType, additionalInput?: string) => {
    if (!activeNote) return;

    try {
      const result = await callGeminiDirect(tool, activeNote.content, additionalInput);

      // If it is the contextual assistant chat, we don't save to static note cache, just return
      if (tool === "chat") {
        return result;
      }

      // Save parsed results directly into this specific note's cache to save credits
      const updatedNote = {
        ...activeNote,
        cachedAI: {
          ...(activeNote.cachedAI || {}),
          [tool]: result,
        },
      };

      // Instantly update note and write to localStorage
      const nextNotes = notes.map((n) => (n.id === activeNote.id ? updatedNote : n));
      setNotes(nextNotes);
      localStorage.setItem("smartnotes_notes", JSON.stringify(nextNotes));

      return result;
    } catch (err: any) {
      console.error("AI Lab integration error:", err);
      throw err;
    }
  };

  return (
    <div className="w-screen h-screen bg-cosmic-bg text-gray-200 overflow-hidden flex flex-col font-sans">
      
      {/* HEADER BAR (Visible only on mobile / small screens for toggles) */}
      <div className="md:hidden h-14 bg-cosmic-sidebar border-b border-indigo-950/40 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cosmic-indigo to-cosmic-teal flex items-center justify-center text-white">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-extrabold text-sm tracking-tight text-white">
            Smart Notes AI
          </span>
        </div>
        
        {activeNote && (
          <span className="text-[10px] font-mono text-cosmic-teal font-medium uppercase tracking-wider">
            {mobileTab === "folders" ? "Folders List" : mobileTab === "editor" ? "Text Editor" : "Node Whiteboard"}
          </span>
        )}
      </div>

      {/* DOUBLE PANELS LAYOUT ON DESKTOP */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        
        {/* PANEL 1: Sidebar (Desktop: Visible [310px], Mobile: Tab conditional) */}
        <div className={`md:block shrink-0 h-full ${mobileTab === "folders" ? "block w-full" : "hidden"}`}>
          <Sidebar
            folders={folders}
            notes={notes}
            activeFolderId={activeFolderId}
            activeNoteId={activeNoteId}
            selectedTag={selectedTag}
            onSelectFolder={setActiveFolderId}
            onSelectNote={(id) => {
              setActiveNoteId(id);
              const clickedNote = notes.find((n) => n.id === id);
              if (clickedNote) {
                const isCanvas = clickedNote.noteType === "canvas";
                setViewMode(isCanvas ? "canvas" : "editor");
                setMobileTab(isCanvas ? "canvas" : "editor");
              } else {
                setMobileTab("editor");
              }
            }}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            onCreateNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
            onSelectTag={setSelectedTag}
          />
        </div>

        {/* PANEL 2 & 3 Combined Workspace Main Pane (Desktop: Vast Expanded layout) */}
        <div className={`md:flex flex-1 h-full flex-col min-w-0 ${mobileTab !== "folders" ? "flex" : "hidden md:flex"}`}>
          
          {/* Main Desktop Workspace Header Tabs switcher */}
          <div className="hidden md:flex h-14 bg-[#0d1123]/70 border-b border-indigo-950/45 px-6 items-center justify-between shrink-0">
            <div className="flex bg-slate-950/60 p-1 border border-indigo-950 rounded-xl">
              <button
                onClick={() => setViewMode("editor")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "editor"
                    ? "bg-cosmic-indigo text-white shadow-md shadow-indigo-500/10"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Vast Text Editor</span>
              </button>

              <button
                onClick={() => setViewMode("canvas")}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === "canvas"
                    ? "bg-cosmic-indigo text-white shadow-md shadow-indigo-500/10"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Node Canvas Studio</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
              <span className="w-2 h-2 bg-cosmic-teal rounded-full animate-pulse" />
              <span>Direct Client-Side Gemini Activated</span>
            </div>
          </div>

          {/* Core Panel viewport render */}
          <div className="flex-1 overflow-hidden">
            {viewMode === "editor" || mobileTab === "editor" ? (
              <Editor
                note={activeNote}
                folders={folders}
                autosaveState={autosaveState}
                onUpdateNote={handleUpdateNote}
                onOpenAILab={() => setIsAILabOpen(true)}
              />
            ) : (
              <NodeCanvas
                notes={notes}
                folders={folders}
                activeNoteId={activeNoteId}
                onSelectNote={setActiveNoteId}
                onUpdateNote={handleUpdateNote}
                onSwitchToEditor={() => {
                  setViewMode("editor");
                  setMobileTab("editor");
                }}
                onCreateNote={handleCreateNote}
              />
            )}
          </div>
        </div>
      </div>

      {/* MOBILE COLLAPSED BOTTOM NAVIGATION TABS (<768px) */}
      <div className="md:hidden h-16 bg-cosmic-sidebar border-t border-indigo-950/50 flex items-center justify-around px-2 shrink-0">
        <button
          onClick={() => setMobileTab("folders")}
          className={`flex flex-col items-center justify-center p-2 text-xs font-semibold tracking-tight transition-colors ${
            mobileTab === "folders" ? "text-cosmic-indigo" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Menu className="w-5 h-5 mb-1" />
          <span>Library</span>
        </button>

        <button
          onClick={() => {
            setMobileTab("editor");
            setViewMode("editor");
          }}
          className={`flex flex-col items-center justify-center p-2 text-xs font-semibold tracking-tight transition-colors ${
            mobileTab === "editor" ? "text-cosmic-indigo" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <FileText className="w-5 h-5 mb-1" />
          <span>Editor</span>
        </button>

        <button
          onClick={() => {
            setMobileTab("canvas");
            setViewMode("canvas");
          }}
          className={`flex flex-col items-center justify-center p-2 text-xs font-semibold tracking-tight transition-colors ${
            mobileTab === "canvas" ? "text-cosmic-indigo" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Layers className="w-5 h-5 mb-1 text-cosmic-teal" />
          <span>Whiteboard</span>
        </button>
      </div>

      {/* CENTRAL COGNITIVE LABS OVERLAY MODAL */}
      {isAILabOpen && activeNote && (
        <div className="fixed inset-0 bg-[#070913]/85 backdrop-blur-md flex items-center justify-center z-50 p-0 md:p-10">
          <div className="w-full max-w-5xl h-full md:h-[85vh] bg-[#0d1123] md:border md:border-indigo-950 md:rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
            
            {/* Modal absolute close button */}
            <button
              onClick={() => setIsAILabOpen(false)}
              className="absolute top-4 right-4 p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-indigo-950 rounded-xl text-gray-400 hover:text-white transition-all z-50 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Close Cognitive Labs"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Inner AI laboratory dashboard */}
            <div className="flex-1 h-full min-h-0 flex flex-col md:flex-row">
              {/* Note overview info rail */}
              <div className="hidden lg:flex w-[260px] border-r border-indigo-950/45 p-6 flex-col gap-4 bg-slate-950/20">
                <span className="text-[10px] font-bold font-mono tracking-widest text-cosmic-teal uppercase">
                  Context Document
                </span>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-indigo-100 font-display line-clamp-2">
                    {activeNote.title || "Untitled active note"}
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono">
                    Last modified: {new Date(activeNote.updatedAt).toLocaleTimeString()}
                  </p>
                </div>
                
                <div className="flex-1 border border-indigo-950/40 rounded-2xl p-4 bg-slate-950/40 overflow-y-auto">
                  <span className="text-[9px] font-bold font-mono text-gray-600 block uppercase mb-1">
                    Text Stream
                  </span>
                  <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans whitespace-pre-wrap">
                    {activeNote.content || "No active text to analyze..."}
                  </p>
                </div>
              </div>

              {/* Main AI laboratory component */}
              <div className="flex-1 min-w-0 h-full">
                <AILaboratory
                  note={activeNote}
                  onUpdateNote={handleUpdateNote}
                  onTriggerAILab={handleTriggerAILab}
                />
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
