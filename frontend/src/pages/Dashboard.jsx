import { Navigate } from 'react-router-dom';

/** Legacy path — unified into /quiz/statistics */
export default function Dashboard() {
  return <Navigate to="/quiz/statistics" replace />;
}
