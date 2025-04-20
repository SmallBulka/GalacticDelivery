// src/components/BabylonScene.tsx
import React, { useEffect, useRef } from 'react';
import { SpaceScene } from './babylon/scenes/SpaceScene';


export const BabylonScene: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current) {
            const physicsScene = new SpaceScene(canvasRef.current);

            const handleResize = () => {
                physicsScene.resize();
            };

            window.addEventListener('resize', handleResize);

            return () => {
                window.removeEventListener('resize', handleResize);
            };
        }
    }, []);

    return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }} />;
};