// src/App.tsx
import React from 'react';
import { BabylonScene } from './BabylonScene';
import './App.css';

const App: React.FC = () => {
    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <BabylonScene />
        </div>
    );
};

export default App;