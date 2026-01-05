import { Dashboard } from "./components/Dashboard";
import { CustomTitlebar } from "./components/CustomTitlebar";

function App() {
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
