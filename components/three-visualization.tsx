"use client"

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import {
  OrbitControls,
  createInstances,
  MeshTransmissionMaterial,
  Text3D,
  QuadraticBezierLine,
} from "@react-three/drei"
import { CustomCloudControls } from "./custom-cloud-controls"
import * as THREE from "three"
import { 
  ThreeGlobalState,
  ThreeNode, 
  ThreeEdge, 
  FaceTextProps,
  PulsingLightProps,
  CameraFocusProps,
  InternalGlowProps,
  ThreeVisualizationProps,
} from "@/types"

// Global state to persist across re-renders
const globalState: ThreeGlobalState = {
  positions: {} as Record<string, [number, number, number]>,
  selectedNode: null,
  selectedNodePosition: null,  
  initialized: false,
}

// Enhanced pulsing light with more dynamic effects
function PulsingLight({ position, color, baseIntensity = 2, pulseAmount = 5, speed = 1.5, distance = 8 }: PulsingLightProps) {
  const light = useRef<THREE.PointLight>(null)
  // Store props in a ref to prevent unnecessary re-renders
  const propsRef = useRef({ color, baseIntensity, pulseAmount, speed, distance })

  // Update ref when props change
  useEffect(() => {
    propsRef.current = { color, baseIntensity, pulseAmount, speed, distance }
  }, [color, baseIntensity, pulseAmount, speed, distance])

  useFrame(({ clock }) => {
    if (light.current) {
      // Create a pulsing effect using a sine function
      const { baseIntensity, pulseAmount, speed } = propsRef.current
      const pulse = Math.sin(clock.getElapsedTime() * speed) * pulseAmount
      light.current.intensity = baseIntensity + pulse
    }
  })

  return <pointLight ref={light} position={position} intensity={baseIntensity} color={color} distance={distance} />
}

// Component to handle camera focus on selected node
function CameraFocus({ target, enabled, controlsRef, graphRef }: CameraFocusProps) {
  const { camera } = useThree()
  const targetRef = useRef(new THREE.Vector3())
  const animationRef = useRef<number | null>(null)
  const isAnimatingRef = useRef(false)

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (enabled && target && !isAnimatingRef.current && graphRef?.current) {
      console.log("Focusing camera on target:", target)
      isAnimatingRef.current = true

      // Convert target array to Vector3
      targetRef.current.set(target[0], target[1], target[2])

      // Set the orbit controls target if available
      if (controlsRef.current) {
        controlsRef.current.target.copy(targetRef.current)
      }

      // Calculate ideal camera position
      // Calculate ideal camera position - ajustado para ver mejor la cara frontal
      const idealDistance = 25
      const targetPos = new THREE.Vector3(target[0], target[1], target[2])

      // Posicionar la cámara directamente frente al cubo
      const newPosition = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z + idealDistance)

      // Store initial rotation of the graph
      const initialGraphRotation = new THREE.Euler().copy(graphRef.current.rotation)

      // Animate camera to new position
      const startPosition = camera.position.clone()
      const startTime = Date.now()
      const duration = 1000 // 1 second animation

      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }

      const animateCamera = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Ease in-out function for smooth animation
        const easeProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress

        // Interpolate between start and end positions for camera
        camera.position.lerpVectors(startPosition, newPosition, easeProgress)

        // Update controls if available
        if (controlsRef.current) {
          controlsRef.current.update()
        }

        // Continue animation until complete
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animateCamera)
        } else {
          animationRef.current = null
          isAnimatingRef.current = false
        }
      }

      animateCamera()
    }
  }, [target, enabled, camera, controlsRef, graphRef])

  return null
}

// Enhanced internal glow effect
function InternalGlow({ scale, color, intensity = 1.5 }: InternalGlowProps) {
  const glowMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.5,
      side: THREE.BackSide,
    })
  }, [color])

  return (
    <mesh scale={[scale * 0.95, scale * 0.95, scale * 0.95]}>
      <boxGeometry />
      <primitive object={glowMaterial} attach="material" />
    </mesh>
  )
}

