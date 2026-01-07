import { useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { CustomTitlebar } from "./components/CustomTitlebar";
import { UpdateModal } from "./components/UpdateModal";
import { useHotspotStore } from "./store/hotspot";

function App() {
  const { loadSkippedVersion, loadPendingUpdate } = useHotspotStore();

  useEffect(() => {
    loadSkippedVersion();
    loadPendingUpdate(); // Restore pending update if exists
    // Auto-check removed - will be triggered after successful connection
  }, []);

  return (
    <div className="dark h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <CustomTitlebar />
      <div className="flex-1 overflow-y-auto p-1">
        <Dashboard />

      </div>
      <UpdateModal />
    </div>
  )
}

export default App;
