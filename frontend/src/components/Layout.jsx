import Header from './Header.jsx'

function Layout({ children }) {
  return (
    <>
      <Header />
      <div className="container">{children}</div>
    </>
  )
}

export default Layout