// Component to render 3D text on the cube face with error handling and fallbacks
function FaceText({
  text,
  size = 1,
  position = [0, 0, 0.501] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  isDark = true,
  isSelected = false,
}: FaceTextProps) {
  const materialRef = useRef<THREE.Material | undefined>(undefined);
  
  // Pre-format text to avoid doing this work during rendering
  const formattedText = useMemo(() => {
    if (!text) return "";

    // Character limit per line - increased to fit more text
    const charLimit = 12;
    // Maximum number of lines - increased to use more vertical space
    const maxLines = 4;

    try {
      // Split text by hyphens, slashes, and dots first to better handle paths and module names
      const segments = text.split(/[-/.]/);
      const lines = [];
      let currentLine = "";

      // Process each segment
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const delimiter = i > 0 ? text.charAt(text.indexOf(segments[i - 1]) + segments[i - 1].length) : "";

        // If adding this segment would exceed the line limit
        if ((currentLine + delimiter + segment).length > charLimit) {
          // Save current line if not empty
          if (currentLine) {
            lines.push(currentLine);
          }

          // If we've reached max lines, add ellipsis and break
          if (lines.length >= maxLines - 1) {
            lines.push(segment.substring(0, charLimit - 3) + "...");
            break;
          }

          // Start new line with this segment
          currentLine = segment;
        } else {
          // Add delimiter if not the first segment
          if (i > 0) {
            currentLine += delimiter;
          }
          currentLine += segment;
        }
      }

      // Add the last line if it's not empty and we haven't reached max lines
      if (currentLine && lines.length < maxLines) {
        lines.push(currentLine);
      }

      // If we have more segments but reached max lines, add ellipsis to last line
      if (lines.length === maxLines && segments.length > lines.length) {
        const lastLine = lines[lines.length - 1];
        if (lastLine.length > charLimit - 3) {
          lines[lines.length - 1] = lastLine.substring(0, charLimit - 3) + "...";
        } else {
          lines[lines.length - 1] = lastLine + "...";
        }
      }

      return lines.join("\n");
    } catch (err) {
      console.error("Error formatting text:", err);
      return text.substring(0, 20) + (text.length > 20 ? "..." : "");
    }
  }, [text]);

  // Calculate offset to position text within the cube face
  const textOffset = size * 0.4;
  
  // Ajustar la posición del texto para que sobresalga ligeramente del cubo
  const textZPosition = 0;
  
  return (
    <group position={position} rotation={rotation}>
      {/* Use Text3D for all text */}
      <Text3D
        font="/fonts/Inter_Bold.json"
        size={size * 0.09} // Reduced font size
        height={0.1} // Reduced height for less extrusion
        curveSegments={3} // Reduced for better performance
        bevelEnabled={false}
        letterSpacing={-0.03} // Tighter letter spacing
        position={[-textOffset, size * 0.2, textZPosition]} // Ajustado para que sobresalga del cubo
      >
        {formattedText || ""}
        <meshStandardMaterial
          color={isSelected ? "#000000" : isDark ? "#ffffff" : "#ffffff"}
          emissive={isSelected ? "#000000" : isDark ? "#4080ff" : "#3b82f6"}
          emissiveIntensity={isSelected ? 0 : 0.3}
          metalness={0.5}
          roughness={0.2}
          // castShadow={false}
          // receiveShadow={false}
        />
      </Text3D>
    </group>
  );
}

