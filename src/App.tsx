import { useEffect } from "react";
import { CustomTitlebar } from "@/components/CustomTitlebar";
import { Dashboard } from "@/components/Dashboard";
import { useHotspotStore } from "./store/hotspot";

function App() {
  const { loadSkippedVersion, loadPendingUpdate } = useHotspotStore();

  useEffect(() => {
    loadSkippedVersion();
    loadPendingUpdate(); // Restore pending update if exists

    // Initial silent check
    const { checkForUpdates } = useHotspotStore.getState();
    checkForUpdates(true, true);

    // Check every 15 minutes (15 * 60 * 1000 = 900000 ms)
    const interval = setInterval(() => {
      checkForUpdates(true, true);
    }, 900000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dark h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <CustomTitlebar />
      <div className="flex-1 overflow-y-auto p-1">
        <Dashboard />
      </div>
    </div>
  )
}

export default App;
