import './styles/variables.css';
import './styles/global.css';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import CanvasArea from './components/CanvasArea';
import AIPanel from './components/AIPanel';
import StatusBar from './components/StatusBar';

const App = () => {
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
      <TopBar />

      {/* Main workspace */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <Sidebar />
        <CanvasArea />
        <AIPanel />
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
};

export default App;