// Main component
function ThreeVisualization({
  analysisData = null,
  onSelectNode,
  isDetailView = false,
  selectedModule = null, // Recibir explícitamente el módulo seleccionado
  dimensions = { width: 0, height: 0 },
  theme = "dark",
}: ThreeVisualizationProps) {
  // Use local state for selection, but always sync with prop
  const [localSelectedNode, setLocalSelectedNode] = useState(selectedModule)
  const [selectedNodePosition, setSelectedNodePosition] = useState(globalState.selectedNodePosition)
  const isDark = theme === "dark"
  const controlsRef = useRef<any>(null)
  const graphRef = useRef(null)

  // Create color constants to avoid invalid hex with alpha
  const primaryColor = isDark ? "#3b82f6" : "#3b82f6"
  const edgeColor = isDark ? "#00b3ff" : "#3b82f6"
  const dimmedEdgeColor = isDark ? "#0077aa" : "#93c5fd"
  const glowColor = isDark ? "#00ffff" : "#60a5fa"


  // Sync selectedNodePosition with global state
  useEffect(() => {
    if (localSelectedNode !== selectedModule) {
      setLocalSelectedNode(selectedModule)
    }
  }, [selectedModule])
  useEffect(() => {
    if (selectedNodePosition) {
      globalState.selectedNodePosition = selectedNodePosition
    }
  }, [selectedNodePosition])


  const handleNodeClick = useCallback(
    (nodeId: string, position: [number, number, number]) => {
      console.log("Node clicked:", nodeId, position)
      setLocalSelectedNode(nodeId)
      setSelectedNodePosition(position)
      globalState.selectedNode = nodeId
      globalState.selectedNodePosition = position

      // Llamar a la función de selección del componente padre
      if (onSelectNode) {
        onSelectNode(nodeId)
      }
    },
    [onSelectNode],
  )


  return (
    <div className="w-full h-full">
      <Canvas 
        camera={{ position: [0, 0, 50], fov: 50 }} 
        dpr={1}
        gl={{
          alpha: false,
          antialias: true,
          stencil: false,
          depth: true,
          powerPreference: "default"
        }}
        // onCreated={handleCreated}
      >
        <color attach="background" args={[isDark ? "#000000" : "#f8fafc"]} />

        {/* Lighting: adjust for dark/light mode */}
        <ambientLight intensity={0.8} color="#ffffff" />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
        <pointLight position={[0, 0, 0]} intensity={0.7} color="#3b82f6" />
          

        {analysisData ? (
          <RepositoryGraph
            nodes={analysisData.graph.nodes}
            edges={analysisData.graph.edges}
            onSelectNode={handleNodeClick}
            selectedNode={localSelectedNode}
            isDetailView={isDetailView}
            isDark={isDark}
            primaryColor={primaryColor}
            edgeColor={edgeColor}
            dimmedEdgeColor={dimmedEdgeColor}
            glowColor={glowColor}
            controlsRef={controlsRef}
            graphRef={graphRef}
          />
        ) : null}

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.5}
          enabled={true} // Disable default controls
        />

        {selectedNodePosition && localSelectedNode && (
          <CameraFocus target={selectedNodePosition} enabled={true} controlsRef={controlsRef} graphRef={graphRef} />
        )}
      </Canvas>

  

    {/* Instructions */}
    <div
      className={`absolute bottom-4 left-4 p-3 ${
        isDark ? "bg-gray-900/70 text-white" : "bg-white/70 text-gray-900 border border-gray-200"
      } text-xs rounded-lg backdrop-blur-sm pointer-events-none`}
    >
      <p>
        🖱️ <strong>Controls:</strong>{" "}
        Click and drag to rotate camera, scroll to zoom
      </p>
    </div>

    {localSelectedNode && !isDetailView && (
      <div
        className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 p-4 ${
          isDark ? "bg-background/80" : "bg-white/80"
        } backdrop-blur-sm rounded-lg border shadow-lg max-w-md`}
      >
        <h3 className="font-medium">{localSelectedNode}</h3>
        <p className="text-sm text-muted-foreground">
          Click on the AI Analysis tab in the sidebar to see detailed information about this module.
        </p>
      </div>
    )}
  </div>
  )
}

// Component for real repository visualization
function RepositoryGraph({
  nodes,
  edges,
  onSelectNode,
  selectedNode,
  isDetailView,
  isDark,
  primaryColor,
  edgeColor,
  dimmedEdgeColor,
  glowColor,
  controlsRef,
  graphRef,
}: {
  nodes: ThreeNode[],
  edges: ThreeEdge[],
  onSelectNode: (nodeId: string, position: [number, number, number]) => void,
  selectedNode: string | null,
  isDetailView: boolean,
  isDark: boolean,
  primaryColor: string,
  edgeColor: string,
  dimmedEdgeColor: string,
  glowColor: string,
  controlsRef: React.RefObject<any>,
  graphRef: React.RefObject<any>,
}) {
  const [positions, setPositions] = useState(globalState.positions)
  const [NodeInstances, Node] = createInstances()
  const [GlowingNodeInstances, GlowingNode] = createInstances()
  const { camera } = useThree()

  // Ajustar la posición inicial de la cámara para ver mejor los títulos
  useEffect(() => {
    // Solo ajustar la cámara si no hay un nodo seleccionado
    if (!selectedNode && controlsRef.current) {
      // Posición inicial mejorada para ver mejor los títulos de frente
      camera.position.set(0, 0, 50)
      camera.lookAt(0, 0, 0)
      controlsRef.current.update()
    }
  }, [camera, selectedNode, controlsRef])

  // Calculate node positions only once
  useEffect(() => {
    // Only calculate positions if they haven't been calculated yet or if nodes have changed
    if (
      !globalState.initialized ||
      Object.keys(globalState.positions).length === 0 ||
      nodes.some((node) => !globalState.positions[node.id])
    ) {
      console.log("Calculating node positions")
      const newPositions: Record<string, [number, number, number]> = {}
      const nodeCount = nodes.length

      nodes.forEach((node, index) => {
        // If we already have a position for this node, keep it
        if (globalState.positions[node.id]) {
          newPositions[node.id] = globalState.positions[node.id]
          return
        }

        // Calculate position on a sphere
        const phi = Math.acos(-1 + (2 * (index + 1)) / (nodeCount + 1))
        const theta = Math.sqrt(nodeCount * Math.PI) * phi

        // Fixed radius of 20 for better visibility
        const x = 20 * Math.cos(theta) * Math.sin(phi)
        const y = 20 * Math.sin(theta) * Math.sin(phi)
        const z = 20 * Math.cos(phi)

        newPositions[node.id] = [x, y, z]
      })

      // Update both the state and the global state
      globalState.positions = newPositions
      globalState.initialized = true
      setPositions(newPositions)
    }
  }, [nodes])

  // En lugar del retorno anticipado, usamos una variable para controlar la renderización
  const hasPositions = Object.keys(positions).length > 0

  // Filter valid nodes and connections
  const validNodes = nodes.filter((node) => node && node.id && positions[node.id])
  const validEdges = edges.filter(
    (edge) => edge && edge.source && edge.target && positions[edge.source] && positions[edge.target],
  )

  // Base cube size (increased)
  const baseCubeSize = 4

  return (
    <group ref={graphRef}>
      <CustomCloudControls cloudRef={graphRef} enabled={false} rotationSpeed={1.5} panSpeed={1.2} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[0, 0, 0]} intensity={0.8} color={primaryColor} />

      {hasPositions && (
        <>
          {/* Normal node instances - Using basic materials instead of MeshTransmissionMaterial */}
          <NodeInstances>
            <boxGeometry />
            <MeshTransmissionMaterial
              color={primaryColor}
              roughness={0.2}
              metalness={0.4}
              transparent
              opacity={0.9}
              reflectivity={0.5}
              clearcoat={0.8}
              clearcoatRoughness={0.5}
              side={THREE.FrontSide}
            />

            {/* Render only non-selected nodes here */}
            {validNodes
              .filter((node) => node.id !== selectedNode)
              .map((node) => {
                const position = positions[node.id]

                // Scale the cube based on text length
                const textLength = node.id ? node.id.length : 0
                const cubeScale = Math.min(1 + textLength / 20, 1.5) * baseCubeSize

                return (
                  <group
                    key={node.id}
                    position={position}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectNode(node.id, position)
                    }}
                  >
                    <Node scale={[cubeScale, cubeScale, cubeScale]} userData={{ id: node.id, type: "node" }} />
                    <FaceText text={node.id} size={cubeScale} position={[0, 0, cubeScale * 0.51]} isDark={isDark} />
                     {/* Enhanced internal glow effect */}
                    <InternalGlow scale={cubeScale} color={glowColor} intensity={1.8} />
                   
                  </group>
                )
              })}
          </NodeInstances>

          {/* Glowing node instances for selected nodes */}
          <GlowingNodeInstances>
            <boxGeometry />
            <MeshTransmissionMaterial
              color="#ffffff"
              roughness={0.05}
              metalness={0.3}
              transparent
              opacity={0.95}
              reflectivity={0.7}
              clearcoat={1}
              clearcoatRoughness={0.05}
              emissive={glowColor}
              emissiveIntensity={0.5}
              side={THREE.FrontSide}
            />

            {/* Render only the selected node here */}
            {validNodes
              .filter((node) => node.id === selectedNode)
              .map((node) => {
                const position = positions[node.id]

                // Scale the cube based on text length
                const textLength = node.id ? node.id.length : 0
                const cubeScale = Math.min(1 + textLength / 20, 1.5) * baseCubeSize * 1.1

                return (
                  <group
                    key={node.id}
                    position={position}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectNode(node.id, position)
                    }}
                  >
                    <GlowingNode scale={[cubeScale, cubeScale, cubeScale]} userData={{ id: node.id, type: "node" }} />

                    {/* Text on the front face of the cube with adjusted position */}
                    <FaceText
                      text={node.id}
                      size={cubeScale}
                      position={[0, 0, cubeScale * 0.51]}
                      isDark={isDark}
                      isSelected={true}
                    />

                    {/* Enhanced internal glow effect */}
                    <InternalGlow scale={cubeScale} color={glowColor} intensity={1.8} />

                    {/* Enhanced internal lighting effect */}
                    <PulsingLight
                      position={[0, 0, 0]}
                      color={glowColor}
                      baseIntensity={3}
                      pulseAmount={1.2}
                      speed={2}
                      distance={cubeScale * 2.5}
                    />

                    {/* Additional lights for a more volumetric effect - reduced number for performance */}
                    <pointLight
                      position={[0, cubeScale * 0.3, 0]}
                      intensity={1.5}
                      color={glowColor}
                      distance={cubeScale * 2}
                    />

                    {/* Outer glowing layer */}
                    <mesh scale={[cubeScale * 1.05, cubeScale * 1.05, cubeScale * 1.05]}>
                      <boxGeometry />
                      <meshBasicMaterial color={glowColor} transparent opacity={0.15} />
                    </mesh>
                  </group>
                )
              })}
          </GlowingNodeInstances>

          {/* Connections between nodes - only show if not too many to prevent performance issues */}
          {validEdges.length < 100 && validEdges.map((edge, index) => {
            const sourcePos = positions[edge.source]
            const targetPos = positions[edge.target]

            if (!sourcePos || !targetPos) return null

            // Get node sizes (assuming same logic as for cubes)
            const sourceNode = validNodes.find(n => n.id === edge.source)
            const targetNode = validNodes.find(n => n.id === edge.target)
            const baseCubeSize = 4
            const sourceTextLength = sourceNode?.id ? sourceNode.id.length : 0
            const targetTextLength = targetNode?.id ? targetNode.id.length : 0
            const sourceCubeScale = Math.min(1 + sourceTextLength / 20, 1.5) * baseCubeSize
            const targetCubeScale = Math.min(1 + targetTextLength / 20, 1.5) * baseCubeSize

            // Compute direction vector from source to target
            const dir = [
              targetPos[0] - sourcePos[0],
              targetPos[1] - sourcePos[1],
              targetPos[2] - sourcePos[2],
            ]
            const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2)
            const norm = len === 0 ? [0, 0, 1] : [dir[0] / len, dir[1] / len, dir[2] / len]

            // Offset from center to face (half cube size + small margin)
            const margin = 0.15
            const sourceOffset: [number, number, number] = [
              sourcePos[0] + norm[0] * (sourceCubeScale / 2 + margin),
              sourcePos[1] + norm[1] * (sourceCubeScale / 2 + margin),
              sourcePos[2] + norm[2] * (sourceCubeScale / 2 + margin),
            ]
            const targetOffset: [number, number, number] = [
              targetPos[0] - norm[0] * (targetCubeScale / 2 + margin),
              targetPos[1] - norm[1] * (targetCubeScale / 2 + margin),
              targetPos[2] - norm[2] * (targetCubeScale / 2 + margin),
            ]

            // Calculate midpoint with random offset to curve the line
            const midPoint: [number, number, number] = [
              (sourceOffset[0] + targetOffset[0]) / 2 + (Math.random() - 0.5) * 3,
              (sourceOffset[1] + targetOffset[1]) / 2 + (Math.random() - 0.5) * 3,
              (sourceOffset[2] + targetOffset[2]) / 2 + (Math.random() - 0.5) * 3,
            ]

            // Highlight connections related to the selected node
            const isRelated = edge.source === selectedNode || edge.target === selectedNode
            const lineColor = isRelated ? edgeColor : dimmedEdgeColor
            const edgeOpacity = isRelated ? 0.9 : 0.4
            const edgeWidth = 5

            return (
              <QuadraticBezierLine
                key={`${edge.source}-${edge.target}-${index}`}
                start={sourceOffset}
                end={targetOffset}
                mid={midPoint}
                color={lineColor}
                lineWidth={edgeWidth}
                transparent
                opacity={edgeOpacity}
              />
            )
          })}
        </>
      )}
    </group>
  )
}

export default ThreeVisualization
