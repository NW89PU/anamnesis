import { useEffect, useRef } from 'react';
import cytoscape, { type Core, type ElementDefinition, type NodeSingular } from 'cytoscape';
import { GRAPH_STYLES } from './graph-styles';

interface Props {
  elements: ElementDefinition[];
  activeTypes: Set<string>;
  onSelectNode: (nodeData: Record<string, unknown> | null) => void;
}

/**
 * Императивная обёртка над Cytoscape.
 *
 * Правила (из §11 ресёрч-отчёта Context7-агента):
 * - НЕ использовать `react-cytoscapejs` (он не поддерживает React 19)
 * - Мы сами управляем жизненным циклом `cy` через useEffect
 * - React только контейнер, cytoscape работает императивно
 * - `cy.destroy()` в cleanup — обязательно
 *
 * Порт поведения из vanilla `health-graph.js:237-421`.
 */
export function CytoscapeCanvas({ elements, activeTypes, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Mount once
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: GRAPH_STYLES,
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 800,
        nodeRepulsion: () => 10000,
        idealEdgeLength: () => 130,
        gravity: 0.25,
        numIter: 400,
        padding: 30,
        nodeOverlap: 20,
      },
      minZoom: 0.2,
      maxZoom: 3.5,
      wheelSensitivity: 0.3,
    });

    // Click on node → highlight + detail panel
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      cy.elements().removeClass('highlighted dimmed');
      const connected = node.neighborhood().add(node);
      cy.elements().not(connected).addClass('dimmed');
      connected.addClass('highlighted');
      onSelectNode(node.data());
    });

    // Click on background → clear
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        cy.elements().removeClass('highlighted dimmed');
        onSelectNode(null);
      }
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once

  // Update elements
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().remove();
    cy.add(elements);
    cy.layout({ name: 'cose', animate: true, nodeRepulsion: () => 10000, idealEdgeLength: () => 130 }).run();
  }, [elements]);

  // Update filters
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const type = n.data('type') as string;
        n.style('display', activeTypes.has(type) ? 'element' : 'none');
      });
      cy.edges().forEach((e) => {
        const srcVisible = e.source().style('display') !== 'none';
        const tgtVisible = e.target().style('display') !== 'none';
        e.style('display', srcVisible && tgtVisible ? 'element' : 'none');
      });
    });
  }, [activeTypes]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
