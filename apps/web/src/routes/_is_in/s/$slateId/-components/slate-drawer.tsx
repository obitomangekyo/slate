import type { SlateDetail } from "@slate/shared";
import { useNavigate, useParams } from "@tanstack/react-router";
import { cn } from "cn";
import { Hourglass, MenuScale } from "iconoir-react";
import { useCallback, useState } from "react";
import { buttonVariants } from "#/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "#/components/ui/drawer";
import { Field, FieldLabel } from "#/components/ui/field";
import { Switch } from "#/components/ui/switch";
import { useUpdateSlateMutation } from "#/lib/slates";
import { CopyLinkArea } from "./copy-link-area";
import { DeleteSlateAction } from "./delete-slate-action";
import { InviteCollaboratorsAction } from "./invite-collaborators-action";

type SlateDrawerProps = Pick<SlateDetail, "ownerId" | "collaborators" | "isPublic"> & {
  userId?: string;
};

function SlateDrawer({ userId, ownerId, collaborators, isPublic }: SlateDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate({ from: "/s/$slateId/" });
  const { slateId } = useParams({ from: "/_is_in/s/$slateId/" });
  const updateSlate = useUpdateSlateMutation();

  const isOwner = userId === ownerId;

  const onInvited = useCallback(() => setDrawerOpen(false), []);

  const onDeleted = useCallback(async () => {
    setDrawerOpen(false);
    await navigate({ to: "/" });
  }, [navigate]);

  const updateVisibility = useCallback(
    async (nextIsPublic: boolean) => {
      await updateSlate.mutateAsync({ slateId, changes: { isPublic: nextIsPublic } });
    },
    [slateId, updateSlate],
  );

  const canInvite =
    ownerId === userId ||
    collaborators.some(
      (collaborator) => collaborator.userId === userId && collaborator.role === "editor",
    );

  return (
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} swipeDirection="right">
      <DrawerTrigger
        aria-label="Slate actions"
        className={cn(
          buttonVariants({ variant: "outline", size: "icon-lg" }),
          "pointer-events-auto shrink-0",
        )}
      >
        <MenuScale aria-hidden="true" />
      </DrawerTrigger>
      <DrawerContent className="border-line bg-paper-raised text-ink rounded-sm border shadow-xl">
        <DrawerHeader>
          <DrawerTitle>Slate actions</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex flex-1 flex-col gap-2">
            {canInvite && <InviteCollaboratorsAction onInvited={onInvited} />}
            {isPublic && <CopyLinkArea />}
            {isOwner && (
              <Field orientation="horizontal">
                <FieldLabel htmlFor="make-slate-private">
                  {updateSlate.isPending
                    ? `Making slate ${isPublic ? "private" : "public"}...`
                    : isPublic
                      ? "Make slate private"
                      : "Make slate public"}
                </FieldLabel>
                <Switch
                  id="make-slate-private"
                  checked={isPublic}
                  disabled={updateSlate.isPending}
                  onCheckedChange={updateVisibility}
                />
                {updateSlate.isPending && (
                  <output aria-label="Updating slate visibility" aria-live="polite">
                    <Hourglass
                      aria-hidden="true"
                      className="animate-hourglass-flip text-muted motion-reduce:animate-none"
                    />
                  </output>
                )}
              </Field>
            )}
          </div>
          {isOwner && <DeleteSlateAction onDeleted={onDeleted} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export { SlateDrawer };
