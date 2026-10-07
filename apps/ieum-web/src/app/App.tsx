import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { queryClient } from './queryClient';
import { routes } from './routes';

// basename은 Vite base('/ieum/') 한 곳에서 온다(R33)
const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
