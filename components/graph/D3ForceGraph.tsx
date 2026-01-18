"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { Graph, GraphNode, GraphEdge } from "@/types";

interface D3ForceGraphProps {
  graph: Graph;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  color: string;
  size: number;
  linkedNodesCount: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node;
  target: string | D3Node;
}

export default function D3ForceGraph({
  graph,
  height = 600,
  onNodeClick,
}: D3ForceGraphProps) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height });
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link> | null>(null);

  useEffect(() => {
    // Update dimensions on mount and resize
    const updateDimensions = () => {
      if (svgRef.current) {
        const { width } = svgRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [height]);

  useEffect(() => {
    // Convert nodes to array if it's an object (Digital Garden format)
    const nodesArray: GraphNode[] = Array.isArray(graph.nodes)
      ? graph.nodes
      : Object.values(graph.nodes).map((node) => ({
          id: node.url.replace(/^\//, ''), // Remove leading slash from URL
          label: node.title,
          size: node.size,
          color: node.color,
        }));

    if (!svgRef.current || !nodesArray.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render

    const { width, height } = dimensions;

    // Create container group for zoom/pan
    const container = svg.append("g");

    // Calculate link counts for each node
    const linkCountMap = new Map<string, number>();
    (graph.edges || []).forEach((edge) => {
      const sourceId = String(edge.source);
      const targetId = String(edge.target);
      linkCountMap.set(sourceId, (linkCountMap.get(sourceId) || 0) + 1);
      linkCountMap.set(targetId, (linkCountMap.get(targetId) || 0) + 1);
    });

    // Transform data for D3
    const nodes: D3Node[] = nodesArray.map((node) => ({
      id: node.id,
      label: node.label,
      color: node.color || "#9f4ff3",
      size: node.size || 5,
      linkedNodesCount: linkCountMap.get(node.id) || 0,
    }));

    const links: D3Link[] = (graph.edges || []).map((edge) => ({
      source: String(edge.source),
      target: String(edge.target),
    }));

    // Calculate link distance based on connectivity (from vitriol)
    const getLinkDistance = (link: D3Link) => {
      const sourceNode = nodes.find((n) => n.id === (typeof link.source === "object" ? link.source.id : link.source));
      const targetNode = nodes.find((n) => n.id === (typeof link.target === "object" ? link.target.id : link.target));

      if (!sourceNode || !targetNode) return 50;

      const sourceLinks = sourceNode.linkedNodesCount;
      const targetLinks = targetNode.linkedNodesCount;
      const avgLinks = (sourceLinks + targetLinks) / 2;

      return 50 + avgLinks * 2.5; // Base 50px + 2.5px per connection
    };

    // Create force simulation (vitriol configuration)
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(getLinkDistance)
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1))
      .force(
        "collide",
        d3.forceCollide<D3Node>().radius((d) => d.size + 5)
      );

    simulationRef.current = simulation;

    // Create links (bottom layer)
    const link = container
      .append("g")
      .selectAll<SVGLineElement, D3Link>("line")
      .data(links)
      .join("line")
      .attr("stroke", "#d3d3d3")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.6);

    // Create nodes (middle layer)
    const node = container
      .append("g")
      .selectAll<SVGCircleElement, D3Node>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => d.color)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, D3Node>()
          .on("start", dragStarted)
          .on("drag", dragged)
          .on("end", dragEnded)
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onNodeClick) {
          const node = nodesArray.find((n) => n.id === d.id);
          if (node) {
            onNodeClick(node);
          }
        } else {
          router.push(`/note/${d.id}`);
        }
      });

    // Create labels (top layer)
    const label = container
      .append("g")
      .selectAll<SVGTextElement, D3Node>("text")
      .data(nodes)
      .join("text")
      .text((d) => {
        // Truncate long labels
        const maxLength = 20;
        return d.label.length > maxLength
          ? d.label.substring(0, maxLength) + "..."
          : d.label;
      })
      .attr("font-size", 11)
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("fill", "#1f2937")
      .attr("pointer-events", "none")
      .style("user-select", "none");

    // Add label backgrounds
    const labelBg = container
      .append("g")
      .selectAll<SVGRectElement, D3Node>("rect")
      .data(nodes)
      .join("rect")
      .attr("fill", "rgba(255, 255, 255, 0.9)")
      .attr("rx", 3)
      .attr("pointer-events", "none");

    // Position elements on simulation tick
    simulation.on("tick", () => {
      // Constrain nodes to viewport bounds
      nodes.forEach((d) => {
        const radius = d.size || 5;
        d.x = Math.max(radius, Math.min(width - radius, d.x || 0));
        d.y = Math.max(radius, Math.min(height - radius, d.y || 0));
      });

      link
        .attr("x1", (d) => (d.source as D3Node).x || 0)
        .attr("y1", (d) => (d.source as D3Node).y || 0)
        .attr("x2", (d) => (d.target as D3Node).x || 0)
        .attr("y2", (d) => (d.target as D3Node).y || 0);

      node
        .attr("cx", (d) => d.x || 0)
        .attr("cy", (d) => d.y || 0);

      // Position labels above nodes
      label
        .attr("x", (d) => d.x || 0)
        .attr("y", (d) => (d.y || 0) - (d.size || 5) - 7);

      // Position label backgrounds
      labelBg.each(function (d) {
        const textElement = label.filter((n) => n.id === d.id).node();
        if (textElement) {
          const bbox = textElement.getBBox();
          d3.select(this)
            .attr("x", bbox.x - 4)
            .attr("y", bbox.y - 2)
            .attr("width", bbox.width + 8)
            .attr("height", bbox.height + 4);
        }
      });
    });

    // Drag handlers (reheat simulation on drag)
    function dragStarted(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>) {
      const radius = event.subject.size || 5;
      event.subject.fx = Math.max(radius, Math.min(width - radius, event.x));
      event.subject.fy = Math.max(radius, Math.min(height - radius, event.y));
    }

    function dragEnded(event: d3.D3DragEvent<SVGCircleElement, D3Node, D3Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    // Add zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Initial zoom to fit
    simulation.on("end", () => {
      const bounds = container.node()?.getBBox();
      if (bounds) {
        const dx = bounds.width;
        const dy = bounds.height;
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        const scale = Math.min(
          0.9 / Math.max(dx / width, dy / height),
          5
        );
        const translate = [
          width / 2 - scale * x,
          height / 2 - scale * y,
        ];

        svg
          .transition()
          .duration(750)
          .call(
            zoom.transform as (selection: any, transform: d3.ZoomTransform) => void,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
          );
      }
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graph, dimensions, height, onNodeClick, router]);

  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      <svg
        ref={svgRef}
        className="w-full h-full bg-gray-50"
        style={{ display: "block" }}
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white border rounded-lg p-3">
        <h4 className="text-sm font-semibold mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Guide/Tutorial</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Getting Started</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span>Features</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Highly Connected (3+ backlinks)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Connected (1+ backlinks)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
