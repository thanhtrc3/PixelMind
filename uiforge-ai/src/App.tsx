import { useState } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import './styles/variables.css';
import './styles/global.css';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import AIPanel from './components/AIPanel';
import StatusBar from './components/StatusBar';
import Guide from './components/Guide';

const App = () => {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <TopBar onOpenGuide={() => setGuideOpen(true)} />

      {/* Main workspace — resizable panels */}
      <Group direction="horizontal" style={{ flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <Panel defaultSize="240px" minSize="160px" maxSize="320px" collapsible>
          <Sidebar />
        </Panel>
        <Separator />

        {/* Canvas */}
        <Panel minSize="30%">
          <CanvasArea />
        </Panel>
        <Separator />

        {/* AI Panel */}
        <Panel defaultSize="320px" minSize="240px" maxSize="480px" collapsible>
          <AIPanel />
        </Panel>
      </Group>

      {/* Status bar */}
      <StatusBar />

      {/* Guide overlay */}
      <Guide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
};

export default App;
