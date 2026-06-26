import React, { useState } from "react";
import { Folder, Note } from "../types";
import {
  FolderIcon,
  FolderPlus,
  Trash2,
  Plus,
  FileText,
  Tag,
  Calendar,
  Sparkles,
  ChevronRight,
  Search,
  Layers,
} from "lucide-react";

interface SidebarProps {
  folders: Folder[];
  notes: Note[];
  activeFolderId: string | null; // null means 'All Notes'
  activeNoteId: string | null;
  selectedTag: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onSelectNote: (noteId: string) => void;
  onCreateFolder: (name: string, icon: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateNote: (type: "text" | "canvas") => void;
  onDeleteNote: (noteId: string) => void;
  onSelectTag: (tag: string | null) => void;
}

export default function Sidebar({
  folders,
  notes,
  activeFolderId,
  activeNoteId,
  selectedTag,
  onSelectFolder,
  onSelectNote,
  onCreateFolder,
  onDeleteFolder,
  onCreateNote,
  onDeleteNote,
  onSelectTag,
}: SidebarProps) {
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderEmoji, setNewFolderEmoji] = useState("📁");
  const [searchQuery, setSearchQuery] = useState("");

  const folderEmojis = ["📁", "💡", "🚀", "🎓", "💼", "🔬", "📝", "🎯", "🌟", "📚"];

  // Filter notes based on active folder, selected tag, and search query
  const filteredNotes = notes.filter((note) => {
    const matchesFolder = activeFolderId === null || note.folderId === activeFolderId;
    const matchesTag = selectedTag === null || note.tags.includes(selectedTag);
    const matchesSearch =
      searchQuery.trim() === "" ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFolder && matchesTag && matchesSearch;
  });

