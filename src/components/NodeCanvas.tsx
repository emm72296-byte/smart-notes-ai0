import React, { useState, useEffect, useRef } from "react";
import { Note, Folder } from "../types";
import {
  MousePointer,
  Hand,
  Plus,
  Search,
  Trash2,
  Link2,
  Edit3,
  Maximize,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Sparkles,
  Layers,
  ChevronDown,
  Info,
} from "lucide-react";

interface CanvasNode {
  id: string;
  noteId?: string; // only used in global workspace mode
  title?: string;  // used in internal note mode
  content?: string;// used in internal note mode
  x: number;
  y: number;
  color?: string;  // indigo, teal, rose, amber, emerald, purple, slate
}

interface CanvasLink {
  id: string;
  source: string;
  target: string;
}

interface NodeCanvasProps {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
  onUpdateNote: (updatedNote: Note) => void;
  onSwitchToEditor: () => void;
  onCreateNote: (type: "text" | "canvas") => void;
}

const PRESET_COLORS = [
  { name: "Indigo", value: "indigo", border: "border-indigo-500/55", text: "text-indigo-400", bg: "bg-indigo-950/20" },
  { name: "Teal", value: "teal", border: "border-teal-500/55", text: "text-teal-400", bg: "bg-teal-950/20" },
  { name: "Rose", value: "rose", border: "border-rose-500/55", text: "text-rose-400", bg: "bg-rose-950/20" },
  { name: "Amber", value: "amber", border: "border-amber-500/55", text: "text-amber-400", bg: "bg-amber-950/20" },
  { name: "Emerald", value: "emerald", border: "border-emerald-500/55", text: "text-emerald-400", bg: "bg-emerald-950/20" },
  { name: "Purple", value: "purple", border: "border-purple-500/55", text: "text-purple-400", bg: "bg-purple-950/20" },
  { name: "Slate", value: "slate", border: "border-slate-500/55", text: "text-slate-400", bg: "bg-slate-900/30" },
];

// Helper to calculate sliding perimeter intersection bounds (W: 270, H: 160)
function getIntersectionPoint(c: { x: number; y: number }, t: { x: number; y: number }, w = 270, h = 160) {
  const dx = t.x - c.x;
  const dy = t.y - c.y;
  if (dx === 0 && dy === 0) return c;

  const tX_l = -w / 2;
  const tX_r = w / 2;
  const tY_t = -h / 2;
  const tY_b = h / 2;

  let t_min = Infinity;

  if (dx !== 0) {
    const t1 = tX_l / dx;
    if (t1 > 0 && t1 < t_min) {
      const y = c.y + t1 * dy;
      if (y >= c.y + tY_t && y <= c.y + tY_b) t_min = t1;
    }
    const t2 = tX_r / dx;
    if (t2 > 0 && t2 < t_min) {
      const y = c.y + t2 * dy;
      if (y >= c.y + tY_t && y <= c.y + tY_b) t_min = t2;
    }
  }

  if (dy !== 0) {
    const t3 = tY_t / dy;
    if (t3 > 0 && t3 < t_min) {
      const x = c.x + t3 * dx;
      if (x >= c.x + tX_l && x <= c.x + tX_r) t_min = t3;
    }
    const t4 = tY_b / dy;
    if (t4 > 0 && t4 < t_min) {
      const x = c.x + t4 * dx;
      if (x >= c.x + tX_l && x <= c.x + tX_r) t_min = t4;
    }
  }

  if (t_min !== Infinity) {
    return {
      x: c.x + t_min * dx,
      y: c.y + t_min * dy,
    };
  }
  return c;
}

