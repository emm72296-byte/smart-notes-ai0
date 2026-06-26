import React, { useState, useEffect, useRef } from "react";
import { Note, Folder } from "../types";
import {
  Sparkles,
  Tag,
  X,
  Plus,
  FolderOpen,
  Clipboard,
  Check,
  Info,
  Type,
  Palette,
  AlignLeft,
  AlignRight,
  Layers,
  Bold,
  Italic,
  Underline,
} from "lucide-react";

interface EditorProps {
  note: Note | null;
  folders: Folder[];
  autosaveState: "idle" | "saving" | "saved";
  onUpdateNote: (updatedNote: Note) => void;
  onOpenAILab: () => void;
}

const PREMIUM_FONTS = [
  { name: "Inter (Sans-serif)", value: "font-inter" },
  { name: "Playfair Display (Serif)", value: "font-playfair" },
  { name: "JetBrains Mono (Monospace)", value: "font-mono" },
  { name: "Amiri (Arabic Serif)", value: "font-amiri" },
  { name: "Cairo (Arabic Sans-serif)", value: "font-cairo" },
  { name: "Cinzel (Roman Classical)", value: "font-cinzel" },
  { name: "Space Grotesk (Tech-forward)", value: "font-space-grotesk" },
];

const TEXT_COLORS = [
  { name: "Off-White", value: "#d1d5db" },
  { name: "Cosmic Indigo", value: "#818cf8" },
  { name: "Atmospheric Teal", value: "#2dd4bf" },
  { name: "Ember Rose", value: "#fb7185" },
  { name: "Stardust Amber", value: "#fbbf24" },
  { name: "Aurorean Emerald", value: "#34d399" },
  { name: "Astral Lavender", value: "#c084fc" },
];

