"use client";

import { useEffect, useRef } from "react";

export default function HeroCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let frame = 0;
    let disposed = false;
    let teardown: (() => void) | undefined;

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    import("three").then((THREE) => {
      if (disposed || !mountRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      scene.fog = new THREE.FogExp2(0x000000, 0.03);

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
      camera.position.set(0, 6, 16);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setClearColor(0x000000);
      renderer.domElement.style.display = "block";
      mount.appendChild(renderer.domElement);

      const gridGroup = new THREE.Group();
      gridGroup.rotation.x = -Math.PI / 2;
      scene.add(gridGroup);

      const cellMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12,
      });
      const sectionMaterial = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.24,
      });

      const size = 60;
      const divisions = 80;
      const step = size / divisions;
      const half = size / 2;

      for (let i = 0; i <= divisions; i++) {
        const pos = -half + i * step;
        const mat = i % 8 === 0 ? sectionMaterial : cellMaterial;

        gridGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(-half, 0, pos),
              new THREE.Vector3(half, 0, pos),
            ]),
            mat
          )
        );
        gridGroup.add(
          new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(pos, 0, -half),
              new THREE.Vector3(pos, 0, half),
            ]),
            mat
          )
        );
      }

      const nodeCount = 40;
      const nodeGeo = new THREE.SphereGeometry(0.04, 6, 6);
      const nodes: import("three").Mesh[] = [];

      for (let i = 0; i < nodeCount; i++) {
        const node = new THREE.Mesh(
          nodeGeo,
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
        );
        node.position.set(
          (Math.random() - 0.5) * size * 0.7,
          0.02,
          (Math.random() - 0.5) * size * 0.7
        );
        node.userData.phase = Math.random() * Math.PI * 2;
        node.userData.speed = 0.6 + Math.random() * 0.6;
        nodes.push(node);
        gridGroup.add(node);
      }

      const resize = () => {
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w === 0 || h === 0) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      };

      resize();
      window.addEventListener("resize", resize);

      const clock = new THREE.Clock();

      const animate = () => {
        frame = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Gentle idle sway + soft mouse parallax
        const targetX = mouseRef.current.x * 1.2;
        const targetY = 6 + mouseRef.current.y * 0.6;
        camera.position.x += (Math.sin(t * 0.15) * 1.5 + targetX - camera.position.x) * 0.03;
        camera.position.y += (targetY - camera.position.y) * 0.03;
        camera.lookAt(0, 0, 0);

        gridGroup.rotation.z = Math.sin(t * 0.1) * 0.02;

        nodes.forEach((node) => {
          const pulse = 0.35 + (Math.sin(t * node.userData.speed + node.userData.phase) * 0.5 + 0.5) * 0.4;
          (node.material as import("three").MeshBasicMaterial).opacity = pulse;
        });

        renderer.render(scene, camera);
      };

      animate();

      teardown = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", resize);
        renderer.dispose();
        cellMaterial.dispose();
        sectionMaterial.dispose();
        nodeGeo.dispose();
        nodes.forEach((n) => (n.material as import("three").Material).dispose());
        if (mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      };
    });

    return () => {
      disposed = true;
      window.removeEventListener("mousemove", onMouseMove);
      teardown?.();
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
}
