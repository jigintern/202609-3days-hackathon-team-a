import { Routes, Route, Outlet } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ProfileSetup from './pages/ProfileSetup.jsx'
import Artists from './pages/Artists.jsx'
import ArtistDetail from './pages/ArtistDetail.jsx'
import EventDetail from './pages/EventDetail.jsx'
import EventRequestNew from './pages/EventRequestNew.jsx'
import VaultUnlock from './pages/VaultUnlock.jsx'
import Vault from './pages/Vault.jsx'
import VaultEntryForm from './pages/VaultEntryForm.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import AdminUsers from './pages/admin/AdminUsers.jsx'
import AdminArtists from './pages/admin/AdminArtists.jsx'
import AdminEvents from './pages/admin/AdminEvents.jsx'
import AdminPosts from './pages/admin/AdminPosts.jsx'
import AdminEventRequests from './pages/admin/AdminEventRequests.jsx'
import RequireVaultKey from './components/RequireVaultKey.jsx'
import { VaultProvider } from './hooks/useVault.jsx'

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
        path="/event-requests/new"
        element={
          <ProtectedRoute>
            <EventRequestNew />
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

      {/* 導出鍵をメモリ上で共有するため、保管庫の画面はまとめてVaultProviderで囲む */}
      <Route
        element={
          <ProtectedRoute>
            <VaultProvider>
              <Outlet />
            </VaultProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/vault/unlock" element={<VaultUnlock />} />
        <Route
          path="/vault"
          element={
            <RequireVaultKey>
              <Vault />
            </RequireVaultKey>
          }
        />
        <Route
          path="/vault/new"
          element={
            <RequireVaultKey>
              <VaultEntryForm />
            </RequireVaultKey>
          }
        />
        <Route
          path="/vault/:entryId/edit"
          element={
            <RequireVaultKey>
              <VaultEntryForm />
            </RequireVaultKey>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
