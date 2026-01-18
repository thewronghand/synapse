"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { useTheme } from "next-themes";
import { DigitalGardenNode, GraphEdge } from "@/types";

// ForceGraph instance type definition
interface ForceGraphInstance {
  graphData: (data: { nodes: DigitalGardenNode[]; links: GraphEdge[] }) => ForceGraphInstance;
  nodeId: (accessor: string | ((node: DigitalGardenNode) => string | number)) => ForceGraphInstance;
  nodeLabel: (accessor: string | ((node: DigitalGardenNode) => string)) => ForceGraphInstance;
  nodeVal: (accessor: (node: DigitalGardenNode) => number) => ForceGraphInstance;
  nodeColor: (accessor: (node: DigitalGardenNode) => string) => ForceGraphInstance;
  nodeCanvasObject: (renderer: (node: DigitalGardenNode, ctx: CanvasRenderingContext2D, globalScale: number) => void) => ForceGraphInstance;
  nodeCanvasObjectMode: (mode: () => string) => ForceGraphInstance;
  linkColor: (accessor: (link: GraphEdge) => string) => ForceGraphInstance;
  linkWidth: (accessor: (link: GraphEdge) => number) => ForceGraphInstance;
  linkDirectionalArrowLength: (length: number | ((link: GraphEdge) => number)) => ForceGraphInstance;
  linkDirectionalParticles: (count: number | ((link: GraphEdge) => number)) => ForceGraphInstance;
  linkDirectionalParticleSpeed: (speed: number | ((link: GraphEdge) => number)) => ForceGraphInstance;
  linkDirectionalParticleWidth: (width: number | ((link: GraphEdge) => number)) => ForceGraphInstance;
  linkDirectionalParticleColor: (color: string | ((link: GraphEdge) => string)) => ForceGraphInstance;
  linkCurvature: (curvature: number | ((link: GraphEdge) => number)) => ForceGraphInstance;
  linkCanvasObject: (renderer: ((link: GraphEdge, ctx: CanvasRenderingContext2D, globalScale: number) => void) | null) => ForceGraphInstance;
  linkCanvasObjectMode: (mode: string | ((link: GraphEdge) => string)) => ForceGraphInstance;
  autoPauseRedraw: (enabled: boolean) => ForceGraphInstance;
  onNodeClick: (handler: (node: DigitalGardenNode) => void) => ForceGraphInstance;
  onNodeHover: (handler: (node: DigitalGardenNode | null) => void) => ForceGraphInstance;
  width: (width: number) => ForceGraphInstance;
  height: (height: number) => ForceGraphInstance;
  zoom: (scale?: number, duration?: number) => number | ForceGraphInstance;
  zoomToFit: (duration?: number, padding?: number) => ForceGraphInstance;
  centerAt: (x: number, y: number, duration?: number) => ForceGraphInstance;
  onEngineStop: (callback: () => void) => ForceGraphInstance;
  d3Force: (forceName: string) => any;
  _destructor: () => void;
  _zoomFitted?: boolean;
}

interface FilteredGraphData {
  nodes: { [url: string]: DigitalGardenNode };
  links: GraphEdge[];
}

interface ForceGraphViewProps {
  graphData: {
    nodes: { [url: string]: DigitalGardenNode };
    links: GraphEdge[];
  };
  currentNodeUrl?: string;
  depth?: number;
  height?: number;
  onNodeClick?: (node: DigitalGardenNode) => void;
  showSearchFilter?: boolean; // Show search and tag filter UI
}

