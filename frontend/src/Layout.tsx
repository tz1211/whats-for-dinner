import { Link, useLocation, Outlet } from "react-router-dom";
import css from "./Layout.module.css";

function Layout() {
  const location = useLocation();

  return (
    <div className={css.wrapper}>
      <div className={css.header}>
        <div className={css.logo}>TZ</div>
        <nav className={css.nav}>
          <Link 
            to="/" 
            className={`${css.navLink} ${location.pathname === '/' ? css.active : ''}`}
          >
            Fridge Manager
          </Link>
          <Link 
            to="/recipes" 
            className={`${css.navLink} ${location.pathname === '/recipes' ? css.active : ''}`}
          >
            Recipes
          </Link>
        </nav>
      </div>
      <div className={css.content}>
        <Outlet />
      </div>
    </div>
  );
}

export default Layout;

