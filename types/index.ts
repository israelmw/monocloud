// Interfaces para la estructura de datos del grafo
export interface GraphNode {
  id: string;
  data?: {
    path?: string;
    packageJson?: string;
    pkg?: Record<string, any>;
    [key: string]: any;
  };
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface AnalysisData {
  owner: string;
  repo: string;
  graph: Graph;
}

// Interfaces para respuestas de API y acciones

export interface SimpleTextProps {
  text?: string;
  size?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  isDark?: boolean;
  isSelected?: boolean;
}

export interface SuccessResponse {
  success: true;
  data: AnalysisData;
  fromCache: boolean;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type RepositoryAnalysisResponse = SuccessResponse | ErrorResponse;

// Interfaces para componentes específicos

// Para GraphVisualization
export interface GraphVisualizationProps {
  analysisData: AnalysisData | null;
  onSelectNode: (nodeId: string) => void;
  isDetailView?: boolean;
  selectedModule?: string | null;
}

export interface Dimensions {
  width: number;
  height: number;
}

// Para InsightsPanel
export interface InsightItem {
  id: number;
  title: string;
  description: string;
  type: "warning" | "suggestion" | "info";
}

export interface StatsData {
  packages: number;
  dependencies: number;
  circularDeps: number;
  avgDepth: number;
  mostConnected: Array<{name: string; count: number}>;
}

export interface InsightsPanelProps {
  analysisData: AnalysisData | null;
  selectedModule: string | null;
  setSelectedModule: (nodeId: string) => void
  isDetailView?: boolean;
  onBackToVisualization: () => void;
  isCollapsed?: boolean;
  onToggleCollapse: (collapsed: boolean) => void;
}

// Para Hero
export interface HeroProps {
  onAnalysisComplete: (data: AnalysisData) => void;
}

// Para useTextToSpeech
export interface TextToSpeechOptions {
  enabled?: boolean;
  autoPlay?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  voice?: string;
  repoName?: string;
}

export interface TextToSpeechReturnType {
  isLoading: boolean;
  isPlaying: boolean;
  error: Error | null;
  play: (text?: string) => Promise<void>;
  pause: () => void;
  stop: () => void;
  resetCircuitBreaker: () => void;
  resetRequestState: () => void;
  forceRegenerate: () => void;
  progress: number; // Added progress property to track playback progress
}

// Para ThreeVisualization
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface ThreeNode {
  id: string;
  [key: string]: any;
}

export interface ThreeEdge {
  source: string;
  target: string;
  [key: string]: any;
}

export interface ThreeGlobalState {
  positions: Record<string, [number, number, number]>;
  selectedNode: string | null;
  selectedNodePosition: [number, number, number] | null;
  initialized: boolean;
}

export interface ThreeVisualizationProps {
  analysisData: AnalysisData | null;
  onSelectNode: (nodeId: string) => void;
  isDetailView?: boolean;
  selectedModule?: string | null;
  dimensions?: { width: number; height: number };
  theme?: string;
}

export interface PulsingLightProps {
  position: [number, number, number];
  color: string;
  baseIntensity?: number;
  pulseAmount?: number;
  speed?: number;
  distance?: number;
}

export interface FaceTextProps {
  text?: string;
  size?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  isDark?: boolean;
  isSelected?: boolean;
}

export interface CameraFocusProps {
  target: [number, number, number];
  enabled: boolean;
  controlsRef: React.RefObject<any>;
  graphRef: React.RefObject<any>;
}

export interface InternalGlowProps {
  scale: number;
  color: string;
  intensity?: number;
}

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}