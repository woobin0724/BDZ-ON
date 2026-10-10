import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import ElderApp from './pages/ElderApp'
import DemoPanel from './pages/DemoPanel'
import SplitView from './pages/SplitView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/app" element={<ElderApp />} />
      <Route path="/demo" element={<DemoPanel />} />
      <Route path="/split" element={<SplitView />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
