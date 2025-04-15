"use client"

import { useThree } from "@react-three/fiber"
import { useRef, useEffect, useState, useCallback, MutableRefObject } from "react"
import * as THREE from "three"

export function CustomCloudControls({
  cloudRef,
  enabled = true,
  rotationSpeed = 1,
  panSpeed = 1,
}: {
  cloudRef: MutableRefObject<THREE.Object3D | null>
  enabled?: boolean
  rotationSpeed?: number
  panSpeed?: number
}) {
  const { camera, gl } = useThree()
  const domElement = gl.domElement

  // State for tracking mouse interactions
  const [isDragging, setIsDragging] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [previousMousePosition, setPreviousMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  // Reference to store the cloud's center position
  const cloudCenter = useRef(new THREE.Vector3())

  // Calculate cloud center on mount and when cloud changes
  useEffect(() => {
    if (cloudRef.current) {
      // Calculate the geometric center of the cloud
      const boundingBox = new THREE.Box3().setFromObject(cloudRef.current)
      boundingBox.getCenter(cloudCenter.current)
    }
  }, [cloudRef])

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (event: MouseEvent): void => {
      if (!enabled || !cloudRef.current) return

      // Left mouse button (rotation)
      if (event.button === 0) {
        setIsDragging(true)
        setPreviousMousePosition({
          x: event.clientX,
          y: event.clientY,
        })
      }
      // Right mouse button (translation)
      else if (event.button === 2) {
        setIsPanning(true)
        setPreviousMousePosition({
          x: event.clientX,
          y: event.clientY,
        })

        // Prevent context menu
        event.preventDefault()
        event.stopPropagation()
      }
    },
    [enabled, cloudRef],
  )

  const handleMouseMove = useCallback(
    (event: MouseEvent): void => {
      if (!enabled || !cloudRef.current) return

      const { clientX, clientY } = event

      // Calculate mouse movement delta
      const deltaMove = {
        x: clientX - previousMousePosition.x,
        y: clientY - previousMousePosition.y,
      }

      if (isDragging) {
        // Rotate the cloud around its principal axis (center)
        const angleY = (deltaMove.x / domElement.clientWidth) * Math.PI * rotationSpeed
        const angleX = (deltaMove.y / domElement.clientHeight) * Math.PI * rotationSpeed

        cloudRef.current.rotateY(angleY)
        cloudRef.current.rotateX(angleX)
      }

      if (isPanning) {
        // Calculate pan distance based on camera distance to target
        const distance = camera.position.distanceTo(cloudCenter.current)
        const panX = (deltaMove.x / domElement.clientWidth) * distance * panSpeed
        const panY = (deltaMove.y / domElement.clientHeight) * distance * panSpeed

        // Create pan vector in camera space
        const panVector = new THREE.Vector3(-panX, panY, 0)
        panVector.applyQuaternion(camera.quaternion)

        // Apply translation to the cloud without changing rotation center
        cloudRef.current.position.add(panVector)
        cloudCenter.current.add(panVector)
      }

      setPreviousMousePosition({
        x: clientX,
        y: clientY,
      })
    },
    [
      enabled,
      cloudRef,
      isDragging,
      isPanning,
      previousMousePosition,
      camera,
      domElement.clientWidth,
      domElement.clientHeight,
      rotationSpeed,
      panSpeed,
    ],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsPanning(false)
  }, [])

  // Add and remove event listeners
  useEffect(() => {
    if (enabled) {
      domElement.addEventListener("mousedown", handleMouseDown)
      domElement.addEventListener("mousemove", handleMouseMove)
      domElement.addEventListener("mouseup", handleMouseUp)
      domElement.addEventListener("mouseleave", handleMouseUp)

      // Prevent context menu on right-click
      const handleContextMenu = (e: MouseEvent): void => {
        if (isPanning) {
          e.preventDefault()
        }
      }
      domElement.addEventListener("contextmenu", handleContextMenu)

      return () => {
        domElement.removeEventListener("mousedown", handleMouseDown)
        domElement.removeEventListener("mousemove", handleMouseMove)
        domElement.removeEventListener("mouseup", handleMouseUp)
        domElement.removeEventListener("mouseleave", handleMouseUp)
        domElement.removeEventListener("contextmenu", handleContextMenu)
      }
    }
  }, [enabled, handleMouseDown, handleMouseMove, handleMouseUp, domElement, isPanning])

  return null
}
