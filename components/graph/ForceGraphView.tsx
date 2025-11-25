"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
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
  linkDirectionalArrowLength: (length: number) => ForceGraphInstance;
  autoPauseRedraw: (enabled: boolean) => ForceGraphInstance;
  onNodeClick: (handler: (node: DigitalGardenNode) => void) => ForceGraphInstance;
  onNodeHover: (handler: (node: DigitalGardenNode | null) => void) => ForceGraphInstance;
  width: (width: number) => ForceGraphInstance;
  height: (height: number) => ForceGraphInstance;
  zoom: (scale?: number, duration?: number) => number | ForceGraphInstance;
  centerAt: (x: number, y: number, duration?: number) => ForceGraphInstance;
  d3Force: (forceName: string) => any;
  _destructor: () => void;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphInstance | null>(null);
  const [filteredData, setFilteredData] = useState<FilteredGraphData | null>(null);
  const hoveredNodeRef = useRef<DigitalGardenNode | null>(null);
  const highlightNodesRef = useRef<Set<DigitalGardenNode>>(new Set());
  const highlightLinksRef = useRef<Set<GraphEdge>>(new Set());
  const [isLegendExpanded, setIsLegendExpanded] = useState(false);

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
      .nodeColor((node: DigitalGardenNode) => node.color || "#9f4ff3")
      .nodeCanvasObject((node: DigitalGardenNode, ctx: CanvasRenderingContext2D) => {
        const nodeWithPos = node as any;
        const { x, y, title, size, url } = nodeWithPos;
        const radius = size || 2;
        const isCurrent = url === currentNodeUrl;
        const isHighlighted = !hoveredNodeRef.current || highlightNodesRef.current.has(node);

        // Draw node circle
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);

        // Apply color based on highlight state
        if (isHighlighted) {
          ctx.fillStyle = node.color || "#9f4ff3";
        } else {
          ctx.fillStyle = "#d1d5db"; // gray-300
        }
        ctx.fill();

        // Draw outer ring for current node
        if (isCurrent) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 2, 0, 2 * Math.PI);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw label
        ctx.font = "3.5px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Dim label if not highlighted
        ctx.fillStyle = isHighlighted ? "#1f2937" : "#9ca3af"; // gray-400

        // Truncate long labels
        const maxLength = 20;
        const displayLabel = title.length > maxLength
          ? title.substring(0, maxLength) + "..."
          : title;

        ctx.fillText(displayLabel, x, y + radius + 5);
      })
      .nodeCanvasObjectMode(() => "replace")
      .linkColor((link: GraphEdge) => {
        // Highlight links connected to hovered node
        if (!hoveredNodeRef.current) return "#d3d3d3";
        return highlightLinksRef.current.has(link) ? "#6b7280" : "#e5e7eb"; // gray-500 : gray-200
      })
      .linkWidth((link: GraphEdge) => {
        // Make highlighted links slightly thicker
        if (!hoveredNodeRef.current) return 1;
        return highlightLinksRef.current.has(link) ? 1.5 : 0.5;
      })
      .linkDirectionalArrowLength(2)
      .autoPauseRedraw(false)
      .onNodeClick((node: DigitalGardenNode) => {
        if (onNodeClick) {
          onNodeClick(node);
        } else {
          // Remove leading slash for routing
          const slug = node.url.replace(/^\//, "");
          router.push(`/note/${slug}`);
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

        // Trigger re-render of the graph
        if (graphRef.current) {
          (graphRef.current as any).nodeColor((graphRef.current as any).nodeColor());
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
      const linkCount = linksArray.length;
      const density = linkCount / Math.max(nodeCount, 1);

      // Calculate optimal force parameters based on node count
      // More nodes = stronger repulsion to prevent clustering
      const chargeStrength = Math.min(-30, -30 - (nodeCount / 10));

      // Calculate link distance based on density
      // Higher density = longer links to spread out
      const linkDistance = density > 2 ? 40 : 30;

      const chargeForce = graph.d3Force('charge');
      if (chargeForce) chargeForce.strength(chargeStrength);

      const linkForce = graph.d3Force('link');
      if (linkForce) linkForce.distance(linkDistance);

      graphRef.current = graph;
    });
  }, [filteredData, currentNodeUrl, height, onNodeClick, router]);

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

  return (
    <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
      <div ref={containerRef} className="w-full h-full overflow-hidden" />

      {/* Search and Filter Controls - Only show on full graph */}
      {showSearchFilter && (
        <div className="absolute top-2 left-2 w-64">
          <div className="flex flex-col gap-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10 pointer-events-none" />
              <input
                type="text"
                placeholder="Search notes..."
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
                className="w-full pl-10 pr-3 py-1.5 text-sm bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Search Suggestions Dropdown */}
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto z-10">
                  {searchSuggestions.map((title, index) => (
                    <button
                      key={title}
                      onClick={() => {
                        setSearchInput(title);
                        setShowSearchSuggestions(false);
                      }}
                      className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
                        index === selectedSearchIndex
                          ? "bg-blue-50 text-blue-700"
                          : "hover:bg-gray-100"
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
                placeholder="Add tag filter..."
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
                className="w-full px-3 py-1.5 text-sm bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {/* Tag Suggestions Dropdown */}
              {showTagSuggestions && tagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto z-10">
                  {tagSuggestions.map((tag, index) => (
                    <button
                      key={tag}
                      onClick={() => handleAddTag(tag)}
                      className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
                        index === selectedTagIndex
                          ? "bg-blue-50 text-blue-700"
                          : "hover:bg-gray-100"
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
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded cursor-pointer hover:bg-blue-200 transition-colors"
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
          className="w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomReset}
          className="w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center"
          title="Reset View"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Collapsible Legend */}
      <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm text-xs">
        <button
          onClick={() => setIsLegendExpanded(!isLegendExpanded)}
          className="flex items-center gap-2 w-full px-2 py-1.5 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <div className="font-semibold text-gray-700">Legend</div>
          <svg
            className={`w-3 h-3 text-gray-500 transition-transform ${isLegendExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isLegendExpanded && (
          <div className="px-2 pb-2 pt-1 space-y-1 border-t border-gray-100">
            {/* Tag-based colors */}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] flex-shrink-0"></div>
              <span className="text-gray-600">Guide/Tutorial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#10b981] flex-shrink-0"></div>
              <span className="text-gray-600">Getting Started</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] flex-shrink-0"></div>
              <span className="text-gray-600">Features</span>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 my-1"></div>

            {/* Connection-based colors */}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] flex-shrink-0"></div>
              <span className="text-gray-600">Highly Connected (3+)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] flex-shrink-0"></div>
              <span className="text-gray-600">Connected (1-2)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#6b7280] flex-shrink-0"></div>
              <span className="text-gray-600">Default</span>
            </div>
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

  const currentNode = remaining[currentUrl];
  if (!currentNode) {
    // If current node not found, return empty graph
    return { nodes: {}, links: [] };
  }

  existing[currentUrl] = currentNode;
  delete remaining[currentUrl];

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

  const filteredLinks = graphData.links.filter((link) => {
    const sourceId = link.source;
    const targetId = link.target;

    const sourceNode = (Object.values(graphData.nodes) as DigitalGardenNode[]).find(n => n.id === sourceId);
    const targetNode = (Object.values(graphData.nodes) as DigitalGardenNode[]).find(n => n.id === targetId);

    return sourceNode && targetNode &&
           visibleUrls.includes(sourceNode.url) &&
           visibleUrls.includes(targetNode.url);
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
  const neighbours: { [url: string]: DigitalGardenNode } = {};

  Object.entries(remaining).forEach(([url, node]) => {
    if (node.hide) return;

    // Check if this node is a neighbor of any existing node
    const isNeighbor = node.neighbors.some(neighborUrl =>
      existingKeys.includes(neighborUrl)
    );

    if (isNeighbor) {
      neighbours[url] = node;
    }
  });

  return neighbours;
}
