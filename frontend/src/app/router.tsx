import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AuthPage } from '../pages/AuthPage';
import { GalleryPage } from '../pages/GalleryPage';
import { HomePage } from '../pages/HomePage';
import { MyWorksPage } from '../pages/MyWorksPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProfilePage } from '../pages/ProfilePage';
import { AppShell, RouteError } from './AppShell';
import { RequireAuth } from './RequireAuth';

// Редактор — найбільший шматок коду, вантажимо його окремим чанком
const EditorPage = lazy(() => import('../pages/EditorPage'));

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/editor', element: <EditorPage /> },
      { path: '/editor/:id', element: <EditorPage /> },
      { path: '/gallery', element: <GalleryPage /> },
      {
        path: '/me',
        element: (
          <RequireAuth>
            <MyWorksPage />
          </RequireAuth>
        ),
      },
      { path: '/u/:username', element: <ProfilePage /> },
      { path: '/login', element: <AuthPage mode="login" /> },
      { path: '/register', element: <AuthPage mode="register" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
