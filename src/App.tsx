import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import UrlTool from './pages/UrlTool'

const TOOLS = [
  { path: '/url', label: 'URL', description: 'Transform and manipulate URLs' },
]

function Home() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Tools</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {TOOLS.map(tool => (
          <Link
            key={tool.path}
            to={tool.path}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <p className="font-medium text-gray-800">{tool.label}</p>
            <p className="text-sm text-gray-400 mt-1">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <Link to="/" className="font-bold text-gray-800 mr-4">cc-toolkit</Link>
        <NavLink
          to="/url"
          className={({ isActive }) =>
            `text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-800'}`
          }
        >
          URL
        </NavLink>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/cc-toolkit/">
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/url" element={<UrlTool />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}