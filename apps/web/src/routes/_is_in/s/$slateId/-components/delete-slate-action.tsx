import { useParams } from "@tanstack/react-router";
import { Trash } from "iconoir-react";
import { useCallback, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "#/components/ui/alert-dialog";
import { Button } from "#/components/ui/button";
import { useDeleteSlateMutation } from "#/lib/slates";

type DeleteSlateActionProps = {
  onDeleted: () => void;
};

const alertDialogTriggerRender = <Button type="button" variant="clay" />;

export function DeleteSlateAction({ onDeleted }: DeleteSlateActionProps) {
  const { slateId } = useParams({ from: "/_is_in/s/$slateId/" });
  const deleteSlate = useDeleteSlateMutation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = useCallback(async () => {
    await deleteSlate.mutateAsync(slateId, {
      onSuccess() {
        setDeleteOpen(false);
        onDeleted();
      },
    });
  }, [deleteSlate, onDeleted, slateId]);

  return (
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogTrigger render={alertDialogTriggerRender}>
        <Trash aria-hidden="true" /> Delete slate
      </AlertDialogTrigger>
      <AlertDialogContent className="border-line bg-paper-raised text-ink rounded-sm border shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this slate?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the slate and its notes. Collaborators will lose access.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteSlate.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="clay" disabled={deleteSlate.isPending} onClick={handleDelete}>
            {deleteSlate.isPending ? "Deleting..." : "Delete slate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
