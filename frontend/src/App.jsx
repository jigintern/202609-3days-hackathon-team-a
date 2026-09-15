import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ProfileSetup from './pages/ProfileSetup.jsx'
import Artists from './pages/Artists.jsx'
import ArtistDetail from './pages/ArtistDetail.jsx'
import EventDetail from './pages/EventDetail.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminArtists from './pages/admin/AdminArtists.jsx'
import AdminEvents from './pages/admin/AdminEvents.jsx'
import AdminPosts from './pages/admin/AdminPosts.jsx'
import AdminEventRequests from './pages/admin/AdminEventRequests.jsx'

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
        path="/artists/:artistId"
        element={
          <ProtectedRoute>
            <ArtistDetail />
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
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminUsers />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/artists"
        element={
          <AdminRoute>
            <AdminArtists />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/events"
        element={
          <AdminRoute>
            <AdminEvents />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/posts"
        element={
          <AdminRoute>
            <AdminPosts />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/event-requests"
        element={
          <AdminRoute>
            <AdminEventRequests />
          </AdminRoute>
        }
      />
    </Routes>
  )
}

export default App
