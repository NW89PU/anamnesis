import type { StylesheetStyle } from 'cytoscape';

/**
 * Стили Cytoscape для карты здоровья.
 * Точный порт из vanilla `frontend/js/pages/health-graph.js:240-345`.
 */
export const GRAPH_STYLES: StylesheetStyle[] = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'font-size': '10px',
      'font-family': 'Inter, sans-serif',
      'text-wrap': 'wrap',
      'text-max-width': '110px',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      width: 36,
      height: 36,
      'border-width': 2,
      'border-color': '#fff',
    },
  },
  {
    selector: 'node[type="diagnosis"]',
    style: { 'background-color': '#AF52DE', color: '#333', width: 44, height: 44, 'font-size': '11px', 'font-weight': 600 },
  },
  {
    selector: 'node[type="specialist"]',
    style: { 'background-color': '#007AFF', color: '#333', width: 42, height: 42, 'font-size': '11px', 'font-weight': 600 },
  },
  {
    selector: 'node[type="medication"]',
    style: { 'background-color': '#34C759', color: '#333', width: 34, height: 34 },
  },
  {
    selector: 'node[type="medication"][status="completed"]',
    style: {
      'background-color': '#86EFAC',
      'border-style': 'dashed',
      'border-color': '#BBF7D0',
      opacity: 0.6,
      width: 28,
      height: 28,
      'font-size': '9px',
    },
  },
  {
    selector: 'node[type="visit"]',
    style: { 'background-color': '#FF9500', color: '#666', width: 24, height: 24, 'font-size': '9px' },
  },
  {
    selector: 'node[type="visit"][linked="no"]',
    style: { 'background-color': '#FFD6A5', 'border-color': '#FF9500', 'border-width': 1.5, opacity: 0.9 },
  },
  {
    selector: 'node[type="error"]',
    style: { 'background-color': '#FF3B30', color: '#333', width: 38, height: 38, shape: 'diamond', 'font-size': '10px' },
  },
  {
    selector: 'edge',
    style: {
      width: 1.5,
      'line-color': '#D1D5DB',
      'target-arrow-color': '#D1D5DB',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 0.7,
      label: 'data(label)',
      'font-size': '8px',
      color: '#999',
      'text-rotation': 'autorotate',
      'text-margin-y': -8,
    },
  },
  {
    selector: 'edge[type="prescribed"]',
    style: { 'line-color': '#34C759', 'target-arrow-color': '#34C759', width: 2 },
  },
  {
    selector: 'edge[type="for-diagnosis"]',
    style: { 'line-color': '#AF52DE', 'target-arrow-color': '#AF52DE', 'line-style': 'dashed', width: 1.5 },
  },
  {
    selector: 'edge[type="visited"]',
    style: { 'line-color': '#FFB84D', 'target-arrow-color': '#FFB84D', width: 1 },
  },
  {
    selector: 'edge[type="visit-med"]',
    style: { 'line-color': '#86EFAC', 'target-arrow-color': '#86EFAC', width: 1.2, 'line-style': 'dashed' },
  },
  {
    selector: 'edge[type="visit-diag"]',
    style: { 'line-color': '#D8B4FE', 'target-arrow-color': '#D8B4FE', opacity: 0.4, width: 1 },
  },
  {
    selector: 'edge[type="error-diag"]',
    style: { 'line-color': '#FF3B30', 'target-arrow-color': '#FF3B30', 'line-style': 'dotted', width: 1.5 },
  },
  {
    selector: 'node:active, node:selected',
    style: { 'border-width': 3, 'border-color': '#FFD60A', 'overlay-opacity': 0 },
  },
  {
    selector: '.dimmed',
    style: { opacity: 0.12 },
  },
  {
    selector: '.highlighted',
    style: { opacity: 1 },
  },
];
