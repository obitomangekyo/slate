import { Toast } from "@base-ui/react/toast";
import { CheckCircle, InfoCircle, WarningCircle, Xmark } from "iconoir-react";

// Components call this shared manager to add messages to the app-wide toast list.
export const toastManager = Toast.createToastManager();

export function Toaster() {
  // Mount the toast manager once so notifications can appear above every route.
  return (
    <Toast.Provider toastManager={toastManager}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2 outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  // Show an icon for each message type and provide a clear dismiss button.
  const { toasts } = Toast.useToastManager();

  return toasts.map((toast) => {
    const isError = toast.type === "error";
    const isSuccess = toast.type === "success";

    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className="group border-line bg-paper-raised text-ink data-[type=error]:border-clay/50 data-[type=error]:bg-paper-raised relative flex items-start gap-2.5 rounded-sm border px-3.5 py-3 text-sm transition-all data-ending-style:translate-y-2 data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:opacity-0"
      >
        {isError ? (
          <WarningCircle className="text-clay mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        ) : isSuccess ? (
          <CheckCircle className="text-mineral mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        ) : (
          <InfoCircle className="text-muted mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        )}

        <Toast.Content className="flex flex-1 flex-col gap-0.5 pr-5">
          {toast.title && <Toast.Title className="text-ink text-xs font-semibold tracking-tight" />}
          {toast.description && <Toast.Description className="text-muted text-xs/relaxed" />}
        </Toast.Content>

        <Toast.Close
          aria-label="Dismiss notification"
          className="text-muted hover:bg-paper hover:text-ink absolute top-2.5 right-2.5 cursor-pointer rounded-xs p-0.5 transition-colors"
        >
          <Xmark className="size-3.5" strokeWidth={1.75} />
        </Toast.Close>
      </Toast.Root>
    );
  });
}
