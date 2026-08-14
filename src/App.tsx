import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import PlaylistPage from "./pages/PlaylistPage";

// 路由设计：一期仅播单管理一个页面；/channels、/channels/:id/edit 为二期预留
const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/playlist" replace /> },
  { path: "/playlist", element: <PlaylistPage /> },
  { path: "*", element: <Navigate to="/playlist" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