export default function Editor({
  note,
  folders,
  autosaveState,
  onUpdateNote,
  onOpenAILab,
}: EditorProps) {
  const [tagInput, setTagInput] = useState("");
  const [copied, setCopied] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);

  // Synchronize internal note content to the contenteditable element ONLY on note switch
  useEffect(() => {
    if (note && contentEditableRef.current) {
      if (contentEditableRef.current.innerHTML !== (note.content || "")) {
        contentEditableRef.current.innerHTML = note.content || "";
      }
    }
  }, [note?.id]);

  // If no note is selected, show an empty placeholder
  if (!note) {
    return (
      <div className="flex-1 h-full bg-cosmic-bg flex flex-col items-center justify-center p-8 text-center text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-indigo-950/40 border border-indigo-900/40 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>
        <h2 className="font-display font-bold text-xl text-indigo-100">
          Smart Notes AI Workspace
        </h2>
        <p className="text-sm text-gray-500 max-w-sm mt-2 leading-relaxed">
          Create a new note or select an existing one from the sidebar to engage the 9 Cognitive AI Laboratories.
        </p>
      </div>
    );
  }

  // If active note is a visual concept map, show redirection screen
  if (note.noteType === "canvas") {
    return (
      <div className="flex-1 h-full bg-[#070913] flex flex-col items-center justify-center p-8 text-center text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-indigo-950/40 border border-indigo-900/40 flex items-center justify-center mb-4">
          <Layers className="w-8 h-8 text-cosmic-teal animate-pulse" />
        </div>
        <h2 className="font-display font-bold text-xl text-indigo-100">
          Visual Concept Map Active
        </h2>
        <p className="text-sm text-gray-500 max-w-sm mt-2 leading-relaxed">
          "{note.title || "Untitled"}" is a visual canvas-based map note. Launch the Concept Map Whiteboard view to tactilely manage its nodes and linkages.
        </p>
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("switch-to-canvas-studio"));
          }}
          className="mt-6 flex items-center gap-2 bg-gradient-to-r from-cosmic-indigo to-indigo-600 hover:opacity-90 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-950/50 cursor-pointer border border-indigo-500/10"
        >
          <Layers className="w-4 h-4 text-cosmic-teal" />
          <span>Launch Concept Map Whiteboard</span>
        </button>
      </div>
    );
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateNote({
      ...note,
      title: e.target.value,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleInput = () => {
    if (contentEditableRef.current) {
      const htmlContent = contentEditableRef.current.innerHTML;
      onUpdateNote({
        ...note,
        content: htmlContent,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateNote({
      ...note,
      folderId: e.target.value,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = tagInput.trim().toLowerCase();
    if (cleanTag && !note.tags.includes(cleanTag)) {
      onUpdateNote({
        ...note,
        tags: [...note.tags, cleanTag],
        updatedAt: new Date().toISOString(),
      });
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onUpdateNote({
      ...note,
      tags: note.tags.filter((t) => t !== tagToRemove),
      updatedAt: new Date().toISOString(),
    });
  };

  const stripHtmlTags = (html: string) => {
    if (!html) return "";
    let txt = html.replace(/<[^>]*>/g, " ");
    txt = txt
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
    return txt.replace(/\s+/g, " ").trim();
  };

  const handleCopy = () => {
    const plaintext = stripHtmlTags(contentEditableRef.current?.innerHTML || note.content || "");
    navigator.clipboard.writeText(plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFontChange = (fontClass: string) => {
    onUpdateNote({
      ...note,
      fontStyle: fontClass,
      updatedAt: new Date().toISOString(),
    });
  };

  // Selective text styling formatting system (preserving other color and text styles)
  const applyStyle = (command: string, value: string = "") => {
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleColorChange = (colorValue: string) => {
    applyStyle("foreColor", colorValue);
  };

  const handleDirectionToggle = (dirValue: "ltr" | "rtl") => {
    onUpdateNote({
      ...note,
      dir: dirValue,
      updatedAt: new Date().toISOString(),
    });
  };

  const plaintext = stripHtmlTags(note.content || "");
  const wordCount = plaintext ? plaintext.split(/\s+/).filter(Boolean).length : 0;
  const charCount = plaintext ? plaintext.length : 0;

  return (
    <div className="flex-1 h-full bg-cosmic-bg flex flex-col min-w-0 border-r border-indigo-950/40 text-gray-200 relative">
      
      {/* Editor Header / Toolbars */}
      <div className="px-6 py-4 border-b border-indigo-950/30 flex flex-wrap items-center justify-between gap-3 bg-cosmic-sidebar/10">
        <div className="flex items-center gap-3">
          {/* Folder Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/50 px-3 py-1.5 rounded-lg border border-indigo-950/30 text-xs text-gray-400">
            <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={note.folderId}
              onChange={handleFolderChange}
              className="bg-transparent focus:outline-none cursor-pointer text-gray-300 font-medium font-sans pr-1"
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id} className="bg-cosmic-card text-gray-300">
                  {folder.icon} {folder.name}
                </option>
              ))}
            </select>
          </div>

          {/* Autosave Status Badge */}
          <div>
            {autosaveState === "saving" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-950/50 border border-indigo-500/20 text-[10px] text-indigo-400 animate-pulse font-mono font-medium">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                Saving...
              </span>
            )}
            {autosaveState === "saved" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-950/35 border border-cosmic-teal/20 text-[10px] text-cosmic-teal font-mono font-medium">
                <span className="w-1.5 h-1.5 bg-cosmic-teal rounded-full" />
                Auto-saved
              </span>
            )}
            {autosaveState === "idle" && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/40 border border-indigo-950/50 text-[10px] text-gray-500 font-mono">
                <span className="w-1.5 h-1.5 bg-gray-600 rounded-full" />
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar with Premium AI Launcher and formatting switches */}
        <div className="flex items-center gap-2">
          {/* AI Cognitive Labs Launcher */}
          <button
            onClick={onOpenAILab}
            className="flex items-center gap-1.5 bg-gradient-to-r from-cosmic-indigo via-indigo-600 to-indigo-700 hover:opacity-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/10 border border-indigo-500/20 cursor-pointer animate-shimmer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cosmic-teal animate-pulse" />
            <span>AI Cognitive Labs</span>
          </button>

          <div className="w-[1px] h-5 bg-indigo-950/45 mx-1" />

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="p-2 bg-slate-950/50 border border-indigo-950/40 rounded-xl hover:text-white transition-all text-gray-400 text-xs flex items-center gap-1.5 cursor-pointer"
            title="Copy plaintext to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-cosmic-teal" />
                <span className="text-[10px] text-cosmic-teal font-medium">Copied</span>
              </>
            ) : (
              <>
                <Clipboard className="w-3.5 h-3.5" />
                <span className="text-[10px]">Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Font & Color Format Bar (Always visible at the top of note canvas) */}
      <div className="px-6 py-2 border-b border-indigo-950/20 bg-slate-950/15 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Typography Font Picker */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Type className="w-3.5 h-3.5 text-indigo-400" />
            <select
              value={note.fontStyle || "font-inter"}
              onChange={(e) => handleFontChange(e.target.value)}
              className="bg-transparent border-none text-gray-300 font-medium cursor-pointer text-xs focus:outline-none"
            >
              {PREMIUM_FONTS.map((f) => (
                <option key={f.value} value={f.value} className="bg-cosmic-card text-gray-300">
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-[1px] h-4 bg-indigo-950/40" />

          {/* Bold, Italic, Underline decoration buttons */}
          <div className="flex items-center gap-0.5 bg-slate-950/45 p-0.5 rounded-lg border border-indigo-950/25">
            <button
              onClick={() => applyStyle("bold")}
              className="p-1.5 hover:bg-indigo-950/50 rounded-md text-gray-400 hover:text-white transition-all cursor-pointer"
              title="Bold selection"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => applyStyle("italic")}
              className="p-1.5 hover:bg-indigo-950/50 rounded-md text-gray-400 hover:text-white transition-all cursor-pointer"
              title="Italic selection"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => applyStyle("underline")}
              className="p-1.5 hover:bg-indigo-950/50 rounded-md text-gray-400 hover:text-white transition-all cursor-pointer"
              title="Underline selection"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-[1px] h-4 bg-indigo-950/40" />

          {/* Color Presets Picker (Apply only to Selection) */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <div className="flex items-center gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => handleColorChange(c.value)}
                  style={{ backgroundColor: c.value }}
                  className="w-3.5 h-3.5 rounded-full border border-slate-950/70 hover:scale-125 hover:shadow transition-all cursor-pointer"
                  title={`Color: ${c.name}`}
                />
              ))}
              {/* Custom native color input proxy */}
              <label className="relative w-3.5 h-3.5 rounded-full border border-slate-950/70 cursor-pointer overflow-hidden bg-gradient-to-tr from-rose-500 via-yellow-500 to-teal-500">
                <input
                  type="color"
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  title="Custom color selection"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Direction controllers (LTR vs RTL) */}
        <div className="flex items-center gap-1 bg-slate-950/45 p-0.5 rounded-lg border border-indigo-950/25">
          <button
            onClick={() => handleDirectionToggle("ltr")}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              (note.dir || "ltr") === "ltr"
                ? "bg-cosmic-indigo/25 text-indigo-200 border border-indigo-500/10"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="Left-to-Right writing format"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDirectionToggle("rtl")}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              note.dir === "rtl"
                ? "bg-cosmic-indigo/25 text-indigo-200 border border-indigo-500/10"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title="Right-to-Left writing format (Arabic/Hebrew)"
          >
            <AlignRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Text Area Canvas */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto space-y-4">
        {/* Title Input */}
        <input
          type="text"
          ref={titleInputRef}
          value={note.title}
          onChange={handleTitleChange}
          placeholder="Give your note an elegant title..."
          className="w-full text-2xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-indigo-200 placeholder-indigo-950/40 focus:outline-none py-1.5 border-b border-transparent focus:border-indigo-950/30 transition-all"
        />

        {/* Tags Line Manager */}
        <div className="flex flex-wrap items-center gap-1.5 py-1 border-b border-indigo-950/10">
          <Tag className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 bg-indigo-950/40 border border-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-md text-[10px] font-medium"
              >
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-400 transition-colors cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>

          <form onSubmit={handleAddTag} className="inline-block">
            <div className="flex items-center ml-2 relative">
              <input
                type="text"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="bg-transparent border-none text-[10px] text-indigo-200 placeholder-indigo-950/40 focus:outline-none w-16 focus:w-28 transition-all"
              />
              <button type="submit" className="text-indigo-400 hover:text-white p-0.5 cursor-pointer">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </form>
        </div>

        {/* Rich-Text contenteditable container */}
        <div
          ref={contentEditableRef}
          contentEditable
          onInput={handleInput}
          dir={note.dir || "ltr"}
          className={`w-full flex-1 bg-transparent resize-none focus:outline-none text-base leading-relaxed placeholder-gray-600 mt-2 min-h-[300px] text-gray-200 ${
            note.fontStyle || "font-inter"
          }`}
          data-placeholder="Start drafting your research details, thoughts, meeting summaries, or project goals. Use the Cognitive AI Labs drawer on the right to extract dashboards, roadmap timelines, mental concept maps, or study quiz questions!"
        />
      </div>

      {/* Glowing Floating Action Button (FAB) inside the editor workspace */}
      <button
        onClick={onOpenAILab}
        className="absolute bottom-16 right-8 flex items-center gap-2 bg-gradient-to-tr from-cosmic-indigo to-[#4f46e5] hover:scale-105 active:scale-95 text-white pl-4 pr-5 py-3 rounded-full font-bold text-xs shadow-2xl shadow-indigo-500/25 border border-indigo-400/30 transition-all cursor-pointer z-10 group"
      >
        <Sparkles className="w-4.5 h-4.5 text-cosmic-teal animate-pulse group-hover:rotate-12 transition-transform" />
        <span className="tracking-wide">AI Cognitive Labs</span>
      </button>

      {/* Editor Stats Footer */}
      <div className="px-6 py-3 border-t border-indigo-950/30 bg-cosmic-sidebar/10 flex items-center justify-between text-[11px] text-gray-500 font-mono">
        <div className="flex items-center gap-4">
          <span>Words: <strong className="text-gray-400 font-sans">{wordCount}</strong></span>
          <span>Characters: <strong className="text-gray-400 font-sans">{charCount}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-indigo-400/80 bg-indigo-950/20 px-2 py-1 rounded border border-indigo-950/30">
          <Info className="w-3 h-3" />
          <span>Typing auto-saves in real-time</span>
        </div>
      </div>
    </div>
  );
}