  // Extract all unique tags in the current folder
  const allTags = Array.from(
    new Set(
      notes
        .filter((note) => activeFolderId === null || note.folderId === activeFolderId)
        .flatMap((note) => note.tags)
    )
  );

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), newFolderEmoji);
      setNewFolderName("");
      setShowNewFolderForm(false);
    }
  };

  return (
    <div className="w-full md:w-[310px] h-full bg-cosmic-sidebar flex flex-col border-r border-indigo-950/40 text-gray-200">
      {/* App Branding */}
      <div className="p-5 border-b border-indigo-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cosmic-indigo to-cosmic-teal flex items-center justify-center text-white shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-100">
              Smart Notes AI
            </h1>
            <span className="font-mono text-[10px] text-cosmic-teal uppercase tracking-wider font-semibold">
              Cognitive Workspace
            </span>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      <div className="p-4 border-b border-indigo-950/20 max-h-[220px] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
            Folders
          </span>
          <button
            onClick={() => setShowNewFolderForm(!showNewFolderForm)}
            className="p-1 hover:bg-slate-800/60 rounded text-indigo-400 hover:text-indigo-200 transition-colors"
            title="Create Folder"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        {/* Create Folder Form */}
        {showNewFolderForm && (
          <form
            onSubmit={handleCreateFolderSubmit}
            className="mb-3 p-3 bg-cosmic-card/40 rounded-xl border border-indigo-950/50"
          >
            <input
              type="text"
              placeholder="Folder Name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full text-xs bg-cosmic-bg text-gray-100 placeholder-gray-500 rounded-lg px-2.5 py-1.5 focus:outline-none border border-slate-800 focus:border-cosmic-indigo mb-2"
              required
              autoFocus
            />
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <span className="text-[10px] text-gray-400">Icon:</span>
              <div className="flex flex-wrap gap-1">
                {folderEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewFolderEmoji(emoji)}
                    className={`w-5 h-5 text-xs flex items-center justify-center rounded transition-all ${
                      newFolderEmoji === emoji ? "bg-cosmic-indigo text-white scale-110" : "hover:bg-slate-800"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => setShowNewFolderForm(false)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-2 py-1 rounded bg-cosmic-indigo hover:bg-indigo-500 text-white font-medium"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {/* Folders List */}
        <div className="space-y-1 text-sm">
          <button
            onClick={() => {
              onSelectFolder(null);
              onSelectTag(null);
            }}
            className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between group transition-colors ${
              activeFolderId === null && selectedTag === null
                ? "bg-gradient-to-r from-cosmic-indigo/25 to-transparent text-indigo-200 font-medium border-l-2 border-cosmic-indigo"
                : "hover:bg-indigo-950/15 text-gray-400 hover:text-gray-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderIcon className="w-4 h-4 text-indigo-400" />
              <span>All Workspace Notes</span>
            </div>
            <span className="text-xs bg-slate-900 px-1.5 py-0.5 rounded-md text-indigo-400 group-hover:bg-slate-800">
              {notes.length}
            </span>
          </button>

          {folders.map((folder) => {
            const folderNoteCount = notes.filter((n) => n.folderId === folder.id).length;
            return (
              <div
                key={folder.id}
                className={`group w-full rounded-lg flex items-center justify-between transition-colors ${
                  activeFolderId === folder.id
                    ? "bg-gradient-to-r from-cosmic-indigo/20 to-transparent text-indigo-200 font-medium border-l-2 border-cosmic-indigo"
                    : "hover:bg-indigo-950/15 text-gray-400 hover:text-gray-200"
                }`}
              >
                <button
                  onClick={() => {
                    onSelectFolder(folder.id);
                    onSelectTag(null);
                  }}
                  className="flex-1 text-left px-3 py-1.5 flex items-center gap-2 overflow-hidden"
                >
                  <span className="text-sm shrink-0">{folder.icon}</span>
                  <span className="truncate">{folder.name}</span>
                </button>
                <div className="flex items-center pr-2 shrink-0">
                  <span className="text-[10px] bg-slate-900/65 px-1.5 py-0.5 rounded-md text-gray-400 group-hover:hidden">
                    {folderNoteCount}
                  </span>
                  <button
                    onClick={() => onDeleteFolder(folder.id)}
                    className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-red-500/10 hidden group-hover:inline-block transition-all"
                    title="Delete Folder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dynamic Tags Filter inside Folder */}
      {allTags.length > 0 && (
        <div className="p-4 border-b border-indigo-950/20 max-h-[110px] overflow-y-auto">
          <span className="font-display text-[10px] font-bold text-indigo-400/80 uppercase tracking-wider block mb-2">
            Filter by Tags
          </span>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => onSelectTag(null)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                selectedTag === null
                  ? "bg-cosmic-indigo text-white font-medium"
                  : "bg-indigo-950/40 text-gray-400 hover:bg-slate-800 hover:text-gray-200"
              }`}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onSelectTag(tag === selectedTag ? null : tag)}
                className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-1 transition-colors ${
                  selectedTag === tag
                    ? "bg-cosmic-teal text-slate-950 font-semibold"
                    : "bg-indigo-950/40 text-indigo-300 hover:bg-slate-800 hover:text-indigo-200"
                }`}
              >
                <Tag className="w-2.5 h-2.5 shrink-0" />
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Notes List Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-3 border-b border-indigo-950/20">
          {/* Note Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-slate-950/50 text-gray-100 placeholder-gray-500 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none border border-indigo-950/40 focus:border-cosmic-indigo transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* Note Action Toolbar */}
        <div className="px-4 py-2 flex flex-col gap-2 bg-indigo-950/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-indigo-300 font-medium">
              {activeFolderId ? folders.find((f) => f.id === activeFolderId)?.name || "Notes" : "All Notes"}
            </span>
            <span className="text-[9px] text-gray-500 font-mono">Select note mode</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onCreateNote("text")}
              className="flex items-center justify-center gap-1.5 text-[10px] bg-gradient-to-r from-cosmic-indigo to-indigo-600 hover:opacity-90 text-white py-1.5 rounded-xl transition-all shadow-md font-bold cursor-pointer"
            >
              <FileText className="w-3 h-3 text-cosmic-teal" />
              <span>+ Text Note</span>
            </button>
            <button
              onClick={() => onCreateNote("canvas")}
              className="flex items-center justify-center gap-1.5 text-[10px] bg-gradient-to-r from-teal-600 to-cosmic-teal hover:opacity-90 text-slate-950 py-1.5 rounded-xl transition-all shadow-md font-bold cursor-pointer"
            >
              <Layers className="w-3 h-3 text-white" />
              <span>+ Canvas Map</span>
            </button>
          </div>
        </div>

        {/* Notes Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredNotes.length === 0 ? (
            <div className="text-center py-10 px-4 text-gray-500 flex flex-col items-center justify-center gap-2">
              <FileText className="w-8 h-8 text-indigo-950" />
              <p className="text-xs font-medium">No notes match your filter</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onCreateNote("text")}
                  className="text-[10px] bg-cosmic-indigo text-white px-2.5 py-1 rounded-lg hover:underline"
                >
                  Create Text Note
                </button>
                <button
                  onClick={() => onCreateNote("canvas")}
                  className="text-[10px] bg-teal-600 text-slate-950 px-2.5 py-1 rounded-lg hover:underline"
                >
                  Create Canvas Note
                </button>
              </div>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const isActive = activeNoteId === note.id;
              const dateObj = new Date(note.updatedAt);
              const formattedDate = dateObj.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });

              const noteTypeIcon = note.noteType === "canvas" ? "🌌" : "📄";
              const noteTypeBadge = note.noteType === "canvas" ? "Canvas Map" : "Standard Text";

              return (
                <div
                  key={note.id}
                  className={`group relative p-3 rounded-xl cursor-pointer transition-all border ${
                    isActive
                      ? "bg-indigo-950/30 border-cosmic-indigo/50 shadow-md shadow-indigo-950/20"
                      : "bg-transparent border-transparent hover:bg-indigo-950/10 hover:border-indigo-950/20"
                  }`}
                  onClick={() => onSelectNote(note.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="text-[10px] shrink-0" title={noteTypeBadge}>{noteTypeIcon}</span>
                      <h3
                        className={`text-xs font-semibold truncate ${
                          isActive ? "text-indigo-200" : "text-gray-300 group-hover:text-gray-100"
                        }`}
                      >
                        {note.title || "Untitled Note"}
                      </h3>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(note.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all shrink-0"
                      title="Delete Note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-[11px] text-gray-500 line-clamp-2 mt-1 leading-relaxed">
                    {note.content ? note.content.substring(0, 80) : "No content yet..."}
                  </p>

                  <div className="flex items-center justify-between mt-2 text-[9px] text-gray-500 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-2.5 h-2.5 shrink-0" />
                      {formattedDate}
                    </span>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 overflow-hidden max-w-[120px] truncate">
                        {note.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="bg-indigo-950/50 text-indigo-300 border border-indigo-950 px-1 py-0.5 rounded text-[8px]"
                          >
                            {tag}
                          </span>
                        ))}
                        {note.tags.length > 2 && (
                          <span className="text-gray-600 text-[8px] self-center">+{note.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
