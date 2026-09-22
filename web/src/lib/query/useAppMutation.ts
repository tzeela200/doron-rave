import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '@/design-system/feedback';
import { toAppError, type AppError } from '@/lib/errors';

// The one mutation pattern (Book 08 §13, ADR-044):
//   validate (form) → server mutation → confirmation → refresh the affected queries → success UI
// Success is shown only after the server confirmed AND the dependent data was refetched.
// On failure nothing is shown as saved; the caller keeps the form open with its values.

interface Options<TVars, TResult> {
  operation: string;
  mutationFn: (vars: TVars) => Promise<TResult>;
  refresh: (vars: TVars, result: TResult) => QueryKey[];
  successMessage?: string | ((vars: TVars, result: TResult) => string);
  onSuccess?: (result: TResult, vars: TVars) => void;
}

export function useAppMutation<TVars, TResult = void>({ operation, mutationFn, refresh, successMessage, onSuccess }: Options<TVars, TResult>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation<TResult, AppError, TVars>({
    mutationFn: async (vars) => {
      try {
        return await mutationFn(vars);
      } catch (e) {
        throw toAppError(e, operation);
      }
    },
    onSuccess: async (result, vars) => {
      await Promise.all(refresh(vars, result).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (successMessage) toast.show(typeof successMessage === 'function' ? successMessage(vars, result) : successMessage, 'success');
      onSuccess?.(result, vars);
    },
  });
}
