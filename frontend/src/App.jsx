import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ProfileSetup from './pages/ProfileSetup.jsx'
import Artists from './pages/Artists.jsx'
import EventDetail from './pages/EventDetail.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/profile-setup" element={<ProfileSetup />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/artists"
        element={
          <ProtectedRoute>
            <Artists />
          </ProtectedRoute>
        }
      />
      <Route
        path="/events/:eventId"
        element={
          <ProtectedRoute>
            <EventDetail />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