export default function NodeCanvas({
  notes,
  folders,
  activeNoteId,
  onSelectNote,
  onUpdateNote,
  onSwitchToEditor,
  onCreateNote,
}: NodeCanvasProps) {
  const activeNote = notes.find((n) => n.id === activeNoteId) || null;
  const isInternalCanvas = activeNote && activeNote.noteType === "canvas";

  // Canvas Transform State
  const [panX, setPanX] = useState(100);
  const [panY, setPanY] = useState(100);
  const [zoom, setZoom] = useState(1);

  // Core Nodes and Links States
  const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
  const [canvasLinks, setCanvasLinks] = useState<CanvasLink[]>([]);

  // Interaction States
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<"pointer" | "hand">("pointer");

  // Mobile Touch States
  const touchZoomStartDistRef = useRef<number | null>(null);
  const touchZoomStartScaleRef = useRef<number>(1);

  // Linking flow
  const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null);
  const [liveLinkPos, setLiveLinkPos] = useState<{ x: number; y: number } | null>(null);

  // Notes Search & Spawn States
  const [searchQuery, setSearchQuery] = useState("");
  const [showSpawnDropdown, setShowSpawnDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Load and sync canvas content based on note state
  useEffect(() => {
    if (isInternalCanvas && activeNote) {
      try {
        if (activeNote.content && activeNote.content.trim().startsWith("{")) {
          const parsed = JSON.parse(activeNote.content);
          setCanvasNodes(parsed.nodes || []);
          setCanvasLinks(parsed.links || []);
          if (parsed.panX !== undefined) setPanX(parsed.panX);
          if (parsed.panY !== undefined) setPanY(parsed.panY);
          if (parsed.zoom !== undefined) setZoom(parsed.zoom);
        } else {
          // Default initial structured sub-nodes template
          const defaultData = {
            nodes: [
              { id: "node-1", title: "Core Objective", content: "Main project milestone target detail...", x: 100, y: 150, color: "indigo" },
              { id: "node-2", title: "Critical Dependency", content: "Subtask or requirement detail...", x: 450, y: 100, color: "teal" },
              { id: "node-3", title: "Resource Plan", content: "Budgeting and staffing details...", x: 450, y: 320, color: "rose" }
            ],
            links: [
              { id: "link-1", source: "node-1", target: "node-2" },
              { id: "link-2", source: "node-1", target: "node-3" }
            ],
            panX: 100,
            panY: 100,
            zoom: 1
          };
          setCanvasNodes(defaultData.nodes);
          setCanvasLinks(defaultData.links);
          setPanX(defaultData.panX);
          setPanY(defaultData.panY);
          setZoom(defaultData.zoom);

          // Write back to Note.content structure
          onUpdateNote({
            ...activeNote,
            content: JSON.stringify(defaultData, null, 2),
            updatedAt: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Failed to parse canvas note content:", e);
      }
    } else {
      // Global Whiteboard workspace load (relying on browser localStorage)
      const storedNodes = localStorage.getItem("smartnotes_canvas_nodes");
      const storedLinks = localStorage.getItem("smartnotes_canvas_links");

      if (storedNodes) {
        setCanvasNodes(JSON.parse(storedNodes));
      } else {
        const initialNodes = notes.slice(0, 3).map((note, idx) => ({
          id: "node-" + note.id,
          noteId: note.id,
          x: 100 + idx * 300,
          y: 150 + (idx % 2 === 0 ? 50 : -50),
          color: idx === 0 ? "indigo" : idx === 1 ? "teal" : "rose",
        }));
        setCanvasNodes(initialNodes);
        localStorage.setItem("smartnotes_canvas_nodes", JSON.stringify(initialNodes));
      }

      if (storedLinks) {
        setCanvasLinks(JSON.parse(storedLinks));
      } else if (notes.length >= 2) {
        const initialLinks = [
          {
            id: "link-init",
            source: "node-" + notes[0].id,
            target: "node-" + (notes[1]?.id || ""),
          },
        ].filter((l) => l.target);
        setCanvasLinks(initialLinks as CanvasLink[]);
        localStorage.setItem("smartnotes_canvas_links", JSON.stringify(initialLinks));
      }
    }
  }, [activeNoteId, isInternalCanvas]);

  // Synchronize layout changes
  const saveCanvasData = (nodes: CanvasNode[], links: CanvasLink[], customPanX = panX, customPanY = panY, customZoom = zoom) => {
    setCanvasNodes(nodes);
    setCanvasLinks(links);

    if (isInternalCanvas && activeNote) {
      const data = {
        nodes,
        links,
        panX: customPanX,
        panY: customPanY,
        zoom: customZoom
      };
      onUpdateNote({
        ...activeNote,
        content: JSON.stringify(data, null, 2),
        updatedAt: new Date().toISOString()
      });
    } else {
      localStorage.setItem("smartnotes_canvas_nodes", JSON.stringify(nodes));
      localStorage.setItem("smartnotes_canvas_links", JSON.stringify(links));
    }
  };

  // Listen for custom "project-mindmap-to-canvas" event dispatched by AILaboratory
  useEffect(() => {
    const handleProjectMindMap = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (!customEvent.detail) return;
      const { nodes: mindNodes, edges: mindEdges } = customEvent.detail;
      if (!mindNodes || mindNodes.length === 0) return;

      const idMap: Record<string, string> = {};
      const createdNodes: CanvasNode[] = [];
      const cx = 300;
      const cy = 250;

      const rootNodes = mindNodes.filter((n: any) => n.type === "root" || n.id === "root");
      const mainNodes = mindNodes.filter((n: any) => n.type === "main");
      const detailNodes = mindNodes.filter((n: any) => n.type === "detail" || (!rootNodes.includes(n) && !mainNodes.includes(n)));

      rootNodes.forEach((node: any, idx: number) => {
        const newId = "node-mind-" + Date.now() + "-" + node.id;
        idMap[node.id] = newId;
        createdNodes.push({
          id: newId,
          title: node.label,
          content: "Root concept mapped by Smart Notes AI.",
          x: cx + idx * 300 - (rootNodes.length - 1) * 150,
          y: cy,
          color: "indigo"
        });
      });

      if (rootNodes.length === 0 && mindNodes.length > 0) {
        const node = mindNodes[0];
        const newId = "node-mind-" + Date.now() + "-" + node.id;
        idMap[node.id] = newId;
        createdNodes.push({
          id: newId,
          title: node.label,
          content: "Core mapped node.",
          x: cx,
          y: cy,
          color: "indigo"
        });
      }

      mainNodes.forEach((node: any, idx: number) => {
        const newId = "node-mind-" + Date.now() + "-" + node.id;
        idMap[node.id] = newId;
        const angle = (idx / (mainNodes.length || 1)) * 2 * Math.PI;
        const radius = 280;
        createdNodes.push({
          id: newId,
          title: node.label,
          content: "Secondary concept detail.",
          x: Math.round(cx + radius * Math.cos(angle)),
          y: Math.round(cy + radius * Math.sin(angle)),
          color: "teal"
        });
      });

      detailNodes.forEach((node: any, idx: number) => {
        const newId = "node-mind-" + Date.now() + "-" + node.id;
        idMap[node.id] = newId;
        const angle = (idx / (detailNodes.length || 1)) * 2 * Math.PI;
        const radius = 500;
        createdNodes.push({
          id: newId,
          title: node.label,
          content: "Supporting research details...",
          x: Math.round(cx + radius * Math.cos(angle) + (Math.random() - 0.5) * 50),
          y: Math.round(cy + radius * Math.sin(angle) + (Math.random() - 0.5) * 50),
          color: "rose"
        });
      });

      const createdLinks: CanvasLink[] = [];
      mindEdges?.forEach((edge: any, idx: number) => {
        const srcId = idMap[edge.source];
        const tgtId = idMap[edge.target];
        if (srcId && tgtId) {
          createdLinks.push({
            id: `link-mind-${Date.now()}-${idx}`,
            source: srcId,
            target: tgtId
          });
        }
      });

      // Merge into the workspace
      saveCanvasData([...canvasNodes, ...createdNodes], [...canvasLinks, ...createdLinks]);
    };

    window.addEventListener("project-mindmap-to-canvas", handleProjectMindMap);
    return () => window.removeEventListener("project-mindmap-to-canvas", handleProjectMindMap);
  }, [canvasNodes, canvasLinks, panX, panY, zoom]);

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomIntensity = 0.05;
    const nextZoom = e.deltaY < 0 
      ? Math.min(2.5, zoom + zoomIntensity)
      : Math.max(0.15, zoom - zoomIntensity);

    setZoom(nextZoom);
    saveCanvasData(canvasNodes, canvasLinks, panX, panY, nextZoom);
  };

  // Mouse Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "hand" || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (linkingSourceId !== null) {
      const canvasX = Math.round((e.clientX - rect.left - panX) / zoom);
      const canvasY = Math.round((e.clientY - rect.top - panY) / zoom);
      setLiveLinkPos({ x: canvasX, y: canvasY });
      return;
    }

    if (isPanning) {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    } else if (draggedNodeId !== null) {
      const newX = Math.round((e.clientX - dragOffset.x) / zoom);
      const newY = Math.round((e.clientY - dragOffset.y) / zoom);

      const updatedNodes = canvasNodes.map((n) => {
        if (n.id === draggedNodeId) {
          return { ...n, x: newX, y: newY };
        }
        return n;
      });
      setCanvasNodes(updatedNodes);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    if (draggedNodeId !== null) {
      setDraggedNodeId(null);
    }
    setLiveLinkPos(null);
    saveCanvasData(canvasNodes, canvasLinks, panX, panY, zoom);
  };

  // Mobile Touch Event Handlers for Panning & Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (activeTool === "hand") {
        setIsPanning(true);
        setPanStart({ x: touch.clientX - panX, y: touch.clientY - panY });
      }
    } else if (e.touches.length === 2) {
      setIsPanning(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchZoomStartDistRef.current = dist;
      touchZoomStartScaleRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (linkingSourceId !== null && e.touches.length === 1) {
      const touch = e.touches[0];
      const canvasX = Math.round((touch.clientX - rect.left - panX) / zoom);
      const canvasY = Math.round((touch.clientY - rect.top - panY) / zoom);
      setLiveLinkPos({ x: canvasX, y: canvasY });
      return;
    }

    if (isPanning && e.touches.length === 1) {
      const touch = e.touches[0];
      setPanX(touch.clientX - panStart.x);
      setPanY(touch.clientY - panStart.y);
    } else if (e.touches.length === 2 && touchZoomStartDistRef.current !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / touchZoomStartDistRef.current;
      const nextZoom = Math.max(0.15, Math.min(2.5, touchZoomStartScaleRef.current * ratio));
      setZoom(nextZoom);
    } else if (draggedNodeId !== null && e.touches.length === 1) {
      const touch = e.touches[0];
      const newX = Math.round((touch.clientX - dragOffset.x) / zoom);
      const newY = Math.round((touch.clientY - dragOffset.y) / zoom);

      const updatedNodes = canvasNodes.map((n) => {
        if (n.id === draggedNodeId) {
          return { ...n, x: newX, y: newY };
        }
        return n;
      });
      setCanvasNodes(updatedNodes);
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    touchZoomStartDistRef.current = null;
    if (draggedNodeId !== null) {
      setDraggedNodeId(null);
    }
    setLiveLinkPos(null);
    saveCanvasData(canvasNodes, canvasLinks, panX, panY, zoom);
  };

  // Node Drag Start
  const handleNodeDragStart = (nodeId: string, e: React.MouseEvent) => {
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === "input" || targetTag === "textarea" || (e.target as HTMLElement).closest(".no-drag")) {
      return;
    }
    e.stopPropagation();
    if (activeTool === "hand") return;

    const node = canvasNodes.find((n) => n.id === nodeId);
    if (node) {
      setDraggedNodeId(nodeId);
      setDragOffset({
        x: e.clientX - node.x * zoom,
        y: e.clientY - node.y * zoom,
      });
    }
  };

  const handleNodeTouchStart = (nodeId: string, e: React.TouchEvent) => {
    const targetTag = (e.target as HTMLElement).tagName.toLowerCase();
    if (targetTag === "input" || targetTag === "textarea" || (e.target as HTMLElement).closest(".no-drag")) {
      return;
    }
    e.stopPropagation();
    if (activeTool === "hand") return;

    const touch = e.touches[0];
    const node = canvasNodes.find((n) => n.id === nodeId);
    if (node) {
      setDraggedNodeId(nodeId);
      setDragOffset({
        x: touch.clientX - node.x * zoom,
        y: touch.clientY - node.y * zoom,
      });
    }
  };

  // Internal Nodes Creator
  const handleAddInternalNode = () => {
    const viewportX = Math.round((-panX + 220) / zoom);
    const viewportY = Math.round((-panY + 160) / zoom);
    const newNode: CanvasNode = {
      id: "node-" + Date.now(),
      title: "New Concept Branch",
      content: "Brief explanatory details...",
      x: viewportX,
      y: viewportY,
      color: "indigo"
    };
    saveCanvasData([...canvasNodes, newNode], canvasLinks);
  };

  // Spawn note as a node (Global mode only)
  const handleSpawnNoteNode = (noteId: string) => {
    const exists = canvasNodes.find((n) => n.noteId === noteId);
    if (exists) {
      setPanX(-exists.x * zoom + 300);
      setPanY(-exists.y * zoom + 200);
      setShowSpawnDropdown(false);
      return;
    }

    const viewportX = Math.round((-panX + 300) / zoom);
    const viewportY = Math.round((-panY + 200) / zoom);

    const newNode: CanvasNode = {
      id: "node-" + Date.now(),
      noteId,
      x: viewportX,
      y: viewportY,
      color: "indigo",
    };

    saveCanvasData([...canvasNodes, newNode], canvasLinks);
    setShowSpawnDropdown(false);
  };

  // Double Click / Double Tap creates cards
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current) return;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const doubleClickX = Math.round((e.clientX - rect.left - panX) / zoom);
      const doubleClickY = Math.round((e.clientY - rect.top - panY) / zoom);

      if (isInternalCanvas) {
        const newNode: CanvasNode = {
          id: "node-" + Date.now(),
          title: "Double Click concept",
          content: "Tap to write details...",
          x: doubleClickX - 135,
          y: doubleClickY - 80,
          color: "teal"
        };
        saveCanvasData([...canvasNodes, newNode], canvasLinks);
      } else {
        const newNoteId = "n-" + Date.now();
        const newNote: Note = {
          id: newNoteId,
          title: "Whiteboard Concept Note",
          folderId: "f-scratchpad",
          tags: ["canvas", "brainstorm"],
          content: "Draft your canvas concepts here...",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const storedNotes = localStorage.getItem("smartnotes_notes");
        let allNotes = notes;
        if (storedNotes) {
          allNotes = JSON.parse(storedNotes);
        }
        const updatedNotes = [newNote, ...allNotes];
        localStorage.setItem("smartnotes_notes", JSON.stringify(updatedNotes));

        const newNode: CanvasNode = {
          id: "node-" + Date.now(),
          noteId: newNoteId,
          x: doubleClickX - 135,
          y: doubleClickY - 80,
          color: "teal",
        };

        saveCanvasData([...canvasNodes, newNode], canvasLinks);
        window.dispatchEvent(new Event("localstorage-notes-updated"));
      }
    }
  };

  // Direct border-to-border linking drop lock
  const handleCardPointerRelease = (targetNodeId: string) => {
    if (linkingSourceId && linkingSourceId !== targetNodeId) {
      const linkId = `link-${linkingSourceId}-${targetNodeId}`;
      const exists = canvasLinks.find(
        (l) =>
          (l.source === linkingSourceId && l.target === targetNodeId) ||
          (l.source === targetNodeId && l.target === linkingSourceId)
      );

      if (!exists) {
        saveCanvasData(canvasNodes, [...canvasLinks, { id: linkId, source: linkingSourceId, target: targetNodeId }]);
      }
    }
    setLinkingSourceId(null);
    setLiveLinkPos(null);
  };

  const handleNodeLinkAction = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (linkingSourceId === null) {
      setLinkingSourceId(nodeId);
    } else if (linkingSourceId === nodeId) {
      setLinkingSourceId(null);
      setLiveLinkPos(null);
    } else {
      const linkId = `link-${linkingSourceId}-${nodeId}`;
      const exists = canvasLinks.find(
        (l) =>
          (l.source === linkingSourceId && l.target === nodeId) ||
          (l.source === nodeId && l.target === linkingSourceId)
      );

      if (!exists) {
        saveCanvasData(canvasNodes, [...canvasLinks, { id: linkId, source: linkingSourceId, target: nodeId }]);
      }
      setLinkingSourceId(null);
      setLiveLinkPos(null);
    }
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextNodes = canvasNodes.filter((n) => n.id !== nodeId);
    const nextLinks = canvasLinks.filter((l) => l.source !== nodeId && l.target !== nodeId);
    saveCanvasData(nextNodes, nextLinks);
  };

  const handleDeleteLink = (linkId: string) => {
    const nextLinks = canvasLinks.filter((l) => l.id !== linkId);
    saveCanvasData(canvasNodes, nextLinks);
  };

  // Alignment
  const handleAutoAlignNodes = () => {
    const sortedNodes = [...canvasNodes].sort((a, b) => a.x - b.x);
    const nextNodes = sortedNodes.map((node, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      return {
        ...node,
        x: 100 + col * 320,
        y: 100 + row * 220,
      };
    });
    saveCanvasData(nextNodes, canvasLinks);
  };

  const handleSetNodeColor = (nodeId: string, color: string) => {
    const updated = canvasNodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, color };
      }
      return n;
    });
    saveCanvasData(updated, canvasLinks);
  };

  const handleInternalNodeTitleChange = (nodeId: string, value: string) => {
    const updated = canvasNodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, title: value };
      }
      return n;
    });
    saveCanvasData(updated, canvasLinks);
  };

  const handleInternalNodeContentChange = (nodeId: string, value: string) => {
    const updated = canvasNodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, content: value };
      }
      return n;
    });
    saveCanvasData(updated, canvasLinks);
  };

  const handleResetWorkspace = () => {
    setPanX(150);
    setPanY(120);
    setZoom(0.9);
    saveCanvasData(canvasNodes, canvasLinks, 150, 120, 0.9);
  };

  // Fully boundary-sliding perimeter curves with physics obstacle avoidance
  const calculateLinkCurve = (link: CanvasLink) => {
    const sourceNode = canvasNodes.find((n) => n.id === link.source);
    const targetNode = canvasNodes.find((n) => n.id === link.target);

    if (!sourceNode || !targetNode) return null;

    const cardWidth = 270;
    const cardHeight = 160;

    const sCenter = { x: sourceNode.x + cardWidth / 2, y: sourceNode.y + cardHeight / 2 };
    const tCenter = { x: targetNode.x + cardWidth / 2, y: targetNode.y + cardHeight / 2 };

    // Intersection sliding anchors
    const p1 = getIntersectionPoint(sCenter, tCenter, cardWidth, cardHeight);
    const p2 = getIntersectionPoint(tCenter, sCenter, cardWidth, cardHeight);

    const x1 = p1.x;
    const y1 = p1.y;
    const x2 = p2.x;
    const y2 = p2.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy);

    let cx1 = x1 + dx / 3;
    let cy1 = y1 + dy / 3;
    let cx2 = x1 + (2 * dx) / 3;
    let cy2 = y1 + (2 * dy) / 3;

    // Obstacle avoidance bending math
    let midX = (x1 + x2) / 2;
    let midY = (y1 + y2) / 2;

    for (const node of canvasNodes) {
      if (node.id === link.source || node.id === link.target) continue;
      const nCenter = { x: node.x + cardWidth / 2, y: node.y + cardHeight / 2 };
      
      const num = Math.abs((y2 - y1) * nCenter.x - (x2 - x1) * nCenter.y + x2 * y1 - y2 * x1);
      const den = Math.hypot(y2 - y1, x2 - x1);
      const dist = den === 0 ? 0 : num / den;

      if (dist < 130) {
        const dot = (nCenter.x - x1) * (x2 - x1) + (nCenter.y - y1) * (y2 - y1);
        if (dot > 0 && dot < d * d) {
          const px = -dy / d;
          const py = dx / d;
          
          const sign = ((nCenter.x - x1) * (y2 - y1) - (nCenter.y - y1) * (x2 - x1)) >= 0 ? -1 : 1;
          const pushAmount = (130 - dist) * 1.6;
          
          cx1 += px * pushAmount * sign;
          cy1 += py * pushAmount * sign;
          cx2 += px * pushAmount * sign;
          cy2 += py * pushAmount * sign;
          
          midX += px * pushAmount * sign * 0.5;
          midY += py * pushAmount * sign * 0.5;
          break; // bend away from the first intersecting card
        }
      }
    }

    return {
      path: `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`,
      midX,
      midY,
    };
  };

  const filteredNotesToSpawn = notes.filter((n) => {
    const titleMatch = n.title.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || contentMatch;
  });

  const containerRect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };

  return (
    <div className="flex-1 h-full bg-[#070913] flex flex-col relative select-none overflow-hidden">
      
      {/* Studio Grid Overlay Background */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-75"
        style={{
          backgroundImage: "radial-gradient(rgba(99, 102, 241, 0.12) 1.2px, transparent 1.2px)",
          backgroundSize: `${30 * zoom}px ${30 * zoom}px`,
          backgroundPosition: `${panX}px ${panY}px`,
        }}
      />

      {/* Top Header Workspace Navigation Toolbar */}
      <div className="absolute top-4 left-4 right-4 h-14 bg-[#0d1123]/90 border border-indigo-950/45 backdrop-blur-md rounded-2xl flex items-center justify-between px-4 z-20 shadow-xl shadow-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950/45 border border-indigo-950 px-2.5 py-1.5 rounded-xl">
            <Layers className="w-3.5 h-3.5 text-cosmic-teal" />
            <span className="text-xs font-bold font-display text-indigo-100 tracking-tight">
              {isInternalCanvas ? "Concept Map Studio" : "Whiteboard Studio"}
            </span>
          </div>

          <div className="flex bg-slate-950/50 p-1 border border-indigo-950 rounded-xl">
            <button
              onClick={() => setActiveTool("pointer")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                activeTool === "pointer"
                  ? "bg-cosmic-indigo text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="Select & Move Card"
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setActiveTool("hand")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                activeTool === "hand" ? "bg-cosmic-indigo text-white" : "text-gray-400 hover:text-gray-200"
              }`}
              title="Pan Infinite Canvas (Hand)"
            >
              <Hand className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Note Spawning / Internal Node Adding and Helper Dropdowns */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-indigo-400 font-mono bg-indigo-950/20 px-3 py-1.5 rounded-xl border border-indigo-950/30">
            <Info className="w-3 h-3 shrink-0" />
            <span>Drag border connector dot to link cards</span>
          </div>

          {isInternalCanvas ? (
            <button
              onClick={handleAddInternalNode}
              className="flex items-center gap-1.5 bg-gradient-to-r from-cosmic-indigo to-indigo-600 hover:opacity-90 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md border border-indigo-500/10 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-cosmic-teal" />
              <span>Add Concept Card</span>
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowSpawnDropdown(!showSpawnDropdown)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-cosmic-indigo to-indigo-600 hover:from-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all border border-indigo-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Project Note Card</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showSpawnDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-[#0d1123] border border-indigo-950/85 rounded-2xl shadow-2xl p-3 z-30 flex flex-col gap-2 max-h-[350px]">
                  <span className="text-[10px] font-bold text-indigo-300 font-display uppercase tracking-widest block">
                    Select Note to Spawn
                  </span>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search your library..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs bg-slate-950 text-gray-100 placeholder-gray-500 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none border border-indigo-950/45 focus:border-cosmic-indigo"
                    />
                    <Search className="w-3 h-3 text-gray-500 absolute left-2.5 top-2.5" />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {filteredNotesToSpawn.length === 0 ? (
                      <div className="text-center py-4 text-xs text-gray-500">No matching notes found</div>
                    ) : (
                      filteredNotesToSpawn.map((note) => {
                        const isProjected = canvasNodes.some((n) => n.noteId === note.id);
                        return (
                          <button
                            key={note.id}
                            onClick={() => handleSpawnNoteNode(note.id)}
                            className="w-full text-left p-2 rounded-xl text-xs hover:bg-indigo-950/20 text-gray-300 hover:text-white flex items-center justify-between transition-colors"
                          >
                            <span className="truncate max-w-[170px]">{note.title || "Untitled"}</span>
                            {isProjected ? (
                              <span className="text-[9px] bg-indigo-950 text-cosmic-teal font-mono border border-indigo-800/40 px-1.5 py-0.5 rounded">
                                On Canvas
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-500">Project</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleAutoAlignNodes}
            className="p-2 bg-slate-950/45 border border-indigo-950 rounded-xl text-gray-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            title="Auto Grid Layout Align"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleResetWorkspace}
            className="p-2 bg-slate-950/45 border border-indigo-950 rounded-xl text-gray-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            title="Focus Coordinates Center"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Canvas Side Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-1.5 bg-[#0d1123]/80 border border-indigo-950/50 p-1.5 rounded-2xl z-20 backdrop-blur-sm shadow-xl shadow-slate-950/50">
        <button
          onClick={() => {
            const nextZoom = Math.min(2.5, zoom + 0.1);
            setZoom(nextZoom);
            saveCanvasData(canvasNodes, canvasLinks, panX, panY, nextZoom);
          }}
          className="p-2 hover:bg-slate-950 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[9px] text-center text-gray-500 font-mono font-bold select-none border-y border-indigo-950 py-1">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => {
            const nextZoom = Math.max(0.15, zoom - 0.1);
            setZoom(nextZoom);
            saveCanvasData(canvasNodes, canvasLinks, panX, panY, nextZoom);
          }}
          className="p-2 hover:bg-slate-950 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {/* Visual Canvas Stage Container with mouse and touch events */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleCanvasDoubleClick}
        className={`w-full h-full relative outline-none overflow-hidden ${
          activeTool === "hand" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
      >
        {/* Connection Linkages SVG Canvas */}
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: "5000px",
            height: "5000px",
          }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#6366f1" />
            </marker>
          </defs>

          {/* Connection Lines */}
          {canvasLinks.map((link) => {
            const curve = calculateLinkCurve(link);
            if (!curve) return null;

            return (
              <g key={link.id} className="pointer-events-auto">
                <path
                  className="stroke-cosmic-indigo/65 hover:stroke-rose-500 transition-colors duration-150 cursor-pointer"
                  d={curve.path}
                  fill="none"
                  strokeWidth="2.5"
                  markerEnd="url(#arrow)"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Disconnect this link?")) {
                      handleDeleteLink(link.id);
                    }
                  }}
                  title="Click to disconnect link"
                />

                <circle
                  cx={curve.midX}
                  cy={curve.midY}
                  r="7"
                  className="fill-slate-950 stroke-indigo-950 stroke-2 hover:fill-rose-950 hover:stroke-rose-500 cursor-pointer animate-shimmer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLink(link.id);
                  }}
                  title="Delete Connection"
                />
              </g>
            );
          })}

          {/* Real-time drag-and-connect preview wire */}
          {linkingSourceId !== null && liveLinkPos !== null && (() => {
            const startNode = canvasNodes.find((n) => n.id === linkingSourceId);
            if (!startNode) return null;
            const startCenter = { x: startNode.x + 270 / 2, y: startNode.y + 160 / 2 };
            const borderStart = getIntersectionPoint(startCenter, liveLinkPos, 270, 160);
            const midX = (borderStart.x + liveLinkPos.x) / 2;
            const midY = (borderStart.y + liveLinkPos.y) / 2;
            return (
              <path
                d={`M ${borderStart.x} ${borderStart.y} C ${midX} ${borderStart.y}, ${midX} ${liveLinkPos.y}, ${liveLinkPos.x} ${liveLinkPos.y}`}
                fill="none"
                className="stroke-cosmic-teal stroke-2"
                strokeDasharray="4 4"
              />
            );
          })()}
        </svg>

        {/* Dynamic Absolute Positioned Note Nodes wrapper */}
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          }}
        >
          {canvasNodes.map((node) => {
            let title = "";
            let content = "";
            let color = node.color || "indigo";
            let subtitle = "";
            let isSelected = false;
            let tags: string[] = [];

            if (isInternalCanvas) {
              title = node.title || "";
              content = node.content || "";
              subtitle = "Branch Concept";
              isSelected = true;
            } else {
              const matchedNote = notes.find((n) => n.id === node.noteId);
              if (!matchedNote) return null;
              title = matchedNote.title || "Untitled Note";
              content = matchedNote.content || "";
              subtitle = folders.find((f) => f.id === matchedNote.folderId)?.name || "Workspace";
              isSelected = activeNoteId === matchedNote.id;
              tags = matchedNote.tags || [];
            }

            const colorPreset = PRESET_COLORS.find((c) => c.value === color) || PRESET_COLORS[0];

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeDragStart(node.id, e)}
                onTouchStart={(e) => handleNodeTouchStart(node.id, e)}
                onMouseUp={() => handleCardPointerRelease(node.id)}
                onTouchEnd={() => handleCardPointerRelease(node.id)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: "270px",
                  height: "160px",
                }}
                className={`absolute pointer-events-auto bg-[#0d1123]/95 border-2 rounded-2xl overflow-hidden shadow-2xl transition-shadow ${
                  colorPreset.border
                } ${
                  isSelected ? "ring-2 ring-indigo-500/40 shadow-indigo-950/70" : "shadow-slate-950/80"
                } ${linkingSourceId === node.id ? "ring-2 ring-cosmic-teal animate-pulse" : ""}`}
              >
                {/* Visual Connector Anchor on card border */}
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setLinkingSourceId(node.id);
                    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
                    const canvasX = Math.round((e.clientX - rect.left - panX) / zoom);
                    const canvasY = Math.round((e.clientY - rect.top - panY) / zoom);
                    setLiveLinkPos({ x: canvasX, y: canvasY });
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setLinkingSourceId(node.id);
                    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
                    const touch = e.touches[0];
                    const canvasX = Math.round((touch.clientX - rect.left - panX) / zoom);
                    const canvasY = Math.round((touch.clientY - rect.top - panY) / zoom);
                    setLiveLinkPos({ x: canvasX, y: canvasY });
                  }}
                  className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#070913] border-2 border-cosmic-teal rounded-full cursor-crosshair z-30 flex items-center justify-center hover:scale-125 hover:bg-cosmic-teal hover:border-white transition-all shadow-md shadow-slate-950 no-drag"
                  title="Drag to connect"
                >
                  <span className="w-1.5 h-1.5 bg-cosmic-teal rounded-full animate-pulse" />
                </div>

                {/* Node Card Header Handle */}
                <div className={`px-3.5 py-2 border-b border-indigo-950 flex items-center justify-between cursor-move bg-slate-950/40`}>
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="text-xs shrink-0">{color === "indigo" ? "🚀" : color === "teal" ? "💡" : "🔬"}</span>
                    <span className="text-[10px] font-bold tracking-tight uppercase font-mono text-gray-400 truncate">
                      {subtitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 no-drag">
                    {/* Connection Link handle */}
                    <button
                      onClick={(e) => handleNodeLinkAction(node.id, e)}
                      className={`p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer ${
                        linkingSourceId === node.id ? "text-cosmic-teal bg-teal-950/50" : "text-gray-500 hover:text-white"
                      }`}
                      title="Link to another node"
                    >
                      <Link2 className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => handleDeleteNode(node.id, e)}
                      className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Remove Node"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Node Body Content */}
                <div className="p-4 flex flex-col gap-2 no-drag">
                  {isInternalCanvas ? (
                    <>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => handleInternalNodeTitleChange(node.id, e.target.value)}
                        className="bg-transparent text-xs font-bold font-display text-white border-b border-indigo-900/30 focus:border-indigo-500/50 focus:outline-none w-full py-0.5"
                        placeholder="Give this concept a name..."
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      />

                      <textarea
                        value={content}
                        onChange={(e) => handleInternalNodeContentChange(node.id, e.target.value)}
                        className="bg-transparent text-[10.5px] text-gray-400 resize-none focus:outline-none w-full h-12 leading-relaxed mt-1"
                        placeholder="Describe this node's core ideas..."
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      />
                    </>
                  ) : (
                    <>
                      <h3 className="text-xs font-bold text-indigo-100 font-display line-clamp-1 leading-snug">
                        {title}
                      </h3>

                      <p className="text-[10.5px] text-gray-400 line-clamp-2 leading-relaxed font-sans whitespace-pre-wrap">
                        {content ? content.replace(/<[^>]*>/g, "") : "Empty content. Double click to type detail."}
                      </p>
                    </>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="bg-indigo-950/50 text-[8.5px] font-mono text-indigo-300 border border-indigo-900/30 px-1 py-0.5 rounded"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions & Color Picker Preset Swatches */}
                  <div className="flex items-center justify-between border-t border-indigo-950/45 pt-2 mt-auto">
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => handleSetNodeColor(node.id, c.value)}
                          style={{
                            backgroundColor: c.value === "indigo" ? "#6366f1" : c.value === "teal" ? "#06b6d4" : c.value === "rose" ? "#f43f5e" : c.value === "amber" ? "#f59e0b" : c.value === "emerald" ? "#10b981" : c.value === "purple" ? "#a855f7" : "#64748b"
                          }}
                          className={`w-3 h-3 rounded-full border border-slate-950 hover:scale-125 transition-transform cursor-pointer ${
                            color === c.value ? "ring-1 ring-white" : ""
                          }`}
                          title={`Color ${c.name}`}
                        />
                      ))}
                    </div>

                    {!isInternalCanvas && (
                      <button
                        onClick={() => {
                          const matchedNote = notes.find((n) => n.id === node.noteId);
                          if (matchedNote) {
                            onSelectNote(matchedNote.id);
                            onSwitchToEditor();
                          }
                        }}
                        className="flex items-center gap-1 text-[9.5px] text-cosmic-teal hover:text-indigo-200 transition-colors font-mono font-bold cursor-pointer"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Edit Doc</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Linking instructions banner */}
      {linkingSourceId !== null && (
        <div className="absolute bottom-6 left-6 bg-[#0d1123]/95 border border-cosmic-teal/40 p-3 rounded-2xl z-20 shadow-xl shadow-slate-950 max-w-sm flex items-center gap-2.5 animate-pulse">
          <Sparkles className="w-4 h-4 text-cosmic-teal shrink-0" />
          <div className="text-xs">
            <p className="text-indigo-200 font-bold">Linking Flow Activated</p>
            <p className="text-[10px] text-gray-400">Drag from the outer border dot onto another node card to connect relations.</p>
          </div>
          <button
            onClick={() => {
              setLinkingSourceId(null);
              setLiveLinkPos(null);
            }}
            className="text-[10px] bg-indigo-950 px-2.5 py-1 rounded-xl text-gray-400 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
