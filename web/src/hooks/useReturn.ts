import { useLocation, useNavigate } from 'react-router-dom';

/**
 * After saving a sub-form, go back to the context it was opened from (Book 07 §43: never jump
 * home). With no in-app history (deep link), replace with the logical parent instead.
 */
export function useReturn(): (fallback: string) => void {
  const navigate = useNavigate();
  const location = useLocation();
  return (fallback) => {
    if (location.key !== 'default') navigate(-1);
    else navigate(fallback, { replace: true });
  };
}
