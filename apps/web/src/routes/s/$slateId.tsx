import { zodResolver } from "@hookform/resolvers/zod";
import { MAX_SLATE_TITLE_LENGTH, MIN_SLATE_TITLE_LENGTH } from "@slate/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  Copy,
  NavArrowLeft,
  Plus,
  SidebarCollapse,
  Trash,
  WarningTriangle,
  Xmark,
} from "iconoir-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#/components/ui/drawer";
import { Input } from "#/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { toastManager } from "#/components/ui/toast";
import { Board } from "#/features/board";
import { authQueryOptions } from "#/lib/auth";
import {
  publicSlateQueryOptions,
  slateDetailQueryOptions,
  useDeleteSlateMutation,
  useInviteCollaboratorsMutation,
  useUpdateSlateMutation,
  useUpdateSlateTitleMutation,
} from "#/lib/slates";

const InviteFormSchema = z.object({
  emails: z
    .array(z.object({ email: z.email("Enter a valid email address.") }))
    .min(1)
    .max(20),
  role: z.enum(["editor", "viewer"]),
});
type InviteForm = z.infer<typeof InviteFormSchema>;

export const Route = createFileRoute("/s/$slateId")({
  // Slate data uses the browser's relative `/api` proxy, so this loader must not run on the server.
  ssr: false,
  loader: async ({ context, params }) => {
    // Signed-in people get their access-specific slate data; guests can only fetch public boards.
    const user = await context.queryClient.ensureQueryData({
      ...authQueryOptions,
      staleTime: "static",
    });
    const slateQuery = user
      ? slateDetailQueryOptions(params.slateId)
      : publicSlateQueryOptions(params.slateId);
    return context.queryClient.ensureQueryData({ ...slateQuery, staleTime: "static" });
  },
  head: ({ loaderData, params }) => ({
    meta: [{ title: `${loaderData?.title ?? params.slateId} · Slate` }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { slateId } = Route.useParams();
  const navigate = useNavigate();
  const { data: user } = useSuspenseQuery(authQueryOptions);
  const { data: slate } = useSuspenseQuery(
    user ? slateDetailQueryOptions(slateId) : publicSlateQueryOptions(slateId),
  );
  const updateTitle = useUpdateSlateTitleMutation();
  const updateSlate = useUpdateSlateMutation();
  const deleteSlate = useDeleteSlateMutation();
  const inviteCollaborators = useInviteCollaboratorsMutation(slateId);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = titleDraft ?? slate.title;
  const isOwner = user?.id === slate.ownerId;
  const canEdit =
    isOwner ||
    slate.collaborators.some(
      (collaborator) => collaborator.userId === user?.id && collaborator.role === "editor",
    );

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(InviteFormSchema),
    defaultValues: { emails: [{ email: "" }], role: "editor" },
  });
  const inviteFields = useFieldArray({ control: inviteForm.control, name: "emails" });
  const inviteRole = useWatch({ control: inviteForm.control, name: "role" });

  useEffect(
    () => () => {
      // Cancel a pending save when leaving this board so it cannot update an old route.
      if (titleTimer.current) clearTimeout(titleTimer.current);
    },
    [],
  );

  const scheduleTitleSave = (nextTitle: string) => {
    setTitleDraft(nextTitle);
    setTitleError(false);
    setSaved(false);
    const cleanTitle = nextTitle.trim();
    if (!cleanTitle || cleanTitle === slate.title) return;
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      try {
        await updateTitle.mutateAsync({ slateId, title: cleanTitle });
        setSaved(true);
        setTitleDraft((draft) => (draft === cleanTitle ? null : draft));
      } catch {
        setTitleError(true);
      }
    }, 600);
  };

  const inviteByEmail = async (form: InviteForm) => {
    const result = await inviteCollaborators.mutateAsync({
      emails: form.emails.map((item) => item.email),
      role: form.role,
    });
    const failures = result.results
      .filter((item) => !item.sent)
      .map((item) => ({ email: item.email }));
    if (failures.length) {
      inviteForm.setValue("emails", failures);
      return;
    }
    inviteForm.reset({ emails: [{ email: "" }], role: "editor" });
    setInviteOpen(false);
    setDrawerOpen(false);
  };

  const canInvite =
    slate.ownerId === user?.id ||
    slate.collaborators.some(
      (collaborator) => collaborator.userId === user?.id && collaborator.role === "editor",
    );

  return (
    <>
      {/* These small controls float above the canvas; the empty space still belongs to the board. */}
      <header className="fixed inset-x-0 top-0 z-30">
        <div className="pointer-events-none container mx-auto flex h-16 items-center justify-between md:h-18 lg:h-16 xl:h-18">
          <div className="border-line bg-paper-raised/95 flex min-w-0 items-center gap-2 rounded-sm border p-1.5 shadow-md backdrop-blur sm:gap-3">
            <Link
              to="/"
              aria-label="Back to home"
              className="text-muted-ink hover:text-ink hover:bg-paper pointer-events-auto grid size-9 shrink-0 place-items-center rounded-xs"
            >
              <NavArrowLeft aria-hidden="true" />
            </Link>
            <InputGroup className="pointer-events-auto max-w-[min(28rem,calc(100vw-7rem))] min-w-0">
              <InputGroupInput
                aria-label="Slate title"
                disabled={!canEdit}
                aria-invalid={titleError}
                value={title}
                maxLength={MAX_SLATE_TITLE_LENGTH}
                onChange={(event) => scheduleTitleSave(event.target.value)}
                onBlur={() => {
                  if (title.trim().length < MIN_SLATE_TITLE_LENGTH) {
                    if (titleTimer.current) clearTimeout(titleTimer.current);
                    setTitleDraft(null);
                    setTitleError(false);
                    toastManager.add({ type: "error", title: "A title is required" });
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    if (titleTimer.current) clearTimeout(titleTimer.current);
                    setTitleDraft(null);
                    setTitleError(false);
                    event.currentTarget.blur();
                  }
                }}
                className="focus-visible:border-line focus-visible:bg-paper-raised h-9 min-w-0 border-transparent bg-transparent px-2 text-base font-semibold shadow-none"
              />
              {(updateTitle.isPending || titleError || saved) && (
                <InputGroupAddon align="inline-end" className="pr-2">
                  {updateTitle.isPending ? (
                    <output
                      className="border-muted-ink size-4 animate-spin rounded-full border-2 border-r-transparent"
                      aria-label="Saving title"
                    />
                  ) : titleError ? (
                    <button
                      type="button"
                      aria-label="Retry title save"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => scheduleTitleSave(title)}
                      className="text-clay"
                    >
                      <WarningTriangle aria-hidden="true" />
                    </button>
                  ) : (
                    <Check className="text-mineral" aria-label="Title saved" />
                  )}
                </InputGroupAddon>
              )}
            </InputGroup>
          </div>

          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} swipeDirection="right">
            <DrawerTrigger
              aria-label="Slate actions"
              className="border-line bg-paper-raised/95 hover:bg-paper pointer-events-auto grid size-11 shrink-0 place-items-center rounded-sm border shadow-md backdrop-blur"
            >
              <SidebarCollapse className="text-lg" aria-hidden="true" />
            </DrawerTrigger>
            <DrawerContent className="border-line bg-paper-raised text-ink rounded-sm border shadow-xl">
              <DrawerHeader>
                <DrawerTitle>Slate actions</DrawerTitle>
              </DrawerHeader>
              <div className="flex flex-1 flex-col gap-2 p-4">
                {canInvite && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => setInviteOpen(true)}
                  >
                    Invite collaborators
                  </Button>
                )}
                {slate.isPublic ? (
                  <CopyLinkButton />
                ) : (
                  <p className="text-muted-ink px-3 py-2 text-sm">
                    This slate is private. Only collaborators can open it.
                  </p>
                )}
                {isOwner && (
                  <Button
                    variant="outline"
                    className="justify-start"
                    disabled={updateSlate.isPending}
                    onClick={async () => {
                      await updateSlate.mutateAsync({
                        slateId,
                        changes: { isPublic: !slate.isPublic },
                      });
                    }}
                  >
                    {updateSlate.isPending
                      ? "Updating access…"
                      : slate.isPublic
                        ? "Make slate private"
                        : "Make slate public"}
                  </Button>
                )}
                {isOwner && (
                  <Button
                    // variant="destructive"
                    className="justify-start"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash aria-hidden="true" /> Delete slate
                  </Button>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </header>

      <main>
        <Board />
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20">
        <div className="container mx-auto"></div>
      </footer>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="border-line bg-paper-raised text-ink rounded-sm border shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite collaborators</DialogTitle>
            <DialogDescription>Send an invitation link to each email address.</DialogDescription>
          </DialogHeader>
          <form onSubmit={inviteForm.handleSubmit(inviteByEmail)} className="grid gap-3">
            {inviteFields.fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <label
                    htmlFor={`invite-email-${field.id}`}
                    className="text-muted-ink mb-1 block text-xs"
                  >
                    Email address {index + 1}
                  </label>
                  <Input
                    id={`invite-email-${field.id}`}
                    type="email"
                    autoComplete="email"
                    {...inviteForm.register(`emails.${index}.email`)}
                    aria-invalid={Boolean(inviteForm.formState.errors.emails?.[index])}
                  />
                  {inviteForm.formState.errors.emails?.[index]?.email && (
                    <p className="text-clay mt-1 text-xs">
                      {inviteForm.formState.errors.emails[index]?.email?.message}
                    </p>
                  )}
                </div>
                {inviteFields.fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove email ${index + 1}`}
                    className="mt-5"
                    onClick={() => inviteFields.remove(index)}
                  >
                    <Xmark />
                  </Button>
                )}
              </div>
            ))}
            {inviteFields.fields.length < 20 && (
              <Button
                type="button"
                variant="ghost"
                className="justify-start"
                onClick={() => inviteFields.append({ email: "" })}
              >
                <Plus aria-hidden="true" /> Add another email
              </Button>
            )}
            <div className="text-muted-ink grid gap-1.5 text-xs font-medium">
              <label htmlFor="invite-role">Access level</label>
              <Select
                value={inviteRole}
                onValueChange={(value) => inviteForm.setValue("role", value as "editor" | "viewer")}
              >
                <SelectTrigger id="invite-role" aria-label="Collaborator access level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="editor">Can edit</SelectItem>
                  <SelectItem value="viewer">Can view only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteCollaborators.isError && (
              <Alert variant="destructive">
                <AlertTitle>Some invitations could not be sent</AlertTitle>
                <AlertDescription>Check the highlighted addresses and try again.</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button type="submit" disabled={inviteCollaborators.isPending}>
                {inviteCollaborators.isPending ? "Sending..." : "Send invitations"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-line bg-paper-raised text-ink rounded-sm border shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this slate?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the slate and its notes. Collaborators will lose access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSlate.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="clay"
              disabled={deleteSlate.isPending}
              onClick={async (event) => {
                event.preventDefault();
                await deleteSlate.mutateAsync(slateId);
                setDeleteOpen(false);
                setDrawerOpen(false);
                await navigate({ to: "/" });
              }}
            >
              {deleteSlate.isPending ? "Deleting..." : "Delete slate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CopyLinkButton() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("copied");
      toastManager.add({ type: "success", title: "Slate link copied" });
    } catch {
      setCopyState("error");
      toastManager.add({ type: "error", title: "Could not copy slate link" });
    }
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState("idle"), 1500);
  };

  return (
    <Button variant="outline" className="justify-start" onClick={copyLink}>
      {copyState === "copied" ? (
        <Check aria-hidden="true" />
      ) : copyState === "error" ? (
        <WarningTriangle aria-hidden="true" />
      ) : (
        <Copy aria-hidden="true" />
      )}
      {copyState === "copied"
        ? "Copied"
        : copyState === "error"
          ? "Copy failed, try again"
          : "Copy public link"}
    </Button>
  );
}
