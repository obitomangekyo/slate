import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { cn } from "cn";
import SlateAppIcon from "#/assets/svgs/slate-app-icon.svg?react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { useStepper } from "#/hooks/use-stepper";
import { authQueryOptions, useLogoutMutation } from "#/lib/auth";

export function WorkspaceHeader() {
  const { data: user } = useQuery(authQueryOptions);
  const logout = useLogoutMutation();
  const navigate = useNavigate();
  const logoutAndReturn = async () => {
    await logout.mutateAsync(undefined, {
      async onSuccess() {
        await navigate({ to: "/login" });
      },
    });
  };
  const logoutSteps = useStepper("Log out", async function* () {
    let confirmed = false;
    for (const seconds of [3, 2, 1]) {
      // A second click confirms; waiting through all three ticks cancels logout.
      const choice = yield { label: `Confirm log out? · ${seconds}s`, auto: 1000 };
      if (choice === "click") {
        confirmed = true;
        break;
      }
    }
    if (!confirmed) return;

    // Advancing from this short status step starts the request below.
    yield { label: "Signing out...", busy: true, auto: 1 };
    try {
      await logoutAndReturn();
      return;
    } catch {
      const retry = yield { label: "Could not log out · click to retry" };
      if (retry !== "click") return;
      yield { label: "Signing out...", busy: true, auto: 1 };
      await logoutAndReturn();
    }
  });
  const fadeClass = logoutSteps.label.endsWith("· 3")
    ? "opacity-100"
    : logoutSteps.label.endsWith("· 2")
      ? "opacity-75"
      : logoutSteps.label.endsWith("· 1")
        ? "opacity-50"
        : "opacity-100";

  return (
    <header className="border-line bg-paper-raised border-b">
      <div className="container mx-auto flex h-16 w-11/12 items-center justify-between">
        <div className="flex items-center gap-5">
          <Link to="/" className="flex items-center text-xs leading-none" aria-label="Slate home">
            <SlateAppIcon aria-hidden="true" className="h-[3em]" />
            <span className="mr-3 ml-1 text-[2em] font-semibold tracking-tight">Slate</span>
          </Link>
        </div>
        {/* Keep profile details and account actions together in one small menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="border-line bg-paper text-ink hover:bg-paper-raised flex size-9 items-center justify-center rounded-full border text-sm font-semibold"
            aria-label="Account menu"
          >
            {user?.name?.slice(0, 1).toUpperCase() ?? "?"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="text-ink block text-sm font-semibold">{user?.name}</span>
                <span className="text-muted-ink mt-0.5 block truncate text-xs font-normal">
                  {user?.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Settings · coming soon</DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={logoutSteps.busy || logout.isPending}
              className={cn("transition-opacity duration-700", fadeClass)}
              onClick={logoutSteps.advance}
              closeOnClick={false}
            >
              {logout.isPending ? "Signing out..." : logoutSteps.label}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