export default function ForceGraphView({
  graphData,
  currentNodeUrl,
  depth = 0,
  height = 600,
  onNodeClick,
  showSearchFilter = false,
}: ForceGraphViewProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphInstance | null>(null);
  const [filteredData, setFilteredData] = useState<FilteredGraphData | null>(null);
  const hoveredNodeRef = useRef<DigitalGardenNode | null>(null);
  const highlightNodesRef = useRef<Set<DigitalGardenNode>>(new Set());
  const highlightLinksRef = useRef<Set<GraphEdge>>(new Set());
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

  // Particle animation state
  const particleProgressRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  // Theme colors for nodes
  const nodeColors = {
    // Teal gradient based on connection count
    highConnections: isDark ? "#5FC9C3" : "#008080",    // Primary - 5+ connections
    mediumConnections: isDark ? "#7DD4D0" : "#2A9D9D",  // Lighter teal - 3-4 connections
    lowConnections: isDark ? "#A5E0DC" : "#5FBFBF",     // Light teal - 1-2 connections
    noConnections: isDark ? "#6B7280" : "#9CA3AF",      // Gray - 0 connections
    currentNode: isDark ? "#9F8AB8" : "#6C5B7B",        // Secondary - current node in local graph
  };

  // Search and filter states
  const [searchInput, setSearchInput] = useState(""); // User input (immediate)
  const [searchQuery, setSearchQuery] = useState(""); // Debounced search value
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [availableTitles, setAvailableTitles] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [selectedTagIndex, setSelectedTagIndex] = useState(0);

  // Fetch available titles for autocomplete
  useEffect(() => {
    async function fetchTitles() {
      try {
        const res = await fetch("/api/titles");
        const data = await res.json();
        if (data.success) {
          setAvailableTitles(data.data.titles);
        }
      } catch (err) {
        console.error("Failed to fetch titles:", err);
      }
    }
    fetchTitles();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Collapse legend automatically when graph is small
  useEffect(() => {
    // Auto-collapse if height is less than 400px
    if (height < 400) {
      setIsLegendExpanded(false);
    } else {
      setIsLegendExpanded(true);
    }
  }, [height]);

  // Extract all unique tags from nodes
  const allTags = Array.from(
    new Set(
      Object.values(graphData?.nodes || {})
        .flatMap((node: DigitalGardenNode) => node.tags || [])
    )
  ).sort();

  // Get tag suggestions based on input
  const tagSuggestions = tagInput
    ? allTags.filter(
        tag =>
          tag.toLowerCase().includes(tagInput.toLowerCase()) &&
          !selectedTags.includes(tag)
      )
    : [];

  // Get search suggestions based on input
  const searchSuggestions = searchInput
    ? availableTitles
        .filter(title =>
          title.toLowerCase().includes(searchInput.toLowerCase())
        )
        .slice(0, 5) // Limit to 5 suggestions
    : [];

  // Filter graph data by depth, search, and tags
  useEffect(() => {
    if (!graphData || !graphData.nodes) return;

    // Deep clone graphData to avoid mutations affecting the filtering
    const clonedGraphData = {
      nodes: JSON.parse(JSON.stringify(graphData.nodes)),
      links: graphData.links.map(link => ({
        source: link.source,
        target: link.target,
      }))
    };

    let filtered = clonedGraphData;

    // Apply depth filter
    if (depth > 0 && currentNodeUrl) {
      filtered = filterLocalGraphData(clonedGraphData, currentNodeUrl, depth);
    }

    // Apply search and tag filters
    if (searchQuery || selectedTags.length > 0) {
      const filteredNodes: { [url: string]: DigitalGardenNode } = {};

      (Object.entries(filtered.nodes) as [string, DigitalGardenNode][]).forEach(([url, node]) => {
        // Check search query (title match)
        const matchesSearch = !searchQuery ||
          node.title.toLowerCase().includes(searchQuery.toLowerCase());

        // Check tags (node must have ALL selected tags)
        const matchesTags = selectedTags.length === 0 ||
          selectedTags.every(tag => node.tags?.includes(tag));

        if (matchesSearch && matchesTags) {
          filteredNodes[url] = node;
        }
      });

      // Filter links to only include visible nodes
      const visibleUrls = Object.keys(filteredNodes);
      const filteredLinks = filtered.links.filter((link: GraphEdge) => {
        const sourceId = link.source;
        const targetId = link.target;

        const sourceNode = (Object.values(filtered.nodes) as DigitalGardenNode[]).find(n => n.id === sourceId);
        const targetNode = (Object.values(filtered.nodes) as DigitalGardenNode[]).find(n => n.id === targetId);

        return sourceNode && targetNode &&
               visibleUrls.includes(sourceNode.url) &&
               visibleUrls.includes(targetNode.url);
      });

      filtered = {
        nodes: filteredNodes,
        links: filteredLinks
      };
    }

    setFilteredData(filtered);
  }, [graphData, currentNodeUrl, depth, searchQuery, selectedTags]);

  // Track container size for responsive rendering
  useEffect(() => {
    if (!containerRef.current) return;

    const updateGraphSize = () => {
      if (containerRef.current && graphRef.current) {
        const width = containerRef.current.clientWidth;
        const currentHeight = height;

        // Only update if dimensions are valid
        if (width > 0 && currentHeight > 0) {
          graphRef.current
            .width(width)
            .height(currentHeight);

          // Also update canvas style
          const canvas = containerRef.current.querySelector('canvas');
          if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
          }
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      updateGraphSize();
    });

    // Also listen to window resize events
    window.addEventListener('resize', updateGraphSize);

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateGraphSize);
    };
  }, [height]);

  // Render graph
  useEffect(() => {
    if (!containerRef.current || !filteredData) return;
    if (typeof window === "undefined") return; // Skip SSR

    // Ensure container has dimensions before creating graph
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    if (containerWidth === 0 || containerHeight === 0) {
      // Container not ready yet, retry on next frame
      const timer = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.minWidth = '100%';
          containerRef.current.style.minHeight = '100%';
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    // Convert nodes object to array for ForceGraph
    const nodesArray = Object.values(filteredData.nodes);
    const linksArray = filteredData.links;

    // Build bidirectional link map for particle effects
    // Key: "sourceId-targetId", Value: true if reverse link exists
    const bidirectionalLinks = new Set<string>();
    const linkPairs = new Map<string, boolean>();

    linksArray.forEach((link: GraphEdge) => {
      const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
      const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
      const forwardKey = `${sourceId}-${targetId}`;
      const reverseKey = `${targetId}-${sourceId}`;

      if (linkPairs.has(reverseKey)) {
        // Found bidirectional link
        bidirectionalLinks.add(forwardKey);
        bidirectionalLinks.add(reverseKey);
      }
      linkPairs.set(forwardKey, true);
    });

    // Dynamically import ForceGraph
    import("force-graph").then(({ default: ForceGraph }) => {
      // Clean up existing graph before creating new one
      if (graphRef.current) {
        graphRef.current._destructor();
        graphRef.current = null;
      }

      // Create graph instance
      const graph = (ForceGraph as any)()(containerRef.current!)
      .graphData({ nodes: nodesArray, links: linksArray })
      .nodeId("id")
      .nodeLabel("title")
      .nodeVal((node: DigitalGardenNode) => node.size)
      .nodeColor((node: DigitalGardenNode) => {
        // Calculate connection count
        const connectionCount = node.neighbors?.length || 0;

        // Current node in local graph (compare with URL decoding)
        const decodedCurrentUrl = currentNodeUrl ? decodeURIComponent(currentNodeUrl) : null;
        const isCurrent = currentNodeUrl && (
          node.url === currentNodeUrl ||
          node.url === decodedCurrentUrl ||
          decodeURIComponent(node.url) === decodedCurrentUrl
        );
        if (isCurrent) {
          return nodeColors.currentNode;
        }

        // Color based on connection count
        if (connectionCount >= 5) return nodeColors.highConnections;
        if (connectionCount >= 3) return nodeColors.mediumConnections;
        if (connectionCount >= 1) return nodeColors.lowConnections;
        return nodeColors.noConnections;
      })
      .nodeCanvasObject((node: DigitalGardenNode, ctx: CanvasRenderingContext2D) => {
        const nodeWithPos = node as any;
        const { x, y, title, size, url } = nodeWithPos;
        const radius = size || 2;
        // Compare with URL decoding for Korean slugs
        const decodedCurrentUrl = currentNodeUrl ? decodeURIComponent(currentNodeUrl) : null;
        let decodedNodeUrl = url;
        try {
          decodedNodeUrl = decodeURIComponent(url || '');
        } catch (e) {
          // URL may already be decoded
        }
        const isCurrent = !!(currentNodeUrl && (
          url === currentNodeUrl ||
          url === decodedCurrentUrl ||
          decodedNodeUrl === currentNodeUrl ||
          decodedNodeUrl === decodedCurrentUrl
        ));

        // Debug log for first node only
        if (title && !nodeWithPos._logged) {
          console.log('[ForceGraphView] Node URL comparison:', {
            nodeUrl: url,
            decodedNodeUrl,
            currentNodeUrl,
            decodedCurrentUrl,
            isCurrent
          });
          nodeWithPos._logged = true;
        }

        const isHighlighted = !hoveredNodeRef.current || highlightNodesRef.current.has(node);

        // Calculate connection count for color
        const connectionCount = node.neighbors?.length || 0;

        // Determine node color based on connection count
        let nodeColor: string;
        if (isCurrent) {
          nodeColor = nodeColors.currentNode;
        } else if (connectionCount >= 5) {
          nodeColor = nodeColors.highConnections;
        } else if (connectionCount >= 3) {
          nodeColor = nodeColors.mediumConnections;
        } else if (connectionCount >= 1) {
          nodeColor = nodeColors.lowConnections;
        } else {
          nodeColor = nodeColors.noConnections;
        }

        // Draw node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);

        // Apply color based on highlight state
        if (isHighlighted) {
          ctx.fillStyle = nodeColor;
        } else {
          ctx.fillStyle = isDark ? "#4B5563" : "#d1d5db"; // gray-600 : gray-300
        }
        ctx.fill();

        // Draw outer ring for current node
        if (isCurrent) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 1.5, 0, 2 * Math.PI);
          ctx.strokeStyle = isDark ? "#F3F4F6" : "#9CA3AF"; // Light gray in dark mode, medium gray in light mode
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw label
        ctx.font = "3.5px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Dim label if not highlighted - use theme-aware colors
        ctx.fillStyle = isHighlighted
          ? (isDark ? "#F3F4F6" : "#1f2937") // foreground
          : (isDark ? "#6B7280" : "#9ca3af"); // muted-foreground

        // Truncate long labels
        const maxLength = 20;
        const displayLabel = title.length > maxLength
          ? title.substring(0, maxLength) + "..."
          : title;

        ctx.fillText(displayLabel, x, y + radius + 5);
      })
      .nodeCanvasObjectMode(() => "replace")
      .linkColor((link: GraphEdge) => {
        // Highlight links connected to hovered node - theme aware
        if (!hoveredNodeRef.current) return isDark ? "#9CA3AF" : "#d3d3d3"; // gray-400 : lightgray
        return highlightLinksRef.current.has(link)
          ? (isDark ? "#D1D5DB" : "#d3d3d3") // gray-300 : gray-300 (lighter in light mode)
          : (isDark ? "#6B7280" : "#e5e7eb"); // gray-500 : gray-200
      })
      .linkWidth((link: GraphEdge) => {
        // Make highlighted links slightly thicker
        if (!hoveredNodeRef.current) return 1;
        return highlightLinksRef.current.has(link) ? 1.5 : 0.5;
      })
      .linkDirectionalArrowLength(2)
      // Custom particle rendering for bidirectional center-spread effect
      .linkCanvasObjectMode(() => "after")
      .linkCanvasObject((link: GraphEdge, ctx: CanvasRenderingContext2D) => {
        // Only draw particles for highlighted links
        if (!highlightLinksRef.current.has(link)) return;

        const sourceNode = link.source as any;
        const targetNode = link.target as any;

        if (!sourceNode.x || !targetNode.x) return;

        const sourceId = sourceNode.id;
        const targetId = targetNode.id;
        const linkKey = `${sourceId}-${targetId}`;
        const isBidirectional = bidirectionalLinks.has(linkKey);

        // Calculate link line
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return;

        // Particle settings
        const baseColor = isDark ? [95, 201, 195] : [0, 128, 128]; // RGB values
        const particleRadius = 0.8;
        const numParticles = 2;
        const progress = particleProgressRef.current;

        if (isBidirectional) {
          // Bidirectional: particles spread from center to both ends
          for (let i = 0; i < numParticles; i++) {
            const baseOffset = i / numParticles;
            const animatedProgress = (progress + baseOffset) % 1;

            // Fade: full opacity at center (0), fade out towards edges (1)
            const fadeAlpha = 1 - animatedProgress * 0.8;
            ctx.fillStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${fadeAlpha})`;

            // Particle going towards target (from center)
            const t1 = 0.5 + animatedProgress * 0.5;
            const x1 = sourceNode.x + dx * t1;
            const y1 = sourceNode.y + dy * t1;

            ctx.beginPath();
            ctx.arc(x1, y1, particleRadius, 0, 2 * Math.PI);
            ctx.fill();

            // Particle going towards source (from center)
            const t2 = 0.5 - animatedProgress * 0.5;
            const x2 = sourceNode.x + dx * t2;
            const y2 = sourceNode.y + dy * t2;

            ctx.beginPath();
            ctx.arc(x2, y2, particleRadius, 0, 2 * Math.PI);
            ctx.fill();
          }
        } else {
          // Unidirectional: particles flow from source to target
          for (let i = 0; i < numParticles; i++) {
            const baseOffset = i / numParticles;
            const t = (progress + baseOffset) % 1;

            // Fade: full opacity at start, fade out towards end
            const fadeAlpha = 1 - t * 0.7;
            ctx.fillStyle = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${fadeAlpha})`;

            const x = sourceNode.x + dx * t;
            const y = sourceNode.y + dy * t;

            ctx.beginPath();
            ctx.arc(x, y, particleRadius, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
      })
      .autoPauseRedraw(false)
      .onNodeClick((node: DigitalGardenNode) => {
        if (onNodeClick) {
          onNodeClick(node);
        } else {
          // URL은 이미 /encodedTitle 형식이므로 그대로 사용
          // node.url에는 이미 인코딩된 제목이 들어있음
          const encodedTitle = node.url.replace(/^\//, "");
          router.push(`/note/${encodedTitle}`);
        }
      })
      .onNodeHover((node: DigitalGardenNode | null) => {
        // Update cursor
        if (containerRef.current) {
          containerRef.current.style.cursor = node ? "pointer" : "default";
        }

        // Update hover state using refs
        hoveredNodeRef.current = node;

        if (node) {
          // Find all connected nodes and links
          const connectedNodes = new Set<DigitalGardenNode>();
          const connectedLinks = new Set<GraphEdge>();

          connectedNodes.add(node);

          linksArray.forEach((link: GraphEdge) => {
            const sourceNode = typeof link.source === 'object' ? link.source as DigitalGardenNode : null;
            const targetNode = typeof link.target === 'object' ? link.target as DigitalGardenNode : null;
            const sourceId = sourceNode ? sourceNode.id : link.source;
            const targetId = targetNode ? targetNode.id : link.target;

            if (sourceId === node.id) {
              if (targetNode) connectedNodes.add(targetNode);
              connectedLinks.add(link);
            }
            if (targetId === node.id) {
              if (sourceNode) connectedNodes.add(sourceNode);
              connectedLinks.add(link);
            }
          });

          highlightNodesRef.current = connectedNodes;
          highlightLinksRef.current = connectedLinks;
        } else {
          highlightNodesRef.current = new Set();
          highlightLinksRef.current = new Set();
        }

        // Start/stop particle animation
        if (node) {
          // Start animation loop
          const animate = () => {
            particleProgressRef.current = (particleProgressRef.current + 0.005) % 1; // Even slower animation
            // Force graph to re-render by triggering a redraw
            if (graphRef.current && hoveredNodeRef.current) {
              // Access internal method to force re-render
              const g = graphRef.current as any;
              if (g._ctx) {
                // Direct canvas refresh
                g.nodeColor(g.nodeColor());
              }
              animationFrameRef.current = requestAnimationFrame(animate);
            }
          };
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Stop animation
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          particleProgressRef.current = 0;
        }

        // Trigger re-render of the graph
        if (graphRef.current) {
          const g = graphRef.current as any;
          g.nodeColor(g.nodeColor());
        }
      })
      .width(containerWidth)
      .height(height);

      // Force canvas to fill container
      const canvas = containerRef.current!.querySelector('canvas');
      if (canvas) {
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      }

      // Dynamically adjust force simulation based on graph complexity
      const nodeCount = nodesArray.length;

      // Build connection count map for dynamic link distance
      const connectionCounts = new Map<string, number>();
      nodesArray.forEach((node: DigitalGardenNode) => {
        connectionCounts.set(String(node.id), node.neighbors?.length || 0);
      });

      // Charge force (repulsion) - Coulomb's law
      // Stronger repulsion to keep clusters well separated
      const chargeForce = graph.d3Force('charge');
      if (chargeForce) {
        // Stronger repulsion to prevent overlapping
        const baseCharge = Math.min(-70, -50 - (nodeCount / 15));
        chargeForce.strength(baseCharge);
        chargeForce.distanceMax(300);
        chargeForce.distanceMin(15);
      }

      // Link force (spring) - Hooke's law
      // Dynamic distance + dynamic strength (Obsidian-style strength)
      const linkForce = graph.d3Force('link');
      if (linkForce) {
        // Dynamic link distance: longer for hub nodes
        linkForce.distance((link: any) => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;

          const sourceConnections = connectionCounts.get(String(sourceId)) || 0;
          const targetConnections = connectionCounts.get(String(targetId)) || 0;
          const maxConnections = Math.max(sourceConnections, targetConnections);

          // Base: 40, scales up to 100 for highly connected nodes
          return 40 + Math.min(maxConnections * 6, 60);
        });

        // Link strength: weaker for highly connected nodes (Obsidian formula)
        linkForce.strength((link: any) => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;

          const sourceConnections = connectionCounts.get(String(sourceId)) || 1;
          const targetConnections = connectionCounts.get(String(targetId)) || 1;

          // Obsidian-style: weaker links for hub nodes
          return 1 / Math.min(sourceConnections, targetConnections);
        });
      }

      // Center force - gentle pull towards center (uses default)

      // Initialize nodes in a circular layout to prevent "folded" initial state
      // This helps the simulation start from an unfolded position
      const radius = Math.max(100, nodeCount * 3);
      nodesArray.forEach((node: any, i: number) => {
        const angle = (2 * Math.PI * i) / nodeCount;
        if (node.x === undefined) node.x = radius * Math.cos(angle);
        if (node.y === undefined) node.y = radius * Math.sin(angle);
      });

      // Use forceRadial with radius 0 to pull nodes toward center point
      // Combined with repulsion, this creates a tight but non-overlapping cluster
      import('d3-force').then(d3Force => {
        const radialForce = d3Force.forceRadial(0, 0, 0).strength(0.08);
        graph.d3Force('radial', radialForce);
      });

      // Auto zoom to fit all nodes after simulation stabilizes
      graph.onEngineStop(() => {
        // Only run once
        if (!graphRef.current?._zoomFitted) {
          graph.zoomToFit(400, 20); // 400ms duration, 20px padding
          graph._zoomFitted = true;
        }
      });

      graphRef.current = graph;
    });
  }, [filteredData, currentNodeUrl, height, onNodeClick, router, isDark]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (graphRef.current) {
        graphRef.current._destructor();
        graphRef.current = null;
      }
    };
  }, []);

  // Tag management
  const handleAddTag = (tag: string) => {
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
      setTagInput("");
      setShowTagSuggestions(false);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  // Zoom controls
  const handleZoomIn = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom() as number;
      graphRef.current.zoom(currentZoom * 1.3, 400);
    }
  };

  const handleZoomOut = () => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom() as number;
      graphRef.current.zoom(currentZoom / 1.3, 400);
    }
  };

  const handleZoomReset = () => {
    if (graphRef.current) {
      graphRef.current.zoom(1, 400);
      graphRef.current.centerAt(0, 0, 400);
    }
  };

  // Check graph state for empty messages
  // 1. Error state: filteredData itself is null/undefined (data loading failed)
  const hasError = !filteredData;

  // 2. Local graph with no connections: only current node exists with no edges
  //    Only show message when viewing local graph (currentNodeUrl is set)
  const isLocalGraphWithNoConnections = currentNodeUrl &&
    filteredData &&
    Object.keys(filteredData.nodes).length === 1 &&
    filteredData.links.length === 0;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      {/* Error state: failed to load graph data */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              그래프 데이터를 불러올 수 없습니다
            </p>
          </div>
        </div>
      )}

      {/* Local graph with no connections: show message below center */}
      {isLocalGraphWithNoConnections && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className="text-center bg-card/80 backdrop-blur-sm px-4 py-2 rounded-lg">
            <p className="text-sm text-muted-foreground">
              연결된 문서가 없습니다
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              [[위키링크]]로 다른 문서를 연결해보세요
            </p>
          </div>
        </div>
      )}

      {/* Search and Filter Controls - Only show on full graph */}
      {showSearchFilter && (
        <div className="absolute top-2 left-2 w-64">
          <div className="flex flex-col gap-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10 pointer-events-none" />
              <input
                type="text"
                placeholder="노트 검색..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSelectedSearchIndex(0);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (!showSearchSuggestions || searchSuggestions.length === 0) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedSearchIndex((prev) =>
                      prev < searchSuggestions.length - 1 ? prev + 1 : prev
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedSearchIndex((prev) => (prev > 0 ? prev - 1 : 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    setSearchInput(searchSuggestions[selectedSearchIndex]);
                    setShowSearchSuggestions(false);
                  } else if (e.key === "Escape") {
                    setShowSearchSuggestions(false);
                  }
                }}
                className="w-full pl-10 pr-3 py-1.5 text-sm bg-card/90 backdrop-blur-sm border border-border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {/* Search Suggestions Dropdown */}
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg max-h-40 overflow-y-auto z-10">
                  {searchSuggestions.map((title, index) => (
                    <button
                      key={title}
                      onClick={() => {
                        setSearchInput(title);
                        setShowSearchSuggestions(false);
                      }}
                      className={`w-full px-3 py-1.5 text-sm text-left transition-colors hover:bg-primary/10 ${
                        index === selectedSearchIndex
                          ? "bg-primary/20 text-primary"
                          : ""
                      }`}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tag Input with Autocomplete */}
            <div className="relative">
              <input
                type="text"
                placeholder="태그 필터 추가..."
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setShowTagSuggestions(true);
                  setSelectedTagIndex(0);
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                onKeyDown={(e) => {
                  if (!showTagSuggestions || tagSuggestions.length === 0) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedTagIndex((prev) =>
                      prev < tagSuggestions.length - 1 ? prev + 1 : prev
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedTagIndex((prev) => (prev > 0 ? prev - 1 : 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag(tagSuggestions[selectedTagIndex]);
                  } else if (e.key === "Escape") {
                    setShowTagSuggestions(false);
                  }
                }}
                className="w-full px-3 py-1.5 text-sm bg-card/90 backdrop-blur-sm border border-border rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />

              {/* Tag Suggestions Dropdown */}
              {showTagSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded shadow-lg max-h-40 overflow-y-auto z-10">
                  {tagSuggestions.map((tag, index) => (
                    <button
                      key={tag}
                      onClick={() => handleAddTag(tag)}
                      className={`w-full px-3 py-1.5 text-sm text-left transition-colors hover:bg-primary/10 ${
                        index === selectedTagIndex
                          ? "bg-primary/20 text-primary"
                          : ""
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Tags - Fixed width with wrapping */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded cursor-pointer hover:bg-secondary/80 transition-colors"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    {tag}
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-card/90 backdrop-blur-sm border border-border rounded shadow-sm hover:bg-accent transition-colors flex items-center justify-center cursor-pointer text-foreground"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-card/90 backdrop-blur-sm border border-border rounded shadow-sm hover:bg-accent transition-colors flex items-center justify-center cursor-pointer text-foreground"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomReset}
          className="w-8 h-8 bg-card/90 backdrop-blur-sm border border-border rounded shadow-sm hover:bg-accent transition-colors flex items-center justify-center cursor-pointer text-foreground"
          title="Reset View"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Collapsible Legend */}
      <div className="absolute bottom-2 right-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-sm text-xs">
        <button
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
          className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-accent rounded-lg transition-colors cursor-pointer"
        >
          <div className="font-semibold text-foreground">범례</div>
          <svg
            className={`w-3 h-3 text-muted-foreground transition-transform ${isLegendExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isLegendExpanded && (
          <div className="px-2 pb-2 pt-1 space-y-1 border-t border-border">
            {/* Connection-based colors */}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: nodeColors.highConnections }}></div>
              <span className="text-muted-foreground">5+ 연결</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: nodeColors.mediumConnections }}></div>
              <span className="text-muted-foreground">3-4 연결</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: nodeColors.lowConnections }}></div>
              <span className="text-muted-foreground">1-2 연결</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: nodeColors.noConnections }}></div>
              <span className="text-muted-foreground">연결 없음</span>
            </div>

            {/* Current node indicator (only in local graph) */}
            {currentNodeUrl && (
              <>
                <div className="border-t border-border my-1"></div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-muted-foreground ring-offset-1 ring-offset-card" style={{ backgroundColor: nodeColors.currentNode }}></div>
                  <span className="text-muted-foreground">현재 문서</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Filter graph data by depth from current node
 * Based on Digital Garden's breadth-first expansion algorithm
 */
function filterLocalGraphData(
  graphData: { nodes: { [url: string]: DigitalGardenNode }; links: GraphEdge[] },
  currentUrl: string,
  depth: number
): { nodes: { [url: string]: DigitalGardenNode }; links: GraphEdge[] } {
  // Clone nodes to avoid mutation
  let remaining = JSON.parse(JSON.stringify(graphData.nodes));

  // Start with current node
  let existing: { [url: string]: DigitalGardenNode } = {};

  // Decode URL-encoded currentUrl for comparison
  const decodedCurrentUrl = decodeURIComponent(currentUrl);

  // Try to find current node by URL key (both encoded and decoded)
  let currentNode = remaining[currentUrl] || remaining[decodedCurrentUrl];
  let currentNodeKey = remaining[currentUrl] ? currentUrl : decodedCurrentUrl;

  if (!currentNode) {
    // Try to find by url property (in case key format differs)
    const entry = Object.entries(remaining).find(
      ([key, node]) => {
        const nodeUrl = (node as DigitalGardenNode).url;
        return nodeUrl === currentUrl ||
               nodeUrl === decodedCurrentUrl ||
               decodeURIComponent(key) === decodedCurrentUrl;
      }
    );
    if (entry) {
      currentNodeKey = entry[0];
      currentNode = entry[1] as DigitalGardenNode;
    }
  }

  if (!currentNode) {
    // If current node not found, return empty graph
    return { nodes: {}, links: [] };
  }

  existing[currentNodeKey] = currentNode;
  delete remaining[currentNodeKey];

  // Expand by depth levels
  for (let i = 0; i < depth; i++) {
    const neighbors = getNextLevelNeighbours(existing, remaining);
    existing = { ...existing, ...neighbors };

    // Remove found neighbors from remaining
    Object.keys(neighbors).forEach(url => {
      delete remaining[url];
    });
  }

  // Filter links to only include visible nodes
  const visibleUrls = Object.keys(existing);
  const visibleUrlsDecoded = visibleUrls.map(u => decodeURIComponent(u));

  const filteredLinks = graphData.links.filter((link) => {
    const sourceId = link.source;
    const targetId = link.target;

    const sourceNode = (Object.values(graphData.nodes) as DigitalGardenNode[]).find(n => n.id === sourceId);
    const targetNode = (Object.values(graphData.nodes) as DigitalGardenNode[]).find(n => n.id === targetId);

    if (!sourceNode || !targetNode) return false;

    // Check visibility with both encoded and decoded URLs
    const sourceVisible = visibleUrls.includes(sourceNode.url) ||
                          visibleUrlsDecoded.includes(sourceNode.url) ||
                          visibleUrls.includes(decodeURIComponent(sourceNode.url)) ||
                          visibleUrlsDecoded.includes(decodeURIComponent(sourceNode.url));
    const targetVisible = visibleUrls.includes(targetNode.url) ||
                          visibleUrlsDecoded.includes(targetNode.url) ||
                          visibleUrls.includes(decodeURIComponent(targetNode.url)) ||
                          visibleUrlsDecoded.includes(decodeURIComponent(targetNode.url));

    return sourceVisible && targetVisible;
  });

  return {
    nodes: existing,
    links: filteredLinks
  };
}

/**
 * Get neighbors one level away from existing nodes
 */
function getNextLevelNeighbours(
  existing: { [url: string]: DigitalGardenNode },
  remaining: { [url: string]: DigitalGardenNode }
): { [url: string]: DigitalGardenNode } {
  const existingKeys = Object.keys(existing);
  // Also include decoded versions for URL-encoded key comparison
  const existingKeysDecoded = existingKeys.map(k => decodeURIComponent(k));
  const neighbours: { [url: string]: DigitalGardenNode } = {};

  Object.entries(remaining).forEach(([url, node]) => {
    if (node.hide) return;

    // Check if this node is a neighbor of any existing node
    // Compare both encoded and decoded versions
    const isNeighbor = node.neighbors.some(neighborUrl => {
      const decodedNeighborUrl = decodeURIComponent(neighborUrl);
      return existingKeys.includes(neighborUrl) ||
             existingKeys.includes(decodedNeighborUrl) ||
             existingKeysDecoded.includes(neighborUrl) ||
             existingKeysDecoded.includes(decodedNeighborUrl);
    });

    if (isNeighbor) {
      neighbours[url] = node;
    }
  });

  return neighbours;
}
