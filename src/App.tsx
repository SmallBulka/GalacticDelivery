import React from 'react';
import { BabylonScene } from './BabylonScene';
import './App.css';

const App: React.FC = () => {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <BabylonScene />
        </div>
    );
};

export default App;
