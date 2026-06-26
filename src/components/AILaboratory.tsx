import React, { useState, useEffect, useRef } from "react";
import { Note, LabToolType } from "../types";
import {
  Sparkles,
  RefreshCw,
  PenTool,
  ClipboardList,
  GitFork,
  Share2,
  Milestone,
  Columns3,
  GraduationCap,
  Grid,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Bot,
  User,
  Send,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

interface AILaboratoryProps {
  note: Note | null;
  onUpdateNote: (updatedNote: Note) => void;
  onTriggerAILab: (tool: LabToolType, additionalInput?: string) => Promise<any>;
}

export default function AILaboratory({
  note,
  onUpdateNote,
  onTriggerAILab,
}: AILaboratoryProps) {
  const [activeTab, setActiveTab] = useState<LabToolType>("summary");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Writer internal states
  const [selectedTone, setSelectedTone] = useState<string>("Professional");

  // Study Center internal states
  const [studySubTab, setStudySubTab] = useState<"guide" | "flashcards" | "quiz">("guide");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);

  // Workspace Assistant Chat internal states
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Mind map Canvas internal states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [localMindmap, setLocalMindmap] = useState<any>(null);
  const [mindmapZoom, setMindmapZoom] = useState<number>(0.95);
  const [mindmapPan, setMindmapPan] = useState({ x: 40, y: 20 });
  const [isPanningMindmap, setIsPanningMindmap] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchStartScale, setTouchStartScale] = useState<number>(1);

  // Reset tool specific index/state when note changes
  useEffect(() => {
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    setQuizAnswers({});
    setShowQuizResults(false);
    setChatHistory([
      {
        role: "assistant",
        content: `Greetings! I am your Workspace AI Assistant. I can answer questions, rewrite paragraphs, or extract items strictly based on the content of "${note?.title || "your active note"}". How can I help you today?`,
      },
    ]);
    setError(null);
    setLocalMindmap(null);
  }, [note?.id]);

  // Synchronize canvas coordinate positions when localMindmap is updated
  useEffect(() => {
    if (activeTab === "mindmap" && note?.cachedAI?.mindmap) {
      if (!localMindmap || localMindmap.noteId !== note.id) {
        const cached = note.cachedAI.mindmap;
        
        // Find the root node
        const rootNode = cached.nodes.find((n: any) => n.type === "root" || n.id === "root") || cached.nodes[0];
        
        // Space out child nodes outwards from the central topic (root) node
        const cx = 400;
        const cy = 300;

        const nodes = cached.nodes.map((node: any, idx: number) => {
          if (node.id === rootNode?.id) {
            return {
              ...node,
              x: node.x || cx,
              y: node.y || cy,
              vx: 0,
              vy: 0
            };
          }
          
          const isMain = node.type === "main";
          const angle = (idx / (cached.nodes.length || 1)) * 2 * Math.PI;
          const radius = isMain ? 150 : 250;

          return {
            ...node,
            x: node.x || cx + Math.cos(angle) * radius,
            y: node.y || cy + Math.sin(angle) * radius,
            vx: 0,
            vy: 0
          };
        });

        const isMobile = window.innerWidth < 768;
        setMindmapZoom(isMobile ? 0.65 : 0.95);
        setMindmapPan(isMobile ? { x: 80, y: 80 } : { x: 40, y: 20 });
        setLocalMindmap({ noteId: note.id, nodes, edges: cached.edges });
      }
    }
  }, [activeTab, note?.cachedAI?.mindmap, note?.id]);

  // Interactive Force-Directed Physics Simulation & HTML5 Canvas Draw Loop
  useEffect(() => {
    if (activeTab !== "mindmap" || !localMindmap || !canvasRef.current) return;

    let animId: number;
    let isMounted = true;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const runFrame = () => {
      if (!isMounted) return;

      const nodes = localMindmap.nodes;
      const edges = localMindmap.edges;

      if (nodes && nodes.length > 0) {
        // Compute dynamic pill node widths and heights based on label length
        nodes.forEach((node: any) => {
          if (node.vx === undefined) node.vx = 0;
          if (node.vy === undefined) node.vy = 0;

          ctx.font = node.type === "root" ? "bold 11px system-ui" : "10px system-ui";
          const labelWidth = ctx.measureText(node.label).width;
          node.width = Math.max(90, labelWidth + 32);
          node.height = node.type === "root" ? 38 : node.type === "main" ? 32 : 26;
        });

        // Resolve forces in 3 fast steps per frame
        for (let iter = 0; iter < 3; iter++) {
          // 1. All nodes repulsive charge + strict 80px overlap push
          for (let i = 0; i < nodes.length; i++) {
            const u = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
              const v = nodes[j];
              const dx = v.x - u.x;
              const dy = v.y - u.y;
              const dist = Math.hypot(dx, dy) || 1;

              // Enforce 80px margin between node edges
              const minDist = (u.width + v.width) / 2 + 80;
              if (dist < minDist) {
                const force = (minDist - dist) * 0.08;
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (u.id !== draggedNodeId) {
                  u.vx -= fx;
                  u.vy -= fy;
                }
                if (v.id !== draggedNodeId) {
                  v.vx += fx;
                  v.vy += fy;
                }
              } else {
                // Secondary background soft push
                const force = 300 / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                if (u.id !== draggedNodeId) {
                  u.vx -= fx;
                  u.vy -= fy;
                }
                if (v.id !== draggedNodeId) {
                  v.vx += fx;
                  v.vy += fy;
                }
              }
            }
          }

          // 2. Spring linkages along edges
          edges.forEach((edge: any) => {
            const u = nodes.find((n: any) => n.id === edge.source);
            const v = nodes.find((n: any) => n.id === edge.target);
            if (u && v) {
              const dx = v.x - u.x;
              const dy = v.y - u.y;
              const dist = Math.hypot(dx, dy) || 1;
              const springLength = 130;
              const force = (dist - springLength) * 0.035;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (u.id !== draggedNodeId) {
                u.vx += fx;
                u.vy += fy;
              }
              if (v.id !== draggedNodeId) {
                v.vx -= fx;
                v.vy -= fy;
              }
            }
          });

          // 3. Gravity Centering
          const cx = 400;
          const cy = 300;
          nodes.forEach((node: any) => {
            if (node.id === draggedNodeId) return;
            const dx = cx - node.x;
            const dy = cy - node.y;
            node.vx += dx * 0.005;
            node.vy += dy * 0.005;
          });

          // Apply displacement
          nodes.forEach((node: any) => {
            if (node.id === draggedNodeId) return;

            node.x += node.vx;
            node.y += node.vy;

            node.vx *= 0.82;
            node.vy *= 0.82;

            // Keep inside standard bounds
            node.x = Math.max(80, Math.min(720, node.x));
            node.y = Math.max(60, Math.min(540, node.y));
          });

          // 4. Strict Collision Resolver
          for (let i = 0; i < nodes.length; i++) {
            const u = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
              const v = nodes[j];
              const dx = v.x - u.x;
              const dy = v.y - u.y;
              const dist = Math.hypot(dx, dy) || 1;
              const minDist = (u.width + v.width) / 2 + 80;
              if (dist < minDist) {
                const overlap = minDist - dist;
                const pushX = (dx / dist) * overlap * 0.5;
                const pushY = (dy / dist) * overlap * 0.5;

                if (u.id === draggedNodeId) {
                  v.x += pushX * 2;
                  v.y += pushY * 2;
                } else if (v.id === draggedNodeId) {
                  u.x -= pushX * 2;
                  u.y -= pushY * 2;
                } else {
                  u.x -= pushX;
                  u.y -= pushY;
                  v.x += pushX;
                  v.y += pushY;
                }
              }
            }
          }
        }
      }

      // Drawing Loop
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(mindmapPan.x, mindmapPan.y);
      ctx.scale(mindmapZoom, mindmapZoom);

      // Draw connection lines
      ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
      ctx.lineWidth = 2.2;
      edges.forEach((edge: any) => {
        const u = nodes.find((n: any) => n.id === edge.source);
        const v = nodes.find((n: any) => n.id === edge.target);
        if (u && v) {
          ctx.beginPath();
          ctx.moveTo(u.x, u.y);
          ctx.lineTo(v.x, v.y);
          ctx.stroke();
        }
      });

      // Draw node cards (beautiful pills)
      nodes.forEach((node: any) => {
        const isRoot = node.type === "root";
        const isMain = node.type === "main";

        const halfW = node.width / 2;
        const halfH = node.height / 2;

        ctx.save();

        // High-end card glow shadows
        ctx.shadowBlur = isRoot ? 16 : isMain ? 10 : 6;
        ctx.shadowColor = isRoot ? "rgba(6, 182, 212, 0.65)" : isMain ? "rgba(99, 102, 241, 0.5)" : "rgba(59, 130, 246, 0.3)";

        // Card style
        ctx.fillStyle = isRoot ? "#082f49" : isMain ? "#1e1b4b" : "#0f172a";
        ctx.strokeStyle = isRoot ? "#06b6d4" : isMain ? "#6366f1" : "#3b82f6";
        ctx.lineWidth = isRoot ? 2.5 : isMain ? 2 : 1.5;

        drawRoundedRect(ctx, node.x - halfW, node.y - halfH, node.width, node.height, 12);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Node Text
        ctx.fillStyle = isRoot ? "#e0f2fe" : isMain ? "#f3f4f6" : "#cbd5e1";
        ctx.font = isRoot ? "bold 11px system-ui" : isMain ? "medium 10px system-ui" : "10px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(node.label, node.x, node.y);
      });

      ctx.restore();

      animId = requestAnimationFrame(runFrame);
    };

    animId = requestAnimationFrame(runFrame);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [activeTab, localMindmap, mindmapZoom, mindmapPan, draggedNodeId]);

  // Handle zooming using non-passive canvas wheel listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = 1.1;
      let nextZoom = mindmapZoom;
      if (e.deltaY < 0) {
        nextZoom = Math.min(3, mindmapZoom * zoomFactor);
      } else {
        nextZoom = Math.max(0.3, mindmapZoom / zoomFactor);
      }

      // Keep focus on mouse pointer position
      const modelX = (mouseX - mindmapPan.x) / mindmapZoom;
      const modelY = (mouseY - mindmapPan.y) / mindmapZoom;

      setMindmapPan({
        x: mouseX - modelX * nextZoom,
        y: mouseY - modelY * nextZoom,
      });
      setMindmapZoom(nextZoom);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [mindmapZoom, mindmapPan]);

  // Scroll Chat Assistant to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  if (!note) return null;

  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await onTriggerAILab(activeTab);
      if (activeTab === "mindmap" && data) {
        const rootNode = data.nodes.find((n: any) => n.type === "root" || n.id === "root") || data.nodes[0];
        const cx = 400;
        const cy = 300;

        const nodes = data.nodes.map((node: any, idx: number) => {
          if (node.id === rootNode?.id) {
            return { ...node, x: cx, y: cy, vx: 0, vy: 0 };
          }
          const isMain = data.nodes.filter((n: any) => n.type === "main").includes(node);
          const angle = (idx / (data.nodes.length || 1)) * 2 * Math.PI;
          const radius = isMain ? 150 : 250;
          return {
            ...node,
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            vx: 0,
            vy: 0
          };
        });

        const isMobile = window.innerWidth < 768;
        setMindmapZoom(isMobile ? 0.65 : 0.95);
        setMindmapPan(isMobile ? { x: 80, y: 80 } : { x: 40, y: 20 });
        setLocalMindmap({ noteId: note.id, nodes, edges: data.edges });
      }
    } catch (err: any) {
      setError(err.message || "Cognitive lab engine stalled. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage.trim();
    setChatMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const result = await onTriggerAILab("chat", userMsg);
      if (result && result.response) {
        setChatHistory((prev) => [...prev, { role: "assistant", content: result.response }]);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: `Failed to synthesize response: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Canvas Mouse Down (Dragging Mind Map)
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!localMindmap) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse to transformed coordinates
    const modelX = (mouseX - mindmapPan.x) / mindmapZoom;
    const modelY = (mouseY - mindmapPan.y) / mindmapZoom;

    // Check if clicked any node pill
    const clickedNode = localMindmap.nodes.find((node: any) => {
      const halfW = node.width / 2 || 40;
      const halfH = node.height / 2 || 15;
      return (
        modelX >= node.x - halfW &&
        modelX <= node.x + halfW &&
        modelY >= node.y - halfH &&
        modelY <= node.y + halfH
      );
    });

    if (clickedNode) {
      setDraggedNodeId(clickedNode.id);
    } else {
      setIsPanningMindmap(true);
      setPanStart({ x: e.clientX - mindmapPan.x, y: e.clientY - mindmapPan.y });
    }
  };

  // Canvas Mouse Move (Dragging Mind Map)
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggedNodeId && localMindmap) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const modelX = (mouseX - mindmapPan.x) / mindmapZoom;
      const modelY = (mouseY - mindmapPan.y) / mindmapZoom;

      const updatedNodes = localMindmap.nodes.map((node: any) => {
        if (node.id === draggedNodeId) {
          const boundedX = Math.max(50, Math.min(750, modelX));
          const boundedY = Math.max(50, Math.min(550, modelY));
          return { ...node, x: boundedX, y: boundedY, vx: 0, vy: 0 };
        }
        return node;
      });

      setLocalMindmap({ ...localMindmap, nodes: updatedNodes });
    } else if (isPanningMindmap) {
      setMindmapPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  // Canvas Mouse Up
  const handleCanvasMouseUp = () => {
    if (draggedNodeId && localMindmap) {
      setDraggedNodeId(null);
      const updatedNote = {
        ...note,
        cachedAI: {
          ...note.cachedAI,
          mindmap: {
            nodes: localMindmap.nodes,
            edges: localMindmap.edges,
          },
        },
      };
      onUpdateNote(updatedNote);
    }
    setIsPanningMindmap(false);
  };

  // Mobile Touch events for mindmap
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!localMindmap) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const mouseX = touch.clientX - rect.left;
      const mouseY = touch.clientY - rect.top;

      const modelX = (mouseX - mindmapPan.x) / mindmapZoom;
      const modelY = (mouseY - mindmapPan.y) / mindmapZoom;

      const clickedNode = localMindmap.nodes.find((node: any) => {
        const halfW = node.width / 2 || 40;
        const halfH = node.height / 2 || 15;
        return (
          modelX >= node.x - halfW &&
          modelX <= node.x + halfW &&
          modelY >= node.y - halfH &&
          modelY <= node.y + halfH
        );
      });

      if (clickedNode) {
        setDraggedNodeId(clickedNode.id);
      } else {
        setIsPanningMindmap(true);
        setPanStart({ x: touch.clientX - mindmapPan.x, y: touch.clientY - mindmapPan.y });
      }
    } else if (e.touches.length === 2) {
      setDraggedNodeId(null);
      setIsPanningMindmap(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      setTouchStartDist(dist);
      setTouchStartScale(mindmapZoom);
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggedNodeId && localMindmap) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const mouseX = touch.clientX - rect.left;
      const mouseY = touch.clientY - rect.top;

      const modelX = (mouseX - mindmapPan.x) / mindmapZoom;
      const modelY = (mouseY - mindmapPan.y) / mindmapZoom;

      const updatedNodes = localMindmap.nodes.map((node: any) => {
        if (node.id === draggedNodeId) {
          const boundedX = Math.max(50, Math.min(750, modelX));
          const boundedY = Math.max(50, Math.min(550, modelY));
          return { ...node, x: boundedX, y: boundedY, vx: 0, vy: 0 };
        }
        return node;
      });

      setLocalMindmap({ ...localMindmap, nodes: updatedNodes });
    } else if (isPanningMindmap && e.touches.length === 1) {
      const touch = e.touches[0];
      setMindmapPan({
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y,
      });
    } else if (e.touches.length === 2 && touchStartDist !== null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const ratio = dist / touchStartDist;
      const nextZoom = Math.max(0.3, Math.min(3, touchStartScale * ratio));
      setMindmapZoom(nextZoom);
    }
  };

  const handleCanvasTouchEnd = () => {
    setTouchStartDist(null);
    handleCanvasMouseUp();
  };

  // Apply written tone to note body
  const handleApplyToneToNote = (textToApply: string) => {
    onUpdateNote({
      ...note,
      content: textToApply,
      updatedAt: new Date().toISOString(),
    });
  };

  // Toggle checklist item in summary
  const handleToggleChecklistItem = (index: number) => {
    if (note.cachedAI?.summary) {
      const updatedChecklist = [...note.cachedAI.summary.checklist];
      updatedChecklist[index].completed = !updatedChecklist[index].completed;

      onUpdateNote({
        ...note,
        cachedAI: {
          ...note.cachedAI,
          summary: {
            ...note.cachedAI.summary,
            checklist: updatedChecklist,
          },
        },
      });
    }
  };

  // Shift Kanban column
  const handleShiftKanban = (task: string, fromCol: "todo" | "inprogress" | "done", direction: "left" | "right") => {
    if (note.cachedAI?.kanban) {
      const kanban = note.cachedAI.kanban;
      let todo = [...kanban.todo];
      let inprogress = [...kanban.inprogress];
      let done = [...kanban.done];

      // Remove from old column
      if (fromCol === "todo") todo = todo.filter((t) => t !== task);
      else if (fromCol === "inprogress") inprogress = inprogress.filter((t) => t !== task);
      else if (fromCol === "done") done = done.filter((t) => t !== task);

      // Add to new column
      if (fromCol === "todo" && direction === "right") {
        inprogress.push(task);
      } else if (fromCol === "inprogress") {
        if (direction === "left") {
          todo.push(task);
        } else {
          done.push(task);
        }
      } else if (fromCol === "done" && direction === "left") {
        inprogress.push(task);
      }

      onUpdateNote({
        ...note,
        cachedAI: {
          ...note.cachedAI,
          kanban: { todo, inprogress, done },
        },
      });
    }
  };

  // Create standard action tools list for render
  const labs = [
    { type: "summary", label: "Dashboard", icon: ClipboardList },
    { type: "writer", label: "AI Writer", icon: PenTool },
    { type: "tree", label: "Concept Tree", icon: GitFork },
    { type: "mindmap", label: "Mind Map", icon: Share2 },
    { type: "roadmap", label: "Roadmap", icon: Milestone },
    { type: "kanban", label: "Kanban", icon: Columns3 },
    { type: "study", label: "Study Lab", icon: GraduationCap },
    { type: "decision", label: "Decision", icon: Grid },
    { type: "chat", label: "Assistant", icon: MessageSquare },
  ];

  const cachedData = note.cachedAI?.[activeTab as keyof typeof note.cachedAI];

  // Specific Type Casts to satisfy TypeScript compiler on dynamic tabs
  const writerData = cachedData as Record<string, string> | undefined;
  const summaryData = cachedData as {
    summary: string;
    bulletPoints: string[];
    keyDates: { date: string; event: string }[];
    names: { name: string; role: string }[];
    checklist: { task: string; completed: boolean }[];
  } | undefined;
  const treeData = cachedData as {
    name: string;
    children?: any[];
  } | undefined;
  const roadmapData = cachedData as {
    phases: { phase: string; duration: string; details: string; status: string }[];
  } | undefined;
  const kanbanData = cachedData as {
    todo: string[];
    inprogress: string[];
    done: string[];
  } | undefined;
  const studyData = cachedData as {
    summaryGuide: string;
    flashcards: { front: string; back: string }[];
    quiz: { question: string; options: string[]; answerIndex: number; explanation: string }[];
  } | undefined;
  const decisionData = cachedData as {
    criteria: string[];
    options: { name: string; scores: number[]; total: number; analysis: string }[];
  } | undefined;

  return (
    <div className="w-full md:w-[400px] h-full bg-cosmic-sidebar flex flex-col overflow-hidden text-gray-200">
      {/* Tab Select Header */}
      <div className="p-4 border-b border-indigo-950/40 bg-slate-950/30">
        <span className="font-display text-[11px] font-bold text-indigo-400 uppercase tracking-wider block mb-3">
          AI Cognitive Laboratories
        </span>
        <div className="grid grid-cols-5 gap-1">
          {labs.map((lab) => {
            const Icon = lab.icon;
            const isActive = activeTab === lab.type;
            return (
              <button
                key={lab.type}
                onClick={() => {
                  setActiveTab(lab.type as LabToolType);
                  setError(null);
                }}
                className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                  isActive
                    ? "bg-gradient-to-b from-cosmic-indigo/35 to-cosmic-indigo/10 text-indigo-200 border border-cosmic-indigo/55"
                    : "hover:bg-indigo-950/15 text-gray-400 hover:text-gray-200 border border-transparent"
                }`}
                title={lab.label}
              >
                <Icon className={`w-4 h-4 mb-1 ${isActive ? "text-cosmic-teal" : "text-gray-400"}`} />
                <span className="text-[8.5px] truncate max-w-full font-medium leading-none">
                  {lab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Drawer Dashboard Panel */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 flex flex-col min-h-0">
        {/* Header Title with Re-Analyze triggers */}
        <div className="flex items-center justify-between border-b border-indigo-950/20 pb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-cosmic-teal animate-pulse" />
            <h2 className="font-display font-bold text-sm text-indigo-200">
              {labs.find((l) => l.type === activeTab)?.label}
            </h2>
          </div>

          {/* Quick Trigger Button */}
          {activeTab !== "chat" && (
            <button
              onClick={handleRunAnalysis}
              disabled={loading}
              className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md transition-all font-mono font-medium ${
                cachedData
                  ? "bg-slate-900 border border-indigo-950 hover:bg-slate-800 text-indigo-400"
                  : "bg-gradient-to-r from-cosmic-indigo to-indigo-600 text-white hover:opacity-90 shadow-sm"
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              <span>{cachedData ? "Re-Analyze" : "Synthesize AI"}</span>
            </button>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 bg-red-950/30 border border-red-500/25 rounded-xl flex items-start gap-2 text-xs text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* Loader panel */}
        {loading && activeTab !== "chat" && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-cosmic-indigo/20 border-t-cosmic-teal rounded-full animate-spin" />
              <Sparkles className="w-4 h-4 text-cosmic-teal absolute animate-pulse" />
            </div>
            <p className="font-mono text-[10px] text-indigo-300 animate-pulse text-center">
              Engaging Flash Cognitive Engine...
            </p>
          </div>
        )}

        {/* Empty State placeholder */}
        {!cachedData && !loading && activeTab !== "chat" && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500 border border-dashed border-indigo-950/40 rounded-2xl bg-cosmic-card/10">
            <Sparkles className="w-8 h-8 text-indigo-950 mb-3 animate-pulse" />
            <h3 className="text-xs font-semibold text-indigo-300">Analysis Pending</h3>
            <p className="text-[11px] text-gray-500 max-w-xs mt-1 leading-relaxed">
              Unlock actionable timelines, interactive dashboards, checklists, and 3D flip-cards. Click "Synthesize AI" to invoke our 2.5-flash context analyser.
            </p>
            <button
              onClick={handleRunAnalysis}
              className="mt-4 px-4 py-1.5 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/40 text-indigo-200 rounded-lg text-xs font-medium transition-all"
            >
              Analyze Note
            </button>
          </div>
        )}

        {/* TOOL VIEWS */}

        {/* 1. AI Writer */}
        {activeTab === "writer" && writerData && !loading && (
          <div className="space-y-4">
            {/* Tone filter selector */}
            <div className="flex flex-wrap gap-1">
              {Object.keys(writerData).map((tone) => (
                <button
                  key={tone}
                  onClick={() => setSelectedTone(tone)}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                    selectedTone === tone
                      ? "bg-cosmic-indigo text-white shadow-sm"
                      : "bg-slate-900 text-gray-400 hover:text-gray-200 hover:bg-slate-800"
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>

            {/* Side-by-Side Panel */}
            <div className="space-y-3 mt-2">
              <div className="p-3 bg-slate-950/45 rounded-xl border border-indigo-950/20">
                <span className="font-mono text-[9px] text-gray-500 uppercase tracking-wider block mb-1">
                  Original Excerpt:
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed max-h-[100px] overflow-y-auto">
                  {note.content || "(Note content is empty)"}
                </p>
              </div>

              <div className="p-4 bg-cosmic-card rounded-xl border border-cosmic-indigo/25 shadow-lg shadow-indigo-950/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-display text-[10px] font-bold text-cosmic-teal uppercase tracking-wider">
                    {selectedTone} Version:
                  </span>
                  <button
                    onClick={() => handleApplyToneToNote(writerData[selectedTone])}
                    className="flex items-center gap-1 text-[9px] bg-cosmic-indigo hover:bg-indigo-500 text-white px-2 py-0.5 rounded transition-all"
                  >
                    Apply to Note
                  </button>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed font-sans select-all whitespace-pre-wrap">
                  {writerData[selectedTone]}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Summary Dashboard */}
        {activeTab === "summary" && summaryData && !loading && (
          <div className="space-y-4">
            {/* Brief High level Summary */}
            <div className="p-3.5 bg-slate-950/50 rounded-xl border-l-4 border-cosmic-teal text-xs text-gray-300 italic leading-relaxed">
              "{summaryData.summary}"
            </div>

            {/* Key Bullet Points */}
            <div className="p-4 bg-cosmic-card/60 rounded-xl border border-indigo-950/30">
              <span className="font-display text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-2">
                Core Takeaways
              </span>
              <ul className="space-y-2 text-xs">
                {summaryData.bulletPoints?.map((bp: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-300">
                    <span className="text-cosmic-indigo mt-1">✦</span>
                    <span className="leading-relaxed">{bp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Key Dates & Names Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Dates */}
              <div className="p-3 bg-cosmic-card/45 rounded-xl border border-indigo-950/30 max-h-[180px] overflow-y-auto">
                <span className="font-display text-[9.5px] font-bold text-cosmic-teal uppercase tracking-wider block mb-2">
                  Timeline Events
                </span>
                {summaryData.keyDates && summaryData.keyDates.length > 0 ? (
                  <div className="space-y-1.5 text-[10px]">
                    {summaryData.keyDates.map((item: any, idx: number) => (
                      <div key={idx} className="border-b border-indigo-950/20 pb-1.5 last:border-0 last:pb-0">
                        <strong className="text-indigo-300 block">{item.date}</strong>
                        <span className="text-gray-400 leading-tight block">{item.event}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-500 italic">No specific dates detected.</span>
                )}
              </div>

              {/* Names */}
              <div className="p-3 bg-cosmic-card/45 rounded-xl border border-indigo-950/30 max-h-[180px] overflow-y-auto">
                <span className="font-display text-[9.5px] font-bold text-indigo-400 uppercase tracking-wider block mb-2">
                  Entities & Roles
                </span>
                {summaryData.names && summaryData.names.length > 0 ? (
                  <div className="space-y-1.5 text-[10px]">
                    {summaryData.names.map((item: any, idx: number) => (
                      <div key={idx} className="border-b border-indigo-950/20 pb-1.5 last:border-0 last:pb-0">
                        <strong className="text-indigo-200 block">{item.name}</strong>
                        <span className="text-gray-500 leading-tight block">{item.role}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-500 italic">No names detected.</span>
                )}
              </div>
            </div>

            {/* Interactive Task Checklist */}
            <div className="p-4 bg-slate-950/40 rounded-xl border border-indigo-950/40">
              <span className="font-display text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-2">
                Extracted Task Actionables
              </span>
              {summaryData.checklist && summaryData.checklist.length > 0 ? (
                <div className="space-y-1.5">
                  {summaryData.checklist.map((item: any, idx: number) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2.5 cursor-pointer text-xs select-none hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklistItem(idx)}
                        className="w-3.5 h-3.5 accent-cosmic-indigo bg-cosmic-bg rounded border-indigo-950"
                      />
                      <span className={item.completed ? "line-through text-gray-500" : "text-gray-300"}>
                        {item.task}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <span className="text-[10px] text-gray-500 italic">No actionable tasks extracted.</span>
              )}
            </div>
          </div>
        )}

        {/* 3. Concept Tree */}
        {activeTab === "tree" && treeData && !loading && (
          <div className="p-4 bg-cosmic-card/50 rounded-xl border border-indigo-950/30 overflow-x-auto">
            {/* Recursive Concept Tree Visualizer */}
            <span className="font-display text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-3">
              Concept Hierarchy Tree
            </span>
            <div className="text-xs">
              <TreeNode node={treeData} />
            </div>
          </div>
        )}

        {/* 4. Mind Map */}
        {activeTab === "mindmap" && cachedData && !loading && (
          <div className="space-y-2">
            <span className="font-display text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
              Interactive Draggable Mind Map
            </span>
            <div className="border border-indigo-950/50 rounded-xl overflow-hidden bg-slate-950/70 select-none relative group">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                onTouchStart={handleCanvasTouchStart}
                onTouchMove={handleCanvasTouchMove}
                onTouchEnd={handleCanvasTouchEnd}
                className="w-full h-[320px] sm:h-[400px] cursor-grab active:cursor-grabbing bg-[#030408]"
              />

              {/* Dynamic Pan/Zoom HUD Overlay */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-slate-950/85 border border-indigo-950/50 p-1 rounded-xl backdrop-blur-md z-10 shadow-lg shadow-black/80">
                <button
                  onClick={() => setMindmapZoom(z => Math.min(3, z * 1.15))}
                  className="w-7 h-7 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-900/35 text-indigo-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer select-none"
                  title="Zoom In"
                >
                  ＋
                </button>
                <span className="text-[9.5px] text-indigo-300 font-mono px-1 font-bold select-none min-w-[32px] text-center">
                  {Math.round(mindmapZoom * 100)}%
                </span>
                <button
                  onClick={() => setMindmapZoom(z => Math.max(0.3, z / 1.15))}
                  className="w-7 h-7 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-900/35 text-indigo-200 text-sm font-semibold rounded-lg transition-colors cursor-pointer select-none"
                  title="Zoom Out"
                >
                  －
                </button>
                <button
                  onClick={() => {
                    const isMobile = window.innerWidth < 768;
                    setMindmapZoom(isMobile ? 0.65 : 0.95);
                    setMindmapPan(isMobile ? { x: 80, y: 80 } : { x: 40, y: 20 });
                  }}
                  className="px-2 h-7 flex items-center justify-center bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-900/35 text-indigo-200 text-[10px] font-bold rounded-lg transition-colors cursor-pointer select-none"
                  title="Reset Coordinates"
                >
                  Reset
                </button>
              </div>
            </div>
            <p className="text-[9.5px] text-gray-500 font-mono text-center">
              💡 Drag nodes to move. Drag background to pan. Scroll/Pinch to zoom.
            </p>
            <button
              onClick={() => {
                const mindmapData = note.cachedAI?.mindmap;
                if (mindmapData) {
                  window.dispatchEvent(
                    new CustomEvent("project-mindmap-to-canvas", {
                      detail: {
                        nodes: mindmapData.nodes,
                        edges: mindmapData.edges,
                      },
                    })
                  );
                  window.dispatchEvent(new CustomEvent("switch-to-canvas-studio"));
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-xs text-indigo-200 rounded-xl transition-colors cursor-pointer mt-3 font-semibold shadow-md shadow-indigo-950/40"
            >
              <Share2 className="w-3.5 h-3.5 text-cosmic-teal animate-pulse" />
              <span>Project & Open Infinite Whiteboard</span>
            </button>
          </div>
        )}

        {/* 5. Operational Roadmap */}
        {activeTab === "roadmap" && roadmapData && !loading && (
          <div className="space-y-4">
            <span className="font-display text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
              Project Duration Chronology
            </span>
            <div className="relative border-l-2 border-indigo-950/60 ml-4 pl-4 space-y-5 py-2">
              {roadmapData.phases?.map((item: any, idx: number) => {
                const isCompleted = item.status === "Completed";
                const isInProgress = item.status === "In Progress";

                return (
                  <div key={idx} className="relative group">
                    {/* Node Dot Icon */}
                    <div
                      className={`w-3.5 h-3.5 rounded-full absolute -left-[23px] top-1 border-2 ${
                        isCompleted
                          ? "bg-cosmic-teal border-teal-500 shadow-sm shadow-teal-500/35"
                          : isInProgress
                          ? "bg-cosmic-indigo border-indigo-500 animate-pulse"
                          : "bg-slate-950 border-gray-600"
                      }`}
                    />

                    {/* Timeline Card */}
                    <div className="p-3 bg-cosmic-card/50 rounded-xl border border-indigo-950/30 group-hover:border-indigo-900/40 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                        <h4 className="text-xs font-bold text-indigo-200">{item.phase}</h4>
                        <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded font-mono text-cosmic-teal border border-indigo-950/40">
                          {item.duration}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed mb-2">{item.details}</p>
                      <span
                        className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          isCompleted
                            ? "bg-teal-950/50 text-cosmic-teal border border-teal-500/20"
                            : isInProgress
                            ? "bg-indigo-950/50 text-indigo-300 border border-indigo-500/20"
                            : "bg-slate-900 text-gray-500 border border-indigo-950/40"
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Kanban Board */}
        {activeTab === "kanban" && kanbanData && !loading && (
          <div className="space-y-3">
            <span className="font-display text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
              Task Kanban Columns
            </span>

            <div className="space-y-3">
              {(["todo", "inprogress", "done"] as const).map((colName) => {
                const columnTasks = kanbanData[colName] || [];
                const columnTitle =
                  colName === "todo" ? "To Do" : colName === "inprogress" ? "In Progress" : "Completed";
                const columnColor =
                  colName === "todo"
                    ? "border-indigo-500/20 bg-indigo-950/5"
                    : colName === "inprogress"
                    ? "border-cosmic-indigo/40 bg-indigo-950/15"
                    : "border-cosmic-teal/20 bg-teal-950/5";

                return (
                  <div key={colName} className={`p-3 rounded-xl border ${columnColor}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 font-display">
                        {columnTitle}
                      </span>
                      <span className="text-[10px] bg-slate-950 px-1.5 py-0.5 rounded text-gray-400 font-mono">
                        {columnTasks.length}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {columnTasks.length === 0 ? (
                        <div className="text-center py-2 text-[10px] text-gray-500 italic">Empty column</div>
                      ) : (
                        columnTasks.map((task: string, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-slate-950/50 rounded-lg border border-indigo-950/20 flex items-center justify-between gap-2"
                          >
                            <span className="text-xs text-gray-300 leading-tight">{task}</span>
                            <div className="flex gap-0.5 shrink-0">
                              {colName !== "todo" && (
                                <button
                                  onClick={() => handleShiftKanban(task, colName, "left")}
                                  className="p-0.5 text-gray-500 hover:text-indigo-400 hover:bg-slate-900 rounded"
                                  title="Shift left"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                              )}
                              {colName !== "done" && (
                                <button
                                  onClick={() => handleShiftKanban(task, colName, "right")}
                                  className="p-0.5 text-gray-500 hover:text-cosmic-teal hover:bg-slate-900 rounded"
                                  title="Shift right"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. Study Center */}
        {activeTab === "study" && studyData && !loading && (
          <div className="space-y-4">
            {/* Study Sub Tabs */}
            <div className="flex border-b border-indigo-950/30 p-0.5 bg-slate-950/40 rounded-lg">
              {(["guide", "flashcards", "quiz"] as const).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setStudySubTab(sub)}
                  className={`flex-1 text-center py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    studySubTab === sub
                      ? "bg-cosmic-indigo/35 text-indigo-100 border border-cosmic-indigo/30"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {sub === "guide" ? "Guide" : sub === "flashcards" ? "Flashcards" : "Quiz"}
                </button>
              ))}
            </div>

            {/* Sub View 1: Guide */}
            {studySubTab === "guide" && (
              <div className="p-4 bg-cosmic-card/45 rounded-xl border border-indigo-950/20 text-xs text-gray-300 leading-relaxed font-sans max-h-[300px] overflow-y-auto whitespace-pre-wrap">
                {studyData.summaryGuide}
              </div>
            )}

            {/* Sub View 2: Flashcards */}
            {studySubTab === "flashcards" && (
              <div className="space-y-3">
                {studyData.flashcards && studyData.flashcards.length > 0 ? (
                  <>
                    {/* Perspective card container */}
                    <div className="perspective-1000 w-full h-44">
                      <div
                        onClick={() => setIsCardFlipped(!isCardFlipped)}
                        className={`w-full h-full relative transform-style-3d transition-transform duration-500 cursor-pointer rounded-xl border border-indigo-900/40 ${
                          isCardFlipped ? "rotate-y-180" : ""
                        }`}
                      >
                        {/* Front Side */}
                        <div className="absolute inset-0 backface-hidden bg-cosmic-card/90 flex flex-col items-center justify-center p-5 text-center rounded-xl">
                          <span className="font-mono text-[9px] text-cosmic-teal uppercase tracking-widest block mb-2">
                            Question / Term
                          </span>
                          <p className="text-xs font-semibold text-gray-200">
                            {studyData.flashcards[currentCardIndex]?.front}
                          </p>
                          <span className="text-[9px] text-indigo-400 font-mono mt-4 opacity-50">
                            💡 Click to reveal answer
                          </span>
                        </div>

                        {/* Back Side */}
                        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-900 flex flex-col items-center justify-center p-5 text-center rounded-xl">
                          <span className="font-mono text-[9px] text-cosmic-indigo uppercase tracking-widest block mb-2">
                            Explanation / Definition
                          </span>
                          <p className="text-xs text-gray-300 leading-relaxed max-h-[100px] overflow-y-auto">
                            {studyData.flashcards[currentCardIndex]?.back}
                          </p>
                          <span className="text-[9px] text-gray-600 font-mono mt-4">
                            Click to flip back
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between text-xs font-mono">
                      <button
                        onClick={() => {
                          setIsCardFlipped(false);
                          setCurrentCardIndex((prev) => Math.max(0, prev - 1));
                        }}
                        disabled={currentCardIndex === 0}
                        className="p-1 rounded bg-slate-900 border border-indigo-950 text-indigo-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-gray-400">
                        Card {currentCardIndex + 1} of {studyData.flashcards.length}
                      </span>
                      <button
                        onClick={() => {
                          setIsCardFlipped(false);
                          setCurrentCardIndex((prev) => Math.min(studyData.flashcards.length - 1, prev + 1));
                        }}
                        disabled={currentCardIndex === studyData.flashcards.length - 1}
                        className="p-1 rounded bg-slate-900 border border-indigo-950 text-indigo-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-xs text-gray-500">No flashcards loaded.</div>
                )}
              </div>
            )}

            {/* Sub View 3: Quiz */}
            {studySubTab === "quiz" && (
              <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {studyData.quiz && studyData.quiz.length > 0 ? (
                  <div className="space-y-4">
                    {studyData.quiz.map((q: any, qIdx: number) => {
                      const selectedOptIdx = quizAnswers[qIdx];
                      const isAnswered = selectedOptIdx !== undefined;

                      return (
                        <div key={qIdx} className="p-3.5 bg-cosmic-card/40 rounded-xl border border-indigo-950/20">
                          <p className="text-xs font-bold text-indigo-200 mb-2">
                            Q{qIdx + 1}: {q.question}
                          </p>

                          <div className="space-y-1.5">
                            {q.options.map((opt: string, optIdx: number) => {
                              const isSelected = selectedOptIdx === optIdx;
                              const isCorrect = optIdx === q.answerIndex;
                              let btnClass = "bg-slate-950/50 border-indigo-950 hover:bg-indigo-950/10 text-gray-300";

                              if (showQuizResults && isAnswered) {
                                if (isCorrect) btnClass = "bg-teal-950/50 border-teal-500/50 text-teal-200";
                                else if (isSelected) btnClass = "bg-rose-950/50 border-rose-500/50 text-rose-200";
                              } else if (isSelected) {
                                btnClass = "bg-cosmic-indigo border-indigo-500 text-white";
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => {
                                    if (!showQuizResults) {
                                      setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
                                    }
                                  }}
                                  disabled={showQuizResults}
                                  className={`w-full text-left p-2 rounded-lg border text-xs leading-snug transition-colors ${btnClass}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {showQuizResults && q.explanation && (
                            <div className="p-2.5 bg-slate-950 rounded-lg text-[10.5px] text-gray-400 mt-2.5 border border-indigo-950/40">
                              <strong className="text-indigo-300">Explanation: </strong>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Quiz Controls */}
                    <div className="pt-2">
                      {!showQuizResults ? (
                        <button
                          onClick={() => setShowQuizResults(true)}
                          disabled={Object.keys(quizAnswers).length < studyData.quiz.length}
                          className="w-full py-2 bg-gradient-to-r from-cosmic-indigo to-indigo-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold text-white shadow"
                        >
                          Submit and Grade Quiz
                        </button>
                      ) : (
                        <div className="space-y-2 text-center">
                          <p className="text-xs font-bold font-mono text-cosmic-teal">
                            Score:{" "}
                            {studyData.quiz.reduce(
                              (acc: number, q: any, idx: number) => acc + (quizAnswers[idx] === q.answerIndex ? 1 : 0),
                              0
                            )}{" "}
                            / {studyData.quiz.length}
                          </p>
                          <button
                            onClick={() => {
                              setQuizAnswers({});
                              setShowQuizResults(false);
                            }}
                            className="w-full py-2 bg-slate-900 border border-indigo-950 hover:bg-slate-800 rounded-lg text-xs font-medium text-indigo-400"
                          >
                            Retake Quiz
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-gray-500">No quiz questions loaded.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 8. Decision Matrix */}
        {activeTab === "decision" && decisionData && !loading && (
          <div className="space-y-4">
            <span className="font-display text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
              Comparative Options Board
            </span>

            <div className="space-y-3">
              {decisionData.options?.map((opt: any, optIdx: number) => (
                <div key={optIdx} className="p-4 bg-cosmic-card/50 rounded-xl border border-indigo-950/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-indigo-200">{opt.name}</h4>
                    <span className="text-xs bg-slate-900 px-2 py-0.5 rounded font-mono text-cosmic-teal font-bold border border-indigo-950">
                      Total Score: {opt.total}
                    </span>
                  </div>

                  {/* Criteria scores layout */}
                  <div className="space-y-1.5 mb-3">
                    {decisionData.criteria?.map((crit: string, cIdx: number) => {
                      const score = opt.scores[cIdx] || 0;
                      let scoreColor = "text-indigo-400 bg-indigo-950/40";
                      if (score >= 8) scoreColor = "text-cosmic-teal bg-teal-950/40 border border-teal-500/20";
                      else if (score <= 4) scoreColor = "text-rose-400 bg-rose-950/40 border border-rose-500/20";

                      return (
                        <div key={cIdx} className="flex items-center justify-between text-[11px] font-sans">
                          <span className="text-gray-400">{crit}</span>
                          <span className={`px-1.5 py-0.5 rounded font-mono font-bold ${scoreColor}`}>
                            {score}/10
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-gray-500 leading-relaxed italic border-t border-indigo-950/20 pt-2">
                    {opt.analysis}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. Workspace Chat Assistant (Strictly note-content restricted) */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col min-h-[350px]">
            {/* Scanned status warning indicator */}
            <div className="px-3 py-1.5 bg-indigo-950/20 border border-indigo-950 rounded-lg text-[9.5px] text-gray-500 font-mono mb-3 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-cosmic-teal" />
              <span>Restricted strictly to active note text</span>
            </div>

            {/* Chat Messages Feed */}
            <div className="flex-1 overflow-y-auto space-y-2.5 p-1 mb-3 pr-2 border-b border-indigo-950/10 min-h-[220px] max-h-[300px]">
              {chatHistory.map((item, idx) => {
                const isUser = item.role === "user";
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        isUser ? "bg-cosmic-indigo" : "bg-cosmic-teal/25 border border-cosmic-teal/25"
                      }`}
                    >
                      {isUser ? (
                        <User className="w-3 h-3 text-white" />
                      ) : (
                        <Bot className="w-3 h-3 text-cosmic-teal" />
                      )}
                    </div>

                    <div
                      className={`p-2.5 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                        isUser
                          ? "bg-cosmic-indigo/15 text-indigo-100 border border-cosmic-indigo/25"
                          : "bg-cosmic-card text-gray-300"
                      }`}
                    >
                      {item.content}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-center gap-2 text-[10px] text-indigo-400/70 font-mono italic">
                  <Bot className="w-4 h-4 text-cosmic-teal animate-pulse" />
                  <span>Assistant is thinking...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input message form */}
            <form onSubmit={handleChatSend} className="flex gap-1.5 mt-auto">
              <input
                type="text"
                placeholder="Ask about active note text..."
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="flex-1 text-xs bg-slate-950 text-gray-100 placeholder-gray-500 rounded-lg px-3 py-2 border border-indigo-950/40 focus:outline-none focus:border-cosmic-indigo"
              />
              <button
                type="submit"
                disabled={loading || !chatMessage.trim()}
                className="p-2 bg-gradient-to-r from-cosmic-indigo to-indigo-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for Collapsible TreeNode in Concept Tree view
function TreeNode({ node, key }: { node: any; key?: any }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="pl-3.5 border-l border-indigo-950/40 ml-1 select-none" key={key}>
      <div className="flex items-center gap-1.5 py-1">
        {hasChildren ? (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5 hover:bg-slate-800 rounded text-indigo-400 shrink-0"
          >
            <span className="font-mono text-[9px] font-bold block w-3.5 text-center">
              {collapsed ? "▶" : "▼"}
            </span>
          </button>
        ) : (
          <span className="w-3.5 h-3.5 shrink-0 flex items-center justify-center">
            <span className="w-1 h-1 bg-cosmic-teal rounded-full" />
          </span>
        )}

        <span
          className={`cursor-pointer ${
            hasChildren ? "text-indigo-200 font-bold" : "text-gray-300"
          }`}
          onClick={() => hasChildren && setCollapsed(!collapsed)}
        >
          {node.name}
        </span>
      </div>

      {hasChildren && !collapsed && (
        <div className="space-y-0.5">
          {node.children.map((child: any, idx: number) => (
            <TreeNode key={idx} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
